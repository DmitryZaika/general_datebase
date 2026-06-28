import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      '~': path.resolve(rootDir, 'app'),
      '@': path.resolve(rootDir, 'app'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./test-setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'threads',
    exclude: [
      '**/node_modules/**',
      '**/app/orm/contract.test.ts',
      '**/app/utils/cloudtalkSmsService.test.ts',
      '**/app/utils/instructionImages.test.ts',
    ],
  },
})
