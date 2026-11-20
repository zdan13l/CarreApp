import { Download, KeyRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { PassportPerson } from '../lib/passports'
import { normalizeUsername, USERNAME_PATTERN } from '../lib/username'

// "Mi perfil" of the personal passport: their @ and password (both asked with the current password) and the PDF of the passport as a
// keepsake. The identity (who they are) is set once by the coordinator and is not edited here. If a password is forgotten
// the coordinator resets it.
export interface MemberActions {
  busy: boolean
  error: string | null
  notice: string | null
  changeUsername: (username: string, currentPassword: string) => void
  changePassword: (currentPassword: string, newPassword: string) => void
  downloadPdf: () => void
  pdfBusy: boolean
}

export const NO_ACTIONS: MemberActions = {
  busy: false,
  error: null,
  notice: null,
  changeUsername: () => undefined,
  changePassword: () => undefined,
  downloadPdf: () => undefined,
  pdfBusy: false,
}

export default function MemberProfile({ person, actions }: { person: PassportPerson; actions: MemberActions }) {
  const [username, setUsername] = useState(person.username)
  const [userPassword, setUserPassword] = useState('')
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [local, setLocal] = useState<string | null>(null)
  const { busy } = actions

  const wanted = normalizeUsername(username)
  const usernameOk = USERNAME_PATTERN.test(wanted) && wanted !== person.username

  function onUsername(e: FormEvent) {
    e.preventDefault()
    setLocal(null)
    actions.changeUsername(wanted, userPassword)
    setUserPassword('')
  }
  function onPassword(e: FormEvent) {
    e.preventDefault()
    if (next !== again) {
      setLocal('Las dos contraseñas nuevas no coinciden.')
      return
    }
    setLocal(null)
    actions.changePassword(current, next)
    setCurrent('')
    setNext('')
    setAgain('')
  }

  return (
    <div className="member-profile">
      <h1 className="page-title">Mi perfil</h1>
      {(local || actions.error) && <p className="error" role="alert">{local ?? actions.error}</p>}
      {actions.notice && !local && !actions.error && <p className="notice" role="status">{actions.notice}</p>}

      <section className="card">
        <h2><KeyRound size={20} aria-hidden="true" /> Mi usuario (@)</h2>
        <p className="muted">Con este @ entras a tu pasaporte. Puedes cambiarlo por el que quieras si está libre; te pedimos la contraseña actual.</p>
        <form className="form" onSubmit={onUsername}>
          <label>
            Usuario
            <input value={username} maxLength={30} autoCapitalize="none" autoCorrect="off" autoComplete="username" onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label>
            Contraseña actual
            <input type="password" value={userPassword} autoComplete="current-password" onChange={(e) => setUserPassword(e.target.value)} />
          </label>
          <button type="submit" disabled={busy || !usernameOk || !userPassword}>Cambiar mi usuario</button>
        </form>
      </section>

      <section className="card">
        <h2><KeyRound size={20} aria-hidden="true" /> Contraseña</h2>
        <p className="muted">Si la olvidas, el coordinador te genera una nueva.</p>
        <form className="form" onSubmit={onPassword}>
          <label>
            Contraseña actual
            <input type="password" value={current} autoComplete="current-password" onChange={(e) => setCurrent(e.target.value)} />
          </label>
          <label>
            Contraseña nueva (mínimo 8 caracteres)
            <input type="password" value={next} autoComplete="new-password" onChange={(e) => setNext(e.target.value)} />
          </label>
          <label>
            Repite la contraseña nueva
            <input type="password" value={again} autoComplete="new-password" onChange={(e) => setAgain(e.target.value)} />
          </label>
          <button type="submit" disabled={busy || !current || next.length < 8 || !again}>Cambiar mi contraseña</button>
        </form>
      </section>

      <section className="card">
        <h2><Download size={20} aria-hidden="true" /> Recuerdo en PDF</h2>
        <p className="muted">Descarga tu pasaporte completo (cubierta, identidad, tus sellos, las páginas en blanco y tu historial) para guardarlo de recuerdo.</p>
        <button type="button" onClick={actions.downloadPdf} disabled={actions.pdfBusy}>
          <Download size={18} aria-hidden="true" />
          {actions.pdfBusy ? 'Armando tu pasaporte…' : 'Descargar mi pasaporte en PDF'}
        </button>
      </section>
    </div>
  )
}
