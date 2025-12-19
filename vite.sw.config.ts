import path from 'node:path'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      '~': path.resolve(__dirname, 'app'),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'app/service-worker.ts'),
      name: 'ServiceWorker',
      formats: ['es'],
      fileName: () => 'service-worker.js',
    },
    outDir: 'build/client',
    emptyOutDir: false,
    rollupOptions: {
      output: {
        entryFileNames: 'service-worker.js',
        format: 'es',
      },
    },
  },
})
