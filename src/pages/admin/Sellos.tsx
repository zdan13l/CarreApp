import { Trash2, Upload } from 'lucide-react'
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { MythPicture } from '../../components/InkSeals'
import { hslToHex } from '../../lib/color'
import { confirmDialog } from '../../lib/dialog'
import { loadCustomSeals, pictureToInk, removeSeal, uploadSeal } from '../../lib/customSeals'
import { MYTH_SEALS, SEAL_ORDER, sealCount, sealOf, type CustomSealRow, type MythSeal } from '../../lib/seals'
import { supabase } from '../../lib/supabase'
import { photoUrl } from '../../lib/storage'

const CULTURES: Record<string, string> = { egipcia: 'Egipcia', nordica: 'Nórdica', griega: 'Griega', mexicana: 'Mexicana', china: 'China', otra: 'Otra' }

// One seal at its real size, in its own ink.
function SealFace({ seal, color }: { seal: MythSeal; color: string }) {
  return (
    <span className="seal-face" style={{ '--stamp-ink': color } as CSSProperties}>
      <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
        <g className="stamp-ink">
          <MythPicture seal={seal} />
        </g>
      </svg>
    </span>
  )
}

// The coordinator's place for the seals: the ones the app brings (each with its own colour) and the ones uploaded. A Carrera cannot have more
// bases than seals (migration 0034): to have more bases, upload more seals here first.
export default function Sellos() {
  const [custom, setCustom] = useState<CustomSealRow[]>([])
  const [bases, setBases] = useState<{ event: string; n: number }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [invert, setInvert] = useState(false)
  const [name, setName] = useState('')
  const [culture, setCulture] = useState('otra')
  const [color, setColor] = useState(() => hslToHex(170, 60, 35))
  const [story, setStory] = useState('')
  const [preview, setPreview] = useState<string | null>(null)

  const load = useCallback(async () => {
    setCustom(await loadCustomSeals())
    if (!supabase) return
    const [{ data: b }, { data: e }] = await Promise.all([supabase.from('bases').select('event_id'), supabase.from('events').select('id, name')])
    const names = new Map((e ?? []).map((x) => [x.id as string, x.name as string]))
    const count = new Map<string, number>()
    for (const r of b ?? []) count.set(r.event_id as string, (count.get(r.event_id as string) ?? 0) + 1)
    setBases([...count].map(([id, n]) => ({ event: names.get(id) ?? '—', n })).sort((x, y) => y.n - x.n))
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  // the converted picture, shown before uploading
  useEffect(() => {
    let url: string | null = null
    let cancelled = false
    if (!file) {
      setPreview(null)
      return
    }
    void pictureToInk(file, invert, 256)
      .then((blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setPreview(url)
      })
      .catch(() => setPreview(null))
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [file, invert])

  const capacity = sealCount()
  const most = bases[0]?.n ?? 0

  async function upload() {
    if (!file || !name.trim()) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const blob = await pictureToInk(file, invert)
      const err = await uploadSeal(blob, { name, culture, color, story })
      if (err) setError(err)
      else {
        setNotice(`Sello «${name.trim()}» agregado. Ya hay ${capacity + 1} sellos.`)
        setFile(null)
        setName('')
        setStory('')
        await load()
      }
    } catch {
      setError('No se pudo leer la imagen.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(row: CustomSealRow) {
    if (!(await confirmDialog({ title: `¿Borrar el sello «${row.name}»?`, message: 'Las bases que lo tenían reciben otro sello.', confirmLabel: 'Borrar sello', tone: 'danger', icon: 'trash' }))) return
    setError(null)
    const err = await removeSeal(row)
    if (err) setError(err)
    else await load()
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Preparación</p>
          <h1>Sellos</h1>
        </div>
        <p className="head-meta">Cada base lleva un sello distinto. Una carrera no puede tener más bases que sellos: para crear más bases, sube más sellos aquí.</p>
      </header>
      {error && <p className="error">{error}</p>}
      {notice && <p className="ok-box">{notice}</p>}

      <section className="card">
        <h2>
          {capacity} sellos <span className="muted">· hasta {capacity} bases por carrera</span>
        </h2>
        <p className="muted">
          {bases.length === 0
            ? 'Todavía no hay bases.'
            : `La carrera con más bases tiene ${most}${most >= capacity ? ': ya no caben más, sube sellos antes de crear otra base' : `, quedan ${capacity - most} sellos libres`}.`}
        </p>
        <div className="seal-grid">
          {SEAL_ORDER.map((k) => {
            const s = sealOf(k)
            return (
              <figure key={k} className="seal-item">
                <SealFace seal={s} color={`var(--seal-${s.key})`} />
                <figcaption>
                  <strong>{s.name}</strong>
                  <small>{CULTURES[s.culture]}</small>
                  <i className="swatch" style={{ background: `var(--seal-${s.key})` }} aria-hidden="true" />
                </figcaption>
              </figure>
            )
          })}
          {custom.map((r) => {
            const s: MythSeal = { key: r.id, name: r.name, story: r.story ?? '', culture: r.culture, frame: 'circle', file: photoUrl(r.path) ?? '', color: r.color }
            return (
              <figure key={r.id} className="seal-item custom">
                <SealFace seal={s} color={r.color} />
                <figcaption>
                  <strong>{r.name}</strong>
                  <small>{CULTURES[r.culture] ?? r.culture} · subido</small>
                  <i className="swatch" style={{ background: r.color }} aria-hidden="true" />
                </figcaption>
                <button type="button" className="ghost icon-btn danger" onClick={() => void remove(r)} aria-label={`Borrar el sello ${r.name}`} title="Borrar">
                  <Trash2 size={18} />
                </button>
              </figure>
            )
          })}
        </div>
        <p className="muted">{MYTH_SEALS.length} del sistema + {custom.length} subidos.</p>
      </section>

      <section className="card">
        <h2>Subir un sello</h2>
        <p className="muted">Sube un dibujo (mejor oscuro sobre fondo claro, o con fondo transparente, hasta 2 MB). La app lo convierte a tinta y lo imprime en el color que elijas.</p>
        <label className="inline-field">
          Imagen
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <label className="inline-field">
          <span>
            <input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} /> El dibujo es claro sobre fondo oscuro (invertir)
          </span>
        </label>
        <label className="inline-field">
          Nombre
          <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Colibrí" />
        </label>
        <label className="inline-field">
          Mitología
          <select value={culture} onChange={(e) => setCulture(e.target.value)}>
            {Object.entries(CULTURES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label className="inline-field">
          Color (distinto al de los demás sellos)
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
        <label className="inline-field">
          Qué es (opcional)
          <input value={story} maxLength={400} onChange={(e) => setStory(e.target.value)} placeholder="Una frase para el inductor de la base" />
        </label>
        {preview && (
          <span className="seal-face seal-preview" style={{ '--stamp-ink': color } as CSSProperties}>
            <span className="seal-mask" style={{ WebkitMaskImage: `url(${preview})`, maskImage: `url(${preview})` }} />
          </span>
        )}
        <div className="row">
          <button disabled={busy || !file || !name.trim()} onClick={() => void upload()}>
            <Upload size={18} aria-hidden="true" /> {busy ? 'Subiendo…' : 'Subir sello'}
          </button>
        </div>
      </section>
    </>
  )
}
