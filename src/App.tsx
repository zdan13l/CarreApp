import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import RequireRole from './components/RequireRole'
import { AuthProvider, homePathForRole, useAuth } from './lib/auth'
import AdminHome from './pages/AdminHome'
import BaseHome from './pages/BaseHome'
import Login from './pages/Login'
import NetworkCheck from './pages/NetworkCheck'
import RunnerHome from './pages/RunnerHome'

function RootRedirect() {
  const { session, profile, loading } = useAuth()
  if (loading) return <p className="page muted">Cargando…</p>
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
          <Route path="/admin" element={<RequireRole role="admin"><AdminHome /></RequireRole>} />
          <Route path="/base" element={<RequireRole role="base"><BaseHome /></RequireRole>} />
          <Route path="/corredor" element={<RequireRole role="runner"><RunnerHome /></RequireRole>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
