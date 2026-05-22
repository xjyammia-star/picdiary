import QRCode from 'qrcode'

const APP_URL = 'https://picdiary-two.vercel.app'

// Generate watermarked image with QR code in bottom-right corner
async function addQRWatermark(imageUrl: string): Promise<Blob> {
  // Load original image
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.crossOrigin = 'anonymous'
    el.onload = () => resolve(el)
    el.onerror = reject
    el.src = imageUrl
  })

  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!

  // Draw original image
  ctx.drawImage(img, 0, 0)

  // QR code size: ~10% of shorter side, min 80px max 180px
  const qrSize = Math.min(180, Math.max(80, Math.min(img.naturalWidth, img.naturalHeight) * 0.12))
  const padding = qrSize * 0.12
  const margin = qrSize * 0.08

  // Generate QR code as data URL
  const qrDataUrl = await QRCode.toDataURL(APP_URL, {
    width: qrSize,
    margin: 1,
    color: { dark: '#1A1714', light: '#FFFFFF' },
    errorCorrectionLevel: 'M',
  })

  const qrImg = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = reject
    el.src = qrDataUrl
  })

  // Position: bottom-right corner
  const x = img.naturalWidth - qrSize - padding * 2 - margin
  const y = img.naturalHeight - qrSize - padding * 2 - margin

  // White rounded background behind QR
  const bgSize = qrSize + padding * 2
  const radius = bgSize * 0.12
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + bgSize - radius, y)
  ctx.quadraticCurveTo(x + bgSize, y, x + bgSize, y + radius)
  ctx.lineTo(x + bgSize, y + bgSize - radius)
  ctx.quadraticCurveTo(x + bgSize, y + bgSize, x + bgSize - radius, y + bgSize)
  ctx.lineTo(x + radius, y + bgSize)
  ctx.quadraticCurveTo(x, y + bgSize, x, y + bgSize - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
  ctx.fill()

  // Draw QR code
  ctx.drawImage(qrImg, x + padding, y + padding, qrSize, qrSize)

  // Small "绘忆" label below QR
  const fontSize = Math.max(14, qrSize * 0.14)
  ctx.font = `${fontSize}px serif`
  ctx.fillStyle = '#6B6560'
  ctx.textAlign = 'center'
  ctx.fillText('绘忆', x + bgSize / 2, y + bgSize + fontSize * 1.1)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')), 'image/jpeg', 0.92)
  })
}

// Share image WITH watermark QR code
export async function shareImage(
  imageUrl: string,
  options?: { lang?: 'zh' | 'en' }
): Promise<'shared' | 'clipboard' | 'failed'> {
  try {
    const watermarkedBlob = await addQRWatermark(imageUrl)
    const file = new File([watermarkedBlob], 'picdiary.jpg', { type: 'image/jpeg' })

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: '绘忆 PicDiary' })
      return 'shared'
    }

    if (navigator.share) {
      await navigator.share({ url: APP_URL, title: '绘忆 PicDiary' })
      return 'shared'
    }

    await navigator.clipboard.writeText(APP_URL)
    return 'clipboard'
  } catch {
    return 'failed'
  }
}

// Download image WITHOUT watermark (original)
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
