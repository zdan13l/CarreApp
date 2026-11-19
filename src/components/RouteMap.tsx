import { Plane } from 'lucide-react'
import { airportCode } from '../lib/flight'

// The journey of a group drawn as a small chart: every destination of its route at the real position of the base (the
// coordinates the coordinator marked on the map), joined in the order of the rounds. Completed legs are solid, the rest are
// dashed, and the plane waits at the last completed destination, pointing at the next one. Bases without coordinates fall back
// to an evenly spaced path.
export interface RouteStop {
  id: string
  name: string
  lat: number | null
  lng: number | null
  state: 'done' | 'current' | 'pending'
}

const W = 300
const H_FLAT = 168
const H_TALL = 250 // the passport page has room: the chart is taller
const PAD = 26

function place(stops: RouteStop[], H: number): { x: number; y: number }[] {
  const real = stops.every((s) => s.lat !== null && s.lng !== null)
  if (real && stops.length >= 2) {
    const lat0 = (stops.reduce((n, s) => n + s.lat!, 0) / stops.length) * (Math.PI / 180)
    const pts = stops.map((s) => ({ x: s.lng! * Math.cos(lat0), y: -s.lat! }))
    const minX = Math.min(...pts.map((p) => p.x))
    const maxX = Math.max(...pts.map((p) => p.x))
    const minY = Math.min(...pts.map((p) => p.y))
    const maxY = Math.max(...pts.map((p) => p.y))
    const spanX = Math.max(maxX - minX, 1e-6)
    const spanY = Math.max(maxY - minY, 1e-6)
    const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY)
    const offX = (W - spanX * scale) / 2
    const offY = (H - spanY * scale) / 2
    return pts.map((p) => ({ x: offX + (p.x - minX) * scale, y: offY + (p.y - minY) * scale }))
  }
  const n = Math.max(stops.length, 1)
  return stops.map((_, i) => ({ x: PAD + ((W - PAD * 2) * i) / Math.max(n - 1, 1), y: H / 2 + Math.sin(i * 1.3) * 34 }))
}

export default function RouteMap({ stops, title, tall = false }: { stops: RouteStop[]; title: string; tall?: boolean }) {
  if (stops.length === 0) return null
  const H = tall ? H_TALL : H_FLAT
  const pos = place(stops, H)
  const lastDone = stops.reduce((idx, s, i) => (s.state === 'done' ? i : idx), -1)
  const planeAt = Math.max(lastDone, 0)
  const next = pos[Math.min(planeAt + (lastDone >= 0 ? 1 : 0), pos.length - 1)]
  const from = pos[planeAt]
  const angle = next && from && (next.x !== from.x || next.y !== from.y) ? (Math.atan2(next.y - from.y, next.x - from.x) * 180) / Math.PI : 0
  const done = stops.filter((s) => s.state === 'done').length

  return (
    <figure className="routemap">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. ${done} de ${stops.length} destinos completados: ${stops.map((s) => `${airportCode(s.name)} ${s.state === 'done' ? 'completado' : s.state === 'current' ? 'en curso' : 'pendiente'}`).join(', ')}.`}>
        <g className="rm-grid" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <line key={`v${i}`} x1={(W / 8) * i} y1="0" x2={(W / 8) * i} y2={H} />
          ))}
          {Array.from({ length: 5 }, (_, i) => (
            <line key={`h${i}`} x1="0" y1={(H / 4) * i} x2={W} y2={(H / 4) * i} />
          ))}
          <circle cx={W - 34} cy={H - 30} r="20" />
          <circle cx={W - 34} cy={H - 30} r="10" />
        </g>
        {pos.slice(1).map((p, i) => {
          const a = pos[i]
          const isDone = stops[i].state === 'done' && stops[i + 1].state !== 'pending'
          return <line key={`s${i}`} className={isDone ? 'rm-leg done' : 'rm-leg'} x1={a.x} y1={a.y} x2={p.x} y2={p.y} />
        })}
        {pos.map((p, i) => {
          const s = stops[i]
          const above = p.y > 24
          return (
            <g key={s.id} className={`rm-stop ${s.state}`} transform={`translate(${p.x} ${p.y})`}>
              {s.state === 'current' && <circle className="rm-pulse" r="9" />}
              <circle r={s.state === 'pending' ? 4.5 : 6} />
              {s.state === 'done' && <path className="rm-check" d="m-2.6 .2 1.8 1.9 3.4-3.7" />}
              <text className="rm-code" y={above ? -11 : 17} textAnchor="middle">
                {airportCode(s.name)}
              </text>
            </g>
          )
        })}
        <g className="rm-plane" transform={`translate(${pos[planeAt].x} ${pos[planeAt].y}) rotate(${angle + 45})`}>
          <Plane x={-8} y={-8} width={16} height={16} strokeWidth={1.8} />
        </g>
      </svg>
    </figure>
  )
}
