import { BellOff, BellRing, Volume2, VolumeX, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { disableSound, enableSound, soundEnabled, useAudioRunning } from '../lib/alerts'
import { disablePush, enablePush, pushState, type PushState } from '../lib/push'

// Big attention banner for delays and coordinator messages.
export function AlertBanner({
  title,
  children,
  onDismiss,
}: {
  title: string
  children?: ReactNode
  onDismiss?: () => void
}) {
  return (
    <div className="alert-banner" role="alert">
      <BellRing size={24} aria-hidden="true" />
      <div className="grow">
        <strong>{title}</strong>
        {children && <p>{children}</p>}
      </div>
      {onDismiss && (
        <button className="ghost icon-btn" onClick={onDismiss} aria-label="Cerrar aviso" title="Cerrar aviso">
          <X size={18} />
        </button>
      )}
    </div>
  )
}

// iOS and browsers need a tap before they allow sound: this button unlocks it. After a reload or
// a lock the sound goes back to sleep until the next tap, and the label says so.
export function SoundToggle() {
  const [on, setOn] = useState(soundEnabled)
  const running = useAudioRunning()
  const asleep = on && !running
  return (
    <button
      type="button"
      className={`ghost sound-toggle${on ? ' on' : ''}${asleep ? ' asleep' : ''}`}
      aria-pressed={on}
      onClick={async () => {
        if (asleep) {
          await enableSound() // a tap wakes the audio up again
        } else if (on) {
          disableSound()
          setOn(false)
        } else {
          await enableSound()
          setOn(true)
        }
      }}
    >
      {on ? <Volume2 size={18} aria-hidden="true" /> : <VolumeX size={18} aria-hidden="true" />}
      {asleep ? 'Toca aquí para reactivar el sonido' : on ? 'Sonido de alertas activado' : 'Activar sonido de alertas'}
    </button>
  )
}

// Notifications that arrive even with the phone locked or the app closed (web push).
export function PushToggle() {
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void pushState().then(setState)
  }, [])

  if (state === null || state === 'unconfigured') return null
  if (state === 'unsupported') {
    return (
      <p className="muted push-note">
        Para recibir notificaciones con el teléfono bloqueado, instala la app en la pantalla de inicio (Compartir &gt;
        Agregar a pantalla de inicio) y ábrela desde ahí.
      </p>
    )
  }
  return (
    <>
      <button
        type="button"
        className={`ghost sound-toggle${state === 'on' ? ' on' : ''}`}
        disabled={busy || state === 'denied'}
        aria-pressed={state === 'on'}
        onClick={async () => {
          setBusy(true)
          setError(null)
          if (state === 'on') {
            await disablePush()
          } else {
            const err = await enablePush()
            if (err) setError(err)
          }
          setState(await pushState())
          setBusy(false)
        }}
      >
        {state === 'on' ? <BellRing size={18} aria-hidden="true" /> : <BellOff size={18} aria-hidden="true" />}
        {state === 'on'
          ? 'Notificaciones activadas'
          : state === 'denied'
            ? 'Notificaciones bloqueadas en el teléfono'
            : 'Activar notificaciones'}
      </button>
      {error && <p className="error">{error}</p>}
    </>
  )
}

// Both switches together, where each screen shows its alert settings.
export function AlertSettings() {
  return (
    <>
      <SoundToggle />
      <PushToggle />
    </>
  )
}
