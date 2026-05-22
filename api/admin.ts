import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'
import { jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'

async function verifyToken(token: string) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
  const { payload } = await jwtVerify(token, secret)
  return payload as { userId: string; email: string }
}

function extractToken(req: VercelRequest): string | null {
  const auth = (req.headers['authorization'] as string) || ''
  return auth.startsWith('Bearer ') ? auth.slice(7) : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = extractToken(req)
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  let userId: string
  try { userId = (await verifyToken(token)).userId }
  catch { return res.status(401).json({ error: 'Invalid token' }) }

  const sql = neon(process.env.DATABASE_URL!)

  // Verify admin
  const [me] = await sql`SELECT is_admin FROM users WHERE id = ${userId}`
  if (!me?.is_admin) return res.status(403).json({ error: 'Admin only' })

  // GET /api/admin - list all users
  if (req.method === 'GET') {
    const users = await sql`
      SELECT u.id, u.email, u.is_admin, u.status, u.daily_limit, u.allowed_styles, u.styles_unlimited, u.created_at,
        p.nickname, p.gender, p.birth_year,
        COUNT(DISTINCT e.id)::int AS total_entries,
        COUNT(DISTINCT CASE WHEN e.date = CURRENT_DATE THEN e.id END)::int AS today_entries
      FROM users u
      LEFT JOIN user_profiles p ON p.user_id = u.id
      LEFT JOIN diary_entries e ON e.user_id = u.id
      WHERE u.is_admin = FALSE
      GROUP BY u.id, u.email, u.is_admin, u.status, u.daily_limit, u.allowed_styles, u.styles_unlimited, u.created_at, p.nickname, p.gender, p.birth_year
      ORDER BY u.created_at DESC
    `
    return res.json(users)
  }

  // POST /api/admin - update user settings
  if (req.method === 'POST') {
    const { targetUserId, action, value } = req.body || {}
    if (!targetUserId || !action) return res.status(400).json({ error: 'Missing fields' })

    switch (action) {
      case 'set_status':
        await sql`UPDATE users SET status = ${value} WHERE id = ${targetUserId}`
        break
      case 'set_daily_limit':
        await sql`UPDATE users SET daily_limit = ${parseInt(value)} WHERE id = ${targetUserId}`
        break
      case 'set_styles_unlimited':
        await sql`UPDATE users SET styles_unlimited = ${value === true || value === 'true'} WHERE id = ${targetUserId}`
        break
      case 'set_allowed_styles':
        // value is comma-separated style names e.g. "anime,watercolor"
        await sql`UPDATE users SET allowed_styles = ${value} WHERE id = ${targetUserId}`
        break
      case 'reset_password':
        const hash = await bcrypt.hash(value, 10)
        await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${targetUserId}`
        break
      default:
        return res.status(400).json({ error: 'Unknown action' })
    }
    return res.json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
