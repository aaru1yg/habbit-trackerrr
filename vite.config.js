import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

// When deploying to GitHub Pages (subpath URL), build with a base of '/habbit-trackerrr/'.
// Dev / preview (the sandbox live preview) uses the root base so nothing breaks.
const base = process.env.GH_PAGES === 'true' ? '/habbit-trackerrr/' : '/'

// Deterministic build identity: the deployed commit's short SHA. CI provides
// GITHUB_SHA; local builds resolve it from git; anything else is 'dev'.
function resolveBuildId() {
  const sha = (process.env.GITHUB_SHA || '').trim()
  if (/^[0-9a-f]{4,40}$/i.test(sha)) return sha.slice(0, 7)
  try {
    const local = execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim()
    if (/^[0-9a-f]{4,}$/i.test(local)) return local
  } catch {
    // not a git checkout — fall through to 'dev'
  }
  return 'dev'
}
const BUILD_ID = resolveBuildId()
const BUILD_TIME = new Date().toISOString()

// Bakes the build identity into the production artifact (no new dependencies):
//  - <meta name="build-id"> in dist/index.html proves exactly which commit is live
//  - dist/sw.js gets a per-build cache version, so every deployment installs a
//    fresh service worker that evicts the previous build's caches.
// Dev behaviour is unchanged (the SW only registers in PROD builds).
function buildIdentity() {
  let outDir = 'dist'
  return {
    name: 'aaru-build-identity',
    configResolved(config) {
      outDir = config.build.outDir
    },
    transformIndexHtml(html) {
      return {
        html,
        tags: [
          { tag: 'meta', attrs: { name: 'build-id', content: BUILD_ID }, injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'build-time', content: BUILD_TIME }, injectTo: 'head' },
        ],
      }
    },
    // public/sw.js is copied verbatim to dist — stamp the per-build cache
    // version after the copy (closeBundle runs last). Fail loudly if the
    // placeholder is missing, so a mis-versioned worker can never deploy.
    closeBundle() {
      const swPath = resolve(outDir, 'sw.js')
      if (!existsSync(swPath)) throw new Error('aaru-build-identity: dist/sw.js missing')
      const text = readFileSync(swPath, 'utf8')
      if (!text.includes('__BUILD_ID__')) {
        throw new Error('aaru-build-identity: __BUILD_ID__ placeholder missing from sw.js')
      }
      writeFileSync(swPath, text.replaceAll('__BUILD_ID__', BUILD_ID))
      console.log(`[aaru-build-identity] build ${BUILD_ID} (${BUILD_TIME}) → ${swPath}`)
    },
  }
}

export default defineConfig({
  plugins: [react(), buildIdentity()],
  base,
  // Only the commit SHA is inlined into JS: it is identical for every build of
  // the same commit, so hashed asset filenames stay deterministic and a local
  // build byte-matches the CI artifact. The wall-clock build time lives only
  // in dist/index.html (<meta name="build-time">, unhashed) and is read back
  // at runtime by src/lib/buildInfo.js.
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
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
