// The login version (`variant="gold"`): the white crest and the name in gold foil.
// The CarreApp logo: the crest (compact version, readable from 16 px) and the name, both painted as masks so they take the
// colour of the place they are in (`--logo-ink`, white on the blue covers). `size` is the height of the crest in px; without it
// the CSS decides (login, menus). The files are in public/: crest-simple.svg and wordmark.svg (assets in docs/logo/final).
export default function Logo({ size, wordmark = true, variant = 'ink', detail = false }: { size?: number; wordmark?: boolean; variant?: 'ink' | 'gold'; detail?: boolean }) {
  if (variant === 'gold') {
    return (
      <span className="brand gold" role="img" aria-label="CarreApp" style={size ? ({ '--logo-s': `${size}px` } as React.CSSProperties) : undefined}>
        <img className="logo-crest-gold" src="/crest-blanco.svg" alt="" width={1110} height={1215} />
        {wordmark && (
          <span className="logo-word foil" aria-hidden="true" />
        )}
      </span>
    )
  }
  return (
    <span className="brand" role="img" aria-label="CarreApp" style={size ? ({ '--logo-s': `${size}px` } as React.CSSProperties) : undefined}>
      <span className={`logo-crest${detail ? ' full' : ''}`} aria-hidden="true" />
      {wordmark && <span className="logo-word" aria-hidden="true" />}
    </span>
  )
}
