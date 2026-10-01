/* ============================================================
   BROWSER VERIFICATION of auth + sync.

   Drives the real @supabase/supabase-js client over real HTTP
   against qa/supabase-stub.mjs, in a real Chromium, through the
   real UI. Two independent browser contexts stand in for two
   devices so the merge and conflict paths are genuinely
   exercised rather than asserted.

   Prereqs:  node qa/supabase-stub.mjs 54321
             SUPABASE_STUB=1 VITE_SUPABASE_URL=/supabase-stub \
             VITE_SUPABASE_PUBLISHABLE_KEY=local-stub npm run dev
   Run:      QA_LIBRARY_PATH=/tmp/al2023/lib:/tmp node qa/verify-sync.mjs
   ============================================================ */
import { launch, VIEWPORTS } from './helpers.mjs'

const BASE = process.env.QA_BASE || 'http://127.0.0.1:5173'
const EMAIL = `verify+${Date.now()}@example.com`
const PASSWORD = 'correct-horse-battery'

let failures = 0
const pass = (m) => console.log(`  ok    ${m}`)
const fail = (m, extra) => { failures++; console.log(`  FAIL  ${m}${extra ? `\n        ${extra}` : ''}`) }
const check = (cond, m, extra) => (cond ? pass(m) : fail(m, extra))
const step = (m) => console.log(`\n▸ ${m}`)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function openDevice(browser, label) {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport(VIEWPORTS.desktop)
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(`${BASE}/#/today`, { waitUntil: 'networkidle2' })
  return { ctx, page, errors, label }
}

/** Seed local data by writing the store's own storage key, then reloading. */
async function seedLocal(page, habits) {
  await page.evaluate((names) => {
    const day = new Date().toISOString().slice(0, 10)
    const stamp = new Date().toISOString()
    const doc = {
      version: 5,
      profile: { name: 'Verifier', onboarded: true, theme: 'light', motion: 'full', weekStart: 1, lastExport: null, updatedAt: stamp },
      habits: names.map((n, i) => ({
        id: `seed${i}${n.replace(/\W/g, '').slice(0, 6)}`,
        name: n, icon: 'check', category: 'mind',
        target: { type: 'done', goal: 1, unit: '' },
        cadence: { type: 'daily' }, cue: '', notes: '',
        createdAt: day, archivedAt: null, updatedAt: stamp, order: i,
      })),
      checkins: {}, work: [], goals: [], moods: {}, deleted: {},
    }
    localStorage.setItem('aaru.os.v5', JSON.stringify(doc))
  }, habits)
  await page.reload({ waitUntil: 'networkidle2' })
}

const habitNames = (page) => page.$$eval('.erow__name, .erow__title, .hcard__name',
  (els) => els.map((e) => e.textContent.trim()))

async function signIn(page, { mode }) {
  await page.goto(`${BASE}/#/account`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('form input[type=email]', { timeout: 10000 })
  if (mode === 'signup') {
    const [link] = await page.$$('button.linkish')
    if (link) { await link.click(); await sleep(250) }
  }
  await page.type('input[type=email]', EMAIL)
  await page.type('input[type=password]', PASSWORD)
  await page.click('form button[type=submit]')
}

const syncLabel = (page) => page.$eval('.syncbadge', (e) => e.textContent.trim()).catch(() => null)

async function main() {
  const browser = await launch()
  const A = await openDevice(browser, 'A')

  step('Local-first: the app works with no account')
  await seedLocal(A.page, ['Read 20 pages', 'Stretch'])
  const beforeNames = await habitNames(A.page)
  check(beforeNames.includes('Read 20 pages'), 'habits render with no account', beforeNames.join(', '))
  check((await syncLabel(A.page)) === 'This device only', 'top bar reports "This device only"')

  step('Create an account from device A')
  await signIn(A.page, { mode: 'signup' })
  await A.page.waitForFunction(
    () => document.querySelector('.syncbadge')?.textContent.includes('Synced'),
    { timeout: 20000 }
  ).catch(() => {})
  check((await syncLabel(A.page)) === 'Synced', 'device A reports Synced after a real round-trip',
    `saw: ${await syncLabel(A.page)}`)

  step('Device A adds a habit; it reaches the server')
  await A.page.goto(`${BASE}/#/habits`, { waitUntil: 'networkidle2' })
  await A.page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('aaru.os.v5'))
    d.habits.push({
      id: 'onlyOnA', name: 'Added on A', icon: 'check', category: 'body',
      target: { type: 'done', goal: 1, unit: '' }, cadence: { type: 'daily' },
      cue: '', notes: '', createdAt: d.habits[0].createdAt, archivedAt: null,
      updatedAt: new Date().toISOString(), order: d.habits.length,
    })
    localStorage.setItem('aaru.os.v5', JSON.stringify(d))
  })
  await A.page.reload({ waitUntil: 'networkidle2' })
  await sleep(2600) // debounce (1.2s) plus the round-trip
  check((await syncLabel(A.page)) === 'Synced', 'device A back to Synced after an edit')

  step('Device B signs in to the same account and receives the data')
  const B = await openDevice(browser, 'B')
  check((await habitNames(B.page)).length === 0, 'device B starts empty')
  await signIn(B.page, { mode: 'signin' })
  await B.page.waitForFunction(
    () => document.querySelector('.syncbadge')?.textContent.includes('Synced'),
    { timeout: 20000 }
  ).catch(() => {})
  await B.page.goto(`${BASE}/#/habits`, { waitUntil: 'networkidle2' })
  await sleep(800)
  const bNames = await habitNames(B.page)
  check(bNames.includes('Added on A'), 'device B adopted the account document', bNames.join(', '))
  check(bNames.includes('Read 20 pages'), 'device B has the earlier habits too', bNames.join(', '))

  step('Concurrent edits: both survive, neither clobbers the other')
  // B edits and pushes.
  await B.page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('aaru.os.v5'))
    d.habits.push({
      id: 'onlyOnB', name: 'Added on B', icon: 'check', category: 'craft',
      target: { type: 'done', goal: 1, unit: '' }, cadence: { type: 'daily' },
      cue: '', notes: '', createdAt: d.habits[0].createdAt, archivedAt: null,
      updatedAt: new Date().toISOString(), order: d.habits.length,
    })
    localStorage.setItem('aaru.os.v5', JSON.stringify(d))
  })
  await B.page.reload({ waitUntil: 'networkidle2' })
  await sleep(2600)

  // A, still holding the older revision, edits too. Its write must lose the
  // compare-and-swap, re-read, merge and retry.
  await A.page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('aaru.os.v5'))
    d.habits.push({
      id: 'laterOnA', name: 'Added later on A', icon: 'check', category: 'care',
      target: { type: 'done', goal: 1, unit: '' }, cadence: { type: 'daily' },
      cue: '', notes: '', createdAt: d.habits[0].createdAt, archivedAt: null,
      updatedAt: new Date().toISOString(), order: d.habits.length,
    })
    localStorage.setItem('aaru.os.v5', JSON.stringify(d))
  })
  await A.page.reload({ waitUntil: 'networkidle2' })
  await sleep(3200)
  await A.page.goto(`${BASE}/#/habits`, { waitUntil: 'networkidle2' })
  await sleep(600)
  const aFinal = await habitNames(A.page)
  check(aFinal.includes('Added later on A'), 'device A kept its own new habit', aFinal.join(', '))
  check(aFinal.includes('Added on B'), 'device A merged in device B\'s habit instead of clobbering it',
    aFinal.join(', '))

  step('A deletion does not come back from the other device')
  await A.page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('aaru.os.v5'))
    d.habits = d.habits.filter((h) => h.id !== 'onlyOnB')
    d.deleted = { ...(d.deleted || {}), onlyOnB: new Date().toISOString() }
    localStorage.setItem('aaru.os.v5', JSON.stringify(d))
  })
  await A.page.reload({ waitUntil: 'networkidle2' })
  await sleep(3000)
  await B.page.goto(`${BASE}/#/today`, { waitUntil: 'networkidle2' })
  await B.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange', { bubbles: true })))
  await sleep(2500)
  await B.page.goto(`${BASE}/#/habits`, { waitUntil: 'networkidle2' })
  await sleep(800)
  const bAfterDelete = await habitNames(B.page)
  check(!bAfterDelete.includes('Added on B'), 'the tombstone propagated; the habit stayed deleted',
    bAfterDelete.join(', '))

  step('Sign out leaves the local copy intact')
  await A.page.goto(`${BASE}/#/account`, { waitUntil: 'networkidle2' })
  const signOut = await A.page.$$eval('button', (bs) =>
    bs.findIndex((b) => b.textContent.trim() === 'Sign out'))
  if (signOut >= 0) {
    const buttons = await A.page.$$('button')
    await buttons[signOut].click()
    await sleep(1200)
  }
  await A.page.goto(`${BASE}/#/habits`, { waitUntil: 'networkidle2' })
  await sleep(600)
  const afterOut = await habitNames(A.page)
  check(afterOut.includes('Added later on A'), 'habits still present after signing out', afterOut.join(', '))
  check((await syncLabel(A.page)) === 'This device only', 'status honestly reverts to "This device only"')

  step('Console health')
  const noise = [...A.errors, ...B.errors].filter((e) =>
    !/favicon|Download the React DevTools|sw\.js/i.test(e))
  check(noise.length === 0, 'no console errors across both devices', noise.slice(0, 4).join('\n        '))

  await browser.close()
  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
