// Download image as blob and share as file (supports WeChat, Instagram, etc.)
export async function shareImage(imageUrl: string, filename = 'picdiary.jpg'): Promise<'shared' | 'clipboard' | 'failed'> {
  try {
    const res = await fetch(imageUrl)
    const blob = await res.blob()
    const file = new File([blob], filename, { type: blob.type || 'image/jpeg' })

    // Try native file share — this allows sharing to WeChat, Instagram etc.
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'PicDiary · 绘忆' })
      return 'shared'
    }

    // Fallback: share as URL
    if (navigator.share) {
      await navigator.share({ url: imageUrl, title: 'PicDiary · 绘忆' })
      return 'shared'
    }

    // Final fallback: copy URL to clipboard
    await navigator.clipboard.writeText(imageUrl)
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
