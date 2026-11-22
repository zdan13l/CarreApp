import type { ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import ConnectionBanner from './ConnectionBanner'
import Logo from './Logo'
import AccountMenu from './AccountMenu'
import { confirmDialog } from '../lib/dialog'

const ROLE: Record<string, string> = { runner: 'Corredor', base: 'Inductor base', admin: 'Coordi', member: 'Inductor' }

export default function AppShell({
  title,
  showTitle = true,
  children,
  user,
  topActions,
  alerts = false,
}: {
  title: string
  showTitle?: boolean // false: the title stays for screen readers only (the screen already says where you are)
  children: ReactNode
  user?: { full_name: string; username: string; photo_path?: string | null } // overrides the signed-in user (design preview)
  topActions?: ReactNode // extra buttons in the top bar, before the account button
  alerts?: boolean // the sound and notification switches live in the account sheet (runners and bases)
}) {
  const { profile, signOut } = useAuth()
  const who = user ?? profile
  return (
    <main className="page">
      <ConnectionBanner />
      <header className="topbar">
        <Logo size={44} detail />
        {topActions}
        <AccountMenu short alerts={alerts} roleLabel={ROLE[profile?.role ?? '']} user={who ?? undefined} onSignOut={async () => {
          if (await confirmDialog({ title: '¿Cerrar sesión?', message: 'Este teléfono dejará de recibir los avisos de la carrera.', confirmLabel: 'Cerrar sesión', icon: 'logout' })) void signOut()
        }} />
      </header>
      <h1 className={showTitle ? 'page-title' : 'sr-only'}>{title}</h1>
      {children}
    </main>
  )
}
