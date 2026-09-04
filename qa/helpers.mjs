/* Shared browser helpers for QA runs. */
import { existsSync } from 'fs'
import puppeteer from 'puppeteer-core'

export const VIEWPORTS = {
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
}

const BASE_ARGS = [
  '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  '--force-color-profile=srgb', '--disable-lcd-text',
  '--enable-features=OverlayScrollbar',
]

/** Look for a usable system chromium first (CHROMIUM_PATH or common installs). */
function systemChromium() {
  if (process.env.CHROMIUM_PATH && existsSync(process.env.CHROMIUM_PATH)) return process.env.CHROMIUM_PATH
  const known = [
    '/tmp/chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ]
  return known.find((p) => existsSync(p)) || null
}

/** Fall back to the bundled @sparticuz/chromium (devDependency) when no system
 *  chromium exists — e.g. a fresh CI runner or a stripped-down container. */
async function bundledChromium() {
  const { default: chromium } = await import('@sparticuz/chromium')
  const executablePath = await chromium.executablePath()
  return { executablePath, args: [...chromium.args, ...BASE_ARGS] }
}

export async function launch() {
  const env = { ...process.env }
  if (process.env.QA_LIBRARY_PATH) env.LD_LIBRARY_PATH = process.env.QA_LIBRARY_PATH
  const system = systemChromium()
  if (system) {
    return puppeteer.launch({ args: BASE_ARGS, executablePath: system, headless: true, env })
  }
  const bundled = await bundledChromium()
  return puppeteer.launch({ args: bundled.args, executablePath: bundled.executablePath, headless: true, env })
}

export async function newPage(browser, viewport = VIEWPORTS.mobile) {
  const page = await browser.newPage()
  await page.setViewport(viewport)
  const state = { consoleErrors: [], pageErrors: [], failedRequests: [] }
  page.on('console', (msg) => {
    if (msg.type() === 'error') state.consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => state.pageErrors.push(String(err)))
  page.on('requestfailed', (req) => {
    state.failedRequests.push(`${req.url()} ${req.failure()?.errorText}`)
  })
  page.on('response', (res) => {
    if (res.status() >= 400) state.failedRequests.push(`${res.url()} → ${res.status()}`)
  })
  page._qa = state
  return page
}

export const results = { pass: 0, fail: 0, failures: [] }

export function check(name, cond, detail = '') {
  if (cond) {
    results.pass++
    console.log(`  ✓ ${name}`)
  } else {
    results.fail++
    results.failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

export async function shot(page, name) {
  await page.screenshot({ path: `qa/shots/${name}.png` })
}

export async function clickByText(page, text, selector = 'button, a') {
  const ok = await page.evaluate((text, selector) => {
    const els = [...document.querySelectorAll(selector)]
    const exact = els.find((e) => e.textContent.trim() === text || e.getAttribute('aria-label') === text)
    const el = exact || els.find((e) => (e.textContent || '').includes(text) || (e.getAttribute('aria-label') || '').includes(text))
    if (!el) return false
    el.click()
    return true
  }, text, selector)
  if (!ok) throw new Error(`clickByText: not found "${text}"`)
}

export async function clickByLabel(page, labelRegex) {
  const ok = await page.evaluate((labelRegex) => {
    const re = new RegExp(labelRegex)
    const el = [...document.querySelectorAll('[aria-label]')].find((e) => re.test(e.getAttribute('aria-label')))
    if (!el) return false
    el.click()
    return true
  }, labelRegex)
  if (!ok) throw new Error(`clickByLabel: not found /${labelRegex}/`)
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** localStorage state helpers (app reads key aaru.habits.v3) */
export async function setStoredState(page, state) {
  await page.evaluate((s) => {
    localStorage.clear()
    localStorage.setItem('aaru.habits.v3', JSON.stringify(s))
  }, state)
}

/** Seed storage deterministically, then load the app fresh at a route.
 *  The seed is injected before any app script runs (no stale-app writes),
 *  and the injection is removed so later reloads test real persistence. */
export async function seedAndGoto(page, state, route, base = 'http://localhost:4173') {
  const handle = await page.evaluateOnNewDocument((s) => {
    try {
      localStorage.clear()
      localStorage.setItem('aaru.habits.v3', JSON.stringify(s))
    } catch { /* ignore */ }
  }, state)
  try {
    await page.goto(`${base}/#/${route}`, { waitUntil: 'networkidle0' })
    await sleep(500)
  } finally {
    try {
      const client = page._client()
      await client.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: handle.identifier })
    } catch {
      try { await handle.remove?.() } catch { /* best effort */ }
    }
  }
}

export async function getStoredState(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('aaru.habits.v3') || 'null'))
}

export const dayStr = (d) => {
  const x = d instanceof Date ? d : new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`
}
export const subDays = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return dayStr(d)
}

/** Build a realistic v3 state (real dates, no fake claims — QA fixture data). */
export function seededState() {
  const habits = [
    { id: 'h-run', name: 'Morning run', category: 'fitness', schedule: { type: 'daily' }, reminder: null, notes: 'Easy pace is fine.', createdAt: subDays(75), archived: false, order: 0 },
    { id: 'h-read', name: 'Read 20 pages', category: 'learning', schedule: { type: 'daily' }, reminder: null, notes: '', createdAt: subDays(75), archived: false, order: 1 },
    { id: 'h-med', name: 'Meditate', category: 'mind', schedule: { type: 'weekdays', days: [1, 2, 3, 4, 5] }, reminder: '07:30', notes: '', createdAt: subDays(60), archived: false, order: 2 },
    { id: 'h-water', name: 'Drink water', category: 'health', schedule: { type: 'daily' }, reminder: null, notes: '', createdAt: subDays(40), archived: false, order: 3 },
    { id: 'h-guitar', name: 'Practice guitar', category: 'creative', schedule: { type: 'weekdays', days: [1, 3, 5] }, reminder: null, notes: '', createdAt: subDays(50), archived: false, order: 4 },
  ]
  const checkins = {}
  for (const h of habits) {
    checkins[h.id] = {}
    for (let i = 1; i <= 75; i++) {
      const date = subDays(i)
      const wd = new Date(`${date}T12:00:00`).getDay()
      const sched =
        h.schedule.type === 'daily' ||
        (h.id === 'h-med' && [1, 2, 3, 4, 5].includes(wd)) ||
        (h.id === 'h-guitar' && [1, 3, 5].includes(wd))
      if (!sched || date < h.createdAt) continue
      // deterministic "personality": run 85%, read 70%, meditate 60%, water 90%, guitar 40%
      const rate = { 'h-run': 0.85, 'h-read': 0.7, 'h-med': 0.6, 'h-water': 0.9, 'h-guitar': 0.4 }[h.id]
      const seed = (i * 7 + h.id.charCodeAt(2) * 13) % 100
      if (seed < rate * 100) checkins[h.id][date] = { done: true }
    }
  }
  const moods = {}
  for (let i = 1; i <= 30; i++) {
    if ((i * 3) % 5 === 0) continue
    moods[subDays(i)] = { score: 2 + ((i * 7) % 4) }
  }
  return {
    version: 3,
    profile: { name: 'Aaru', onboarded: true, theme: 'midnight', lastBackupExport: subDays(35), lastBackupReminder: null, reminderNoteSeen: false },
    habits,
    checkins,
    projects: [
      {
        id: 'p1', name: 'Portfolio site', createdAt: subDays(20), completedAt: null, legacyPercent: null, order: 0,
        milestones: [
          { id: 'm1', name: 'Design', tasks: [{ id: 't1', name: 'Pick typeface', done: true }, { id: 't2', name: 'Hero section', done: true }] },
          { id: 'm2', name: 'Build', tasks: [{ id: 't3', name: 'Set up repo', done: true }, { id: 't4', name: 'Case studies', done: false }, { id: 't5', name: 'Deploy', done: false }] },
        ],
      },
    ],
    moods,
  }
}

export function report(label) {
  console.log(`\n=== ${label}: ${results.pass} passed, ${results.fail} failed ===`)
  if (results.failures.length) {
    console.log('FAILURES:')
    for (const f of results.failures) console.log('  -', f)
    process.exitCode = 1
  }
}
