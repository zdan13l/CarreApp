// The birthday of a person: the code of their passport (PUJ-DDMMAAAA) and their age come from it. Dates travel as ISO «AAAA-MM-DD».
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/

/** True for a real calendar date written as AAAA-MM-DD (no 31 of February). */
export function isRealDate(iso: string): boolean {
  const m = ISO.exec(iso)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
}

/** A date as the Excel, the form or a person writes it (2005-03-15, 15/03/2005, 15-3-2005, 15.03.2005) -> AAAA-MM-DD; '' when empty, null when it cannot be read. */
export function parseBirthday(text: string): string | null {
  const t = text.trim()
  if (!t) return ''
  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(t)
  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t)
  const parts = iso ? [iso[1], iso[2], iso[3]] : dmy ? [dmy[3], dmy[2], dmy[1]] : null
  if (!parts) return null
  const out = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
  return isRealDate(out) ? out : null
}

/** Why a birthday cannot be saved (null = fine or none): a real date of someone between 10 and 100 years old. */
export function birthdayProblem(iso: string | null | undefined, today = new Date()): string | null {
  if (!iso) return null
  if (!isRealDate(iso)) return 'Esa fecha de cumpleaños no existe.'
  const age = ageOf(iso, today)
  return age === null || age < 10 || age > 100 ? 'Revisa el año del cumpleaños: la edad no es razonable.' : null
}

/** The code of the passport: «PUJ-» + day, month and year of the birthday (15 March 2005 -> PUJ-15032005). null without a valid birthday. */
export function birthdayCode(iso: string | null | undefined): string | null {
  const m = iso ? ISO.exec(iso) : null
  return m && isRealDate(iso!) ? `PUJ-${m[3]}${m[2]}${m[1]}` : null
}

/** The age in whole years on a day (today by default); null without a valid birthday. */
export function ageOf(iso: string | null | undefined, today = new Date()): number | null {
  const m = iso ? ISO.exec(iso) : null
  if (!m || !isRealDate(iso!)) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  let age = today.getFullYear() - y
  if (today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d)) age -= 1
  return age
}
