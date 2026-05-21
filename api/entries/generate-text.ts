import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'
import { jwtVerify } from 'jose'
import { v2 as cloudinary } from 'cloudinary'

type ImageStyle = 'cartoon' | 'anime' | 'pixel' | 'sketch' | 'watercolor' | 'custom'

const STYLE_PROMPTS: Record<ImageStyle, string> = {
  cartoon: 'in a vibrant cartoon illustration style, bold outlines, bright colors, playful and expressive',
  anime: 'in Japanese anime style, clean linework, soft shading, expressive eyes, cel-shaded',
  pixel: 'in pixel art style, 16-bit retro game aesthetic, chunky pixels, limited color palette',
  sketch: 'in pencil sketch style, hand-drawn linework, cross-hatching, monochrome with subtle tones',
  watercolor: 'in soft watercolor painting style, translucent washes, gentle bleeding edges, dreamy atmosphere',
  custom: '',
}

function buildTextPrompt(text: string, style: ImageStyle, customStyle?: string) {
  const styleDesc = style === 'custom' && customStyle ? customStyle : STYLE_PROMPTS[style]
  return `A beautiful artistic illustration of: "${text}". Rendered ${styleDesc}. High quality, detailed, suitable for a personal diary. No text or watermarks.`
}

async function verifyToken(token: string) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
  const { payload } = await jwtVerify(token, secret)
  return payload as { userId: string; email: string }
}

function extractToken(req: VercelRequest): string | null {
  const auth = (req.headers['authorization'] as string) || ''
  return auth.startsWith('Bearer ') ? auth.slice(7) : null
}

async function getGoogleAccessToken(): Promise<string> {
  const keyBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY!
  const keyJson = JSON.parse(Buffer.from(keyBase64, 'base64').toString('utf-8'))
  const { GoogleAuth } = await import('google-auth-library')
  const auth = new GoogleAuth({ credentials: keyJson, scopes: ['https://www.googleapis.com/auth/cloud-platform'] })
  const client = await auth.getClient()
  const tokenResponse = await client.getAccessToken()
  return tokenResponse.token!
}

async function uploadBase64Image(base64Data: string, folder: string): Promise<string> {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
  })
  const dataUri = base64Data.startsWith('data:') ? base64Data : `data:image/png;base64,${base64Data}`
  const result = await cloudinary.uploader.upload(dataUri, { folder, transformation: [{ quality: 'auto:good' }] })
  return result.secure_url
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = extractToken(req)
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  let userId: string
  try { userId = (await verifyToken(token)).userId }
  catch { return res.status(401).json({ error: 'Invalid token' }) }

  const { text, style, customStyle, date } = req.body || {}
  if (!text || !style || !date) return res.status(400).json({ error: 'Missing fields' })

  try {
    const projectId = process.env.GOOGLE_PROJECT_ID!
    const location = process.env.GOOGLE_LOCATION || 'us-central1'
    const accessToken = await getGoogleAccessToken()
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-4.0-generate-001:predict`
    const prompt = buildTextPrompt(text, style, customStyle)
    const aiRes = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio: '1:1', safetySetting: 'block_some' } }),
    })
    if (!aiRes.ok) throw new Error(`Imagen error: ${await aiRes.text()}`)
    const data = await aiRes.json()
    const base64 = data.predictions?.[0]?.bytesBase64Encoded
    if (!base64) throw new Error('No image returned')

    const imageUrl = await uploadBase64Image(base64, `picdiary/${userId}`)
    const sql = neon(process.env.DATABASE_URL!)
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
