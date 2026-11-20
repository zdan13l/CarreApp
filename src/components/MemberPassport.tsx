import { Star } from 'lucide-react'
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { airportCode } from '../lib/flight'
import {
  PASSPORT_ROLE_LONG,
  type PassportContextRow,
  type PassportPerson,
  type PassportRecordRow,
  type PassportRole,
  type PassportStampRow,
  type TermRow,
} from '../lib/passports'
import { useScrollLock } from '../lib/scrollLock'
import { mrzText, stampTime } from '../lib/stamp'
import { cultureOf, themeOf, type CultureKey } from '../lib/themes'
import Avatar from './Avatar'
import CultureEmblem, { CultureOrnament } from './CultureEmblem'
import Mrz from './Mrz'
import Stamp from './Stamp'

// The personal passport of an inductor: a cover that opens, an identity page, the stamp pages of the semester and the history of
// every semester. There are three versions of the same booklet:
//   runner       a traveller: the group they run with, and a stamp for every base their group finished
//   base         a visa counter: the base they staff, and a stamp for every match finished at their base
//   coordinator  a control tower (always dark): the Carreras they coordinated, one stamp each
// The culture of their career (the theme of the semester assigns one to each career) decides the colour, the border of the
// pages and the emblem of the cover. Everything is read from what the database already stores; nothing here is invented.
export interface MemberRecord extends PassportRecordRow {
  term: TermRow
}

export interface MemberPassportData {
  person: PassportPerson
  records: MemberRecord[] // the semester that is open first
  stamps: PassportStampRow[] // the ones kept for ever plus the ones of the Carrera that is running
  context: PassportContextRow[]
}

const PER_PAGE = 4

const COVER: Record<PassportRole, { kicker: string; sub: string }> = {
  runner: { kicker: 'Corredor', sub: 'Viajero de la Carrera' },
  base: { kicker: 'Inductor de base', sub: 'Mostrador de visados' },
  coordinator: { kicker: 'Coordinación', sub: 'Torre de control' },
}
const STAMP_WORD: Record<PassportRole, { one: string; many: string; verb: string }> = {
  runner: { one: 'base visitada', many: 'bases visitadas', verb: 'Visitaste' },
  base: { one: 'cruce atendido', many: 'cruces atendidos', verb: 'Atendiste' },
  coordinator: { one: 'Carrera coordinada', many: 'Carreras coordinadas', verb: 'Coordinaste' },
}

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** "PUJ-20262-4821": the number of the passport in a semester (only decorative, derived from the ids). */
export function documentNumber(personId: string, termName: string): string {
  return `PUJ-${termName.replace(/[^A-Za-z0-9]/g, '')}-${String(hash(personId + termName) % 10000).padStart(4, '0')}`
}

type Slot =
  | { key: string; kind: 'entry'; term: string; culture: CultureKey; theme: string }
  | { key: string; kind: 'coordinated'; event: string; culture: CultureKey; theme: string; at: string }
  | { key: string; kind: 'stamp'; stamp: PassportStampRow }

function slotsOf(record: MemberRecord, stamps: PassportStampRow[], records: MemberRecord[]): Slot[] {
  const culture = cultureOf(record.term.theme, record.culture).key
  // a coordinator's stamps are the Carreras they closed, in every semester; the others' are those of the open semester
  const mine = stamps
    .filter((s) => (record.role === 'coordinator' ? s.kind === 'coordinated' : s.record_id === record.id))
    .sort((a, b) => a.stamped_at.localeCompare(b.stamped_at) || a.round_number - b.round_number)
  return [
    { key: `entry-${record.id}`, kind: 'entry', term: record.term.name, culture, theme: record.term.theme },
    ...mine.map<Slot>((s) => {
      const of = records.find((r) => r.id === s.record_id) ?? record
      return s.kind === 'coordinated'
        ? { key: `${s.record_id}-${s.event_id ?? s.event_name}`, kind: 'coordinated', event: s.event_name, culture: cultureOf(of.term.theme, of.culture).key, theme: of.term.theme, at: s.stamped_at }
        : { key: `${record.id}-${s.event_id ?? s.event_name}-${s.kind}-${s.round_number}`, kind: 'stamp', stamp: s }
    }),
  ]
}

/** A round stamp of the culture: its emblem in the middle and the text on the rings. */
export function CultureSeal({ culture, theme, top, bottom, size = 108, tilt = -4 }: { culture: CultureKey; theme: string; top: string; bottom: string; size?: number; tilt?: number }) {
  const uid = useId().replace(/:/g, '')
  const c = cultureOf(theme, culture)
  return (
    <span className={`seal culture-${c.key}`} style={{ width: size, height: size, transform: `rotate(${tilt}deg)` }} role="img" aria-label={`${top}, ${bottom}`}>
      <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
        <defs>
          <filter id={`sw${uid}`} x="-2%" y="-2%" width="104%" height="104%">
            <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed={hash(top) % 90} result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  13 0 0 0 -3.6" result="s" />
            <feComposite in="SourceGraphic" in2="s" operator="in" />
          </filter>
          <path id={`st${uid}`} d="M19 50 A31 31 0 0 1 81 50" fill="none" />
          <path id={`sb${uid}`} d="M13 50 A37 37 0 0 0 87 50" fill="none" />
        </defs>
        <g filter={`url(#sw${uid})`} className="seal-ink">
          <circle cx="50" cy="50" r="47" fill="none" strokeWidth="3" />
          <circle cx="50" cy="50" r="41.4" fill="none" strokeWidth="1" />
          <circle cx="50" cy="50" r="26" fill="none" strokeWidth="1" />
          <text fontSize="6.6" fontWeight="800" letterSpacing=".8" textAnchor="middle" stroke="none" className="stamp-text">
            <textPath href={`#st${uid}`} startOffset="50%">{top.toUpperCase()}</textPath>
          </text>
          <text fontSize="6" fontWeight="700" letterSpacing=".6" textAnchor="middle" stroke="none" className="stamp-mono">
            <textPath href={`#sb${uid}`} startOffset="50%">{bottom.toUpperCase()}</textPath>
          </text>
          <g transform="translate(50 50) scale(.46) translate(-50 -50)" className="seal-emblem">
            <CultureEmblem culture={c.key} size={100} className="inner" />
          </g>
        </g>
      </svg>
    </span>
  )
}

export default function MemberPassport({ data, startOpen = false, startPage = 0 }: { data: MemberPassportData; startOpen?: boolean; startPage?: number }) {
  const { person, records, stamps, context } = data
  const [phase, setPhase] = useState<'closed' | 'opening' | 'open'>(startOpen ? 'open' : 'closed')
  const [page, setPage] = useState(startPage)
  const [dir, setDir] = useState<'next' | 'prev'>('next')
  const [zoom, setZoom] = useState<Slot | null>(null)
  const swipe = useRef<number | null>(null)
  useScrollLock(zoom !== null)

  useEffect(() => {
    if (phase === 'opening') {
      const t = window.setTimeout(() => setPhase('open'), 1050)
      return () => window.clearTimeout(t)
    }
  }, [phase])

  const now = records[0]
  if (!now) return <p className="muted">Todavía no tienes un registro en ningún semestre. Avísale al coordinador.</p>
  const theme = themeOf(now.term.theme)
  const culture = cultureOf(now.term.theme, now.culture)
  const ctx = context.find((c) => c.record_id === now.id)
  const slots = slotsOf(now, stamps, records)
  const earned = slots.filter((s) => s.kind !== 'entry').length
  const stampPages = Math.max(1, Math.ceil(slots.length / PER_PAGE))
  const pages = 1 + stampPages + 1
  const doc = documentNumber(person.id, now.term.name)
  const role = now.role
  const word = STAMP_WORD[role]
  const style = { '--culture-ink': `var(--ink-${culture.ink})` } as CSSProperties

  const go = (to: number) => {
    const next = Math.min(Math.max(to, 0), pages - 1)
    if (next === page) return
    setDir(next > page ? 'next' : 'prev')
    setPage(next)
    setZoom(null)
  }

  const rows: [string, string, boolean?][] = [
    ['Carrera', now.career],
    ['Cultura', `${culture.name} · ${theme.name}`],
    ['Papel', PASSPORT_ROLE_LONG[role]],
    ...(role === 'runner' ? ([['Grupo', ctx?.team_name ?? 'Sin grupo todavía'], ['Con quién corres', ctx?.partners?.length ? ctx.partners.join(' y ') : ctx?.team_name ? 'Todavía nadie más' : '—']] as [string, string][]) : []),
    ...(role === 'base' ? ([['Base', ctx?.base_name ?? 'Sin base todavía']] as [string, string][]) : []),
    ...(role === 'coordinator' ? ([['Carrera del semestre', ctx?.event_name ?? 'Sin Carrera todavía']] as [string, string][]) : []),
    ['Usuario', `@${person.username}`, true],
    ['Documento', doc, true],
  ]

  const pageSlots = page >= 1 && page <= stampPages ? slots.slice((page - 1) * PER_PAGE, page * PER_PAGE) : []

  return (
    <section className={`booklet member role-${role} culture-${culture.key}`} style={style} aria-label={`Pasaporte de ${person.full_name}`}>
      <div
        className="leaf-wrap"
        onPointerDown={(e) => {
          swipe.current = e.clientX
        }}
        onPointerCancel={() => {
          swipe.current = null
        }}
        onPointerUp={(e) => {
          if (swipe.current === null) return
          const dx = e.clientX - swipe.current
          swipe.current = null
          if (Math.abs(dx) > 60) go(page + (dx < 0 ? 1 : -1))
        }}
      >
        <article key={page} className={`leaf ${dir === 'next' ? 'turn-next' : 'turn-prev'}`}>
          <CultureOrnament culture={culture.key} />
          {page === 0 && (
            <>
              <header className="leaf-head member-head">
                <CultureEmblem culture={culture.key} size={62} className="head-emblem" />
                <div className="grow">
                  <p className="doc-kicker">{COVER[role].kicker} · {now.term.name}</p>
                  <h2 className="leaf-title">{person.full_name}</h2>
                </div>
              </header>
              <div className="leaf-body">
                <div className="member-id">
                  <figure className="member-photo">
                    <Avatar name={person.full_name} photoPath={person.photo_path} size={132} />
                    <figcaption className="mono">{culture.name}</figcaption>
                  </figure>
                  <div className="member-visa">
                    <CultureSeal culture={culture.key} theme={now.term.theme} top="Visado de entrada" bottom={`${now.term.name} · ${theme.name}`} size={124} />
                  </div>
                </div>
                <dl className="member-grid">
                  {rows.map(([k, v, mono]) => (
                    <div key={k} className={mono ? 'wide' : undefined}>
                      <dt>{k}</dt>
                      <dd className={mono ? 'mono' : undefined}>{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="member-myth">{culture.myth}.</p>
                <div className="member-stats">
                  <p><b className="num">{earned}</b><span>{earned === 1 ? word.one : word.many}</span></p>
                  <p><b className="num">{records.length}</b><span>{records.length === 1 ? 'semestre' : 'semestres'}</span></p>
                  {ctx?.event_active && <p className="live"><b className="num"><i aria-hidden="true" /></b><span>Carrera en curso</span></p>}
                </div>
              </div>
            </>
          )}
          {page >= 1 && page <= stampPages && (
            <>
              <header className="leaf-head">
                <div className="grow">
                  <p className="doc-kicker">Sellos · {now.term.name}</p>
                  <h2 className="leaf-title">Página {page + 1}</h2>
                </div>
                <p className="stamp-total" aria-label={`${earned} ${earned === 1 ? word.one : word.many}`}>
                  <b className="num">{earned}</b>
                  <span>{earned === 1 ? word.one : word.many}</span>
                </p>
              </header>
              <div className="leaf-body">
                <ul className="slots">
                  {Array.from({ length: PER_PAGE }, (_, i) => pageSlots[i] ?? null).map((s, i) => (
                    <li key={s?.key ?? `empty${i}`} className={`slot ${s ? 'done' : 'rest'}`}>
                      {s ? <SlotView slot={s} role={role} onOpen={() => setZoom(s)} /> : (
                        <div className="slot-btn">
                          <span className="slot-ghost" aria-hidden="true" />
                          <span className="slot-name">Libre</span>
                          <span className="flap-mini">Pendiente</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                {earned === 0 && <p className="muted member-hint">{role === 'runner' ? 'Cada base que tu grupo termine deja un sello aquí.' : role === 'base' ? 'Cada cruce que se termine en tu base deja un sello aquí.' : 'Cada Carrera que cierres deja un sello aquí.'}</p>}
              </div>
            </>
          )}
          {page === pages - 1 && (
            <>
              <header className="leaf-head">
                <div className="grow">
                  <p className="doc-kicker">Historial</p>
                  <h2 className="leaf-title">Tus semestres</h2>
                </div>
              </header>
              <div className="leaf-body">
                <ol className="member-history">
                  {records.map((r) => {
                    const c = cultureOf(r.term.theme, r.culture)
                    const n = stamps.filter((s) => s.record_id === r.id).length
                    return (
                      <li key={r.id} className={`culture-${c.key}`} style={{ '--culture-ink': `var(--ink-${c.ink})` } as CSSProperties}>
                        <CultureEmblem culture={c.key} size={44} className="hist-emblem" />
                        <span className="grow">
                          <strong>{r.term.name} · {themeOf(r.term.theme).name}</strong>
                          <small>{c.name} · {PASSPORT_ROLE_LONG[r.role]} · {r.career}</small>
                        </span>
                        <span className="flap-mini done">{n} {n === 1 ? 'sello' : 'sellos'}</span>
                      </li>
                    )
                  })}
                </ol>
                <p className="muted member-hint">Cada semestre trae su temática y una página nueva en tu pasaporte. Aquí queda tu paso por la Carrera, año tras año.</p>
              </div>
            </>
          )}
          <Mrz lines={[`P<PUJ<<${mrzText(person.full_name, 23)}`, `${mrzText(now.term.name, 8).replace(/<+$/, '')}<<${mrzText(culture.name, 10).replace(/<+$/, '')}<<${role.toUpperCase()}`.padEnd(30, '<').slice(0, 30)]} />
          <CultureOrnament culture={culture.key} />
        </article>
      </div>

      {zoom && createPortal(
        <div className={`moment zoom member-zoom culture-${culture.key}`} style={style} role="dialog" aria-modal="true" aria-label="Sello" onClick={() => setZoom(null)}>
          <div className="moment-card" onClick={(e) => e.stopPropagation()}>
            {zoom.kind === 'entry' && (
              <>
                <p className="moment-kicker">Visado de entrada</p>
                <CultureSeal culture={zoom.culture} theme={zoom.theme} top="Visado de entrada" bottom={`${zoom.term} · ${theme.name}`} size={250} tilt={0} />
                <h2>{zoom.term}</h2>
                <p className="muted">Tu pasaporte se abrió en este semestre, con la cultura {culture.name}.</p>
              </>
            )}
            {zoom.kind === 'coordinated' && (
              <>
                <p className="moment-kicker">Carrera coordinada</p>
                <CultureSeal culture={zoom.culture} theme={zoom.theme} top="Carrera coordinada" bottom={zoom.event} size={250} tilt={0} />
                <h2>{zoom.event}</h2>
                <p className="muted">Cerrada el {new Date(zoom.at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>
              </>
            )}
            {zoom.kind === 'stamp' && (
              <>
                <p className="moment-kicker">{STAMP_WORD[zoom.stamp.kind === 'hosted' ? 'base' : 'runner'].verb} · ronda {zoom.stamp.round_number}</p>
                <Stamp seed={zoom.stamp.base_key ?? zoom.stamp.base_name ?? ''} name={zoom.stamp.base_name ?? ''} round={zoom.stamp.round_number} time={stampTime(zoom.stamp.stamped_at)} state="done" size={250} straight />
                <h2>{zoom.stamp.base_name}</h2>
                <p className="muted">{zoom.stamp.event_name} · {airportCode(zoom.stamp.base_name ?? '')}</p>
              </>
            )}
            <button type="button" className="ghost moment-close" onClick={() => setZoom(null)}>Cerrar</button>
          </div>
        </div>,
        document.body,
      )}

      <nav className="leaf-nav" aria-label="Páginas del pasaporte">
        <span className="leaf-dots" aria-hidden="true">
          {Array.from({ length: pages }, (_, i) => (
            <i key={i} className={i === page ? 'on' : undefined} />
          ))}
        </span>
        <span className="sr-only">Página {page + 1} de {pages}. Desliza a los lados para cambiar de página.</span>
      </nav>

      {phase !== 'open' && (
        <button type="button" className={`cover${phase === 'opening' ? ' opening' : ''}`} onClick={() => setPhase('opening')} aria-label="Abrir el pasaporte">
          <span className="cover-inner member-cover">
            <span className="cover-corner tl" aria-hidden="true" />
            <span className="cover-corner tr" aria-hidden="true" />
            <span className="cover-corner bl" aria-hidden="true" />
            <span className="cover-corner br" aria-hidden="true" />
            <span className="cover-top">Pontificia Universidad Javeriana</span>
            <CultureEmblem culture={culture.key} size={150} className="cover-emblem" />
            <span className="cover-title">Pasaporte</span>
            <span className="cover-rule" aria-hidden="true">
              <i />
              <Star size={12} fill="currentColor" />
              <i />
            </span>
            <span className="cover-sub">{theme.name} · {now.term.name}</span>
            <span className="cover-team">{person.full_name}</span>
            <span className="cover-flight mono">{COVER[role].kicker}</span>
            <span className="cover-orn" aria-hidden="true"><CultureOrnament culture={culture.key} height={12} /></span>
            <span className="cover-bottom">
              <span className="cover-hint">Toca para abrir</span>
            </span>
          </span>
        </button>
      )}
    </section>
  )
}

function SlotView({ slot, role, onOpen }: { slot: Slot; role: PassportRole; onOpen: () => void }) {
  const open = (label: string, children: React.ReactNode, name: string, flag: string) => (
    <button type="button" className="slot-btn" aria-haspopup="dialog" aria-label={label} onClick={onOpen}>
      {children}
      <span className="slot-name">{name}</span>
      <span className="flap-mini done">{flag}</span>
    </button>
  )
  if (slot.kind === 'entry') return open('Ver el visado de entrada', <CultureSeal culture={slot.culture} theme={slot.theme} top="Visado de entrada" bottom={slot.term} size={104} tilt={-5} />, 'Visado de entrada', 'Bienvenida')
  if (slot.kind === 'coordinated') return open(`Ver el sello de ${slot.event}`, <CultureSeal culture={slot.culture} theme={slot.theme} top="Carrera coordinada" bottom={slot.event} size={104} tilt={4} />, slot.event, 'Coordinada')
  const s = slot.stamp
  return open(
    `Ver el sello de ${s.base_name}`,
    <Stamp seed={s.base_key ?? s.base_name ?? ''} name={s.base_name ?? ''} round={s.round_number} time={stampTime(s.stamped_at)} state="done" size={104} />,
    s.base_name ?? 'Base',
    role === 'base' ? `Ronda ${s.round_number}` : `${airportCode(s.base_name ?? '')} · R${s.round_number}`,
  )
}
