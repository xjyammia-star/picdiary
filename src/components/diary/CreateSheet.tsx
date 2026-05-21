import { useState, useRef } from 'react'
import { Camera, Type, X } from 'lucide-react'
import { useLang } from '../../i18n/LangContext'
import { generateFromText, generateFromPhoto } from '../../services/api'
import { IMAGE_STYLES } from '../../types'
import type { ImageStyle } from '../../types'

interface Props {
  date: string
  onClose: () => void
  onCreated: () => void
}

// Detect aspect ratio from image dimensions
function getAspectRatioString(w: number, h: number): string {
  const r = w / h
  if (r > 1.7) return '16:9'
  if (r > 1.2) return '4:3'
  if (r > 0.9) return '1:1'
  if (r > 0.7) return '3:4'
  return '9:16'
}

// Resize image for upload (max 1024px on longest side)
function resizeImage(file: File, maxSize = 1024): Promise<{base64: string; mimeType: string; aspectRatio: string}> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img
      const aspectRatio = getAspectRatioString(w, h)
      const scale = Math.min(1, maxSize / Math.max(w, h))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(w * scale)
      canvas.height = Math.round(h * scale)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const mimeType = 'image/jpeg'
      const dataUrl = canvas.toDataURL(mimeType, 0.85)
      const base64 = dataUrl.split(',')[1]
      URL.revokeObjectURL(url)
      resolve({ base64, mimeType, aspectRatio })
    }
    img.onerror = reject
    img.src = url
  })
}

export default function CreateSheet({ date, onClose, onCreated }: Props) {
  const { t } = useLang()
  const [mode, setMode] = useState<'text' | 'photo'>('text')
  const [text, setText] = useState('')
  const [style, setStyle] = useState<ImageStyle>('cartoon')
  const [customStyle, setCustomStyle] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string>('')
  const [generating, setGenerating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    const preview = URL.createObjectURL(file)
    setPhotoPreview(preview)
  }

  async function handleGenerate() {
    if (mode === 'text' && !text.trim()) return
    if (mode === 'photo' && !photoFile) return
    if (style === 'custom' && !customStyle.trim()) return

    setGenerating(true)
    try {
      if (mode === 'text') {
        await generateFromText({ text: text.trim(), style, customStyle: customStyle || undefined, date })
      } else {
        const { base64, mimeType, aspectRatio } = await resizeImage(photoFile!)
        await generateFromPhoto({ photoBase64: base64, mimeType, style, customStyle: customStyle || undefined, date, aspectRatio })
      }
      onCreated()
    } catch (err: any) {
      alert(t('error_generate'))
    } finally {
      setGenerating(false)
    }
  }

  const canGenerate = mode === 'text'
    ? text.trim().length > 0 && (style !== 'custom' || customStyle.trim().length > 0)
    : !!photoFile && (style !== 'custom' || customStyle.trim().length > 0)

  return (
    <>
      <div className="sheet-overlay" onClick={onClose} />
      <div className="sheet" style={{ paddingBottom: 40 }}>
        <div className="sheet-handle" />

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div className="sheet-title" style={{ marginBottom:0 }}>{t('create')}</div>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Mode toggle */}
        <div style={{ display:'flex', gap:8, marginBottom:20 }}>
          <button
            className={`btn ${mode === 'text' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
            style={{ flex:1 }}
            onClick={() => setMode('text')}
          >
            <Type size={14} /> {t('input_placeholder').slice(0,4)}…
          </button>
          <button
            className={`btn ${mode === 'photo' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
            style={{ flex:1 }}
            onClick={() => setMode('photo')}
          >
            <Camera size={14} /> {t('upload_photo')}
          </button>
        </div>

        {/* Text input */}
        {mode === 'text' && (
          <div className="input-group" style={{ marginBottom:16 }}>
            <textarea
              className="input"
              placeholder={t('input_placeholder')}
              value={text}
              onChange={e => setText(e.target.value)}
              rows={3}
              maxLength={200}
              autoFocus
            />
            <div style={{ textAlign:'right', fontSize:'0.72rem', color:'var(--text-muted)', marginTop:4 }}>
              {text.length}/200
            </div>
          </div>
        )}

        {/* Photo input */}
        {mode === 'photo' && (
          <div style={{ marginBottom:16 }}>
            <div
              className={`upload-area ${photoPreview ? 'has-photo' : ''}`}
              onClick={() => fileInputRef.current?.click()}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="preview" style={{ borderRadius:'var(--radius-md)' }} />
              ) : (
                <>
                  <Camera size={28} style={{ color:'var(--text-muted)' }} />
                  <div style={{ fontSize:'0.85rem', color:'var(--text-muted)' }}>{t('upload_photo')}</div>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display:'none' }}
              onChange={handlePhotoSelect}
            />
          </div>
        )}

        {/* Style selector */}
        <div style={{ marginBottom:16 }}>
          <div className="input-label" style={{ marginBottom:8 }}>{t('select_style')}</div>
          <div className="style-grid">
            {IMAGE_STYLES.map(s => (
              <button
                key={s.value}
                className={`style-chip ${style === s.value ? 'selected' : ''}`}
                onClick={() => setStyle(s.value)}
              >
                <span className="style-chip-emoji">{s.emoji}</span>
                <span>{t(`style_${s.value}`)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom style input */}
        {style === 'custom' && (
          <div className="input-group" style={{ marginBottom:16 }}>
            <input
              className="input"
              placeholder={t('custom_style_placeholder')}
              value={customStyle}
              onChange={e => setCustomStyle(e.target.value)}
              autoFocus
            />
          </div>
        )}

        {/* Generate button */}
        <button
          className="btn btn-primary btn-full btn-lg"
          onClick={handleGenerate}
          disabled={!canGenerate || generating}
        >
          {generating
            ? <><span className="spinner" style={{ borderTopColor:'white', borderColor:'rgba(255,255,255,0.3)', width:18, height:18 }} /> {t('generating')}</>
            : t('generate')
          }
        </button>
      </div>
    </>
  )
}
