import { flushSync } from 'react-dom'

// Turning a page of the passport: a short cross-fade with a small slide, using the browser's View Transitions
// where they exist (iOS 18+, current Chrome) and a plain, instant change everywhere else or with "reduce motion".
export function withPageTurn(update: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
  const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (calm || typeof doc.startViewTransition !== 'function') {
    update()
    return
  }
  doc.startViewTransition(() => {
    flushSync(update)
  })
}
