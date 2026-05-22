import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Shield } from 'lucide-react'
import { useLang } from '../i18n/LangContext'
import { getAdminUsers, adminAction } from '../services/api'
import { IMAGE_STYLES } from '../types'
import type { AdminUser } from '../services/api'

const ALL_STYLES = IMAGE_STYLES.filter(s => s.value !== 'custom').map(s => s.value)

export default function AdminPage() {
  const navigate = useNavigate()
  const { lang } = useLang()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [resetPwdId, setResetPwdId] = useState<string | null>(null)
  const [newPwd, setNewPwd] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2200) }

  async function load() {
    setLoading(true)
    try { setUsers(await getAdminUsers()) } catch { showToast('加载失败') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function doAction(userId: string, action: string, value: any) {
    try {
      await adminAction(userId, action, value)
      showToast('已更新')
      load()
    } catch { showToast('操作失败') }
  }

  async function resetPassword(userId: string) {
    if (!newPwd || newPwd.length < 6) { showToast('密码至少6位'); return }
    await doAction(userId, 'reset_password', newPwd)
    setResetPwdId(null)
    setNewPwd('')
  }

  function getAllowedStyles(user: AdminUser): string[] {
    if (user.styles_unlimited) return ALL_STYLES
    return (user.allowed_styles || 'anime').split(',').map(s => s.trim()).filter(Boolean)
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', minHeight: '100dvh', background: 'var(--bg)' }}>
      <header className="app-header">
        <button className="btn-icon" onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={18} style={{ color: 'var(--accent)' }} />
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: '0.95rem', fontWeight: 500 }}>管理后台</span>
        </div>
        <button className="btn-icon" onClick={load}><RefreshCw size={18} /></button>
      </header>

      <main style={{ padding: '16px' }}>
        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {[
            { label: '总用户', value: users.length },
            { label: '今日活跃', value: users.filter(u => u.today_entries > 0).length },
            { label: '付费用户', value: users.filter(u => u.status === 'paid').length },
          ].map(stat => (
            <div key={stat.label} className="card card-p" style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>{stat.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Users list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ width: 32, height: 32, margin: '0 auto' }} /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {users.map(user => {
              const isExpanded = expandedId === user.id
              const allowedStyles = getAllowedStyles(user)

              return (
                <div key={user.id} className="card">
                  {/* User row */}
                  <div
                    style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                    onClick={() => setExpandedId(isExpanded ? null : user.id)}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{user.email}</span>
                        {user.nickname && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({user.nickname})</span>}
                        <span style={{
                          fontSize: '0.7rem', padding: '2px 8px', borderRadius: 10,
                          background: user.status === 'paid' ? 'var(--green-light)' : user.status === 'banned' ? 'var(--danger-light)' : 'var(--surface)',
                          color: user.status === 'paid' ? 'var(--green)' : user.status === 'banned' ? 'var(--danger)' : 'var(--text-muted)',
                          fontWeight: 600,
                        }}>
                          {user.status === 'paid' ? '付费' : user.status === 'banned' ? '封禁' : '免费'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        今日 {user.today_entries} 张 · 总计 {user.total_entries} 张 ·
                        {user.daily_limit === 0 ? ' 不限次数' : ` 限 ${user.daily_limit} 次/天`}
                      </div>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{isExpanded ? '▲' : '▼'}</div>
                  </div>

                  {/* Expanded controls */}
                  {isExpanded && (
                    <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>

                      {/* Status */}
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>账户状态</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {(['free', 'paid', 'banned'] as const).map(s => (
                            <button key={s}
                              onClick={() => doAction(user.id, 'set_status', s)}
                              style={{
                                padding: '6px 16px', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', cursor: 'pointer',
                                border: `1.5px solid ${user.status === s ? 'var(--accent)' : 'var(--border)'}`,
                                background: user.status === s ? 'var(--accent-light)' : 'var(--bg-input)',
                                color: user.status === s ? 'var(--accent-dark)' : 'var(--text-secondary)',
                                fontFamily: 'var(--font-sans)', fontWeight: 500,
                              }}>
                              {s === 'free' ? '免费' : s === 'paid' ? '付费' : '封禁'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Daily limit */}
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>每日限额</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {[0, 3, 5, 10, 20].map(n => (
                            <button key={n}
                              onClick={() => doAction(user.id, 'set_daily_limit', n)}
                              style={{
                                padding: '6px 14px', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', cursor: 'pointer',
                                border: `1.5px solid ${user.daily_limit === n ? 'var(--accent)' : 'var(--border)'}`,
                                background: user.daily_limit === n ? 'var(--accent-light)' : 'var(--bg-input)',
                                color: user.daily_limit === n ? 'var(--accent-dark)' : 'var(--text-secondary)',
                                fontFamily: 'var(--font-sans)', fontWeight: 500,
                              }}>
                              {n === 0 ? '不限' : `${n}张`}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Style permissions */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>可用风格</div>
                          <button
                            onClick={() => doAction(user.id, 'set_styles_unlimited', !user.styles_unlimited)}
                            style={{
                              fontSize: '0.72rem', padding: '3px 10px', borderRadius: 10, cursor: 'pointer',
                              border: `1.5px solid ${user.styles_unlimited ? 'var(--green)' : 'var(--border)'}`,
                              background: user.styles_unlimited ? 'var(--green-light)' : 'var(--bg-input)',
                              color: user.styles_unlimited ? 'var(--green)' : 'var(--text-muted)',
                              fontFamily: 'var(--font-sans)', fontWeight: 600,
                            }}>
                            {user.styles_unlimited ? '✓ 全部解锁' : '解锁全部'}
                          </button>
                        </div>
                        {!user.styles_unlimited && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {ALL_STYLES.map(s => {
                              const isAllowed = allowedStyles.includes(s)
                              const styleInfo = IMAGE_STYLES.find(i => i.value === s)
                              return (
                                <button key={s}
                                  onClick={() => {
                                    const newStyles = isAllowed
                                      ? allowedStyles.filter(x => x !== s)
                                      : [...allowedStyles, s]
                                    doAction(user.id, 'set_allowed_styles', newStyles.join(','))
                                  }}
                                  style={{
                                    padding: '5px 10px', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', cursor: 'pointer',
                                    border: `1.5px solid ${isAllowed ? 'var(--accent)' : 'var(--border)'}`,
                                    background: isAllowed ? 'var(--accent-light)' : 'var(--bg-input)',
                                    color: isAllowed ? 'var(--accent-dark)' : 'var(--text-muted)',
                                    fontFamily: 'var(--font-sans)',
                                  }}>
                                  {styleInfo?.emoji} {lang === 'zh' ? styleInfo?.label_zh : styleInfo?.label_en}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {/* Reset password */}
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>重置密码</div>
                        {resetPwdId === user.id ? (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input className="input" type="password" placeholder="新密码（至少6位）"
                              value={newPwd} onChange={e => setNewPwd(e.target.value)}
                              style={{ flex: 1 }} />
                            <button className="btn btn-primary btn-sm" onClick={() => resetPassword(user.id)}>确认</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => { setResetPwdId(null); setNewPwd('') }}>取消</button>
                          </div>
                        ) : (
                          <button className="btn btn-ghost btn-sm" onClick={() => setResetPwdId(user.id)}>
                            重置密码
                          </button>
                        )}
                      </div>

                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
