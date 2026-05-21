import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'
import { jwtVerify } from 'jose'

async function verifyToken(token: string) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
  const { payload } = await jwtVerify(token, secret)
  return payload as { userId: string; email: string }
}

function extractToken(req: VercelRequest): string | null {
  const auth = (req.headers['authorization'] as string) || ''
  return auth.startsWith('Bearer ') ? auth.slice(7) : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = extractToken(req)
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  let userId: string
  try { userId = (await verifyToken(token)).userId }
  catch { return res.status(401).json({ error: 'Invalid token' }) }

  const sql = neon(process.env.DATABASE_URL!)

  if (req.method === 'GET') {
    const date = req.query.date as string
    if (!date) return res.status(400).json({ error: 'date required' })
    const [note] = await sql`SELECT * FROM diary_notes WHERE user_id = ${userId} AND date = ${date}`
    if (!note) return res.status(404).json({ error: 'Not found' })
    return res.json(note)
  }

  if (req.method === 'POST') {
    const { date, keywords } = req.body || {}
    if (!date) return res.status(400).json({ error: 'date required' })

    const entries = await sql`
      SELECT input_text, style, input_type FROM diary_entries
      WHERE user_id = ${userId} AND date = ${date}
      ORDER BY created_at ASC
    `
    if (entries.length === 0) return res.status(400).json({ error: 'No entries for this date' })

    // Fetch user profile
    let profile: any = null
    try { const rows = await sql`SELECT * FROM user_profiles WHERE user_id = ${userId}`; profile = rows[0] || null } catch {}

    const descriptions = entries.map((e: any) => {
      if (e.input_type === 'text') return `文字描述：${e.input_text}，风格：${e.style}`
      return `照片，风格化为：${e.style}`
    })

    try {
      const apiKey = process.env.DOUBAO_API_KEY!
      const model = process.env.DOUBAO_MODEL || 'doubao-seed-2-0-lite-260428'
      const imagesDesc = descriptions.map((d: string, i: number) => `第${i + 1}张图：${d}`).join('\n')
      const keywordHint = keywords ? `\n用户关键词：${keywords}` : ''
      const userPrompt = `今天的经历素材：\n${imagesDesc}${keywordHint}\n\n请根据这些素材，帮我写一篇有故事性和逻辑连贯性的今日日记，把这些片段自然地串联成一个完整的故事。`

      const doubaoRes = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: '你是一个温暖有文采的日记写手，善于用优美的语言记录生活点滴。根据用户当天的图片内容，写一篇100-200字的日记片段，要有情感，有画面感，像真实的日记一样自然。不要写日期，不要写标题，直接写正文。' },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 600,
          temperature: 0.8,
        }),
      })
      if (!doubaoRes.ok) throw new Error(`Doubao error: ${await doubaoRes.text()}`)
      const doubaoData = await doubaoRes.json()
      const content = doubaoData.choices?.[0]?.message?.content || ''

      const [note] = await sql`
        INSERT INTO diary_notes (user_id, date, content, keywords)
        VALUES (${userId}, ${date}, ${content}, ${keywords || null})
        ON CONFLICT (user_id, date) DO UPDATE SET content = ${content}, keywords = ${keywords || null}, created_at = NOW()
        RETURNING *
      `
      return res.status(201).json(note)
    } catch (err: any) {
      console.error('Diary generate error:', err)
      return res.status(500).json({ error: err.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
