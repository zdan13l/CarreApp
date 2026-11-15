import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { homePathForRole, useAuth } from '../lib/auth'
import type { UserRole } from '../types'

export default function RequireRole({ role, children }: { role: UserRole; children: ReactNode }) {
  const { session, profile, loading, signOut } = useAuth()

  if (loading) return <p className="page muted">Cargando…</p>
  if (!session) return <Navigate to="/login" replace />
  if (!profile) {
    return (
      <main className="page">
        <div className="card">
          <h2>Sin perfil</h2>
          <p>Tu usuario existe pero no tiene un perfil asignado. Avísale al coordinador.</p>
          <button onClick={signOut}>Cerrar sesión</button>
        </div>
      </main>
    )
  }
  if (profile.role !== role) return <Navigate to={homePathForRole[profile.role]} replace />
  return <>{children}</>
}
