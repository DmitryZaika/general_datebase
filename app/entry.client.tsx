import { StrictMode, startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { HydratedRouter } from 'react-router/dom'
import { Workbox } from 'workbox-window'

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  )
})

// Register Service Worker
if ('serviceWorker' in navigator && typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    const wb = new Workbox('/service-worker.js')

    // Service Worker installed for the first time
    wb.addEventListener('installed', event => {
      if (!event.isUpdate) {
        console.log('[SW] Service Worker installed for the first time')
      }
    })

    // Service Worker updated and waiting to activate
    wb.addEventListener('waiting', () => {
      console.log('[SW] New Service Worker waiting to activate')

      // Show update notification to user
      const updateConfirm = confirm('A new version is available. Reload to update?')

      if (updateConfirm) {
        wb.addEventListener('controlling', () => {
          window.location.reload()
        })

        wb.messageSkipWaiting()
      }
    })

    // Service Worker activated
    wb.addEventListener('activated', event => {
      if (!event.isUpdate) {
        console.log('[SW] Service Worker activated for the first time')
      } else {
        console.log('[SW] Service Worker updated')
      }
    })

    // Service Worker controlling the page
    wb.addEventListener('controlling', () => {
      console.log('[SW] Service Worker is now controlling the page')
    })

    // Service Worker registration error
    wb.addEventListener('redundant', () => {
      console.warn('[SW] Service Worker became redundant')
    })

    // Register the service worker
    wb.register()
      .then(registration => {
        console.log('[SW] Service Worker registered:', registration)

        // Check for updates periodically (every hour)
        setInterval(
          () => {
            registration?.update()
          },
          60 * 60 * 1000,
        )
      })
      .catch(error => {
        console.error('[SW] Service Worker registration failed:', error)
      })
  })
}
