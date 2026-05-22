// User
export interface User {
  id: string
  email: string
  created_at: string
}

// Image style presets
export type ImageStyle =
  | 'anime'
  | 'storybook'
  | 'watercolor'
  | 'sketch'
  | 'cinematic'
  | 'oilpainting'
  | 'dreamy'
  | 'thai'
  | 'custom'

export const IMAGE_STYLES: { value: ImageStyle; label_zh: string; label_en: string; emoji: string }[] = [
  { value: 'anime', label_zh: '动漫', label_en: 'Anime', emoji: '🌸' },
  { value: 'storybook', label_zh: '儿童绘本', label_en: 'Storybook', emoji: '📖' },
  { value: 'watercolor', label_zh: '水彩插画', label_en: 'Watercolor', emoji: '💧' },
  { value: 'sketch', label_zh: '素描', label_en: 'Sketch', emoji: '✏️' },
  { value: 'cinematic', label_zh: '电影质感', label_en: 'Cinematic', emoji: '🎬' },
  { value: 'oilpainting', label_zh: '油画', label_en: 'Oil Painting', emoji: '🎨' },
  { value: 'dreamy', label_zh: '梦幻粉彩', label_en: 'Dreamy Pastel', emoji: '🌙' },
  { value: 'thai', label_zh: '泰式传统', label_en: 'Thai Art', emoji: '🏯' },
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
