/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import {
  CacheFirst,
  NetworkFirst,
  NetworkOnly,
  StaleWhileRevalidate,
} from 'workbox-strategies'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { ExpirationPlugin } from 'workbox-expiration'
import { BackgroundSyncPlugin } from 'workbox-background-sync'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', () => {
  clientsClaim()
})

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST || [])
const CHECKLIST_PAGE_CACHE = 'checklist-page-v2'
const CHECKLIST_ASSETS_CACHE = 'checklist-assets-v2'
const IMAGES_CACHE = 'images-v2'

registerRoute(
  ({ request, url }) => {
    return (
      request.destination === 'document' &&
      url.pathname.match(/\/installers\/\d+\/checklist/)
    )
  },
  new StaleWhileRevalidate({
    cacheName: CHECKLIST_PAGE_CACHE,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 24 * 60 * 60,
      }),
    ],
  })
)
registerRoute(
  ({ request }) => {
    return (
      request.destination === 'style' ||
      request.destination === 'script' ||
      request.destination === 'font'
    )
  },
  new CacheFirst({
    cacheName: CHECKLIST_ASSETS_CACHE,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  })
)
registerRoute(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: IMAGES_CACHE,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  })
)
const bgSyncPlugin = new BackgroundSyncPlugin('checklist-queue', {
  maxRetentionTime: 24 * 60,
  onSync: async ({ queue }) => {
    let entry
    while ((entry = await queue.shiftRequest())) {
      try {
        const response = await fetch(entry.request.clone())
        if (!response.ok && response.status >= 500) {
          await queue.unshiftRequest(entry)
          throw new Error(`Server error: ${response.status}`)
        }
      } catch (error) {
        await queue.unshiftRequest(entry)
        throw error
      }
    }
  },
})

registerRoute(
  ({ url }) => url.pathname.match(/\/api\/checklist\/\d+/),
  new NetworkOnly({
    plugins: [bgSyncPlugin],
  }),
  'POST'
)

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkOnly()
)
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'pages',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
)
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(CHECKLIST_PAGE_CACHE).then(cache => {
        return cache.addAll(event.data.payload)
      })
    )
  }
})
