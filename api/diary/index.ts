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

    // Fetch entries with pre-analyzed descriptions
    const entries = await sql`
      SELECT input_text, input_type, image_description
      FROM diary_entries
      WHERE user_id = ${userId} AND date = ${date}
      ORDER BY created_at ASC
    `
    if (entries.length === 0) return res.status(400).json({ error: 'No entries for this date' })

    // Fetch user profile
    let profile: any = null
    try { const rows = await sql`SELECT * FROM user_profiles WHERE user_id = ${userId}`; profile = rows[0] || null } catch {}

    try {
      // Build content descriptions from stored analysis
      const descriptions = entries.map((e: any, i: number) => {
        const desc = e.image_description || ''
        if (e.input_type === 'text' && e.input_text) {
          return desc
            ? `【第${i+1}个记录】用户备注："${e.input_text}" | 图片内容：${desc}`
            : `【第${i+1}个记录】用户备注："${e.input_text}"`
        }
        return desc
          ? `【第${i+1}个记录】图片内容：${desc}`
          : `【第${i+1}个记录】（照片）`
      })
      const imagesDesc = descriptions.join('\n')

      // Build profile context
      const currentYear = new Date().getFullYear()
      const profileParts: string[] = []
      if (profile?.nickname) profileParts.push(`叫${profile.nickname}`)
      if (profile?.gender) profileParts.push(`${profile.gender}生`)
      if (profile?.birth_year) profileParts.push(`${currentYear - profile.birth_year}岁`)
      if (profile?.personality) profileParts.push(`性格${profile.personality}`)
      if (profile?.interests) profileParts.push(`喜欢${profile.interests}`)
      if (profile?.self_description) profileParts.push(profile.self_description)
      const profileHint = profileParts.length > 0
        ? `\n\n【关于我】${profileParts.join('，')}。请以第一人称"我"来写，语气和用词要符合这个人的年龄和性格。`
        : '\n\n请以第一人称"我"来写。'

      const keywordHint = keywords ? `\n【补充关键词】${keywords}` : ''

      const systemPrompt = `你是一位擅长写私人日记的作家。请根据用户今天的真实经历，写一篇有故事性、有温度、逻辑连贯的日记。

写作要求：
1. 以第一人称"我"叙述，语气自然真诚，像真人在写日记
2. 要有完整的叙事弧：交代发生了什么 → 具体细节和感受 → 情感收尾或感悟
3. 把多个经历自然串联成一个故事，不要分条罗列
4. 细节要忠实于图片真实内容（图里是奖杯就写奖杯，不能写成奖牌）
5. 字数150-250字，不写日期和标题，直接写正文${profileHint}`

      const userPrompt = `今天的经历：\n${imagesDesc}${keywordHint}\n\n请根据以上内容写一篇今天的日记。`

      const apiKey = process.env.DOUBAO_API_KEY!
      const model = process.env.DOUBAO_MODEL || 'doubao-seed-2-0-lite-260428'

      const doubaoRes = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 600,
          temperature: 0.85,
        }),
      })
      if (!doubaoRes.ok) throw new Error(`Doubao error: ${await doubaoRes.text()}`)
      const doubaoData = await doubaoRes.json()
      const diaryContent = doubaoData.choices?.[0]?.message?.content || ''

      const [note] = await sql`
        INSERT INTO diary_notes (user_id, date, content, keywords)
        VALUES (${userId}, ${date}, ${diaryContent}, ${keywords || null})
        ON CONFLICT (user_id, date) DO UPDATE SET content = ${diaryContent}, keywords = ${keywords || null}, created_at = NOW()
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
