import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Profile } from '../types'
import { disablePush } from './push'
import { supabase } from './supabase'
import { usernameToEmail } from './username'

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signIn: (username: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

// The last profile that was read is kept on the device: with a bad network the screen must not turn into
// "no profile". (It only decides which screen to show; the database still enforces every permission.)
const cacheKey = (userId: string) => `carreapp.profile.${userId}`
function readCache(userId: string): Profile | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId))
    return raw ? (JSON.parse(raw) as Profile) : null
  } catch {
    return null
  }
}
function writeCache(userId: string, profile: Profile | null) {
  try {
    if (profile) localStorage.setItem(cacheKey(userId), JSON.stringify(profile))
    else localStorage.removeItem(cacheKey(userId))
  } catch {
    /* storage unavailable: just no cache */
  }
}

// `failed` means the request did not work (network); a missing profile with no error is a real "no profile".
// photo_path (migration 0018) is asked for first; if the column does not exist yet the profile is read without it,
// so signing in keeps working while the SQL is pending.
async function fetchProfile(userId: string): Promise<{ profile: Profile | null; failed: boolean }> {
  if (!supabase) return { profile: null, failed: false }
  const read = (columns: string) => supabase!.from('profiles').select(columns).eq('id', userId).maybeSingle()
  let { data, error } = await read('id, username, full_name, role, photo_path')
  if (error?.code === '42703' || /photo_path/.test(error?.message ?? '')) ({ data, error } = await read('id, username, full_name, role'))
  if (error) return { profile: null, failed: true }
  if (data) return { profile: data as unknown as Profile, failed: false }
  // No profile: it can be the personal login of an inductor (migration 0023), which opens only their passport.
  const passport = await supabase.from('passports').select('id, username, full_name, photo_path').eq('id', userId).maybeSingle()
  if (passport.data) return { profile: { ...passport.data, role: 'member' }, failed: false }
  // (a missing table or a policy error means the SQL is not applied yet: that is "no profile", not a network failure)
  return { profile: null, failed: Boolean(passport.error && !passport.error.code) }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    let active = true

    let retry: ReturnType<typeof setTimeout> | undefined
    async function apply(next: Session | null) {
      if (!active) return
      clearTimeout(retry)
      setSession(next)
      if (!next) {
        setProfile(null)
        setLoading(false)
        return
      }
      const { profile: fresh, failed } = await fetchProfile(next.user.id)
      if (!active) return
      if (failed) {
        // Network trouble: keep what we know (current profile, else the saved one) and try again shortly.
        setProfile((current) => current ?? readCache(next.user.id))
        retry = setTimeout(() => void apply(next), 4000)
        setLoading((wasLoading) => (wasLoading && !readCache(next.user.id) ? true : false))
        return
      }
      writeCache(next.user.id, fresh)
      setProfile(fresh)
      setLoading(false)
    }

    supabase.auth.getSession().then(({ data }) => apply(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      // Defer to avoid awaiting Supabase calls inside the auth callback.
      setTimeout(() => apply(next), 0)
    })
    return () => {
      active = false
      clearTimeout(retry)
      sub.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (username: string, password: string) => {
    if (!supabase) return 'La aplicación no está configurada.'
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    })
    if (!error) return null
    // No HTTP status means the request never reached the server (no network): do not blame the password.
    return error.status ? 'Usuario o contraseña incorrectos.' : 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.'
  }, [])

  const signOut = useCallback(async () => {
    // This phone must stop receiving pushes meant for the signed-out user (needs the session: do it first).
    await disablePush().catch(() => undefined)
    await supabase?.auth.signOut()
  }, [])

  const value = useMemo(
    () => ({ session, profile, loading, signIn, signOut }),
    [session, profile, loading, signIn, signOut],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export const homePathForRole = { admin: '/admin', base: '/base', runner: '/corredor', member: '/pasaporte' } as const
