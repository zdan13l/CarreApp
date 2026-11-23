import { useSyncExternalStore } from 'react'

// The live catalog (committees, themes, groups of careers) is read from the database into plain module lists; this lets a screen redraw when
// they change.
let version = 0
const listeners = new Set<() => void>()
export const bumpCatalog = () => {
  version += 1
  listeners.forEach((l) => l())
}
export const useCatalogVersion = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => version,
  )
