// Filters as chips: inside a group the chosen ones add up (Sistemas or Civil), between groups they narrow down (ancestors AND Sistemas).
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

export default function FilterChips({ groups, onClear }: { groups: ChipGroup[]; onClear?: () => void }) {
  const any = groups.some((g) => g.selected.length > 0)
  return (
    <div className="filter-chips">
      {groups.filter((g) => g.options.length > 0).map((g) => (
        <div key={g.id} className="chip-group" role="group" aria-label={g.label}>
          <span className="chip-group-label">{g.label}</span>
          <span className="chip-set">
            {g.options.map((o) => {
              const on = g.selected.includes(o.value)
              return (
                <button key={o.value} type="button" className={`chip-filter${on ? ' on' : ''}`} aria-pressed={on} onClick={() => g.onChange(on ? g.selected.filter((x) => x !== o.value) : [...g.selected, o.value])}>
                  {o.label}
                  <small>{o.count}</small>
                </button>
              )
            })}
          </span>
        </div>
      ))}
      {any && onClear && <button type="button" className="ghost chip-clear" onClick={onClear}>Quitar los filtros</button>}
    </div>
  )
}
