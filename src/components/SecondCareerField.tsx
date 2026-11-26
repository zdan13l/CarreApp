import { List } from 'lucide-react'
import { useState } from 'react'

const OTHER = '__other__'

// The other career of a double program. It can be one of the catalog (an engineering of the Javeriana) or ANY other the coordi writes
// (Derecho, Medicina…): the catalog only holds the engineerings, and a career that is not one still gets its own, generic medal.
// It is always ONE control tall: the list, or, once «Otra» is chosen, the box to write it with a button to go back to the list.
export default function SecondCareerField({
  id,
  careers,
  value,
  disabled,
  label,
  onChange,
}: {
  id: string
  careers: string[]
  value: string
  disabled?: boolean
  label: string
  onChange: (career: string) => void
}) {
  const [writing, setWriting] = useState(Boolean(value) && !careers.includes(value)) // a career that is not in the catalog opens already written
  if (writing) {
    return (
      <div className="second-career writing">
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} maxLength={80} placeholder="Ej.: Derecho" aria-label={label} disabled={disabled} autoComplete="off" autoFocus={!value} />
        <button type="button" className="ghost" disabled={disabled} onClick={() => { setWriting(false); onChange('') }} title="Elegir de la lista de carreras">
          <List size={16} aria-hidden="true" /> Lista
        </button>
      </div>
    )
  }
  return (
    <div className="second-career">
      <select id={id} value={value} disabled={disabled} aria-label={label} onChange={(e) => {
        if (e.target.value === OTHER) {
          setWriting(true)
          onChange('')
        } else onChange(e.target.value)
      }}>
        <option value="">Ninguna</option>
        {careers.map((c) => <option key={c} value={c}>{c}</option>)}
        <option value={OTHER}>Otra, que no está en la lista…</option>
      </select>
    </div>
  )
}
