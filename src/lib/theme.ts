import { useSyncExternalStore } from 'react'

// Light / dark mode. The choice is kept on the device (localStorage). The first time the app is LIGHT (the paper of the
// passport reads best in the sun); the toggle in the top bar switches to "passport by night". The tiny script in index.html applies the
// saved choice before the first paint so there is no flash of the wrong theme.
export type Theme = 'light' | 'dark'

const KEY = 'carreapp.theme'

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null // storage blocked (private window): the choice just does not persist
  }
}

export function currentTheme(): Theme {
  const attr = document.documentElement.dataset.theme
  return attr === 'light' || attr === 'dark' ? attr : stored() ?? 'light'
}

export function applyTheme(theme: Theme, persist = true) {
  document.documentElement.dataset.theme = theme
  // the browser bar takes the page background colour (read from the stylesheet, not repeated here)
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
  if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
  if (persist) {
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      /* ignore */
    }
  }
  window.dispatchEvent(new Event('carreapp-theme'))
}

export function initTheme() {
  applyTheme(stored() ?? 'light', false)
}

function subscribe(cb: () => void) {
  window.addEventListener('carreapp-theme', cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener('carreapp-theme', cb)
    window.removeEventListener('storage', cb)
  }
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => 'light' as Theme)
  return [theme, (t) => applyTheme(t)]
}
