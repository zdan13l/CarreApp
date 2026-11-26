import { Check, ChevronDown, FilterX, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

// Filters that look the same whatever they hold: one menu button per group (so a group with three options and another with thirty take the same
// room), a panel of checkboxes under it, and the chosen ones shown below as chips that can be taken off one by one.
// Inside a group the chosen ones add up (Sistemas or Civil); between groups they narrow down (ancestors AND Sistemas).
export interface ChipOption {
  value: string
  label: string
  count: number
}
export interface ChipGroup {
  id: string
  label: string
  options: ChipOption[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export default function FilterBar({ groups, onClear, children }: { groups: ChipGroup[]; onClear?: () => void; children?: ReactNode }) {
  const [open, setOpen] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const shown = groups.filter((g) => g.options.length > 0)
  const active = shown.flatMap((g) => g.selected.map((value) => ({ group: g, option: g.options.find((o) => o.value === value) })).filter((x) => x.option))

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(null) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div className="filter-bar" ref={box}>
      <div className="filter-row">
        {children}
        <div className="filter-menus">
          {shown.map((g) => (
            <div key={g.id} className="filter-menu">
              <button type="button" className={`filter-trigger${g.selected.length ? ' on' : ''}`} aria-expanded={open === g.id} aria-haspopup="true" onClick={() => setOpen(open === g.id ? null : g.id)}>
                <span>{g.label}</span>
                {g.selected.length > 0 && <b>{g.selected.length}</b>}
                <ChevronDown size={16} aria-hidden="true" />
              </button>
              {open === g.id && (
                <div className="filter-panel" role="group" aria-label={g.label}>
                  {g.options.map((o) => {
                    const on = g.selected.includes(o.value)
                    return (
                      <label key={o.value} className={`filter-option${on ? ' on' : ''}`}>
                        <input type="checkbox" checked={on} onChange={() => g.onChange(on ? g.selected.filter((x) => x !== o.value) : [...g.selected, o.value])} />
                        <span className="tick" aria-hidden="true">{on && <Check size={13} strokeWidth={3} />}</span>
                        <span className="grow">{o.label}</span>
                        <small>{o.count}</small>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {active.length > 0 && (
        <div className="filter-active" aria-label="Filtros activos">
          {active.map(({ group, option }) => (
            <button key={`${group.id}-${option!.value}`} type="button" className="filter-chip" aria-label={`Quitar el filtro ${group.label}: ${option!.label}`} onClick={() => group.onChange(group.selected.filter((x) => x !== option!.value))}>
              <small>{group.label}</small>
              {option!.label}
              <X size={14} aria-hidden="true" />
            </button>
          ))}
          {onClear && (
            <button type="button" className="filter-clear" onClick={onClear}>
              <FilterX size={16} aria-hidden="true" /> Quitar filtros
            </button>
          )}
        </div>
      )}
    </div>
  )
}
