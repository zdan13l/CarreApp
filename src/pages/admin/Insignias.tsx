import { Plus, Upload } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import CareerPlate from '../../components/CareerPlate'
import { confirmDialog } from '../../lib/dialog'
import { deletePhoto, photoUrl } from '../../lib/storage'
import { supabase } from '../../lib/supabase'
import { errMsg } from './AdminContext'

interface Badge {
  id: string
  key: string
  name: string
  description: string | null
  group_id: string | null
  image_path: string | null
  active: boolean
  sort_order: number
}
interface Group { id: string; name: string }

// the drawings the app already has for the groups of careers (the key is the one of the group): used until an image is uploaded
const BUILT_IN: Record<string, string> = { sistemas: 'Sistemas', tronicas: 'Electrónica', industrial: 'Industrial', biomec: 'Bioingeniería', civil: 'Civil' }
const slug = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)

async function uploadBadge(file: File): Promise<string> {
  if (!supabase) throw new Error('Supabase no está configurado.')
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('La imagen debe ser PNG, JPG o WebP.')
  if (file.size > 2 * 1024 * 1024) throw new Error('La imagen pesa más de 2 MB.')
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `badges/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('photos').upload(path, file, { contentType: file.type, cacheControl: '31536000' })
  if (error) throw new Error('No se pudo subir la imagen.')
  return path
}

// GLOBAL: the insignias are the logo of each group of careers (the little plant of Biomec, the circuit of Tronicas…). They are shared by every
// carrera and every group; they are not stamps (those belong to one carrera). Here they are listed, created, edited and switched on or off.
export default function Insignias() {
  const [badges, setBadges] = useState<Badge[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newGroup, setNewGroup] = useState('')

  const load = useCallback(async () => {
    if (!supabase) return
    const [b, g] = await Promise.all([
      supabase.from('badges').select('id, key, name, description, group_id, image_path, active, sort_order').order('sort_order').order('name'),
      supabase.from('career_groups').select('id, name').order('sort_order'),
    ])
    if (b.error) return setError('Falta aplicar la migración 0036.')
    setBadges((b.data ?? []) as Badge[])
    setGroups((g.data ?? []) as Group[])
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
  const must = async (p: PromiseLike<{ error: { message: string } | null }>, msg: string) => {
    const { error: err } = await p
    if (err) throw new Error(/duplicate|unique/i.test(err.message) ? 'Ya existe una insignia con ese nombre.' : msg)
  }

  const add = (e: FormEvent) => {
    e.preventDefault()
    const key = slug(newName)
    if (!supabase || key.length < 2) return setError('El nombre necesita al menos 2 letras.')
    void run(async () => {
      await must(supabase!.from('badges').insert({ key, name: newName.trim(), group_id: newGroup || null, sort_order: badges.length + 1 }), 'No se pudo crear la insignia.')
      setNewName('')
      setNewGroup('')
    })
  }
  const patch = (b: Badge, p: Partial<Badge>, msg = 'No se pudo guardar la insignia.') => supabase && void run(() => must(supabase!.from('badges').update(p).eq('id', b.id), msg))
  const setImage = (b: Badge, file: File) =>
    supabase && void run(async () => {
      const path = await uploadBadge(file)
      const old = b.image_path
      await must(supabase!.from('badges').update({ image_path: path }).eq('id', b.id), 'No se pudo guardar la imagen.')
      await deletePhoto(old)
    })
  async function clearImage(b: Badge) {
    if (!supabase || !b.image_path) return
    if (!(await confirmDialog({ title: `¿Quitar la imagen de ${b.name}?`, message: BUILT_IN[b.key] ? 'Vuelve a verse el dibujo original.' : 'Queda sin imagen.', confirmLabel: 'Quitar imagen', tone: 'danger', icon: 'trash' }))) return
    const old = b.image_path
    void run(async () => {
      await must(supabase!.from('badges').update({ image_path: null }).eq('id', b.id), 'No se pudo quitar la imagen.')
      await deletePhoto(old)
    })
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Insignias</h1>
        </div>
        <p className="head-meta">Una insignia es el logo de un grupo de carreras. Son de todas las carreras y de todos los grupos; no son sellos.</p>
      </header>
      {error && <p className="error">{error}</p>}

      <div className="badge-grid">
        {badges.map((b) => (
          <BadgeCard key={b.id} b={b} groups={groups} busy={busy} onPatch={patch} onImage={setImage} onClear={clearImage} />
        ))}
        {badges.length === 0 && <p className="muted">Todavía no hay insignias.</p>}
      </div>

      <form className="card" onSubmit={add}>
        <h2>Crear una insignia</h2>
        <label className="inline-field">
          Nombre
          <input value={newName} maxLength={40} onChange={(e) => setNewName(e.target.value)} placeholder="Arquitectura" />
        </label>
        <label className="inline-field">
          Grupo de carreras
          <select value={newGroup} onChange={(e) => setNewGroup(e.target.value)}>
            <option value="">Sin grupo</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
        <p className="muted">Después le subes su imagen en su tarjeta.</p>
        <div className="row"><button disabled={busy || !newName.trim()}><Plus size={18} aria-hidden="true" /> Crear insignia</button></div>
      </form>
    </>
  )
}

function BadgeCard({ b, groups, busy, onPatch, onImage, onClear }: { b: Badge; groups: Group[]; busy: boolean; onPatch: (b: Badge, p: Partial<Badge>) => void; onImage: (b: Badge, f: File) => void; onClear: (b: Badge) => void }) {
  const [name, setName] = useState(b.name)
  const [description, setDescription] = useState(b.description ?? '')
  const url = photoUrl(b.image_path)
  const changed = name.trim() !== b.name || description.trim() !== (b.description ?? '')
  return (
    <section className={`card badge-card${b.active ? '' : ' off'}`}>
      <div className="badge-art">
        {url ? <img src={url} alt={`Insignia ${b.name}`} /> : BUILT_IN[b.key] ? <CareerPlate career={BUILT_IN[b.key]} size={120} /> : <span className="muted">Sin imagen</span>}
      </div>
      <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-label={`Nombre de la insignia ${b.name}`} />
      <input value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción" aria-label={`Descripción de ${b.name}`} />
      <select value={b.group_id ?? ''} disabled={busy} onChange={(e) => onPatch(b, { group_id: e.target.value || null })} aria-label={`Grupo de carreras de ${b.name}`}>
        <option value="">Sin grupo</option>
        {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>
      <div className="row">
        {changed && <button type="button" disabled={busy || !name.trim()} onClick={() => onPatch(b, { name: name.trim(), description: description.trim() || null })}>Guardar</button>}
        <label className={`btn-like${busy ? ' disabled' : ''}`}>
          <Upload size={16} aria-hidden="true" /> {b.image_path ? 'Cambiar imagen' : 'Subir imagen'}
          <input type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onImage(b, f) }} />
        </label>
        {b.image_path && <button type="button" className="ghost" disabled={busy} onClick={() => onClear(b)}>Quitar imagen</button>}
        <button type="button" className="ghost" disabled={busy} onClick={() => onPatch(b, { active: !b.active })}>{b.active ? 'Desactivar' : 'Activar'}</button>
      </div>
      <small className="muted">{b.active ? 'Disponible' : 'No disponible'}</small>
    </section>
  )
}
