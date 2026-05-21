import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../../_db'
import { extractToken, verifyToken } from '../../_auth'
import { deleteImage, uploadBase64Image } from '../../_cloudinary'
import { generateImageFromText, generateImageFromPhoto, buildTextPrompt, buildPhotoPrompt } from '../../_ai'

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

  const { id } = req.query
  const sql = getDb()

  // Fetch entry and verify ownership
  const [entry] = await sql`SELECT * FROM diary_entries WHERE id = ${id} AND user_id = ${userId}`
  if (!entry) return res.status(404).json({ error: 'Entry not found' })

  // DELETE
  if (req.method === 'DELETE') {
    try {
      await deleteImage(entry.generated_image_url)
      if (entry.input_photo_url) await deleteImage(entry.input_photo_url)
      await sql`DELETE FROM diary_entries WHERE id = ${id}`
      return res.json({ success: true })
    } catch (err: any) {
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
