import { Upload } from 'lucide-react'
import CustomSealsManager from '../../components/CustomSealsManager'
import { useCallback, useEffect, useState } from 'react'
import CommitteeSeal from '../../components/CommitteeSeal'
import EventSealView from '../../components/EventSealView'
import { CultureSeal } from '../../components/Seals'
import Stamp from '../../components/Stamp'
import { useCatalogVersion } from '../../lib/catalogStore'
import { hslToHex } from '../../lib/color'
import { allCommittees } from '../../lib/committees'
import { pictureToInk } from '../../lib/customSeals'
import { imageUrl, loadEventSeals, removeEventSeal, saveEventSeal, SHAPES, SHAPE_LABEL, type EventSeal, type SealKind, type SealShape } from '../../lib/eventSeals'
import { supabase } from '../../lib/supabase'
import { errMsg, useAdmin } from './AdminContext'

interface Element { kind: SealKind; ref: string; name: string; theme?: string }

// The seals of THIS carrera, in one place: the theme, each subtheme, each group, each committee and the golden seal of the coordi. Pick the shape,
// the colour and a picture (it is turned into ink), see it before saving. Inside a carrera two elements of the same kind never share a design, and
// nothing is reused from other carreras.
export default function CarreraSellos() {
  useCatalogVersion()
  const { event } = useAdmin()
  const [elements, setElements] = useState<Element[]>([])
  const [seals, setSeals] = useState<EventSeal[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)

  const eventId = event?.id
  const termId = event?.term_id
  const load = useCallback(async () => {
    if (!supabase || !eventId) return
    const probe = await supabase.from('event_seals').select('id', { count: 'exact', head: true }).eq('event_id', eventId)
    if (probe.error) return setMissing(true)
    const [th, tm, ec, ppl, bs] = await Promise.all([
      termId ? supabase.from('themes').select('key, name').eq('term_id', termId).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from('teams').select('id, name').eq('event_id', eventId).order('sort_order'),
      supabase.from('event_committees').select('committee_key').eq('event_id', eventId),
      event?.coordinator_id ? supabase.from('passports').select('id, full_name').eq('id', event.coordinator_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from('bases').select('id, name').eq('event_id', eventId).order('sort_order'),
    ])
    const out: Element[] = []
    const theme = th.data as { key: string; name: string } | null
    if (theme) {
      out.push({ kind: 'theme', ref: theme.key, name: theme.name })
      const cu = await supabase.from('theme_cultures').select('key, name').eq('theme_key', theme.key).order('sort_order')
      for (const c of cu.data ?? []) out.push({ kind: 'subtheme', ref: c.key as string, name: c.name as string, theme: theme.key })
    }
    for (const t of tm.data ?? []) out.push({ kind: 'team', ref: t.id as string, name: t.name as string })
    for (const b of bs.data ?? []) out.push({ kind: 'base', ref: b.id as string, name: b.name as string })
    const names = new Map(allCommittees().map((c) => [c.key, c.name]))
    for (const c of ec.data ?? []) out.push({ kind: 'committee', ref: c.committee_key as string, name: names.get(c.committee_key as string) ?? (c.committee_key as string) })
    const coordi = ppl.data as { id: string; full_name: string } | null
    out.push({ kind: 'coordinator', ref: coordi?.id ?? 'sin-coordi', name: coordi ? `Coordi: ${coordi.full_name}` : 'Coordi de la carrera' })
    setElements(out)
    setSeals(await loadEventSeals(eventId))
  }, [eventId, termId, event?.coordinator_id])
  useEffect(() => {
    void load()
  }, [load])

  if (!event) return null
  if (missing) return <p className="warn">Falta aplicar la migración 0037 (sellos propios de cada carrera).</p>
  const locked = event.phase === 'archived'
  const sealOf = (e: Element) => seals.find((s) => s.kind === e.kind && s.ref === e.ref)
  const groups: { title: string; kind: SealKind; rule: string }[] = [
    { title: 'Temática', kind: 'theme', rule: 'Cada temática tiene un sello único.' },
    { title: 'Subtemáticas', kind: 'subtheme', rule: 'Cada subtemática tiene su propio sello, distinto al de las demás.' },
    { title: 'Bases', kind: 'base', rule: 'Cada base de esta carrera tiene su sello. Los de siempre (los 15 de la app) son los de la 2710: edítalos aquí para cambiar su forma, color o imagen solo en esta carrera.' },
    { title: 'Grupos', kind: 'team', rule: 'Cada grupo participante tiene un sello único dentro de esta carrera.' },
    { title: 'Comités', kind: 'committee', rule: 'Cada comité tiene un sello propio para esta carrera, sin repetirse.' },
    { title: 'Coordi', kind: 'coordinator', rule: 'El coordi de la carrera siempre tiene el sello dorado: se pone solo al elegir al coordi (Coordi y comités).' },
  ]
  const missingCount = elements.filter((e) => (e.kind === 'theme' || e.kind === 'team') && !sealOf(e)).length

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Esta carrera</p>
          <h1>Sellos</h1>
        </div>
        <p className="head-meta">Los sellos son propios de cada carrera y no se reutilizan entre ediciones. Las insignias (global) son otra cosa.</p>
      </header>
      {error && <p className="error">{error}</p>}
      {missingCount > 0 && <p className="warn">{missingCount} {missingCount === 1 ? 'elemento sin sello' : 'elementos sin sello'}.</p>}

      {groups.map((g) => {
        const list = elements.filter((e) => e.kind === g.kind)
        return (
          <section key={g.kind} className="card">
            <h2>{g.title} <span className="muted">· {list.length}</span></h2>
            <p className="muted">{g.rule}</p>
            {list.length === 0 && <p className="muted">Nada que sellar todavía.</p>}
            <ul className="seal-rows">
              {list.map((e, i) => {
                const seal = sealOf(e)
                const key = `${e.kind}:${e.ref}`
                return (
                  <li key={key}>
                    <div className="seal-row">
                      {seal || e.kind === 'theme' || e.kind === 'team' || e.kind === 'coordinator' ? (
                        <EventSealView shape={seal?.shape ?? 'circle'} color={seal?.color ?? 'currentColor'} imageUrl={imageUrl(seal?.image_path ?? null)} initial={e.name} gold={e.kind === 'coordinator'} size={64} label={`Sello de ${e.name}`} />
                      ) : e.kind === 'subtheme' && e.theme ? (
                        <CultureSeal culture={e.ref} theme={e.theme} top={e.name.toUpperCase()} bottom="DE SIEMPRE" size={64} tilt={0} />
                      ) : e.kind === 'committee' ? (
                        <CommitteeSeal committee={e.ref} size={64} />
                      ) : (
                        <Stamp seed={e.ref} name={e.name} round={0} state="stamped" size={64} straight />
                      )}
                      <div className="grow">
                        <strong>{e.name}</strong>
                        <small className="muted">{seal ? `${SHAPE_LABEL[seal.shape]}${e.kind === 'coordinator' ? ' · dorado' : ` · ${seal.color}`}` : e.kind === 'coordinator' ? 'Se crea al elegir al coordi' : e.kind === 'subtheme' || e.kind === 'committee' || e.kind === 'base' ? 'Sello de siempre: se puede editar' : 'Sin sello'}</small>
                      </div>
                      {e.kind !== 'coordinator' && (
                        <button type="button" className="ghost" disabled={locked} onClick={() => setOpen(open === key ? null : key)}>{seal ? 'Editar sello' : e.kind === 'subtheme' || e.kind === 'committee' || e.kind === 'base' ? 'Editar el de siempre' : 'Crear sello'}</button>
                      )}
                    </div>
                    {open === key && e.kind !== 'coordinator' && (
                      <SealEditor
                        key={key}
                        eventId={event.id}
                        element={e}
                        seal={seal}
                        others={seals.filter((s) => s.kind === e.kind && s.ref !== e.ref)}
                        defaultColor={hslToHex((i * 47 + 20) % 360, 62, 40)}
                        onDone={async (msg) => {
                          setError(msg)
                          if (!msg) setOpen(null)
                          await load()
                        }}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
      {!locked && event && <CustomSealsManager eventId={event.id} />}
    </>
  )
}

function SealEditor({ eventId, element, seal, others, defaultColor, onDone }: { eventId: string; element: Element; seal?: EventSeal; others: EventSeal[]; defaultColor: string; onDone: (error: string | null) => Promise<void> }) {
  const [shape, setShape] = useState<SealShape>(seal?.shape ?? 'circle')
  const [color, setColor] = useState(seal?.color ?? defaultColor)
  const [file, setFile] = useState<File | null>(null)
  const [invert, setInvert] = useState(false)
  const [removeImage, setRemoveImage] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // the converted picture, shown before saving
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

  const shownImage = preview ?? (removeImage ? null : imageUrl(seal?.image_path ?? null))
  const keepsImage = !file && !removeImage ? (seal?.image_path ?? null) : null
  const duplicate = others.find((o) => o.shape === shape && o.color.toLowerCase() === color.toLowerCase() && (o.image_path ?? '') === (file ? '\0new' : (keepsImage ?? '')))

  async function save() {
    setBusy(true)
    setMsg(null)
    try {
      const image = file ? { blob: await pictureToInk(file, invert) } : removeImage ? ('remove' as const) : ('keep' as const)
      const err = await saveEventSeal(seal, { event_id: eventId, kind: element.kind, ref: element.ref, shape, color }, image)
      if (err) setMsg(err)
      await onDone(err)
    } catch (e) {
      setMsg(errMsg(e))
    } finally {
      setBusy(false)
    }
  }
  async function clear() {
    if (!seal) return
    setBusy(true)
    const err = await removeEventSeal(seal)
    setBusy(false)
    await onDone(err)
  }

  return (
    <div className="seal-editor">
      <EventSealView shape={shape} color={color} imageUrl={shownImage} initial={element.name} size={132} label="Previsualización del sello" />
      <div className="seal-fields">
        <label className="inline-field">
          Forma
          <select value={shape} onChange={(e) => setShape(e.target.value as SealShape)}>
            {SHAPES.map((s) => <option key={s} value={s}>{SHAPE_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="inline-field">
          Color
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
        <label className="btn-like">
          <Upload size={16} aria-hidden="true" /> {file ? file.name : seal?.image_path ? 'Cambiar imagen' : 'Subir imagen'}
          <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRemoveImage(false) }} />
        </label>
        {(file || seal?.image_path) && (
          <>
            <label className="inline-field"><span><input type="checkbox" checked={invert} onChange={(e) => setInvert(e.target.checked)} /> Dibujo claro sobre fondo oscuro (invertir)</span></label>
            <button type="button" className="ghost" onClick={() => { setFile(null); setRemoveImage(true) }}>Quitar imagen</button>
          </>
        )}
        {duplicate && <p className="warn">Otro elemento de este tipo ya usa este diseño: cambia la forma, el color o la imagen.</p>}
        {msg && <p className="error">{msg}</p>}
        <div className="row">
          <button disabled={busy || Boolean(duplicate)} onClick={() => void save()}>{busy ? 'Guardando…' : 'Guardar sello'}</button>
          {seal && <button type="button" className="ghost danger" disabled={busy} onClick={() => void clear()}>Quitar sello</button>}
        </div>
      </div>
    </div>
  )
}
