// The five committees of the induction. Every inductor belongs to one and each committee has ONE coordinator, whose stamp is the
// golden one. The stamps are drawn after the mythology of the semester (`CommitteeSeal`): a name, a tagline and an ink each.
export type CommitteeKey = string // a few have a drawing of their own (clausura, meraki, conzumo, carrera, caos, bienvenida); the rest get the generic seal

export interface Committee {
  key: CommitteeKey
  name: string
  tagline: string // on the lower ring of the stamp
  ink: 1 | 2 | 3 | 4 | 5 // --ink-N in index.css
  myth: string // what its stamp is, one line for the passport
  active?: boolean // a committee that was removed stays in old passports but is no longer offered
}

const BUILT_IN: Committee[] = [
  { key: 'clausura', name: 'Clausura', tagline: 'La bata de Homero', ink: 1, myth: 'La bata azul con la que Homero recitaba sus poemas.' },
  { key: 'meraki', name: 'Meraki', tagline: 'Con el alma, la pasión y el corazón', ink: 4, myth: 'Psique, el alma en forma de mariposa: servir con todo el corazón.' },
  { key: 'conzumo', name: 'Conzumo', tagline: 'La copa de Dionisio', ink: 2, myth: 'La copa de vino del dios Dionisio.' },
  { key: 'carrera', name: 'Carrera', tagline: 'Las olimpiadas', ink: 3, myth: 'Los juegos de la Grecia antigua: el corredor y la corona de laurel.' },
  { key: 'caos', name: 'Caos', tagline: 'El fuego de Prometeo', ink: 5, myth: 'Prometeo amaba tanto a los humanos que les regaló el fuego: el fuego que enciende otros fuegos.' },
  { key: 'bienvenida', name: 'Bienvenida', tagline: 'Quien te recibe', ink: 1, myth: 'El chaleco de quien da la bienvenida: la primera cara que ven los neos.' },
]

// The committees offered today (the active ones), as the coordinator keeps them in the panel (table `committees`, 0035). The list starts with the
// six the app was made with and is replaced when the database answers; it is changed IN PLACE so every screen that imported it sees the new one.
let everyCommittee: Committee[] = [...BUILT_IN]
export const COMMITTEES: Committee[] = [...BUILT_IN]
export function setCommittees(rows: { key: string; name: string; tagline: string | null; myth: string | null; ink: number; active: boolean }[]) {
  if (rows.length === 0) return
  everyCommittee = rows.map((r) => ({ key: r.key, name: r.name, tagline: r.tagline ?? '', ink: ((r.ink >= 1 && r.ink <= 5 ? r.ink : 1) as Committee['ink']), myth: r.myth ?? '', active: r.active }))
  COMMITTEES.splice(0, COMMITTEES.length, ...everyCommittee.filter((c) => c.active))
}
export const allCommittees = () => everyCommittee

/** Every committee a record belongs to, the main one first, with whether they coordinate it. */
export function committeesOfRecord(r: { committee?: string | null; committee_lead?: boolean; extra_committees?: string[]; extra_leads?: string[] }): { key: string; lead: boolean }[] {
  const out: { key: string; lead: boolean }[] = []
  if (r.committee) out.push({ key: r.committee, lead: Boolean(r.committee_lead) })
  for (const key of r.extra_committees ?? []) if (!out.some((o) => o.key === key)) out.push({ key, lead: (r.extra_leads ?? []).includes(key) })
  return out
}

export function committeeOf(key: string | null | undefined): Committee | null {
  return everyCommittee.find((c) => c.key === key) ?? null
}
