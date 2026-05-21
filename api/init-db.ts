import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = req.query.secret
  if (secret !== process.env.JWT_SECRET?.slice(0, 8)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  try {
    const sql = neon(process.env.DATABASE_URL!)
    await sql`CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`
    await sql`CREATE TABLE IF NOT EXISTS diary_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      input_type TEXT NOT NULL CHECK (input_type IN ('text','photo')),
      input_text TEXT,
      input_photo_url TEXT,
      style TEXT NOT NULL,
      custom_style TEXT,
      generated_image_url TEXT NOT NULL,
      aspect_ratio TEXT NOT NULL DEFAULT '1:1',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`
    await sql`CREATE INDEX IF NOT EXISTS idx_entries_user_date ON diary_entries(user_id, date)`
    await sql`CREATE TABLE IF NOT EXISTS diary_notes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      content TEXT NOT NULL,
      keywords TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, date)
    )`
    return res.json({ success: true, message: 'Database initialized' })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}
