import { describe, expect, it } from 'vitest'
import { LOGO_VARIANT } from '../../src/components/Logo'
import { LOGO_OPTIONS } from '../../src/components/logos'

describe('logo options', () => {
  it('offers six distinct options, each with a name and an idea, and the app uses one of them', () => {
    expect(LOGO_OPTIONS).toHaveLength(6)
    expect(new Set(LOGO_OPTIONS.map((o) => o.id)).size).toBe(6)
    expect(LOGO_OPTIONS.every((o) => o.name.length > 2 && o.idea.length > 20)).toBe(true)
    expect(LOGO_OPTIONS.map((o) => o.id)).toContain(LOGO_VARIANT)
  })
})
