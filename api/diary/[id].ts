import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../../lib/db'
import { extractToken, verifyToken } from '../../lib/auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' })

  const token = extractToken(req as any)
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  let userId: string
  try {
    const payload = await verifyToken(token)
    userId = payload.userId
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }

  const { id } = req.query
  const sql = getDb()

  const [note] = await sql`SELECT id FROM diary_notes WHERE id = ${id} AND user_id = ${userId}`
  if (!note) return res.status(404).json({ error: 'Not found' })

  await sql`DELETE FROM diary_notes WHERE id = ${id}`
  return res.json({ success: true })
}
