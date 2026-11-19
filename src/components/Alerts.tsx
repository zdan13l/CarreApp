import { BellOff, BellRing, Volume2, VolumeX, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { disableSound, enableSound, useAudioRunning, useSoundEnabled } from '../lib/alerts'
import { useScrollLock } from '../lib/scrollLock'
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
  const on = useSoundEnabled()
  const running = useAudioRunning()
  const asleep = on && !running
  // Any tap in the app wakes the audio up (see lib/alerts) just BEFORE the click arrives: what the button looked like when the
  // finger went down decides what the tap means, otherwise "wake the sound up" would turn it off.
  const asleepOnPress = useRef(false)
  return (
    <button
      type="button"
      className={`ghost sound-toggle${on ? ' on' : ''}${asleep ? ' asleep' : ''}`}
      aria-pressed={on}
      onPointerDown={() => {
        asleepOnPress.current = asleep
      }}
      onClick={async () => {
        if (asleepOnPress.current) {
          asleepOnPress.current = false
          await enableSound() // the tap wakes the audio up again
        } else if (on) {
          disableSound()
        } else {
          await enableSound()
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

// The bell of the top bar: its icon says whether the sound is on (ringing bell) or off (crossed bell with a dot), and it opens the
// alert settings as a sheet under the bar, on top of everything, closed with a tap outside, the X or Escape.
export function AlertBell() {
  const [open, setOpen] = useState(false)
  const on = useSoundEnabled()
  useScrollLock(open)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  return (
    <>
      <button
        type="button"
        className={`ghost icon-btn bell${on ? ' is-on' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="Ajustes de alertas"
        aria-expanded={open}
        title="Ajustes de alertas"
      >
        {on ? <BellRing size={20} /> : <BellOff size={20} />}
        {!on && <span className="dot" aria-hidden="true" />}
      </button>
      {open && (
        <>
          <div className="sheet-backdrop" role="presentation" onClick={() => setOpen(false)} />
          <section className="alerts-sheet" role="dialog" aria-label="Alertas">
            <header>
              <h2>Alertas</h2>
              <button type="button" className="ghost icon-btn" onClick={() => setOpen(false)} aria-label="Cerrar" title="Cerrar">
                <X size={18} />
              </button>
            </header>
            <AlertSettings />
          </section>
        </>
      )}
    </>
  )
}
