import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import DialogHost from './components/DialogHost'
import RequireRole from './components/RequireRole'
import { AuthProvider, homePathForRole, useAuth } from './lib/auth'
import AdminLayout from './pages/admin/AdminLayout'
import Bases from './pages/admin/Bases'
import Carrera from './pages/admin/Carrera'
import Cruces from './pages/admin/Cruces'
import EnVivo from './pages/admin/EnVivo'
import Grupos from './pages/admin/Grupos'
import Mapa from './pages/admin/Mapa'
import Puntajes from './pages/admin/Puntajes'
import Historial from './pages/admin/Historial'
import Sellos from './pages/admin/Sellos'
import { useCustomSeals } from './lib/customSeals'
import Inductores from './pages/admin/Inductores'
import Usuarios from './pages/admin/Usuarios'
import BaseHome from './pages/BaseHome'
import Login from './pages/Login'
import MemberHome from './pages/MemberHome'
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

// the seals the coordinator uploaded are loaded once somebody is signed in
function SealLoader() {
  const { profile } = useAuth()
  useCustomSeals(Boolean(profile))
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SealLoader />
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/diagnostico" element={<NetworkCheck />} />
          {Preview && (
            <Route path="/preview/:screen" element={<Suspense fallback={null}><Preview /></Suspense>} />
          )}
          <Route path="/admin" element={<RequireRole role="admin"><AdminLayout /></RequireRole>}>
            <Route index element={<EnVivo />} />
            <Route path="carrera" element={<Carrera />} />
            <Route path="grupos" element={<Grupos />} />
            <Route path="bases" element={<Bases />} />
            <Route path="cruces" element={<Cruces />} />
            <Route path="puntajes" element={<Puntajes />} />
            <Route path="mapa" element={<Mapa />} />
            <Route path="usuarios" element={<Usuarios />} />
            <Route path="inductores" element={<Inductores />} />
            <Route path="historial" element={<Historial />} />
            <Route path="sellos" element={<Sellos />} />
          </Route>
          <Route path="/base" element={<RequireRole role="base"><BaseHome /></RequireRole>} />
          <Route path="/corredor" element={<RequireRole role="runner"><RunnerHome /></RequireRole>} />
          <Route path="/pasaporte" element={<RequireRole role="member"><MemberHome /></RequireRole>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
      <DialogHost />
    </BrowserRouter>
  )
}
