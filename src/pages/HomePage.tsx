import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Globe, Camera, X, ChevronDown, ChevronUp, Sparkles, User, Download, Share2, Check, RefreshCw, Smartphone } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { usePWAInstall } from '../hooks/usePWAInstall'
import { useLang } from '../i18n/LangContext'
import { translations } from '../i18n/translations'
import { getCalendarMonth, getEntriesByDate, generateFromText, generateFromPhoto } from '../services/api'
import { IMAGE_STYLES } from '../types'
import type { CalendarDay, DiaryEntry, ImageStyle } from '../types'

function formatDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}

function resizeImage(file: File, maxSize = 1024): Promise<{base64: string; mimeType: string; aspectRatio: string}> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img
      const r = w / h
      let ar = '1:1'
      if (r > 1.7) ar = '16:9'
      else if (r > 1.2) ar = '4:3'
      else if (r > 0.9) ar = '1:1'
      else if (r > 0.7) ar = '3:4'
      else ar = '9:16'
      const scale = Math.min(1, maxSize / Math.max(w, h))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(w * scale)
      canvas.height = Math.round(h * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
      URL.revokeObjectURL(url)
      resolve({ base64, mimeType: 'image/jpeg', aspectRatio: ar })
    }
    img.onerror = reject
    img.src = url
  })
}

// ── Types ────────────────────────────────────────────────────────────────────

// Preview state after generation (before save)
interface GeneratedPreview {
  imageUrl: string        // temporary object URL or data URL
  entryId: string         // saved entry id (already saved, can be deleted if regenerated)
  inputText: string
  inputPhotoBase64?: string
  inputPhotoMime?: string
  aspectRatio: string
  style: ImageStyle
  customStyle?: string
  date: string
}

export default function HomePage() {
  const navigate = useNavigate()
  const { } = useAuth()
  const { install, canInstall, isIOS } = usePWAInstall()
  const [showIOSGuide, setShowIOSGuide] = useState(false)
  const { t, lang, setLang } = useLang()

  const today = new Date()
  const todayStr = formatDate(today.getFullYear(), today.getMonth()+1, today.getDate())

  // Calendar
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [calendarData, setCalendarData] = useState<CalendarDay[]>([])
  const [calendarOpen, setCalendarOpen] = useState(false)

  // Today entries
  const [todayEntries, setTodayEntries] = useState<DiaryEntry[]>([])

  // Input
  const [text, setText] = useState('')
  const [style, setStyle] = useState<ImageStyle>('cartoon')
  const [customStyle, setCustomStyle] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [photoBase64, setPhotoBase64] = useState('')
  const [photoMime, setPhotoMime] = useState('')
  const [photoAspect, setPhotoAspect] = useState('1:1')
  const [generating, setGenerating] = useState(false)

  // Preview after generation
  const [preview, setPreview] = useState<GeneratedPreview | null>(null)
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  // Lightbox for today entries
  const [lightbox, setLightbox] = useState<DiaryEntry | null>(null)

  const [toast, setToast] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2200) }

  const loadCalendar = useCallback(async () => {
    try { setCalendarData(await getCalendarMonth(year, month)) } catch {}
  }, [year, month])

  const loadTodayEntries = useCallback(async () => {
    try { setTodayEntries(await getEntriesByDate(todayStr)) } catch {}
  }, [todayStr])

  useEffect(() => { loadCalendar() }, [loadCalendar])
  useEffect(() => { loadTodayEntries() }, [loadTodayEntries])

  // Calendar grid
  const dayMap = new Map(calendarData.map(d => [d.date, d]))
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate()
  const cells: { date: string; day: number; type: 'prev'|'curr'|'next' }[] = []
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i
    cells.push({ date: formatDate(month===1?year-1:year, month===1?12:month-1, d), day: d, type: 'prev' })
  }
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: formatDate(year, month, d), day: d, type: 'curr' })
  for (let d = 1; d <= 42 - cells.length; d++) {
    cells.push({ date: formatDate(month===12?year+1:year, month===12?1:month+1, d), day: d, type: 'next' })
  }
  const prevMonth = () => { if (month===1){setYear(y=>y-1);setMonth(12)}else setMonth(m=>m-1) }
  const nextMonth = () => { if (month===12){setYear(y=>y+1);setMonth(1)}else setMonth(m=>m+1) }

  // ── Generate (no save yet) ──────────────────────────────────────────────────
  async function handleGenerate() {
    if (!text.trim() && !photoFile) return
    if (style === 'custom' && !customStyle.trim()) return
    setGenerating(true)
    try {
      let entry: DiaryEntry
      if (photoFile) {
        entry = await generateFromPhoto({
          photoBase64, mimeType: photoMime, style,
          customStyle: customStyle||undefined, date: todayStr, aspectRatio: photoAspect
        })
      } else {
        entry = await generateFromText({ text: text.trim(), style, customStyle: customStyle||undefined, date: todayStr })
      }
      // Show preview — entry is saved in DB but not yet shown in today list
      setPreview({
        imageUrl: entry.generated_image_url,
        entryId: entry.id,
        inputText: text.trim(),
        inputPhotoBase64: photoBase64 || undefined,
        inputPhotoMime: photoMime || undefined,
        aspectRatio: entry.aspect_ratio,
        style, customStyle: customStyle||undefined,
        date: todayStr,
      })
    } catch { showToast(t('error_generate')) }
    finally { setGenerating(false) }
  }

  // ── Regenerate with new style ──────────────────────────────────────────────
  async function handleRegenerate(newStyle?: ImageStyle, newCustomStyle?: string) {
    if (!preview) return
    setRegenerating(true)
    const useStyle = newStyle || preview.style
    const useCustom = newCustomStyle !== undefined ? newCustomStyle : preview.customStyle
    try {
      // Delete old entry first
      await fetch(`/api/entries/${preview.entryId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('picdiary_token')}` }
      })
      let entry: DiaryEntry
      if (preview.inputPhotoBase64) {
        entry = await generateFromPhoto({
          photoBase64: preview.inputPhotoBase64,
          mimeType: preview.inputPhotoMime || 'image/jpeg',
          style: useStyle, customStyle: useCustom,
          date: preview.date, aspectRatio: preview.aspectRatio
        })
      } else {
        entry = await generateFromText({ text: preview.inputText, style: useStyle, customStyle: useCustom, date: preview.date })
      }
      setPreview(p => p ? { ...p, imageUrl: entry.generated_image_url, entryId: entry.id, style: useStyle, customStyle: useCustom } : null)
      if (newStyle) setStyle(newStyle)
      if (newCustomStyle !== undefined) setCustomStyle(newCustomStyle)
    } catch { showToast(t('error_generate')) }
    finally { setRegenerating(false) }
  }

  // ── Save to diary ──────────────────────────────────────────────────────────
  async function handleSave() {
    if (!preview) return
    setSaving(true)
    // Entry is already in DB, just refresh the list
    await loadTodayEntries()
    await loadCalendar()
    setPreview(null)
    setText(''); setPhotoFile(null); setPhotoPreview(''); setPhotoBase64(''); setPhotoMime('')
    setSaving(false)
    showToast(lang === 'zh' ? '已保存到今日记录 ✓' : 'Saved to diary ✓')
  }

  // ── Discard preview ────────────────────────────────────────────────────────
  async function handleDiscard() {
    if (!preview) return
    // Delete the entry
    await fetch(`/api/entries/${preview.entryId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('picdiary_token')}` }
    })
    setPreview(null)
  }

  const canGenerate = (text.trim().length > 0 || !!photoFile) && (style !== 'custom' || customStyle.trim().length > 0)

  const todayDisplay = lang === 'zh'
    ? `${today.getMonth()+1}月${today.getDate()}日`
    : `${translations.en.months[today.getMonth()]} ${today.getDate()}`

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div className="header-logo">{t('app_name')}<span>PicDiary</span></div>
        <div className="header-actions">
          {canInstall && (
            <button className="btn-icon" title={lang==='zh'?'添加到桌面':'Add to Home Screen'}
              onClick={() => isIOS ? setShowIOSGuide(true) : install()}>
              <Smartphone size={18} />
            </button>
          )}
          <button className="btn-icon" onClick={() => setLang(lang==='zh'?'en':'zh')}><Globe size={18} /></button>
          <button className="btn-icon" onClick={() => navigate('/profile')}><User size={18} /></button>
        </div>
      </header>

      <main style={{ flex:1, overflowY:'auto', paddingBottom:32 }}>

        {/* Date */}
        <div style={{ padding:'12px 20px 8px', display:'flex', alignItems:'baseline', gap:8 }}>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:'1.4rem', fontWeight:300 }}>{todayDisplay}</div>
          <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{lang==='zh'?'今天':'Today'}</div>
        </div>

        {/* ── Input Card ── */}
        <div style={{ padding:'0 16px' }}>
          <div className="card" style={{ borderRadius:'var(--radius-xl)' }}>

            {/* Photo preview */}
            {photoPreview && (
              <div style={{ position:'relative', borderRadius:'var(--radius-xl) var(--radius-xl) 0 0',
                overflow:'hidden', background:'var(--surface)', maxHeight:140,
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                <img src={photoPreview} alt="" style={{ maxWidth:'100%', maxHeight:140, objectFit:'contain', display:'block' }} />
                <button onClick={() => { setPhotoFile(null); setPhotoPreview(''); setPhotoBase64(''); setPhotoMime('') }}
                  style={{ position:'absolute', top:6, right:6, width:26, height:26, borderRadius:'50%',
                    background:'rgba(0,0,0,0.5)', border:'none', color:'white', cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <X size={13} />
                </button>
              </div>
            )}

            <div style={{ padding:'14px 14px 10px' }}>
              <textarea className="input" placeholder={t('input_placeholder')}
                value={text} onChange={e => setText(e.target.value)}
                rows={2} maxLength={200}
                style={{ background:'transparent', border:'none', padding:0, fontSize:'0.95rem', resize:'none', width:'100%', lineHeight:1.6 }}
              />
              {text.length > 0 && (
                <div style={{ textAlign:'right', fontSize:'0.68rem', color:'var(--text-muted)', marginTop:2 }}>{text.length}/200</div>
              )}
            </div>

            {/* Style grid 3×2 */}
            <div style={{ padding:'0 14px', display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:6 }}>
              {IMAGE_STYLES.map(s => (
                <button key={s.value} onClick={() => setStyle(s.value)}
                  style={{
                    padding:'7px 4px', borderRadius:'var(--radius-sm)',
                    border:`1.5px solid ${style===s.value?'var(--accent)':'var(--border)'}`,
                    background: style===s.value?'var(--accent-light)':'var(--bg-input)',
                    color: style===s.value?'var(--accent-dark)':'var(--text-secondary)',
                    fontSize:'0.75rem', fontWeight:500, cursor:'pointer', fontFamily:'var(--font-sans)',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:4,
                  }}>
                  <span>{s.emoji}</span><span>{t(`style_${s.value}`)}</span>
                </button>
              ))}
            </div>

            {style === 'custom' && (
              <div style={{ padding:'8px 14px 0' }}>
                <div style={{ fontSize:'0.72rem', color:'var(--accent)', marginBottom:4, display:'flex', alignItems:'center', gap:4 }}>
                  <span>✦</span>
                  <span>{lang==='zh' ? '请先输入自定义风格，再点击开始创作' : 'Enter your custom style below, then tap Create'}</span>
                </div>
                <input className="input" placeholder={t('custom_style_placeholder')}
                  value={customStyle} onChange={e => setCustomStyle(e.target.value)}
                  autoFocus />
              </div>
            )}

            {/* Toolbar */}
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px 14px' }}>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display:'none' }}
                onChange={async e => {
                  const f = e.target.files?.[0]; if (!f) return
                  setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f))
                  const { base64, mimeType, aspectRatio } = await resizeImage(f)
                  setPhotoBase64(base64); setPhotoMime(mimeType); setPhotoAspect(aspectRatio)
                  e.target.value = ''
                }}
              />
              <button onClick={() => fileInputRef.current?.click()}
                style={{
                  display:'flex', alignItems:'center', gap:5, padding:'8px 14px',
                  borderRadius:'var(--radius-md)',
                  border:`1.5px solid ${photoFile?'var(--accent)':'var(--border)'}`,
                  background: photoFile?'var(--accent-light)':'var(--bg-input)',
                  color: photoFile?'var(--accent-dark)':'var(--text-secondary)',
                  fontSize:'0.8rem', fontWeight:500, cursor:'pointer', fontFamily:'var(--font-sans)', whiteSpace:'nowrap',
                }}>
                <Camera size={15} />
                {photoFile ? (lang==='zh'?'已选图':'Selected') : (lang==='zh'?'上传照片':'Photo')}
              </button>
              <button className="btn btn-primary" onClick={handleGenerate}
                disabled={!canGenerate || generating}
                style={{ flex:1, borderRadius:'var(--radius-md)', gap:6, padding:'9px 0', justifyContent:'center' }}>
                {generating
                  ? <><span className="spinner" style={{ width:15, height:15, borderTopColor:'white', borderColor:'rgba(255,255,255,0.3)' }} />
                    <span>{lang==='zh'?'生成中...':'Creating...'}</span></>
                  : <><Sparkles size={15} /><span>{t('generate')}</span></>
                }
              </button>
            </div>
          </div>
        </div>

        {/* ── Today entries thumbnails ── */}
        {todayEntries.length > 0 && (
          <div style={{ padding:'16px 16px 0' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <div style={{ fontSize:'0.8rem', fontWeight:600, color:'var(--text-secondary)', letterSpacing:'0.03em' }}>
                {lang==='zh'?`今日记录 · ${todayEntries.length}张`:`Today · ${todayEntries.length} image${todayEntries.length>1?'s':''}`}
              </div>
              <button onClick={() => navigate(`/day/${todayStr}`)}
                style={{ fontSize:'0.78rem', color:'var(--accent)', background:'none', border:'none', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
                {lang==='zh'?'管理 →':'Manage →'}
              </button>
            </div>
            <div
              style={{ display:'flex', gap:8, overflowX:'auto', scrollbarWidth:'none', paddingBottom:4, cursor:'grab' }}
              onWheel={e => { e.currentTarget.scrollLeft += e.deltaY; e.preventDefault() }}
            >
              {todayEntries.map(entry => (
                <div key={entry.id}
                  onClick={() => setLightbox(entry)}
                  style={{ flexShrink:0, width:88, height:88, borderRadius:'var(--radius-md)',
                    overflow:'hidden', cursor:'pointer', background:'var(--surface)', border:'1px solid var(--border)' }}>
                  <img src={entry.generated_image_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Calendar ── */}
        <div style={{ padding:'16px 16px 0' }}>
          <button onClick={() => setCalendarOpen(o=>!o)}
            style={{
              width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'12px 16px',
              borderRadius: calendarOpen?'var(--radius-lg) var(--radius-lg) 0 0':'var(--radius-lg)',
              background:'var(--bg-card)', border:'1px solid var(--border)',
              borderBottom: calendarOpen?'none':'1px solid var(--border)',
              cursor:'pointer', fontFamily:'var(--font-sans)',
            }}>
            <span style={{ fontFamily:'var(--font-serif)', fontSize:'0.95rem', fontWeight:500 }}>
              {translations[lang].months[month-1]} {year}
            </span>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {!calendarOpen && calendarData.length > 0 && (
                <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>
                  {lang==='zh'?`${calendarData.length}天有记录`:`${calendarData.length} days`}
                </span>
              )}
              {calendarOpen ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
            </div>
          </button>

          {calendarOpen && (
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderTop:'none',
              borderRadius:'0 0 var(--radius-lg) var(--radius-lg)', padding:'8px 12px 12px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                <button className="btn-icon" onClick={prevMonth}><ChevronLeft size={16} /></button>
                <div style={{ display:'flex', gap:2 }}>
                  {translations[lang].weekdays.map((wd: string, i: number) => (
                    <div key={i} style={{ width:36, textAlign:'center', fontSize:'0.68rem', fontWeight:600,
                      color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.04em', padding:'4px 0' }}>{wd}</div>
                  ))}
                </div>
                <button className="btn-icon" onClick={nextMonth}><ChevronRight size={16} /></button>
              </div>
              <div className="calendar-grid" style={{ gap:'2px' }}>
                {cells.map(cell => {
                  const info = dayMap.get(cell.date)
                  const isToday = cell.date === todayStr
                  return (
                    <button key={cell.date}
                      className={`calendar-day ${isToday?'today':''} ${info?'has-entry':''} ${cell.type!=='curr'?'other-month':''}`}
                      onClick={() => cell.type==='curr' && navigate(`/day/${cell.date}`)}
                      disabled={cell.type!=='curr'}>
                      <span>{cell.day}</span>
                      {info && <div className={`calendar-dot ${info.has_note?'has-note':''}`} />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Preview Sheet (after generation) ── */}
      {preview && (
        <>
          <div className="sheet-overlay" onClick={handleDiscard} />
          <div className="sheet" style={{ paddingBottom:40 }}>
            <div className="sheet-handle" />
            <div style={{ fontFamily:'var(--font-serif)', fontSize:'1.1rem', fontWeight:500, marginBottom:14 }}>
              {lang==='zh'?'效果预览':'Preview'}
            </div>

            {/* Generated image */}
            <div style={{ borderRadius:'var(--radius-lg)', overflow:'hidden', background:'var(--surface)', marginBottom:14, position:'relative' }}>
              <img src={preview.imageUrl} alt="" style={{ width:'100%', display:'block', maxHeight:300, objectFit:'contain' }} />
              {regenerating && (
                <div style={{ position:'absolute', inset:0, background:'rgba(247,245,240,0.85)',
                  display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <div className="spinner" style={{ width:32, height:32 }} />
                </div>
              )}
            </div>

            {/* Re-select style */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginBottom:8 }}>
                {lang==='zh'?'换个风格重新生成：':'Try a different style:'}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:6 }}>
                {IMAGE_STYLES.map(s => (
                  <button key={s.value}
                    onClick={() => !regenerating && handleRegenerate(s.value, s.value==='custom'?customStyle:undefined)}
                    style={{
                      padding:'7px 4px', borderRadius:'var(--radius-sm)',
                      border:`1.5px solid ${preview.style===s.value?'var(--accent)':'var(--border)'}`,
                      background: preview.style===s.value?'var(--accent-light)':'var(--bg-input)',
                      color: preview.style===s.value?'var(--accent-dark)':'var(--text-secondary)',
                      fontSize:'0.75rem', fontWeight:500, cursor:'pointer', fontFamily:'var(--font-sans)',
                      display:'flex', alignItems:'center', justifyContent:'center', gap:4,
                      opacity: regenerating ? 0.5 : 1,
                    }}>
                    <span>{s.emoji}</span><span>{t(`style_${s.value}`)}</span>
                  </button>
                ))}
              </div>
              {preview.style === 'custom' && (
                <input className="input" placeholder={t('custom_style_placeholder')}
                  value={customStyle} onChange={e => setCustomStyle(e.target.value)}
                  style={{ marginTop:8 }} />
              )}
              {preview.style === 'custom' && (
                <button className="btn btn-ghost btn-full btn-sm" style={{ marginTop:8 }}
                  onClick={() => handleRegenerate('custom', customStyle)} disabled={regenerating}>
                  <RefreshCw size={14} /> {lang==='zh'?'用自定义风格重新生成':'Regenerate with custom style'}
                </button>
              )}
            </div>

            {/* Actions */}
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={handleDiscard}>
                <X size={16} /> {lang==='zh'?'丢弃':'Discard'}
              </button>
              <button className="btn btn-primary" style={{ flex:2 }} onClick={handleSave} disabled={saving}>
                {saving
                  ? <span className="spinner" style={{ width:16, height:16, borderTopColor:'white', borderColor:'rgba(255,255,255,0.3)' }} />
                  : <><Check size={16} /> {lang==='zh'?'保存到日记':'Save to diary'}</>
                }
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Lightbox for today entries ── */}
      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)',
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            zIndex:80, padding:16 }}>
          <img src={lightbox.generated_image_url} alt=""
            style={{ maxWidth:'100%', maxHeight:'75dvh', borderRadius:'var(--radius-md)', objectFit:'contain' }}
            onClick={e => e.stopPropagation()} />
          <div style={{ display:'flex', gap:12, marginTop:16 }} onClick={e => e.stopPropagation()}>
            <button className="btn btn-sm"
              style={{ background:'rgba(255,255,255,0.15)', color:'white', border:'none', borderRadius:'var(--radius-md)' }}
              onClick={() => { const a=document.createElement('a'); a.href=lightbox.generated_image_url; a.download='picdiary.jpg'; a.target='_blank'; a.click() }}>
              <Download size={15} /> {t('download')}
            </button>
            <button className="btn btn-sm"
              style={{ background:'rgba(255,255,255,0.15)', color:'white', border:'none', borderRadius:'var(--radius-md)' }}
              onClick={async () => { try { await navigator.share({ url: lightbox.generated_image_url }) } catch { await navigator.clipboard.writeText(lightbox.generated_image_url); showToast(t('copied')) } }}>
              <Share2 size={15} /> {t('share')}
            </button>
            <button className="btn btn-sm"
              style={{ background:'rgba(255,255,255,0.15)', color:'white', border:'none', borderRadius:'var(--radius-md)' }}
              onClick={() => setLightbox(null)}>
              ✕
            </button>
          </div>
          {lightbox.input_text && (
            <div style={{ marginTop:12, fontSize:'0.82rem', color:'rgba(255,255,255,0.6)', maxWidth:300, textAlign:'center' }}>
              {lightbox.input_text}
            </div>
          )}
        </div>
      )}

      {/* iOS install guide */}
      {showIOSGuide && (
        <>
          <div className="sheet-overlay" onClick={() => setShowIOSGuide(false)} />
          <div className="sheet" style={{ paddingBottom:40 }}>
            <div className="sheet-handle" />
            <div style={{ fontFamily:'var(--font-serif)', fontSize:'1.1rem', fontWeight:500, marginBottom:16 }}>
              {lang==='zh' ? '添加到主屏幕' : 'Add to Home Screen'}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {[
                lang==='zh' ? '1. 点击底部的 分享 按钮 （□↑）' : '1. Tap the Share button (□↑) at the bottom',
                lang==='zh' ? '2. 向下滚动，选择「添加到主屏幕」' : '2. Scroll down and tap "Add to Home Screen"',
                lang==='zh' ? '3. 点击右上角「添加」完成安装' : '3. Tap "Add" in the top right corner',
              ].map((step, i) => (
                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--accent-light)',
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                    fontSize:'0.82rem', fontWeight:600, color:'var(--accent-dark)' }}>{i+1}</div>
                  <div style={{ fontSize:'0.9rem', color:'var(--text-secondary)', paddingTop:4 }}>
                    {step.slice(3)}
                  </div>
                </div>
              ))}
            </div>
            <button className="btn btn-primary btn-full" style={{ marginTop:24 }}
              onClick={() => setShowIOSGuide(false)}>
              {lang==='zh' ? '知道了' : 'Got it'}
            </button>
          </div>
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
