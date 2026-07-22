import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'
import { jwtVerify } from 'jose'
import { v2 as cloudinary } from 'cloudinary'
// Inline permission check
async function checkUserPermissions(userId: string, style: string) {
  const sql = neon(process.env.DATABASE_URL!)
  const [user] = await sql`SELECT status, daily_limit, allowed_styles, styles_unlimited FROM users WHERE id = ${userId}`
  if (!user) return { allowed: false, reason: 'user_not_found', permissions: { status:'free', daily_limit:3, allowed_styles:['anime'], styles_unlimited:false, today_count:0 } }
  if (user.status === 'banned') return { allowed: false, reason: 'banned', permissions: { status:'banned', daily_limit:0, allowed_styles:[], styles_unlimited:false, today_count:0 } }
  const [countRow] = await sql`SELECT COUNT(*)::int AS count FROM diary_entries WHERE user_id = ${userId} AND date = CURRENT_DATE`
  const today_count = countRow?.count || 0
  const permissions = { status: user.status || 'free', daily_limit: user.daily_limit ?? 3, allowed_styles: user.styles_unlimited ? [] : (user.allowed_styles || 'anime').split(',').map((s: string) => s.trim()), styles_unlimited: user.styles_unlimited ?? false, today_count }
  if (user.status === 'paid') return { allowed: true, permissions }
  if (user.daily_limit !== 0 && today_count >= (user.daily_limit ?? 3)) return { allowed: false, reason: 'daily_limit_reached', permissions }
  if (!user.styles_unlimited && style !== 'custom') {
    const allowed = (user.allowed_styles || 'anime').split(',').map((s: string) => s.trim())
    if (!allowed.includes(style)) return { allowed: false, reason: 'style_not_allowed', permissions }
  }
  return { allowed: true, permissions }
}

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

interface UserProfile { gender?: string; birth_year?: number }

function buildPhotoPrompt(style: ImageStyle, customStyle?: string) {
  const styleDesc = style === 'custom' && customStyle ? customStyle : STYLE_PROMPTS[style]
  return 'Redraw this entire photo as a ' + styleDesc + '. CRITICAL RULES: (1) Every element must appear at the same position. (2) All text, signs and banners must remain in the same location rendered in the art style. (3) The entire image must be fully redrawn in the chosen art style. Nothing should look photorealistic. (4) Maintain the original composition exactly.'
}

function buildTextPrompt(text: string, style: ImageStyle, customStyle?: string, profile?: UserProfile) {
  const styleDesc = style === 'custom' && customStyle ? customStyle : STYLE_PROMPTS[style]
  const hints: string[] = []
  if (profile?.gender === '男' || profile?.gender === 'Male') hints.push('The main character is male')
  else if (profile?.gender === '女' || profile?.gender === 'Female') hints.push('The main character is female')
  if (profile?.birth_year) {
    const age = new Date().getFullYear() - profile.birth_year
    if (age >= 3 && age <= 12) hints.push(`child approximately ${age} years old`)
    else if (age >= 13 && age <= 19) hints.push(`teenager approximately ${age} years old`)
    else if (age >= 20) hints.push(`young adult approximately ${age} years old`)
  }
  const subjectHint = hints.length > 0 ? ' Subject: ' + hints.join(', ') + '.' : ''
  return 'A beautiful artistic illustration of: "' + text + '".' + subjectHint + ' Rendered in ' + styleDesc + '. High quality, detailed, suitable for a personal diary. No text or watermarks.'
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
  cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME!, api_key: process.env.CLOUDINARY_API_KEY!, api_secret: process.env.CLOUDINARY_API_SECRET! })
  const dataUri = base64Data.startsWith('data:') ? base64Data : `data:image/png;base64,${base64Data}`
  const result = await cloudinary.uploader.upload(dataUri, { folder, transformation: [{ quality: 'auto:good' }] })
  return result.secure_url
}

async function describeImage(imageUrl: string): Promise<string> {
  const apiKey = process.env.DOUBAO_API_KEY!
  const model = process.env.DOUBAO_MODEL || 'doubao-seed-2-0-lite-260428'
  try {
    const res = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: [
        { type: 'image_url', image_url: { url: imageUrl } },
        { type: 'text', text: '请用简洁的中文描述这张图片的具体内容：包括图中有什么人（外貌、表情、动作）、在什么场景、有什么具体物品（要准确）、正在发生什么。100字以内。' }
      ]}], max_tokens: 200, temperature: 0.1 }),
    })
    const data = await res.json()
    return data.choices?.[0]?.message?.content?.trim() || ''
  } catch { return '' }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = extractToken(req)
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  let userId: string
  try { userId = (await verifyToken(token)).userId }
  catch { return res.status(401).json({ error: 'Invalid token' }) }

  const sql = neon(process.env.DATABASE_URL!)
  const action = req.query.action as string

  // GET /api/entries?date=YYYY-MM-DD
  if (req.method === 'GET') {
    const date = req.query.date as string
    if (!date) return res.status(400).json({ error: 'date required' })
    const entries = await sql`SELECT * FROM diary_entries WHERE user_id = ${userId} AND date = ${date} ORDER BY created_at ASC`
    return res.json(entries)
  }

  // POST /api/entries?action=generate-text
  if (req.method === 'POST' && action === 'generate-text') {
    const { text, style, customStyle, date } = req.body || {}
    if (!text || !style || !date) return res.status(400).json({ error: 'Missing fields' })
    const { allowed, reason, permissions } = await checkUserPermissions(userId, style)
    if (!allowed) return res.status(403).json({ error: reason, permissions, message: reason === 'daily_limit_reached' ? `今日生成次数已达上限（${permissions.daily_limit}次）` : reason === 'style_not_allowed' ? '该风格需要升级账户才能使用' : '账户已被禁用' })
    try {
      let profile: UserProfile | undefined
      try { const rows = await sql`SELECT gender, birth_year FROM user_profiles WHERE user_id = ${userId}`; if (rows[0]) profile = rows[0] as UserProfile } catch {}
      const projectId = process.env.GOOGLE_PROJECT_ID!
      const location = process.env.GOOGLE_LOCATION || 'us-central1'
      const accessToken = await getGoogleAccessToken()
      const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-4.0-generate-001:predict`
      const prompt = buildTextPrompt(text, style as ImageStyle, customStyle, profile)
      const aiRes = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio: '1:1', safetySetting: 'block_some', personGeneration: 'allow_all' } }) })
      if (!aiRes.ok) throw new Error(`Imagen error: ${await aiRes.text()}`)
      const data = await aiRes.json()
      const base64 = data.predictions?.[0]?.bytesBase64Encoded
      if (!base64) throw new Error('No image returned')
      const imageUrl = await uploadBase64Image(base64, `picdiary/${userId}`)
      const [entry] = await sql`INSERT INTO diary_entries (user_id, date, input_type, input_text, style, custom_style, generated_image_url, aspect_ratio) VALUES (${userId}, ${date}, 'text', ${text}, ${style}, ${customStyle || null}, ${imageUrl}, '1:1') RETURNING *`
      describeImage(imageUrl).then(async (desc) => { if (desc) { const s = neon(process.env.DATABASE_URL!); await s`UPDATE diary_entries SET image_description = ${desc} WHERE id = ${entry.id}`.catch(() => {}) } })
      return res.status(201).json(entry)
    } catch (err: any) { return res.status(500).json({ error: err.message || 'Generation failed' }) }
  }

  // POST /api/entries?action=generate-photo
  if (req.method === 'POST' && action === 'generate-photo') {
    const { photoBase64, mimeType, style, customStyle, date, aspectRatio } = req.body || {}
    if (!photoBase64 || !style || !date) return res.status(400).json({ error: 'Missing fields' })
    const ratio = aspectRatio || '1:1'
    const { allowed, reason, permissions } = await checkUserPermissions(userId, style)
    if (!allowed) return res.status(403).json({ error: reason, permissions, message: reason === 'daily_limit_reached' ? `今日生成次数已达上限（${permissions.daily_limit}次）` : reason === 'style_not_allowed' ? '该风格需要升级账户才能使用' : '账户已被禁用' })
    try {
      // Do NOT store original photo - use base64 directly for generation then discard
      const projectId = process.env.GOOGLE_PROJECT_ID!
      const accessToken = await getGoogleAccessToken()
      const endpoint = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/gemini-3.1-flash-image:generateContent`
      const prompt = buildPhotoPrompt(style as ImageStyle, customStyle)
      const aiRes = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ inline_data: { mime_type: mimeType || 'image/jpeg', data: photoBase64 } }, { text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'] } }) })
      const aiText = await aiRes.text()
      if (!aiRes.ok) throw new Error('Gemini HTTP ' + aiRes.status + ': ' + aiText.slice(0, 300))
      let data: any
      try { data = JSON.parse(aiText) } catch (e) { throw new Error('Gemini JSON parse failed: ' + aiText.slice(0, 300)) }
      const candidate = data.candidates?.[0]
      if (!candidate) {
        console.error('Gemini no candidates:', JSON.stringify(data).slice(0, 500))
        throw new Error('No candidates. promptFeedback: ' + JSON.stringify(data.promptFeedback))
      }
      console.log('Gemini ok - finishReason:', candidate.finishReason, 'parts:', JSON.stringify(candidate.content?.parts?.map((p: any) => Object.keys(p))))
      const parts = candidate.content?.parts || []
      const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/') || p.inline_data?.mime_type?.startsWith('image/'))
      if (!imagePart) {
        if (candidate.finishReason === 'IMAGE_PROHIBITED_CONTENT' || candidate.finishReason === 'SAFETY') {
          throw new Error('SAFETY_FILTER: 该照片与所选风格的组合被安全过滤拦截，请尝试换一种风格')
        }
        const partTypes = parts.map((p: any) => Object.keys(p).join(',')).join(' | ')
        throw new Error('No image part. finishReason: ' + candidate.finishReason + ' Parts: ' + partTypes)
      }
      const imageData = imagePart.inlineData?.data || imagePart.inline_data?.data
      if (!imageData) throw new Error('Image part found but no data')
      const generatedUrl = await uploadBase64Image(imageData, `picdiary/${userId}`)
      const [entry] = await sql`INSERT INTO diary_entries (user_id, date, input_type, input_photo_url, style, custom_style, generated_image_url, aspect_ratio) VALUES (${userId}, ${date}, 'photo', NULL, ${style}, ${customStyle || null}, ${generatedUrl}, ${ratio}) RETURNING *`
      // Use generated image for diary description (original photo discarded)
      describeImage(generatedUrl).then(async (desc) => { if (desc) { const s = neon(process.env.DATABASE_URL!); await s`UPDATE diary_entries SET image_description = ${desc} WHERE id = ${entry.id}`.catch(() => {}) } })
      return res.status(201).json(entry)
    } catch (err: any) { return res.status(500).json({ error: err.message || 'Generation failed' }) }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
