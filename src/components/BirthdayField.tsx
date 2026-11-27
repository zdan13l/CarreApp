import { birthdayCode } from '../lib/birthday'

// «Código (cumple)»: the birthday of the person. The code of their passport is made from it (PUJ-DDMMAAAA), so the code shows under the box
// as soon as the date is complete.
export default function BirthdayField({ value, onChange, disabled, label }: { value: string; onChange: (iso: string) => void; disabled?: boolean; label: string }) {
  const code = birthdayCode(value)
  return (
    <label className="inline-field birthday-field">
      <span>Código (cumple)</span>
      <input type="date" value={value} min="1940-01-01" max={new Date().toISOString().slice(0, 10)} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-label={label} />
      <small className="gen-hint mono">{code ?? 'PUJ-DDMMAAAA'}</small>
    </label>
  )
}
