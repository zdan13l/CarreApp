import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyTheme, currentTheme, initTheme } from '../../src/lib/theme'

// A minimal browser: enough for theme.ts (document.documentElement.dataset, localStorage, meta theme-color, events).
let store: Map<string, string>
let blocked: boolean
let meta: { content: string; setAttribute: (k: string, v: string) => void }
let events: string[]

beforeEach(() => {
  store = new Map()
  blocked = false
  events = []
  meta = { content: '', setAttribute(_k, v) { this.content = v } }
  const dataset: Record<string, string> = {}
  vi.stubGlobal('document', { documentElement: { dataset }, querySelector: () => meta })
  vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => ' #f4f6fb ' }))
  vi.stubGlobal('Event', class { type: string; constructor(type: string) { this.type = type } })
  vi.stubGlobal('window', { dispatchEvent: (e: { type: string }) => events.push(e.type) })
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => { if (blocked) throw new Error('blocked'); return store.get(k) ?? null },
    setItem: (k: string, v: string) => { if (blocked) throw new Error('blocked'); store.set(k, v) },
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('theme (light / dark)', () => {
  it('starts dark when nothing is saved, as the app always did', () => {
    initTheme()
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(currentTheme()).toBe('dark')
    expect(store.size).toBe(0) // the first paint does not save a choice the person never made
  })

  it('applying a theme saves it, paints the browser bar with the page colour and notifies the components', () => {
    applyTheme('light')
    expect(store.get('carreapp.theme')).toBe('light')
    expect(meta.content).toBe('#f4f6fb')
    expect(events).toEqual(['carreapp-theme'])
    document.documentElement.dataset.theme = '' // a reload: the saved choice wins
    initTheme()
    expect(currentTheme()).toBe('light')
  })

  it('ignores a corrupted saved value', () => {
    store.set('carreapp.theme', 'purple')
    document.documentElement.dataset.theme = ''
    initTheme()
    expect(currentTheme()).toBe('dark')
  })

  it('with storage blocked (private window) it still switches for the session and never throws', () => {
    blocked = true
    expect(() => initTheme()).not.toThrow()
    expect(() => applyTheme('light')).not.toThrow()
    expect(currentTheme()).toBe('light')
  })
})
