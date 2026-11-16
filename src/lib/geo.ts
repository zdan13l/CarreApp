import { useEffect, useRef, useState } from 'react'
import type { LngLat } from './mapbox'

export interface Position {
  lng: number
  lat: number
  accuracy: number
  heading: number | null
  speed: number | null
}

// Distance in meters between two points (haversine).
export function distanceMeters(a: LngLat, b: LngLat): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// A position that has not been updated for an hour is dropped from the live map (someone forgot to stop
// sharing, or the Carrera is over): it must not stay on the map as a ghost.
export const LOCATION_HIDE_AFTER_MS = 60 * 60 * 1000
export const isLocationFresh = (updatedAt: string, now: number): boolean =>
  now - new Date(updatedAt).getTime() < LOCATION_HIDE_AFTER_MS

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return `hace ${seconds} s`
  const minutes = Math.round(seconds / 60)
  return minutes < 60 ? `hace ${minutes} min` : `hace ${Math.round(minutes / 60)} h`
}

// Watches the device position while `enabled`. On iOS the permission prompt needs a user
// gesture, so `enabled` should be switched on from a button tap.
export function useWatchPosition(enabled: boolean) {
  const [position, setPosition] = useState<Position | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    if (!('geolocation' in navigator)) {
      setError('Este dispositivo no permite usar la ubicación.')
      return
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setError(null)
        setPosition({
          lng: p.coords.longitude,
          lat: p.coords.latitude,
          accuracy: p.coords.accuracy,
          heading: p.coords.heading,
          speed: p.coords.speed,
        })
      },
      (e) =>
        setError(
          e.code === e.PERMISSION_DENIED
            ? 'Permiso de ubicación denegado. Actívalo en los ajustes del teléfono para CarreApp / Safari.'
            : 'No se pudo obtener tu ubicación. Revisa que el GPS esté activo.',
        ),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [enabled])

  return { position: enabled ? position : null, error: enabled ? error : null }
}

// Keeps the screen on while `active` (GPS only works with the app open and the screen on).
export function useWakeLock(active: boolean) {
  const lock = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let cancelled = false
    const acquire = async () => {
      try {
        const sentinel = await navigator.wakeLock.request('screen')
        if (cancelled) void sentinel.release()
        else lock.current = sentinel
      } catch {
        // Not allowed (low battery, unsupported): the user just keeps the screen on manually.
      }
    }
    void acquire()
    // The lock is released when the app goes to the background: ask again on return.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock.current?.release()
      lock.current = null
    }
  }, [active])
}
