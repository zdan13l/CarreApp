import { useEffect } from 'react'

// While a dialog is open the page behind it must not scroll (on a phone a swipe over the dialog would move the screen underneath).
// Several dialogs can be open at once, so it counts them and releases the page when the last one closes.
let locks = 0
let saved: { html: string; body: string } | null = null

export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return
    if (locks === 0) {
      saved = { html: document.documentElement.style.overflow, body: document.body.style.overflow }
      document.documentElement.style.overflow = 'hidden'
      document.body.style.overflow = 'hidden'
    }
    locks += 1
    return () => {
      locks -= 1
      if (locks === 0 && saved) {
        document.documentElement.style.overflow = saved.html
        document.body.style.overflow = saved.body
        saved = null
      }
    }
  }, [active])
}
