import { Eye, EyeOff, LogIn } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import Logo from '../components/Logo'
import ThemeToggle from '../components/ThemeToggle'
import { homePathForRole, useAuth } from '../lib/auth'

export default function Login() {
  const { session, profile, loading, signIn } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session && profile) return <Navigate to={homePathForRole[profile.role]} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(await signIn(username, password))
    setSubmitting(false)
  }

  return (
    <main className="page login">
      <div className="login-theme"><ThemeToggle /></div>
      <Logo size={72} />
      <p className="tagline">Gestión en vivo de la Carrera de inducción.</p>
      <form className="card form" onSubmit={onSubmit}>
        <label>
          Usuario
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            placeholder="el que te dio el coordinador"
            required
          />
        </label>
        <label>
          Contraseña
          <div className="pass-field">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="eye"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn-block" disabled={submitting}>
          <LogIn size={19} aria-hidden="true" />
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
