import { useState } from 'react'
import { GENERATIONS, generationsOf } from '../lib/seals'

// The generation of a person is CHOSEN from the catalog (Administración global → Generaciones), never typed. Someone who entered twice has two:
// the second selector appears once the first is chosen. The value is the names joined by « / » ('' = none). A text written before the catalog
// existed and not in it is shown as «sin elegir» so it can be fixed.
export default function GenerationPicker({ value, onChange, disabled, label, name, required }: { value: string | null | undefined; onChange?: (value: string) => void; disabled?: boolean; label: string; name?: string; required?: boolean }) {
  const known = generationsOf(value)
  const legacy = Boolean(value?.trim()) && known.length === 0
  const [first, setFirst] = useState(known[0]?.name ?? '')
  const [second, setSecond] = useState(known[1]?.name ?? '')
  const join = (a: string, b: string) => [a, b].filter(Boolean).filter((x, i, all) => all.indexOf(x) === i).join(' / ')
  const options = (skip: string) => GENERATIONS.filter((g) => g.name !== skip).map((g) => <option key={g.key} value={g.name}>{g.name}{g.term ? ` (${g.term})` : ''}</option>)
  const pick = (a: string, b: string) => {
    setFirst(a)
    setSecond(b)
    onChange?.(join(a, b))
  }
  return (
    <span className="gen-picker">
      <select name={name} value={first} required={required} disabled={disabled} aria-label={label} onChange={(e) => pick(e.target.value, e.target.value ? second : '')}>
        <option value="">{legacy ? `Sin elegir (decía «${value}»)` : required ? 'Elige la generación…' : 'Sin generación'}</option>
        {options('')}
      </select>
      {first && (
        <select name={name ? `${name}2` : undefined} value={second} disabled={disabled} aria-label={`${label}: segunda generación (si entró dos veces)`} onChange={(e) => pick(first, e.target.value)}>
          <option value="">Una sola generación</option>
          {options(first)}
        </select>
      )}
    </span>
  )
}
