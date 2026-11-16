import { LogOut } from 'lucide-react'
import type { ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import ConnectionBanner from './ConnectionBanner'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'

export default function AppShell({
  title,
  children,
  user,
  topActions,
}: {
  title: string
  children: ReactNode
  user?: { full_name: string; username: string } // overrides the signed-in user (design preview)
  topActions?: ReactNode // extra buttons in the top bar, before "Cerrar sesión"
}) {
  const { profile, signOut } = useAuth()
  const who = user ?? profile
  return (
    <main className="page">
      <ConnectionBanner />
      <header className="topbar">
        <Logo size={30} />
        <div className="topbar-user">
          <strong>{who?.full_name}</strong>
          <small>@{who?.username}</small>
        </div>
        {topActions}
        <ThemeToggle />
        <button className="ghost icon-btn" onClick={() => { if (window.confirm('¿Cerrar sesión?')) void signOut() }} aria-label="Cerrar sesión" title="Cerrar sesión">
          <LogOut size={20} />
        </button>
      </header>
      <h1 className="page-title">{title}</h1>
      {children}
    </main>
  )
}
