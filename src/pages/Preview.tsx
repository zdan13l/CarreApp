// Design preview (development only): renders the real components with sample data so the
// look can be reviewed without signing in. Not included in the production build.
//   /preview/runner  /preview/runner-ruta  /preview/runner-top  /preview/runner-fin
//   /preview/base    /preview/base-info    /preview/admin    /preview/admin-forms
import { useEffect, useState, type CSSProperties } from 'react'
import { BookMarked, BellRing, Camera, ChevronRight, ClipboardCheck, KeyRound, LocateFixed, Trash2, Flag, MapPin, Stamp as StampIcon, Trophy, Users } from 'lucide-react'
import { useParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Avatar from '../components/Avatar'
import BottomNav from '../components/BottomNav'
import Crest from '../components/Crest'
import Kpi from '../components/Kpi'
import FlightBoard from '../components/FlightBoard'
import OpsLog, { buildOpEvents } from '../components/OpsLog'
import PassportMatrix from '../components/PassportMatrix'
import Passport from '../components/Passport'
import { airportCode, flightCodes, type JourneyMatch } from '../lib/flight'
import Stamp from '../components/Stamp'
import StampMoment from '../components/StampMoment'
import LazyMap from '../components/LazyMap'
import Ranking from '../components/Ranking'
import RoundPager from '../components/RoundPager'
import AdminNav, { AdminTopbar } from './admin/AdminNav'
import PrepSteps, { PrepReport } from '../components/PrepSteps'
import { TeamCard } from './admin/Grupos'
import { RoundCard } from './admin/Cruces'
import BaseSealCard from '../components/BaseSealCard'
import { CrucesList, BaseGuide, BaseTicket, BaseWhere, ClosedDesk, MatchCard, NextRound, RotationCard, type BaseMatch, type Team } from './BaseHome'
import { ArchiveCard, type Archive } from './admin/Historial'
import { GENERATIONS, SEAL_ORDER, sealForSeed, sealInkVar } from '../lib/seals'
import GenerationSeals from '../components/GenerationSeal'
import { AfterCard, CurrentRound, FinishedCard, ItemResults, StatusBar, TopTab, type RouteMatch } from './RunnerHome'
import { AlertBanner } from '../components/Alerts'
import type { LegInfo } from '../lib/delays'
import PhaseBanner from '../components/PhaseBanner'
import PhaseControl from './admin/PhaseControl'
import Sellos from './admin/Sellos'
import Comites from './admin/Comites'
import Carreras from './admin/Carreras'
import Insignias from './admin/Insignias'
import EventSealView from '../components/EventSealView'
import { SHAPES } from '../lib/eventSeals'
import { hslToHex } from '../lib/color'
import CarreraShell from './admin/CarreraShell'
import { AdminContext } from './admin/AdminContext'
import type { EventRow } from '../types'
import Tutorial from '../components/Tutorial'
import { baseTutorial } from '../lib/tutorials'
import LoadFailed from '../components/LoadFailed'
import TeamDialog from '../components/TeamDialog'
import NoActiveCarrera from '../components/NoActiveCarrera'
import { confirmDialog, promptDialog } from '../lib/dialog'
import TeamNames from '../components/TeamNames'
import type { MatchRow, StandingRow, TeamRow } from '../types'
import CommitteeSeal from '../components/CommitteeSeal'
import CultureEmblem from '../components/CultureEmblem'
import { COMMITTEES } from '../lib/committees'
import MemberPage from '../components/MemberPage'
import type { MemberPassportData } from '../components/MemberPassport'
import { GenerationPicker, PersonItem, UploadPreview, type PersonRow } from './admin/Inductores'
import type { PassportRole, PassportStampRow, PersonIn } from '../lib/passports'

const user = { full_name: 'Daniel Rodríguez', username: 'daniel' }
const names = ['Dioses Griegos', 'Dioses Nórdicos', 'Samuráis', 'Guerreros Aztecas']
const standings: StandingRow[] = names.map((name, i) => ({ team_id: `t${i}`, name, photo_path: null, points: [7, 5, 5, 2][i] }))
const teamById = new Map(standings.map((r) => [r.team_id, r]))
const teams = new Map<string, Team>(standings.map((r) => [r.team_id, { id: r.team_id, name: r.name, photo_path: null }]))
const base = { name: 'Atrio', location_photo_path: '/campus-800.jpg', lat: 4.6286, lng: -74.0647 }
const at = (name: string, lat: number, lng: number) => ({ ...base, name, lat, lng }) // an app-relative path works as a photo in the preview

const routeMatches: RouteMatch[] = [
  { id: 'm1', round_number: 1, base_id: 'x1', finished_at: '2026-01-20T10:24:00Z', team_a: 't0', team_b: 't1', status: 'finished', arrived_at: '2026-01-20T10:00:00Z', bases: at('Atrio', 4.6286, -74.0647),
    match_scores: [{ item: 'barra', winner_team_id: 't0', voided: false }, { item: 'pregunta', winner_team_id: 't1', voided: false }, { item: 'minijuego', winner_team_id: 't0', voided: false }] },
  { id: 'm2', round_number: 2, base_id: 'x2', finished_at: null, team_a: 't0', team_b: 't2', status: 'in_progress', arrived_at: '2026-01-20T10:30:00Z', bases: at('Biblioteca Alfonso Borrero', 4.6272, -74.0636),
    match_scores: [{ item: 'barra', winner_team_id: 't2', voided: false }, { item: 'pregunta', winner_team_id: null, voided: true }] },
  { id: 'm3', round_number: 4, base_id: 'x3', finished_at: null, team_a: 't3', team_b: 't0', status: 'pending', arrived_at: null, bases: at('Cancha de Fútbol', 4.6262, -74.0652), match_scores: [] },
  { id: 'm4', round_number: 5, base_id: 'x4', finished_at: null, team_a: 't0', team_b: 't1', status: 'pending', arrived_at: null, bases: at('Claustro', 4.6279, -74.0665), match_scores: [] },
]

const towerTeams = [
  { id: 't0', name: 'Dioses Griegos' }, { id: 't1', name: 'Dioses Nórdicos' }, { id: 't2', name: 'Samuráis' }, { id: 't3', name: 'Guerreros Aztecas' }, { id: 't4', name: 'Gladiadores' },
]
const towerBases = new Map([['x1', 'Atrio'], ['x2', 'Biblioteca'], ['x3', 'Cancha de Fútbol']])
const done3 = (a: string, b: string) => [{ item: 'barra' as const, winner_team_id: a, voided: false }, { item: 'pregunta' as const, winner_team_id: b, voided: false }, { item: 'minijuego' as const, winner_team_id: a, voided: false }]
const towerMatches: JourneyMatch[] = [
  { id: 'a1', round_number: 1, base_id: 'x1', team_a: 't0', team_b: 't1', status: 'finished', arrived_at: '2026-01-20T15:02:00Z', finished_at: '2026-01-20T15:24:00Z', match_scores: done3('t0', 't1') },
  { id: 'a2', round_number: 1, base_id: 'x2', team_a: 't2', team_b: 't3', status: 'finished', arrived_at: '2026-01-20T15:03:00Z', finished_at: '2026-01-20T15:27:00Z', match_scores: done3('t2', 't2') },
  { id: 'a3', round_number: 2, base_id: 'x1', team_a: 't0', team_b: 't2', status: 'in_progress', arrived_at: '2026-01-20T15:38:00Z', finished_at: null, match_scores: [{ item: 'barra', winner_team_id: 't0', voided: false }] },
  { id: 'a4', round_number: 2, base_id: 'x3', team_a: 't1', team_b: 't3', status: 'pending', arrived_at: null, finished_at: null, match_scores: [] },
]
const towerCodes = flightCodes(towerTeams)
const towerNames = new Map(towerTeams.map((t) => [t.id, t.name]))
const towerOps = buildOpEvents({ matches: towerMatches, alerts: [{ id: 'n1', match_id: 'a4', message: 'Apúrense: la base los está esperando.', created_at: '2026-01-20T15:41:00Z' }], baseName: towerBases, teamName: towerNames, codes: towerCodes })

// sample legs for the arrival screen: one group still has time, the other is over its limit
const previewLegs: Record<string, LegInfo> = {
  t0: { kind: 'walking', fromBaseId: 'bx', since: Date.now() - 6 * 60_000, allowedMin: 10 },
  t3: { kind: 'walking', fromBaseId: 'by', since: Date.now() - 12 * 60_000, allowedMin: 10 },
}
const previewBaseNames = new Map([['bx', 'Atrio'], ['by', 'Biblioteca']])
const baseMatchFinished1: BaseMatch = {
  id: 'f1', round_number: 1, team_a: 't0', team_b: 't2', status: 'finished', arrived_at: '2026-01-20T10:00:00Z',
  match_scores: [{ item: 'barra', winner_team_id: 't0', voided: false }, { item: 'pregunta', winner_team_id: 't2', voided: false }, { item: 'minijuego', winner_team_id: 't0', voided: false }],
}
const baseMatchFinished2: BaseMatch = {
  id: 'f2', round_number: 2, team_a: 't1', team_b: 't3', status: 'finished', arrived_at: '2026-01-20T10:30:00Z',
  match_scores: [{ item: 'barra', winner_team_id: 't3', voided: false }, { item: 'pregunta', winner_team_id: null, voided: true }, { item: 'minijuego', winner_team_id: 't1', voided: false }],
}
const baseMatchPending: BaseMatch = { id: 'b1', round_number: 3, team_a: 't0', team_b: 't3', status: 'pending', arrived_at: null, match_scores: [] }
const baseMatchPlaying: BaseMatch = {
  id: 'b2', round_number: 2, team_a: 't0', team_b: 't2', status: 'in_progress', arrived_at: '2026-01-20T10:30:00Z',
  match_scores: [{ item: 'barra', winner_team_id: 't0', voided: false }],
}

const teamRow: TeamRow = {
  id: 't0', name: 'Dioses Griegos', photo_path: null, sort_order: 0,
  team_runners: [{ user_id: 'u1', is_gps_tracker: true }, { user_id: 'u2', is_gps_tracker: false }],
}
const profiles = [
  { id: 'u1', username: 'daniel', full_name: 'Daniel Rodríguez', role: 'runner' as const },
  { id: 'u2', username: 'vanesa', full_name: 'Vanesa Gómez', role: 'runner' as const },
  { id: 'u3', username: 'nico', full_name: 'Nicolás Pérez', role: 'runner' as const },
]
const adminMatches: MatchRow[] = [
  { id: 'a1', round_number: 1, base_id: 'x1', team_a: 't0', team_b: 't1', status: 'finished', arrived_at: '2026-01-20T10:05:00Z', finished_at: '2026-01-20T10:20:00Z' },
  { id: 'a2', round_number: 1, base_id: 'x2', team_a: 't2', team_b: 't3', status: 'in_progress', arrived_at: '2026-01-20T10:08:00Z', finished_at: null },
]

const ic = { size: 22, strokeWidth: 1.9 } as const
const runnerTabs = [
  { id: 'ronda', label: 'Visado', icon: <StampIcon {...ic} /> },
  { id: 'ubicacion', label: 'Ubicación', icon: <LocateFixed {...ic} /> },
  { id: 'ruta', label: 'Pasaporte', icon: <BookMarked {...ic} /> },
  { id: 'top', label: 'Top', icon: <Trophy {...ic} /> },
]
const baseTabs = [
  { id: 'ronda', label: 'Ronda', icon: <Flag {...ic} /> },
  { id: 'resultados', label: 'Resultados', icon: <Trophy {...ic} /> },
  { id: 'base', label: 'Mi base', icon: <MapPin {...ic} /> },
]
const noop = () => {}
const noopAsync = async () => {}
// The base screen: the inductor, the stamp ink of the base (as BaseHome sets it) and the flight codes of the groups.
const inspector = { full_name: 'Vanesa Gómez', username: 'vanesa' }
const previewBase = { id: 'x1', name: 'Atrio', location_photo_path: '/campus-800.jpg' }
const baseInk = { '--base-ink': sealInkVar('x1') } as CSSProperties
const baseCodes = flightCodes(towerTeams)

// Top with the team card that opens when a group is tapped (sample @ users).
function PreviewTop({ teams }: { teams: { team_id: string; name: string; photo_path: string | null }[] }) {
  const [open, setOpen] = useState<string | null>(null)
  const t = teams.find((x) => x.team_id === open)
  return (
    <>
      <TopTab teamId="t0" points={7} teams={teams} onSelect={setOpen} />
      {t && <TeamDialog name={t.name} photoPath={t.photo_path} usernames={['vanesa', 'nico']} onClose={() => setOpen(null)} />}
    </>
  )
}


// The personal passport of an inductor (three versions) and the coordinator's list of inductors.
const mTerm = { id: 'tm2', name: '2710', theme: 'mitologias', is_current: true, welcome: 'Gracias por darle vida a la inducción. Cada sello que reparten es el primer recuerdo de alguien que llega: háganlo con el corazón.' }
const mOld = { id: 'tm1', name: '2700', theme: 'casas-de-harry-potter', is_current: false, welcome: null } // a theme this version does not know: falls back
const mStamp = (record: string, kind: PassportStampRow['kind'], base: string, round: number, event = 'Carrera 2026-2'): PassportStampRow => ({
  record_id: record, event_id: `ev-${event}`, event_name: event, kind, base_name: kind === 'coordinated' ? null : base, base_key: kind === 'coordinated' ? null : `b-${base}`, round_number: round, stamped_at: `2026-11-1${round}T1${round}:20:00Z`,
})
function memberData(role: PassportRole, culture: string, career: string, query: URLSearchParams): MemberPassportData {
  const rec = { id: 'rec2', passport_id: 'p1', term_id: mTerm.id, role, career, culture, team_id: role === 'runner' ? 'tm' : null, base_id: role === 'base' ? 'bs' : null, committee: role === 'coordinator' ? 'caos' : ['clausura', 'meraki', 'conzumo', 'carrera', 'caos'][career.length % 5], committee_lead: role === 'coordinator', extra_committees: role === 'coordinator' || query.has('comites') ? ['meraki', 'bienvenida'] : [], extra_leads: role === 'coordinator' ? ['meraki'] : [], term: mTerm }
  const old = { ...rec, id: 'rec1', term_id: mOld.id, role: (role === 'coordinator' ? 'coordinator' : 'base') as PassportRole, base_id: null, team_id: null, term: mOld }
  const stamps: PassportStampRow[] =
    role === 'runner'
      ? [mStamp('rec2', 'visited', 'Atrio', 1), mStamp('rec2', 'visited', 'Biblioteca', 2), mStamp('rec2', 'visited', 'Cafetería', 3), mStamp('rec2', 'visited', 'Capilla', 4)]
      : role === 'base'
        ? [mStamp('rec2', 'hosted', 'Atrio', 1), mStamp('rec2', 'hosted', 'Atrio', 2), mStamp('rec2', 'hosted', 'Atrio', 3)]
        : []
  if (role === 'coordinator') stamps.push(mStamp('rec1', 'coordinated', '', 0, 'Carrera 2026-1'))
  else stamps.push(mStamp('rec1', 'hosted', 'Mirador', 1, 'Carrera 2026-1'), mStamp('rec1', 'hosted', 'Mirador', 2, 'Carrera 2026-1'))
  return {
    person: { id: 'p1', username: 'daniel.rodriguez', full_name: 'Daniel Arturo Rodríguez Peña', photo_path: null, nickname: 'Dani', symbol: 'cat', symbol_label: 'Gato blanco', generation: query.has('sin') ? null : query.get('gen') ?? 'Peluches', joined_term: query.has('sin') ? null : '2024-2' },
    records: [rec, old],
    stamps,
    context: [{ record_id: 'rec2', team_id: 'tm', team_name: 'Dioses Nórdicos', team_photo_path: '/campus-800.jpg', partners: ['Sara Lucía Montes'], base_id: 'bs', base_name: 'Atrio', base_photo_path: '/campus-800.jpg', event_id: 'ev', event_name: 'Carrera 2710', event_active: true }],
    committeeMessages: [{ term_id: 'tm2', committee: role === 'coordinator' ? 'caos' : ['clausura', 'meraki', 'conzumo', 'carrera', 'caos'][career.length % 5], message: 'Somos quienes cierran lo que otros empiezan. Gracias por quedarse hasta el final y por hacer sentir a cada neo que valió la pena llegar.' }],
  }
}
const sampleCareers: Record<string, [string, string]> = { nordica: ['nordica', 'Ingeniería de Sistemas'], griega: ['griega', 'Mecatrónica'], mexicana: ['mexicana', 'Ingeniería Industrial'], china: ['china', 'Bioingeniería'], egipcia: ['egipcia', 'Ingeniería Civil'] }
const samplePeople: PersonRow[] = [
  { passport: { id: 'a', username: 'camila.rojas', full_name: 'Camila Andrea Rojas Prieto', photo_path: null }, record: { id: 'r1', passport_id: 'a', term_id: 't', role: 'runner', career: 'Ingeniería de Sistemas', culture: 'nordica', team_id: 'g1', base_id: null } },
  { passport: { id: 'b', username: 'ana.ruiz', full_name: 'Ana Pardo Ruiz', photo_path: null }, record: { id: 'r2', passport_id: 'b', term_id: 't', role: 'base', career: 'Ingeniería de Sistemas', culture: 'nordica', team_id: null, base_id: 'b1' } },
  { passport: { id: 'c', username: 'diana.pardo', full_name: 'Diana Carolina Pardo', photo_path: null }, record: { id: 'r3', passport_id: 'c', term_id: 't', role: 'coordinator', career: 'Mecatrónica', culture: 'griega', team_id: null, base_id: null } },
  { passport: { id: 'd', username: 'lucia.ortega', full_name: 'Lucía Marcela Ortega Páez', photo_path: null }, record: null },
]
const sampleRows: PersonIn[] = [
  { line: 2, fullName: 'Camilo José Mora Ibáñez', career: 'Bioingeniería', role: 'runner', culture: 'china', username: 'camilo.mora', existing: false, committee: 'caos', generation: '', joined: '', nickname: '', errors: [] },
  { line: 3, fullName: 'Miguel Ángel Vera Soto', career: 'Ingeniería Civil', role: 'runner', culture: 'egipcia', username: 'miguel.vera', existing: false, committee: null, generation: '', joined: '', nickname: '', errors: [] },
  { line: 4, fullName: 'Laura Camila Pinto', career: 'Ingeniería Ambiental', role: 'base', culture: null, username: 'laura.pinto', existing: false, committee: 'meraki', generation: '', joined: '', nickname: '', errors: [] },
  { line: 5, fullName: 'Sara Nelly Beltrán', career: 'Ingeniería Industrial', role: 'runner', culture: 'mexicana', username: 'sara.beltran', existing: true, committee: null, generation: '', joined: '', nickname: '', errors: [] },
  { line: 6, fullName: 'Sara Nelly Beltrán', career: 'Ingeniería Industrial', role: 'runner', culture: 'mexicana', username: 'sara.beltran', existing: true, committee: null, generation: '', joined: '', nickname: '', errors: ['Esta persona está repetida en el archivo.'] },
]

// The pages of the PDF of the passport as pictures, and a button that builds the whole PDF (development only).
function PdfPreview({ data }: { data: MemberPassportData }) {
  const [pages, setPages] = useState<string[]>([])
  const [info, setInfo] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  useEffect(() => {
    let urls: string[] = []
    void (async () => {
      const [{ renderToStaticMarkup }, font, pdf] = await Promise.all([
        import('react-dom/server'),
        import('@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2?inline'),
        import('../lib/passportPdf'),
      ])
      const svgs = pdf.passportPageSvgs({ data, assets: { photo: null, font: font.default }, render: (el) => renderToStaticMarkup(el) })
      urls = svgs.map((s) => URL.createObjectURL(new Blob([s], { type: 'image/svg+xml' })))
      setPages(urls)
    })()
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [data])
  return (
    <main className="page">
      <h1>PDF del pasaporte</h1>
      <button
        onClick={() =>
          void import('../lib/passportPdf').then(async (m) => {
            const blob = await m.buildPassportPdf(data, 1.2)
            const head = new TextDecoder('latin1').decode(new Uint8Array(await blob.arrayBuffer()).slice(0, 8))
            const text = new TextDecoder('latin1').decode(new Uint8Array(await blob.arrayBuffer()))
            setPdfUrl(URL.createObjectURL(blob))
            setInfo(`${head.trim()} · ${(blob.size / 1024).toFixed(0)} KB · ${(text.match(/\/Type \/Page /g) ?? []).length} páginas`)
          })
        }
      >
        Armar el PDF
      </button>
      <p id="pdf-info">{info}</p>
      {pdfUrl && <iframe title="PDF" src={pdfUrl} style={{ width: '100%', height: 640, border: '1px solid var(--border-strong)' }} />}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '.6rem' }}>
        {pages.map((u) => (
          <img key={u} src={u} alt="" style={{ width: '100%', border: '1px solid var(--border-strong)' }} />
        ))}
      </div>
    </main>
  )
}

function HabilitadaPreview({ user }: { user: { full_name: string; username: string; photo_path?: string | null } }) {
  const [tour, setTour] = useState(false)
  const [tab, setTab] = useState<'ronda' | 'resultados' | 'base'>('ronda')
  const tabs = [
    { id: 'ronda' as const, label: 'Ronda', icon: <Flag size={22} aria-hidden="true" /> },
    { id: 'resultados' as const, label: 'Resultados', icon: <Trophy size={22} aria-hidden="true" /> },
    { id: 'base' as const, label: 'Mi base', icon: <MapPin size={22} aria-hidden="true" /> },
  ]
  return (
    <AppShell title="Mi base" showTitle={tab === 'ronda'} user={user} alerts>
      <div className="base-view">
        <PhaseBanner phase="enabled" onTutorial={tab === 'ronda' ? () => setTour(true) : undefined} compact={tab !== 'ronda'} />
        <BaseTicket name="Atrio" photoPath="/campus-800.jpg" sealed={0} />
        <MatchCard match={baseMatchPending} teams={teams} onSent={noopAsync} eventId="e1" base={previewBase} codes={baseCodes} legs={{}} locked />
        <BottomNav tabs={tabs} active={tab} transition={false} onChange={setTab} />
        {tour && <Tutorial steps={baseTutorial()} onTab={(t) => setTab(t as typeof tab)} onClose={() => setTour(false)} />}
      </div>
    </AppShell>
  )
}

export default function Preview() {
  const { screen } = useParams()

  if (screen === 'pasaporte-pdf') {
    const query = new URLSearchParams(window.location.search)
    const [culture, career] = sampleCareers[query.get('cultura') ?? 'nordica'] ?? sampleCareers.nordica
    return <PdfPreview data={memberData('runner', culture, career, query)} />
  }

  if (screen === 'comites') {
    // the five committee stamps, normal and golden (the coordinator of the committee), and the mark of each culture
    return (
      <main className="page">
        <h1>Sellos de los comités</h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center' }}>
          {COMMITTEES.map((c) => (
            <CommitteeSeal key={c.key} committee={c.key} size={170} tilt={-3} />
          ))}
        </div>
        <h2>Coordis (dorado)</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center' }}>
          {COMMITTEES.map((c) => (
            <CommitteeSeal key={c.key} committee={c.key} lead size={170} tilt={3} />
          ))}
        </div>
        <h2>La cultura que te tocó</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center' }}>
          {(['nordica', 'griega', 'mexicana', 'china', 'egipcia'] as const).map((k) => (
            <span key={k} className={`culture-${k}`} style={{ '--culture-ink': `var(--ink-${{ nordica: 4, griega: 1, mexicana: 3, china: 2, egipcia: 5 }[k]})` } as CSSProperties}>
              <CultureEmblem culture={k} size={170} />
            </span>
          ))}
        </div>
      </main>
    )
  }

  if (screen?.startsWith('pasaporte-')) {
    // pasaporte-corredor, pasaporte-base, pasaporte-coordi, plus ?cultura=griega (nordica by default) and ?portada (closed cover)
    const query = new URLSearchParams(window.location.search)
    const [culture, career] = sampleCareers[query.get('cultura') ?? 'nordica'] ?? sampleCareers.nordica
    const role: PassportRole = screen === 'pasaporte-base' ? 'base' : screen === 'pasaporte-coordi' ? 'coordinator' : 'runner'
    return <MemberPage data={memberData(role, culture, career, query)} user={{ full_name: 'Daniel Rodríguez', username: 'daniel.rodriguez' }} startOpen={!query.has('portada')} startPage={Number(query.get('pagina') ?? 0)} startTab={query.get('tab') === 'perfil' ? 'perfil' : 'pasaporte'} />
  }

  if (screen === 'inductores') {
    return (
      <div className="admin tower">
        <AdminNav event={{ id: 'e1', name: 'Carrera 2710', code: '2710', phase: 'started' }} user={user} onSignOut={noop} />
        <main className="admin-main">
          <AdminTopbar user={user} onSignOut={noop} />
          <h1>Inductores</h1>
          <section className="card">
            <h2>Cargar inductores</h2>
            <UploadPreview rows={sampleRows} themeKey="mitologias" onChange={noop} />
            <div className="row"><button>Crear 3 pasaportes y descargar las contraseñas</button><button className="ghost">Cancelar</button></div>
          </section>
          <section className="card">
            <h2>Lista de 2026-2</h2>
            <ul className="list people">
              {samplePeople.map((p) => (
                <PersonItem key={p.passport.id} person={p} themeKey="mitologias" teams={[{ id: 'g1', label: 'Dioses Nórdicos (1/2)' }]} bases={[{ id: 'b1', label: 'Atrio' }]} busy={false} onRole={noop} onLink={noop} onCulture={noop} onCommittee={noop} onLead={noop} onExtra={noop} onIdentity={noop} onPhoto={noop} onReset={noop} onDelete={noop} />
              ))}
            </ul>
          </section>
        </main>
      </div>
    )
  }

  if (screen === 'dialogs') {
    return (
      <AppShell title="Ventanas" user={user}>
        <section className="card">
          <h2>Ventanas emergentes</h2>
          <p className="muted">Toca cada botón para ver cómo se ve.</p>
          <div className="row">
            <button onClick={() => void promptDialog({ title: 'Avisar a la base', message: 'Les llega como notificación y les suena el teléfono.', label: 'Mensaje', defaultValue: 'Apúrense con el juego: el siguiente cruce está esperando.', confirmLabel: 'Enviar aviso', icon: 'bell' })}>Mensaje</button>
            <button className="ghost" onClick={() => void confirmDialog({ title: '¿Enviar los resultados?', message: 'Una vez enviados solo el coordi puede corregirlos.', details: ['Barra: Dioses Griegos', 'Pregunta: Samuráis', 'Minijuego: Dioses Griegos'], confirmLabel: 'Enviar resultados', icon: 'send' })}>Resultados</button>
            <button className="ghost danger" onClick={() => void confirmDialog({ title: '¿Eliminar la base "Atrio"?', message: 'Se borran también sus cruces y los puntos registrados.', confirmLabel: 'Eliminar base', tone: 'danger', icon: 'trash' })}>Eliminar</button>
            <button className="ghost" onClick={() => void confirmDialog({ title: '¿Cerrar sesión?', message: 'Este teléfono dejará de recibir los avisos de la carrera.', confirmLabel: 'Cerrar sesión', icon: 'logout' })}>Salir</button>
          </div>
        </section>
      </AppShell>
    )
  }

  // the first request failed (bad signal): not the same as having no Carrera
  if (screen === 'carga-fallida') {
    return (
      <AppShell title="Mi base" user={inspector}>
        <LoadFailed onRetry={noop} />
      </AppShell>
    )
  }

  // a group is late for the NEXT round: the banner carries its own button to hurry the groups
  if (screen === 'base-demora') {
    return (
      <AppShell title="Mi base" showTitle={false} user={inspector} alerts>
        <div className="base-view" style={baseInk}>
          <AlertBanner
            title="Ronda 3: grupos en demora"
            action={<button type="button" className="ghost banner-action">Apurar a los grupos</button>}
          >
            Dioses Griegos llevan 14 min en el traslado (máximo 10 min).
          </AlertBanner>
          <div className="tab-view fwd">
            <BaseTicket name="Atrio" photoPath="/campus-800.jpg" sealed={1} />
            <MatchCard match={baseMatchPlaying} teams={teams} onSent={noopAsync} eventId="e1" base={previewBase} codes={baseCodes} />
          </div>
          <BottomNav tabs={baseTabs} active="ronda" transition={false} onChange={noop} />
        </div>
      </AppShell>
    )
  }

  if (screen === 'sin-carrera' || screen === 'sin-carrera-base') {
    return (
      <AppShell title={screen === 'sin-carrera' ? 'Mi grupo' : 'Mi base'} user={user}>
        <NoActiveCarrera role={screen === 'sin-carrera' ? 'runner' : 'base'} />
      </AppShell>
    )
  }

  if (screen === 'runner-alertas') {
    return (
      <AppShell title="Mi grupo" user={user}>
        <StatusBar name="Dioses Griegos" photoPath={null} />
        <section className="card">
          <h2>Alertas</h2>
          <p className="muted">Para que te avisemos cuando vayas tarde a la siguiente base: con el sonido activado suena cada 30 segundos mientras dure la demora; con las notificaciones te llega aunque el teléfono esté bloqueado.</p>
          <button className="ghost sound-toggle asleep">Toca aquí para reactivar el sonido</button>
          <button className="ghost sound-toggle on">Notificaciones activadas</button>
        </section>
        <div className="alert-banner" role="alert">
          <BellRing size={24} aria-hidden="true" />
          <div className="grow"><strong>Llevas 12 min en el traslado</strong><p>El máximo para este tramo es 10 min. ¡Apúrate hacia Cancha de Fútbol! Si ya llegaste, avísale a la base.</p></div>
        </div>
        <BottomNav tabs={runnerTabs} active="ronda" onChange={noop} />
      </AppShell>
    )
  }

  if (screen === 'runner-sello') {
    return (
      <AppShell title="Mi grupo" user={user}>
        <StatusBar name="Dioses Griegos" photoPath={null} points={3} />
        <CurrentRound match={routeMatches[1]} myId="t0" teams={teamById} totalRounds={5} />
        <StampMoment seed="x2" name="Biblioteca Alfonso Borrero" photoPath="/campus-800.jpg" round={2} time="12:04" onClose={noop} />
      </AppShell>
    )
  }

  if (screen === 'historial') {
    const items = ['barra', 'pregunta', 'minijuego']
    const archive: Archive = {
      id: 'h1', event_name: 'Carrera 2710', term_name: '2710', archived_at: '2027-01-22T20:30:00Z', matches_played: 4,
      standings: [{ team: 'Fénix', points: 9 }, { team: 'Quimeras', points: 8 }, { team: 'Titanes', points: 6 }, { team: 'Sirenas', points: 5 }],
      results: [1, 2].flatMap((round) => items.map((item, i) => ({ round, base: round === 1 ? 'Atrio' : 'Biblioteca', team_a: 'Fénix', team_b: round === 1 ? 'Titanes' : 'Quimeras', item, winner: i === 2 ? 'Titanes' : 'Fénix', voided: round === 2 && i === 1 }))),
    }
    return (
      <AppShell title="Historial" user={user}>
        <ArchiveCard a={archive} onRemove={noop} />
      </AppShell>
    )
  }

  if (screen === 'base-rotacion') {
    return (
      <AppShell title="Mi base" user={user}>
        <RotationCard state="waiting" names={['Fénix', 'Titanes']} onConfirm={noop} />
        <RotationCard state="ready" names={['Fénix', 'Titanes']} onConfirm={noop} />
        <RotationCard state="done" names={['Fénix', 'Titanes']} onConfirm={noop} />
      </AppShell>
    )
  }

  if (screen === 'sellos-15') {
    // one seed for each of the fifteen mythology seals, so every one can be reviewed
    const seeds = SEAL_ORDER.map((key) => {
      for (let n = 0; n < 5000; n++) if (sealForSeed(`s${n}`).key === key) return `s${n}`
      return 's0'
    })
    return (
      <AppShell title="Sellos" user={user}>
        <section className="card">
          <h2>Los quince sellos de las bases</h2>
          <div className="row" style={{ gap: '1rem' }}>
            {seeds.map((seed, i) => (
              <Stamp key={seed} seed={seed} name={['Atrio', 'Biblioteca', 'Cancha de Fútbol', 'Claustro', 'Laboratorio', 'Cafetería', 'Auditorio', 'Plaza', 'Mirador', 'Jardín', 'Coliseo', 'Capilla', 'Torre', 'Museo', 'Portería'][i]} round={i + 1} time="12:04" state="stamped" size={150} straight />
            ))}
          </div>
        </section>
      </AppShell>
    )
  }

  if (screen === 'sellos') {
    const seeds = ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8']
    return (
      <AppShell title="Sellos" user={user}>
        <section className="card">
          <h2>Un sello por base</h2>
          <p className="muted">La forma y la tinta salen del identificador de cada base.</p>
          <div className="row" style={{ gap: '1rem' }}>
            {seeds.map((seed, i) => (
              <Stamp key={seed} seed={seed} name={['Atrio', 'Biblioteca', 'Cancha de Fútbol', 'Claustro', 'Laboratorio', 'Cafetería', 'Auditorio', 'Plaza'][i]} photoPath="/campus-800.jpg" round={i + 1} time="12:0" state={i === 7 ? 'done' : 'stamped'} size={130} />
            ))}
            <Stamp seed="y1" name="Atrio" round={3} state="current" size={130} photoPath="/campus-800.jpg" />
            <Stamp seed="y2" name="Atrio" round={4} state="pending" size={130} />
            <Stamp seed="y3" name="Atrio" round={5} state="rest" size={130} />
          </div>
        </section>
      </AppShell>
    )
  }

  if (screen === 'runner-fin') {
    return (
      <AppShell title="Mi grupo" user={user} alerts>
        <div className="tab-view fwd">
          <FinishedCard team="Dioses Griegos" matches={routeMatches.filter((m) => m.round_number !== 3)} onPassport={noop} />
        </div>
        <BottomNav tabs={runnerTabs} active="ronda" onChange={noop} />
      </AppShell>
    )
  }

  if (screen === 'runner' || screen === 'runner-ruta' || screen === 'runner-top') {
    const tab = screen === 'runner' ? 'ronda' : screen === 'runner-ruta' ? 'ruta' : 'top'
    return (
      <AppShell
        title="Mi grupo"
        showTitle={tab === 'ronda'}
        user={user}
        alerts
      >
        <div className="tab-view fwd">
        {tab === 'ronda' && (
          <>
            <StatusBar name="Dioses Griegos" photoPath={null} points={7} />
            <CurrentRound match={routeMatches[1]} myId="t0" teams={teamById} totalRounds={5} />
            <AfterCard match={routeMatches.find((m) => m.round_number === 4)!} myId="t0" teams={teamById} />
          </>
        )}
        {tab === 'ruta' && (
          <Passport
            team="Dioses Griegos"
            flight="JV 213"
            mine={routeMatches}
            totalRounds={5}
            nextId="m2"
            detail={(m) => <ItemResults match={routeMatches.find((x) => x.id === m.id) ?? routeMatches[0]} teams={teamById} />}
          />
        )}
        {tab === 'top' && <PreviewTop teams={standings.map((r) => ({ team_id: r.team_id, name: r.name, photo_path: r.photo_path }))} />}
        </div>
        <BottomNav tabs={runnerTabs} active={tab} onChange={noop} />
      </AppShell>
    )
  }

  if (screen === 'base-resultados') {
    return (
      <AppShell title="Resultados" showTitle={false} user={inspector} alerts>
       <div className="base-view" style={baseInk}>
        <div className="tab-view fwd">
        <BaseTicket name="Atrio" photoPath="/campus-800.jpg" sealed={2} />
        <section className="top-others">
         <h2 className="title-tag"><Users size={18} aria-hidden="true" />Equipos de la carrera<b className="num">{teams.size}</b></h2>
         <div className="card"><TeamNames teams={[...teams.values()]} onSelect={() => {}} /></div>
        </section>
        <section className="top-others">
         <h2 className="title-tag"><ClipboardCheck size={18} aria-hidden="true" />Cruces de tu base<b className="num">2</b></h2>
         <div className="card">
          <CrucesList finished={[baseMatchFinished1, baseMatchFinished2]} teams={teams} />
         </div>
        </section>
        </div>
        <BottomNav tabs={baseTabs} active="resultados" transition={false} onChange={noop} />
       </div>
      </AppShell>
    )
  }

  if (screen === 'admin-carreras' || screen === 'admin-carrera-shell') {
    const mk = (id: string, name: string, code: string | null, phase: EventRow['phase'], is_test = false): EventRow => ({ id, name, code, is_test, phase, is_active: phase !== 'disabled' && phase !== 'archived', started_at: null, max_travel_minutes: 10 })
    const events = [mk('t', 'Carrera de prueba', null, 'enabled', true), mk('a', 'Carrera 2710', '2710', 'disabled'), mk('h', 'Carrera 2610', '2610', 'archived')]
    const ctx = { events, event: events[1], mode: 'live' as const, running: true, setMode: noop, selectEvent: noop, reload: noopAsync }
    return (
      <div className="admin tower">
        <AdminNav event={events[1]} user={user} onSignOut={noop} />
        <main className="admin-main">
          <AdminContext.Provider value={ctx}>{screen === 'admin-carreras' ? <Carreras /> : <CarreraShell />}</AdminContext.Provider>
        </main>
      </div>
    )
  }
  if (screen === 'event-seals') {
    return (
      <div className="admin tower"><main className="admin-main"><section className="card"><h2>Sellos de una carrera</h2>
        <div className="seal-grid">
          {SHAPES.map((shape, i) => <figure key={shape} className="seal-item"><EventSealView shape={shape} color={hslToHex((i * 47 + 20) % 360, 62, 55)} initial={shape} size={88} /><figcaption>{shape}</figcaption></figure>)}
          <figure className="seal-item"><EventSealView shape="circle" color="currentColor" gold initial="Coordi" size={88} /><figcaption>coordi (dorado)</figcaption></figure>
        </div>
      </section></main></div>
    )
  }
  if (screen === 'admin-generaciones') {
    return (
      <div className="admin tower">
        <main className="admin-main">
          <header className="page-head"><div><p className="eyebrow">Administración global</p><h1>Generaciones</h1></div></header>
          <section className="card">
            <h2>Los sellos de las generaciones</h2>
            <div className="seal-grid">
              {GENERATIONS.map((g) => <figure key={g.key} className="seal-item"><GenerationSeals generation={g.name} size={96} /><figcaption><strong>{g.name}</strong><small>{g.term ?? 'sin semestre'}</small></figcaption></figure>)}
              <figure className="seal-item"><EventSealView shape="shield" color={hslToHex(268, 62, 55)} initial="Mariposas" size={96} /><figcaption><strong>Mariposas</strong><small>editado</small></figcaption></figure>
            </div>
          </section>
          <section className="card add-person">
            <h2>La generación de una persona se elige</h2>
            <GenerationPicker value="Barbies" label="Generación de Ana" />
            <GenerationPicker value="Pendiente" label="Generación de Luis" />
          </section>
        </main>
      </div>
    )
  }
  if (screen === 'admin-insignias') return <div className="admin tower"><main className="admin-main"><Insignias /></main></div>
  if (screen === 'admin-comites') return <div className="admin tower"><main className="admin-main"><Comites /></main></div>
  if (screen === 'admin-sellos') return <div className="admin tower"><main className="admin-main"><Sellos /></main></div>

  // the coordinator's control in each of the four states
  if (screen === 'admin-estado') {
    return (
      <div className="admin tower">
        <main className="admin-main">
          {(['disabled', 'enabled', 'started', 'finished', 'archived'] as const).map((phase) => (
            <PhaseControl key={phase} event={{ id: 'e1', name: 'Carrera 2710', is_active: phase !== 'disabled', phase, started_at: null, code: '2710', is_test: false, max_travel_minutes: 10 }} onChanged={noopAsync} />
          ))}
        </main>
      </div>
    )
  }

  // Carrera Habilitada: the base sees its screen with the buttons off, and can open the tutorial
  if (screen === 'base-habilitada') return <HabilitadaPreview user={inspector} />

  // ronda (jugando) / base-llegada (esperando a los grupos) / base-fin (ventanilla cerrada) / base-info (Mi base)
  if (screen === 'base' || screen === 'base-llegada' || screen === 'base-fin' || screen === 'base-info') {
    const onRound = screen !== 'base-info'
    return (
      <AppShell title={onRound ? 'Mi base' : 'Mi base'} showTitle={onRound} user={inspector} alerts>
       <div className="base-view" style={baseInk}>
        <div className="tab-view fwd">
        {screen === 'base-info' ? (
          <>
            <BaseSealCard id="x1" name="Atrio" />
            <BaseGuide
              info="Aquí se explica la historia de la Universidad."
              questions={[{ position: 1, question: '¿En qué año se fundó la Javeriana?', answer: 'En 1623.' }, { position: 2, question: '¿Quién es el patrono de la Universidad?', answer: 'San Francisco Javier.' }, { position: 3, question: '¿Cuántas facultades hay?', answer: 'Depende del año: revisa la lista oficial.' }, { position: 4, question: '¿Cómo se llama el lema de la Universidad?', answer: 'Veritas et Vita.' }, { position: 5, question: '¿Dónde queda la Biblioteca?', answer: 'En el edificio Alfonso Borrero.' }]}
            />
            <BaseWhere base={{ id: 'x1', name: 'Atrio', location_photo_path: '/campus-800.jpg', lat: 4.6286, lng: -74.0647 }} onChanged={noopAsync} />
          </>
        ) : (
          <>
            <BaseTicket name="Atrio" photoPath="/campus-800.jpg" sealed={screen === 'base-fin' ? 5 : 1} />
            {screen === 'base' && <MatchCard match={baseMatchPlaying} teams={teams} onSent={noopAsync} eventId="e1" base={previewBase} codes={baseCodes} />}
            {screen === 'base-llegada' && <MatchCard match={baseMatchPending} teams={teams} onSent={noopAsync} eventId="e1" base={previewBase} codes={baseCodes} legs={previewLegs} baseNames={previewBaseNames} />}
            {screen === 'base' && <NextRound match={baseMatchPending} teams={teams} />}
            {screen === 'base-fin' && <ClosedDesk name="Atrio" sealed={5} />}
          </>
        )}
        </div>
        <BottomNav tabs={baseTabs} active={onRound ? 'ronda' : 'base'} transition={false} onChange={noop} />
       </div>
      </AppShell>
    )
  }

  if (screen === 'admin-pasaportes') {
    return (
      <div className="admin tower">
        <AdminNav event={{ id: 'e1', name: 'Carrera 2710', code: '2710', phase: 'started' }} user={user} onSignOut={noop} />
        <main className="admin-main">
          <AdminTopbar user={user} onSignOut={noop} />
          <header className="page-head">
            <div>
              <p className="eyebrow">Passport Verification</p>
              <h1>Pasaportes</h1>
            </div>
          </header>
          <PassportMatrix teams={towerTeams} matches={towerMatches} baseName={towerBases} codes={towerCodes} />
        </main>
      </div>
    )
  }

  if (screen === 'admin' || screen === 'admin-carrera' || screen === 'admin-forms') {
    return (
      <div className="admin tower">
        <AdminNav event={{ id: 'e1', name: 'Carrera 2710', code: '2710', phase: 'started' }} user={user} onSignOut={noop} />
        <main className="admin-main">
          <AdminTopbar user={user} onSignOut={noop} />
          {screen === 'admin' || screen === 'admin-carrera' ? (
            screen === 'admin' ? (
              <>
                <header className="page-head">
                  <div>
                    <p className="eyebrow">Live Monitoring · Carrera 2027-1</p>
                    <h1>Control de vuelos</h1>
                  </div>
                  <div className="head-meta">
                    <span className="badge ok live">Activa</span>
                    <span>Ronda 2 de 2</span>
                    <button className="ghost">Descargar resultados</button>
                    <button className="ghost danger">Finalizar Carrera</button>
                  </div>
                </header>
                <div className="kpis">
                  <Kpi tone="accent" label="Ronda en curso" value="2/2" sub="0 de 2 cruces terminados" />
                  <Kpi label="En ruta" value={1} sub="vuelo hacia su destino" />
                  <Kpi label="En puerta" value={2} sub="la base confirmó su llegada" />
                  <Kpi label="Aterrizados" value="1/5" sub="con todos sus sellos" />
                  <Kpi tone="hot" label="Demoras" value={1} sub="vuelo tarde al traslado" />
                  <Kpi label="Radar" value="3/5" sub="vuelos con GPS" to="#" />
                </div>
                <FlightBoard teams={towerTeams} matches={towerMatches} baseName={towerBases} codes={towerCodes} lateIds={new Set(['t1'])} />
                <div className="live-grid">
                  <div>
                    <section className="card">
                      <div className="match-head">
                        <div>
                          <p className="eyebrow">Gate Management</p>
                          <h2>Puertas · Ronda 2</h2>
                        </div>
                        <span className="chip">0 de 2 terminados</span>
                      </div>
                      <ul className="list">
                        {towerMatches.filter((m) => m.round_number === 2).map((m) => (
                          <li key={m.id} className="mrow">
                            <span className="mbase"><b className="mono gate-code">{airportCode(towerBases.get(m.base_id) ?? '')}</b><strong>{towerBases.get(m.base_id)}</strong></span>
                            <span className="mteams">{towerNames.get(m.team_a)} <span className="muted mono">{towerCodes.get(m.team_a)}</span> <span className="muted">vs</span> {towerNames.get(m.team_b)} <span className="muted mono">{towerCodes.get(m.team_b)}</span></span>
                            <span className="mmeta"><span className={`badge ${m.status === 'in_progress' ? 'ok live' : ''}`}>{m.status === 'in_progress' ? 'En juego' : 'Pendiente'}</span></span>
                            <span className="mscore num">{m.status === 'in_progress' ? '1–0' : '–'}</span>
                            <span className="mact"><button className="ghost icon-btn" aria-label="Avisar a los grupos" title="Avisar a los dos grupos"><BellRing size={18} /></button><button className="ghost icon-btn" aria-label="Avisar a la base" title="Avisar a la base"><Flag size={18} /></button></span>
                            <span className="mdetail">{m.match_scores?.length ?? 0}/3 etapas{m.arrived_at ? ' · en puerta desde las 3:38 p. m.' : ''}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  </div>
                  <div>
                    <section className="card delay-list">
                      <h2>Demoras en el traslado</h2>
                      <ul className="list">
                        <li>
                          <span className="grow">
                            <strong>Ronda 2 · Cancha de Fútbol</strong>
                            <span className="match-names">Dioses Nórdicos: <span className="late">12 min</span> (máx. 10)<small className="muted"> · a 180 m de la base</small></span>
                          </span>
                          <button className="ghost"><BellRing size={17} aria-hidden="true" /> Avisar</button>
                        </li>
                      </ul>
                    </section>
                    <OpsLog events={towerOps} />
                    <section className="card">
                      <h2>Top equipos</h2>
                      <Ranking rows={standings.slice(0, 3)} />
                      <div className="row"><a className="btn-like" href="#">Ranking y puntajes <ChevronRight size={16} aria-hidden="true" /></a></div>
                    </section>
                  </div>
                </div>
              </>
            ) : (
              <>
                <header className="page-head">
                  <div>
                    <p className="eyebrow">Preparación</p>
                    <h1>Carrera</h1>
                  </div>
                  <p className="head-meta">Estado y activación, carga desde un archivo, tiempos de traslado y nuevas ediciones.</p>
                </header>
                <div className="live-grid">
                  <div>
                <PrepSteps eventId="e1" counts={{ teams: 4, bases: 3, users: 11, matches: 6, warnings: [] }} problems={['La base "Atrio" tiene 2 de 3 preguntas.']} phase="disabled" />
                <PrepReport phase="disabled" problems={['La base "Atrio" tiene 2 de 3 preguntas.']} warnings={['La base "Atrio" no tiene ubicación en el mapa.']} />
                <section className="card">
                  <h2>Carrera 2027-1</h2>
                  <p>
                    Estado: <span className="badge ok live">Activa</span>
                  </p>
                  <p className="muted">4 grupos · 2 bases</p>
                  <div className="fail-box">
                    <strong>Pendientes de la carrera activa:</strong>
                    <ul>
                      <li>El grupo "Samuráis" no tiene ningún corredor (usuario) asignado.</li>
                      <li>La base "Atrio" tiene 2 de 3 preguntas.</li>
                    </ul>
                  </div>
                  <div className="warn">
                    <strong>Recomendado revisar (no bloquea):</strong>
                    <ul>
                      <li>La base "Cancha" no tiene ubicación en el mapa.</li>
                    </ul>
                  </div>
                  <div className="row">
                    <button className="ghost">Desactivar Carrera</button>
                  </div>
                </section>
                <section className="card">
                  <h2>Cargar la carrera desde un archivo</h2>
                  <p className="muted">Crea la carrera, los grupos, las bases, los usuarios y los cruces de una vez con una plantilla.</p>
                  <div className="row"><a className="btn-like" href="#">Plantilla Word</a><a className="btn-like" href="#">Plantilla Excel</a><a className="btn-like" href="#">Carrera de prueba</a></div>
                </section>
                  </div>
                  <div>
                <h2 className="section-title">Alertas de demora</h2>
                <section className="card">
                  <h2>Tiempo general de traslado</h2>
                  <p className="muted">Si un grupo pasa más de este tiempo entre que termina una base y llega a la siguiente, suena una alerta a sus corredores.</p>
                  <div className="row"><label className="inline-field grow">Tiempo máximo general (minutos)<input defaultValue="10" /></label><button>Guardar</button></div>
                </section>
                <section className="card">
                  <h2>Nueva edición de la carrera</h2>
                  <label>Nombre (por ejemplo "Carrera 2027-2")<input defaultValue="" /></label>
                  <div className="row"><button>Crear Carrera</button></div>
                </section>
                <section className="card danger-zone">
                  <h2>Eliminar esta carrera</h2>
                  <p className="muted">Borra "Carrera 2027-1" con TODO lo suyo: grupos, bases, cruces, puntajes, registro de cambios, avisos, ubicaciones, tiempos, fotos y sus usuarios (corredores e inductores). No se puede deshacer.</p>
                  <label>Para confirmar, escribe el nombre de la carrera<input placeholder="Carrera 2027-1" /></label>
                  <div className="row"><button className="ghost danger" disabled>Eliminar Carrera</button></div>
                </section>
                  </div>
                </div>
                <h2 className="section-title">Rondas</h2>
                <RoundPager round={2} total={3} matches={2} finished={1} onChange={noop} showAll={false} onToggleAll={noop} />
                <div className="grid">
                  <RoundCard
                    round={1}
                    matches={adminMatches}
                    allMatches={adminMatches}
                    teams={standings.map((r) => ({ id: r.team_id, name: r.name }))}
                    bases={[{ id: 'x1', name: 'Atrio' }, { id: 'x2', name: 'Cancha de Fútbol' }, { id: 'x3', name: 'Biblioteca' }]}
                    teamName={new Map(standings.map((r) => [r.team_id, r.name]))}
                    baseName={new Map([['x1', 'Atrio'], ['x2', 'Cancha de Fútbol']])}
                    eventId="e1"
                    busy={false}
                    onChange={noopAsync}
                  />
                  <TeamCard team={teamRow} runners={profiles} free={profiles.slice(2)} onChange={noopAsync} />
                </div>
              </>
            )
          ) : (
            <>
              <h1>Usuarios</h1>
              <p className="muted">6 usuarios. Las contraseñas no se pueden consultar después: cópialas al crearlas.</p>
              <section className="card creds">
                <h2>Usuario creado: Nicolás Pérez</h2>
                <p>Usuario: <strong>nico</strong></p>
                <p>Contraseña: <strong className="mono">k7Pq3mXz</strong></p>
                <div className="row">
                  <button>Copiar</button>
                  <button className="ghost">Cerrar</button>
                </div>
              </section>
              <section className="card">
                <h2>Crear usuario</h2>
                <form className="form" onSubmit={(e) => e.preventDefault()}>
                  <label>Nombre completo<input defaultValue="María José Pérez" /></label>
                  <label>Usuario (para entrar)<input defaultValue="maria.perez" /></label>
                  <label>Rol<select defaultValue="runner"><option value="runner">Corredor</option><option>Inductor de base</option></select></label>
                  <label>Contraseña sugerida<div className="row"><input className="grow mono" defaultValue="Hs82WnQa" /><button type="button" className="ghost">Otra</button></div></label>
                  <p className="error">Ese usuario ya existe.</p>
                  <button type="submit">Crear usuario</button>
                </form>
              </section>
              <section className="card">
                <h2>Lista</h2>
                <ul className="list">
                  {[['Daniel Rodríguez', 'daniel', 'Corredor'], ['Vanesa Gómez', 'vanesa', 'Inductor de base'], ['María José Pérez Villamizar', 'maria.perez', 'Corredor']].map(([n, u, r]) => (
                    <li key={u}>
                      <Avatar name={n} size={44} />
                      <span className="grow">
                        {n}
                        <small className="muted"> @{u} · {r}</small>
                      </span>
                      <label className="btn-like icon-only" title="Agregar foto">
                        <Camera size={18} aria-hidden="true" />
                        <span className="sr-only">Agregar foto a {n}</span>
                      </label>
                      <button className="ghost"><KeyRound size={16} aria-hidden="true" /> Contraseña</button>
                      <button className="ghost danger icon-btn" aria-label={`Eliminar ${n}`}><Trash2 size={18} /></button>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="card">
                <h2>Cargar desde un archivo</h2>
                <p className="muted">Crea muchos usuarios de una vez con una plantilla de Word, Excel o CSV.</p>
                <div className="row"><a className="btn-like" href="#">Plantilla Word</a><a className="btn-like" href="#">Plantilla Excel</a></div>
                <p><strong>5</strong> filas leídas: <span className="ok-text">4 correctas</span>, <span className="error">1 con errores</span>.</p>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>#</th><th>Nombre</th><th>Rol</th><th>Grupo o base</th><th>Usuario</th><th>Estado</th></tr></thead>
                    <tbody>
                      <tr><td>2</td><td>Daniel Rodríguez</td><td>Corredor</td><td>Dioses Griegos · GPS</td><td className="mono">daniel.rodriguez</td><td><span className="badge ok">Correcta</span></td></tr>
                      <tr className="bad"><td>3</td><td>Vanesa Gómez</td><td>—</td><td>Dioses Griegos</td><td className="mono">vanesa.gomez</td><td>Rol no válido ("Capitán"). Usa "Corredor" o "Base".</td></tr>
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="card">
                <h2>Fotos</h2>
                <div className="row">
                  <Crest name="Dioses Griegos" size="xl" /> <Crest name="Samuráis" size="lg" /> <Crest name="Vikingos" /> <Crest name="Aztecas" size="sm" />
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    )
  }

  if (screen === 'map') {
    const c: [number, number] = [-74.0647, 4.6286]
    return (
      <AppShell title="Ubicación" user={user}>
        <section className="card map-card">
          <LazyMap
            height="420px"
            interactive={false}
            markers={[
              { id: 'b1', lng: c[0] + 0.0006, lat: c[1] + 0.0004, label: 'Atrio', kind: 'base' },
              { id: 'b2', lng: c[0] - 0.0007, lat: c[1] - 0.0003, label: 'Cancha de Fútbol', kind: 'base' },
              { id: 'b3', lng: c[0] - 0.0001, lat: c[1] - 0.0002, label: 'Biblioteca Alfonso Borrero', kind: 'base' },
              { id: 'me', lng: c[0] - 0.0002, lat: c[1] - 0.0001, label: 'Tu grupo', kind: 'me' },
            ]}
          />
        </section>
        <section className="card">
          <h2>Ubicación del grupo</h2>
          <p className="muted">Eres el usuario designado para el GPS del grupo: tu ubicación se comparte con el coordi. Deja la app abierta con la pantalla encendida mientras caminan.</p>
          <button className="btn-block"><LocateFixed size={20} aria-hidden="true" /> Compartir mi ubicación</button>
        </section>
        <BottomNav tabs={runnerTabs} active="ubicacion" onChange={noop} />
      </AppShell>
    )
  }

  return <p className="page">Pantallas: dialogs, base-resultados, logos, sin-carrera, sin-carrera-base, map, runner, runner-ruta, runner-alertas, runner-top, runner-fin, base, base-llegada, base-fin, base-demora, base-info, carga-fallida, admin, admin-carrera, admin-forms, inductores, pasaporte-corredor, pasaporte-base, pasaporte-coordi (?cultura=griega|mexicana|china|egipcia, ?portada)</p>
}
