import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { defineConfig } from 'vite'
import devtoolsJson from 'vite-plugin-devtools-json'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), tailwindcss(), reactRouter(), devtoolsJson()],
  resolve: {
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
