import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
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
import Generaciones from './pages/admin/Generaciones'
import Comites from './pages/admin/Comites'
import Programas from './pages/admin/Programas'
import Insignias from './pages/admin/Insignias'
import CarreraTematica from './pages/admin/CarreraTematica'
import CarreraComites from './pages/admin/CarreraComites'
import CarreraInductores from './pages/admin/CarreraInductores'
import Carreras from './pages/admin/Carreras'
import CarreraShell from './pages/admin/CarreraShell'
import { useAdmin } from './pages/admin/AdminContext'
import { useCustomSeals } from './lib/customSeals'
import { useCatalog } from './lib/catalog'
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
  useCatalog(Boolean(profile))
  return null
}

// the old Sellos tab of a carrera: seals are made in ONE place now, the workshop (Administración global → Sellos), opened on that carrera
function SealsRedirect() {
  const { eventId } = useParams()
  return <Navigate to={`/admin/sellos?kind=committee&event=${eventId ?? ''}`} replace />
}

// /admin/grupos (and the like) → the same section of the carrera that is open or running
function LegacyRedirect({ section }: { section: string }) {
  const { event } = useAdmin()
  return <Navigate to={event ? `/admin/carreras/${event.id}/${section}` : '/admin'} replace />
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
            <Route index element={<Carreras />} />
            <Route path="carreras/:eventId" element={<CarreraShell />}>
              <Route index element={<EnVivo />} />
              <Route path="configuracion" element={<Carrera />} />
              <Route path="tematica" element={<CarreraTematica />} />
              <Route path="sellos" element={<SealsRedirect />} />
              <Route path="inductores" element={<CarreraInductores />} />
              <Route path="comites" element={<CarreraComites />} />
              <Route path="grupos" element={<Grupos />} />
              <Route path="bases" element={<Bases />} />
              <Route path="cruces" element={<Cruces />} />
              <Route path="puntajes" element={<Puntajes />} />
              <Route path="mapa" element={<Mapa />} />
              <Route path="usuarios" element={<Usuarios />} />
            </Route>
            <Route path="inductores" element={<Inductores />} />
            <Route path="programas" element={<Programas />} />
            <Route path="comites" element={<Comites />} />
            <Route path="insignias" element={<Insignias />} />
            <Route path="generaciones" element={<Generaciones />} />
            <Route path="sellos" element={<Sellos />} />
            <Route path="historial" element={<Historial />} />
            {/* the old addresses (before the panel was split in global / carrera) still work: they open the same section of the open carrera */}
            {[['carrera', 'configuracion'], ['grupos', 'grupos'], ['bases', 'bases'], ['cruces', 'cruces'], ['usuarios', 'usuarios'], ['puntajes', 'puntajes'], ['mapa', 'mapa']].map(([from, to]) => (
              <Route key={from} path={from} element={<LegacyRedirect section={to} />} />
            ))}
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
