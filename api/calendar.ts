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
  try {
    const payload = await verifyToken(token)
    userId = payload.userId
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }

  const year = parseInt(req.query.year as string)
  const month = parseInt(req.query.month as string)
  if (!year || !month) return res.status(400).json({ error: 'year and month required' })

  const sql = neon(process.env.DATABASE_URL!)
  const entries = await sql`
    SELECT date::text AS date, COUNT(*) AS entry_count, MIN(generated_image_url) AS preview_image_url
    FROM diary_entries
    WHERE user_id = ${userId}
      AND EXTRACT(YEAR FROM date) = ${year}
      AND EXTRACT(MONTH FROM date) = ${month}
    GROUP BY date ORDER BY date
  `
  const notes = await sql`
    SELECT date::text AS date FROM diary_notes
    WHERE user_id = ${userId}
      AND EXTRACT(YEAR FROM date) = ${year}
      AND EXTRACT(MONTH FROM date) = ${month}
  `
  const noteDates = new Set(notes.map((n: any) => n.date))
  const result = entries.map((e: any) => ({
    date: e.date,
    entry_count: parseInt(e.entry_count),
    has_note: noteDates.has(e.date),
    preview_image_url: e.preview_image_url,
  }))
  return res.json(result)
}
