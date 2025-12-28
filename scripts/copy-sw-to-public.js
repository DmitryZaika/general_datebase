/**
 * Copy Service Worker to public/ directory for dev mode
 *
 * Why needed:
 * - Production: SW served from build/client/service-worker.js
 * - Dev mode: Vite serves static files from public/ directory
 * - Without this copy, /service-worker.js returns 404 in dev mode
 *
 * Usage: npm run copy-sw (part of build process)
 */

import { copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

const source = join(rootDir, 'build/client/service-worker.js')
const dest = join(rootDir, 'public/service-worker.js')

if (existsSync(source)) {
  copyFileSync(source, dest)
}
