import { useState } from 'react'
import { photoUrl } from '../lib/storage'

// A picture of a person, team or base in a small place (avatar, crest, list). It asks for the small copy (240 px) and, for photos uploaded
// before that copy existed, quietly falls back to the big one. Returns null when there is no photo (the caller shows initials).
export default function PhotoImg({ path }: { path: string | null | undefined }) {
  const [big, setBig] = useState(false)
  const url = photoUrl(path ?? null, !big)
  if (!url) return null
  return <img src={url} alt="" loading="lazy" decoding="async" onError={() => setBig(true)} />
}

/** True when there is something to show for this path. */
export const hasPhoto = (path: string | null | undefined) => photoUrl(path ?? null) !== null
