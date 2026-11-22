import PhotoImg, { hasPhoto } from './PhotoImg'

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?'

// The person's picture, or their initials on the brand blue when they have none.
export default function Avatar({ name, photoPath, size = 40 }: { name: string; photoPath?: string | null; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, minWidth: size, fontSize: size * 0.38 }} aria-hidden="true">
      {hasPhoto(photoPath) ? <PhotoImg path={photoPath} /> : initialsOf(name)}
    </span>
  )
}
