import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// When deploying to GitHub Pages (subpath URL), build with a base of '/habbit-trackerrr/'.
// Dev / preview (the sandbox live preview) uses the root base so nothing breaks.
const base = process.env.GH_PAGES === 'true' ? '/habbit-trackerrr/' : '/'

export default defineConfig({
  plugins: [react()],
  base,
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Allow the sandbox preview host (e2b.app) to reach the dev server.
    allowedHosts: ['.e2b.app', 'localhost', '127.0.0.1'],
    watch: { usePolling: true },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    allowedHosts: ['.e2b.app', 'localhost', '127.0.0.1'],
  },
  build: {
    chunkSizeWarningLimit: 900,
  },
})
