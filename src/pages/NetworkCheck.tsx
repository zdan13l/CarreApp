import { useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'

type Result = { label: string; ok: boolean; detail: string; ms: number }

async function timedFetch(label: string, url: string, init?: RequestInit): Promise<Result> {
  const start = performance.now()
  try {
    const res = await fetch(url, init)
    return { label, ok: res.status < 500, detail: `HTTP ${res.status}`, ms: Math.round(performance.now() - start) }
  } catch (e) {
    return { label, ok: false, detail: e instanceof Error ? e.message : 'error', ms: Math.round(performance.now() - start) }
  }
}

export default function NetworkCheck() {
  const [results, setResults] = useState<Result[]>([])
  const [running, setRunning] = useState(false)
  const [geo, setGeo] = useState('sin probar')

  async function run() {
    setRunning(true)
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY
    const checks: Promise<Result>[] = [
      timedFetch('Esta app (hosting)', window.location.origin + '/icon.svg'),
      timedFetch('Mapa OpenStreetMap', 'https://tile.openstreetmap.org/0/0/0.png', { mode: 'no-cors' }),
    ]
    if (url && key) {
      checks.push(timedFetch('Supabase (REST)', `${url}/rest/v1/`, { headers: { apikey: key } }))
      checks.push(timedFetch('Supabase (Auth)', `${url}/auth/v1/health`, { headers: { apikey: key } }))
    }
    setResults(await Promise.all(checks))
    setRunning(false)
  }

  function testGeo() {
    setGeo('solicitando…')
    navigator.geolocation.getCurrentPosition(
      (p) => setGeo(`OK: ${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)} (±${Math.round(p.coords.accuracy)} m)`),
      (e) => setGeo(`Error: ${e.message}`),
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true

  return (
    <main className="page">
      <h1>CarreApp</h1>
      <p className="muted">Bloque 0 · Prueba de red y dispositivo</p>

      <section className="card">
        <h2>Conectividad</h2>
        {!isSupabaseConfigured && (
          <p className="warn">Supabase no está configurado (falta .env.local). Solo se probará el hosting y el mapa.</p>
        )}
        <button onClick={run} disabled={running}>{running ? 'Probando…' : 'Probar conexión'}</button>
        <ul className="results">
          {results.map((r) => (
            <li key={r.label} className={r.ok ? 'ok' : 'fail'}>
              <strong>{r.ok ? '✔' : '✘'} {r.label}</strong>
              <span>{r.detail} · {r.ms} ms</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Dispositivo</h2>
        <p>Instalada como app: <strong>{standalone ? 'sí' : 'no'}</strong></p>
        <p>Notificaciones: <strong>{'Notification' in window ? Notification.permission : 'no soportadas (en iPhone instala la app primero)'}</strong></p>
        <p>Ubicación: <strong>{geo}</strong></p>
        <button onClick={testGeo}>Probar ubicación</button>
      </section>
    </main>
  )
}
