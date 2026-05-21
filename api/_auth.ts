import { SignJWT, jwtVerify } from 'jose'

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET!)

export async function signToken(payload: { userId: string; email: string }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(secret())
}

export async function verifyToken(token: string): Promise<{ userId: string; email: string }> {
  const { payload } = await jwtVerify(token, secret())
  return payload as { userId: string; email: string }
}

export function extractToken(req: Request): string | null {
  const auth = req.headers.get('authorization') || ''
  if (auth.startsWith('Bearer ')) return auth.slice(7)
  return null
}
