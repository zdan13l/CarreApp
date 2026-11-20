import { Info } from 'lucide-react'
import AppShell from './AppShell'
import MemberPassport, { type MemberPassportData } from './MemberPassport'

// The screen of the personal passport: the top bar, the booklet and a note about which user enters the live Carrera.
// The coordinator's version lives in the control tower (always dark), like the rest of their panel.
export default function MemberPage({
  data,
  user,
  startOpen,
  startPage,
}: {
  data: MemberPassportData
  user?: { full_name: string; username: string; photo_path?: string | null } // design preview
  startOpen?: boolean
  startPage?: number
}) {
  const role = data.records[0]?.role
  const page = (
    <AppShell title="Mi pasaporte" showTitle={false} user={user}>
      <MemberPassport data={data} startOpen={startOpen} startPage={startPage} />
      {role && role !== 'coordinator' && (
        <p className="member-note muted">
          <Info size={16} aria-hidden="true" />
          {role === 'runner'
            ? 'Este es tu pasaporte personal. Para correr en la Carrera, tu grupo entra con el usuario del grupo que te da el coordinador.'
            : 'Este es tu pasaporte personal. Para calificar en tu base, entra con el usuario de la base que te da el coordinador.'}
        </p>
      )}
    </AppShell>
  )
  return role === 'coordinator' ? <div className="tower member-tower">{page}</div> : page
}
