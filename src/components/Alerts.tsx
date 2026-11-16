import { BellRing, Volume2, VolumeX, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { disableSound, enableSound, soundEnabled } from '../lib/alerts'

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

// iOS and browsers need a tap before they allow sound: this button unlocks it.
export function SoundToggle() {
  const [on, setOn] = useState(soundEnabled)
  return (
    <button
      type="button"
      className={`ghost sound-toggle${on ? ' on' : ''}`}
      aria-pressed={on}
      onClick={async () => {
        if (on) {
          disableSound()
          setOn(false)
        } else {
          await enableSound()
          setOn(true)
        }
      }}
    >
      {on ? <Volume2 size={18} aria-hidden="true" /> : <VolumeX size={18} aria-hidden="true" />}
      {on ? 'Sonido de alertas activado' : 'Activar sonido de alertas'}
    </button>
  )
}
