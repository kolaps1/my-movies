import { useState } from 'react'
import { supabase } from './services/supabase'

const TECHNICAL_EMAIL_DOMAIN = '@mymovies.local'

function makeTechnicalEmail(username) {
  return `${username.toLowerCase()}${TECHNICAL_EMAIL_DOMAIN}`
}

function isValidUsername(username) {
  return /^[a-zA-Z0-9._-]{3,20}$/.test(username)
}

export default function Auth() {
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
      setMessage('Заповни всі поля')
      return
    }

    if (!isValidUsername(cleanUsername)) {
      setMessage(
        'Нік: 3–20 символів, тільки латинські літери, цифри, . _ -'
      )
      return
    }

    if (password.length < 6) {
      setMessage('Пароль повинен містити мінімум 6 символів')
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
          setMessage('Акаунт успішно створено!')
        } else {
          setMessage(
            'Акаунт створено. Якщо Supabase попросить підтвердження email, перевір налаштування Confirm email.'
          )
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
        setMessage('Такий нік уже зайнятий')
      } else if (errorText.includes('invalid login credentials')) {
        setMessage('Неправильний нік або пароль')
      } else if (errorText.includes('email address') && errorText.includes('invalid')) {
        setMessage('Помилка технічного email. Перевір налаштування Supabase.')
      } else {
        setMessage(error?.message || 'Сталася помилка')
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
      <div className="auth-card">
        <div className="auth-logo">🎬</div>

        <h1>MyMovies</h1>

        <p className="auth-subtitle">
          {mode === 'login'
            ? 'Увійди до свого акаунта'
            : 'Створи свій акаунт'}
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="username">Нік</label>

          <input
            id="username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="danylo"
            autoComplete="username"
            maxLength={20}
            disabled={loading}
          />

          <label htmlFor="password">Пароль</label>

          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Мінімум 6 символів"
            autoComplete={
              mode === 'login' ? 'current-password' : 'new-password'
            }
            disabled={loading}
          />

          <button type="submit" disabled={loading}>
            {loading
              ? 'Зачекай...'
              : mode === 'login'
                ? 'Увійти'
                : 'Створити акаунт'}
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
              <span>Ще немає акаунта?</span>
              <button type="button" onClick={switchMode}>
                Зареєструватися
              </button>
            </>
          ) : (
            <>
              <span>Вже маєш акаунт?</span>
              <button type="button" onClick={switchMode}>
                Увійти
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
