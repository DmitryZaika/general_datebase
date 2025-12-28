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

    // Service Worker updated and waiting to activate
    wb.addEventListener('waiting', () => {
      // Show update notification to user
      const updateConfirm = confirm('A new version is available. Reload to update?')

      if (updateConfirm) {
        wb.addEventListener('controlling', () => {
          window.location.reload()
        })

        wb.messageSkipWaiting()
      }
    })

    // Register the service worker
    wb.register().then(registration => {
      // Check for updates periodically (every hour)
      setInterval(
        () => {
          registration?.update()
        },
        60 * 60 * 1000,
      )
    })
  })
}
