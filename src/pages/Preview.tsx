// Design preview (development only): renders the real components with sample data so the
// look can be reviewed without signing in. Not included in the production build.
//   /preview/runner  /preview/runner-ruta  /preview/runner-top
//   /preview/base    /preview/base-info    /preview/admin    /preview/admin-forms
import { Check, Compass, Flag, MapPin, Route, Trophy } from 'lucide-react'
import { useParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import BottomNav from '../components/BottomNav'
import Crest from '../components/Crest'
import LazyMap from '../components/LazyMap'
import PhotoField from '../components/PhotoField'
import Ranking from '../components/Ranking'
import RoundPager from '../components/RoundPager'
import AdminNav, { AdminTopbar } from './admin/AdminNav'
import { TeamCard } from './admin/Grupos'
import { RoundCard } from './admin/Cruces'
import { MatchCard, TeamFace, type BaseMatch, type Team } from './BaseHome'
import { CurrentRound, ItemResults, RouteList, StatusBar, type RouteMatch } from './RunnerHome'
import type { MatchRow, StandingRow, TeamRow } from '../types'

const user = { full_name: 'Daniel Rodríguez', username: 'daniel' }
const names = ['Dioses Griegos', 'Dioses Nórdicos', 'Samuráis', 'Guerreros Aztecas']
const standings: StandingRow[] = names.map((name, i) => ({ team_id: `t${i}`, name, photo_path: null, points: [7, 5, 5, 2][i] }))
const teamById = new Map(standings.map((r) => [r.team_id, r]))
const teams = new Map<string, Team>(standings.map((r) => [r.team_id, { id: r.team_id, name: r.name, photo_path: null }]))
const base = { name: 'Atrio', location_photo_path: null, lat: 4.6286, lng: -74.0647 }

const routeMatches: RouteMatch[] = [
  { id: 'm1', round_number: 1, base_id: 'x1', finished_at: null, team_a: 't0', team_b: 't1', status: 'finished', arrived_at: '2026-01-20T10:00:00Z', bases: base,
    match_scores: [{ item: 'barra', winner_team_id: 't0', voided: false }, { item: 'pregunta', winner_team_id: 't1', voided: false }, { item: 'minijuego', winner_team_id: 't0', voided: false }] },
  { id: 'm2', round_number: 2, base_id: 'x1', finished_at: null, team_a: 't0', team_b: 't2', status: 'in_progress', arrived_at: '2026-01-20T10:30:00Z', bases: { ...base, name: 'Biblioteca Alfonso Borrero' },
    match_scores: [{ item: 'barra', winner_team_id: 't2', voided: false }, { item: 'pregunta', winner_team_id: null, voided: true }] },
  { id: 'm3', round_number: 4, base_id: 'x1', finished_at: null, team_a: 't3', team_b: 't0', status: 'pending', arrived_at: null, bases: { ...base, name: 'Cancha de Fútbol' }, match_scores: [] },
]

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
  { id: 'u2', username: 'valeria', full_name: 'Valeria Gómez', role: 'runner' as const },
  { id: 'u3', username: 'nico', full_name: 'Nicolás Pérez', role: 'runner' as const },
]
const adminMatches: MatchRow[] = [
  { id: 'a1', round_number: 1, base_id: 'x1', team_a: 't0', team_b: 't1', status: 'finished', arrived_at: '2026-01-20T10:05:00Z', finished_at: '2026-01-20T10:20:00Z' },
  { id: 'a2', round_number: 1, base_id: 'x2', team_a: 't2', team_b: 't3', status: 'in_progress', arrived_at: '2026-01-20T10:08:00Z', finished_at: null },
]

const ic = { size: 22, strokeWidth: 1.9 } as const
const runnerTabs = [
  { id: 'ronda', label: 'Ronda', icon: <Flag {...ic} /> },
  { id: 'mapa', label: 'Mapa', icon: <Compass {...ic} /> },
  { id: 'ruta', label: 'Ruta', icon: <Route {...ic} /> },
  { id: 'top', label: 'Top', icon: <Trophy {...ic} /> },
]
const baseTabs = [
  { id: 'base', label: 'Mi base', icon: <MapPin {...ic} /> },
  { id: 'ronda', label: 'Ronda', icon: <Flag {...ic} /> },
  { id: 'top', label: 'Top', icon: <Trophy {...ic} /> },
  { id: 'terminados', label: 'Terminados', icon: <Check {...ic} /> },
]
const noop = () => {}
const noopAsync = async () => {}

export default function Preview() {
  const { screen } = useParams()

  if (screen === 'runner' || screen === 'runner-ruta' || screen === 'runner-top') {
    const tab = screen === 'runner' ? 'ronda' : screen === 'runner-ruta' ? 'ruta' : 'top'
    return (
      <AppShell title="Mi grupo" user={user}>
        <StatusBar name="Dioses Griegos" photoPath={null} position={1} points={7} />
        {tab === 'ronda' && (
          <>
            <CurrentRound match={routeMatches[1]} myId="t0" teams={teamById} />
            <section className="card">
              <h2>Ronda 1 terminada</h2>
              <p className="muted">vs Dioses Nórdicos · 2–1</p>
              <ItemResults match={routeMatches[0]} teams={teamById} />
            </section>
          </>
        )}
        {tab === 'ruta' && (
          <section className="card">
            <h2>Tu ruta</h2>
            <RouteList mine={routeMatches} totalRounds={4} myId="t0" nextId="m2" teams={teamById} />
          </section>
        )}
        {tab === 'top' && (
          <section className="card">
            <h2>Top equipos</h2>
            <Ranking rows={standings} highlightId="t0" />
          </section>
        )}
        <BottomNav tabs={runnerTabs} active={tab} onChange={noop} />
      </AppShell>
    )
  }

  if (screen === 'base' || screen === 'base-info') {
    return (
      <AppShell title="Atrio" user={{ full_name: 'Valeria Gómez', username: 'valeria' }}>
        {screen === 'base' ? (
          <>
            <MatchCard match={baseMatchPlaying} teams={teams} onSent={noopAsync} />
            <section className="card next">
              <h3>Próxima ronda · R3</h3>
              <div className="versus small">
                <TeamFace team={teams.get('t0')} />
                <span className="vs dim">VS</span>
                <TeamFace team={teams.get('t3')} />
              </div>
            </section>
            <MatchCard match={baseMatchPending} teams={teams} onSent={noopAsync} />
          </>
        ) : (
          <section className="card">
            <h2>Dónde queda</h2>
            <PhotoField path={null} label="Atrio" busy={false} onPick={noop} />
            <p className="muted">¿La base se movió? Cambia la foto y la ubicación en el mapa para que los grupos la encuentren.</p>
            <h3>Posibles preguntas</h3>
            <ol className="questions">
              <li>¿En qué año se fundó la Universidad?</li>
              <li>¿Cómo se llama el patrono de la Javeriana?</li>
              <li>¿Cuántas facultades hay?</li>
            </ol>
          </section>
        )}
        <BottomNav tabs={baseTabs} active={screen === 'base' ? 'ronda' : 'base'} onChange={noop} />
      </AppShell>
    )
  }

  if (screen === 'admin' || screen === 'admin-forms') {
    return (
      <div className="admin">
        <AdminNav eventName="Carrera 2027-1" user={user} onSignOut={noop} />
        <main className="admin-main">
          <AdminTopbar onSignOut={noop} />
          {screen === 'admin' ? (
            <>
              <h1>Resumen de la Carrera</h1>
              <section className="card">
                <h2>Carrera 2027-1</h2>
                <p>
                  Estado: <span className="badge ok live">Activa</span>
                </p>
                <p className="muted">4 grupos · 2 bases</p>
                <div className="fail-box">
                  <strong>Pendientes de la Carrera activa:</strong>
                  <ul>
                    <li>El grupo "Samuráis" tiene 1 de 2 corredores como mínimo.</li>
                    <li>La base "Atrio" tiene 2 de 3 preguntas.</li>
                  </ul>
                </div>
                <div className="warn">
                  <strong>Recomendado revisar (no bloquea):</strong>
                  <ul>
                    <li>La base "Cancha" no tiene ubicación en el mapa.</li>
                  </ul>
                </div>
                <p className="ok-box">Todo completo: fotos, 2 corredores por grupo, información y 3 preguntas por base.</p>
                <div className="row">
                  <button className="ghost">Desactivar Carrera</button>
                </div>
              </section>
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
                <h2>Cargar desde un archivo</h2>
                <p className="muted">Crea muchos usuarios de una vez con una plantilla de Word, Excel o CSV.</p>
                <div className="row"><a className="btn-like" href="#">Plantilla Word</a><a className="btn-like" href="#">Plantilla Excel</a></div>
                <p><strong>5</strong> filas leídas: <span className="ok-text">4 correctas</span>, <span className="error">1 con errores</span>.</p>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>#</th><th>Nombre</th><th>Rol</th><th>Grupo o base</th><th>Usuario</th><th>Estado</th></tr></thead>
                    <tbody>
                      <tr><td>2</td><td>Daniel Rodríguez</td><td>Corredor</td><td>Dioses Griegos · GPS</td><td className="mono">daniel.rodriguez</td><td><span className="badge ok">Correcta</span></td></tr>
                      <tr className="bad"><td>3</td><td>Valeria Gómez</td><td>—</td><td>Dioses Griegos</td><td className="mono">valeria.gomez</td><td>Rol no válido ("Capitán"). Usa "Corredor" o "Base".</td></tr>
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
      <AppShell title="Mapa" user={user}>
        <section className="card map-card">
          <LazyMap
            height="520px"
            markers={[
              { id: 'b1', lng: c[0] + 0.0006, lat: c[1] + 0.0004, label: 'Atrio', kind: 'base' },
              { id: 'b2', lng: c[0] - 0.0007, lat: c[1] - 0.0003, label: 'Cancha de Fútbol', kind: 'base' },
              { id: 't1', lng: c[0] + 0.0001, lat: c[1] + 0.0001, label: 'Dioses Griegos', kind: 'team' },
              { id: 't2', lng: c[0] - 0.0003, lat: c[1] + 0.0005, label: 'Samuráis', kind: 'team', stale: true },
              { id: 'me', lng: c[0] - 0.0002, lat: c[1] - 0.0001, label: 'Tú', kind: 'me' },
              { id: 'target', lng: c[0] + 0.0006, lat: c[1] + 0.0004, label: 'Atrio', kind: 'target' },
            ]}
            route={[[c[0] - 0.0002, c[1] - 0.0001], [c[0] + 0.0001, c[1] + 0.0001], [c[0] + 0.0004, c[1] + 0.0003], [c[0] + 0.0006, c[1] + 0.0004]]}
          />
        </section>
        <section className="card">
          <h2>Cómo llegar a Atrio</h2>
          <p className="route-summary"><strong>240 m</strong> · 4 min a pie</p>
          <p className="next-step"><Compass size={22} aria-hidden="true" /><span>Gira a la derecha en la Carrera 7<small className="muted"> · 90 m</small></span></p>
        </section>
      </AppShell>
    )
  }

  return <p className="page">Pantallas: map, runner, runner-ruta, runner-top, base, base-info, admin, admin-forms</p>
}
