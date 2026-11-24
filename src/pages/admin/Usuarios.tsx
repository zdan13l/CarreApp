import PageTitle from './PageTitle'
import { Camera, Copy, KeyRound, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Avatar from '../../components/Avatar'
import { useAuth } from '../../lib/auth'
import { generatePassword } from '../../lib/password'
import { deletePhoto, uploadPhoto } from '../../lib/storage'
import { supabase } from '../../lib/supabase'
import { createUser, deleteUser, resetPassword } from '../../lib/usersApi'
import { normalizeUsername, suggestUsername, USERNAME_PATTERN } from '../../lib/username'
import { ROLE_LABEL, type Profile, type UserRole } from '../../types'
import { errMsg, useAdmin } from './AdminContext'
import { confirmDialog } from '../../lib/dialog'

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
  const [photosReady, setPhotosReady] = useState(true)

  const load = useCallback(async () => {
    if (!supabase) return
    const read = (columns: string) => supabase!.from('profiles').select(columns).order('role').order('full_name')
    let { data, error: err } = await read('id, username, full_name, role, event_id, photo_path')
    if (err) {
      setPhotosReady(false) // the SQL of the photos (0018) is not applied yet: the list still works without them
      ;({ data } = await read('id, username, full_name, role, event_id'))
    } else setPhotosReady(true)
    setUsers((data ?? []) as unknown as Profile[])
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
    if (role !== 'admin' && !eventId) {
      setError('Primero crea o elige una carrera: los corredores e inductores pertenecen a una.')
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

  // The coordinator gives each person a picture; it replaces their initials in their top bar and in this list.
  function onPhoto(u: Profile, file: File) {
    if (!supabase) return
    void run(async () => {
      const path = await uploadPhoto('users', file)
      const { error: err } = await supabase!.from('profiles').update({ photo_path: path }).eq('id', u.id)
      if (err) {
        await deletePhoto(path)
        throw new Error('No se pudo guardar la foto. Si acabas de actualizar la app, falta aplicar la migración 0018 de fotos.')
      }
      await deletePhoto(u.photo_path ?? null)
    })
  }

  async function onReset(u: Profile) {
    const next = generatePassword()
    if (!(await confirmDialog({ title: `¿Cambiar la contraseña de ${u.full_name}?`, message: 'Se genera una nueva y se muestra una sola vez.', confirmLabel: 'Generar nueva', icon: 'question' }))) return
    void run(async () => {
      await resetPassword(u.id, next)
      setCreds({ username: u.username, password: next, label: `Nueva contraseña de ${u.full_name}` })
    })
  }

  async function onDelete(u: Profile) {
    if (!(await confirmDialog({ title: `¿Eliminar a ${u.full_name}?`, message: `@${u.username}. No se puede deshacer.`, confirmLabel: 'Eliminar', tone: 'danger', icon: 'trash' }))) return
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
      if (err) throw new Error('No se pudo asignar el usuario a esta carrera.')
    })
  }

  return (
    <>
            <PageTitle step={8}>Usuarios</PageTitle>
      <p className="muted">{mine.length} usuarios en {event?.name ?? 'esta carrera'} (los corredores e inductores son propios de cada carrera). Las contraseñas no se pueden consultar después: cópialas al crearlas.</p>

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
              <option value="admin">Coordi (admin)</option>
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
          <button type="submit" disabled={busy || !fullName.trim() || !username.trim() || password.length < 6 || (role !== 'admin' && !eventId)}>
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
            <option value="admin">Coordi</option>
          </select>
        </div>
        <ul className="list">
          {shown.map((u) => (
            <li key={u.id}>
              <Avatar name={u.full_name} photoPath={u.photo_path} size={44} />
              <span className="grow">
                {u.full_name}
                <small className="muted"> @{u.username} · {ROLE_LABEL[u.role]}</small>
              </span>
              {photosReady && (
                <label className={`btn-like icon-only${busy ? ' disabled' : ''}`} title={u.photo_path ? 'Cambiar foto' : 'Agregar foto'}>
                  <Camera size={18} aria-hidden="true" />
                  <span className="sr-only">{u.photo_path ? `Cambiar la foto de ${u.full_name}` : `Agregar foto a ${u.full_name}`}</span>
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    disabled={busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      if (file) onPhoto(u, file)
                    }}
                  />
                </label>
              )}
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
          <p className="muted">Usuarios creados antes de que cada carrera tuviera los suyos. Asígnalos a {event?.name ?? 'esta carrera'} o elimínalos.</p>
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
