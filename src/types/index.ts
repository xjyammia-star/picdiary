// User
export interface User {
  id: string
  email: string
  created_at: string
}

// Image style presets
export type ImageStyle =
  | 'cartoon'
  | 'anime'
  | 'pixel'
  | 'sketch'
  | 'watercolor'
  | 'custom'

export const IMAGE_STYLES: { value: ImageStyle; label_zh: string; label_en: string; emoji: string }[] = [
  { value: 'cartoon', label_zh: '卡通', label_en: 'Cartoon', emoji: '🎨' },
  { value: 'anime', label_zh: '日系动漫', label_en: 'Anime', emoji: '🌸' },
  { value: 'pixel', label_zh: '像素艺术', label_en: 'Pixel Art', emoji: '🎮' },
  { value: 'sketch', label_zh: '素描', label_en: 'Sketch', emoji: '✏️' },
  { value: 'watercolor', label_zh: '水彩', label_en: 'Watercolor', emoji: '💧' },
  { value: 'custom', label_zh: '自定义', label_en: 'Custom', emoji: '✨' },
]

// Diary entry (one generated image)
export interface DiaryEntry {
  id: string
  user_id: string
  date: string           // YYYY-MM-DD
  input_type: 'text' | 'photo'
  input_text?: string
  input_photo_url?: string   // original uploaded photo (cloudinary)
  style: ImageStyle
  custom_style?: string
  generated_image_url: string  // cloudinary URL
  aspect_ratio: string   // e.g. "1:1", "4:3", "16:9"
  created_at: string
}

// Daily diary note (AI generated summary)
export interface DiaryNote {
  id: string
  user_id: string
  date: string
  content: string
  keywords?: string
  created_at: string
}

// Calendar day summary
export interface CalendarDay {
  date: string
  entry_count: number
  has_note: boolean
  preview_image_url?: string
}

// API response
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// Auth
export interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
}

// Language
export type Language = 'zh' | 'en'
