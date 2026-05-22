import QRCode from 'qrcode'

const APP_URL = 'https://picdiary-two.vercel.app'

export async function generateDiaryCard(
  content: string,
  date: string,
  previewImageUrl?: string
): Promise<Blob> {
  const W = 750
  const PADDING = 48
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  // ── Measure text height first ────────────────────────────────
  const fontSize = 32
  const lineHeight = fontSize * 1.75
  const textWidth = W - PADDING * 2 - 32
  ctx.font = `${fontSize}px 'Noto Serif SC', serif`
  const words = content.split('')
  const lines: string[] = []
  let current = ''
  for (const char of words) {
    const test = current + char
    if (ctx.measureText(test).width > textWidth) {
      lines.push(current)
      current = char
    } else {
      current = test
    }
  }
  if (current) lines.push(current)

  const textH = lines.length * lineHeight
  const previewH = previewImageUrl ? 320 : 0
  const H = PADDING + previewH + (previewH ? 32 : 0) + 60 + 24 + textH + 48 + 80 + PADDING
  canvas.width = W
  canvas.height = Math.round(H)

  // ── Background ───────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#FDF8F3')
  bg.addColorStop(1, '#F5EDE3')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // ── Subtle texture dots ──────────────────────────────────────
  ctx.fillStyle = 'rgba(193,123,78,0.04)'
  for (let i = 0; i < W; i += 24) {
    for (let j = 0; j < H; j += 24) {
      ctx.beginPath()
      ctx.arc(i, j, 1.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  let y = PADDING

  // ── Preview image (if any) ────────────────────────────────────
  if (previewImageUrl) {
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const el = new Image(); el.crossOrigin = 'anonymous'
        el.onload = () => res(el); el.onerror = rej; el.src = previewImageUrl
      })
      const radius = 16
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(PADDING + radius, y)
      ctx.lineTo(W - PADDING - radius, y)
      ctx.quadraticCurveTo(W - PADDING, y, W - PADDING, y + radius)
      ctx.lineTo(W - PADDING, y + previewH - radius)
      ctx.quadraticCurveTo(W - PADDING, y + previewH, W - PADDING - radius, y + previewH)
      ctx.lineTo(PADDING + radius, y + previewH)
      ctx.quadraticCurveTo(PADDING, y + previewH, PADDING, y + previewH - radius)
      ctx.lineTo(PADDING, y + radius)
      ctx.quadraticCurveTo(PADDING, y, PADDING + radius, y)
      ctx.closePath()
      ctx.clip()
      // Draw image cover
      const iw = img.naturalWidth, ih = img.naturalHeight
      const scale = Math.max((W - PADDING * 2) / iw, previewH / ih)
      const dw = iw * scale, dh = ih * scale
      const dx = PADDING + ((W - PADDING * 2) - dw) / 2
      const dy = y + (previewH - dh) / 2
      ctx.drawImage(img, dx, dy, dw, dh)
      ctx.restore()
      y += previewH + 32
    } catch {}
  }

  // ── Date ─────────────────────────────────────────────────────
  const [yr, mo, da] = date.split('-')
  const dateStr = `${yr}年${mo}月${da}日`
  ctx.font = `300 28px 'Noto Serif SC', serif`
  ctx.fillStyle = '#C17B4E'
  ctx.textAlign = 'left'
  ctx.fillText(dateStr, PADDING + 16, y + 40)
  y += 60

  // Divider line
  ctx.strokeStyle = 'rgba(193,123,78,0.25)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PADDING + 16, y)
  ctx.lineTo(W - PADDING - 16, y)
  ctx.stroke()
  y += 24

  // ── Diary text ───────────────────────────────────────────────
  ctx.font = `400 ${fontSize}px 'Noto Serif SC', serif`
  ctx.fillStyle = '#2C2420'
  ctx.textAlign = 'left'
  for (const line of lines) {
    ctx.fillText(line, PADDING + 16, y + fontSize)
    y += lineHeight
  }
  y += 48

  // ── Bottom: app name + QR ────────────────────────────────────
  const qrSize = 80
  const qrDataUrl = await QRCode.toDataURL(APP_URL, {
    width: qrSize, margin: 1,
    color: { dark: '#C17B4E', light: 'rgba(0,0,0,0)' }
  })
  const qrImg = await new Promise<HTMLImageElement>((res, rej) => {
    const el = new Image(); el.onload = () => res(el); el.onerror = rej; el.src = qrDataUrl
  })

  // App name
  ctx.font = `500 30px 'Noto Serif SC', serif`
  ctx.fillStyle = '#C17B4E'
  ctx.textAlign = 'left'
  ctx.fillText('绘忆 PicDiary', PADDING + 16, y + 32)
  ctx.font = `300 22px sans-serif`
  ctx.fillStyle = '#A09A93'
  ctx.fillText('AI 日记日历', PADDING + 16, y + 60)

  // QR code
  ctx.drawImage(qrImg, W - PADDING - qrSize - 16, y, qrSize, qrSize)

  return new Promise<Blob>((res, rej) => {
    canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/jpeg', 0.92)
  })
}
