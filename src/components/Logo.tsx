import { LogoMarkOf, type LogoVariant } from './logos'

// The logo the app shows. The options live in logos.tsx (gallery: /preview/logos in development).
export const LOGO_VARIANT: LogoVariant = 'brujula'

export function LogoMark({ size = 32 }: { size?: number }) {
  return <LogoMarkOf variant={LOGO_VARIANT} size={size} />
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
