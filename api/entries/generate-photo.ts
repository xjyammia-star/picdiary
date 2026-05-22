import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'
import { jwtVerify } from 'jose'
import { v2 as cloudinary } from 'cloudinary'

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

function buildPhotoPrompt(style: ImageStyle, customStyle?: string): string {
  const styleDesc = style === 'custom' && customStyle ? customStyle : STYLE_PROMPTS[style]
  return 'Redraw this entire photo as a ' + styleDesc + '. CRITICAL RULES: (1) Every single element in the original photo must appear in the output at the same position — people, objects, background, signs, text, banners, birds, trees, buildings, everything. Do NOT remove, erase or omit any element. (2) All text, logos, signs and banners must remain legible and in the same location, rendered in the chosen art style. (3) The entire image — foreground, background, every detail — must be fully redrawn in the chosen art style. Nothing should look photorealistic. (4) Maintain the original composition, framing and aspect ratio exactly.'
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

async function describeImageForDiary(imageUrl: string): Promise<string> {
  const apiKey = process.env.DOUBAO_API_KEY!
  const model = process.env.DOUBAO_MODEL || 'doubao-seed-2-0-lite-260428'
  try {
    const res = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: imageUrl } },
          { type: 'text', text: '请用简洁的中文描述这张图片的具体内容：包括图中有什么人（外貌、表情、动作）、在什么场景（地点、环境）、有什么具体物品（要准确，比如奖杯就说奖杯）、正在发生什么。只描述看到的内容，100字以内。' }
        ]}],
        max_tokens: 200, temperature: 0.1,
      }),
    })
    if (!res.ok) return ''
    const data = await res.json()
    return data.choices?.[0]?.message?.content?.trim() || ''
  } catch { return '' }
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
    const endpoint = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/gemini-3.1-flash-image-preview:generateContent`
    const prompt = buildPhotoPrompt(style as ImageStyle, customStyle)

    const aiRes = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [
          { inline_data: { mime_type: mimeType || 'image/jpeg', data: photoBase64 } },
          { text: prompt }
        ]}],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    })
    if (!aiRes.ok) throw new Error(`Gemini error: ${await aiRes.text()}`)
    const data = await aiRes.json()
    const parts = data.candidates?.[0]?.content?.parts || []
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
    describeImageForDiary(originalUrl).then(async (desc) => {
      if (desc) {
        const sql2 = neon(process.env.DATABASE_URL!)
        await sql2`UPDATE diary_entries SET image_description = ${desc} WHERE id = ${entry.id}`.catch(() => {})
      }
    })
    return res.status(201).json(entry)
  } catch (err: any) {
    console.error('Generate photo error:', err)
    return res.status(500).json({ error: err.message || 'Generation failed' })
  }
}
