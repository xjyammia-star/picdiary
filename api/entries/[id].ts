import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../../lib/db'
import { extractToken, verifyToken } from '../../lib/auth'
import { deleteImage, uploadBase64Image } from '../../lib/cloudinary'
import { generateImageFromText, generateImageFromPhoto, buildTextPrompt, buildPhotoPrompt } from '../../lib/ai'

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

  // POST /api/entries/[id]?action=regenerate
  if (req.method === 'POST') {
    try {
      await deleteImage(entry.generated_image_url)

      let newBase64: string
      if (entry.input_type === 'text') {
        const prompt = buildTextPrompt(entry.input_text, entry.style, entry.custom_style)
        newBase64 = await generateImageFromText(prompt, entry.aspect_ratio)
      } else {
        const photoRes = await fetch(entry.input_photo_url)
        const buffer = await photoRes.arrayBuffer()
        const photoBase64 = Buffer.from(buffer).toString('base64')
        const mimeType = photoRes.headers.get('content-type') || 'image/jpeg'
        const prompt = buildPhotoPrompt(entry.style, entry.custom_style)
        newBase64 = await generateImageFromPhoto(photoBase64, mimeType, prompt)
      }

      const newUrl = await uploadBase64Image(newBase64, `picdiary/${userId}`)
      const [updated] = await sql`
        UPDATE diary_entries SET generated_image_url = ${newUrl} WHERE id = ${id}
        RETURNING *
      `
      return res.json(updated)
    } catch (err: any) {
      console.error('Regenerate error:', err)
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
