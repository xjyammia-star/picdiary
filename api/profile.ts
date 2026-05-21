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
  const token = extractToken(req)
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  let userId: string
  try { userId = (await verifyToken(token)).userId }
  catch { return res.status(401).json({ error: 'Invalid token' }) }

  const sql = neon(process.env.DATABASE_URL!)

  if (req.method === 'GET') {
    const [profile] = await sql`SELECT * FROM user_profiles WHERE user_id = ${userId}`
    return res.json(profile || {})
  }

  if (req.method === 'POST') {
    const { nickname, gender, birth_year, personality, self_description, interests } = req.body || {}
    const [profile] = await sql`
      INSERT INTO user_profiles (user_id, nickname, gender, birth_year, personality, self_description, interests, updated_at)
      VALUES (${userId}, ${nickname||null}, ${gender||null}, ${birth_year||null}, ${personality||null}, ${self_description||null}, ${interests||null}, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        nickname = ${nickname||null},
        gender = ${gender||null},
        birth_year = ${birth_year||null},
        personality = ${personality||null},
        self_description = ${self_description||null},
        interests = ${interests||null},
        updated_at = NOW()
      RETURNING *
    `
    return res.json(profile)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
