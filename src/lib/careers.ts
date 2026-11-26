import { careerKey } from '../components/CareerEmblem'

/** The name of a career without the word «Ingeniería» (Ingeniería de Sistemas → Sistemas). */
export const shortCareer = (career: string) => career.replace(/^ingenier[ií]a\s+(de\s+|en\s+)?/i, '').trim() || career

export interface PersonMedal {
  career: string
  /** The other career of a double program (its medal can be the generic one). */
  other: boolean
}

/**
 * The medals of a person: the one of their career and, in a double program, the one of the other career. Another engineering brings its own
 * medal (two careers of the same group of careers share one, so it is shown once); a career that is not an engineering gets the generic medal.
 */
export function medalsOf(career: string | null | undefined, secondCareer?: string | null): PersonMedal[] {
  const first = career?.trim() ?? ''
  const second = secondCareer?.trim() ?? ''
  const medals: PersonMedal[] = first ? [{ career: first, other: false }] : []
  if (!second) return medals
  const key = careerKey(second)
  if (first && key !== 'general' && key === careerKey(first)) return medals
  return [...medals, { career: second, other: true }]
}
