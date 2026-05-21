import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Globe, Camera, X, ChevronDown, ChevronUp, Sparkles, User } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
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
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
      URL.revokeObjectURL(url)
      resolve({ base64, mimeType: 'image/jpeg', aspectRatio: ar })
    }
    img.onerror = reject
    img.src = url
  })
}

export default function HomePage() {
  const navigate = useNavigate()
  const { } = useAuth()
  const { t, lang, setLang } = useLang()

  const today = new Date()
  const todayStr = formatDate(today.getFullYear(), today.getMonth()+1, today.getDate())

  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [calendarData, setCalendarData] = useState<CalendarDay[]>([])
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [todayEntries, setTodayEntries] = useState<DiaryEntry[]>([])

  const [text, setText] = useState('')
  const [style, setStyle] = useState<ImageStyle>('cartoon')
  const [customStyle, setCustomStyle] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [generating, setGenerating] = useState(false)
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

  const dayMap = new Map(calendarData.map(d => [d.date, d]))
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate()
  const cells: { date: string; day: number; type: 'prev'|'curr'|'next' }[] = []
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i
    const m2 = month === 1 ? 12 : month - 1
    const y2 = month === 1 ? year - 1 : year
    cells.push({ date: formatDate(y2, m2, d), day: d, type: 'prev' })
  }
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: formatDate(year, month, d), day: d, type: 'curr' })
  const remaining = 42 - cells.length
  for (let d = 1; d <= remaining; d++) {
    const m2 = month === 12 ? 1 : month + 1
    const y2 = month === 12 ? year + 1 : year
    cells.push({ date: formatDate(y2, m2, d), day: d, type: 'next' })
  }

  const prevMonth = () => { if (month === 1) { setYear(y=>y-1); setMonth(12) } else setMonth(m=>m-1) }
  const nextMonth = () => { if (month === 12) { setYear(y=>y+1); setMonth(1) } else setMonth(m=>m+1) }

  async function handleGenerate() {
    if (!text.trim() && !photoFile) return
    if (style === 'custom' && !customStyle.trim()) return
    setGenerating(true)
    try {
      if (photoFile) {
        const { base64, mimeType, aspectRatio } = await resizeImage(photoFile)
        await generateFromPhoto({ photoBase64: base64, mimeType, style, customStyle: customStyle||undefined, date: todayStr, aspectRatio })
      } else {
        await generateFromText({ text: text.trim(), style, customStyle: customStyle||undefined, date: todayStr })
      }
      setText(''); setPhotoFile(null); setPhotoPreview('')
      await loadTodayEntries()
      await loadCalendar()
      showToast(lang === 'zh' ? '创作成功！' : 'Created!')
    } catch { showToast(t('error_generate')) }
    finally { setGenerating(false) }
  }

  const canGenerate = (text.trim().length > 0 || !!photoFile) && (style !== 'custom' || customStyle.trim().length > 0)

  // Today date display
  const todayDisplay = lang === 'zh'
    ? `${today.getMonth()+1}月${today.getDate()}日`
    : `${translations.en.months[today.getMonth()]} ${today.getDate()}`

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div className="header-logo">{t('app_name')}<span>PicDiary</span></div>
        <div className="header-actions">
          <button className="btn-icon" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}><Globe size={18} /></button>
          <button className="btn-icon" onClick={() => navigate('/profile')}><User size={18} /></button>
        </div>
      </header>

      <main style={{ flex:1, overflowY:'auto', paddingBottom:32 }}>

        {/* ── Date heading ── */}
        <div style={{ padding:'12px 20px 8px', display:'flex', alignItems:'baseline', gap:8 }}>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:'1.4rem', fontWeight:300, color:'var(--text-primary)' }}>
            {todayDisplay}
          </div>
          <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>
            {lang === 'zh' ? '今天' : 'Today'}
          </div>
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
                <button onClick={() => { setPhotoFile(null); setPhotoPreview('') }}
                  style={{ position:'absolute', top:6, right:6, width:26, height:26, borderRadius:'50%',
                    background:'rgba(0,0,0,0.5)', border:'none', color:'white', cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <X size={13} />
                </button>
              </div>
            )}

            <div style={{ padding:'14px 14px 10px' }}>
              {/* Text input */}
              <textarea
                className="input"
                placeholder={t('input_placeholder')}
                value={text}
                onChange={e => setText(e.target.value)}
                rows={2}
                maxLength={200}
                style={{ background:'transparent', border:'none', padding:0, fontSize:'0.95rem',
                  resize:'none', width:'100%', lineHeight:1.6 }}
              />
              {text.length > 0 && (
                <div style={{ textAlign:'right', fontSize:'0.68rem', color:'var(--text-muted)', marginTop:2 }}>
                  {text.length}/200
                </div>
              )}
            </div>

            {/* Style grid 3×2 */}
            <div style={{ padding:'0 14px', display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:6 }}>
              {IMAGE_STYLES.map(s => (
                <button key={s.value} onClick={() => setStyle(s.value)}
                  style={{
                    padding:'7px 4px', borderRadius:'var(--radius-sm)',
                    border:`1.5px solid ${style === s.value ? 'var(--accent)' : 'var(--border)'}`,
                    background: style === s.value ? 'var(--accent-light)' : 'var(--bg-input)',
                    color: style === s.value ? 'var(--accent-dark)' : 'var(--text-secondary)',
                    fontSize:'0.75rem', fontWeight:500, cursor:'pointer',
                    fontFamily:'var(--font-sans)', display:'flex', alignItems:'center',
                    justifyContent:'center', gap:4,
                  }}
                >
                  <span>{s.emoji}</span>
                  <span>{t(`style_${s.value}`)}</span>
                </button>
              ))}
            </div>

            {/* Custom style */}
            {style === 'custom' && (
              <div style={{ padding:'8px 14px 0' }}>
                <input className="input" placeholder={t('custom_style_placeholder')}
                  value={customStyle} onChange={e => setCustomStyle(e.target.value)} />
              </div>
            )}

            {/* Bottom toolbar */}
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px 14px' }}>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display:'none' }}
                onChange={async e => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f)); e.target.value = ''
                }}
              />
              <button onClick={() => fileInputRef.current?.click()}
                style={{
                  display:'flex', alignItems:'center', gap:5, padding:'8px 14px',
                  borderRadius:'var(--radius-md)',
                  border:`1.5px solid ${photoFile ? 'var(--accent)' : 'var(--border)'}`,
                  background: photoFile ? 'var(--accent-light)' : 'var(--bg-input)',
                  color: photoFile ? 'var(--accent-dark)' : 'var(--text-secondary)',
                  fontSize:'0.8rem', fontWeight:500, cursor:'pointer', fontFamily:'var(--font-sans)',
                  whiteSpace:'nowrap',
                }}>
                <Camera size={15} />
                {photoFile ? (lang === 'zh' ? '已选图' : 'Selected') : (lang === 'zh' ? '上传照片' : 'Photo')}
              </button>

              <button className="btn btn-primary" onClick={handleGenerate}
                disabled={!canGenerate || generating}
                style={{ flex:1, borderRadius:'var(--radius-md)', gap:6, padding:'9px 0', justifyContent:'center' }}>
                {generating
                  ? <><span className="spinner" style={{ width:15, height:15, borderTopColor:'white', borderColor:'rgba(255,255,255,0.3)' }} />
                    <span>{lang === 'zh' ? '生成中...' : 'Creating...'}</span></>
                  : <><Sparkles size={15} /><span>{t('generate')}</span></>
                }
              </button>
            </div>
          </div>
        </div>

        {/* ── Today's entries ── */}
        {todayEntries.length > 0 && (
          <div style={{ padding:'16px 16px 0' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <div style={{ fontSize:'0.8rem', fontWeight:600, color:'var(--text-secondary)', letterSpacing:'0.03em' }}>
                {lang === 'zh' ? `今日记录 · ${todayEntries.length}张` : `Today · ${todayEntries.length} image${todayEntries.length>1?'s':''}`}
              </div>
              <button onClick={() => navigate(`/day/${todayStr}`)}
                style={{ fontSize:'0.78rem', color:'var(--accent)', background:'none', border:'none', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
                {lang === 'zh' ? '查看全部 →' : 'View all →'}
              </button>
            </div>
            <div style={{ display:'flex', gap:8, overflowX:'auto', scrollbarWidth:'none', paddingBottom:4 }}>
              {todayEntries.map(entry => (
                <div key={entry.id} onClick={() => navigate(`/day/${todayStr}`)}
                  style={{ flexShrink:0, width:88, height:88, borderRadius:'var(--radius-md)',
                    overflow:'hidden', cursor:'pointer', background:'var(--surface)',
                    border:'1px solid var(--border)' }}>
                  <img src={entry.generated_image_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Calendar (collapsible) ── */}
        <div style={{ padding:'16px 16px 0' }}>
          <button onClick={() => setCalendarOpen(o => !o)}
            style={{
              width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'12px 16px',
              borderRadius: calendarOpen ? 'var(--radius-lg) var(--radius-lg) 0 0' : 'var(--radius-lg)',
              background:'var(--bg-card)',
              border:'1px solid var(--border)',
              borderBottom: calendarOpen ? '1px solid var(--border)' : '1px solid var(--border)',
              cursor:'pointer', fontFamily:'var(--font-sans)',
            }}>
            <span style={{ fontFamily:'var(--font-serif)', fontSize:'0.95rem', fontWeight:500, color:'var(--text-primary)' }}>
              {translations[lang].months[month-1]} {year}
            </span>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {!calendarOpen && calendarData.length > 0 && (
                <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>
                  {lang === 'zh' ? `${calendarData.length}天有记录` : `${calendarData.length} days`}
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
                      className={`calendar-day ${isToday ? 'today' : ''} ${info ? 'has-entry' : ''} ${cell.type !== 'curr' ? 'other-month' : ''}`}
                      onClick={() => cell.type === 'curr' && navigate(`/day/${cell.date}`)}
                      disabled={cell.type !== 'curr'}>
                      <span>{cell.day}</span>
                      {info && <div className={`calendar-dot ${info.has_note ? 'has-note' : ''}`} />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
