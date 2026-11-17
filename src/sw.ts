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

// A notification arrives even with the phone locked or the app closed.
// Phones only ring when a notification is "new": a repeated alert with the same tag replaces the old one silently, and
// with a notification still on the screen some phones stay quiet for the next one. So every alert is shown as a brand
// new notification (a unique tag) AFTER the old ones are taken down: each one behaves like the first and rings.
self.addEventListener('push', (event) => {
  let data: PushPayload = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { body: event.data?.text() }
  }
  event.waitUntil(
    (async () => {
      const previous = await self.registration.getNotifications()
      previous.forEach((n) => n.close())
      await self.registration.showNotification(data.title ?? 'CarreApp', {
        body: data.body,
        tag: `${data.tag ?? 'carreapp'}-${Date.now()}`,
        icon: '/pwa-192.png',
        badge: '/favicon.png',
        data: { url: data.url ?? '/' },
        ...({ vibrate: [300, 120, 300, 120, 300], requireInteraction: true, silent: false } as object),
      })
    })(),
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
