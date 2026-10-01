import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

// Where the build will be served from.
//   SITE_DOMAIN=habits.example.com  -> custom domain, served at the root
//   GH_PAGES=true                   -> github.io/habbit-trackerrr/ subpath
//   neither                         -> root (dev, preview, self-hosting)
// A custom domain always wins: it is served at the root, so the subpath
// base would break every asset URL.
const SITE_DOMAIN = (process.env.SITE_DOMAIN || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '')
const base = SITE_DOMAIN ? '/' : process.env.GH_PAGES === 'true' ? '/habbit-trackerrr/' : '/'
const SITE_URL = SITE_DOMAIN ? `https://${SITE_DOMAIN}` : ''

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
      const tags = [
        { tag: 'meta', attrs: { name: 'build-id', content: BUILD_ID }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'build-time', content: BUILD_TIME }, injectTo: 'head' },
      ]
      // A canonical URL and absolute social images only make sense once
      // the site has one real address, so they appear with SITE_DOMAIN.
      if (SITE_URL) {
        tags.push(
          { tag: 'link', attrs: { rel: 'canonical', href: `${SITE_URL}/` }, injectTo: 'head' },
          { tag: 'meta', attrs: { property: 'og:url', content: `${SITE_URL}/` }, injectTo: 'head' },
        )
        html = html
          .replace('content="./icon-512.png"', `content="${SITE_URL}/icon-512.png"`)
          .replaceAll('content="./icon-512.png"', `content="${SITE_URL}/icon-512.png"`)
      }
      return { html, tags }
    },
    // public/sw.js is copied verbatim to dist — stamp the per-build cache
    // version after the copy (closeBundle runs last). Fail loudly if the
    // placeholder is missing, so a mis-versioned worker can never deploy.
    closeBundle() {
      const swPath = resolve(outDir, 'sw.js')
      if (!existsSync(swPath)) {
        // A failed build never reaches the emit stage. Throwing here would
        // mask the real error, so warn and let that error surface instead.
        if (!existsSync(outDir)) {
          console.warn('[aaru-build-identity] no build output — skipping sw.js stamp')
          return
        }
        throw new Error('aaru-build-identity: dist/sw.js missing')
      }
      const text = readFileSync(swPath, 'utf8')
      if (!text.includes('__BUILD_ID__')) {
        throw new Error('aaru-build-identity: __BUILD_ID__ placeholder missing from sw.js')
      }
      writeFileSync(swPath, text.replaceAll('__BUILD_ID__', BUILD_ID))

      // GitHub Pages reads dist/CNAME to bind the custom domain. It is
      // written only when a domain was supplied, because an empty or
      // wrong CNAME takes the whole site offline.
      if (SITE_DOMAIN) {
        writeFileSync(resolve(outDir, 'CNAME'), `${SITE_DOMAIN}\n`)
        console.log(`[aaru-build-identity] custom domain ${SITE_DOMAIN} → CNAME`)
      }
      // Tell crawlers where the canonical copy lives.
      writeFileSync(
        resolve(outDir, 'robots.txt'),
        SITE_URL
          ? `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`
          : 'User-agent: *\nAllow: /\n'
      )
      if (SITE_URL) {
        const pages = ['', 'privacy', 'terms']
        writeFileSync(
          resolve(outDir, 'sitemap.xml'),
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          pages.map((p) => `  <url><loc>${SITE_URL}/${p ? `#/${p}` : ''}</loc></url>`).join('\n') +
          '\n</urlset>\n'
        )
      }
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
  // in dist/index.html (<meta name="build-time">,
  // unhashed) and is shown in Settings → About.
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
    /* Verification only. With SUPABASE_STUB=1 the dev server proxies the
       local stub (qa/supabase-stub.mjs) onto its own origin, so the real
       Supabase SDK can be driven through real HTTP in a browser. Never
       enabled in a production build. */
    proxy: process.env.SUPABASE_STUB
      ? {
          '/supabase-stub': {
            target: `http://127.0.0.1:${process.env.SUPABASE_STUB_PORT || 54321}`,
            changeOrigin: true,
            rewrite: (p) => p.replace(/^\/supabase-stub/, ''),
          },
        }
      : undefined,
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
