import type { DiaryEntry, DiaryNote, CalendarDay, ImageStyle } from '../types'

const getToken = () => localStorage.getItem('picdiary_token')

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getToken()}`,
})

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

// ─── Entries ────────────────────────────────────────────────────────────────

export async function generateFromText(params: {
  text: string
  style: ImageStyle
  customStyle?: string
  date: string
}): Promise<DiaryEntry> {
  const res = await fetch('/api/entries/generate-text', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(params),
  })
  return handleResponse(res)
}

export async function generateFromPhoto(params: {
  photoBase64: string
  mimeType: string
  style: ImageStyle
  customStyle?: string
  date: string
  aspectRatio: string
}): Promise<DiaryEntry> {
  const res = await fetch('/api/entries/generate-photo', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(params),
  })
  return handleResponse(res)
}

export async function regenerateEntry(entryId: string): Promise<DiaryEntry> {
  const res = await fetch(`/api/entries/${entryId}`, {
    method: 'POST',
    headers: authHeaders(),
  })
  return handleResponse(res)
}

export async function deleteEntry(entryId: string): Promise<void> {
  const res = await fetch(`/api/entries/${entryId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  return handleResponse(res)
}

export async function getEntriesByDate(date: string): Promise<DiaryEntry[]> {
  const res = await fetch(`/api/entries?date=${date}`, {
    headers: authHeaders(),
  })
  return handleResponse(res)
}

// ─── Calendar ───────────────────────────────────────────────────────────────

export async function getCalendarMonth(year: number, month: number): Promise<CalendarDay[]> {
  const res = await fetch(`/api/calendar?year=${year}&month=${month}`, {
    headers: authHeaders(),
  })
  return handleResponse(res)
}

// ─── Diary Notes ─────────────────────────────────────────────────────────────

export async function generateDiaryNote(params: {
  date: string
  keywords?: string
}): Promise<DiaryNote> {
  const res = await fetch('/api/diary', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(params),
  })
  return handleResponse(res)
}

export async function getDiaryNote(date: string): Promise<DiaryNote | null> {
  const res = await fetch(`/api/diary?date=${date}`, {
    headers: authHeaders(),
  })
  if (res.status === 404) return null
  return handleResponse(res)
}

export async function deleteDiaryNote(noteId: string): Promise<void> {
  const res = await fetch(`/api/diary/${noteId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  return handleResponse(res)
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export interface UserProfile {
  nickname?: string
  gender?: string
  birth_year?: number
  personality?: string
  self_description?: string
  interests?: string
}

export async function getProfile(): Promise<UserProfile> {
  const res = await fetch('/api/profile', { headers: authHeaders() })
  return handleResponse(res)
}

export async function saveProfile(profile: UserProfile): Promise<UserProfile> {
  const res = await fetch('/api/profile', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(profile),
  })
  return handleResponse(res)
}

// ─── Permissions ─────────────────────────────────────────────────────────────

export interface UserPermissions {
  status: string
  daily_limit: number
  allowed_styles: string[]
  styles_unlimited: boolean
  today_count: number
}

export async function getUserPermissions(): Promise<UserPermissions> {
  const res = await fetch('/api/permissions', { headers: authHeaders() })
  return handleResponse(res)
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string
  email: string
  status: string
  daily_limit: number
  allowed_styles: string
  styles_unlimited: boolean
  created_at: string
  nickname?: string
  gender?: string
  total_entries: number
  today_entries: number
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const res = await fetch('/api/admin', { headers: authHeaders() })
  return handleResponse(res)
}

export async function adminAction(targetUserId: string, action: string, value: any): Promise<void> {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ targetUserId, action, value }),
  })
  return handleResponse(res)
}
