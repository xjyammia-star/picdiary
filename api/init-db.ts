import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initDb } from './_db'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Simple auth check - only allow if secret matches
  const secret = req.query.secret
  if (secret !== process.env.JWT_SECRET?.slice(0, 8)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  try {
    await initDb()
    return res.json({ success: true, message: 'Database initialized' })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}
