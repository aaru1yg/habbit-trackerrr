import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Bind to all interfaces so the sandbox preview proxy can reach the dev server.
export default defineConfig({
  plugins: [react()],
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
})
