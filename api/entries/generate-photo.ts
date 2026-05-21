import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/db'
import { extractToken, verifyToken } from '../lib/auth'
import { uploadBase64Image } from '../lib/cloudinary'
import { generateImageFromPhoto, buildPhotoPrompt } from '../lib/ai'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = extractToken(req as any)
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  let userId: string
  try {
    const payload = await verifyToken(token)
    userId = payload.userId
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }

  const { photoBase64, mimeType, style, customStyle, date, aspectRatio } = req.body || {}
  if (!photoBase64 || !style || !date) return res.status(400).json({ error: 'Missing fields' })

  const ratio = aspectRatio || '1:1'

  try {
    // Upload original photo to cloudinary
    const originalUrl = await uploadBase64Image(
      `data:${mimeType || 'image/jpeg'};base64,${photoBase64}`,
      `picdiary/${userId}/originals`
    )

    const prompt = buildPhotoPrompt(style, customStyle)
    const generatedBase64 = await generateImageFromPhoto(photoBase64, mimeType || 'image/jpeg', prompt)
    const generatedUrl = await uploadBase64Image(generatedBase64, `picdiary/${userId}`)

    const sql = getDb()
    const [entry] = await sql`
      INSERT INTO diary_entries (user_id, date, input_type, input_photo_url, style, custom_style, generated_image_url, aspect_ratio)
      VALUES (${userId}, ${date}, 'photo', ${originalUrl}, ${style}, ${customStyle || null}, ${generatedUrl}, ${ratio})
      RETURNING *
    `
    return res.status(201).json(entry)
  } catch (err: any) {
    console.error('Generate photo error:', err)
    return res.status(500).json({ error: err.message || 'Generation failed' })
  }
}
