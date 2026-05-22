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
  if (password.length < 6) return res.status(400).json({ error: 'Password too short' })

  const sql = neon(process.env.DATABASE_URL!)
  const existing = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()}`
  if (existing.length > 0) return res.status(409).json({ error: 'email_exists' })

  const passwordHash = await bcrypt.hash(password, 10)
  const [user] = await sql`
    INSERT INTO users (email, password_hash)
    VALUES (${email.toLowerCase()}, ${passwordHash})
    RETURNING id, email, created_at
  `
  const token = await signToken({ userId: user.id, email: user.email })
  return res.status(201).json({ token, user: { id: user.id, email: user.email, created_at: user.created_at, is_admin: user.is_admin || false } })
}
