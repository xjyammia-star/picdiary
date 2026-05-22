import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'
import { SignJWT } from 'jose'
import bcrypt from 'bcryptjs'

async function signToken(payload: { userId: string; email: string }) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
  return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('30d').sign(secret)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

  const sql = neon(process.env.DATABASE_URL!)
  const [user] = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase()}`
  if (!user) return res.status(401).json({ error: 'invalid_credentials' })

  const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' })

  const token = await signToken({ userId: user.id, email: user.email })
  return res.json({ token, user: { id: user.id, email: user.email, created_at: user.created_at, is_admin: user.is_admin || false } })
}
