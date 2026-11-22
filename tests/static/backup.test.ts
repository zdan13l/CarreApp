import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { TABLES } from '../../scripts/backup'

// The backup has to cover every table the project keeps: a new table added by a migration must be in the list (or be on purpose left out).
const NOT_BACKED_UP = ['push_subscriptions', 'push_config'] // the phones' push endpoints and the secret of the push: they are recreated, not restored

describe('the backup script', () => {
  const sql = readdirSync('supabase/migrations').map((f) => readFileSync(`supabase/migrations/${f}`, 'utf-8')).join('\n')
  const created = [...sql.matchAll(/create table (?:if not exists )?public\.(\w+)/gi)].map((m) => m[1])

  it('copies every table the migrations create, except the two that are recreated on purpose', () => {
    const missing = created.filter((t) => !TABLES.includes(t as never) && !NOT_BACKED_UP.includes(t))
    expect(missing).toEqual([])
  })

  it('only names tables that exist', () => {
    expect(TABLES.filter((t) => !created.includes(t))).toEqual([])
  })

  it('writes outside the repository by default, because it holds personal data', () => {
    expect(readFileSync('scripts/backup.ts', 'utf-8')).toMatch(/join\('\.\.', 'carreapp-respaldos'\)/)
  })

  it('keeps the daily call that stops the free project from pausing', () => {
    expect(readFileSync('vercel.json', 'utf-8')).toMatch(/"path": "\/api\/keepalive"/)
    expect(readFileSync('api/keepalive.ts', 'utf-8')).toMatch(/rest\/v1\/events/)
  })
})

describe('photos in two sizes', () => {
  const storage = readFileSync('src/lib/storage.ts', 'utf-8')
  it('uploads a 240 px copy next to the big one and deletes both', () => {
    expect(storage).toMatch(/const THUMB_SIDE = 240/)
    expect(storage).toMatch(/thumbPath\(path\)/)
    expect(storage).toMatch(/flatMap\(\(p\) => \[p, thumbPath\(p\)\]/)
  })
  it('lists use the small copy and fall back to the big photo for photos uploaded before it existed', () => {
    const img = readFileSync('src/components/PhotoImg.tsx', 'utf-8')
    expect(img).toMatch(/onError=\{\(\) => setBig\(true\)\}/)
    expect(readFileSync('src/components/Crest.tsx', 'utf-8')).toMatch(/PhotoImg/)
  })
})
