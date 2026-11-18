import { useEffect, useState } from 'react'
import { serverNow } from '../lib/clock'

// The clock of the control tower, corrected with the server clock like the delay alerts (a phone or laptop a few minutes off
// would make every time in the panel disagree with the bases).
export default function TowerClock() {
  const [now, setNow] = useState(() => serverNow())
  useEffect(() => {
    const id = window.setInterval(() => setNow(serverNow()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const d = new Date(now)
  return (
    <time className="tower-clock mono" dateTime={d.toISOString()}>
      {d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
    </time>
  )
}
