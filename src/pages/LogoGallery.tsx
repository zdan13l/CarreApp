import { LOGO_OPTIONS, LogoMarkOf } from '../components/logos'
import { LOGO_VARIANT } from '../components/Logo'
import ThemeToggle from '../components/ThemeToggle'

// Logo options (development only: /preview/logos). Each one is shown as a mark, as a header lockup, as an
// app icon, small (favicon) and on the brand blue. Switch light / dark with the button to see both palettes.
export default function LogoGallery() {
  return (
    <main className="logo-gallery">
      <header className="gallery-head">
        <div>
          <h1>Logos de CarreApp</h1>
          <p className="muted">Seis opciones con la paleta nueva. En uso ahora: <strong>{LOGO_OPTIONS.find((o) => o.id === LOGO_VARIANT)?.name}</strong>. Para cambiarlo, edita <code>LOGO_VARIANT</code> en <code>src/components/Logo.tsx</code>.</p>
        </div>
        <ThemeToggle />
      </header>
      <div className="gallery-grid">
        {LOGO_OPTIONS.map((o, i) => (
          <article key={o.id} className={`gallery-card${o.id === LOGO_VARIANT ? ' current' : ''}`}>
            <div className="gallery-stage">
              <LogoMarkOf variant={o.id} size={132} />
            </div>
            <div className="gallery-body">
              <h2>{i + 1}. {o.name}{o.id === LOGO_VARIANT && <span className="badge ok">En uso</span>}</h2>
              <p className="muted">{o.idea}</p>
              <div className="gallery-uses">
                <span className="brand">
                  <LogoMarkOf variant={o.id} size={34} />
                  <span className="wordmark">Carre<b>App</b></span>
                </span>
                <span className="app-icon" aria-hidden="true"><LogoMarkOf variant={o.id} size={44} /></span>
                <span className="hero-chip"><LogoMarkOf variant={o.id} size={30} /></span>
                <span className="tiny"><LogoMarkOf variant={o.id} size={16} /><LogoMarkOf variant={o.id} size={24} /></span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  )
}
