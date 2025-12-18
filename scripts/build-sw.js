import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { injectManifest } from 'workbox-build'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

async function buildServiceWorker() {
  try {
    console.log('[SW Build] Starting Service Worker build...')

    const { count, size, warnings } = await injectManifest({
      // Source Service Worker file
      swSrc: join(rootDir, 'build/client/service-worker.js'),

      // Destination
      swDest: join(rootDir, 'build/client/service-worker.js'),

      // Directory to scan for files to precache
      globDirectory: join(rootDir, 'build/client'),

      // Patterns to match files for precaching
      globPatterns: [
        // Core app files
        '**/*.{js,css}',
      ],

      // Ignore patterns
      globIgnores: [
        '**/node_modules/**',
        '**/service-worker.js', // Don't precache itself
        '**/*.map', // Don't precache source maps
      ],

      // Maximum file size to precache (5MB)
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,

      // Injection point in service-worker.js
      injectionPoint: 'self.__WB_MANIFEST',

      // Don't include revision info for files with hash in name
      dontCacheBustURLsMatching: /\.[0-9a-f]{8}\./,
    })

    console.log(`[SW Build]: Service Worker built successfully!`)
    console.log(`[SW Build]: Precached ${count} files (${(size / 1024).toFixed(2)} KB)`)

    if (warnings.length > 0) {
      console.warn('[SW Build] Warnings:')
      warnings.forEach(warning => console.warn(`  - ${warning}`))
    }
  } catch (error) {
    console.error('[SW Build]: Failed to build Service Worker:', error)
    process.exit(1)
  }
}

buildServiceWorker()
