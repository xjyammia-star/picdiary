import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'
import { jwtVerify } from 'jose'

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
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const token = extractToken(req)
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  let userId: string
  try { userId = (await verifyToken(token)).userId }
  catch { return res.status(401).json({ error: 'Invalid token' }) }

  const sql = neon(process.env.DATABASE_URL!)
  const [user] = await sql`SELECT status, daily_limit, allowed_styles, styles_unlimited FROM users WHERE id = ${userId}`
  if (!user) return res.status(404).json({ error: 'Not found' })

  const [countRow] = await sql`
    SELECT COUNT(*)::int AS count FROM diary_entries
    WHERE user_id = ${userId} AND date = CURRENT_DATE
  `

  return res.json({
    status: user.status || 'free',
    daily_limit: user.daily_limit ?? 3,
    allowed_styles: user.styles_unlimited ? [] : (user.allowed_styles || 'anime').split(',').map((s: string) => s.trim()),
    styles_unlimited: user.styles_unlimited ?? false,
    today_count: countRow?.count || 0,
  })
}
