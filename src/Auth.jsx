import { useState } from 'react'
import { supabase } from './services/supabase'

const TECHNICAL_EMAIL_DOMAIN = '@mymovies.local'

function makeTechnicalEmail(username) {
  return `${username.toLowerCase()}${TECHNICAL_EMAIL_DOMAIN}`
}

function isValidUsername(username) {
  return /^[a-zA-Z0-9._-]{3,20}$/.test(username)
}

export default function Auth({ lang, setLang, t }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setMessage('')

    const cleanUsername = username.trim().toLowerCase()

    if (!cleanUsername || !password) {
      setMessage(t.authErrEmpty)
      return
    }

    if (!isValidUsername(cleanUsername)) {
      setMessage(t.authErrUser)
      return
    }

    if (password.length < 6) {
      setMessage(t.authErrPass)
      return
    }

    const technicalEmail = makeTechnicalEmail(cleanUsername)

    setLoading(true)

    try {
      if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email: technicalEmail,
          password,
          options: {
            data: {
              username: cleanUsername,
            },
          },
        })

        if (error) throw error

        if (data.session) {
          setMessage(t.authOkReg)
        } else {
          setMessage(t.authOkRegConfirm)
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: technicalEmail,
          password,
        })

        if (error) throw error
      }
    } catch (error) {
      console.error('AUTH ERROR:', error)

      const errorText = error?.message?.toLowerCase() || ''

      if (errorText.includes('already registered')) {
        setMessage(t.authErrTaken)
      } else if (errorText.includes('invalid login credentials')) {
        setMessage(t.authErrWrong)
      } else if (errorText.includes('email address') && errorText.includes('invalid')) {
        setMessage(t.authErrEmail)
      } else {
        setMessage(error?.message || t.authErrGen)
      }
    } finally {
      setLoading(false)
    }
  }

  const switchMode = () => {
    setMode((current) => (current === 'login' ? 'register' : 'login'))
    setUsername('')
    setPassword('')
    setMessage('')
  }

  return (
    <div className="auth-page">
      <div className="lang-switcher auth-lang-switcher">
        <button 
          className={lang === 'en' ? 'active' : ''} 
          onClick={() => setLang('en')}
        >EN</button>
        <button 
          className={lang === 'uk' ? 'active' : ''} 
          onClick={() => setLang('uk')}
        >UA</button>
      </div>

      <div className="auth-card">
        <div className="auth-logo">🎬</div>

        <h1>MyMovies</h1>

        <p className="auth-subtitle">
          {mode === 'login' ? t.authLoginTitle : t.authRegTitle}
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="username">{t.authLoginLabel}</label>

          <input
            id="username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder={t.authLoginPlace}
            autoComplete="username"
            maxLength={20}
            disabled={loading}
          />

          <label htmlFor="password">{t.authPassLabel}</label>

          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t.authPassPlace}
            autoComplete={
              mode === 'login' ? 'current-password' : 'new-password'
            }
            disabled={loading}
          />

          <button type="submit" disabled={loading}>
            {loading
              ? t.authWait
              : mode === 'login'
                ? t.authBtnLogin
                : t.authBtnReg}
          </button>
        </form>

        {message && (
          <div className="auth-message">
            {message}
          </div>
        )}

        <div className="auth-switch">
          {mode === 'login' ? (
            <>
              <span>{t.authNoAcc}</span>
              <button type="button" onClick={switchMode}>
                {t.authSwitchReg}
              </button>
            </>
          ) : (
            <>
              <span>{t.authHasAcc}</span>
              <button type="button" onClick={switchMode}>
                {t.authSwitchLog}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}