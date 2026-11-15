// Supabase Auth needs an email, so each username maps to a synthetic one.
const EMAIL_DOMAIN = 'carreapp.test'

// Also accepts the full internal email (e.g. "admin@carreapp.test") and keeps only the username.
export function normalizeUsername(raw: string): string {
  const value = raw.trim().toLowerCase()
  const suffix = `@${EMAIL_DOMAIN}`
  return value.endsWith(suffix) ? value.slice(0, -suffix.length) : value
}

export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${EMAIL_DOMAIN}`
}

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/
