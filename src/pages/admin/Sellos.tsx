import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import CustomSealsManager from '../../components/CustomSealsManager'
import ElementSeal, { sealNote } from '../../components/ElementSeal'
import GenerationSeals from '../../components/GenerationSeal'
import SealEditor, { type SealDesign, type SealImage } from '../../components/SealEditor'
import GroupSeal from '../../components/GroupSeal'
import { loadCatalog } from '../../lib/catalog'
import { useCatalogVersion } from '../../lib/catalogStore'
import { hslToHex } from '../../lib/color'
import { toneOf } from '../../lib/groupTone'
import { imageUrl, removeEventSeal, saveEventSeal, type EventSeal, type SealShape } from '../../lib/eventSeals'
import { loadGenerationRows, resetGenerationSeal, saveGenerationSeal } from '../../lib/generations'
import { loadElementsAndSeals, SECTIONS, sectionOf, type SealElement, type SealSection } from '../../lib/sealElements'
import type { GenerationRow } from '../../lib/seals'
import { photoUrl } from '../../lib/storage'
import { supabase } from '../../lib/supabase'

interface EventOption {
  id: string
  name: string
  code: string | null
  is_test: boolean
  term_id: string | null
  coordinator_id: string | null
  phase: string
}

const eventLabel = (e: EventOption) => (e.is_test ? 'Carrera de prueba' : `${e.code ?? ''} ${e.name}`.trim())

// GLOBAL — the SEAL WORKSHOP: the only place where seals are created and changed. A seal is made FOR something: a generation, a theme, a
// subtheme, a group, a base or a committee. Everything except the generations belongs to ONE inducción (carrera): you choose which one, and the
// seal is only valid there (the database refuses it for an element of another carrera). The sections of the panel (Temática, Grupos, Bases,
// Coordi y comités, Generaciones) only SHOW the seals that belong to them.
export default function Sellos() {
  useCatalogVersion()
  const [params, setParams] = useSearchParams()
  const kind = (SECTIONS.some((s) => s.kind === params.get('kind')) ? params.get('kind') : 'generation') as SealSection
  const section = sectionOf(kind)!
  const eventId = params.get('event')
  const [events, setEvents] = useState<EventOption[]>([])
  const [elements, setElements] = useState<SealElement[]>([])
  const [seals, setSeals] = useState<EventSeal[]>([])
  const [generations, setGenerations] = useState<GenerationRow[]>([])
  const [groups, setGroups] = useState<{ id: string; name: string; badge: { key: string; image_path: string | null } | null }[]>([])
  const [open, setOpen] = useState<string | null>(params.get('ref'))
  const [error, setError] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)

  const event = useMemo(() => (section.perCarrera ? (events.find((e) => e.id === eventId) ?? null) : null), [events, eventId, section.perCarrera])

  const loadEvents = useCallback(async () => {
    if (!supabase) return
    const full = await supabase.from('events').select('id, name, code, is_test, term_id, coordinator_id, phase').order('created_at', { ascending: false })
    const rows = full.error ? null : ((full.data ?? []) as EventOption[])
    setEvents(rows ?? [])
    const gen = await loadGenerationRows()
    if (gen) setGenerations(gen)
    const [g, b] = await Promise.all([supabase.from('career_groups').select('id, name').order('sort_order'), supabase.from('badges').select('key, group_id, image_path').eq('active', true)])
    const badges = (b.error ? [] : (b.data ?? [])) as { key: string; group_id: string | null; image_path: string | null }[]
    setGroups(((g.data ?? []) as { id: string; name: string }[]).map((x) => ({ ...x, badge: badges.find((y) => y.group_id === x.id) ?? null })))
  }, [])
  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  const loadSection = useCallback(async () => {
    if (!supabase || !event) {
      setElements([])
      setSeals([])
      return
    }
    const probe = await supabase.from('event_seals').select('id', { count: 'exact', head: true }).eq('event_id', event.id)
    if (probe.error) return setMissing(true)
    const r = await loadElementsAndSeals(event)
    setElements(r.elements.filter((e) => e.kind === kind))
    setSeals(r.seals)
  }, [event, kind])
  useEffect(() => {
    void loadSection()
  }, [loadSection])

  const go = (next: Record<string, string | null>) => {
    const q = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) (v === null ? q.delete(k) : q.set(k, v))
    setParams(q, { replace: true })
  }
  const pickKind = (k: SealSection) => {
    setOpen(null)
    setError(null)
    go({ kind: k, ref: null })
  }
  async function refresh() {
    await loadEvents()
    await loadSection()
    await loadCatalog() // the passports and the screens read the seals from the catalog
  }
  const finish = async (err: string | null) => {
    setError(err)
    if (!err) setOpen(null)
    await refresh()
  }

  if (missing) return <p className="warn">Falta aplicar la migración 0037 (sellos propios de cada carrera).</p>
  const locked = event?.phase === 'archived'

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Sellos</h1>
        </div>
        <p className="head-meta">El taller: aquí se crean y se cambian todos los sellos. Cada sello se hace para algo (una generación, una temática, un comité…) y, salvo las generaciones, para una inducción en especial.</p>
      </header>
      {error && <p className="error">{error}</p>}

      <section className="card">
        <h2>¿Para qué es el sello?</h2>
        <div className="chips" role="tablist" aria-label="Sección del sello">
          {SECTIONS.map((s) => (
            <button key={s.kind} type="button" role="tab" aria-selected={s.kind === kind} className={`chip-btn${s.kind === kind ? ' active' : ''}`} onClick={() => pickKind(s.kind)}>{s.title}</button>
          ))}
        </div>
        <p className="muted">{section.rule}</p>
        {section.perCarrera && (
          <label className="inline-field">
            Inducción (carrera) a la que pertenece
            <select value={eventId ?? ''} onChange={(e) => { setOpen(null); go({ event: e.target.value || null, ref: null }) }} aria-label="Inducción a la que pertenece el sello">
              <option value="">Elige la inducción…</option>
              {events.map((e) => <option key={e.id} value={e.id}>{eventLabel(e)}</option>)}
            </select>
          </label>
        )}
      </section>

      {kind === 'generation' ? (
        <section className="card">
          <h2>Generaciones <span className="muted">· {generations.length}</span></h2>
          <ul className="seal-rows">
            {generations.map((g, i) => {
              const design: SealDesign | null = g.shape && g.color ? { shape: g.shape as SealShape, color: g.color, imagePath: g.image_path, imageUrl: g.image_path ? photoUrl(g.image_path) : null } : null
              return (
                <li key={g.key}>
                  <div className="seal-row">
                    <span className="gen-seal"><GenerationSeals generation={g.name} size={64} /></span>
                    <div className="grow">
                      <strong>{g.name}</strong>
                      <small className="muted">{g.term ? `entró en ${g.term} · ` : ''}{g.shape ? 'sello editado' : g.kind ? 'sello de siempre' : 'sin sello todavía'}</small>
                    </div>
                    <button type="button" className="ghost" onClick={() => setOpen(open === g.key ? null : g.key)} aria-expanded={open === g.key}>{g.shape ? 'Editar sello' : g.kind ? 'Editar el de siempre' : 'Crear sello'}</button>
                  </div>
                  {open === g.key && (
                    <SealEditor
                      key={g.key}
                      name={g.name}
                      design={design}
                      fallbackImage={g.source_file}
                      defaultColor={hslToHex((i * 53 + 15) % 360, 62, 40)}
                      resetLabel="Volver al de siempre"
                      onReset={g.shape ? async () => { const err = await resetGenerationSeal(g); await finish(err); return err } : undefined}
                      onSave={async (shape, color, image: SealImage) => { const err = await saveGenerationSeal(g, { shape, color }, image); await finish(err); return err }}
                    />
                  )}
                </li>
              )
            })}
          </ul>
          <p className="muted">Para agregar una generación nueva o corregir su semestre, ve a <Link to="/admin/generaciones">Generaciones</Link>.</p>
        </section>
      ) : kind === 'group' ? (
        <section className="card">
          <h2>Grupos de carreras <span className="muted">· {groups.length}</span></h2>
          <ul className="seal-rows">
            {groups.map((g) => {
              const tone = toneOf(groups, g)
              return (
                <li key={g.id}>
                  <div className={`seal-row${tone.className ? ` ${tone.className}` : ''}`} style={tone.style}>
                    <GroupSeal groupKey={g.badge?.key} imageUrl={g.badge?.image_path ? photoUrl(g.badge.image_path) : null} initial={g.name} color="var(--accent, var(--gold))" size={64} label={`Sello de ${g.name}`} />
                    <div className="grow">
                      <strong>{g.name}</strong>
                      <small className="muted">{g.badge ? 'el icono central de su insignia, en el color del grupo' : 'su inicial, hasta que tenga insignia'}</small>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="muted">El sello sale de la insignia de cada grupo (crea o cambia las insignias en <Link to="/admin/insignias">Insignias</Link>) y su color es el del grupo en <Link to="/admin/programas">Carreras y temáticas</Link>.</p>
        </section>
      ) : !event ? (
        <p className="warn">Elige la inducción: el sello de {section.one === 'comité' ? 'un comité' : `${section.one === 'base' || section.one === 'temática' ? 'una' : 'un'} ${section.one}`} siempre está ligado a una carrera en especial.</p>
      ) : (
        <>
          {locked && <p className="warn">Esta carrera está finalizada (solo lectura): sus sellos no se cambian.</p>}
          <section className="card">
            <h2>{section.title} de {eventLabel(event)} <span className="muted">· {elements.length}</span></h2>
            {elements.length === 0 && <p className="muted">Esta carrera no tiene {section.title.toLowerCase()} todavía{kind === 'base' ? ' (créalas en Bases)' : kind === 'committee' ? ' (elígelos en Coordi y comités)' : ''}.</p>}
            <ul className="seal-rows">
              {elements.map((e, i) => {
                const seal = seals.find((s) => s.kind === e.kind && s.ref === e.ref)
                const key = e.ref
                const design: SealDesign | null = seal ? { shape: seal.shape, color: seal.color, imagePath: seal.image_path, imageUrl: imageUrl(seal.image_path) } : null
                const hasDefault = e.kind === 'subtheme' || e.kind === 'committee' || e.kind === 'base'
                return (
                  <li key={key}>
                    <div className="seal-row">
                      <ElementSeal element={e} seal={seal} size={64} />
                      <div className="grow">
                        <strong>{e.name}</strong>
                        <small className="muted">{sealNote(e, seal)}</small>
                      </div>
                      <button type="button" className="ghost" disabled={locked} onClick={() => setOpen(open === key ? null : key)} aria-expanded={open === key}>{seal ? 'Editar sello' : hasDefault ? 'Editar el de siempre' : 'Crear sello'}</button>
                    </div>
                    {open === key && (
                      <SealEditor
                        key={key}
                        name={e.name}
                        design={design}
                        defaultColor={hslToHex((i * 47 + 20) % 360, 62, 40)}
                        others={seals.filter((s) => s.kind === e.kind && s.ref !== e.ref)}
                        resetLabel={hasDefault ? 'Volver al de siempre' : 'Quitar sello'}
                        onReset={seal ? async () => { const err = await removeEventSeal(seal); await finish(err); return err } : undefined}
                        onSave={async (shape, color, image: SealImage) => {
                          const err = await saveEventSeal(seal, { event_id: event.id, kind: e.kind, ref: e.ref, shape, color }, image)
                          await finish(err)
                          return err
                        }}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
          {kind === 'base' && !locked && <CustomSealsManager eventId={event.id} />}
        </>
      )}
    </>
  )
}
