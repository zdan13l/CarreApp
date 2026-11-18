import { Eye, EyeOff, LogIn } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import Logo from '../components/Logo'
import Mrz from '../components/Mrz'
import ThemeToggle from '../components/ThemeToggle'
import { homePathForRole, useAuth } from '../lib/auth'
import { mrzJoin } from '../lib/stamp'

// The cover of the passport: the campus on top, the foil title over it, and the form on a sheet of security paper.
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
    <main className="login-screen">
      <div className="login-theme"><ThemeToggle /></div>
      <section className="login-hero">
        <img className="login-photo" src="/campus-800.jpg" srcSet="/campus-800.jpg 800w, /campus.jpg 1600w" sizes="(min-width: 900px) 60vw, 100vw" alt="Fotografía del campus" width={1600} height={1067} fetchPriority="high" decoding="async" />
        <img className="login-uni" src="/javeriana-logo-white.png" alt="Pontificia Universidad Javeriana" width={480} height={627} />
        <p className="doc-kicker">Gestión en vivo de Carrera</p>
        <Logo size={44} />
        <h1 className="login-title">
          Pasaporte
          <small>Un sello por cada base que alcances.</small>
        </h1>
      </section>
      <form className="card form login-card" onSubmit={onSubmit}>
        <label>
          Usuario
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            placeholder="Dado por el coordinador"
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
        <Mrz lines={[mrzJoin(['P<PUJ', 'CARRERA', '2710']), mrzJoin(['INDUCCION', 'BIENVENIDOS', 'NEOS'])]} />
      </form>
      <p className="login-foot">Semana de inducción</p>
    </main>
  )
}
