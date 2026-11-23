import { Plus } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import CommitteeSeal from '../../components/CommitteeSeal'
import { loadCatalog } from '../../lib/catalog'
import { useCatalogVersion } from '../../lib/catalogStore'
import { allCommittees, committeesOfRecord, type Committee } from '../../lib/committees'
import { confirmDialog } from '../../lib/dialog'
import { supabase } from '../../lib/supabase'
import { errMsg } from './AdminContext'

interface Rec {
  id: string
  committee: string | null
  committee_lead: boolean
  extra_committees: string[]
  extra_leads: string[]
  passports: { full_name: string; username: string } | null
}

const slug = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 20)

// The committees of the induction, kept by hand: rename them, add or remove one, and choose who coordinates each one in the open semester.
// A committee always has a coordi: the one with the golden stamp. The coordi is chosen per semester (it is a mark on the person's record of that
// semester), so changing it here never touches old passports.
export default function Comites() {
  useCatalogVersion()
  const [term, setTerm] = useState<{ id: string; name: string } | null>(null)
  const [records, setRecords] = useState<Rec[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newTagline, setNewTagline] = useState('')
  const [newInk, setNewInk] = useState(1)

  const load = useCallback(async () => {
    if (!supabase) return
    const { data: t } = await supabase.from('terms').select('id, name').eq('is_current', true).maybeSingle()
    setTerm(t ?? null)
    if (t) {
      const r = await supabase
        .from('passport_records')
        .select('id, committee, committee_lead, extra_committees, extra_leads, passports(full_name, username)')
        .eq('term_id', t.id)
      setRecords((r.data ?? []) as unknown as Rec[])
    }
    await loadCatalog()
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      await load()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const coordisOf = (key: string) => records.filter((r) => committeesOfRecord(r).some((c) => c.key === key && c.lead))

  function save(c: Committee, name: string, tagline: string) {
    if (!supabase || !name.trim()) return
    void run(async () => {
      const { error: err } = await supabase!.from('committees').update({ name: name.trim(), tagline: tagline.trim() || null }).eq('key', c.key)
      if (err) throw new Error('No se pudo guardar el comité.')
    })
  }

  async function toggle(c: Committee) {
    if (!supabase) return
    if (c.active !== false && !(await confirmDialog({ title: `¿Quitar el comité ${c.name}?`, message: 'Deja de ofrecerse al registrar inductores. Los pasaportes que ya lo tienen lo conservan.', confirmLabel: 'Quitar comité', tone: 'danger', icon: 'warning' }))) return
    void run(async () => {
      const { error: err } = await supabase!.from('committees').update({ active: c.active === false }).eq('key', c.key)
      if (err) throw new Error('No se pudo cambiar el comité.')
    })
  }

  function add(e: FormEvent) {
    e.preventDefault()
    const key = slug(newName)
    if (!supabase) return
    if (key.length < 3) return setError('El nombre necesita al menos 3 letras.')
    if (allCommittees().some((c) => c.key === key)) return setError('Ya existe un comité con ese nombre.')
    void run(async () => {
      const { error: err } = await supabase!.from('committees').insert({ key, name: newName.trim(), tagline: newTagline.trim() || null, ink: newInk, sort_order: allCommittees().length + 1 })
      if (err) throw new Error('No se pudo crear el comité.')
      setNewName('')
      setNewTagline('')
    })
  }

  // the new coordi takes the golden stamp of the committee and the old ones give it up
  function setCoordi(c: Committee, recordId: string) {
    const next = records.find((r) => r.id === recordId)
    if (!supabase || !next) return
    void run(async () => {
      for (const old of coordisOf(c.key)) {
        if (old.id === next.id) continue
        const patch = old.committee === c.key ? { committee_lead: false } : { extra_leads: old.extra_leads.filter((k) => k !== c.key) }
        const { error: err } = await supabase!.from('passport_records').update(patch).eq('id', old.id)
        if (err) throw new Error('No se pudo quitar al coordi anterior.')
      }
      let patch: Record<string, unknown>
      if (next.committee === c.key) patch = { committee_lead: true }
      else if (next.extra_committees.includes(c.key)) patch = { extra_leads: [...new Set([...next.extra_leads, c.key])] }
      else if (!next.committee) patch = { committee: c.key, committee_lead: true }
      else patch = { extra_committees: [...next.extra_committees, c.key], extra_leads: [...next.extra_leads, c.key] }
      const { error: err } = await supabase!.from('passport_records').update(patch).eq('id', next.id)
      if (err) throw new Error('No se pudo poner al coordi nuevo.')
    })
  }

  const committees = allCommittees()
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Preparación</p>
          <h1>Comités</h1>
        </div>
        <p className="head-meta">Cada comité siempre tiene un coordi (sello dorado). Aquí cambias el coordi, el nombre, y agregas o quitas comités.</p>
      </header>
      {error && <p className="error">{error}</p>}
      {!term && <p className="warn">Primero crea el semestre vigente en Inductores: el coordi se elige por semestre.</p>}

      <div className="committee-list">
        {committees.map((c) => {
          const coordis = coordisOf(c.key)
          return (
            <section key={c.key} className={`card committee-card${c.active === false ? ' off' : ''}`}>
              <CommitteeSeal committee={c.key} lead={coordis.length > 0} size={84} label={`Sello de ${c.name}`} />
              <div className="committee-body">
                <CommitteeEditor c={c} busy={busy} onSave={save} />
                {c.active !== false && (
                  <div className="committee-coordi">
                    {coordis.length === 0 ? (
                      <p className="warn">Sin coordi{term ? ` en ${term.name}` : ''}: elige uno.</p>
                    ) : (
                      <p>
                        <strong>Coordi{coordis.length > 1 ? 's' : ''}:</strong> {coordis.map((r) => r.passports?.full_name).join(', ')}
                      </p>
                    )}
                    {term && (
                      <select value="" disabled={busy} onChange={(e) => e.target.value && setCoordi(c, e.target.value)} aria-label={`Cambiar el coordi de ${c.name}`}>
                        <option value="">{coordis.length ? 'Cambiar coordi…' : 'Elegir coordi…'}</option>
                        {[...records]
                          .sort((a, b) => (a.passports?.full_name ?? '').localeCompare(b.passports?.full_name ?? '', 'es'))
                          .filter((r) => !coordis.some((x) => x.id === r.id))
                          .map((r) => (
                            <option key={r.id} value={r.id}>{r.passports?.full_name} (@{r.passports?.username})</option>
                          ))}
                      </select>
                    )}
                  </div>
                )}
                <button type="button" className="ghost" disabled={busy} onClick={() => void toggle(c)}>
                  {c.active === false ? 'Volver a ofrecer' : 'Quitar comité'}
                </button>
              </div>
            </section>
          )
        })}
      </div>

      <form className="card" onSubmit={add}>
        <h2>Agregar un comité</h2>
        <label className="inline-field">
          Nombre
          <input value={newName} maxLength={30} onChange={(e) => setNewName(e.target.value)} placeholder="Logística" />
        </label>
        <label className="inline-field">
          Frase del sello
          <input value={newTagline} maxLength={60} onChange={(e) => setNewTagline(e.target.value)} placeholder="Lo que lo define" />
        </label>
        <label className="inline-field">
          Color
          <select value={newInk} onChange={(e) => setNewInk(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>Tinta {n}</option>
            ))}
          </select>
        </label>
        <div className="row">
          <button disabled={busy || !newName.trim()}>
            <Plus size={18} aria-hidden="true" /> Agregar comité
          </button>
        </div>
      </form>
    </>
  )
}

function CommitteeEditor({ c, busy, onSave }: { c: Committee; busy: boolean; onSave: (c: Committee, name: string, tagline: string) => void }) {
  const [name, setName] = useState(c.name)
  const [tagline, setTagline] = useState(c.tagline)
  const changed = name.trim() !== c.name || tagline.trim() !== c.tagline
  return (
    <div className="committee-edit">
      <input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} aria-label={`Nombre del comité ${c.name}`} />
      <input value={tagline} maxLength={60} onChange={(e) => setTagline(e.target.value)} aria-label={`Frase del comité ${c.name}`} placeholder="Frase del sello" />
      {changed && (
        <button type="button" disabled={busy || !name.trim()} onClick={() => onSave(c, name, tagline)}>Guardar</button>
      )}
    </div>
  )
}
