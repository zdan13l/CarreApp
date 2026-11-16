import { LogOut, Moon, Sun } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../lib/theme'

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?'

// The person's avatar. Opens a small menu with who they are, the light / dark switch and "Cerrar sesión",
// so the top bar stays clean on a phone (one button instead of three) and in the coordinator's side menu.
export default function AccountMenu({
  user,
  onSignOut,
  placement = 'down',
  roleLabel,
}: {
  user?: { full_name: string; username: string }
  onSignOut: () => void
  placement?: 'down' | 'up'
  roleLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useTheme()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  const name = user?.full_name ?? ''
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <div className={`account ${placement}`} ref={ref}>
      <button
        type="button"
        className="avatar"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Cuenta de ${name || 'la persona'}`}
      >
        {initials(name)}
      </button>
      {open && (
        <div className="account-pop" role="menu">
          <div className="account-who">
            <strong>{name}</strong>
            <small>@{user?.username}{roleLabel ? ` · ${roleLabel}` : ''}</small>
          </div>
          <button type="button" role="menuitem" className="account-item" onClick={() => setTheme(next)}>
            {next === 'light' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
            {next === 'light' ? 'Modo claro' : 'Modo oscuro'}
          </button>
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
