/// <reference lib="webworker" />
// Service worker: offline shell (precache) + push notifications for the delay alerts.
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<string | { url: string; revision: string | null }> }

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }))

interface PushPayload {
  title?: string
  body?: string
  tag?: string
  url?: string
}

// A notification arrives even with the phone locked or the app closed. The same `tag` replaces
// the previous one and `renotify` makes it sound again, so a repeating delay keeps ringing.
self.addEventListener('push', (event) => {
  let data: PushPayload = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { body: event.data?.text() }
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'CarreApp', {
      body: data.body,
      tag: data.tag,
      icon: '/pwa-192.png',
      badge: '/favicon.png',
      data: { url: data.url ?? '/' },
      ...({ renotify: true, vibrate: [300, 120, 300, 120, 300] } as object),
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url: string = event.notification.data?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => 'focus' in w)
      return open ? open.focus() : self.clients.openWindow(url)
    }),
  )
})
