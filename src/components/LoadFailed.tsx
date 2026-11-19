import { WifiOff } from 'lucide-react'

// What a runner or an inductor sees when the first request fails (bad signal): NOT "no active Carrera", which would send
// them to the coordinator for nothing. The screen retries by itself, and the button retries right now.
export default function LoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="empty-state" role="alert">
      <span className="empty-icon" aria-hidden="true"><WifiOff size={34} /></span>
      <h2>No pudimos cargar tu pantalla</h2>
      <p className="muted">Parece un problema de conexión. Seguimos intentando solos; si ya tienes señal, reintenta ahora.</p>
      <button type="button" className="ghost" onClick={onRetry}>Reintentar</button>
    </section>
  )
}
