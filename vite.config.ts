import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { reactRouter } from '@react-router/dev/vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import devtoolsJson from 'vite-plugin-devtools-json'

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
