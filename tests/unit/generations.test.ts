// The generations: a global catalog with a seal each; the seal the coordi edits replaces the one the app brings.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import GenerationSeals from '../../src/components/GenerationSeal'
import { GENERATIONS, generationKeyOf, generationsOf, sealedGenerationsOf, setGenerations, type GenerationRow } from '../../src/lib/seals'

const base = (r: Partial<GenerationRow> & { key: string; name: string }): GenerationRow => ({ term: null, sort_order: 1, kind: null, ink: 1, source_file: null, shape: null, color: null, image_path: null, ...r })
const original = GENERATIONS.map((g) => base({ key: g.key, name: g.name, term: g.term, kind: g.kind, ink: g.ink, source_file: g.source?.file ?? null, sort_order: GENERATIONS.indexOf(g) }))
afterEach(() => setGenerations(original, (p) => p))
const seals = (text: string) => renderToStaticMarkup(createElement(GenerationSeals, { generation: text }))

describe('the generation catalog', () => {
  it('starts with the five of the app and resolves names with or without accents, one or two at once', () => {
    expect(GENERATIONS.map((g) => g.name)).toEqual(['Champiñones', 'Peluches', 'Barbies', 'Minichips', 'Textiles'])
    expect(generationsOf('champiñones / BARBIES').map((g) => g.key)).toEqual(['champinones', 'barbies'])
    expect(generationsOf('Pendiente')).toEqual([])
    expect(generationKeyOf('Champiñones')).toBe('champinones') // the same rule as the database (generation_plain)
  })
  it('a generation without a seal shows none, and the one the app brings is its silhouette with its picture', () => {
    expect(sealedGenerationsOf('Minichips')).toEqual([]) // its logo is not defined yet
    expect(seals('Minichips')).toBe('')
    expect(seals('Barbies')).toContain('gen-barbies.png')
    expect(seals('Barbies')).not.toContain('event-seal')
  })
  it('the seal the coordi edits (shape, colour, picture) is shown instead of the one of always, in every passport', () => {
    setGenerations(original.map((r) => (r.key === 'barbies' ? { ...r, shape: 'hexagon', color: '#ff00aa', image_path: 'generations/x.png' } : r)), (p) => `https://files.test/${p}`)
    const html = seals('Barbies')
    expect(html).toContain('event-seal')
    expect(html).toContain('#ff00aa')
    expect(html).toContain('https://files.test/generations/x.png')
    expect(html).not.toContain('gen-barbies.png')
  })
  it('an edit with only shape and colour keeps the picture the app brings; a generation with no seal gets one once it is edited', () => {
    setGenerations(original.map((r) => (r.key === 'barbies' ? { ...r, shape: 'shield', color: '#112233' } : r.key === 'minichips' ? { ...r, shape: 'circle', color: '#445566' } : r)), (p) => p)
    expect(seals('Barbies')).toContain('gen-barbies.png')
    expect(sealedGenerationsOf('Minichips').length).toBe(1)
    expect(seals('Minichips')).toContain('event-seal')
  })
  it('a person with two generations gets both seals', () => {
    expect(sealedGenerationsOf('Champiñones / Barbies').length).toBe(2)
  })
  it('a new generation from the database joins the list, in its order', () => {
    setGenerations([...original, base({ key: 'mariposas', name: 'Mariposas', term: '2810', sort_order: 99, shape: 'oval', color: '#123456' })], (p) => p)
    expect(GENERATIONS[GENERATIONS.length - 1].name).toBe('Mariposas')
    expect(sealedGenerationsOf('Mariposas').length).toBe(1)
  })
})
