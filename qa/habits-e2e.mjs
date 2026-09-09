/* Phase 5 final browser proof — Habits (§39-41, §44). Real production build,
 * persisted fixture, real Chromium, no mocked engines, no deployment from
 * here. One CI job per viewport (390×844, 430×932, 1440×900) saves
 * screenshots, browser version, DOM failures and results.json so the counts
 * are publishable through the Checks API even where runner logs and
 * artifacts are unreachable.
 *   Local / CI preview:
 *     HABITS_QA_VIEWPORT=390x844 node qa/habits-e2e.mjs http://localhost:4173
 *   Public production site (real sign-in with the pre-confirmed TEST_A
 *   account; the fixture is seeded on the signed-in device exactly as
 *   qa/release.mjs does, so nothing is mocked and no engine is bypassed):
 *     REQUIRE_AUTH=1 EXPECT_BUILD_ID=<deployed sha> TEST_A_EMAIL=… TEST_A_PASSWORD=… \
 *     HABITS_QA_VIEWPORT=390x844 node qa/habits-e2e.mjs https://aaru1yg.github.io/habbit-trackerrr/
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { launch, newPage, seedAndGoto, seededStateV4, check, report, results, sleep } from './helpers.mjs'

const base = (process.argv[2] || 'http://localhost:4173').replace(/\/+$/, '')
const output = process.env.HABITS_QA_OUT || 'qa/shots/habits'
const PUBLIC = process.env.REQUIRE_AUTH === '1'
const EXPECT = (process.env.EXPECT_BUILD_ID || '').trim()
const credentials = { email: process.env.TEST_A_EMAIL?.trim(), password: process.env.TEST_A_PASSWORD }
if (PUBLIC && (!credentials.email || !credentials.password)) throw new Error('REQUIRE_AUTH=1 needs the pre-confirmed TEST_A_EMAIL/TEST_A_PASSWORD; no partial pass.')
// Public runs keep the real session and the remembered first-link choice across
// fixture reloads; everything else in storage is reset exactly as in local runs.
const KEEP = PUBLIC ? ['aaru.auth', 'aaru.habits.migration.v1'] : []
const safe = (text) => [credentials.email, credentials.password].filter(Boolean).reduce((out, value) => out.replaceAll(value, '[redacted]'), String(text))
mkdirSync(output, { recursive: true })
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const viewports = [{ width: 390, height: 844, isMobile: true, hasTouch: true }, { width: 430, height: 932, isMobile: true, hasTouch: true }, { width: 1440, height: 900 }]
const selected = viewports.filter(v => !process.env.HABITS_QA_VIEWPORT || process.env.HABITS_QA_VIEWPORT === `${v.width}x${v.height}`)
if (!selected.length) throw new Error('Unknown HABITS_QA_VIEWPORT')
const metadata = { commit, version: null, target: `${base}/`, mode: PUBLIC ? 'public' : 'local', viewports: [], results }

/* Production identity, read from the public origin itself (same contract as
   deploy.yml and qa/release.mjs): wait for Pages to serve the exact commit,
   then require index.html, sw.js and release.json to agree on it. */
async function publicBuild() {
  const expectShort = EXPECT.slice(0, 7)
  const stop = Date.now() + 8 * 60 * 1000
  let live
  for (;;) {
    const response = await fetch(`${base}/release.json?verify=${Date.now()}`, { cache: 'no-store' }).catch(() => null)
    if (response?.ok) live = await response.json()
    if (!EXPECT || live?.buildId === expectShort) break
    if (Date.now() >= stop) throw new Error(`Public site did not reach ${EXPECT}; still serving ${live?.commit || 'nothing'}`)
    console.log(`Waiting for Pages to serve ${expectShort} (currently ${live?.buildId || 'unavailable'})…`)
    await sleep(15000)
  }
  const html = await (await fetch(`${base}/?verify=${Date.now()}`, { cache: 'no-store' })).text()
  const meta = html.match(/<meta name="build-id" content="([^"]+)"/)?.[1] || null
  const sw = await (await fetch(`${base}/sw.js?verify=${Date.now()}`, { cache: 'no-store' })).text()
  check('public index.html carries the deployed build-id meta', !!meta && (!EXPECT || meta === expectShort), `meta=${meta} expected=${expectShort || 'any'}`)
  check('public sw.js is stamped with the same build', !!meta && sw.includes(`aaru-habits-v7-${meta}`))
  check('public release.json names the same commit', !!live && live.buildId === meta && (!EXPECT || live.commit === EXPECT || live.commit.startsWith(EXPECT)), JSON.stringify(live && { commit: live.commit, buildId: live.buildId }))
  if (results.fail) throw new Error('The public site is not serving the expected build; refusing to verify the wrong deployment.')
  console.log(`Public build: ${live?.commit} (${meta}) at ${base}/`)
  return { commit: live?.commit || null, buildId: meta }
}
let build = null

const STORAGE_KEY = 'aaru.habits.v4'
const dayStr = (d) => d.toLocaleDateString('en-CA')
const today = dayStr(new Date())
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return dayStr(d) }
// Same formatting the app uses (src/lib/dates.js prettyDate / weekdayShort).
const pretty = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
const wdShort = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })
const FILTERS = '[role="group"][aria-label="Habit filters"]'

let browser
try {
  // Launch inside the try: a runner that cannot start Chromium (the Phase-6
  // public 390×844 job died right here — exit 1 after exactly puppeteer's
  // 30 s launch timeout) must still produce results.json, so the publish
  // step can name the abort in a check run instead of failing with nothing
  // attributable. The run still fails; it just fails with evidence.
  browser = await launch()
  metadata.version = await browser.version()
  console.log(`Real browser: ${metadata.version}; commit: ${commit}; target: ${base}/ (${PUBLIC ? 'public site, real sign-in' : 'local build'})`)
  if (PUBLIC) {
    build = await publicBuild()
    metadata.public = { url: `${base}/`, ...build }
  }
  for (const viewport of selected) {
    const prefix = `${viewport.width}x${viewport.height}`
    // A fresh browser context per viewport: clean storage, cache and (public)
    // session, so each viewport proves the real sign-in path on its own.
    const context = await browser.createBrowserContext()
    const page = await newPage(context, { ...viewport, deviceScaleFactor: 1 })
    const evidence = { viewport: prefix, scenarios: [], consoleErrors: [], pageErrors: [], failedRequests: [] }
    if (PUBLIC) evidence.publicSite = { signIns: 0, migrationPrompts: 0, cloudPulls: 0, serviceWorker: null }
    metadata.viewports.push(evidence)
    // Every real cloud pull (GET user_state) the page performs — lets a public
    // fixture reload wait for the first pull to settle instead of guessing.
    const pulls = []
    page.on('response', (res) => { if (res.request().method() === 'GET' && /\/rest\/v1\/user_state\b/.test(res.url())) pulls.push(res.status()) })

    const stored = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), STORAGE_KEY)
    const doneOn = async (id, date) => (await stored()).checkins[id]?.[date]?.done === true
    const capture = async name => { await page.screenshot({ path: `${output}/${prefix}-${name}.png`, fullPage: true }) }
    const settle = async () => { await page.evaluate(() => document.fonts.ready); await sleep(650) }
    const waitFor = async (selector, timeout = 15000) => { await page.waitForSelector(selector, { timeout }) }
    const goto = async (route, target = '#habits-screen') => {
      await page.evaluate(to => { location.hash = `#/${to}`; scrollTo(0, 0) }, route)
      await page.waitForFunction(to => location.hash === `#/${to}`, {}, route)
      await waitFor(target)
      await settle()
    }
    // Native pointer input, not element.click(): detects occlusion and real hit targets.
    const click = async selector => {
      await page.waitForSelector(selector, { visible: true })
      await page.$eval(selector, el => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
      await sleep(150)
      await page.click(selector)
      await settle()
    }
    // Visible <tag> inside <scope> whose text (minus a trailing count badge) is exactly <text>.
    const clickText = async (text, scope = 'body', tag = 'button') => {
      const found = await page.evaluate((text, scope, tag) => {
        document.querySelectorAll('[data-qa-click]').forEach(el => el.removeAttribute('data-qa-click'))
        const label = el => { const c = el.querySelector('.count'); return (c ? el.textContent.replace(c.textContent, '') : el.textContent).trim() }
        const el = [...document.querySelectorAll(`${scope} ${tag}`)].find(el => label(el) === text && el.getBoundingClientRect().height > 0)
        if (!el) return false
        el.dataset.qaClick = 'true'
        return true
      }, text, scope, tag)
      if (!found) throw new Error(`Missing ${tag}: ${text} (${scope})`)
      await click('[data-qa-click="true"]')
    }
    const byLabel = (label) => `[aria-label="${label.replace(/"/g, '\\"')}"]`
    const noDialog = async () => { await page.waitForFunction(() => !document.querySelector('[role="dialog"]')); await settle() }
    // Exactly one dialog once the previous sheet's exit transition has finished
    // (a loaded runner can still be animating it out when the next one mounts).
    const oneDialog = () => page.waitForFunction(() => document.querySelectorAll('[role="dialog"]').length === 1, { timeout: 4000 }).then(() => true).catch(() => false)
    // Toasts (z-index 90, from main) layer above sheets (z-index 80, from main) and
    // stay ~4.5 s; wait them out before opening a sheet, as a user naturally would.
    const clearToast = async () => { await page.waitForFunction(() => !document.querySelector('.toast'), { timeout: 8000 }) }
    const openMore = async name => { await clearToast(); await click(byLabel(`More actions for ${name}`)) }

    /* Layout proof for the current screen: overflow, clipped dialogs, images,
       and (mobile) every visible control in the screen or open dialog ≥ 44px. */
    const layout = async (name, { targets = true } = {}) => {
      const proof = await page.evaluate(() => {
        const root = document.documentElement
        const dialogs = [...document.querySelectorAll('[role="dialog"]')].map(el => {
          const r = el.getBoundingClientRect()
          return { title: el.getAttribute('aria-labelledby'), x: r.x, y: r.y, right: r.right, bottom: r.bottom, scroll: el.scrollWidth, client: el.clientWidth }
        })
        return { scroll: root.scrollWidth, client: root.clientWidth, width: innerWidth, height: innerHeight, dialogs,
          brokenImages: [...document.images].filter(img => img.complete && img.naturalWidth === 0).map(img => img.src) }
      })
      check(`${prefix} ${name}: no horizontal overflow`, proof.scroll <= proof.client + 1, JSON.stringify(proof))
      check(`${prefix} ${name}: no clipped dialog`, proof.dialogs.every(d => d.x >= -1 && d.y >= -1 && d.right <= proof.width + 1 && d.bottom <= proof.height + 1 && d.scroll <= d.client + 1), JSON.stringify(proof.dialogs))
      check(`${prefix} ${name}: images load`, proof.brokenImages.length === 0, proof.brokenImages.join(', '))
      if (viewport.isMobile && targets) {
        const small = await page.evaluate(() => {
          const scope = document.querySelector('[role="dialog"]') || document.querySelector('#habits-screen, #habit-detail-screen')
          if (!scope) return []
          return [...scope.querySelectorAll('button,a,input,select,textarea,summary')].flatMap(el => {
            if (el.closest('details:not([open])') && el.tagName !== 'SUMMARY') return []
            const r = el.getBoundingClientRect(), cs = getComputedStyle(el)
            if (!r.width || !r.height || cs.visibility === 'hidden' || el.classList.contains('sr-only')) return []
            const label = el.closest('label')
            const lr = label?.getBoundingClientRect()
            if (lr && lr.width >= 43 && lr.height >= 43) return []
            return r.width >= 43 && r.height >= 43 ? [] : [{ tag: el.tagName, name: el.getAttribute('aria-label') || el.textContent.trim().slice(0, 70), width: r.width, height: r.height }]
          })
        })
        check(`${prefix} ${name}: touch targets at least 44px (1px rounding tolerance)`, small.length === 0, JSON.stringify(small))
      }
      await capture(name)
    }
    const exists = async (selector) => page.$(selector).then(Boolean).catch(() => false)
    /* Public site only. The production service worker claims the first page
       of a fresh profile and reloads it once (src/main.jsx controllerchange).
       Warm the profile up with a plain visit first, so that one-off reload has
       already happened before any credentials are typed; every later document
       is controlled from birth and never reloads itself. */
    const warmUp = async () => {
      // The claim-time reload can interrupt this very navigation; that is the
      // event being waited out, not a failure.
      await page.goto(`${base}/`, { waitUntil: 'networkidle0' }).catch(() => {})
      const stop = Date.now() + 15000
      while (Date.now() < stop) {
        await page.waitForNetworkIdle({ idleTime: 1500, timeout: 10000 }).catch(() => {})
        const controlled = await page.evaluate(() => !('serviceWorker' in navigator) || !!navigator.serviceWorker.controller).catch(() => false)
        if (controlled) break
        await sleep(250)
      }
      await sleep(1500)
      evidence.publicSite.serviceWorker = await page.evaluate(() => 'serviceWorker' in navigator ? navigator.serviceWorker.controller?.scriptURL || null : 'unsupported').catch(() => null)
    }
    const swSettled = async () => {
      await page.waitForNetworkIdle({ idleTime: 1000, timeout: 10000 }).catch(() => {})
      await page.waitForFunction(() => !('serviceWorker' in navigator) || !!navigator.serviceWorker.controller, { timeout: 10000 }).catch(() => {})
    }
    /* Public site only: the real auth screen, typed credentials, the real
       sign-in request. Never a token injection, never a mocked session. */
    const signIn = async () => {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await swSettled()
          if (!(await exists('#auth-email'))) return // session restored by the app itself
          await page.waitForSelector('#auth-email', { visible: true, timeout: 20000 })
          await page.type('#auth-email', credentials.email)
          await page.type('#auth-password', credentials.password)
          await click('.auth-submit')
          await page.waitForFunction(() => !document.querySelector('#auth-email') && !document.querySelector('.auth-loading'), { timeout: 30000 })
          evidence.publicSite.signIns++
          return
        } catch (error) {
          if (attempt === 2) throw error
          console.log(`  · sign-in attempt ${attempt} interrupted (${safe(error.message).split('\n')[0]}); retrying once`)
        }
      }
    }
    /* Public site only: let the first cloud pull of this document settle before
       a scenario starts, so the migration prompt can never surface mid-journey.
       When it does appear (a pre-existing account meeting freshly seeded device
       data) resolve it the way a QA device does — keep the fixture just seeded —
       through the real dialog; the app remembers the choice for later reloads. */
    const settleCloud = async (seen) => {
      await page.waitForFunction(() => document.querySelector('#auth-email') || (!document.querySelector('.auth-loading') && document.querySelector('main#content')), { timeout: 30000 })
      await signIn()
      const deadline = Date.now() + 20000
      while (pulls.length === seen && Date.now() < deadline) await sleep(100)
      evidence.publicSite.cloudPulls = pulls.length
      await sleep(700)
      if (await exists('#migrate-title')) {
        const keep = await page.$('::-p-text(Keep my local data)')
        if (!keep) throw new Error('Migration prompt without a "Keep my local data" choice')
        await keep.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
        await keep.click()
        await page.waitForFunction(() => !document.querySelector('#migrate-title'), { timeout: 30000 })
        evidence.publicSite.migrationPrompts++
        await settle()
      }
    }
    const seed = async (state = seededStateV4(), route = 'habits', target = '#habits-screen') => {
      // A hash-only goto is same-document navigation: the init script never
      // runs. Leave the origin first so seedAndGoto creates a fresh document.
      // Public: let a pending debounced cloud push finish before leaving, so an
      // in-flight request is never torn down by the navigation itself.
      if (PUBLIC) await page.waitForNetworkIdle({ idleTime: 1500, timeout: 20000 }).catch(() => {})
      const seen = pulls.length
      await page.goto('about:blank')
      await seedAndGoto(page, state, route, base, { keep: KEEP })
      if (PUBLIC) await settleCloud(seen)
      await waitFor(target)
      await settle()
    }
    const scenario = async (name, run) => {
      const before = results.fail
      try { await run() } catch (error) {
        check(`${prefix} ${name}: completes`, false, safe(error.stack))
        await capture(`${name}-FAILED`).catch(() => {})
        writeFileSync(`${output}/${prefix}-${name}-FAILED.html`, await page.content())
        await page.keyboard.press('Escape').catch(() => {})
      }
      evidence.scenarios.push({ name, passed: results.fail === before })
    }

    /* ---------------- §3-5, §32-33: workspace structure + rows ---------------- */
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
    if (PUBLIC) await warmUp()
    await scenario('habits-workspace', async () => {
      await seed()
      if (PUBLIC) {
        const runtime = await page.evaluate(() => window.__BUILD_ID__)
        check(`${prefix}: signed in through the real auth screen; the browser runtime is the deployed build`, evidence.publicSite.signIns >= 1 && runtime === build.buildId, JSON.stringify({ ...evidence.publicSite, runtime }))
        check(`${prefix}: the signed-in device completed a real cloud pull before the journey started`, evidence.publicSite.cloudPulls >= 1, JSON.stringify(evidence.publicSite))
      }
      check(`${prefix}: Habits title`, await page.$eval('main .screen-title', el => el.textContent.trim() === 'Habits'))
      check(`${prefix}: Habits is the active primary pillar`, !!(await page.$('nav[aria-label="Main"] a[aria-current="page"][href="#/habits"]')))
      const tabs = await page.$$eval('.habit-tabs a', els => els.map(a => [a.textContent.trim(), a.getAttribute('href'), a.getAttribute('aria-current')]))
      check(`${prefix}: Active · Routines · Calendar · Week tabs are links`, JSON.stringify(tabs.map(t => t[0])) === JSON.stringify(['Active', 'Routines', 'Calendar', 'Week']) && tabs.every(t => t[1].startsWith('#/habits')), JSON.stringify(tabs))
      check(`${prefix}: Active tab selected by default`, tabs[0][2] === 'page')
      const order = await page.$eval('#habits-screen', el => [...el.children].map(c => c.className.split(' ')[0]).slice(0, 3))
      check(`${prefix}: header → tabs → list order`, JSON.stringify(order) === JSON.stringify(['screen-head', 'habit-tabs', 'habits-body']), JSON.stringify(order))
      check(`${prefix}: summary line counts active habits`, await page.$eval('.screen-sub', el => /^5 active habits · \d of \d done today/.test(el.textContent)), await page.$eval('.screen-sub', el => el.textContent))
      const rows = await page.$$eval('.hrow', els => els.map(r => ({ status: r.dataset.status, name: r.querySelector('.hrow-name')?.getAttribute('aria-label'), complete: r.querySelector('.hrow-complete')?.getAttribute('aria-label'), pressed: r.querySelector('.hrow-complete')?.getAttribute('aria-pressed'), more: r.querySelector('.hrow-more')?.getAttribute('aria-label') })))
      check(`${prefix}: five habit rows, name → status → actions`, rows.length === 5 && rows.every(r => /^Open /.test(r.name || '') && r.status), JSON.stringify(rows))
      const scheduled = rows.filter(r => r.status === 'today' || r.status === 'completed')
      check(`${prefix}: every scheduled row has a labelled Complete toggle with pressed state`, scheduled.length >= 3 && scheduled.every(r => /^Mark .+ (complete|not done)$/.test(r.complete || '') && (r.pressed === 'true' || r.pressed === 'false')), JSON.stringify(rows))
      check(`${prefix}: each row has labelled More actions`, rows.every(r => /^More actions for /.test(r.more || '')), JSON.stringify(rows))
      check(`${prefix}: first row's Complete is above the fold`, await page.$eval('.hrow .hrow-complete', (el, h) => el.getBoundingClientRect().bottom <= h, viewport.height))
      check(`${prefix}: no hero or analytics wall above the list`, !(await page.$('#habits-screen canvas, #habits-screen .heatmap, #habits-screen .today-hero')))
      check(`${prefix}: no separate "Missed recently" card`, !(await page.$eval('#habits-screen', el => [...el.querySelectorAll('h2,h3')].some(h => /missed recently/i.test(h.textContent)))))
      const filters = await page.$$eval(`${FILTERS} button`, els => els.map(b => b.textContent.replace(b.querySelector('.count')?.textContent || '', '').trim()))
      check(`${prefix}: compact filter group All · Today · Needs attention · Active · Paused`, JSON.stringify(filters) === JSON.stringify(['All', 'Today', 'Needs attention', 'Active', 'Paused']), JSON.stringify(filters))
      await layout('habits')
    })

    /* ---------------- §5, §28, §37: completion + undo + keyboard ---------------- */
    await scenario('completion', async () => {
      await seed()
      const before = await doneOn('h-run', today)
      await click(byLabel(before ? 'Mark Morning run not done' : 'Mark Morning run complete'))
      const after = await doneOn('h-run', today)
      check(`${prefix}: Complete toggles today's check-in`, after !== before)
      const row = await page.$eval(byLabel(after ? 'Mark Morning run not done' : 'Mark Morning run complete'), el => ({ pressed: el.getAttribute('aria-pressed'), status: el.closest('.hrow').dataset.status, text: el.textContent.trim() }))
      check(`${prefix}: aria-pressed, row state and label reflect completion`, row.pressed === String(after) && row.status === (after ? 'completed' : 'today') && row.text === (after ? 'Completed' : 'Complete'), JSON.stringify(row))
      await layout('completed')
      await click(byLabel(after ? 'Mark Morning run not done' : 'Mark Morning run complete'))
      check(`${prefix}: second press undoes`, (await doneOn('h-run', today)) === before)
      await page.focus(byLabel(before ? 'Mark Morning run not done' : 'Mark Morning run complete'))
      await page.keyboard.press('Space'); await settle()
      check(`${prefix}: Space completes from the keyboard`, (await doneOn('h-run', today)) !== before)
      check(`${prefix}: keyboard focus stays on the toggle with a visible ring`, await page.evaluate(() => { const el = document.activeElement; const cs = getComputedStyle(el); return el.classList.contains('hrow-complete') && cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 }))
    })

    /* ---------------- §20-22: missed logging + filters ---------------- */
    await scenario('missed-and-filters', async () => {
      const state = seededStateV4()
      delete state.checkins['h-run'][daysAgo(1)]
      await seed(state)
      const missedLabel = `Log Morning run for ${wdShort(daysAgo(1))}`
      check(`${prefix}: yesterday's miss is offered inline on the row`, !!(await page.$(byLabel(missedLabel))) && await page.$eval('.hrow[data-habit="h-run"]', el => /Missed/.test(el.textContent)), missedLabel)
      await click(byLabel(missedLabel))
      check(`${prefix}: "Log it" writes the missed check-in`, await doneOn('h-run', daysAgo(1)))
      check(`${prefix}: inline miss disappears once logged`, !(await page.$(byLabel(missedLabel))))
      const count = async () => page.$$eval('.hrow', els => els.length)
      await clickText('Today', FILTERS)
      const todayRows = await count()
      check(`${prefix}: Today filter shows only habits scheduled today`, todayRows >= 3 && todayRows <= 5 && await page.$$eval('.hrow', els => els.every(r => ['today', 'completed'].includes(r.dataset.status))), `rows=${todayRows}`)
      await clickText('Paused', FILTERS)
      check(`${prefix}: Paused filter is empty for this fixture, with a quiet note`, (await count()) === 0 && !!(await page.$('.habits-filter-empty')))
      await clickText('All', FILTERS)
      check(`${prefix}: All restores every row`, (await count()) === 5)
      await layout('filters')
    })

    /* ---------------- §6-7, §35-36: edit · pause · archive · delete ---------------- */
    await scenario('manage-actions', async () => {
      await seed()
      await openMore('Read 20 pages')
      await waitFor('[role="dialog"]')
      check(`${prefix}: action sheet is a modal dialog labelled by the habit`, await page.$eval('[role="dialog"]', el => el.getAttribute('aria-modal') === 'true' && document.getElementById(el.getAttribute('aria-labelledby'))?.textContent.trim() === 'Read 20 pages'))
      check(`${prefix}: focus moves into the sheet`, await page.evaluate(() => !!document.activeElement.closest('[role="dialog"]')))
      const verbs = await page.$$eval('[role="dialog"] .item-action', els => els.map(b => b.textContent.trim()))
      check(`${prefix}: View · Edit · Skip today · Pause · Archive · Delete`, JSON.stringify(verbs) === JSON.stringify(['View', 'Edit', 'Skip today', 'Pause for a week', 'Archive', 'Delete']), JSON.stringify(verbs))
      await layout('action-sheet')
      await clickText('Edit', '[role="dialog"]')
      await waitFor('#habit-name')
      check(`${prefix}: Edit opens the one shared HabitForm`, await page.$eval('#habit-form-title', el => el.textContent.trim() === 'Edit habit') && await oneDialog())
      await page.$eval('#habit-name', el => { el.focus(); el.select() })
      await page.keyboard.type('Read 25 pages')
      await layout('edit-form')
      await clickText('Save changes', '[role="dialog"]')
      await noDialog()
      check(`${prefix}: rename persists`, (await stored()).habits.some(h => h.id === 'h-read' && h.name === 'Read 25 pages'))
      check(`${prefix}: renamed row shows`, !!(await page.$(byLabel('More actions for Read 25 pages'))))

      await openMore('Read 25 pages')
      await clickText('Pause for a week', '[role="dialog"]')
      await noDialog()
      const paused = (await stored()).habits.find(h => h.id === 'h-read').pause
      check(`${prefix}: Pause writes a one-week pause window`, !!paused && paused.from === today && paused.until > today, JSON.stringify(paused))
      check(`${prefix}: paused row is quieter, states Paused and offers Resume`, await page.evaluate(() => { const r = document.querySelector('.hrow[data-habit="h-read"]'); return r?.dataset.status === 'paused' && r.classList.contains('is-paused') && /Paused/.test(r.textContent) && !!r.querySelector('[aria-label="Resume Read 25 pages"]') && !r.querySelector('.hrow-complete') }))
      await layout('paused')
      await click(byLabel('Resume Read 25 pages'))
      check(`${prefix}: Resume clears the pause`, !(await stored()).habits.find(h => h.id === 'h-read').pause && await page.$eval('.hrow[data-habit="h-read"]', el => el.dataset.status !== 'paused'))

      await openMore('Read 25 pages')
      await clickText('Archive', '[role="dialog"]')
      await noDialog()
      check(`${prefix}: Archive flags the habit`, (await stored()).habits.find(h => h.id === 'h-read').archived === true)
      check(`${prefix}: archived habit leaves the active list`, !(await page.$('.hrow[data-habit="h-read"]')))
      await clickText('Archived', FILTERS)
      check(`${prefix}: Archived filter lists it with Restore`, !!(await page.$(byLabel('Restore Read 25 pages'))))
      await layout('archived')
      await click(byLabel('Restore Read 25 pages'))
      check(`${prefix}: Restore un-archives`, (await stored()).habits.find(h => h.id === 'h-read').archived === false)

      await clickText('All', FILTERS)
      await openMore('Practice guitar')
      await clickText('Delete', '[role="dialog"]')
      check(`${prefix}: Delete asks for confirmation first`, (await stored()).habits.some(h => h.id === 'h-guitar') && await page.$eval('[role="dialog"]', el => !!el.querySelector('#habit-delete-confirm[role="alert"]') && [...el.querySelectorAll('button')].some(b => b.textContent.trim() === 'Confirm delete')))
      await layout('delete-confirm')
      await clickText('Confirm delete', '[role="dialog"]')
      await noDialog()
      check(`${prefix}: confirmed delete removes the habit`, !(await stored()).habits.some(h => h.id === 'h-guitar'))
      const undo = await page.$('.toast-region .toast-action')
      check(`${prefix}: Undo is offered`, !!undo)
      if (undo) { await undo.click(); await settle(); check(`${prefix}: Undo restores the habit and its check-ins`, (await stored()).habits.some(h => h.id === 'h-guitar') && Object.keys((await stored()).checkins['h-guitar'] || {}).length > 0) }
    })

    /* ---------------- §8-9, §25: routines ---------------- */
    await scenario('routines', async () => {
      await seed(seededStateV4(), 'habits?view=routines')
      await waitFor('.routine')
      check(`${prefix}: Routines tab selected`, await page.$eval('.habit-tabs a[aria-current="page"]', el => el.textContent.trim() === 'Routines'))
      const cards = await page.$$eval('.routine', els => els.map(c => ({ name: c.querySelector('.routine-name')?.textContent.trim(), label: c.getAttribute('aria-label'), steps: [...c.querySelectorAll('.routine-habit-name')].map(s => s.textContent.trim()), score: c.querySelector('.routine-score')?.textContent.replace(/\s+/g, ' ').trim() })))
      check(`${prefix}: two routine cards list their habits in order`, cards.length === 2 && cards[0].name === 'Morning reset' && JSON.stringify(cards[0].steps) === JSON.stringify(['Meditate', 'Drink water', 'Morning run']) && JSON.stringify(cards[1].steps) === JSON.stringify(['Read 20 pages']), JSON.stringify(cards))
      check(`${prefix}: routine steps carry no stray timeline markers`, await page.evaluate(() => [...document.querySelectorAll('.routine-habit')].every(li => getComputedStyle(li, '::before').content === 'none')))
      const tick = '.routine[data-routine="r1"] .routine-tick:not(:disabled)'
      const tickLabel = await page.$eval(tick, el => el.getAttribute('aria-label'))
      check(`${prefix}: routine steps are labelled toggles`, /^Mark .+ done in Morning reset$/.test(tickLabel), tickLabel)
      await click(tick)
      const stepHabit = tickLabel.replace(/^Mark (.+) done in Morning reset$/, '$1')
      const id = { Meditate: 'h-med', 'Drink water': 'h-water', 'Morning run': 'h-run' }[stepHabit]
      check(`${prefix}: ticking a routine step writes the ordinary check-in`, await doneOn(id, today))
      check(`${prefix}: routine shows 1 of N done today`, await page.$eval('.routine[data-routine="r1"]', el => el.querySelectorAll('.routine-habit[data-done="true"]').length === 1 && /1\/\d today/.test(el.querySelector('.routine-score')?.textContent || '')))
      await goto('habits')
      check(`${prefix}: the same completion shows on the Active list`, await page.$eval(`.hrow[data-habit="${id}"] .hrow-complete`, el => el.getAttribute('aria-pressed') === 'true'))
      await goto('habits?view=routines'); await waitFor('.routine')
      await click(byLabel('Move Morning reset down'))
      check(`${prefix}: reorder moves the routine`, await page.$$eval('.routine .routine-name', els => els[0].textContent.trim() === 'Wind down'))
      await click(byLabel('Move Morning reset up'))
      check(`${prefix}: reorder persists to storage`, (await stored()).routines.map(r => r.id).join() === 'r1,r2' && await page.$$eval('.routine .routine-name', els => els[0].textContent.trim() === 'Morning reset'))
      await layout('routines')
      await clickText('New routine', '#habits-screen')
      await waitFor('#routine-name')
      check(`${prefix}: New routine opens the RoutineForm with existing habits to pick`, await page.$eval('[role="dialog"]', el => /Habits in this routine/.test(el.textContent) && [...el.querySelectorAll('button')].filter(b => b.getAttribute('aria-pressed') !== null && /Morning run|Meditate|Drink water|Read 20 pages|Practice guitar/.test(b.textContent)).length === 5))
      await layout('routine-form')
      await page.keyboard.press('Escape')
      await noDialog()
    })

    /* ---------------- §10-14: calendar (canonical, legacy, deep link) ---------------- */
    await scenario('calendar', async () => {
      await seed(seededStateV4(), 'habits?view=calendar')
      await waitFor('.cal-grid')
      check(`${prefix}: Calendar tab selected`, await page.$eval('.habit-tabs a[aria-current="page"]', el => el.textContent.trim() === 'Calendar'))
      check(`${prefix}: controls first — Month · 90 days · Year + Previous/Next`, (await page.$$eval('#calendar-screen .vseg-btn', els => els.map(b => b.textContent.trim()))).join() === 'Month,90 days,Year' && !!(await page.$(byLabel('Previous range'))) && !!(await page.$(byLabel('Next range'))) && await page.evaluate(() => document.querySelector('.cal-controls').getBoundingClientRect().bottom <= document.querySelector('.cal-grid').getBoundingClientRect().top))
      const y = daysAgo(1)
      const cellFor = () => page.$(`${byLabel(`Mark done: Morning run, ${pretty(y)}`)}, ${byLabel(`Mark not done: Morning run, ${pretty(y)}`)}`)
      let cell = await cellFor()
      if (!cell) { await click(byLabel('Previous range')); cell = await cellFor() } // 1st of the month: yesterday sits in the previous range
      check(`${prefix}: calendar cells are labelled buttons with pressed state`, !!cell && await cell.evaluate(el => el.tagName === 'BUTTON' && ['true', 'false'].includes(el.getAttribute('aria-pressed')) && el.dataset.state))
      const wasDone = await doneOn('h-run', y)
      await cell.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center' })); await sleep(150)
      await cell.click(); await settle()
      check(`${prefix}: tapping a past cell logs / un-logs that day`, (await doneOn('h-run', y)) !== wasDone)
      check(`${prefix}: the cell's label and state follow`, await cell.evaluate((el, wasDone) => el.getAttribute('aria-pressed') === String(!wasDone) && el.getAttribute('aria-label').startsWith(wasDone ? 'Mark done' : 'Mark not done'), wasDone))
      check(`${prefix}: future cells are disabled`, await page.$$eval('.cal-cell[data-state="upcoming"]', els => els.every(el => el.disabled)))
      check(`${prefix}: no work deadlines in the habit calendar`, !(await page.$('#calendar-screen .cal-marks')) && !(await page.$eval('#calendar-screen', el => /Deadline/.test(el.textContent))))
      check(`${prefix}: habit labels stay put while the date region scrolls`, await page.evaluate(() => { const w = document.querySelector('.cal-wrap'); const n = document.querySelector('.cal-name'); if (!w || !n) return false; const x0 = n.getBoundingClientRect().x; w.scrollLeft = 120; const x1 = n.getBoundingClientRect().x; const moved = w.scrollLeft; w.scrollLeft = 0; return Math.abs(x0 - x1) < 1 && (moved > 0 || w.scrollWidth <= w.clientWidth) }))
      check(`${prefix}: calendar cells are ≥ 44px`, await page.$$eval('.cal-cell', els => els.length > 0 && els.every(c => { const r = c.getBoundingClientRect(); return r.width >= 43 && r.height >= 43 })))
      await cell.focus(); await page.keyboard.press('n'); await settle()
      check(`${prefix}: N on a focused cell opens the note sheet`, !!(await page.$('#note-title')) && await page.evaluate(() => document.activeElement?.tagName === 'TEXTAREA'))
      await layout('calendar-note')
      await page.keyboard.press('Escape'); await noDialog()
      check(`${prefix}: Escape closes the note and returns focus to the cell`, await page.evaluate(() => document.activeElement?.classList.contains('cal-cell')))
      await clickText('90 days', '#calendar-screen .cal-range')
      check(`${prefix}: 90-day view renders the matrix`, await page.$eval('.cal-grid', el => el.querySelectorAll('.cal-cell').length > 5 * 60))
      await clickText('Year', '#calendar-screen .cal-range')
      check(`${prefix}: Year view renders`, await page.$eval('#calendar-screen', el => new RegExp(String(new Date().getFullYear())).test(el.querySelector('.cal-title').textContent)))
      await clickText('Month', '#calendar-screen .cal-range')
      await layout('calendar')
      await goto('calendar'); await waitFor('.cal-grid')
      check(`${prefix}: legacy #/calendar renders the same matrix inside Habits`, await page.$eval('main .screen-title', el => el.textContent.trim() === 'Calendar') && await page.$eval('#habits-screen', el => el.dataset.view === 'calendar'))
      await goto('calendar/2026-03'); await waitFor('.cal-grid')
      check(`${prefix}: #/calendar/YYYY-MM deep link opens that month`, await page.$eval('.cal-title', el => el.textContent.trim() === 'March 2026'))
      await goto('library')
      check(`${prefix}: legacy #/library lands on Active`, await page.$eval('#habits-screen', el => el.dataset.view === 'active') && !!(await page.$('.hrow')))
    })

    /* ---------------- §15: week review ---------------- */
    await scenario('week', async () => {
      await seed(seededStateV4(), 'habits?view=week')
      await page.waitForFunction(() => /By habit/.test(document.body.textContent))
      check(`${prefix}: Week tab selected`, await page.$eval('.habit-tabs a[aria-current="page"]', el => el.textContent.trim() === 'Week'))
      const text = await page.$eval('#week-screen', el => el.textContent)
      check(`${prefix}: completion count + delta vs previous week`, /\d+ of \d+ check-ins/.test(text) && /previous week/i.test(text))
      check(`${prefix}: strongest habit and needs attention`, /Strongest habit/.test(text) && /Needs attention/.test(text))
      check(`${prefix}: concise summary + per-habit list`, /In short/.test(text) && (await page.$$('ul[aria-label="Habits this week"] a.week-habit')).length >= 3)
      check(`${prefix}: no work deadlines in the week review`, !/Deadline|Due this week/.test(text))
      const missed = await page.$('ul[aria-label="Missed days you can still log"] button')
      if (missed) {
        const label = await missed.evaluate(el => el.getAttribute('aria-label'))
        const total = async () => Object.values((await stored()).checkins).reduce((n, h) => n + Object.values(h).filter(c => c.done).length, 0)
        const before = await total()
        await missed.evaluate(el => el.scrollIntoView({ block: 'center' })); await sleep(150); await missed.click(); await settle()
        check(`${prefix}: week review logs a missed day in one tap`, (await total()) === before + 1 && /^Log .+ for /.test(label), label)
      }
      await layout('week')
      await click(byLabel('Previous week'))
      check(`${prefix}: previous week navigates`, await page.$eval('#week-screen', el => /Last week/.test(el.textContent)))
      await goto('week')
      check(`${prefix}: legacy #/week renders the review`, await page.$eval('main .screen-title', el => el.textContent.trim() === 'Week review') && await page.$eval('#habits-screen', el => el.dataset.view === 'week'))
    })

    /* ---------------- §16-19: habit detail + patterns ---------------- */
    await scenario('habit-detail', async () => {
      await seed(seededStateV4(), 'habits/h-run', '#habit-detail-screen')
      const h2 = await page.$$eval('#habit-detail-screen h2', els => els.map(h => h.textContent.trim()))
      check(`${prefix}: hierarchy Today → Consistency → History → Patterns → Schedule → Manage`, JSON.stringify(h2) === JSON.stringify(['Today', 'Consistency', 'History', 'Patterns', 'Schedule', 'Manage']), JSON.stringify(h2))
      check(`${prefix}: header names the habit; streak + today status up top`, await page.$eval('#habit-detail-screen', el => el.querySelector('h1').textContent.includes('Morning run') && !!el.querySelector('.habit-now-streak') && !!el.querySelector('.habit-now [aria-label^="Mark Morning run"]')))
      check(`${prefix}: heatmap is an accessible image`, !!(await page.$('#habit-detail-screen [role="img"][aria-label="Morning run consistency heatmap"]')))
      const patterns = await page.$eval('#habit-detail-screen .habit-patterns', el => ({ cards: [...el.querySelectorAll('.pattern')].map(p => ({ o: p.querySelector('.pattern-observation')?.textContent.trim(), dts: [...p.querySelectorAll('dt')].map(d => d.textContent.trim()) })), notEnough: /Not enough data yet\./.test(el.textContent) }))
      check(`${prefix}: patterns are Observation → Evidence → Implication, or a single "Not enough data yet."`, patterns.cards.length ? patterns.cards.every(c => c.o && JSON.stringify(c.dts) === JSON.stringify(['Evidence', 'Implication'])) : patterns.notEnough, JSON.stringify(patterns))
      check(`${prefix}: history breakdown is behind progressive disclosure`, (await page.$$('#habit-detail-screen details.habit-more')).length >= 1)
      check(`${prefix}: Edit · Pause · Archive · Delete in Manage`, await page.$$eval('#habit-detail-screen .habit-manage button', els => { const t = els.map(b => b.textContent.trim()); return t.includes('Edit') && t.includes('Pause for a week') && t.includes('Archive') && t.includes('Delete') }))
      await layout('detail')
      await clickText('Delete', '#habit-detail-screen .habit-manage')
      check(`${prefix}: detail delete is confirmed, not immediate`, (await stored()).habits.some(h => h.id === 'h-run') && await page.$eval('#habit-detail-screen .habit-manage', el => [...el.querySelectorAll('button')].some(b => b.textContent.trim() === 'Delete for good') && [...el.querySelectorAll('button')].some(b => b.textContent.trim() === 'Keep')))
      await clickText('Keep', '#habit-detail-screen .habit-manage')
      await click(byLabel('Mark Morning run complete'))
      check(`${prefix}: detail Complete uses the same check-in`, await doneOn('h-run', today))
      await seed({ ...seededStateV4(), habits: seededStateV4().habits.map(h => h.id === 'h-guitar' ? { ...h, createdAt: daysAgo(3) } : h), checkins: { ...seededStateV4().checkins, 'h-guitar': {} } }, 'habits/h-guitar', '#habit-detail-screen')
      check(`${prefix}: a young habit says "Not enough data yet." once, no empty charts`, await page.$eval('#habit-detail-screen', el => (el.textContent.match(/Not enough data yet\./g) || []).length >= 1 && !el.querySelector('.habit-patterns .pattern') && !el.querySelector('.habit-patterns canvas')))
      await goto('habits/nope', '#habit-detail-screen')
      check(`${prefix}: unknown habit shows "Habit not found" with a way back`, await page.$eval('#habit-detail-screen', el => /Habit not found/.test(el.textContent) && !!el.querySelector('a[href="#/habits"]')))
    })

    /* ---------------- §34: empty state ---------------- */
    await scenario('empty-state', async () => {
      await seed({ ...seededStateV4(), habits: [], checkins: {}, routines: [] })
      check(`${prefix}: "You don't have any habits yet." + Create habit, no charts`, await page.$eval('#habits-screen', el => /You don't have any habits yet\./.test(el.textContent) && [...el.querySelectorAll('button')].some(b => b.textContent.trim() === 'Create habit') && !el.querySelector('canvas, .heatmap, .hrow')))
      await layout('empty')
      await clickText('Create habit', '#habits-screen')
      await waitFor('#habit-name')
      check(`${prefix}: Create habit opens the shared HabitForm`, await page.$eval('#habit-form-title', el => el.textContent.trim() === 'New habit') && !!(await page.$('[role="group"][aria-label="Schedule type"]')))
      await layout('new-habit-form')
      await page.keyboard.press('Escape')
      await noDialog()
      check(`${prefix}: Escape returns focus to the opener`, await page.evaluate(() => document.activeElement?.textContent.trim() === 'Create habit'))
      await goto('habits?view=routines')
      check(`${prefix}: Routines empty state does not offer a routine without habits`, await page.$eval('#habits-screen', el => /No routines yet/.test(el.textContent) && [...el.querySelectorAll('button')].filter(b => /Build a routine|New routine/.test(b.textContent)).every(b => b.disabled)))
      await goto('habits')
      await click(byLabel('New habit'))
      await waitFor('#habit-name')
      check(`${prefix}: header New habit opens the same form`, await page.$eval('#habit-form-title', el => el.textContent.trim() === 'New habit'))
      await page.keyboard.press('Escape'); await noDialog()
    })

    /* ---------------- §23, §26: Omni ---------------- */
    await scenario('omni-creation', async () => {
      await seed()
      const before = (await stored()).habits.length
      await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control')
      await waitFor('#command-input'); await settle()
      await page.type('#command-input', 'Run every morning'); await settle()
      check(`${prefix}: "Run every morning" is detected as a habit`, await page.$eval('[role="dialog"]', el => /Detected:\s*Habit/.test(el.textContent)))
      await page.keyboard.press('Enter'); await settle()
      check(`${prefix}: Enter never creates silently`, (await stored()).habits.length === before)
      await clickText('Review', '[role="dialog"]')
      check(`${prefix}: confirm step previews Type: Habit + title`, await page.$eval('[role="dialog"] .capture-preview', el => /Habit/.test(el.textContent) && /Run every morning/.test(el.textContent)))
      await layout('omni-confirm', { targets: false })
      await clickText('Create', '[role="dialog"]')
      await page.waitForFunction((n, k) => JSON.parse(localStorage.getItem(k)).habits.length === n + 1, {}, before, STORAGE_KEY)
      check(`${prefix}: Create adds exactly one daily habit`, await stored().then(s => s.habits.at(-1).name === 'Run every morning' && (s.habits.at(-1).schedule?.type || 'daily') === 'daily'))
      await page.keyboard.press('Escape'); await noDialog()
      check(`${prefix}: the new habit appears in the Active list`, !!(await page.$(byLabel('More actions for Run every morning'))))
      await page.keyboard.down('Control'); await page.keyboard.press('k'); await page.keyboard.up('Control')
      await waitFor('#command-input'); await settle()
      await page.type('#command-input', 'add habit'); await settle()
      check(`${prefix}: Omni lists the Add habit command`, await page.$eval('[role="listbox"][aria-label="Commands"]', el => /Add habit/.test(el.textContent)))
      await page.keyboard.press('Enter')
      await waitFor('#habit-name'); await settle()
      check(`${prefix}: Omni "Add habit" opens the shared HabitForm, not a second capture form`, await page.$eval('#habit-form-title', el => el.textContent.trim() === 'New habit') && await oneDialog())
      await page.keyboard.press('Escape'); await noDialog()
    })

    /* ---------------- §28, §37: reduced motion ---------------- */
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    await scenario('reduced-motion', async () => {
      await seed()
      const animated = await page.$$eval('#habits-screen *', els => els.filter(el => {
        const s = getComputedStyle(el)
        return (s.animationName !== 'none' && parseFloat(s.animationDuration) > .05) || parseFloat(s.transitionDuration) > .05
      }).map(el => el.className.toString().split(' ')[0]))
      check(`${prefix}: reduced motion disables Habits animation and transitions`, !animated.length, JSON.stringify([...new Set(animated)]))
      await click('.hrow[data-habit="h-run"] .hrow-complete')
      check(`${prefix}: completion still works under reduced motion`, await doneOn('h-run', today) && await page.$eval('.hrow[data-habit="h-run"] .hrow-complete', el => el.getAttribute('aria-pressed') === 'true'))
      await layout('reduced-motion')
    })

    if (PUBLIC) await page.waitForNetworkIdle({ idleTime: 1500, timeout: 20000 }).catch(() => {})
    Object.assign(evidence, page._qa)
    check(`${prefix}: zero console errors`, evidence.consoleErrors.length === 0, safe(evidence.consoleErrors.join('\n')))
    check(`${prefix}: zero uncaught exceptions`, evidence.pageErrors.length === 0, safe(evidence.pageErrors.join('\n')))
    check(`${prefix}: zero failed asset/network requests`, evidence.failedRequests.length === 0, safe(evidence.failedRequests.join('\n')))
    await context.close()
  }
  report(PUBLIC ? 'Phase 5 Habits — PUBLIC production site, real Chromium' : 'Phase 5 Habits — CI Chromium proof')
} catch (error) {
  // An abort outside a scenario (site unreachable, browser launch failure,
  // sign-in failure, wrong build) must never publish as "0 failed": record it
  // as a failure first. Every one of those points is now inside this try, so
  // the finally below always writes results.json and the Checks-API publish
  // step always has something attributable to post.
  results.fail++
  results.failures.push(`aborted: ${safe(error.stack || error.message)}`)
  metadata.error = safe(error.message)
  if (!metadata.version) metadata.version = `browser never launched — ${safe(error.message)}`
  throw error
} finally {
  writeFileSync(`${output}/results.json`, JSON.stringify(metadata, null, 2))
  await browser?.close()
}
