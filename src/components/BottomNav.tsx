import type { ReactNode } from 'react'
import { withPageTurn } from '../lib/motion'

export interface NavTab<T extends string> {
  id: T
  label: string
  icon: ReactNode
}

// Bottom tab bar for the phone views (runner and base). State-based, so each tab keeps its
// content mounted and live updates keep arriving while another tab is open.
export default function BottomNav<T extends string>({
  tabs,
  active,
  onChange,
  transition = true,
}: {
  tabs: NavTab<T>[]
  active: T
  onChange: (id: T) => void
  transition?: boolean // false when the screen animates its own tab content
}) {
  return (
    <>
      <div className="nav-spacer" />
      <nav className="bottom-nav" aria-label="Secciones" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`bn-tab${t.id === active ? ' active' : ''}`}
            aria-current={t.id === active ? 'page' : undefined}
            onClick={() => {
              if (t.id !== active) (transition ? withPageTurn : (u: () => void) => u())(() => onChange(t.id))
              window.scrollTo({ top: 0 })
            }}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </>
  )
}
