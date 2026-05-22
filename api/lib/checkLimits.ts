import { neon } from '@neondatabase/serverless'

export interface UserPermissions {
  status: string
  daily_limit: number
  allowed_styles: string[]
  styles_unlimited: boolean
  today_count: number
}

export async function checkUserPermissions(userId: string, style: string): Promise<{ allowed: boolean; reason?: string; permissions: UserPermissions }> {
  const sql = neon(process.env.DATABASE_URL!)

  const [user] = await sql`
    SELECT status, daily_limit, allowed_styles, styles_unlimited FROM users WHERE id = ${userId}
  `
  if (!user) return { allowed: false, reason: 'user_not_found', permissions: {} as UserPermissions }

  // Check banned
  if (user.status === 'banned') {
    return { allowed: false, reason: 'banned', permissions: {} as UserPermissions }
  }

  // Count today's entries
  const [countRow] = await sql`
    SELECT COUNT(*)::int AS count FROM diary_entries
    WHERE user_id = ${userId} AND date = CURRENT_DATE
  `
  const today_count = countRow?.count || 0

  const allowedStyles = user.styles_unlimited
    ? 'all'
    : (user.allowed_styles || 'anime').split(',').map((s: string) => s.trim())

  const permissions: UserPermissions = {
    status: user.status,
    daily_limit: user.daily_limit ?? 3,
    allowed_styles: allowedStyles === 'all' ? [] : allowedStyles,
    styles_unlimited: user.styles_unlimited ?? false,
    today_count,
  }

  // Paid users have no limits
  if (user.status === 'paid') {
    return { allowed: true, permissions }
  }

  // Check daily limit (0 = unlimited)
  if (user.daily_limit !== 0 && today_count >= (user.daily_limit ?? 3)) {
    return { allowed: false, reason: 'daily_limit_reached', permissions }
  }

  // Check style permission
  if (!user.styles_unlimited) {
    const allowed = (user.allowed_styles || 'anime').split(',').map((s: string) => s.trim())
    if (style !== 'custom' && !allowed.includes(style)) {
      return { allowed: false, reason: 'style_not_allowed', permissions }
    }
  }

  return { allowed: true, permissions }
}
