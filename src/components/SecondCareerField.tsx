import { useState } from 'react'

const OTHER = '__other__'

// The other career of a double program. It can be one of the catalog (an engineering of the Javeriana) or ANY other the coordi writes
// (Derecho, Medicina…): the catalog only holds the engineerings, and a career that is not one still gets its own, generic medal.
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
  return (
    <div className="second-career">
      <select id={id} value={writing ? OTHER : value} disabled={disabled} aria-label={label} onChange={(e) => {
        if (e.target.value === OTHER) {
          setWriting(true)
          onChange('')
        } else {
          setWriting(false)
          onChange(e.target.value)
        }
      }}>
        <option value="">Ninguna</option>
        {careers.map((c) => <option key={c} value={c}>{c}</option>)}
        <option value={OTHER}>Otra, que no está en la lista…</option>
      </select>
      {writing && <input value={value} onChange={(e) => onChange(e.target.value)} maxLength={80} placeholder="Escribe la carrera (Derecho, Medicina…)" aria-label={`${label}: nombre`} disabled={disabled} autoComplete="off" />}
    </div>
  )
}
