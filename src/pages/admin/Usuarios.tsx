import { Copy, KeyRound, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../lib/auth'
import { generatePassword } from '../../lib/password'
import { supabase } from '../../lib/supabase'
import { createUser, deleteUser, resetPassword } from '../../lib/usersApi'
import { normalizeUsername, suggestUsername, USERNAME_PATTERN } from '../../lib/username'
import { ROLE_LABEL, type Profile, type UserRole } from '../../types'
import { errMsg, useAdmin } from './AdminContext'

interface Credentials {
  username: string
  password: string
  label: string
}

export default function Usuarios() {
  const { profile: me } = useAuth()
  const { event } = useAdmin()
  const eventId = event?.id ?? null
  const [users, setUsers] = useState<Profile[]>([])
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [usernameEdited, setUsernameEdited] = useState(false)
  const [role, setRole] = useState<UserRole>('runner')
  const [password, setPassword] = useState(() => generatePassword())
  const [creds, setCreds] = useState<Credentials | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<UserRole | 'all'>('all')

  const load = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase.from('profiles').select('id, username, full_name, role, event_id').order('role').order('full_name')
    setUsers(data ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      await load()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  function onCreate(e: FormEvent) {
    e.preventDefault()
    const u = normalizeUsername(username)
    if (!USERNAME_PATTERN.test(u)) {
      setError('El usuario debe tener 3-30 caracteres: letras minúsculas, números, punto, guion o guion bajo.')
      return
    }
    void run(async () => {
      await createUser({ username: u, password, full_name: fullName.trim(), role, event_id: role === 'admin' ? null : eventId })
      setCreds({ username: u, password, label: `Usuario creado: ${fullName.trim()}` })
      setFullName('')
      setUsername('')
      setUsernameEdited(false)
      setPassword(generatePassword())
    })
  }

  function onReset(u: Profile) {
    const next = generatePassword()
    if (!window.confirm(`¿Cambiar la contraseña de ${u.full_name}? Se genera una nueva.`)) return
    void run(async () => {
      await resetPassword(u.id, next)
      setCreds({ username: u.username, password: next, label: `Nueva contraseña de ${u.full_name}` })
    })
  }

  function onDelete(u: Profile) {
    if (!window.confirm(`¿Eliminar a ${u.full_name} (@${u.username})? No se puede deshacer.`)) return
    void run(async () => {
      await deleteUser(u.id)
    })
  }

  // Runners and inductors belong to one Carrera; the coordinator belongs to none. Users from before
  // this rule (no Carrera) are listed apart so they can be adopted by this Carrera or deleted.
  const mine = users.filter((u) => u.role === 'admin' || u.event_id === eventId)
  const orphans = users.filter((u) => u.role !== 'admin' && !u.event_id)
  const shown = mine.filter((u) => filter === 'all' || u.role === filter)

  function onAdopt(u: Profile) {
    if (!supabase || !eventId) return
    void run(async () => {
      const { error: err } = await supabase!.from('profiles').update({ event_id: eventId }).eq('id', u.id)
      if (err) throw new Error('No se pudo asignar el usuario a esta Carrera.')
    })
  }

  return (
    <>
      <h1>Usuarios</h1>
      <p className="muted">{mine.length} usuarios en {event?.name ?? 'esta Carrera'} (los corredores e inductores son propios de cada Carrera). Las contraseñas no se pueden consultar después: cópialas al crearlas.</p>

      {creds && (
        <section className="card creds">
          <h2>{creds.label}</h2>
          <p>Usuario: <strong>{creds.username}</strong></p>
          <p>Contraseña: <strong className="mono">{creds.password}</strong></p>
          <div className="row">
            <button onClick={() => void navigator.clipboard?.writeText(`Usuario: ${creds.username}\nContraseña: ${creds.password}`)}>
              <Copy size={18} aria-hidden="true" />
              Copiar
            </button>
            <button className="ghost" onClick={() => setCreds(null)}>Cerrar</button>
          </div>
        </section>
      )}

      <section className="card">
        <h2>Crear usuario</h2>
        <form className="form" onSubmit={onCreate}>
          <label>
            Nombre completo
            <input
              value={fullName}
              maxLength={80}
              onChange={(e) => {
                setFullName(e.target.value)
                if (!usernameEdited) setUsername(suggestUsername(e.target.value))
              }}
            />
          </label>
          <label>
            Usuario (para entrar)
            <input
              value={username}
              maxLength={30}
              autoCapitalize="none"
              autoCorrect="off"
              onChange={(e) => {
                setUsername(e.target.value)
                setUsernameEdited(true)
              }}
            />
          </label>
          <label>
            Rol
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              <option value="runner">Corredor</option>
              <option value="base">Inductor de base</option>
              <option value="admin">Coordinador (admin)</option>
            </select>
          </label>
          <label>
            Contraseña sugerida
            <div className="row">
              <input className="grow mono" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="ghost" onClick={() => setPassword(generatePassword())}>Otra</button>
            </div>
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={busy || !fullName.trim() || !username.trim() || password.length < 6}>
            {busy ? 'Creando…' : 'Crear usuario'}
          </button>
        </form>
      </section>

      <section className="card">
        <div className="row">
          <h2 className="grow">Lista</h2>
          <select value={filter} onChange={(e) => setFilter(e.target.value as UserRole | 'all')} aria-label="Filtrar por rol">
            <option value="all">Todos</option>
            <option value="runner">Corredores</option>
            <option value="base">Inductores de base</option>
            <option value="admin">Coordinador</option>
          </select>
        </div>
        <ul className="list">
          {shown.map((u) => (
            <li key={u.id}>
              <span className="grow">
                {u.full_name}
                <small className="muted"> @{u.username} · {ROLE_LABEL[u.role]}</small>
              </span>
              <button className="ghost" disabled={busy} onClick={() => onReset(u)} title="Generar una contraseña nueva">
                <KeyRound size={16} aria-hidden="true" />
                Contraseña
              </button>
              {u.id !== me?.id && (
                <button className="ghost danger icon-btn" disabled={busy} onClick={() => onDelete(u)} aria-label={`Eliminar ${u.full_name}`} title="Eliminar usuario"><Trash2 size={18} /></button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {orphans.length > 0 && (
        <section className="card">
          <h2>Sin Carrera asignada</h2>
          <p className="muted">Usuarios creados antes de que cada Carrera tuviera los suyos. Asígnalos a {event?.name ?? 'esta Carrera'} o elimínalos.</p>
          <ul className="list">
            {orphans.map((o) => (
              <li key={o.id}>
                <span className="grow">
                  {o.full_name}
                  <small className="muted"> @{o.username} · {ROLE_LABEL[o.role]}</small>
                </span>
                {eventId && <button className="ghost" disabled={busy} onClick={() => onAdopt(o)}>Asignar aquí</button>}
                <button className="ghost danger icon-btn" disabled={busy} onClick={() => onDelete(o)} aria-label={`Eliminar ${o.full_name}`} title="Eliminar usuario"><Trash2 size={18} /></button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
