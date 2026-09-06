#!/usr/bin/env node
/* LIVE production verification of the migration-prompt behaviour.
 *
 * Runs a real headless Chromium against the PUBLIC GitHub Pages site and
 * walks the exact user journey from the bug report:
 *
 *   device holds local data → account created/signed-in → migration prompt
 *   resolved once ("Merge both") → 10 hard reloads → the dialog must never
 *   reappear → sign out → sign back in → still no dialog → a second user on
 *   a fresh profile stays independently scoped.
 *
 * Two expectation modes:
 *   EXPECT=reproduce  — REQUIRE the historical bug (dialog reappears after
 *                       resolution). The control that proved the test can
 *                       detect the bug on builds up to and including b9640e6;
 *                       now a dispatch-only harness sanity check.
 *   EXPECT=fixed      — REQUIRE the healthy behaviour (prompt at most once,
 *                       then never again).
 *
 * EXPECT_BUILD_ID (optional) — the commit the site should be serving; the
 * script waits for the deployed build to match before verifying (GitHub
 * Pages deploy finishes asynchronously).
 *
 * Accounts: TEST_A_EMAIL/TEST_A_PASSWORD (+ TEST_B_*) if provided; otherwise
 * throwaway accounts are created through the real signup UI. If the Supabase
 * project requires email confirmation, an unattended throwaway cannot log in
 * and the run exits 3 (partial) asking for pre-confirmed test accounts.
 *
 * Usage:
 *   LIVE_URL=https://aaru1yg.github.io/habbit-trackerrr/ EXPECT=fixed \
 *   EXPECT_BUILD_ID=<sha> [TEST_A_...] node qa/live-migration.mjs
 *
 * Exit codes: 0 expectation met · 1 expectation violated · 2 config error ·
 * 3 partial (needs pre-confirmed accounts).
 */
import { launch, newPage, check, results, sleep } from './helpers.mjs'

const BASE = (process.env.LIVE_URL || 'https://aaru1yg.github.io/habbit-trackerrr/').replace(/\/$/, '')
const MODE = process.env.EXPECT === 'reproduce' ? 'reproduce' : 'fixed'
const EXPECT_BUILD = (process.env.EXPECT_BUILD_ID || '').replace(/[^0-9a-f]/gi, '').slice(0, 40)
const A = process.env.TEST_A_EMAIL
  ? { email: process.env.TEST_A_EMAIL.trim(), password: process.env.TEST_A_PASSWORD || '' }
  : null
const B = process.env.TEST_B_EMAIL
  ? { email: process.env.TEST_B_EMAIL.trim(), password: process.env.TEST_B_PASSWORD || '' }
  : null
const RELOADS = parseInt(process.env.RELOADS || '10', 10)

if (A && !A.password) { console.error('✗ TEST_A_EMAIL set but TEST_A_PASSWORD missing/empty.'); process.exit(2) }
if (B && !B.password) { console.error('✗ TEST_B_EMAIL set but TEST_B_PASSWORD missing/empty.'); process.exit(2) }

const stamp = Date.now()
const throwaway = (tag) => ({ email: `qa-live-${tag}-${stamp}@example.com`, password: `Qa!${stamp}${tag}` })

/* ---- page utilities ---- */

async function waitFor(page, jsExpr, { timeout = 20000, label = jsExpr } = {}) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      if (await page.evaluate(jsExpr)) return true
    } catch { /* page navigating */ }
    await sleep(300)
  }
  throw new Error(`timeout after ${timeout}ms: ${label}`)
}

const appReady = () => waitFor(pageRef.current,
  `!document.querySelector('#auth-email') && !document.querySelector('.auth-loading') && window.__BUILD_ID__ !== undefined`,
  { label: 'app ready (past auth gate)' })

const dialogOpen = (page) =>
  page.evaluate(() => document.body.innerText.includes('Existing data found'))

const pageRef = { current: null }

async function reloadAndSettle(page, { settleMs = 2500 } = {}) {
  await page.reload({ waitUntil: 'domcontentloaded' })
  pageRef.current = page
  await appReady()
  await sleep(settleMs)
}

async function login(page, { email, password }) {
  pageRef.current = page
  await waitFor(page, `!!document.querySelector('#auth-email')`, { label: 'auth screen' })
  await page.evaluate(({ email, password }) => {
    const set = (sel, v) => {
      const el = document.querySelector(sel)
      const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      d.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    set('#auth-email', email)
    set('#auth-password', password)
  }, { email, password })
  await page.click('.auth-submit')
}

async function signUp(page, { email, password, name }) {
  pageRef.current = page
  await waitFor(page, `!!document.querySelector('#auth-email')`, { label: 'auth screen' })
  await page.evaluate(() => {
    const link = [...document.querySelectorAll('button, a')].find((e) => /create account/i.test(e.textContent || ''))
    if (link) link.click()
  })
  await sleep(400)
  await page.evaluate(({ email, password, name }) => {
    const setNative = (el, v) => {
      if (!el || v == null) return
      const d = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      d.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    const nameField = document.querySelector('input[name="name"], #auth-name, input[placeholder*="name" i]')
    setNative(nameField, name)
    setNative(document.querySelector('#auth-email'), email)
    setNative(document.querySelector('#auth-password'), password)
  }, { email, password, name })
  await page.click('.auth-submit')
}

async function signOutViaUI(page) {
  pageRef.current = page
  await page.evaluate(() => { window.location.hash = '#/settings' })
  await sleep(700)
  const clicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((e) => e.textContent.trim() === 'Sign out')
    if (!btn) return false
    btn.click()
    return true
  })
  if (!clicked) throw new Error('Sign out button not found on #/settings')
  await waitFor(page, `!!document.querySelector('#auth-email')`, { label: 'back to auth screen' })
}

const deviceDoc = (markerNames) => JSON.stringify({
  version: 4,
  profile: { name: 'QA Live', onboarded: true, theme: 'midnight' },
  habits: markerNames.map((name, i) => ({ id: `qa-${stamp}-${i}`, name, createdAt: '2026-08-01T00:00:00.000Z' })),
  checkins: {}, routines: [], projects: [], assignments: [], moods: {},
})

function installSeed(page, docJson) {
  /* One-shot: apply the seed only the first time this profile boots, never on
   * later navigations — otherwise every reload would overwrite the app's own
   * persisted state and manufacture divergence the app did not create. */
  return page.evaluateOnNewDocument((d) => {
    try {
      if (!localStorage.getItem('__qa_seeded')) {
        localStorage.setItem('aaru.habits.v4', d)
        localStorage.setItem('__qa_seeded', '1')
      }
    } catch { /* ignore */ }
  }, docJson)
}

/** Add one more habit to the device-local doc (offline edit while signed out). */
async function addLocalHabit(page, name) {
  await page.evaluate((n) => {
    try {
      const state = JSON.parse(localStorage.getItem('aaru.habits.v4') || '{}')
      state.habits = [...(state.habits || []), { id: `qa-offline-${Date.now()}`, name: n, createdAt: new Date().toISOString() }]
      localStorage.setItem('aaru.habits.v4', JSON.stringify(state))
    } catch { /* ignore */ }
  }, name)
}

const buildInfo = (page) => page.evaluate(() => ({
  id: window.__BUILD_ID__ || null,
  time: window.__BUILD_TIME__ || null,
}))

/* ---- the journey ---- */

async function run() {
  console.log(`\nLive migration QA → ${BASE}  (expect: ${MODE}${EXPECT_BUILD ? `, build ${EXPECT_BUILD.slice(0, 7)}` : ''})\n`)
  const browser = await launch()

  /* Wait for production to serve the expected build (deploys are async). */
  {
    const page = await newPage(browser)
    pageRef.current = page
    await page.goto(BASE, { waitUntil: 'domcontentloaded' })
    await appReady().catch(() => {})
    let info = await buildInfo(page).catch(() => ({ id: null }))
    if (EXPECT_BUILD) {
      const deadline = Date.now() + 8 * 60 * 1000
      while (!info.id || !info.id.startsWith(EXPECT_BUILD.slice(0, 7))) {
        if (Date.now() > deadline) {
          console.error(`✗ live site still serves build ${info.id} — expected ${EXPECT_BUILD.slice(0, 7)}`)
          process.exit(1)
        }
        console.log(`  … waiting for deploy (live build ${info.id || '?'})`)
        await sleep(20000)
        await page.reload({ waitUntil: 'domcontentloaded' })
        await appReady().catch(() => {})
        info = await buildInfo(page).catch(() => ({ id: null }))
      }
    }
    console.log(`  live build: ${info.id || 'unknown'} (${info.time || 'time n/a'})`)
    results.liveBuild = `${info.id || 'unknown'} / ${info.time || 'n/a'}`
    await page.close()
  }

  /* ---------- account A: the reported journey ---------- */
  const credsA = A || throwaway('a')
  const credsB = B || throwaway('b')
  const markerA = [`QA live A ${stamp}`]
  const markerOffline = `QA live offline ${stamp}`
  const markerB = `QA live B ${stamp}`

  {
    const page = await newPage(browser)
    installSeed(page, deviceDoc(markerA))
    await page.goto(BASE, { waitUntil: 'domcontentloaded' })
    pageRef.current = page

    // Wait until the auth gate has decided what to show.
    await waitFor(page,
      `!!document.querySelector('#auth-email') || (!document.querySelector('.auth-loading') && window.__BUILD_ID__ !== undefined)`,
      { label: 'auth gate decision' })
    await sleep(500)

    if (await page.evaluate(() => !!document.querySelector('#auth-email'))) {
      if (A) {
        await login(page, credsA)
      } else {
        await signUp(page, { ...credsA, name: 'QA Live A' })
        await sleep(2500)
        if (await page.evaluate(() => !!document.querySelector('#auth-email'))) {
          const notice = await page.evaluate(() => document.body.innerText.slice(0, 600))
          if (/confirmation|verify|is invalid/i.test(notice)) {
            console.error('⊘ Supabase did not open a session for the throwaway account')
            console.error('  (email confirmation required, or the throwaway email domain was rejected).')
            console.error('  Add TEST_A_EMAIL/TEST_A_PASSWORD (+ TEST_B_*) repo secrets with pre-confirmed accounts.')
            process.exit(3)
          }
          throw new Error('signup did not produce a session: ' + notice.replace(/\n/g, ' | '))
        }
      }
      await appReady()
    }
    await sleep(2500) // allow first pull + seed/adopt to settle

    let firstPrompt = await dialogOpen(page)
    console.log(`  A: first sign-in ${firstPrompt ? 'showed the migration prompt (pre-existing account with data)' : 'was silent (fresh account seeded from device)'} — legitimate either way`)
    if (firstPrompt) {
      // A pre-existing account meeting seeded device data: resolve it once.
      const chose = await page.evaluate(() => {
        const btn = [...document.querySelectorAll('button')].find((e) => /merge both/i.test(e.textContent || ''))
        if (!btn) return false
        btn.click()
        return true
      })
      if (!chose) throw new Error('migration dialog appeared but "Merge both" was not found')
      await waitFor(page, `!document.body.innerText.includes('Existing data found')`, { label: 'dialog closed' })
      await sleep(2500)
    }
    check('A: signed in and app rendered past the auth gate',
      !(await page.evaluate(() => !!document.querySelector('#auth-email'))))

    // Sign out, edit locally (offline-style), then RELOAD so the app actually
    // boots from the edited device state — a raw localStorage write is invisible
    // to an already-running app instance. Sign back in → genuine divergence.
    await signOutViaUI(page)
    await addLocalHabit(page, markerOffline)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitFor(page,
      `!!document.querySelector('#auth-email') || (!document.querySelector('.auth-loading') && window.__BUILD_ID__ !== undefined)`,
      { label: 'auth gate after reload' })
    await sleep(1000)
    await login(page, credsA)
    await appReady()
    await sleep(2500)

    let resolvedOfflinePrompt = false
    if (await dialogOpen(page)) {
      const chose = await page.evaluate(() => {
        const btn = [...document.querySelectorAll('button')].find((e) => /merge both/i.test(e.textContent || ''))
        if (!btn) return false
        btn.click()
        return true
      })
      if (!chose) throw new Error('migration dialog appeared but "Merge both" was not found')
      await waitFor(page, `!document.body.innerText.includes('Existing data found')`, { label: 'dialog closed' })
      await sleep(2500)
      resolvedOfflinePrompt = true
    }
    console.log(`  A: after offline edit + re-sign-in, migration prompt ${resolvedOfflinePrompt ? 'was shown and resolved ONCE' : 'was not shown (documents did not diverge)'}`)

    // The reported bug: reload must NOT resurrect the dialog
    let reappeared = 0
    for (let i = 1; i <= RELOADS; i++) {
      await reloadAndSettle(page)
      if (await dialogOpen(page)) {
        reappeared++
        console.log(`  ✗ reload ${i}: dialog REAPPEARED`)
        // keep the run deterministic: resolve it again if the buggy build asks
        await page.evaluate(() => {
          const btn = [...document.querySelectorAll('button')].find((e) => /merge both/i.test(e.textContent || ''))
          if (btn) btn.click()
        })
        await sleep(2000)
      }
    }
    if (MODE === 'reproduce') {
      check(`A: BUG reproduced — dialog reappeared after resolution (${reappeared}/${RELOADS} reloads)`, reappeared > 0)
      if (reappeared === 0) {
        console.error('✗ Could NOT reproduce on this build — cannot trust this test as a control.')
      }
    } else {
      check(`A: dialog never reappeared across ${RELOADS} reloads`, reappeared === 0)
    }

    // Sign out / sign back in — still silent
    await signOutViaUI(page)
    await login(page, credsA)
    await appReady()
    await sleep(3000)
    const afterRelogin = await dialogOpen(page)
    if (MODE === 'reproduce') {
      check('A: BUG reproduced — dialog reappeared after re-login', afterRelogin === true)
      if (afterRelogin) {
        await page.evaluate(() => {
          const btn = [...document.querySelectorAll('button')].find((e) => /merge both/i.test(e.textContent || ''))
          if (btn) btn.click()
        })
        await sleep(2000)
      }
    } else {
      check('A: no dialog after sign-out/sign-in', afterRelogin === false)
    }
    await page.close()
  }

  /* ---------- account B: independent scoping on a fresh, isolated profile ---------- */
  if (MODE === 'fixed') {
    // A separate browser context = a different device: its own localStorage,
    // no session, no migration memory shared with A.
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    pageRef.current = page
    installSeed(page, deviceDoc([markerB]))
    await page.goto(BASE, { waitUntil: 'domcontentloaded' })
    await waitFor(page,
      `!!document.querySelector('#auth-email') || (!document.querySelector('.auth-loading') && window.__BUILD_ID__ !== undefined)`,
      { label: 'auth gate decision' })
    await sleep(500)

    if (await page.evaluate(() => !!document.querySelector('#auth-email'))) {
      if (B) {
        await login(page, credsB)
      } else {
        await signUp(page, { ...credsB, name: 'QA Live B' })
        await sleep(2500)
        if (await page.evaluate(() => !!document.querySelector('#auth-email'))) {
          console.log('  ⊘ B: throwaway signup unavailable (email confirmation) — scoping check skipped')
          await context.close()
          await browser.close()
          finish()
          return
        }
      }
      await appReady()
    }
    await sleep(2500)

    /* A pre-existing B account meeting the seeded device doc may legitimately
     * prompt (genuine first link on a fresh device). Either way, what must
     * hold: the prompt resolves, and A’s data never bleeds into B. */
    let bPrompted = false
    if (await dialogOpen(page)) {
      bPrompted = true
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll('button')].find((e) => /use cloud data/i.test(e.textContent || ''))
        if (btn) btn.click()
      })
      await waitFor(page, `!document.body.innerText.includes('Existing data found')`, { label: 'B dialog closed' })
      await sleep(2500)
    }

    const text = await page.evaluate(() => document.body.innerText)
    check('B: any first-link prompt was resolvable and stayed gone', !(await dialogOpen(page)))
    if (!bPrompted) check(`B: sees its own marker habit (${markerB})`, text.includes(markerB))
    check('B: does NOT see A’s marker habits', !text.includes(markerA[0]) && !text.includes(markerOffline))
    const info = await buildInfo(page)
    console.log(`\n  verified against live build ${info.id} (${info.time})`)
    await context.close()
  }

  await browser.close()
  finish()
}

function finish() {
  const live = results.liveBuild ? ` — live build ${results.liveBuild}` : ''
  console.log(`\n${results.pass} passed, ${results.fail} failed${live}\n`)
  if (results.fail > 0) {
    for (const f of results.failures) console.error(`  ✗ ${f}`)
    process.exit(1)
  }
  if (results.pass === 0) { console.error('✗ nothing was verified'); process.exit(1) }
  console.log(MODE === 'reproduce'
    ? '✅ Expectation met: the migration prompt BUG is live on production (control run).'
    : '✅ Expectation met: migration prompt behaviour is FIXED on production.')
  process.exit(0)
}

run().catch((e) => {
  console.error('✗ live QA crashed:', e?.message || e)
  process.exit(1)
})
