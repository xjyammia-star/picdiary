import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, BookOpen, Download, Copy, Trash2, RefreshCw, Share2 } from 'lucide-react'
import { useLang } from '../i18n/LangContext'
import { shareImage, downloadImage } from '../utils/imageShare'
import { generateDiaryCard } from '../utils/diaryCard'
import {
  getEntriesByDate, deleteEntry, regenerateEntry,
  getDiaryNote, generateDiaryNote, deleteDiaryNote
} from '../services/api'
import CreateSheet from '../components/diary/CreateSheet'
import type { DiaryEntry, DiaryNote } from '../types'

export default function DayPage() {
  const { date } = useParams<{ date: string }>()
  const navigate = useNavigate()
  const { t, lang } = useLang()

  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [note, setNote] = useState<DiaryNote | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showDiaryGen, setShowDiaryGen] = useState(false)
  const [diaryKeywords, setDiaryKeywords] = useState('')
  const [generatingDiary, setGeneratingDiary] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{id:string;type:'entry'|'note'}|null>(null)
  const [toast, setToast] = useState('')
  const [loadingMsg, setLoadingMsg] = useState('')
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  const load = useCallback(async () => {
    if (!date) return
    setLoading(true)
    try {
      const [e, n] = await Promise.all([
        getEntriesByDate(date),
        getDiaryNote(date).catch(() => null),
      ])
      setEntries(e)
      setNote(n)
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => { load() }, [load])

  // Format display date
  const displayDate = date ? (() => {
    const [y, m, d] = date.split('-').map(Number)
    const today = new Date()
    const isToday = y === today.getFullYear() && m === today.getMonth()+1 && d === today.getDate()
    return `${y}年${m}月${d}日${isToday ? ' · 今天' : ''}`
  })() : ''

  async function handleDelete(id: string, type: 'entry'|'note') {
    setConfirmDelete({ id, type })
  }

  async function doDelete() {
    if (!confirmDelete) return
    try {
      if (confirmDelete.type === 'entry') {
        await deleteEntry(confirmDelete.id)
        setEntries(es => es.filter(e => e.id !== confirmDelete.id))
      } else {
        await deleteDiaryNote(confirmDelete.id)
        setNote(null)
      }
      showToast(t('deleted'))
    } catch {}
    setConfirmDelete(null)
  }

  async function handleRegenerate(entry: DiaryEntry) {
    setProcessingId(entry.id)
    setLoadingMsg(t('generating'))
    try {
      const updated = await regenerateEntry(entry.id)
      setEntries(es => es.map(e => e.id === updated.id ? updated : e))
    } catch { showToast(t('error_generate')) }
    finally { setProcessingId(null); setLoadingMsg('') }
  }

  async function handleDownload(url: string) {
    await downloadImage(url, `picdiary-${date}.jpg`)
    showToast(t('downloaded'))
  }

  async function handleCopyImage(url: string) {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ])
      showToast(t('copied'))
    } catch {
      await navigator.clipboard.writeText(url)
      showToast(t('copied'))
    }
  }

  async function handleCopyText(text: string) {
    await navigator.clipboard.writeText(text)
    showToast(t('copied'))
  }

  async function handleShare(url: string) {
    const result = await shareImage(url, { lang })
    if (result === 'clipboard') showToast(t('copied'))
  }

  async function handleShareDiary(content: string) {
    setLoadingMsg(lang === 'zh' ? '生成分享卡片...' : 'Creating card...')
    try {
      const blob = await generateDiaryCard(content, date!)
      setLoadingMsg('')
      const file = new File([blob], 'picdiary-diary.jpg', { type: 'image/jpeg' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: '绘忆 PicDiary' })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = 'picdiary-diary.jpg'; a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        showToast(lang === 'zh' ? '已保存分享卡片' : 'Card saved')
      }
    } catch (err: any) {
      setLoadingMsg('')
      console.error('Diary card error:', err?.message)
      showToast(t('error_generate'))
    }
  }

  async function handleGenerateDiary() {
    if (!date) return
    setGeneratingDiary(true)
    try {
      const newNote = await generateDiaryNote({ date, keywords: diaryKeywords || undefined })
      setNote(newNote)
      setShowDiaryGen(false)
      setDiaryKeywords('')
    } catch { showToast(t('error_generate')) }
    finally { setGeneratingDiary(false) }
  }

  if (loading) return (
    <div className="loading-overlay">
      <div className="spinner" style={{ width:32, height:32 }} />
    </div>
  )

  return (
    <div className="app-shell" style={{ maxWidth: '100%' }}>
      {/* Header */}
      <header className="app-header">
        <button className="btn-icon" onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
        <div style={{ fontFamily:'var(--font-serif)', fontSize:'0.95rem', fontWeight:500 }}>{displayDate}</div>
        <button className="btn-icon" onClick={() => setShowCreate(true)}><Plus size={20} /></button>
      </header>

      <main style={{ flex:1, overflowY:'auto', padding:'16px 16px 32px' }}>

        {/* Images grid */}
        {entries.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 0', color:'var(--text-muted)' }}>
            <div style={{ fontSize:'2.5rem', marginBottom:12 }}>🎨</div>
            <div className="text-sm">{t('no_entries')}</div>
            <button className="btn btn-primary btn-sm" style={{ marginTop:16 }} onClick={() => setShowCreate(true)}>
              + {t('generate')}
            </button>
          </div>
        ) : (
          <div className="entries-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12
          }}>
            {entries.map(entry => (
              <div key={entry.id}>
                <div
                  className="entry-image-wrap"
                  style={{
                    aspectRatio: entry.aspect_ratio.replace(':', '/'),
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                  }}
                  onClick={() => !processingId && setLightboxUrl(entry.generated_image_url)}
                >
                  <img src={entry.generated_image_url} alt="" loading="lazy" />
                  {processingId === entry.id && (
                    <div style={{
                      position:'absolute', inset:0, background:'rgba(247,245,240,0.85)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      borderRadius:'var(--radius-md)'
                    }}>
                      <div className="spinner" />
                    </div>
                  )}
                </div>
                <div className="entry-actions" style={{ marginTop:8, flexWrap:'wrap' }}>
                  <button className="entry-action-btn" onClick={() => handleDownload(entry.generated_image_url)} title={t('download')}>
                    <Download size={14} />
                  </button>
                  <button className="entry-action-btn" onClick={() => handleCopyImage(entry.generated_image_url)} title={t('copy')}>
                    <Copy size={14} />
                  </button>
                  <button className="entry-action-btn" onClick={() => handleShare(entry.generated_image_url)} title={t('share')}>
                    <Share2 size={14} />
                  </button>
                  <button className="entry-action-btn" onClick={() => handleRegenerate(entry)} title={t('regenerate')} disabled={!!processingId}>
                    <RefreshCw size={14} />
                  </button>
                  <button className="entry-action-btn danger" onClick={() => handleDelete(entry.id, 'entry')} title={t('delete')}>
                    <Trash2 size={14} />
                  </button>
                </div>
                {entry.input_text && (
                  <div className="text-sm text-muted" style={{ marginTop:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {entry.input_text}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Diary note section */}
        {entries.length > 0 && (
          <div style={{ marginTop:24 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div className="section-title" style={{ marginBottom:0, display:'flex', alignItems:'center', gap:6 }}>
                <BookOpen size={16} style={{ color:'var(--accent)' }} />
                {t('diary_note')}
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowDiaryGen(true)}
                disabled={generatingDiary}
              >
                {note ? t('regenerate') : t('generate_diary')}
              </button>
            </div>

            {note ? (
              <div className="card card-p">
                <p className="diary-content">{note.content}</p>
                <div className="entry-actions" style={{ marginTop:12 }}>
                  <button className="entry-action-btn" onClick={() => handleCopyText(note.content)}>
                    <Copy size={12} /> {t('copy')}
                  </button>
                  <button className="entry-action-btn" onClick={() => handleShareDiary(note.content)}>
                    <Share2 size={12} /> {t('share')}
                  </button>
                  <button className="entry-action-btn danger" onClick={() => handleDelete(note.id, 'note')}>
                    <Trash2 size={12} /> {t('delete')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="card card-p" style={{ textAlign:'center', color:'var(--text-muted)' }}>
                <div className="text-sm">{entries.length >= 3 ? t('no_diary') : t('need_3_images')}</div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Create sheet */}
      {showCreate && (
        <CreateSheet
          date={date!}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load() }}
        />
      )}

      {/* Diary generate sheet */}
      {showDiaryGen && (
        <>
          <div className="sheet-overlay" onClick={() => setShowDiaryGen(false)} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">{t('generate_diary')}</div>
            <div className="input-group">
              <label className="input-label">{t('diary_keywords')}</label>
              <input
                className="input"
                placeholder={t('diary_keywords_placeholder')}
                value={diaryKeywords}
                onChange={e => setDiaryKeywords(e.target.value)}
              />
            </div>
            <button
              className="btn btn-primary btn-full"
              style={{ marginTop:16 }}
              onClick={handleGenerateDiary}
              disabled={generatingDiary}
            >
              {generatingDiary
                ? <><span className="spinner" style={{ borderTopColor:'white', borderColor:'rgba(255,255,255,0.3)' }} /> {t('generating_diary')}</>
                : t('generate_diary')
              }
            </button>
          </div>
        </>
      )}

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <>
          <div className="sheet-overlay" onClick={() => setConfirmDelete(null)} />
          <div className="dialog" style={{ zIndex:61 }}>
            <div className="dialog-box">
              <div className="dialog-title">{t('confirm_delete')}</div>
              <div className="dialog-actions">
                <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>{t('cancel')}</button>
                <button className="btn btn-danger" onClick={doDelete}>{t('confirm')}</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Global loading */}
      {loadingMsg && (
        <div className="loading-overlay">
          <div className="spinner" style={{ width:36, height:36 }} />
          <div className="loading-text">{loadingMsg}</div>
        </div>
      )}

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          style={{
            position:'fixed', inset:0, background:'rgba(0,0,0,0.92)',
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            zIndex:80, padding:16,
          }}
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt=""
            style={{ maxWidth:'100%', maxHeight:'80dvh', borderRadius:'var(--radius-md)', objectFit:'contain' }}
            onClick={e => e.stopPropagation()}
          />
          <div style={{ display:'flex', gap:12, marginTop:16 }} onClick={e => e.stopPropagation()}>
            <button className="btn btn-ghost btn-sm" style={{ background:'rgba(255,255,255,0.15)', color:'white', border:'none' }}
              onClick={() => handleDownload(lightboxUrl)}>
              <Download size={16} /> {t('download')}
            </button>
            <button className="btn btn-ghost btn-sm" style={{ background:'rgba(255,255,255,0.15)', color:'white', border:'none' }}
              onClick={() => handleShare(lightboxUrl)}>
              <Share2 size={16} /> {t('share')}
            </button>
            <button className="btn btn-ghost btn-sm" style={{ background:'rgba(255,255,255,0.15)', color:'white', border:'none' }}
              onClick={() => setLightboxUrl(null)}>
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
