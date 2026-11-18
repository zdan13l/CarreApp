// The CarreApp logo: the crest (compact version, readable from 16 px) and the name, both painted as masks so they take the
// colour of the place they are in (`--logo-ink`, white on the blue covers). `size` is the height of the crest in px; without it
// the CSS decides (login, menus). The files are in public/: crest-simple.svg and wordmark.svg (assets in docs/logo/final).
export default function Logo({ size, wordmark = true }: { size?: number; wordmark?: boolean }) {
  return (
    <span className="brand" role="img" aria-label="CarreApp" style={size ? ({ '--logo-s': `${size}px` } as React.CSSProperties) : undefined}>
      <span className="logo-crest" aria-hidden="true" />
      {wordmark && <span className="logo-word" aria-hidden="true" />}
    </span>
  )
}
