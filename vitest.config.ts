import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./test-setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'threads',
  },
})
