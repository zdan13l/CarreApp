// Supabase Auth needs an email, so each username maps to a synthetic one.
const EMAIL_DOMAIN = 'carreapp.test'

// Also accepts the full internal email (e.g. "admin@carreapp.test") and keeps only the username.
// The @ may carry the Spanish ñ (muñoz). The login email is ASCII, so inside it the ñ travels as a «+», which no @ can contain.
export function normalizeUsername(raw: string): string {
  const value = raw.trim().normalize('NFC').toLowerCase()
  const suffix = `@${EMAIL_DOMAIN}`
  return value.endsWith(suffix) ? value.slice(0, -suffix.length).replace(/\+/g, 'ñ') : value
}

export const emailLocalOf = (username: string) => username.replace(/ñ/g, '+')

export function usernameToEmail(username: string): string {
  return `${emailLocalOf(normalizeUsername(username))}@${EMAIL_DOMAIN}`
}

export const USERNAME_PATTERN = /^[a-zñ0-9._-]{3,30}$/

/** Strips the accents but keeps the ñ: «Muñoz» is muñoz, «María» is maria. */
export const foldKeepingEnye = (text: string) =>
  text.normalize('NFD').replace(/n\u0303/g, 'ñ').replace(/N\u0303/g, 'Ñ').replace(/[\u0300-\u036f]/g, '').normalize('NFC')

// "María José Pérez" -> "maria.perez" (just a suggestion, the admin can edit it)
export function suggestUsername(fullName: string): string {
  const parts = foldKeepingEnye(fullName)
    .toLowerCase()
    .replace(/[^a-zñ\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return ''
  return parts.length === 1 ? parts[0] : `${parts[0]}.${parts[parts.length - 1]}`
}
