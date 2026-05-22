import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'
import { SignJWT } from 'jose'
import bcrypt from 'bcryptjs'

async function signToken(payload: { userId: string; email: string }) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
  return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('30d').sign(secret)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const sql = neon(process.env.DATABASE_URL!)
  const action = req.query.action as string

  // POST /api/auth?action=login
  if (req.method === 'POST' && action === 'login') {
    const { email, password } = req.body || {}
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
    const [user] = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase()}`
    if (!user) return res.status(401).json({ error: 'invalid_credentials' })
    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' })
    const token = await signToken({ userId: user.id, email: user.email })
    return res.json({ token, user: { id: user.id, email: user.email, created_at: user.created_at, is_admin: user.is_admin || false } })
  }

  // POST /api/auth?action=register
  if (req.method === 'POST' && action === 'register') {
    const { email, password } = req.body || {}
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
    if (password.length < 6) return res.status(400).json({ error: 'Password too short' })
    const existing = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()}`
    if (existing.length > 0) return res.status(409).json({ error: 'email_exists' })
    const passwordHash = await bcrypt.hash(password, 10)
    const [user] = await sql`
      INSERT INTO users (email, password_hash)
      VALUES (${email.toLowerCase()}, ${passwordHash})
      RETURNING id, email, created_at, is_admin
    `
    const token = await signToken({ userId: user.id, email: user.email })
    return res.status(201).json({ token, user: { id: user.id, email: user.email, created_at: user.created_at, is_admin: user.is_admin || false } })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
