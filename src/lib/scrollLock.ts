import { useEffect } from 'react'

// While a dialog is open the page behind it must not scroll (on a phone a swipe over the dialog would move the screen underneath).
// Several dialogs can be open at once, so it counts them and releases the page when the last one closes.
//
// Two things the lock must NOT do on a computer:
//  * lock the <body> too: once the body is its own scroll box the sticky side menu of the coordinator panel stops being pinned to the window
//    and slides away with the scrolled page (it looked shrunk or broken). Only the <html> is locked there; the body is locked as well only on
//    a phone, where there is no side menu.
//  * let the page jump sideways: the scrollbar disappears and the content widens by its width, so the room it took is kept (`scrollbar-gutter`).
const PHONE = 900 // the width where the side menu starts (see .admin in index.css)
let locks = 0
let saved: { html: string; body: string; gutter: string } | null = null

export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return
    if (locks === 0) {
      const html = document.documentElement
      saved = { html: html.style.overflow, body: document.body.style.overflow, gutter: html.style.scrollbarGutter }
      if (window.innerWidth > html.clientWidth) html.style.scrollbarGutter = 'stable' // there is a scrollbar now: keep its place
      html.style.overflow = 'hidden'
      if (window.innerWidth < PHONE) document.body.style.overflow = 'hidden'
    }
    locks += 1
    return () => {
      locks -= 1
      if (locks === 0 && saved) {
        document.documentElement.style.overflow = saved.html
        document.documentElement.style.scrollbarGutter = saved.gutter
        document.body.style.overflow = saved.body
        saved = null
      }
    }
  }, [active])
}
