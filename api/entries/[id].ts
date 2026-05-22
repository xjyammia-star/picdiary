import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'
import { jwtVerify } from 'jose'
import { v2 as cloudinary } from 'cloudinary'

// ── inline helpers ──────────────────────────────────────────────
type ImageStyle = 'anime' | 'storybook' | 'watercolor' | 'sketch' | 'cinematic' | 'oilpainting' | 'dreamy' | 'thai' | 'custom'

const STYLE_PROMPTS: Record<ImageStyle, string> = {
  anime: "Japanese anime illustration style with clean ink lines, expressive eyes, cel-shaded coloring, and painterly backgrounds (like Studio Ghibli or Makoto Shinkai)",
  storybook: "charming childrens book illustration style with soft pastel colors, warm rounded shapes, gentle textures, and a cozy storybook mood, perfect for capturing children and family moments",
  watercolor: "delicate watercolor illustration with soft translucent washes, visible brushstrokes, gentle color bleeding at edges, and a dreamy artistic atmosphere",
  sketch: "hand-drawn pencil sketch with expressive line weights, detailed cross-hatching for shadows, and monochrome graphite tones, like a professional editorial illustration",
  cinematic: "cinematic film still with dramatic lighting, shallow depth of field, rich color grading, warm amber tones, and a moody movie-quality atmosphere",
  oilpainting: "classical oil painting with visible impasto brushstrokes, rich jewel-toned colors, dramatic chiaroscuro lighting, and the texture and depth of canvas, like a museum masterpiece",
  dreamy: "dreamy pastel fantasy illustration with soft cotton-candy colors, glowing light effects, sparkles, airy gradients, kawaii-inspired aesthetic, and a magical whimsical mood",
  thai: "traditional Thai mural painting style inspired by Wat Phra Kaew temple art, with intricate golden linework, jewel-toned colors, ornate decorative patterns, graceful figures in traditional Thai costume, and mythological elements",
  custom: "",
}

function buildTextPrompt(text: string, style: ImageStyle, customStyle?: string) {
  const styleDesc = style === 'custom' && customStyle ? customStyle : STYLE_PROMPTS[style]
  return 'A beautiful artistic illustration of: "' + text + '". Rendered in ' + styleDesc + '. High quality, detailed, suitable for a personal diary. No text or watermarks.'
}

function buildPhotoPrompt(style: ImageStyle, customStyle?: string) {
  const styleDesc = style === 'custom' && customStyle ? customStyle : STYLE_PROMPTS[style]
  return 'Redraw this entire photo as a ' + styleDesc + '. CRITICAL RULES: (1) Every single element in the original photo must appear in the output at the same position — people, objects, background, signs, text, banners, birds, trees, buildings, everything. Do NOT remove, erase or omit any element. (2) All text, logos, signs and banners must remain legible and in the same location, rendered in the chosen art style. (3) The entire image — foreground, background, every detail — must be fully redrawn in the chosen art style. Nothing should look photorealistic. (4) Maintain the original composition, framing and aspect ratio exactly.'
}

async function generateImageFromText(prompt: string, aspectRatio = '1:1'): Promise<string> {
  const projectId = process.env.GOOGLE_PROJECT_ID!
  const accessToken = await getGoogleAccessToken()
  const endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/imagen-4.0-generate-001:predict`
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
  const accessToken = await getGoogleAccessToken()
  const endpoint = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/gemini-3.1-flash-image-preview:generateContent`
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
