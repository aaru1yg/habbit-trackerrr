/* Release proof, not a mocked production test.
 * Local: node qa/release.mjs http://localhost:4173/
 * Public: REQUIRE_AUTH=1 EXPECT_BUILD_ID=<full sha> ARTIFACT_DIR=dist
 *         LIVE_URL=https://aaru1yg.github.io/habbit-trackerrr/ node qa/release.mjs
 * Public runs use ONLY the existing TEST_A account via the real sign-in UI.
 * Artifacts contain screenshots + checksums, never passwords or auth storage.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { launch, newPage, seedAndGoto, seededStateV4, sleep, VIEWPORTS } from './helpers.mjs'
import { sha256, assertPublicBundle } from './build-proof.mjs'

const BASE = (process.env.LIVE_URL || process.argv[2] || 'http://localhost:4173/').replace(/\/?$/, '/')
const ROOT = resolve(process.env.ARTIFACT_DIR || 'dist')
const OUT = 'qa/shots/release'
const REQUIRE_AUTH = process.env.REQUIRE_AUTH === '1'
const EXPECT = process.env.EXPECT_BUILD_ID || ''
const credentials = { email: process.env.TEST_A_EMAIL?.trim(), password: process.env.TEST_A_PASSWORD }
const proof = JSON.parse(readFileSync(resolve(ROOT, 'release.json'), 'utf8'))
const evidence = { url: BASE, commit: proof.commit, builtAt: proof.builtAt, verifiedAt: new Date().toISOString(), checks: [], assets: {} }
mkdirSync(OUT, { recursive: true })

function check(name, ok, detail = '') {
  evidence.checks.push({ name, passed: Boolean(ok), ...(detail ? { detail } : {}) })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) throw new Error(name)
}
function safe(message) {
  for (const value of [credentials.email, credentials.password, process.env.TEST_B_PASSWORD]) {
    if (value) message = message.replaceAll(value, '[redacted]')
  }
  return message.replace(/(?:access_token|refresh_token)=[^&\s]+/g, 'token=[redacted]')
}
async function screenshot(page, name) {
  // The login shot is taken BEFORE credentials are entered. Redact the test
  // account's email on Settings too; do not save session/localStorage dumps.
  await page.evaluate((email) => {
    if (!email) return
    for (const el of document.querySelectorAll('p')) {
      if (el.textContent === email) el.style.visibility = 'hidden'
    }
  }, credentials.email || '')
  await page.screenshot({ path: `${OUT}/${name}.png` })
}

async function verifyArtifact() {
  if (EXPECT) check('artifact is from the requested full commit', proof.commit === EXPECT)
  const stop = Date.now() + 8 * 60 * 1000
  let live
  do {
    const response = await fetch(new URL(`release.json?verify=${proof.buildId}`, BASE), { cache: 'no-store' })
    if (response.ok) live = await response.json()
    if (live?.commit === proof.commit) break
    if (Date.now() >= stop) throw new Error(`Public build did not reach ${proof.commit}`)
    console.log('Waiting for Pages to serve the exact release commit…')
    await sleep(15000)
  // eslint-disable-next-line no-constant-condition -- intentional poll-until-deployed loop
  } while (true)
  check('public release.json matches the exact deployed artifact', JSON.stringify(live) === JSON.stringify(proof))
  const entries = Object.entries(proof.files)
  // Every JS/CSS/font/art/SW/HTML byte is checked against the Pages artifact,
  // not just the build marker. Limit parallel requests to be polite to Pages.
  for (let offset = 0; offset < entries.length; offset += 6) {
    await Promise.all(entries.slice(offset, offset + 6).map(async ([path, expectedHash]) => {
      const response = await fetch(new URL(`${path}?verify=${proof.buildId}`, BASE), { cache: 'no-store' })
      if (!response.ok) throw new Error(`Public asset failed: ${path} (${response.status})`)
      const bytes = Buffer.from(await response.arrayBuffer())
      const actual = sha256(bytes)
      if (actual !== expectedHash || sha256(readFileSync(resolve(ROOT, path))) !== expectedHash) {
        throw new Error(`Public asset differs from the Pages build: ${path}`)
      }
      if (/\.(js|css|html)$/.test(path)) assertPublicBundle(bytes.toString(), [credentials.password, process.env.TEST_B_PASSWORD])
      evidence.assets[path] = actual
    }))
  }
  check('all public assets byte-match the Pages build; no private credentials', true, `${entries.length} SHA-256 matches`)
  check('V2 habit detail and achievement chunks are actually deployed',
    entries.some(([path]) => /HabitDetailScreen.*\.js$/.test(path)) && entries.some(([path]) => /AchievementsScreen.*\.js$/.test(path)))
}

const titles = {
  today: /Good (morning|afternoon|evening)/, calendar: /Calendar/, habits: /^Habits$/,
  goals: /^Goals$/, projects: /^Projects$/, assignments: /^Assignments$/,
  insights: /^Insights$/, workload: /^Workload$/, achievements: /^Achievements$/, settings: /^Settings$/,
}

async function clickVisible(page, selector) {
  const handles = await page.$$(selector)
  for (const handle of handles) {
    const visible = await handle.evaluate((el) => {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'
    })
    if (!visible) continue
    await handle.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
    await sleep(100)
    const hit = await handle.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      return top && (el === top || el.contains(top))
    })
    if (hit) { await handle.click(); return }
  }
  throw new Error(`No reachable control: ${selector}`)
}

async function ready(page, route) {
  await page.waitForFunction((route) => {
    const h = document.querySelector('main .screen-title')
    return location.hash === `#/${route}` && h && h.textContent.trim() && !document.querySelector('.auth-loading')
  }, { timeout: 20000 }, route)
  await sleep(650)
  await page.evaluate(() => document.fonts.ready)
}

async function navigate(page, route, mobile) {
  if (mobile) {
    if (['today', 'calendar', 'projects', 'insights'].includes(route)) {
      await clickVisible(page, `.bottom-nav a[href="#/${route}"]`)
    } else if (route === 'assignments') {
      await clickVisible(page, '.bottom-nav a[href="#/projects"]')
      await ready(page, 'projects')
      await clickVisible(page, '.tabbar a[href="#/assignments"]')
    } else {
      await clickVisible(page, '.bottom-nav button[aria-label="More sections"]')
      await page.waitForSelector('[role="dialog"]', { visible: true })
      await sleep(400)
      await dialogFits(page, 'mobile More sheet')
      await clickVisible(page, `[role="dialog"] a[href="#/${route}"]`)
    }
  } else {
    await clickVisible(page, `.sidebar a[href="#/${route}"]`)
  }
  await ready(page, route)
  check(`${mobile ? 'mobile' : 'desktop'} navigation → ${route}`, await page.$eval('main .screen-title', (el) => el.textContent).then((t) => titles[route].test(t)))
}

async function layout(page, name) {
  const result = await page.evaluate(() => {
    const root = document.documentElement
    const images = [...document.images].filter((img) => img.complete && img.naturalWidth === 0).map((img) => img.getAttribute('src'))
    return { overflow: root.scrollWidth - root.clientWidth, images, invalid: /\b(?:NaN|Infinity|undefined)\b/.test(document.body.innerText) }
  })
  check(`${name}: no horizontal overflow, broken images or invalid numbers`, result.overflow <= 1 && result.images.length === 0 && !result.invalid, JSON.stringify(result))
}

async function dialogFits(page, name) {
  // Wait for the entrance spring rather than measuring a half-entered sheet.
  await page.waitForFunction(() => {
    const el = document.querySelector('[role="dialog"]')
    if (!el) return false
    const r = el.getBoundingClientRect()
    return r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1
  }, { timeout: 8000 })
  const fits = await page.$eval('[role="dialog"]', (el) => {
    const r = el.getBoundingClientRect()
    return r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1
  })
  check(`${name}: dialog stays inside viewport`, fits)
}

async function login(page) {
  await page.waitForSelector('#auth-email', { visible: true, timeout: 20000 })
  await page.type('#auth-email', credentials.email)
  await page.type('#auth-password', credentials.password)
  await clickVisible(page, '.auth-submit')
  await page.waitForFunction(() => !document.querySelector('#auth-email') && !document.querySelector('.auth-loading'), { timeout: 30000 })
  await sleep(2000)
  if (await page.$('#migrate-title')) {
    await dialogFits(page, 'first-link migration')
    // Only the named QA account is used. Its generated fixture is intentional.
    const button = await page.$('::-p-text(Keep my local data)')
    if (!button) throw new Error('Migration choice missing')
    await button.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
    await button.click()
    await page.waitForFunction(() => !document.querySelector('#migrate-title'))
  }
}

async function synced(page) {
  await page.waitForFunction(() => [...document.querySelectorAll('.chip')].some((el) => el.textContent === 'Synced'), { timeout: 30000 })
  check('real cloud round-trip reports Synced with a server timestamp', await page.evaluate(() => document.body.innerText.includes('Last synced:')))
}

async function addHabit(page, name, viewport) {
  await clickVisible(page, viewport === 'mobile' ? '.fab-stack button[aria-label="Add a habit"]' : '.today-section .card-head button.btn')
  await page.waitForSelector('#habit-name', { visible: true })
  await sleep(400)
  await dialogFits(page, `${viewport} Add habit`)
  await page.type('#habit-name', name)
  await screenshot(page, `${viewport}-add-habit`)
  await clickVisible(page, '[role="dialog"] .sheet-footer .btn.primary')
  await page.waitForFunction((name) => {
    const doc = JSON.parse(localStorage.getItem('aaru.habits.v4') || '{}')
    return doc.habits?.some((h) => h.name === name) && !document.querySelector('#habit-name')
  }, { timeout: 15000 }, name)
  check(`${viewport}: Add habit primary action is reachable and saves`, true)
}

async function addWork(page, route, viewport, mobile) {
  const kind = route === 'projects' ? 'project' : 'assignment'
  const article = kind === 'assignment' ? 'an' : 'a'
  await clickVisible(page, mobile
    ? `.fab-stack button[aria-label="Add ${article} ${kind}"]`
    : `#${route}-screen .head-actions .btn.primary`)
  await page.waitForSelector(`#${kind}-name`, { visible: true })
  await dialogFits(page, `${viewport} New ${kind}`)
  const name = `QA V2 ${kind} ${viewport} ${proof.buildId}`
  await page.type(`#${kind}-name`, name)
  await screenshot(page, `${viewport}-add-${kind}`)
  await clickVisible(page, '[role="dialog"] .sheet-footer .btn.primary')
  await page.waitForFunction((route, name, kind) => {
    const doc = JSON.parse(localStorage.getItem('aaru.habits.v4') || '{}')
    return doc[route]?.some((item) => item.name === name) && !document.querySelector(`#${kind}-name`)
  }, { timeout: 15000 }, route, name, kind)
  check(`${viewport}: ${kind} Add action is reachable and saves`, true)
}

async function addGoal(page, viewport) {
  await clickVisible(page, '#goals-screen .head-actions .btn.primary')
  await page.waitForSelector('#goal-title', { visible: true })
  await dialogFits(page, `${viewport} New goal`)
  const title = `QA V2 goal ${viewport} ${proof.buildId}`
  await page.type('#goal-title', title)
  await screenshot(page, `${viewport}-add-goal`)
  await clickVisible(page, '[role="dialog"] .sheet-footer .btn.primary')
  await page.waitForFunction((title) => {
    const doc = JSON.parse(localStorage.getItem('aaru.habits.v4') || '{}')
    return doc.goals?.some((g) => g.title === title) && !document.querySelector('#goal-title')
  }, { timeout: 15000 }, title)
  check(`${viewport}: first-class Goal Add action is reachable and saves`, true)
}

async function screenSweep(page, viewport, mobile) {
  for (const route of Object.keys(titles)) {
    await navigate(page, route, mobile)
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }))
    await sleep(100)
    await screenshot(page, `${viewport}-${route}`)
    await layout(page, `${viewport} ${route}`)
    // Walk the whole screen to load lazy images and inspect the below-fold UI.
    const height = await page.evaluate(() => document.documentElement.scrollHeight)
    for (let y = 600; y < height; y += 700) {
      await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), y)
      await sleep(100)
    }
    await sleep(300)
    await layout(page, `${viewport} ${route} below fold`)
    await screenshot(page, `${viewport}-${route}-bottom`)
    if (route === 'today') {
      check(`${viewport}: V2 Today command center is rendered`, await page.evaluate(() => Boolean(document.querySelector('.today-priorities') && document.querySelector('.today-timeline') && document.querySelector('.today-goals'))))
      await addHabit(page, `QA V2 ${viewport} ${proof.buildId}`, viewport)
    }
    if (route === 'habits') {
      await clickVisible(page, 'a[href="#/habits/h-run"]')
      await ready(page, 'habits/h-run')
      check(`${viewport}: habit detail shows real history`, await page.evaluate(() => Boolean(document.querySelector('.heatmap') && document.querySelector('.habit-facts') && document.querySelector('.streak-list'))))
      await layout(page, `${viewport} habit detail`)
      await screenshot(page, `${viewport}-habit-detail`)
    }
    if (route === 'achievements') {
      check(`${viewport}: 17 real-data achievement cards`, await page.$$eval('.ach-card', (cards) => cards.length === 17))
    }
    if (route === 'goals') await addGoal(page, viewport)
    if (route === 'projects' || route === 'assignments') await addWork(page, route, viewport, mobile)
    if (route === 'settings' && REQUIRE_AUTH) await synced(page)
  }
}

let browser
try {
  if (REQUIRE_AUTH && (!credentials.email || !credentials.password)) throw new Error('Pre-confirmed TEST_A credentials are required; no partial pass.')
  await verifyArtifact()
  browser = await launch()
  for (const [viewport, config] of Object.entries(VIEWPORTS)) {
    const context = await browser.createBrowserContext()
    const page = await newPage(context, config)
    try {
      await seedAndGoto(page, seededStateV4(), 'today', BASE.replace(/\/$/, ''))
      if (REQUIRE_AUTH) {
        await page.waitForSelector('#auth-email', { visible: true, timeout: 20000 })
        await screenshot(page, `${viewport}-login`)
        await layout(page, `${viewport} public login`)
        await login(page)
        check(`${viewport}: real sign-in loads the app`, !(await page.$('#auth-email')))
      }
      await ready(page, 'today')
      check(`${viewport}: browser runtime matches artifact commit`, await page.evaluate(() => window.__BUILD_ID__) === proof.buildId)
      await screenSweep(page, viewport, viewport === 'mobile')
      if (REQUIRE_AUTH) {
        const other = await browser.createBrowserContext()
        const device = await newPage(other, config)
        try {
          await device.goto(`${BASE}#/today`, { waitUntil: 'networkidle0' })
          await login(device)
          const marker = `QA V2 ${viewport} ${proof.buildId}`
          const goalTitle = `QA V2 goal ${viewport} ${proof.buildId}`
          await device.waitForFunction((marker, goalTitle) => {
            const doc = JSON.parse(localStorage.getItem('aaru.habits.v4') || '{}')
            return doc.habits?.some((h) => h.name === marker) && doc.goals?.some((g) => g.title === goalTitle)
          }, { timeout: 30000 }, marker, goalTitle)
          check(`${viewport}: second clean browser pulls the UI-created habit AND goal from Supabase`, true)
          await navigate(device, 'settings', viewport === 'mobile')
          await synced(device)
          await clickVisible(device, '::-p-text(Sign out)')
          await device.waitForSelector('#auth-email', { visible: true })
          check(`${viewport}: logout restores the login gate`, !(await device.$('.sidebar')))
          await login(device)
          await device.reload({ waitUntil: 'networkidle0' })
          await device.waitForSelector('.screen-title', { visible: true })
          check(`${viewport}: re-login and reload retain the session without a migration prompt`, !(await device.$('#auth-email')) && !(await device.$('#migrate-title')))
          check(`${viewport}: second browser has no console/page/network errors`, Object.values(device._qa).every((v) => v.length === 0), safe(JSON.stringify(device._qa)))
        } finally { await other.close() }
      }
      check(`${viewport}: no console/page/network errors`, Object.values(page._qa).every((v) => v.length === 0), safe(JSON.stringify(page._qa)))
    } finally { await context.close() }
  }
  evidence.status = 'passed'
  console.log(`${REQUIRE_AUTH ? 'PUBLIC' : 'LOCAL'} RELEASE PROOF: ${proof.commit} · ${evidence.checks.length} checks · ${Object.keys(evidence.assets).length} matching assets · ${BASE}`)
} catch (error) {
  evidence.status = 'failed'
  evidence.error = safe(error.message)
  console.error(`✗ Release verification: ${evidence.error}`)
  process.exitCode = 1
} finally {
  await browser?.close()
  writeFileSync(`${OUT}/report.json`, JSON.stringify(evidence, null, 2) + '\n')
}
