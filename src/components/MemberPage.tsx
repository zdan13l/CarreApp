import { BookMarked, Info, UserRound } from 'lucide-react'
import { useState } from 'react'
import AppShell from './AppShell'
import BottomNav, { type NavTab } from './BottomNav'
import MemberPassport, { type MemberPassportData } from './MemberPassport'
import MemberProfile, { NO_ACTIONS, type MemberActions } from './MemberProfile'

type Tab = 'pasaporte' | 'perfil'
const ICON = { size: 22, strokeWidth: 1.9, 'aria-hidden': true } as const
const TABS: NavTab<Tab>[] = [
  { id: 'pasaporte', label: 'Pasaporte', icon: <BookMarked {...ICON} /> },
  { id: 'perfil', label: 'Mi perfil', icon: <UserRound {...ICON} /> },
]

// The screen of the personal passport: the top bar, the booklet or the profile, and the tabs between them. It looks the same for everyone:
// the passport is the passport of their whole life in the induction, whatever they did in each one (run, staff a base, coordinate).
export default function MemberPage({
  data,
  user,
  startOpen,
  startPage,
  startTab = 'pasaporte',
  actions = NO_ACTIONS,
}: {
  data: MemberPassportData
  user?: { full_name: string; username: string; photo_path?: string | null } // design preview
  startOpen?: boolean
  startPage?: number
  startTab?: Tab
  actions?: MemberActions
}) {
  const [tab, setTab] = useState<Tab>(startTab)
  const role = data.records[0]?.role
  return (
    <AppShell title={tab === 'perfil' ? 'Mi perfil' : 'Mi pasaporte'} showTitle={false} user={user}>
      {/* both stay mounted: the passport keeps its page when the person looks at their profile and comes back */}
      <div hidden={tab !== 'pasaporte'}>
        <MemberPassport data={data} startOpen={startOpen} startPage={startPage} />
        {role && role !== 'coordinator' && (
          <p className="member-note muted">
            <Info size={16} aria-hidden="true" />
            Este es tu pasaporte personal. Para entrar a la Carrera usas el usuario de tu grupo o de tu base, que te da el coordi.
          </p>
        )}
      </div>
      {tab === 'perfil' && <MemberProfile person={data.person} actions={actions} />}
      <BottomNav tabs={TABS} active={tab} onChange={setTab} />
    </AppShell>
  )
}
