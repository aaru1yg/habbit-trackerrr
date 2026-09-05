/* ============================================================
   Production deployment smoke test.
   Run: node qa/prod-smoke.mjs   (builds nothing — serves ./dist)
   Requires: GH_PAGES=true npm run build   (so dist/ matches Pages bytes)

   Serves dist/ under /habbit-trackerrr/ with plain node:http — the same
   subpath + service-worker scope GitHub Pages uses — then verifies in a
   FRESH headless-Chromium profile:
     1. build identity: <meta name="build-id">, window.__BUILD_ID__,
        visible build captions (onboarding + settings)
     2. fingerprinted hashed assets, zero console/page/request errors
     3. service worker installs with the per-build cache version
     4. OLD (v6) → NEW (v7-<sha>) worker transition evicts stale caches
     5. offline reload still renders (PWA fallback intact)
     6. V3 UI actually served: seeded routes incl. today hero, calendar,
        week, insights, projects, assignments, workload, mind, habit
        detail, add-habit, settings
   Exits non-zero on any failure.
   ============================================================ */
import http from 'http'
import { readFileSync, existsSync, statSync } from 'fs'
import { join, extname } from 'path'
import { execSync } from 'child_process'
import { launch, newPage, check, sleep, report, seedAndGoto, seededStateV4, clickByLabel, results } from './helpers.mjs'

const ROOT = process.cwd()
const DIST = join(ROOT, 'dist')
const SUBPATH = '/habbit-trackerrr'
if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/ missing — run: GH_PAGES=true npm run build')
  process.exit(2)
}

// Expected identity: the artifact's own meta must equal the git commit.
const distHtml = readFileSync(join(DIST, 'index.html'), 'utf8')
const metaId = (distHtml.match(/<meta name="build-id" content="([^"]+)"/) || [])[1] || null
let gitId = null
try {
  gitId = execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim()
} catch { /* detached tarball — meta-only checks */ }
const EXPECTED = metaId
console.log(`artifact build-id: ${metaId}   git HEAD: ${gitId}`)

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
}

// Mutable override lets the old→new SW test serve a stale worker first.
let swOverride = null
const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://x')
    let path = decodeURIComponent(url.pathname)
    if (!path.startsWith(SUBPATH)) {
      res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return
    }
    path = path.slice(SUBPATH.length) || '/'
    if (path === '/sw.js' && swOverride !== null) {
      res.writeHead(200, { 'content-type': MIME['.js'], 'cache-control': 'no-store' })
      res.end(swOverride); return
    }
    if (path.endsWith('/')) path += 'index.html'
    const file = join(DIST, path)
    if (!file.startsWith(DIST) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return
    }
    const headers = { 'content-type': MIME[extname(file)] || 'application/octet-stream' }
    if (path === '/sw.js') headers['cache-control'] = 'no-store' // updates must never stick
    res.writeHead(200, headers)
    res.end(readFileSync(file))
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain' }); res.end(String(e))
  }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const PORT = server.address().port
const BASE = `http://127.0.0.1:${PORT}${SUBPATH}`
console.log(`serving dist/ at ${BASE}/`)

const browser = await launch()
const page = await newPage(browser)
const qaErrors = () => [...page._qa.consoleErrors, ...page._qa.pageErrors, ...page._qa.failedRequests]

try {
  /* ---------- 1. fresh profile: identity + hashed assets ---------- */
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
  await sleep(600)
  check('artifact carries a build-id meta', !!metaId, distHtml.slice(0, 120))
  if (gitId) check('build-id meta equals git HEAD', metaId === gitId, `${metaId} vs ${gitId}`)
  const live = await page.evaluate(() => ({
    meta: document.querySelector('meta[name="build-id"]')?.content || null,
    win: window.__BUILD_ID__ || null,
    caption: document.querySelector('[data-build-id]')?.textContent?.trim() || null,
    scripts: [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')),
    css: [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute('href')),
    onboarding: /What should we call you\?/.test(document.body.textContent || ''),
  }))
  check('live meta build-id matches artifact', live.meta === EXPECTED, live.meta)
  check('window.__BUILD_ID__ matches artifact', live.win === EXPECTED, live.win)
  check('onboarding shows build caption', !!live.caption && live.caption.includes(EXPECTED), live.caption)
  check('fresh profile renders onboarding', live.onboarding)
  const hashed = (u) => /\/assets\/[^/]+-[A-Za-z0-9_-]{6,}\.(js|css)$/.test(u || '')
  check('JS bundle fingerprinted + subpath', live.scripts.some(hashed), live.scripts.join(','))
  check('CSS bundle fingerprinted + subpath', live.css.some(hashed), live.css.join(','))
  check('no unhashed /src/ references in prod HTML', !/src\/main\.jsx/.test(distHtml))

  // SW installs with per-build cache version.
  await page.waitForFunction(
    () => navigator.serviceWorker?.controller || (window.__swReady === true),
    { timeout: 15000 },
  ).catch(() => {})
  await sleep(1500)
  const sw = await page.evaluate(async () => ({
    controller: !!navigator.serviceWorker?.controller,
    script: (await navigator.serviceWorker?.getRegistration())?.active?.scriptURL || null,
    caches: await caches.keys(),
  }))
  check('service worker controls the page', sw.controller, JSON.stringify(sw))
  check('SW script served from subpath scope', (sw.script || '').includes('/habbit-trackerrr/sw.js'), sw.script)
  check('SW cache carries build id', sw.caches.some((c) => c === `aaru-habits-v7-${EXPECTED}`), sw.caches.join(','))
  check('no page/console/network errors on fresh load', qaErrors().length === 0, qaErrors().slice(0, 3).join(' | '))

  /* ---------- 2. OLD (v6) → NEW worker transition ---------- */
  const page2 = await newPage(browser)
  const newSwText = readFileSync(join(DIST, 'sw.js'), 'utf8')
  if (!newSwText.includes(`aaru-habits-v7-${EXPECTED}`)) {
    check('dist/sw.js stamped with build id', false, 'placeholder not replaced')
  } else {
    check('dist/sw.js stamped with build id', true)
    // Serve the previous generation's worker first (same logic, v6 cache name).
    swOverride = newSwText.replace(`aaru-habits-v7-${EXPECTED}`, 'aaru-habits-v6')
    await page2.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
    await sleep(2000)
    const before = await page2.evaluate(() => caches.keys())
    check('old worker installed (v6 cache present)', before.includes('aaru-habits-v6'), before.join(','))
    // Deploy the new worker; the app auto-reloads on controllerchange.
    swOverride = null
    await page2.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()))
    await page2.waitForFunction(
      (id) => caches.keys().then((ks) => ks.some((k) => k === `aaru-habits-v7-${id}`) && !ks.includes('aaru-habits-v6')),
      { timeout: 20000 }, EXPECTED,
    )
    const after = await page2.evaluate(() => caches.keys())
    check('stale v6 cache evicted after update', !after.includes('aaru-habits-v6'), after.join(','))
    check('new per-build cache active', after.some((c) => c === `aaru-habits-v7-${EXPECTED}`), after.join(','))
    await page2.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
    await sleep(500)
    const caption2 = await page2.evaluate(() => document.querySelector('[data-build-id]')?.textContent || '')
    check('updated client shows new build', caption2.includes(EXPECTED), caption2.trim())
    check('no errors during worker update', page2._qa.consoleErrors.length + page2._qa.pageErrors.length === 0,
      [...page2._qa.consoleErrors, ...page2._qa.pageErrors].slice(0, 3).join(' | '))
  }
  await page2.close()

  /* ---------- 3. offline fallback still works ---------- */
  // Dedicated page: first online load installs the worker (its own requests
  // bypass it), the second online load populates the runtime cache, then the
  // offline reload must still render from cache.
  const pageOff = await newPage(browser)
  await pageOff.goto(`${BASE}/`, { waitUntil: 'networkidle0' })
  await pageOff.reload({ waitUntil: 'networkidle0' })
  await sleep(800)
  await pageOff.setOfflineMode(true)
  await pageOff.reload({ waitUntil: 'domcontentloaded' })
  await sleep(1500)
  const offline = await pageOff.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent || '',
    caption: document.querySelector('[data-build-id]')?.textContent || '',
  }))
  check('offline reload renders app shell', /What should we call you\?/.test(offline.h1), offline.h1)
  check('offline shell shows build caption', offline.caption.includes(EXPECTED), offline.caption.trim())
  await pageOff.close()

  /* ---------- 4. V3 UI on every route (seeded, onboarded) ---------- */
  // Fresh page: seedAndGoto injects storage before first paint, which only
  // works when navigation creates a new document (not a hash-only change).
  const pageApp = await newPage(browser)
  const appErrors = () => [...pageApp._qa.consoleErrors, ...pageApp._qa.pageErrors, ...pageApp._qa.failedRequests]
  const state = seededStateV4()
  const routes = [
    ['today', /Today’s focus|good morning|good afternoon|good evening/i],
    ['calendar', /calendar/i],
    ['week', /week/i],
    ['insights', /insight/i],
    ['projects', /project/i],
    ['assignments', /assignment/i],
    ['workload', /workload|capacity/i],
    ['mind', /mind|mood|energy/i],
    ['settings', new RegExp(`Build ${EXPECTED.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)],
  ]
  for (const [route, re] of routes) {
    await seedAndGoto(pageApp, state, route, BASE)
    const text = await pageApp.evaluate(() => document.body.textContent || '')
    check(`route #/${route} renders`, re.test(text), text.slice(0, 90).replace(/\s+/g, ' '))
  }
  // V3 markers: new hero markup + new energy.css rules in the served CSS.
  await seedAndGoto(pageApp, state, 'today', BASE)
  const v3 = await pageApp.evaluate(() => ({
    hero: !!document.querySelector('.today-hero'),
    kicker: [...document.querySelectorAll('.today-kicker')].map((e) => e.textContent.trim()),
  }))
  check('V3 today hero served', v3.hero)
  check('V3 kicker copy served', v3.kicker.join(' ').includes('Today’s focus'), v3.kicker.join('|'))
  const cssUrl = (await pageApp.evaluate(() => [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href)))[0]
  const cssText = await pageApp.evaluate((u) => fetch(u).then((r) => r.text()), cssUrl)
  check('served CSS contains V3 energy rules', cssText.includes('.today-hero') && cssText.includes('.today-kicker'))

  /* ---------- 5. habit detail + add habit ---------- */
  await seedAndGoto(pageApp, state, 'today', BASE)
  await clickByLabel(pageApp, '^Details for Morning run$')
  await sleep(600)
  const sheetText = await pageApp.evaluate(() => document.body.textContent || '')
  check('habit detail sheet opens', /current streak/i.test(sheetText) && /best streak/i.test(sheetText))
  await pageApp.keyboard.press('Escape')
  await sleep(400)
  await clickByLabel(pageApp, '^Add a habit$')
  await sleep(600)
  const formOpen = await pageApp.evaluate(() => !!document.querySelector('#habit-name'))
  check('add-habit form opens', formOpen)
  check('no errors across seeded routes', appErrors().length === 0, appErrors().slice(0, 3).join(' | '))
  await pageApp.close()
} catch (err) {
  check('smoke run crashed', false, String(err && err.stack || err).split('\n').slice(0, 4).join(' | '))
} finally {
  await browser.close()
  server.close()
}

report('PROD SMOKE')
if (results.fail) process.exitCode = 1
