import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCatalogVersion } from '../lib/catalogStore'
import type { EventSeal, SealKind } from '../lib/eventSeals'
import { loadElementsAndSeals, sectionOf, workshopLink, type SealElement, type SealEvent } from '../lib/sealElements'
import ElementSeal, { sealNote } from './ElementSeal'

// The seals of ONE section of ONE carrera, read only: only the ones that belong here (the groups page shows the groups' seals, the committees page
// the committees' ones…). They are not made here: each one has a link to the workshop (Administración global → Sellos), which is the only place
// where seals are created and changed.
export default function SectionSeals({ event, kinds, title }: { event: SealEvent; kinds: SealKind[]; title?: string }) {
  useCatalogVersion()
  const [elements, setElements] = useState<SealElement[]>([])
  const [seals, setSeals] = useState<EventSeal[]>([])
  const wanted = kinds.join(',')
  const { id, term_id, coordinator_id } = event
  const load = useCallback(async () => {
    const r = await loadElementsAndSeals({ id, term_id, coordinator_id })
    setElements(r.elements.filter((e) => wanted.split(',').includes(e.kind)))
    setSeals(r.seals)
  }, [id, term_id, coordinator_id, wanted])
  useEffect(() => {
    void load()
  }, [load])

  return (
    <section className="card section-seals">
      <h2>{title ?? 'Sellos de esta sección'} <span className="muted">· {elements.length}</span></h2>
      <p className="muted">Aquí solo se ven. Los sellos se crean y se cambian en el <Link to={workshopLink(kinds[0], event.id)}>taller de sellos</Link> (Administración global).</p>
      {elements.length === 0 && <p className="muted">Nada que sellar todavía.</p>}
      <ul className="seal-rows">
        {elements.map((e) => {
          const seal = seals.find((s) => s.kind === e.kind && s.ref === e.ref)
          return (
            <li key={`${e.kind}:${e.ref}`}>
              <div className="seal-row">
                <ElementSeal element={e} seal={seal} size={52} />
                <div className="grow">
                  <strong>{e.name}</strong>
                  <small className="muted">{sectionOf(e.kind)?.one ?? 'coordi'} · {sealNote(e, seal)}</small>
                </div>
                {e.kind !== 'coordinator' && <Link className="btn-like" to={workshopLink(e.kind, event.id, e.ref)}>{seal ? 'Cambiar en el taller' : 'Crear en el taller'}</Link>}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
