// Design preview (development only): renders the real components with sample data so the
// look can be reviewed without signing in. Not included in the production build.
//   /preview/runner  /preview/runner-ruta  /preview/runner-top
//   /preview/base    /preview/base-info    /preview/admin    /preview/admin-forms
import { Bell, BellRing, Camera, ChevronRight, KeyRound, LocateFixed, Trash2, Flag, MapPin, Route, Trophy } from 'lucide-react'
import { useParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Avatar from '../components/Avatar'
import BottomNav from '../components/BottomNav'
import Crest from '../components/Crest'
import Kpi from '../components/Kpi'
import LazyMap from '../components/LazyMap'
import LogoGallery from './LogoGallery'
import Ranking from '../components/Ranking'
import RoundPager from '../components/RoundPager'
import AdminNav, { AdminTopbar } from './admin/AdminNav'
import { TeamCard } from './admin/Grupos'
import { RoundCard } from './admin/Cruces'
import { BaseGuide, BaseWhere, MatchCard, TeamFace, type BaseMatch, type Team } from './BaseHome'
import { AfterCard, CurrentRound, RouteList, StatusBar, TopTab, type RouteMatch } from './RunnerHome'
import NoActiveCarrera from '../components/NoActiveCarrera'
import { confirmDialog, promptDialog } from '../lib/dialog'
import TeamNames from '../components/TeamNames'
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
  { id: 'ubicacion', label: 'Ubicación', icon: <LocateFixed {...ic} /> },
  { id: 'ruta', label: 'Ruta', icon: <Route {...ic} /> },
  { id: 'top', label: 'Top', icon: <Trophy {...ic} /> },
]
const baseTabs = [
  { id: 'ronda', label: 'Ronda', icon: <Flag {...ic} /> },
  { id: 'resultados', label: 'Resultados', icon: <Trophy {...ic} /> },
  { id: 'base', label: 'Mi base', icon: <MapPin {...ic} /> },
]
const noop = () => {}
const noopAsync = async () => {}

export default function Preview() {
  const { screen } = useParams()

  if (screen === 'logos') return <LogoGallery />

  if (screen === 'dialogs') {
    return (
      <AppShell title="Ventanas" user={user}>
        <section className="card">
          <h2>Ventanas emergentes</h2>
          <p className="muted">Toca cada botón para ver cómo se ve.</p>
          <div className="row">
            <button onClick={() => void promptDialog({ title: 'Avisar a la base', message: 'Les llega como notificación y les suena el teléfono.', label: 'Mensaje', defaultValue: 'Apúrense con el juego: el siguiente cruce está esperando.', confirmLabel: 'Enviar aviso', icon: 'bell' })}>Mensaje</button>
            <button className="ghost" onClick={() => void confirmDialog({ title: '¿Enviar los resultados?', message: 'Una vez enviados solo el coordinador puede corregirlos.', details: ['Barra: Dioses Griegos', 'Pregunta: Samuráis', 'Minijuego: Dioses Griegos'], confirmLabel: 'Enviar resultados', icon: 'send' })}>Resultados</button>
            <button className="ghost danger" onClick={() => void confirmDialog({ title: '¿Eliminar la base "Atrio"?', message: 'Se borran también sus cruces y los puntos registrados.', confirmLabel: 'Eliminar base', tone: 'danger', icon: 'trash' })}>Eliminar</button>
            <button className="ghost" onClick={() => void confirmDialog({ title: '¿Cerrar sesión?', message: 'Este teléfono dejará de recibir los avisos de la Carrera.', confirmLabel: 'Cerrar sesión', icon: 'logout' })}>Salir</button>
          </div>
        </section>
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

  if (screen === 'runner' || screen === 'runner-ruta' || screen === 'runner-top') {
    const tab = screen === 'runner' ? 'ronda' : screen === 'runner-ruta' ? 'ruta' : 'top'
    return (
      <AppShell
        title="Mi grupo"
        user={user}
        topActions={
          <button className="ghost icon-btn bell" aria-label="Ajustes de alertas">
            <Bell size={20} />
            <span className="dot" aria-hidden="true" />
          </button>
        }
      >
        <StatusBar name="Dioses Griegos" photoPath={null} />
        {tab === 'ronda' && (
          <>
            <CurrentRound match={routeMatches[1]} myId="t0" teams={teamById} />
            <AfterCard match={routeMatches.find((m) => m.round_number === 4)!} myId="t0" teams={teamById} />
          </>
        )}
        {tab === 'ruta' && (
          <section className="card">
            <h2>Tu ruta</h2>
            <RouteList mine={routeMatches} totalRounds={4} myId="t0" nextId="m2" teams={teamById} />
          </section>
        )}
        {tab === 'top' && <TopTab teamId="t0" points={7} teams={standings.map((r) => ({ team_id: r.team_id, name: r.name, photo_path: r.photo_path }))} />}
        <BottomNav tabs={runnerTabs} active={tab} onChange={noop} />
      </AppShell>
    )
  }

  if (screen === 'base-resultados') {
    return (
      <AppShell title="Atrio" user={{ full_name: 'Valeria Gómez', username: 'valeria' }}>
        <section className="card">
          <h2>Equipos de la Carrera</h2>
          <TeamNames teams={[...teams.values()]} />
        </section>
        <section className="card">
          <h2>Cruces de tu base (2)</h2>
          <ul className="list">
            <li className="with-items"><span className="round-tag">R1</span><span className="grow">Dioses Griegos <span className="muted">vs</span> Samuráis</span><strong className="num">2–1</strong>
              <ul className="won-items"><li><span>Barra</span><b>Dioses Griegos</b></li><li><span>Pregunta</span><b>Samuráis</b></li><li><span>Minijuego</span><b>Dioses Griegos</b></li></ul></li>
            <li className="with-items"><span className="round-tag">R2</span><span className="grow">Dioses Nórdicos <span className="muted">vs</span> Guerreros Aztecas</span><strong className="num">1–2</strong>
              <ul className="won-items"><li><span>Barra</span><b>Guerreros Aztecas</b></li><li><span>Pregunta</span><b>Invalidado</b></li><li><span>Minijuego</span><b>Dioses Nórdicos</b></li></ul></li>
          </ul>
        </section>
        <BottomNav tabs={baseTabs} active="resultados" onChange={noop} />
      </AppShell>
    )
  }

  if (screen === 'base' || screen === 'base-info') {
    return (
      <AppShell title={screen === 'base' ? 'Atrio' : 'Mi base'} user={{ full_name: 'Valeria Gómez', username: 'valeria' }}>
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
          <>
            <BaseGuide
              info="Aquí se explica la historia de la Universidad."
              questions={[{ position: 1, question: '¿En qué año se fundó la Javeriana?' }, { position: 2, question: '¿Quién es el patrono de la Universidad?' }, { position: 3, question: '¿Cuántas facultades hay?' }]}
            />
            <BaseWhere base={{ id: 'x1', name: 'Atrio', location_photo_path: null, lat: 4.6286, lng: -74.0647 }} onChanged={noopAsync} />
          </>
        )}
        <BottomNav tabs={baseTabs} active={screen === 'base' ? 'ronda' : 'base'} onChange={noop} />
      </AppShell>
    )
  }

  if (screen === 'admin' || screen === 'admin-carrera' || screen === 'admin-forms') {
    return (
      <div className="admin">
        <AdminNav eventName="Carrera 2027-1" user={user} onSignOut={noop} />
        <main className="admin-main">
          <AdminTopbar user={user} onSignOut={noop} />
          {screen === 'admin' || screen === 'admin-carrera' ? (
            screen === 'admin' ? (
              <>
                <header className="page-head">
                  <div>
                    <p className="eyebrow">Carrera 2027-1</p>
                    <h1>En vivo</h1>
                  </div>
                  <div className="head-meta">
                    <span className="badge ok live">Activa</span>
                    <span>Ronda 2 de 3</span>
                  </div>
                </header>
                <div className="kpis">
                  <Kpi tone="accent" label="Ronda en curso" value="2/3" sub="1 de 3 cruces terminados" />
                  <Kpi label="Cruces" value="3/6" sub="terminados en la Carrera" to="#" />
                  <Kpi tone="hot" label="Demoras" value={1} sub="grupo tarde al traslado" />
                  <Kpi label="Ubicación" value="3/4" sub="grupos compartiendo GPS" to="#" />
                </div>
                <div className="live-grid">
                  <div>
                    <section className="card">
                      <div className="match-head">
                        <h2>Ronda 2</h2>
                        <span className="chip">1 de 3 terminados</span>
                      </div>
                      <ul className="list">
                        <li className="mrow">
                          <span className="mbase"><strong>Atrio</strong></span>
                          <span className="mteams">Dioses Griegos <span className="muted">vs</span> Samuráis</span>
                          <span className="mmeta"><span className="badge ok live">En juego</span></span>
                          <span className="mscore num">1–0</span>
                          <span className="mact"><button className="ghost icon-btn" aria-label="Avisar a los grupos" title="Avisar a los dos grupos"><BellRing size={18} /></button><button className="ghost icon-btn" aria-label="Avisar a la base" title="Avisar a la base"><Flag size={18} /></button></span>
                          <span className="mdetail">1/3 ítems · llegaron a las 10:08 a. m.</span>
                        </li>
                        <li className="mrow">
                          <span className="mbase"><strong>Cancha de Fútbol</strong></span>
                          <span className="mteams">Dioses Nórdicos <span className="muted">vs</span> Guerreros Aztecas</span>
                          <span className="mmeta"><span className="badge">Pendiente</span></span>
                          <span className="mscore num">–</span>
                          <span className="mact"><button className="ghost icon-btn" aria-label="Avisar a los grupos" title="Avisar a los dos grupos"><BellRing size={18} /></button><button className="ghost icon-btn" aria-label="Avisar a la base" title="Avisar a la base"><Flag size={18} /></button></span>
                          <span className="mdetail">0/3 ítems</span>
                        </li>
                        <li className="mrow">
                          <span className="mbase"><strong>Biblioteca</strong></span>
                          <span className="mteams">Samuráis Rojos <span className="muted">vs</span> Gladiadores</span>
                          <span className="mmeta"><span className="badge ok">Terminado</span></span>
                          <span className="mscore num">2–1</span>
                          <span className="mact" />
                          <span className="mdetail">3/3 ítems</span>
                        </li>
                      </ul>
                      <div className="row"><a className="btn-like" href="#">Cronograma completo <ChevronRight size={16} aria-hidden="true" /></a></div>
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
                <section className="card">
                  <h2>Carrera 2027-1</h2>
                  <p>
                    Estado: <span className="badge ok live">Activa</span>
                  </p>
                  <p className="muted">4 grupos · 2 bases</p>
                  <div className="fail-box">
                    <strong>Pendientes de la Carrera activa:</strong>
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
                  <h2>Cargar la Carrera desde un archivo</h2>
                  <p className="muted">Crea la Carrera, los grupos, las bases, los usuarios y los cruces de una vez con una plantilla.</p>
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
                  <h2>Nueva edición de la Carrera</h2>
                  <label>Nombre (por ejemplo "Carrera 2027-2")<input defaultValue="" /></label>
                  <div className="row"><button>Crear Carrera</button></div>
                </section>
                <section className="card danger-zone">
                  <h2>Eliminar esta Carrera</h2>
                  <p className="muted">Borra "Carrera 2027-1" con TODO lo suyo: grupos, bases, cruces, puntajes, registro de cambios, avisos, ubicaciones, tiempos, fotos y sus usuarios (corredores e inductores). No se puede deshacer.</p>
                  <label>Para confirmar, escribe el nombre de la Carrera<input placeholder="Carrera 2027-1" /></label>
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
                  {[['Daniel Rodríguez', 'daniel', 'Corredor'], ['Valeria Gómez', 'valeria', 'Inductor de base'], ['María José Pérez Villamizar', 'maria.perez', 'Corredor']].map(([n, u, r]) => (
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
          <p className="muted">Eres el usuario designado para el GPS del grupo: tu ubicación se comparte con el coordinador. Deja la app abierta con la pantalla encendida mientras caminan.</p>
          <button className="btn-block"><LocateFixed size={20} aria-hidden="true" /> Compartir mi ubicación</button>
        </section>
        <BottomNav tabs={runnerTabs} active="ubicacion" onChange={noop} />
      </AppShell>
    )
  }

  return <p className="page">Pantallas: dialogs, base-resultados, logos, sin-carrera, sin-carrera-base, map, runner, runner-ruta, runner-alertas, runner-top, base, base-info, admin, admin-carrera, admin-forms</p>
}
