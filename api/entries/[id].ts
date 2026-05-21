import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'
import { jwtVerify } from 'jose'
import { v2 as cloudinary } from 'cloudinary'

// ── inline helpers ──────────────────────────────────────────────
type ImageStyle = 'cartoon' | 'anime' | 'pixel' | 'sketch' | 'watercolor' | 'custom'

function getDb() { return neon(process.env.DATABASE_URL!) }

async function verifyToken(token: string) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
  const { payload } = await jwtVerify(token, secret)
  return payload as { userId: string; email: string }
}

function extractToken(req: VercelRequest): string | null {
  const auth = (req.headers['authorization'] as string) || ''
  return auth.startsWith('Bearer ') ? auth.slice(7) : null
}

function initCld() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
  })
  return cloudinary
}

async function uploadBase64Image(base64Data: string, folder: string): Promise<string> {
  const cld = initCld()
  const dataUri = base64Data.startsWith('data:') ? base64Data : `data:image/png;base64,${base64Data}`
  const result = await cld.uploader.upload(dataUri, { folder, transformation: [{ quality: 'auto:good' }] })
  return result.secure_url
}

async function deleteImage(url: string): Promise<void> {
  const cld = initCld()
  const match = url.match(/\/([^/]+\/[^/]+)\.[a-z]+$/)
  if (match) await cld.uploader.destroy(match[1])
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

const STYLE_PROMPTS: Record<ImageStyle, string> = {
  cartoon: 'in a detailed cartoon illustration style with semi-realistic proportions, clean linework, vibrant but natural colors, preserving facial features and scene atmosphere',
  anime: 'in a high-quality Japanese anime illustration style, detailed linework, natural shading, realistic proportions, preserving the original scene mood and background details',
  pixel: 'in pixel art style, 16-bit retro aesthetic, preserving the key composition and recognizable details of the original scene',
  sketch: 'as a detailed pencil sketch illustration, fine linework, cross-hatching for depth, preserving composition and key details',
  watercolor: 'as a detailed watercolor illustration, soft washes with precise linework, preserving the original scene composition and atmosphere',
  custom: '',
}

function buildTextPrompt(text: string, style: ImageStyle, customStyle?: string) {
  const styleDesc = style === 'custom' && customStyle ? customStyle : STYLE_PROMPTS[style]
  return `A beautiful artistic illustration of: "${text}". Rendered ${styleDesc}. High quality, detailed, suitable for a personal diary. No text or watermarks.`
}

function buildPhotoPrompt(style: ImageStyle, customStyle?: string) {
  const styleDesc = style === 'custom' && customStyle ? customStyle : STYLE_PROMPTS[style]
  return `Convert this photo into an artistic illustration ${styleDesc}. Faithfully preserve: the exact composition and camera angle, all background details including any text/signs/banners, the subject's clothing colors and physical features, lighting conditions, and overall scene atmosphere. Maintain the original aspect ratio. High quality, detailed artwork. Do not add or remove elements from the scene.`
}

async function generateImageFromText(prompt: string, aspectRatio = '1:1'): Promise<string> {
  const projectId = process.env.GOOGLE_PROJECT_ID!
  const location = process.env.GOOGLE_LOCATION || 'us-central1'
  const accessToken = await getGoogleAccessToken()
  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-4.0-generate-001:predict`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio, safetySetting: 'block_some' } }),
  })
  if (!res.ok) throw new Error(`Imagen error: ${await res.text()}`)
  const data = await res.json()
  const base64 = data.predictions?.[0]?.bytesBase64Encoded
  if (!base64) throw new Error('No image from Imagen')
  return base64
}

async function generateImageFromPhoto(photoBase64: string, mimeType: string, prompt: string): Promise<string> {
  const projectId = process.env.GOOGLE_PROJECT_ID!
  const location = process.env.GOOGLE_LOCATION || 'us-central1'
  const accessToken = await getGoogleAccessToken()
  const endpoint = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/gemini-2.5-flash-image:generateContent`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ inline_data: { mime_type: mimeType, data: photoBase64 } }, { text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
  })
  if (!res.ok) throw new Error(`Gemini error: ${await res.text()}`)
  const data = await res.json()
  const parts = data.candidates?.[0]?.content?.parts || []
  const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/') || p.inline_data?.mime_type?.startsWith('image/'))
  if (!imagePart) throw new Error('No image from Gemini')
  return imagePart.inlineData?.data || imagePart.inline_data?.data
}

// ── handler ─────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = extractToken(req)
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

  // POST = regenerate
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
      const [updated] = await sql`UPDATE diary_entries SET generated_image_url = ${newUrl} WHERE id = ${id} RETURNING *`
      return res.json(updated)
    } catch (err: any) {
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
