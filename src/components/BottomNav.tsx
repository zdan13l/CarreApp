import '../ranking.css'

export interface NavTab<T extends string> {
  id: T
  label: string
  icon: string
}

// Bottom tab bar for the phone views (runner and base). State-based, so each tab keeps its
// content mounted and live updates keep arriving while another tab is open.
export default function BottomNav<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: NavTab<T>[]
  active: T
  onChange: (id: T) => void
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
              onChange(t.id)
              window.scrollTo({ top: 0 })
            }}
          >
            <span aria-hidden="true">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </>
  )
}
