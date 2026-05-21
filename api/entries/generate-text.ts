import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../lib/db'
import { extractToken, verifyToken } from '../lib/auth'
import { uploadBase64Image } from '../lib/cloudinary'
import { generateImageFromText, buildTextPrompt } from '../lib/ai'

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

  const { text, style, customStyle, date } = req.body || {}
  if (!text || !style || !date) return res.status(400).json({ error: 'Missing fields' })

  try {
    const prompt = buildTextPrompt(text, style, customStyle)
    const base64 = await generateImageFromText(prompt, '1:1')
    const imageUrl = await uploadBase64Image(base64, `picdiary/${userId}`)

    const sql = getDb()
    const [entry] = await sql`
      INSERT INTO diary_entries (user_id, date, input_type, input_text, style, custom_style, generated_image_url, aspect_ratio)
      VALUES (${userId}, ${date}, 'text', ${text}, ${style}, ${customStyle || null}, ${imageUrl}, '1:1')
      RETURNING *
    `
    return res.status(201).json(entry)
  } catch (err: any) {
    console.error('Generate text error:', err)
    return res.status(500).json({ error: err.message || 'Generation failed' })
  }
}
