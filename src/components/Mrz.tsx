import { mrzLines } from '../lib/stamp'

// The two lines at the foot of a passport page. Decorative, but built from real data (group, stamps, rounds).
export default function Mrz({ team, stamps, rounds, lines }: { team?: string; stamps?: number; rounds?: number; lines?: [string, string] }) {
  const [a, b] = lines ?? mrzLines(team ?? '', stamps ?? 0, rounds ?? 0)
  return (
    <p className="mrz" aria-hidden="true">
      {a}
      <br />
      {b}
    </p>
  )
}
