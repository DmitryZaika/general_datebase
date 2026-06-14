import path from 'node:path'
import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import devtoolsJson from 'vite-plugin-devtools-json'

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), devtoolsJson()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@images': path.resolve(__dirname, 'public/images'),
      '~': path.resolve(__dirname, 'app'),
    },
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  server: {
    allowedHosts: ['.ngrok-free.app'],
  },
})
