const APP_URL = 'https://picdiary-two.vercel.app'
const APP_TAGLINE_ZH = '用 AI 记录每一天 ✨ 快来试试绘忆 PicDiary：'
const APP_TAGLINE_EN = 'AI diary that turns your moments into art ✨ Try PicDiary:'

// Download image as blob and share as file (supports WeChat, Instagram, etc.)
export async function shareImage(
  imageUrl: string,
  options?: { filename?: string; lang?: 'zh' | 'en' }
): Promise<'shared' | 'clipboard' | 'failed'> {
  const filename = options?.filename || 'picdiary.jpg'
  const tagline = options?.lang === 'en' ? APP_TAGLINE_EN : APP_TAGLINE_ZH
  const shareText = `${tagline} ${APP_URL}`

  try {
    const res = await fetch(imageUrl)
    const blob = await res.blob()
    const file = new File([blob], filename, { type: blob.type || 'image/jpeg' })

    // Try native file share with text — WeChat/Instagram will show the image
    // and the text (with app link) in the share preview
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: '绘忆 PicDiary',
        text: shareText,
      })
      return 'shared'
    }

    // Fallback: share URL + text
    if (navigator.share) {
      await navigator.share({
        url: APP_URL,
        title: '绘忆 PicDiary',
        text: shareText,
      })
      return 'shared'
    }

    // Final fallback: copy image URL + app link to clipboard
    await navigator.clipboard.writeText(`${imageUrl}\n\n${shareText}`)
    return 'clipboard'
  } catch {
    return 'failed'
  }
}

// Download image as blob (avoids browser opening URL in new tab)
export async function downloadImage(imageUrl: string, filename = 'picdiary.jpg'): Promise<void> {
  const res = await fetch(imageUrl)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
