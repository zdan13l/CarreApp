import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

// One indicator of the coordinator's control centre: a label, a big number and a line under it.
// With `to` it is a link to the screen that explains the number.
export default function Kpi({
  label,
  value,
  sub,
  to,
  tone,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  to?: string
  tone?: 'hot' | 'accent'
}) {
  const body = (
    <>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value num">{value}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </>
  )
  const cls = `kpi${tone ? ` ${tone}` : ''}`
  return to ? <Link className={cls} to={to}>{body}</Link> : <div className={cls}>{body}</div>
}
