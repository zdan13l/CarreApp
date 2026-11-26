import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

// «Create the one that is missing»: the way out of a list the coordi cannot add to from where they are (a generation, a career).
export default function AddLink({ to, children }: { to: string; children: string }) {
  return (
    <Link className="add-link" to={to}>
      <Plus size={15} strokeWidth={2.6} aria-hidden="true" /> {children}
    </Link>
  )
}
