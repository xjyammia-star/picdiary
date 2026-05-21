import { useState, FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useLang } from '../i18n/LangContext'

export default function AuthPage() {
  const { login, register } = useAuth()
  const { t, lang, setLang } = useLang()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (mode === 'register' && password !== confirm) {
      setError(t('password_mismatch'))
      return
    }
    setLoading(true)
    try {
      if (mode === 'login') await login(email, password)
      else await register(email, password)
    } catch (err: any) {
      const msg = err.message || ''
      if (msg.includes('email_exists')) setError(t('error_email_exists'))
      else if (msg.includes('invalid_credentials')) setError(t('error_login'))
      else setError(mode === 'login' ? t('error_login') : t('error_register'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg" />
      <div className="auth-container">
        {/* Language toggle */}
        <div className="auth-lang">
          <button className={`lang-btn ${lang === 'zh' ? 'active' : ''}`} onClick={() => setLang('zh')}>中文</button>
          <button className={`lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button>
        </div>

        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-main">{t('app_name')}</div>
          <div className="auth-logo-sub">{t('app_subtitle')}</div>
        </div>

        {/* Card */}
        <div className="auth-card card card-p">
          <h2 className="auth-title">{mode === 'login' ? t('login') : t('register')}</h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="input-group">
              <label className="input-label">{t('email')}</label>
              <input
                className="input"
                type="email"
                placeholder={t('email_placeholder')}
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="input-group">
              <label className="input-label">{t('password')}</label>
              <input
                className="input"
                type="password"
                placeholder={t('password_placeholder')}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            {mode === 'register' && (
              <div className="input-group">
                <label className="input-label">{t('confirm_password')}</label>
                <input
                  className="input"
                  type="password"
                  placeholder={t('confirm_placeholder')}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
            )}

            {error && <div className="auth-error">{error}</div>}

            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              style={{ marginTop: 4 }}
              disabled={loading}
            >
              {loading ? <span className="spinner" style={{ borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} /> : null}
              {loading ? (mode === 'login' ? t('login') : t('register')) : (mode === 'login' ? t('login_now') : t('register_now'))}
            </button>
          </form>

          <div className="auth-switch">
            {mode === 'login' ? t('no_account') : t('have_account')}
            {' '}
            <button
              className="auth-switch-btn"
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
            >
              {mode === 'login' ? t('register') : t('login')}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .auth-page {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px 20px;
          position: relative;
          overflow: hidden;
        }
        .auth-bg {
          position: fixed;
          inset: 0;
          background: radial-gradient(ellipse at 20% 20%, #E8C9AF 0%, transparent 50%),
                      radial-gradient(ellipse at 80% 80%, #B8D4C6 0%, transparent 50%),
                      var(--bg);
          z-index: 0;
        }
        .auth-container {
          width: 100%;
          max-width: 380px;
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .auth-lang {
          display: flex;
          gap: 6px;
          justify-content: flex-end;
        }
        .lang-btn {
          padding: 5px 12px;
          border-radius: 20px;
          border: 1px solid var(--border);
          background: transparent;
          font-size: 0.78rem;
          color: var(--text-secondary);
          cursor: pointer;
          font-family: var(--font-sans);
          transition: all 0.12s;
        }
        .lang-btn.active {
          background: var(--accent);
          color: white;
          border-color: var(--accent);
        }
        .auth-logo { text-align: center; }
        .auth-logo-main {
          font-family: var(--font-serif);
          font-size: 2.8rem;
          font-weight: 300;
          color: var(--accent);
          letter-spacing: 0.05em;
          line-height: 1;
        }
        .auth-logo-sub {
          font-size: 0.78rem;
          color: var(--text-muted);
          margin-top: 6px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .auth-card { box-shadow: var(--shadow-lg) !important; }
        .auth-title {
          font-family: var(--font-serif);
          font-size: 1.2rem;
          font-weight: 500;
          margin-bottom: 20px;
          color: var(--text-primary);
        }
        .auth-error {
          font-size: 0.82rem;
          color: var(--danger);
          background: var(--danger-light);
          padding: 8px 12px;
          border-radius: var(--radius-sm);
        }
        .auth-switch {
          margin-top: 16px;
          text-align: center;
          font-size: 0.82rem;
          color: var(--text-muted);
        }
        .auth-switch-btn {
          background: none;
          border: none;
          color: var(--accent);
          font-size: 0.82rem;
          cursor: pointer;
          font-weight: 500;
          padding: 0;
          font-family: var(--font-sans);
        }
      `}</style>
    </div>
  )
}
