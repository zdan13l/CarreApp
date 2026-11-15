import type { ReactNode } from 'react'
import { useAuth } from '../lib/auth'

export default function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const { profile, signOut } = useAuth()
  return (
    <main className="page">
      <header className="topbar">
        <img src="/logo.png" alt="Logo de CarrerApp" className="logo-sm" />
        <div>
          <h1>{title}</h1>
          <p className="muted">{profile?.full_name} · @{profile?.username}</p>
        </div>
        <button className="ghost" onClick={signOut}>Salir</button>
      </header>
      {children}
    </main>
  )
}
