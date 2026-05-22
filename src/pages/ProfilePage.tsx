import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Sparkles } from 'lucide-react'
import { useLang } from '../i18n/LangContext'
import { useAuth } from '../hooks/useAuth'
import { getProfile, saveProfile } from '../services/api'
import type { UserProfile } from '../services/api'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { t, lang } = useLang()
  const { user, logout } = useAuth()

  const [profile, setProfile] = useState<UserProfile>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2200) }

  useEffect(() => {
    getProfile().then(p => { setProfile(p); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      await saveProfile(profile)
      showToast(t('save_success'))
    } catch { showToast('保存失败，请重试') }
    finally { setSaving(false) }
  }

  const completedFields = [
    profile.nickname, profile.gender, profile.birth_year,
    profile.personality, profile.interests, profile.self_description
  ].filter(Boolean).length

  return (
    <div className="app-shell">
      <header className="app-header">
        <button className="btn-icon" onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '0.95rem', fontWeight: 500 }}>{t('profile')}</div>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
          {saving ? <span className="spinner" style={{ width: 14, height: 14, borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} /> : t('save')}
        </button>
      </header>

      {loading ? (
        <div className="loading-overlay"><div className="spinner" style={{ width: 32, height: 32 }} /></div>
      ) : (
        <main style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

          {/* Avatar + email */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0 24px', gap: 8 }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid var(--accent)',
            }}>
              {profile.nickname
                ? <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', color: 'var(--accent)' }}>{profile.nickname[0]}</span>
                : <User size={32} style={{ color: 'var(--accent)' }} />
              }
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{user?.email}</div>

            {/* Completion bar */}
            <div style={{ width: '100%', maxWidth: 240 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Sparkles size={11} style={{ color: 'var(--accent)' }} />
                  {completedFields === 6 ? (t('lang') === 'zh' ? 'AI 了解你了！' : 'AI knows you!') : t('profile_hint')}
                </span>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{completedFields}/6</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(completedFields / 6) * 100}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.3s ease' }} />
              </div>
            </div>
          </div>

          {/* Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Nickname */}
            <div className="input-group">
              <label className="input-label">
                {t('nickname')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {t('optional')}</span>
              </label>
              <input className="input" placeholder={t('nickname_placeholder')}
                value={profile.nickname || ''}
                onChange={e => setProfile(p => ({ ...p, nickname: e.target.value }))}
              />
            </div>

            {/* Gender */}
            <div className="input-group">
              <label className="input-label">
                {t('gender')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {t('optional')}</span>
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['male', 'female', 'other'] as const).map(g => (
                  <button key={g}
                    onClick={() => setProfile(p => ({ ...p, gender: p.gender === t(`gender_${g}`) ? '' : t(`gender_${g}`) }))}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 'var(--radius-md)',
                      border: `1.5px solid ${profile.gender === t(`gender_${g}`) ? 'var(--accent)' : 'var(--border)'}`,
                      background: profile.gender === t(`gender_${g}`) ? 'var(--accent-light)' : 'var(--bg-input)',
                      color: profile.gender === t(`gender_${g}`) ? 'var(--accent-dark)' : 'var(--text-secondary)',
                      fontSize: '0.88rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    }}
                  >{t(`gender_${g}`)}</button>
                ))}
              </div>
            </div>

            {/* Birth year */}
            <div className="input-group">
              <label className="input-label">
                {t('birth_year')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {t('optional')}</span>
              </label>
              <input className="input" type="number" placeholder={t('birth_year_placeholder')}
                min={1920} max={new Date().getFullYear()}
                value={profile.birth_year || ''}
                onChange={e => setProfile(p => ({ ...p, birth_year: e.target.value ? parseInt(e.target.value) : undefined }))}
              />
            </div>

            {/* Personality */}
            <div className="input-group">
              <label className="input-label">
                {t('personality')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {t('optional')}</span>
              </label>
              <input className="input" placeholder={t('personality_placeholder')}
                value={profile.personality || ''}
                onChange={e => setProfile(p => ({ ...p, personality: e.target.value }))}
              />
            </div>

            {/* Interests */}
            <div className="input-group">
              <label className="input-label">
                {t('interests')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {t('optional')}</span>
              </label>
              <input className="input" placeholder={t('interests_placeholder')}
                value={profile.interests || ''}
                onChange={e => setProfile(p => ({ ...p, interests: e.target.value }))}
              />
            </div>

            {/* Self description */}
            <div className="input-group">
              <label className="input-label">
                {t('self_description')} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {t('optional')}</span>
              </label>
              <textarea className="input" placeholder={t('self_description_placeholder')} rows={3}
                value={profile.self_description || ''}
                onChange={e => setProfile(p => ({ ...p, self_description: e.target.value }))}
              />
            </div>

            {/* Save button */}
            <button className="btn btn-primary btn-full btn-lg" onClick={handleSave} disabled={saving} style={{ marginTop: 8 }}>
              {saving
                ? <><span className="spinner" style={{ width: 16, height: 16, borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} /> {t('save')}</>
                : t('save')
              }
            </button>

            {/* Upgrade notice */}
            {!user?.is_admin && (
              <div style={{
                marginTop: 8, padding: '12px 16px', borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, var(--accent-light), #f0e8ff)',
                border: '1px solid var(--accent-light)',
              }}>
                <div style={{ fontSize: '0.82rem', color: 'var(--accent-dark)', lineHeight: 1.6, textAlign: 'center' }}>
                  ✨ {lang === 'zh'
                    ? '由于生图会产生算力费用，若想解锁更多权限请联系管理员'
                    : 'To unlock more styles & higher limits, contact the admin'}
                </div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--accent)', textAlign: 'center', marginTop: 6 }}>
                  微信号：xjheinz
                </div>
              </div>
            )}

            {/* Admin */}
            {user?.is_admin && (
              <button className="btn btn-ghost btn-full" onClick={() => navigate('/admin')} style={{ marginTop: 4 }}>
                🛡️ 管理后台
              </button>
            )}

            {/* Logout */}
            <button className="btn btn-ghost btn-full" onClick={logout} style={{ marginTop: 4, color: 'var(--danger)' }}>
              {t('logout')}
            </button>

          </div>
        </main>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
