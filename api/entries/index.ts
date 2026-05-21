import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../_db'
import { extractToken, verifyToken } from '../_auth'

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

  // GET /api/entries?date=YYYY-MM-DD
  if (req.method === 'GET') {
    const date = req.query.date as string
    if (!date) return res.status(400).json({ error: 'date required' })
    const entries = await sql`
      SELECT * FROM diary_entries
      WHERE user_id = ${userId} AND date = ${date}
      ORDER BY created_at ASC
    `
    return res.json(entries)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
