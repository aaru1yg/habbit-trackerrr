/* ============================================================
   LIVE SMOKE TEST — against the deployed public site.

   This exists because of a specific, real failure. The v5 rewrite
   removed the Supabase layer on the reasoning that its credentials
   "were never set", so the auth UI was decoration. That reasoning
   was wrong: the deploy workflow did inject them and the live site
   did serve a working sign-in screen. The capability was lost for
   anyone using two devices, and nothing noticed.

   deploy.yml already asserts at build time that the host and key
   reached the bundle. That proves the artifact. It does not prove
   the artifact was published, boots in a browser, or still offers
   the account system. That is this script's job.

   It never signs in and never touches the database, so it is safe
   to run on every deployment with no credentials. The genuine
   round-trip and the RLS matrix live in qa/verify-supabase.mjs.

   Usage:
     SITE=https://user.github.io/repo/ node qa/live-smoke.mjs
     EXPECT_BUILD=<sha>   optional: assert this exact commit is live
     EXPECT_ACCOUNTS=0    for a deliberately local-only deployment
   ============================================================ */
import { launch, VIEWPORTS } from './helpers.mjs'

const SITE = (process.env.SITE || '').replace(/\/+$/, '') + '/'
const EXPECT_BUILD = process.env.EXPECT_BUILD || ''
const EXPECT_ACCOUNTS = process.env.EXPECT_ACCOUNTS !== '0'

if (!process.env.SITE) {
  console.error('SITE is required, e.g. SITE=https://aaru1yg.github.io/habbit-trackerrr/')
  process.exit(2)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}

const browser = await launch()
const ctx = await browser.createBrowserContext()
const page = await ctx.newPage()
await page.setViewport(VIEWPORTS.desktop)

const consoleErrors = []
const failedRequests = []
page.on('pageerror', (e) => consoleErrors.push(String(e.message)))
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
page.on('requestfailed', (r) => failedRequests.push(`${r.url()} ${r.failure()?.errorText}`))

/* ---- 1. It is actually served ------------------------------ */
const res = await page.goto(SITE, { waitUntil: 'networkidle2', timeout: 60000 })
check('the site responds 200', res && res.status() === 200, `status ${res && res.status()}`)

/* ---- 2. It boots ------------------------------------------- */
await page.waitForSelector('.shell', { timeout: 30000 }).catch(() => {})
const booted = await page.$('.shell')
check('the app shell renders', !!booted)

/* The first paint must be real content, not an empty mount point. */
const textLen = await page.evaluate(() => (document.querySelector('main')?.innerText || '').trim().length)
check('the first screen has content', textLen > 40, `${textLen} characters in <main>`)

/* ---- 3. No errors on the happy path ------------------------ */
await sleep(1500)
check('no uncaught errors or console errors', consoleErrors.length === 0,
  consoleErrors.slice(0, 3).join(' | '))
check('no failed network requests', failedRequests.length === 0,
  failedRequests.slice(0, 3).join(' | '))

/* ---- 4. The deployed commit, if we were told which ---------
   __BUILD_ID__ is a compile-time inline, not a runtime global, so
   there is nothing on window to read. The build id that actually
   governs behaviour is the service worker cache name: it is what
   evicts the previous deployment. Read it from the published
   sw.js, which is the artifact that has to be right.            */
const buildId = await page.evaluate(async (site) => {
  try {
    const txt = await (await fetch(site + 'sw.js', { cache: 'no-store' })).text()
    return (txt.match(/habit-os-v\d+-([0-9a-f]+)/) || [])[1] || null
  } catch { return null }
}, SITE)

if (EXPECT_BUILD) {
  check('the live build is this commit',
    !!buildId && EXPECT_BUILD.startsWith(buildId),
    `live=${buildId} expected=${EXPECT_BUILD.slice(0, 7)}`)
} else {
  check('the service worker stamps its build', !!buildId, `build ${buildId}`)
}

/* And the same id must be what Settings shows the user, so the
   number someone quotes in a bug report is the deployed one. */
await page.goto(SITE + '#/settings', { waitUntil: 'networkidle2' })
await sleep(1500)
const shown = await page.evaluate(() => {
  const row = [...document.querySelectorAll('.row')]
    .find((r) => /^Build/.test(r.textContent || ''))
  return row ? row.textContent.replace(/^Build/, '').trim() : null
})
check('Settings reports the same build as the service worker',
  !!shown && shown === buildId, `settings=${shown} sw=${buildId}`)

/* ---- 5. The account system survived the deploy -------------
   The regression guard. A build published without credentials
   silently degrades to local-only, which looks completely normal
   unless you go and look for the sign-in form.                 */
await page.goto(SITE + '#/account', { waitUntil: 'networkidle2' })
await sleep(2500)
const acct = await page.evaluate(() => ({
  hasEmail: !!document.querySelector('input[type=email]'),
  hasPassword: !!document.querySelector('input[type=password]'),
  localOnly: /not available in this build/i.test(document.body.innerText),
  badge: document.querySelector('.syncbadge')?.textContent?.trim() || null,
}))

if (EXPECT_ACCOUNTS) {
  check('the deployed build offers sign-in', acct.hasEmail && acct.hasPassword,
    `email=${acct.hasEmail} password=${acct.hasPassword}`)
  check('it does not claim to be local-only', !acct.localOnly)
  check('the sync indicator is present', !!acct.badge, `badge "${acct.badge}"`)
} else {
  check('the deployed build is honestly local-only', acct.localOnly && !acct.hasEmail)
}

/* ---- 6. Nothing privileged was shipped ---------------------
   A publishable key in the bundle is fine and expected. A
   service_role key is a full database bypass.                  */
const sources = await page.evaluate(async () => {
  const urls = [...document.querySelectorAll('script[src]')].map((s) => s.src)
  const out = []
  for (const u of urls) {
    try { out.push(await (await fetch(u)).text()) } catch { /* ignore */ }
  }
  return out.join('\n')
})
check('no service_role key in the served JavaScript', !/service_role/.test(sources))
check('no obvious JWT secret in the served JavaScript',
  !/\bSUPABASE_SERVICE|sb_secret_/.test(sources))

/* ---- 7. The legal pages are reachable ----------------------- */
for (const [route, want] of [['privacy', /privacy/i], ['terms', /terms/i]]) {
  await page.goto(`${SITE}#/${route}`, { waitUntil: 'networkidle2' })
  await sleep(1200)
  const txt = await page.evaluate(() => document.querySelector('main')?.innerText || '')
  check(`/#/${route} renders`, want.test(txt) && txt.length > 200, `${txt.length} characters`)
}

/* ---- 8. Deep links work on a static host --------------------
   GitHub Pages has no server-side rewrite, so hash routing is
   what makes a shared link survive a cold load.                 */
await page.goto(SITE + '#/insights', { waitUntil: 'networkidle2' })
await sleep(1500)
const deep = await page.evaluate(() => (document.querySelector('main')?.innerText || '').slice(0, 80))
check('a deep link cold-loads', deep.length > 20, JSON.stringify(deep.slice(0, 40)))

await browser.close()

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) {
  console.log('\nFailures:')
  for (const f of failed) console.log(`  - ${f.name}${f.detail ? `: ${f.detail}` : ''}`)
  process.exit(1)
}
console.log('Live site verified.')
