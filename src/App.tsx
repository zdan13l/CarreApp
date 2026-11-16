import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import RequireRole from './components/RequireRole'
import { AuthProvider, homePathForRole, useAuth } from './lib/auth'
import AdminLayout from './pages/admin/AdminLayout'
import Bases from './pages/admin/Bases'
import Cruces from './pages/admin/Cruces'
import Grupos from './pages/admin/Grupos'
import Mapa from './pages/admin/Mapa'
import Puntajes from './pages/admin/Puntajes'
import Resumen from './pages/admin/Resumen'
import Usuarios from './pages/admin/Usuarios'
import BaseHome from './pages/BaseHome'
import Login from './pages/Login'
import NetworkCheck from './pages/NetworkCheck'
import RunnerHome from './pages/RunnerHome'

// Design preview with sample data: development only (removed from the production build).
const Preview = import.meta.env.DEV ? lazy(() => import('./pages/Preview')) : null

function RootRedirect() {
  const { session, profile, loading } = useAuth()
  if (loading) return <p className="page loading">Cargando…</p>
  if (!session || !profile) return <Navigate to="/login" replace />
  return <Navigate to={homePathForRole[profile.role]} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/diagnostico" element={<NetworkCheck />} />
          {Preview && (
            <Route path="/preview/:screen" element={<Suspense fallback={null}><Preview /></Suspense>} />
          )}
          <Route path="/admin" element={<RequireRole role="admin"><AdminLayout /></RequireRole>}>
            <Route index element={<Resumen />} />
            <Route path="grupos" element={<Grupos />} />
            <Route path="bases" element={<Bases />} />
            <Route path="cruces" element={<Cruces />} />
            <Route path="puntajes" element={<Puntajes />} />
            <Route path="mapa" element={<Mapa />} />
            <Route path="usuarios" element={<Usuarios />} />
          </Route>
          <Route path="/base" element={<RequireRole role="base"><BaseHome /></RequireRole>} />
          <Route path="/corredor" element={<RequireRole role="runner"><RunnerHome /></RequireRole>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
