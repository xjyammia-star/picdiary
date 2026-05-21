import type { ImageStyle } from '../src/types'

// ─── Style prompt builders ───────────────────────────────────────────────────

const STYLE_PROMPTS: Record<ImageStyle, string> = {
  cartoon: 'in a vibrant cartoon illustration style, bold outlines, bright colors, playful and expressive',
  anime: 'in Japanese anime style, clean linework, soft shading, expressive eyes, cel-shaded',
  pixel: 'in pixel art style, 16-bit retro game aesthetic, chunky pixels, limited color palette',
  sketch: 'in pencil sketch style, hand-drawn linework, cross-hatching, monochrome with subtle tones',
  watercolor: 'in soft watercolor painting style, translucent washes, gentle bleeding edges, dreamy atmosphere',
  custom: '',
}

export function buildTextPrompt(text: string, style: ImageStyle, customStyle?: string): string {
  const styleDesc = style === 'custom' && customStyle
    ? customStyle
    : STYLE_PROMPTS[style]
  return `A beautiful artistic illustration of: "${text}". Rendered ${styleDesc}. High quality, detailed, suitable for a personal diary. No text or watermarks in the image.`
}

export function buildPhotoPrompt(style: ImageStyle, customStyle?: string): string {
  const styleDesc = style === 'custom' && customStyle
    ? customStyle
    : STYLE_PROMPTS[style]
  return `Transform this photo into an artistic illustration ${styleDesc}. Preserve the original composition, subjects, background, and key details. Maintain the same aspect ratio and spatial layout. High quality artistic rendering, no text or watermarks.`
}

// ─── Vertex AI Imagen 4 (text-to-image) ──────────────────────────────────────

export async function generateImageFromText(
  prompt: string,
  aspectRatio: string = '1:1'
): Promise<string> {
  const projectId = process.env.GOOGLE_PROJECT_ID!
  const location = process.env.GOOGLE_LOCATION || 'us-central1'

  // Get access token from service account
  const accessToken = await getGoogleAccessToken()

  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-4.0-generate-001:predict`

  const body = {
    instances: [{ prompt }],
    parameters: {
      sampleCount: 1,
      aspectRatio,
      safetySetting: 'block_some',
      personGeneration: 'allow_adult',
    },
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Imagen 4 error: ${err}`)
  }

  const data = await res.json()
  const base64 = data.predictions?.[0]?.bytesBase64Encoded
  if (!base64) throw new Error('No image returned from Imagen 4')
  return base64
}

// ─── Gemini 2.5 Flash Image (photo-to-image / Nano Banana) ───────────────────

export async function generateImageFromPhoto(
  photoBase64: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  const projectId = process.env.GOOGLE_PROJECT_ID!
  const location = process.env.GOOGLE_LOCATION || 'us-central1'
  const accessToken = await getGoogleAccessToken()

  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/gemini-2.5-flash-image:generateContent`

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: photoBase64,
            },
          },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
    },
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini image error: ${err}`)
  }

  const data = await res.json()
  const parts = data.candidates?.[0]?.content?.parts || []
  const imagePart = parts.find((p: any) => p.inline_data?.mime_type?.startsWith('image/'))
  if (!imagePart) throw new Error('No image returned from Gemini')
  return imagePart.inline_data.data
}

// ─── Doubao Seed 2.0 Lite (diary text generation) ────────────────────────────

export async function generateDiaryText(
  imageDescriptions: string[],
  keywords?: string
): Promise<string> {
  const apiKey = process.env.DOUBAO_API_KEY!
  const model = process.env.DOUBAO_MODEL || 'doubao-seed-2-0-lite-260428'

  const imagesDesc = imageDescriptions.map((d, i) => `第${i + 1}张图：${d}`).join('\n')
  const keywordHint = keywords ? `\n用户关键词：${keywords}` : ''

  const systemPrompt = `你是一个温暖有文采的日记写手，善于用优美的语言记录生活点滴。根据用户当天的图片内容，写一篇100-200字的日记片段，要有情感，有画面感，像真实的日记一样自然。不要写日期，不要写标题，直接写正文。`

  const userPrompt = `今天我创作了这些图片：\n${imagesDesc}${keywordHint}\n\n请帮我写一篇今天的日记。`

  const res = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 400,
      temperature: 0.8,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Doubao error: ${err}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

// ─── Google Access Token ──────────────────────────────────────────────────────

async function getGoogleAccessToken(): Promise<string> {
  // Service account key stored as base64 in env
  const keyBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY!
  const keyJson = JSON.parse(Buffer.from(keyBase64, 'base64').toString('utf-8'))

  const { GoogleAuth } = await import('google-auth-library')
  const auth = new GoogleAuth({
    credentials: keyJson,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  })
  const client = await auth.getClient()
  const tokenResponse = await client.getAccessToken()
  return tokenResponse.token!
}

// ─── Aspect ratio helper ──────────────────────────────────────────────────────

export function detectAspectRatio(width: number, height: number): string {
  const ratio = width / height
  if (ratio > 1.7) return '16:9'
  if (ratio > 1.2) return '4:3'
  if (ratio > 0.9) return '1:1'
  if (ratio > 0.7) return '3:4'
  return '9:16'
}
