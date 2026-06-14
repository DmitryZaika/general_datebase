import path from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [],
  resolve: {
    tsconfigPaths: true,
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
