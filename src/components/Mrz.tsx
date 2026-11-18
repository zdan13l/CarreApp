import { mrzLines } from '../lib/stamp'

// The two lines at the foot of a passport page. Decorative, but built from real data (group, stamps, rounds).
export default function Mrz({ team, stamps, rounds }: { team: string; stamps: number; rounds: number }) {
  const [a, b] = mrzLines(team, stamps, rounds)
  return (
    <p className="mrz" aria-hidden="true">
      {a}
      <br />
      {b}
    </p>
  )
}
