// CarreApp mark: a "C" (the Carrera) with a compass needle inside (the route to follow).
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="64 64 384 384" role="img" aria-label="CarreApp">
      <path
        d="M378.5 153.2A160 160 0 1 0 378.5 358.8"
        fill="none"
        stroke="var(--gold)"
        strokeWidth="50"
        strokeLinecap="round"
      />
      <g transform="rotate(35 256 256)">
        <polygon
          points="256,176 296,316 256,288 216,316"
          fill="var(--sky)"
          stroke="var(--sky)"
          strokeWidth="12"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}

export default function Logo({ size = 32, wordmark = true }: { size?: number; wordmark?: boolean }) {
  return (
    <span className="brand">
      <LogoMark size={size} />
      {wordmark && (
        <span className="wordmark">
          Carre<b>App</b>
        </span>
      )}
    </span>
  )
}
