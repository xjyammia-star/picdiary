import QRCode from 'qrcode'

const APP_URL = 'https://picdiary-two.vercel.app'

export async function generateDiaryCard(
  content: string,
  date: string,
  _previewImageUrl?: string  // kept for API compatibility but not used
): Promise<Blob> {
  const W = 750
  const PADDING = 52
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  // Measure text
  const fontSize = 30
  const lineHeight = fontSize * 1.9
  const textWidth = W - PADDING * 2 - 24
  ctx.font = `400 ${fontSize}px serif`
  const chars = content.split('')
  const lines: string[] = []
  let current = ''
  for (const char of chars) {
    if (ctx.measureText(current + char).width > textWidth) {
      lines.push(current)
      current = char
    } else {
      current += char
    }
  }
  if (current) lines.push(current)

  const textH = lines.length * lineHeight
  const H = PADDING + 80 + 32 + textH + 56 + 90 + PADDING
  canvas.width = W
  canvas.height = Math.round(H)

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#FDF8F3')
  bg.addColorStop(1, '#F0E8DC')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Decorative top bar
  const bar = ctx.createLinearGradient(0, 0, W, 0)
  bar.addColorStop(0, '#C17B4E')
  bar.addColorStop(1, '#D4946A')
  ctx.fillStyle = bar
  ctx.fillRect(0, 0, W, 6)

  let y = PADDING

  // Date
  const [yr, mo, da] = date.split('-')
  ctx.font = `300 32px serif`
  ctx.fillStyle = '#C17B4E'
  ctx.textAlign = 'left'
  ctx.fillText(`${yr}年${mo}月${da}日`, PADDING, y + 36)
  y += 80

  // Divider
  ctx.strokeStyle = 'rgba(193,123,78,0.3)'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(PADDING, y)
  ctx.lineTo(W - PADDING, y)
  ctx.stroke()
  ctx.setLineDash([])
  y += 32

  // Diary text
  ctx.font = `400 ${fontSize}px serif`
  ctx.fillStyle = '#2C2420'
  ctx.textAlign = 'left'
  for (const line of lines) {
    ctx.fillText(line, PADDING, y + fontSize)
    y += lineHeight
  }
  y += 56

  // Bottom divider
  ctx.strokeStyle = 'rgba(193,123,78,0.2)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PADDING, y)
  ctx.lineTo(W - PADDING, y)
  ctx.stroke()
  y += 24

  // QR code
  const qrSize = 72
  const qrDataUrl = await QRCode.toDataURL(APP_URL, {
    width: qrSize, margin: 0,
    color: { dark: '#C17B4E', light: '#FDF8F3' }
  })
  const qrImg = await new Promise<HTMLImageElement>((res, rej) => {
    const el = new Image()
    el.onload = () => res(el)
    el.onerror = rej
    el.src = qrDataUrl
  })
  ctx.drawImage(qrImg, W - PADDING - qrSize, y + 4, qrSize, qrSize)

  // App name
  ctx.font = `600 28px serif`
  ctx.fillStyle = '#C17B4E'
  ctx.textAlign = 'left'
  ctx.fillText('绘忆 PicDiary', PADDING, y + 30)
  ctx.font = `300 22px sans-serif`
  ctx.fillStyle = '#A09A93'
  ctx.fillText('AI 日记日历', PADDING, y + 58)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
      'image/jpeg', 0.92
    )
  })
}
