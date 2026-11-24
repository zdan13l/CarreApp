import { LogOut, Moon, Sun, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../lib/theme'
import { useScrollLock } from '../lib/scrollLock'
import { useSoundEnabled } from '../lib/alerts'
import Avatar from './Avatar'
import { AlertSettings } from './Alerts'

// The person: their picture (or initials) with their name and @user beside it. On the coordinator's panel it opens a small menu; on the
// phone (`short`) it opens a sheet with the picture big, the light / dark switch and "Cerrar sesión".
export default function AccountMenu({
  user,
  onSignOut,
  placement = 'down',
  roleLabel,
  showTheme = true,
  short = false,
  alerts = false,
}: {
  user?: { full_name: string; username: string; photo_path?: string | null }
  onSignOut: () => void
  placement?: 'down' | 'up'
  roleLabel?: string
  showTheme?: boolean // the switch light / dark
  short?: boolean // phone top bar: the button shows the @user and opens a sheet
  alerts?: boolean // the sheet also holds the sound and notification switches (runners and bases)
}) {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useTheme()
  const ref = useRef<HTMLDivElement>(null)
  const soundOn = useSoundEnabled()
  useScrollLock(open && short)

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') setOpen(false)
      } else if (!short && !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open, short])

  const name = user?.full_name ?? ''
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <div className={`account ${placement}`} ref={ref}>
      <button
        type="button"
        className="account-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup={short ? 'dialog' : 'menu'}
        aria-expanded={open}
        aria-label={`Cuenta de ${name || 'la persona'}`}
      >
        <Avatar name={name} photoPath={user?.photo_path} size={38} />
        <span className="account-text">
          <strong>{short ? `@${user?.username ?? ''}` : name}</strong>
          {!short && <small>@{user?.username}</small>}
        </span>
        {short && alerts && !soundOn && <span className="dot" aria-hidden="true" />}
      </button>
      {open && short &&
        createPortal(
          <div className="sheet-backdrop centered" role="presentation" onClick={() => setOpen(false)}>
            <section className="account-sheet" role="dialog" aria-modal="true" aria-label="Mi cuenta" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="ghost icon-btn sheet-x" onClick={() => setOpen(false)} aria-label="Cerrar" title="Cerrar">
                <X size={18} />
              </button>
              <span className="account-photo">
                <Avatar name={name} photoPath={user?.photo_path} size={148} />
              </span>
              <h2>{name}</h2>
              <p className="account-handle">@{user?.username}</p>
              {roleLabel && <p className="account-role">{roleLabel}</p>}
              <div className="account-actions">
                {showTheme && (
                  <button type="button" className="ghost account-action" onClick={() => setTheme(next)}>
                    {next === 'light' ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
                    {next === 'light' ? 'Modo claro' : 'Modo oscuro'}
                  </button>
                )}
                {alerts && <AlertSettings />}
                <button
                  type="button"
                  className="ghost account-action danger"
                  onClick={() => {
                    setOpen(false)
                    onSignOut()
                  }}
                >
                  <LogOut size={20} aria-hidden="true" />
                  Cerrar sesión
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )}
      {open && !short && (
        <div className="account-pop" role="menu">
          <div className="account-who">
            <strong>{name}</strong>
            <small>@{user?.username}{roleLabel ? ` · ${roleLabel}` : ''}</small>
          </div>
          {showTheme && (
            <button type="button" role="menuitem" className="account-item" onClick={() => setTheme(next)}>
              {next === 'light' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
              {next === 'light' ? 'Modo claro' : 'Modo oscuro'}
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="account-item danger"
            onClick={() => {
              setOpen(false)
              onSignOut()
            }}
          >
            <LogOut size={18} aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}
