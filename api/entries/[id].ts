import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'
import { jwtVerify } from 'jose'
import { v2 as cloudinary } from 'cloudinary'

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

async function deleteCloudinaryImage(url: string) {
  try {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
      api_key: process.env.CLOUDINARY_API_KEY!,
      api_secret: process.env.CLOUDINARY_API_SECRET!,
    })
    // Extract public_id from Cloudinary URL
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/)
    if (match) {
      await cloudinary.uploader.destroy(match[1])
    }
  } catch {
    // Non-critical: ignore Cloudinary delete errors
  }
}

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

  // DELETE /api/entries/:id
  if (req.method === 'DELETE') {
    const [entry] = await sql`
      SELECT id, generated_image_url FROM diary_entries
      WHERE id = ${id} AND user_id = ${userId}
    `
    if (!entry) return res.status(404).json({ error: 'Not found' })

    await sql`DELETE FROM diary_entries WHERE id = ${id}`

    // Delete image from Cloudinary (non-blocking)
    if (entry.generated_image_url) {
      deleteCloudinaryImage(entry.generated_image_url)
    }

    return res.json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
