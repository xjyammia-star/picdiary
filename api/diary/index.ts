import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/db'
import { extractToken, verifyToken } from '../lib/auth'
import { generateDiaryText } from '../lib/ai'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = extractToken(req as any)
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  let userId: string
  try {
    const payload = await verifyToken(token)
    userId = payload.userId
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }

  const sql = getDb()

  // GET diary note for date
  if (req.method === 'GET') {
    const date = req.query.date as string
    if (!date) return res.status(400).json({ error: 'date required' })
    const [note] = await sql`
      SELECT * FROM diary_notes WHERE user_id = ${userId} AND date = ${date}
    `
    if (!note) return res.status(404).json({ error: 'Not found' })
    return res.json(note)
  }

  // POST generate diary note
  if (req.method === 'POST') {
    const { date, keywords } = req.body || {}
    if (!date) return res.status(400).json({ error: 'date required' })

    // Fetch entries for that day
    const entries = await sql`
      SELECT input_text, style, input_type FROM diary_entries
      WHERE user_id = ${userId} AND date = ${date}
      ORDER BY created_at ASC
    `
    if (entries.length === 0) return res.status(400).json({ error: 'No entries for this date' })

    const descriptions = entries.map((e: any) => {
      if (e.input_type === 'text') return `文字描述：${e.input_text}，风格：${e.style}`
      return `照片，风格化为：${e.style}`
    })

    try {
      const content = await generateDiaryText(descriptions, keywords)

      // Upsert diary note
      const [note] = await sql`
        INSERT INTO diary_notes (user_id, date, content, keywords)
        VALUES (${userId}, ${date}, ${content}, ${keywords || null})
        ON CONFLICT (user_id, date) DO UPDATE SET content = ${content}, keywords = ${keywords || null}, created_at = NOW()
        RETURNING *
      `
      return res.status(201).json(note)
    } catch (err: any) {
      console.error('Diary generate error:', err)
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
