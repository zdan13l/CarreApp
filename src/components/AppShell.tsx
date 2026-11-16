import { LogOut } from 'lucide-react'
import type { ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import Logo from './Logo'

export default function AppShell({
  title,
  children,
  user,
}: {
  title: string
  children: ReactNode
  user?: { full_name: string; username: string } // overrides the signed-in user (design preview)
}) {
  const { profile, signOut } = useAuth()
  const who = user ?? profile
  return (
    <main className="page">
      <header className="topbar">
        <Logo size={30} />
        <div className="topbar-user">
          <strong>{who?.full_name}</strong>
          <small>@{who?.username}</small>
        </div>
        <button className="ghost icon-btn" onClick={signOut} aria-label="Cerrar sesión" title="Cerrar sesión">
          <LogOut size={20} />
        </button>
      </header>
      <h1 className="page-title">{title}</h1>
      {children}
    </main>
  )
}
