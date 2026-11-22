import PhotoImg, { hasPhoto } from './PhotoImg'

// Team crest: the team photo, or its initials when it has none.
export function initials(name: string | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export default function Crest({
  name,
  photoPath,
  size,
}: {
  name?: string
  photoPath?: string | null
  size?: 'sm' | 'lg' | 'xl'
}) {
  return (
    <span className={`crest${size ? ` ${size}` : ''}`} aria-hidden="true">
      {hasPhoto(photoPath) ? <PhotoImg path={photoPath} /> : initials(name)}
    </span>
  )
}
