// The five committees of the induction. Every inductor belongs to one and each committee has ONE coordinator, whose stamp is the
// golden one. The stamps are drawn after the mythology of the semester (`CommitteeSeal`): a name, a tagline and an ink each.
export type CommitteeKey = 'clausura' | 'meraki' | 'conzumo' | 'carrera' | 'caos'

export interface Committee {
  key: CommitteeKey
  name: string
  tagline: string // on the lower ring of the stamp
  ink: 1 | 2 | 3 | 4 | 5 // --ink-N in index.css
  myth: string // what its stamp is, one line for the passport
}

export const COMMITTEES: Committee[] = [
  { key: 'clausura', name: 'Clausura', tagline: 'La bata de Homero', ink: 1, myth: 'La bata azul con la que Homero recitaba sus poemas.' },
  { key: 'meraki', name: 'Meraki', tagline: 'Hecho con el alma', ink: 4, myth: 'Psique, el alma en forma de mariposa: servir con todo el corazón.' },
  { key: 'conzumo', name: 'Conzumo', tagline: 'La copa de Dionisio', ink: 2, myth: 'La copa de vino del dios Dionisio.' },
  { key: 'carrera', name: 'Carrera', tagline: 'Las olimpiadas', ink: 3, myth: 'Los juegos de la Grecia antigua: el corredor y la corona de laurel.' },
  { key: 'caos', name: 'Caos', tagline: 'El fuego de Prometeo', ink: 5, myth: 'Prometeo amaba tanto a los humanos que les regaló el fuego: el fuego que enciende otros fuegos.' },
]

export function committeeOf(key: string | null | undefined): Committee | null {
  return COMMITTEES.find((c) => c.key === key) ?? null
}
