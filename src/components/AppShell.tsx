import type { ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import ConnectionBanner from './ConnectionBanner'
import Logo from './Logo'
import AccountMenu from './AccountMenu'

export default function AppShell({
  title,
  children,
  user,
  topActions,
}: {
  title: string
  children: ReactNode
  user?: { full_name: string; username: string; photo_path?: string | null } // overrides the signed-in user (design preview)
  topActions?: ReactNode // extra buttons in the top bar, before "Cerrar sesión"
}) {
  const { profile, signOut } = useAuth()
  const who = user ?? profile
  return (
    <main className="page">
      <ConnectionBanner />
      <header className="topbar">
        <Logo size={30} />
        {topActions}
        <AccountMenu user={who ?? undefined} onSignOut={() => { if (window.confirm('¿Cerrar sesión?')) void signOut() }} />
      </header>
      <h1 className="page-title">{title}</h1>
      {children}
    </main>
  )
}
