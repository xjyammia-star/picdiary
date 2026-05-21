import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'
import { jwtVerify } from 'jose'
import { v2 as cloudinary } from 'cloudinary'

type ImageStyle = 'cartoon' | 'anime' | 'pixel' | 'sketch' | 'watercolor' | 'custom'

const STYLE_PROMPTS: Record<ImageStyle, string> = {
  cartoon: 'in a detailed cartoon illustration style with semi-realistic proportions, clean linework, vibrant but natural colors, preserving facial features and scene atmosphere',
  anime: 'in a high-quality Japanese anime illustration style, detailed linework, natural shading, realistic proportions, preserving the original scene mood and background details',
  pixel: 'in pixel art style, 16-bit retro aesthetic, preserving the key composition and recognizable details of the original scene',
  sketch: 'as a detailed pencil sketch illustration, fine linework, cross-hatching for depth, preserving composition and key details',
  watercolor: 'as a detailed watercolor illustration, soft washes with precise linework, preserving the original scene composition and atmosphere',
  custom: '',
}

function buildPhotoPrompt(style: ImageStyle, customStyle?: string) {
  const styleDesc = style === 'custom' && customStyle ? customStyle : STYLE_PROMPTS[style]
  return `Convert this photo into an artistic illustration ${styleDesc}. Faithfully preserve: the exact composition and camera angle, all background details including any text/signs/banners, the subject's clothing colors and physical features, lighting conditions, and overall scene atmosphere. Maintain the original aspect ratio. High quality, detailed artwork. Do not add or remove elements from the scene.`
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

  const { photoBase64, mimeType, style, customStyle, date, aspectRatio } = req.body || {}
  if (!photoBase64 || !style || !date) return res.status(400).json({ error: 'Missing fields' })

  const ratio = aspectRatio || '1:1'

  try {
    const originalUrl = await uploadBase64Image(
      `data:${mimeType || 'image/jpeg'};base64,${photoBase64}`,
      `picdiary/${userId}/originals`
    )

    const projectId = process.env.GOOGLE_PROJECT_ID!
    const accessToken = await getGoogleAccessToken()
    // Gemini 2.5+ models require 'global' location on Vertex AI
    const endpoint = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/gemini-2.5-flash-image:generateContent`
    const prompt = buildPhotoPrompt(style, customStyle)

    const aiRes = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ inline_data: { mime_type: mimeType || 'image/jpeg', data: photoBase64 } }, { text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    })
    if (!aiRes.ok) throw new Error(`Gemini error: ${await aiRes.text()}`)
    const data = await aiRes.json()
    const parts = data.candidates?.[0]?.content?.parts || []
    // Handle both camelCase and snake_case response formats
    const imagePart = parts.find((p: any) => 
      p.inlineData?.mimeType?.startsWith('image/') || 
      p.inline_data?.mime_type?.startsWith('image/')
    )
    if (!imagePart) throw new Error('No image from Gemini')
    const imageData = imagePart.inlineData?.data || imagePart.inline_data?.data

    const generatedUrl = await uploadBase64Image(imageData, `picdiary/${userId}`)
    const sql = neon(process.env.DATABASE_URL!)
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
