import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, LogOut, Globe } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useLang } from '../i18n/LangContext'
import { getCalendarMonth } from '../services/api'
import CreateSheet from '../components/diary/CreateSheet'
import type { CalendarDay } from '../types'

function formatDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}

export default function HomePage() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { t, lang, setLang } = useLang()

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [calendarData, setCalendarData] = useState<CalendarDay[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [selectedDate] = useState(formatDate(today.getFullYear(), today.getMonth()+1, today.getDate()))

  const loadCalendar = useCallback(async () => {
    try {
      const data = await getCalendarMonth(year, month)
      setCalendarData(data)
    } catch {}
  }, [year, month])

  useEffect(() => { loadCalendar() }, [loadCalendar])

  const dayMap = new Map(calendarData.map(d => [d.date, d]))

  // Build calendar days
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
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: formatDate(year, month, d), day: d, type: 'curr' })
  }
  const remaining = 42 - cells.length
  for (let d = 1; d <= remaining; d++) {
    const m2 = month === 12 ? 1 : month + 1
    const y2 = month === 12 ? year + 1 : year
    cells.push({ date: formatDate(y2, m2, d), day: d, type: 'next' })
  }

  const prevMonth = () => {
    if (month === 1) { setYear(y => y-1); setMonth(12) }
    else setMonth(m => m-1)
  }
  const nextMonth = () => {
    if (month === 12) { setYear(y => y+1); setMonth(1) }
    else setMonth(m => m+1)
  }

  const todayStr = formatDate(today.getFullYear(), today.getMonth()+1, today.getDate())

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div className="header-logo">
          {t('app_name')}<span>PicDiary</span>
        </div>
        <div className="header-actions">
          <button className="btn-icon" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')} title="切换语言">
            <Globe size={18} />
          </button>
          <button className="btn-icon" onClick={logout} title={t('logout')}>
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, paddingBottom: 80, overflowY: 'auto' }}>
        {/* Calendar */}
        <div className="card" style={{ margin: '16px 16px 0', borderRadius: 'var(--radius-lg)' }}>
          {/* Month nav */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 16px 8px' }}>
            <button className="btn-icon" onClick={prevMonth}><ChevronLeft size={18} /></button>
            <div style={{ fontFamily:'var(--font-serif)', fontSize:'1.05rem', fontWeight:500 }}>
              {t('months')[month-1]} {year}
            </div>
            <button className="btn-icon" onClick={nextMonth}><ChevronRight size={18} /></button>
          </div>

          {/* Weekday headers */}
          <div className="calendar-grid" style={{ gap: '2px 4px' }}>
            {t('weekdays').split(',').map((wd: string, i: number) => (
              <div key={i} className="calendar-weekday">{wd}</div>
            ))}
            {cells.map((cell) => {
              const info = dayMap.get(cell.date)
              const isToday = cell.date === todayStr
              const hasEntry = !!info
              return (
                <button
                  key={cell.date}
                  className={`calendar-day ${isToday ? 'today' : ''} ${hasEntry ? 'has-entry' : ''} ${cell.type !== 'curr' ? 'other-month' : ''}`}
                  onClick={() => cell.type === 'curr' && navigate(`/day/${cell.date}`)}
                  disabled={cell.type !== 'curr'}
                >
                  <span>{cell.day}</span>
                  {hasEntry && (
                    <div className={`calendar-dot ${info?.has_note ? 'has-note' : ''}`} />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Today shortcut */}
        <div style={{ padding: '12px 16px 0' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate(`/day/${todayStr}`)}
            style={{ marginBottom: 8 }}
          >
            {t('today')} →
          </button>
        </div>
      </main>

      {/* FAB create button */}
      <button
        className="btn tab-create"
        style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', zIndex:45 }}
        onClick={() => setShowCreate(true)}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Create sheet */}
      {showCreate && (
        <CreateSheet
          date={selectedDate}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); navigate(`/day/${selectedDate}`); loadCalendar() }}
        />
      )}
    </div>
  )
}
