import { AlertTriangle, Bell, CircleHelp, LogOut, Send, Trash2, CheckCircle2, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useScrollLock } from '../lib/scrollLock'
import { registerDialogHost, type DialogIcon, type DialogRequest } from '../lib/dialog'

const ICONS: Record<DialogIcon, LucideIcon> = {
  question: CircleHelp,
  warning: AlertTriangle,
  bell: Bell,
  logout: LogOut,
  trash: Trash2,
  send: Send,
  check: CheckCircle2,
}

// Draws the pop-ups asked for with confirmDialog / promptDialog: a card over a dimmed background (a sheet from the
// bottom on a phone), one thing to decide, big buttons, Escape or the background to cancel.
export default function DialogHost() {
  const [queue, setQueue] = useState<DialogRequest[]>([])
  const [text, setText] = useState('')
  const first = useRef<HTMLElement | null>(null)

  useEffect(() => {
    registerDialogHost((req) => {
      setQueue((q) => [...q, req])
    })
    return () => registerDialogHost(null)
  }, [])

  const current = queue[0]
  useScrollLock(Boolean(current)) // the page behind a pop-up must not scroll
  const opts = current?.options
  useEffect(() => {
    if (current?.kind === 'prompt') setText(current.options.defaultValue ?? '')
  }, [current])

  useEffect(() => {
    if (!current) return
    first.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // finish is stable enough for this: it only reads `current` and `text`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current])

  if (!current || !opts) return null

  function finish(ok: boolean) {
    if (!current) return
    if (current.kind === 'confirm') current.resolve(ok)
    else current.resolve(ok && text.trim() ? text.trim() : null)
    setQueue((q) => q.slice(1))
  }

  const Icon = ICONS[opts.icon ?? (opts.tone === 'danger' ? 'warning' : 'question')]
  const prompt = current.kind === 'prompt' ? current.options : null
  const canConfirm = !prompt || text.trim().length > 0
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && finish(false)}>
      <div className={`dialog${opts.tone === 'danger' ? ' danger' : ''}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <span className="dialog-icon" aria-hidden="true"><Icon size={26} /></span>
        <h2 id="dialog-title">{opts.title}</h2>
        {opts.message && <p className="dialog-message">{opts.message}</p>}
        {opts.details && opts.details.length > 0 && (
          <ul className="dialog-details">
            {opts.details.map((d) => <li key={d}>{d}</li>)}
          </ul>
        )}
        {prompt && (
          <label className="dialog-field">
            {prompt.label && <span>{prompt.label}</span>}
            {prompt.multiline === false ? (
              <input
                ref={(el) => { first.current = el }}
                value={text}
                placeholder={prompt.placeholder}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && canConfirm && finish(true)}
                maxLength={200}
              />
            ) : (
              <textarea
                ref={(el) => { first.current = el }}
                value={text}
                placeholder={prompt.placeholder}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                maxLength={200}
              />
            )}
          </label>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className={opts.tone === 'danger' ? 'btn-danger' : undefined}
            ref={(el) => { if (!prompt) first.current = el }}
            disabled={!canConfirm}
            onClick={() => finish(true)}
          >
            {opts.confirmLabel ?? (prompt ? 'Enviar' : 'Aceptar')}
          </button>
          <button type="button" className="ghost" onClick={() => finish(false)}>
            {opts.cancelLabel ?? 'Cancelar'}
          </button>
        </div>
      </div>
    </div>
  )
}
