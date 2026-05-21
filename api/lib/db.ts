import { neon } from '@neondatabase/serverless'

export function getDb() {
  const sql = neon(process.env.DATABASE_URL!)
  return sql
}

export async function initDb() {
  const sql = getDb()
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS diary_entries (
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
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_entries_user_date ON diary_entries(user_id, date)`
  await sql`
    CREATE TABLE IF NOT EXISTS diary_notes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      content TEXT NOT NULL,
      keywords TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, date)
    )
  `
}
