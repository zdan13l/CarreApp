import { supabase } from './supabase'

// Web push: notifications that arrive with the phone locked or the app closed.
// On iPhone it only works with the app installed on the home screen (iOS 16.4+) and the
// permission must be requested from a button tap.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export type PushState = 'unconfigured' | 'unsupported' | 'denied' | 'off' | 'on'

export const pushConfigured = Boolean(VAPID_PUBLIC_KEY)

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function keyToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export async function pushState(): Promise<PushState> {
  if (!pushConfigured) return 'unconfigured'
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

// Asks for permission, subscribes this phone and saves the subscription for the signed-in user.
export async function enablePush(): Promise<string | null> {
  if (!supabase || !VAPID_PUBLIC_KEY) return 'Las notificaciones no están configuradas.'
  if (!pushSupported()) return 'Este teléfono no permite notificaciones. En iPhone instala la app en la pantalla de inicio.'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'Permiso de notificaciones denegado. Actívalo en los ajustes del teléfono.'
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY) }))
  const json = sub.toJSON()
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh ?? '',
    p_auth: json.keys?.auth ?? '',
  })
  return error ? 'No se pudo guardar la suscripción. Inténtalo de nuevo.' : null
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await supabase?.rpc('remove_push_subscription', { p_endpoint: sub.endpoint })
  await sub.unsubscribe()
}
