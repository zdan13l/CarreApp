import { Star } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { airportCode } from '../lib/flight'
import { committeeOf, committeesOfRecord } from '../lib/committees'
import { sealedGenerationsOf } from '../lib/seals'
import {
  PASSPORT_ROLE_LONG,
  personNumber,
  type PassportContextRow,
  type PassportPerson,
  type PassportRecordRow,
  type PassportRole,
  type PassportStampRow,
  type TermCommitteeRow,
  type TermRow,
} from '../lib/passports'
import { useScrollLock } from '../lib/scrollLock'
import { mrzText, stampTime } from '../lib/stamp'
import { photoUrl } from '../lib/storage'
import { cultureOf, themeOf, type CultureKey } from '../lib/themes'
import Avatar from './Avatar'
import CareerEmblem, { careerKey } from './CareerEmblem'
import CareerPlate from './CareerPlate'
import GenerationSeals from './GenerationSeal'
import CommitteeSeal from './CommitteeSeal'
import { eventOfTerm } from '../lib/eventSealStore'
import CultureEmblem, { CultureOrnament } from './CultureEmblem'
import Mrz from './Mrz'
import { CultureSeal, PhotoSeal, SymbolBadge, TextSeal } from './Seals'
import Stamp from './Stamp'

// The passport of an inductor is the passport of THEIR LIFE IN THE INDUCTION, so it is built in two layers:
//   general   the cover and the identity page (the DNI): name, photo, nickname, symbol, career and its mark, entry and generation.
//             Nothing of any theme, committee, role or partner is there: it is the same for ever.
//   by induction   for every induction they take part in, in its own theme: the page of the induction ("Inducción 2710 · Temática
//             Mitologías", the words of the coordinators, the culture that was assigned), the page of the committee (its words and stamp,
//             and the golden stamp with the photo of their group or of their base) and the visa pages that fill up with stamps.
//   then      blank pages that wait for the inductions to come.
// Everything is read from what the database already stores; nothing here is invented.
export interface MemberRecord extends PassportRecordRow {
  term: TermRow
}

export interface MemberPassportData {
  person: PassportPerson
  records: MemberRecord[] // the induction that is open first
  stamps: PassportStampRow[] // the ones kept for ever plus the ones of the Carrera that is running
  context: PassportContextRow[]
  committeeMessages?: TermCommitteeRow[]
}

export const PER_PAGE = 4
export const MIN_VISA_PAGES = 2 // the pages of an induction that wait for its stamps
export const BLANK_PAGES = 3 // pages that wait for the next inductions

export const STAMP_WORD: Record<PassportRole, { one: string; many: string; verb: string }> = {
  runner: { one: 'base visitada', many: 'bases visitadas', verb: 'Visitaste' },
  base: { one: 'cruce atendido', many: 'cruces atendidos', verb: 'Atendiste' },
  coordinator: { one: 'Carrera coordinada', many: 'Carreras coordinadas', verb: 'Coordinaste' },
}

export type VisaSlot =
  | { key: string; kind: 'entry'; term: string; culture: CultureKey; theme: string }
  | { key: string; kind: 'coordinated'; event: string; culture: CultureKey; theme: string; at: string }
  | { key: string; kind: 'stamp'; stamp: PassportStampRow }

/** What goes on the visa pages of one induction: its entry visa and a stamp for everything they did in it. */
export function visaSlotsOf(record: MemberRecord, stamps: PassportStampRow[], records: MemberRecord[]): VisaSlot[] {
  const culture = cultureOf(record.term.theme, record.culture).key
  const mine = stamps
    .filter((s) => (record.role === 'coordinator' ? s.kind === 'coordinated' && s.record_id === record.id : s.record_id === record.id))
    .sort((a, b) => a.stamped_at.localeCompare(b.stamped_at) || a.round_number - b.round_number)
  return [
    { key: `entry-${record.id}`, kind: 'entry', term: record.term.name, culture, theme: record.term.theme },
    ...mine.map<VisaSlot>((s) => {
      const of = records.find((r) => r.id === s.record_id) ?? record
      return s.kind === 'coordinated'
        ? { key: `${s.record_id}-${s.event_id ?? s.event_name}`, kind: 'coordinated', event: s.event_name, culture: cultureOf(of.term.theme, of.culture).key, theme: of.term.theme, at: s.stamped_at }
        : { key: `${record.id}-${s.event_id ?? s.event_name}-${s.kind}-${s.round_number}`, kind: 'stamp', stamp: s }
    }),
  ]
}

/** How many visa pages an induction has: the ones its stamps need, and never fewer than the empty ones that wait. */
export const visaPagesFor = (slots: number, per = PER_PAGE, min = MIN_VISA_PAGES) => Math.max(min, Math.ceil(slots / per))

export type PageSpec =
  | { kind: 'dni' }
  | { kind: 'induction'; record: MemberRecord }
  | { kind: 'committee'; record: MemberRecord; committee: string | null; lead: boolean; first: boolean }
  | { kind: 'visa'; record: MemberRecord; index: number; slots: VisaSlot[] }
  | { kind: 'blank'; n: number }

/** The pages of the booklet in order: the identity page, then three or more pages for each induction, then the blank ones. */
export function pageSpecsOf(data: MemberPassportData): PageSpec[] {
  const specs: PageSpec[] = [{ kind: 'dni' }]
  for (const record of data.records) {
    const slots = visaSlotsOf(record, data.stamps, data.records)
    specs.push({ kind: 'induction', record })
    const mine = committeesOfRecord(record)
    if (mine.length === 0) specs.push({ kind: 'committee', record, committee: null, lead: false, first: true })
    mine.forEach((m, i) => specs.push({ kind: 'committee', record, committee: m.key, lead: m.lead, first: i === 0 }))
    for (let i = 0; i < visaPagesFor(slots.length); i++) specs.push({ kind: 'visa', record, index: i, slots: slots.slice(i * PER_PAGE, (i + 1) * PER_PAGE) })
  }
  for (let n = 0; n < BLANK_PAGES; n++) specs.push({ kind: 'blank', n })
  return specs
}

export const contextOf = (data: MemberPassportData, record: MemberRecord) => data.context.find((c) => c.record_id === record.id)
export const committeeWords = (data: MemberPassportData, record: MemberRecord, committee: string | null = record.committee ?? null) =>
  (data.committeeMessages ?? []).find((m) => m.term_id === record.term_id && m.committee === committee)?.message ?? null

/** The golden stamp with a photo: the group a runner runs with, or the base an inductor staffs (null for the rest). */
export function photoSealOf(record: MemberRecord, ctx: PassportContextRow | undefined): { path: string | null; top: string; bottom: string } | null {
  if (record.role === 'runner' && ctx?.team_name) return { path: ctx.team_photo_path, top: 'Tu grupo', bottom: ctx.team_name }
  if (record.role === 'base' && ctx?.base_name) return { path: ctx.base_photo_path ?? null, top: 'Tu base', bottom: ctx.base_name }
  return null
}

const NEUTRAL = { '--culture-ink': 'var(--ink-1)' } as CSSProperties
const inkOf = (culture: { ink: number }) => ({ '--culture-ink': `var(--ink-${culture.ink})` }) as CSSProperties

function Words({ title, text, empty }: { title: string; text: string | null; empty: string }) {
  return (
    <section className="words">
      <p className="alias-label mono">{title}</p>
      {text ? <p className="words-text">{text}</p> : <p className="words-text empty">{empty}</p>}
    </section>
  )
}

export default function MemberPassport({ data, startOpen = false, startPage = 0 }: { data: MemberPassportData; startOpen?: boolean; startPage?: number }) {
  const { person } = data
  const [phase, setPhase] = useState<'closed' | 'opening' | 'open'>(startOpen ? 'open' : 'closed')
  const [page, setPage] = useState(startPage)
  const [dir, setDir] = useState<'next' | 'prev'>('next')
  const [zoom, setZoom] = useState<ReactNode | null>(null)
  const swipe = useRef<number | null>(null)
  useScrollLock(zoom !== null)

  useEffect(() => {
    if (phase === 'opening') {
      const t = window.setTimeout(() => setPhase('open'), 1050)
      return () => window.clearTimeout(t)
    }
  }, [phase])

  const specs = pageSpecsOf(data)
  const pages = specs.length
  const spec = specs[Math.min(page, pages - 1)]
  const career = data.records[0]?.career ?? ''

  const go = (to: number) => {
    const next = Math.min(Math.max(to, 0), pages - 1)
    if (next === page) return
    setDir(next > page ? 'next' : 'prev')
    setPage(next)
    setZoom(null)
  }
  const show = (kicker: string, seal: ReactNode, title: string, note?: string) => setZoom(<><p className="moment-kicker">{kicker}</p>{seal}<h2>{title}</h2>{note && <p className="muted">{note}</p>}</>)

  // ---- the pages ----
  let content: ReactNode
  let articleStyle: CSSProperties = NEUTRAL
  let articleClass = ''
  let ornament: CultureKey = 'general'
  let footer: [string, string] = [`P<PUJ<<${mrzText(person.full_name, 23)}`, `PUJ<<${careerKey(career).toUpperCase()}<<${personNumber(person.id).slice(4)}`.padEnd(30, '<').slice(0, 30)]

  if (spec.kind === 'dni') {
    const generation = person.generation?.trim()
    const joined = person.joined_term?.trim()
    content = (
      <>
        <header className="leaf-head member-head">
          <CareerEmblem career={career} size={62} className="head-emblem" />
          <div className="grow">
            <p className="doc-kicker">Documento de identidad · Inducción</p>
            <h2 className="leaf-title">{person.full_name}</h2>
          </div>
        </header>
        <div className="leaf-body">
          <div className="member-id">
            <figure className="member-photo">
              <Avatar name={person.full_name} photoPath={person.photo_path} size={132} />
              <figcaption className="mono">Inductor</figcaption>
            </figure>
            <div className="member-alias">
              <p className="alias-label mono">Apodo</p>
              {person.nickname?.trim() ? <p className="alias-name">«{person.nickname.trim()}»</p> : <p className="alias-name empty">Sin apodo</p>}
              <SymbolBadge symbol={person.symbol} label={person.symbol_label} size={56} />
            </div>
          </div>
          <dl className="member-grid">
            <div className="wide"><dt>Carrera</dt><dd>{career || '—'}</dd></div>
            <div><dt>Ingresó a inducción</dt><dd>{joined || 'Por definir'}</dd></div>
            <div><dt>Generación</dt><dd>{generation || 'Por definir'}</dd></div>
            <div><dt>Usuario</dt><dd className="mono">@{person.username}</dd></div>
            <div><dt>Número</dt><dd className="mono">{personNumber(person.id)}</dd></div>
          </dl>
          <ul className="slots identity-slots dni-slots">
            <li className="slot done career-slot">
              <div className="slot-btn">
                <CareerPlate career={career} size={92} />
                <span className="slot-name">Tu carrera</span>
              </div>
            </li>
            <li className={`slot ${generation ? 'done' : 'rest'}`}>
              <div className="slot-btn">
                {sealedGenerationsOf(generation).length > 0 ? <GenerationSeals generation={generation} size={104} /> : generation ? <TextSeal center={generation} top="Generación" bottom="Inducción Javeriana" size={104} tilt={-3} /> : <span className="slot-ghost" aria-hidden="true"><b>GENERACIÓN</b></span>}
                <span className="slot-name">Generación</span>
                <span className={`flap-mini${generation ? ' done' : ''}`}>{generation || 'Por definir'}</span>
              </div>
            </li>
            <li className={`slot ${joined ? 'done' : 'rest'}`}>
              <div className="slot-btn">
                {joined ? <TextSeal center={joined} top="Ingresó a inducción" bottom="Pontificia Universidad Javeriana" size={104} tilt={4} /> : <span className="slot-ghost" aria-hidden="true"><b>INGRESO</b></span>}
                <span className="slot-name">Ingresó a inducción</span>
                <span className={`flap-mini${joined ? ' done' : ''}`}>{joined || 'Por definir'}</span>
              </div>
            </li>
          </ul>
        </div>
      </>
    )
  } else if (spec.kind === 'induction' || spec.kind === 'committee' || spec.kind === 'visa') {
    const record = spec.record
    const theme = themeOf(record.term.theme)
    const culture = cultureOf(record.term.theme, record.culture)
    const committee = committeeOf(spec.kind === 'committee' ? spec.committee : record.committee)
    const lead = spec.kind === 'committee' ? spec.lead : Boolean(record.committee_lead)
    const ctx = contextOf(data, record)
    const role = record.role
    articleStyle = inkOf(culture)
    articleClass = ` culture-${culture.key}`
    ornament = culture.key
    footer = [`P<PUJ<<${mrzText(person.full_name, 23)}`, `${mrzText(record.term.name, 8).replace(/<+$/, '')}<<${mrzText(theme.name, 10).replace(/<+$/, '')}`.padEnd(30, '<').slice(0, 30)]
    if (spec.kind === 'induction') {
      const seal = (size: number, tilt: number) => <CultureSeal culture={culture.key} theme={record.term.theme} top={`Cultura ${culture.name}`} bottom={`Te tocó · ${record.term.name}`} size={size} tilt={tilt} />
      content = (
        <>
          <header className="leaf-head member-head">
            <CultureEmblem culture={culture.key} size={62} className="head-emblem" />
            <div className="grow">
              <p className="doc-kicker">Inducción {record.term.name}</p>
              <h2 className="leaf-title">Temática {theme.name}</h2>
            </div>
          </header>
          <div className="leaf-body">
            <Words title="Palabras de tus coordis" text={record.term.welcome?.trim() || null} empty="Tus coordis te dejarán aquí unas palabras." />
            <div className="induction-culture">
              <button type="button" className="seal-btn" aria-haspopup="dialog" aria-label="Ver el sello de tu cultura" onClick={() => show('La cultura que te tocó', seal(250, 0), culture.name, culture.myth)}>
                {seal(112, -4)}
              </button>
              <div>
                <p className="alias-label mono">Te tocó</p>
                <p className="alias-name">{culture.name}</p>
                <p className="muted">{culture.myth}.</p>
              </div>
            </div>
            <dl className="member-grid">
              <div><dt>Papel</dt><dd>{PASSPORT_ROLE_LONG[role]}</dd></div>
              <div><dt>Carrera</dt><dd>{record.career}</dd></div>
              {role === 'runner' && <div><dt>Grupo</dt><dd>{ctx?.team_name ?? 'Sin grupo todavía'}</dd></div>}
              {role === 'runner' && <div><dt>Con quién corres</dt><dd>{ctx?.partners?.length ? ctx.partners.join(' y ') : ctx?.team_name ? 'Todavía nadie más' : '—'}</dd></div>}
              {role === 'base' && <div className="wide"><dt>Base</dt><dd>{ctx?.base_name ?? 'Sin base todavía'}</dd></div>}
              {role === 'coordinator' && <div className="wide"><dt>Carrera</dt><dd>{ctx?.event_name ?? 'Sin Carrera todavía'}</dd></div>}
            </dl>
          </div>
        </>
      )
    } else if (spec.kind === 'committee') {
      const photo = spec.kind === 'committee' && spec.first ? photoSealOf(record, ctx) : null
      const seal = (size: number, tilt: number) => (committee ? <CommitteeSeal committee={committee.key} lead={lead} size={size} tilt={tilt} eventId={eventOfTerm(record.term_id)} /> : null)
      const photoSeal = (size: number) => photo && <PhotoSeal url={photoUrl(photo.path)} top={photo.top} bottom={photo.bottom} size={size} tilt={3} />
      content = (
        <>
          <header className="leaf-head">
            <div className="grow">
              <p className="doc-kicker">Tu comité · {record.term.name}</p>
              <h2 className="leaf-title">{committee ? committee.name : 'Sin comité todavía'}</h2>
            </div>
            {lead && <span className="flap-mini gold">Coordi</span>}
          </header>
          <div className="leaf-body">
            <div className="committee-seal-row">
              {committee ? (
                <button type="button" className="seal-btn" aria-haspopup="dialog" aria-label="Ver el sello de tu comité" onClick={() => show(`Comité ${committee.name}`, seal(250, 0), lead ? 'Coordi' : 'Miembro', committee.myth)}>
                  {seal(150, -4)}
                </button>
              ) : (
                <span className="slot-ghost big" aria-hidden="true"><b>COMITÉ</b></span>
              )}
              {committee && <p className="committee-tagline">{committee.tagline}</p>}
            </div>
            <Words title={committee ? `Palabras del comité ${committee.name}` : 'Palabras de tu comité'} text={committeeWords(data, record, committee?.key ?? null)} empty={committee ? 'Tu comité te dejará aquí unas palabras.' : 'Cuando te asignen un comité, aquí estarán sus palabras.'} />
            {photo && (
              <div className="photo-seal-row">
                <button type="button" className="seal-btn" aria-haspopup="dialog" aria-label={`Ver el sello dorado: ${photo.bottom}`} onClick={() => show(photo.top, photoSeal(250), photo.bottom, role === 'runner' ? 'Es único: el grupo con el que corres.' : 'Es único: tú no corres, tu sello es tu base.')}>
                  {photoSeal(112)}
                </button>
                <div>
                  <p className="alias-label mono">{photo.top}</p>
                  <p className="alias-name gold">{photo.bottom}</p>
                  <p className="muted">{role === 'runner' ? 'El grupo con el que corres.' : 'Tú no corres: tu sello es tu base.'}</p>
                </div>
              </div>
            )}
          </div>
        </>
      )
    } else {
      const earned = visaSlotsOf(record, data.stamps, data.records).filter((s) => s.kind !== 'entry').length
      const word = STAMP_WORD[role]
      content = (
        <>
          <header className="leaf-head">
            <div className="grow">
              <p className="doc-kicker">Visados · {record.term.name}</p>
              <h2 className="leaf-title">Página {spec.index + 1}</h2>
            </div>
            <p className="stamp-total" aria-label={`${earned} ${earned === 1 ? word.one : word.many}`}>
              <b className="num">{earned}</b>
              <span>{earned === 1 ? word.one : word.many}</span>
            </p>
          </header>
          <div className="leaf-body">
            <ul className="slots">
              {Array.from({ length: PER_PAGE }, (_, i) => spec.slots[i] ?? null).map((s, i) => (
                <li key={s?.key ?? `blank${spec.record.id}-${spec.index}-${i}`} className={`slot ${s ? 'done' : 'blank'}`}>
                  {s ? (
                    <SlotView slot={s} role={role} theme={theme.name} onOpen={(node) => setZoom(node)} />
                  ) : (
                    <div className="slot-btn">
                      <span className="slot-ghost" aria-hidden="true" />
                      <span className="slot-name">&nbsp;</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {earned === 0 && spec.index === 0 && (
              <p className="muted member-hint">
                {role === 'runner' ? 'Cada base que tu grupo termine deja un sello aquí.' : role === 'base' ? 'Cada cruce que se termine en tu base deja un sello aquí.' : 'Cada Carrera que cierres deja un sello aquí.'} Las páginas en blanco se llenan con el tiempo.
              </p>
            )}
          </div>
        </>
      )
    }
  } else {
    articleClass = ' blank-page'
    content = (
      <div className="leaf-body blank-body">
        {spec.n === 0 && <p className="blank-note">Páginas para tus próximas inducciones</p>}
      </div>
    )
  }

  return (
    <section className="booklet member" aria-label={`Pasaporte de ${person.full_name}`}>
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
        <article key={page} className={`leaf ${dir === 'next' ? 'turn-next' : 'turn-prev'}${articleClass}`} style={articleStyle}>
          {spec.kind !== 'blank' && <CultureOrnament culture={ornament} />}
          {content}
          {spec.kind !== 'blank' && <Mrz lines={footer} />}
          <p className="page-no mono" aria-hidden="true">{Math.min(page, pages - 1) + 1} / {pages}</p>
          {spec.kind !== 'blank' && <CultureOrnament culture={ornament} />}
        </article>
      </div>

      {zoom && createPortal(
        <div className="moment zoom member-zoom" style={articleStyle} role="dialog" aria-modal="true" aria-label="Sello" onClick={() => setZoom(null)}>
          <div className="moment-card" onClick={(e) => e.stopPropagation()}>
            {zoom}
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
            <CareerEmblem career={career} size={150} className="cover-emblem" />
            <span className="cover-title">Pasaporte</span>
            <span className="cover-rule" aria-hidden="true">
              <i />
              <Star size={12} fill="currentColor" />
              <i />
            </span>
            <span className="cover-sub">Inducción Javeriana</span>
            <span className="cover-team">{person.full_name}</span>
            <span className="cover-flight mono">{career}</span>
            <span className="cover-bottom">
              <span className="cover-hint">Toca para abrir</span>
            </span>
          </span>
        </button>
      )}
    </section>
  )
}

function SlotView({ slot, role, theme, onOpen }: { slot: VisaSlot; role: PassportRole; theme: string; onOpen: (detail: ReactNode) => void }) {
  const open = (label: string, children: ReactNode, name: string, flag: string, detail: ReactNode) => (
    <button type="button" className="slot-btn" aria-haspopup="dialog" aria-label={label} onClick={() => onOpen(detail)}>
      {children}
      <span className="slot-name">{name}</span>
      <span className="flap-mini done">{flag}</span>
    </button>
  )
  if (slot.kind === 'entry') {
    const seal = (size: number, tilt: number) => <CultureSeal culture={slot.culture} theme={slot.theme} top="Visado de entrada" bottom={`${slot.term} · ${theme}`} size={size} tilt={tilt} />
    return open('Ver el visado de entrada', seal(104, -5), 'Visado de entrada', 'Bienvenida', (
      <>
        <p className="moment-kicker">Visado de entrada</p>
        {seal(250, 0)}
        <h2>{slot.term}</h2>
        <p className="muted">Tu pasaporte se abrió en esta inducción.</p>
      </>
    ))
  }
  if (slot.kind === 'coordinated') {
    const seal = (size: number, tilt: number) => <CultureSeal culture={slot.culture} theme={slot.theme} top="Carrera coordinada" bottom={slot.event} size={size} tilt={tilt} />
    return open(`Ver el sello de ${slot.event}`, seal(104, 4), slot.event, 'Coordinada', (
      <>
        <p className="moment-kicker">Carrera coordinada</p>
        {seal(250, 0)}
        <h2>{slot.event}</h2>
        <p className="muted">Cerrada el {new Date(slot.at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>
      </>
    ))
  }
  const s = slot.stamp
  const stamp = (size: number, straight = false) => <Stamp seed={s.base_key ?? s.base_name ?? ''} name={s.base_name ?? ''} round={s.round_number} time={stampTime(s.stamped_at)} state="done" size={size} straight={straight} />
  return open(`Ver el sello de ${s.base_name}`, stamp(104), s.base_name ?? 'Base', role === 'base' ? `Ronda ${s.round_number}` : `${airportCode(s.base_name ?? '')} · R${s.round_number}`, (
    <>
      <p className="moment-kicker">{STAMP_WORD[s.kind === 'hosted' ? 'base' : 'runner'].verb} · ronda {s.round_number}</p>
      {stamp(250, true)}
      <h2>{s.base_name}</h2>
      <p className="muted">{s.event_name} · {airportCode(s.base_name ?? '')}</p>
    </>
  ))
}
