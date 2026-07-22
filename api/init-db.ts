import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = req.query.secret
  if (secret !== 'picdiary2026') {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  try {
    const sql = neon(process.env.DATABASE_URL!)

    await sql`CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin BOOLEAN DEFAULT FALSE,
      status TEXT DEFAULT 'free',
      daily_limit INT DEFAULT 3,
      allowed_styles TEXT DEFAULT 'anime',
      styles_unlimited BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`

    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE`
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'free'`
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_limit INT DEFAULT 3`
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_styles TEXT DEFAULT 'anime'`
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS styles_unlimited BOOLEAN DEFAULT FALSE`

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
      image_description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`
    await sql`CREATE INDEX IF NOT EXISTS idx_entries_user_date ON diary_entries(user_id, date)`
    await sql`ALTER TABLE diary_entries ADD COLUMN IF NOT EXISTS image_description TEXT`

    await sql`CREATE TABLE IF NOT EXISTS diary_notes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      content TEXT NOT NULL,
      keywords TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, date)
    )`

    await sql`CREATE TABLE IF NOT EXISTS user_profiles (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      nickname TEXT,
      gender TEXT,
      birth_year INT,
      personality TEXT,
      self_description TEXT,
      interests TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`

    const adminEmail = process.env.ADMIN_EMAIL
    if (adminEmail) {
      await sql`UPDATE users SET is_admin = TRUE, status = 'paid', styles_unlimited = TRUE WHERE email = ${adminEmail}`
    }

    return res.json({ success: true, message: 'Database initialized' })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}
