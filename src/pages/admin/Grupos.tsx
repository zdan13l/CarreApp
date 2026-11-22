import { Radio, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import PhotoField from '../../components/PhotoField'
import { deletePhoto, uploadPhoto } from '../../lib/storage'
import { supabase } from '../../lib/supabase'
import type { Profile, TeamRow } from '../../types'
import { errMsg, useAdmin } from './AdminContext'
import { confirmDialog } from '../../lib/dialog'

export default function Grupos() {
  const { event } = useAdmin()
  const [teams, setTeams] = useState<TeamRow[]>([])
  const [runners, setRunners] = useState<Profile[]>([])
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const eventId = event?.id

  const load = useCallback(async () => {
    if (!supabase || !eventId) return
    const [t, p] = await Promise.all([
      supabase
        .from('teams')
        .select('id, name, photo_path, sort_order, team_runners(user_id, is_gps_tracker)')
        .eq('event_id', eventId)
        .order('sort_order')
        .order('name'),
      supabase.from('profiles').select('id, username, full_name, role').eq('role', 'runner').eq('event_id', eventId).order('full_name'),
    ])
    setTeams(t.data ?? [])
    setRunners(p.data ?? [])
  }, [eventId])

  useEffect(() => {
    void load()
  }, [load])

  if (!event) return <p className="warn">Primero crea una carrera en la pestaña "Carrera".</p>

  async function addTeam(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !eventId || !name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const photo_path = file ? await uploadPhoto('teams', file) : null
      const { error: err } = await supabase
        .from('teams')
        .insert({ event_id: eventId, name: name.trim(), photo_path, sort_order: teams.length })
      if (err) {
        await deletePhoto(photo_path)
        throw new Error(err.message.includes('duplicate') ? 'Ya existe un grupo con ese nombre.' : 'No se pudo crear el grupo.')
      }
      setName('')
      setFile(null)
      await load()
    } catch (e2) {
      setError(errMsg(e2))
    } finally {
      setBusy(false)
    }
  }

  const assigned = new Set(teams.flatMap((t) => t.team_runners.map((r) => r.user_id)))
  const free = runners.filter((r) => !assigned.has(r.id))

  return (
    <>
      <p className="eyebrow">Flight roster</p>
      <h1>Grupos</h1>
      <p className="muted">{teams.length} grupos en {event.name}</p>

      <section className="card">
        <h2>Agregar grupo</h2>
        <form className="form" onSubmit={addTeam}>
          <label>
            Nombre del grupo
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </label>
          <label>
            Foto (opcional ahora, obligatoria para activar)
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={busy || !name.trim()}>{busy ? 'Guardando…' : 'Agregar grupo'}</button>
        </form>
      </section>

      <div className="grid">
        {teams.map((t) => (
          <TeamCard key={t.id} team={t} runners={runners} free={free} onChange={load} />
        ))}
      </div>
    </>
  )
}

export function TeamCard({
  team,
  runners,
  free,
  onChange,
}: {
  team: TeamRow
  runners: Profile[]
  free: Profile[]
  onChange: () => Promise<void>
}) {
  const [name, setName] = useState(team.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pick, setPick] = useState('')

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      await onChange()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const sb = supabase!

  const saveName = () =>
    run(async () => {
      const { error: err } = await sb.from('teams').update({ name: name.trim() }).eq('id', team.id)
      if (err) throw new Error('No se pudo guardar el nombre (¿ya existe otro grupo igual?).')
    })

  const changePhoto = (file: File) =>
    run(async () => {
      const path = await uploadPhoto('teams', file)
      const { error: err } = await sb.from('teams').update({ photo_path: path }).eq('id', team.id)
      if (err) {
        await deletePhoto(path)
        throw new Error('No se pudo guardar la foto.')
      }
      await deletePhoto(team.photo_path)
    })

  const addRunner = () =>
    run(async () => {
      if (!pick) return
      const { error: err } = await sb.from('team_runners').insert({ team_id: team.id, user_id: pick })
      if (err) throw new Error(err.message.includes('ya está en otro') ? 'Ese corredor ya está en otro grupo.' : 'No se pudo agregar el corredor.')
      setPick('')
    })

  const removeRunner = (userId: string) =>
    run(async () => {
      const { error: err } = await sb.from('team_runners').delete().eq('team_id', team.id).eq('user_id', userId)
      if (err) throw new Error('No se pudo quitar el corredor.')
    })

  const setTracker = (userId: string) =>
    run(async () => {
      // Only one runner per team may send GPS: clear the others first.
      await sb.from('team_runners').update({ is_gps_tracker: false }).eq('team_id', team.id)
      const { error: err } = await sb
        .from('team_runners')
        .update({ is_gps_tracker: true })
        .eq('team_id', team.id)
        .eq('user_id', userId)
      if (err) throw new Error('No se pudo designar el GPS.')
    })

  const remove = async () => {
    if (!(await confirmDialog({ title: `¿Eliminar el grupo "${team.name}"?`, message: 'Se borran también sus cruces y los puntos registrados.', confirmLabel: 'Eliminar grupo', tone: 'danger', icon: 'trash' }))) return
    void run(async () => {
      const { error: err } = await sb.from('teams').delete().eq('id', team.id)
      if (err) throw new Error('No se pudo eliminar el grupo.')
      await deletePhoto(team.photo_path)
    })
  }

  return (
    <section className="card">
      <PhotoField path={team.photo_path} label={`Foto de ${team.name}`} busy={busy} onPick={(f) => void changePhoto(f)} />
      <div className="row">
        <input className="grow" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label="Nombre del grupo" />
        <button disabled={busy || !name.trim() || name.trim() === team.name} onClick={() => void saveName()}>Guardar</button>
      </div>

      <h3>Corredores ({team.team_runners.length}, mínimo 1: la pareja puede compartir un usuario)</h3>
      {team.team_runners.length === 0 && <p className="muted">Sin corredores.</p>}
      <ul className="list">
        {team.team_runners.map((r) => {
          const p = runners.find((x) => x.id === r.user_id)
          return (
            <li key={r.user_id}>
              <span className="grow">{p ? p.full_name : 'Usuario'}</span>
              {r.is_gps_tracker ? (
                <span className="badge ok"><Radio size={13} aria-hidden="true" /> GPS</span>
              ) : (
                <button className="ghost" disabled={busy} onClick={() => void setTracker(r.user_id)}>Usar para GPS</button>
              )}
              <button className="ghost icon-btn" disabled={busy} onClick={() => void removeRunner(r.user_id)} aria-label="Quitar corredor" title="Quitar corredor"><X size={18} /></button>
            </li>
          )
        })}
      </ul>
      <div className="row">
        <select className="grow" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Agregar corredor">
          <option value="">{free.length ? 'Agregar corredor…' : 'No quedan corredores libres'}</option>
          {free.map((p) => <option key={p.id} value={p.id}>{p.full_name} (@{p.username})</option>)}
        </select>
        <button disabled={busy || !pick} onClick={() => void addRunner()}>Agregar</button>
      </div>

      {error && <p className="error">{error}</p>}
      <button className="ghost danger" disabled={busy} onClick={remove}>
        <Trash2 size={18} aria-hidden="true" />
        Eliminar grupo
      </button>
    </section>
  )
}
