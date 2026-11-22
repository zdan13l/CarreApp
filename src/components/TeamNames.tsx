import { ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import Crest from './Crest'

const PRESS_DELAY_MS = 100 // a finger must stay put this long before the row lights up
const MOVE_PX = 8

// Every group of the Carrera by name and picture (alphabetical): no scores and no order of merit, so nobody on a phone
// can tell who is ahead before the coordinator announces it.
export default function TeamNames({ teams, highlightId, onSelect }: { teams: { id: string; name: string; photo_path: string | null }[]; highlightId?: string; onSelect?: (id: string) => void }) {
  const sorted = [...teams].sort((a, b) => a.name.localeCompare(b.name))
  // The row lights up yellow while it is PRESSED, not while a finger scrolls past it: the light waits a moment and is dropped as soon as
  // the finger moves or the browser takes the touch to scroll (pointercancel).
  const [pressed, setPressed] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const flash = (id: string) => {
    // a quick tap never waits for the press delay: the chosen row lights up for a moment while its card opens
    window.clearTimeout(timer.current)
    setPressed(id)
    timer.current = window.setTimeout(() => setPressed(null), 450)
  }
  const release = () => {
    window.clearTimeout(timer.current)
    origin.current = null
    setPressed(null)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return (
    <ul className="team-names">
      {sorted.map((t) => (
        <li key={t.id} className={t.id === highlightId ? 'mine' : undefined}>
          {onSelect ? (
            <button
              type="button"
              className="team-row"
              data-pressed={pressed === t.id}
              onClick={() => {
                flash(t.id)
                onSelect(t.id)
              }}
              onPointerDown={(e) => {
                origin.current = { x: e.clientX, y: e.clientY }
                window.clearTimeout(timer.current)
                timer.current = window.setTimeout(() => setPressed(t.id), PRESS_DELAY_MS)
              }}
              onPointerMove={(e) => {
                const o = origin.current
                if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > MOVE_PX) release()
              }}
              onPointerCancel={release}
              onPointerLeave={release}
              aria-haspopup="dialog"
              aria-label={`Ver al equipo ${t.name}`}
            >
              <Crest name={t.name} photoPath={t.photo_path} />
              <span className="team-name">{t.name}</span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          ) : (
            <>
              <Crest name={t.name} photoPath={t.photo_path} />
              <span className="team-name">{t.name}</span>
            </>
          )}
        </li>
      ))}
    </ul>
  )
}
