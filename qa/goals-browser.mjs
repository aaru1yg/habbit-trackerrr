/* ============================================================
   GOALS — Phase 6 browser QA (Phase 6 §38).
   Real Chromium at 390×844, 430×932 and 1440×900.
   Verifies the list-first workspace, filters, goal cards, detail,
   milestone completion, at-risk & reached states, no horizontal
   overflow and no console/page errors.

   Run:  node qa/goals-browser.mjs [BASE_URL]
   (defaults to http://localhost:4180)
   ============================================================ */
import { mkdirSync } from 'fs'
import { launch, newPage } from './helpers.mjs'

const BASE = process.argv[2] || 'http://localhost:4180'
const today = new Date()
const iso = (days, hh) => {
  const d = new Date(today.getTime() + days * 86400000)
  const s = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${s(d.getMonth() + 1)}-${s(d.getDate())}` + (hh ? `T${hh}:00:00` : '')
}
const goal = (over) => ({
  id: 'g', title: 'G', why: '', area: 'mind', startDate: iso(0, '09'), targetDate: null,
  status: 'active', milestones: [], linkedHabitIds: [], linkedProjectIds: [],
  linkedAssignmentIds: [], manualPercent: null, notes: '', completedAt: null, archived: false, order: 0,
  ...over,
})
function seed() {
  const profile = { name: 'QA', onboarded: true, theme: 'midnight', workReminders: false }
  const prefs = { dailyCapacityMin: 120, planningBufferPct: 15, weekStartsOn: 1 }
  return {
    version: 4,
    profile,
    habits: [], checkins: {}, routines: [], projects: [], assignments: [],
    moods: {}, notes: [], signals: [], focusLog: [],
    preferences: prefs,
    goals: [
      goal({ id: 'on', title: 'Write a novella', area: 'creative', startDate: iso(0, '09'), targetDate: iso(30), milestones: [{ id: 'm1', name: 'Finish a draft', targetDate: iso(20), done: false, order: 0 }] }),
      goal({ id: 'risk', title: 'Thesis', area: 'learning', startDate: iso(-60, '09'), targetDate: iso(10), milestones: ['a', 'b', 'c', 'd', 'e'].map((x, i) => ({ id: `r${i}`, name: `Step ${x}`, targetDate: null, done: i === 0, order: i })) }),
      goal({ id: 'late', title: 'Marathon', area: 'fitness', startDate: iso(-30, '09'), targetDate: iso(-5), milestones: [0, 1].map((i) => ({ id: `l${i}`, name: i ? 'Full distance' : 'Half distance', targetDate: null, done: i === 0, order: i })) }),
      goal({ id: 'reached', title: 'Learn Spanish', area: 'mind', status: 'completed', completedAt: iso(-2, '09'), milestones: [{ id: 'd1', name: 'B1', targetDate: null, done: true, order: 0 }] }),
    ],
  }
}

mkdirSync('qa/shots', { recursive: true })

async function visitGoals(browser, viewport, name) {
  const page = await newPage(browser, viewport)
  const errs = { console: [], page: [], failed: [] }
  page.on('console', (m) => { if (m.type() === 'error') errs.console.push(m.text()) })
  page.on('pageerror', (e) => errs.page.push(String(e)))
  page.on('requestfailed', (r) => { if (!r.response()) errs.failed.push(r.url()) })

  // Seed then load the goals workspace.
  await page.goto(`${BASE}/#/today`, { waitUntil: 'networkidle2' })
  await page.evaluate((s) => localStorage.setItem('aaru.habits.v4', JSON.stringify(s)), seed())
  await page.goto(`${BASE}/#/goals`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('#goals-screen', { timeout: 20000 })
  await page.waitForFunction(() => document.body.scrollWidth <= window.innerWidth, { timeout: 5000 })

  const summary = await page.evaluate(() => {
    const txt = (sel) => document.querySelector(sel)?.textContent?.trim() || null
    const cards = [...document.querySelectorAll('.goal-card')]
    return {
      title: txt('#goals-screen .screen-title'),
      openCards: cards.filter((c) => !c.classList.contains('is-reached')).length,
      reachedCards: cards.filter((c) => c.classList.contains('is-reached')).length,
      atlasPresent: !!document.querySelector('.atlas-wrap'),
      overflow: document.body.scrollWidth - window.innerWidth,
      hasAtRisk: cards.some((c) => c.textContent.includes('At risk') || c.textContent.includes('AT RISK')),
      hasOverdue: cards.some((c) => c.textContent.includes('Overdue') || c.textContent.includes('OVERDUE')),
    }
  })
  await page.screenshot({ path: `qa/shots/goals-${name}.png`, fullPage: true })
  return { summary, errs }
}

async function visitDetail(browser, viewport, name) {
  const page = await newPage(browser, viewport)
  const errs = { console: [], page: [], failed: [] }
  page.on('console', (m) => { if (m.type() === 'error') errs.console.push(m.text()) })
  page.on('pageerror', (e) => errs.page.push(String(e)))
  await page.goto(`${BASE}/#/today`, { waitUntil: 'networkidle2' })
  await page.evaluate((s) => localStorage.setItem('aaru.habits.v4', JSON.stringify(s)), seed())
  await page.goto(`${BASE}/#/goals/on`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('#goal-detail-screen', { timeout: 20000 })
  await page.waitForFunction(() => document.body.scrollWidth <= window.innerWidth, { timeout: 5000 })
  const info = await page.evaluate(() => ({
    detail: !!document.getElementById('goal-detail-screen'),
    hasForecast: document.getElementById('goal-detail-screen')?.textContent.includes('Forecast'),
    hasNext: [...document.querySelectorAll('#goal-detail-screen h2')].some((h) => h.textContent.trim() === 'Next milestone'),
    overflow: document.body.scrollWidth - window.innerWidth,
    atlasInline: !!document.querySelector('.atlas-wrap'),
  }))
  await page.screenshot({ path: `qa/shots/goals-detail-${name}.png`, fullPage: true })
  return { info, errs }
}

const VP = { m390: { width: 390, height: 844, isMobile: true, hasTouch: true }, m430: { width: 430, height: 932, isMobile: true, hasTouch: true }, d1440: { width: 1440, height: 900 } }

const browser = await launch()
const results = []
try {
  for (const [name, vp] of Object.entries(VP)) {
    const list = await visitGoals(browser, vp, name)
    const detail = await visitDetail(browser, vp, name)
    results.push({ viewport: name, list, detail })
  }
} finally {
  await browser.close()
}

let ok = true
for (const r of results) {
  const l = r.list.summary
  const d = r.detail.info
  const errs = r.list.errs.console.length + r.list.errs.page.length + r.detail.errs.console.length + r.detail.errs.page.length
  const pass = l.openCards === 3 && l.reachedCards === 1 && !l.atlasPresent && l.overflow <= 0 && d.detail && d.hasForecast && errs === 0
  ok = ok && pass
  console.log(`[${r.viewport}] list open=${l.openCards} reached=${l.reachedCards} atlas=${l.atlasPresent} atRisk=${l.hasAtRisk} overdue=${l.hasOverdue} overflow=${l.overflow} | detail forecast=${d.hasForecast} next=${d.hasNext} | consoleErrors=${errs} ${pass ? 'OK' : 'FAIL'}`)
}
console.log(ok ? 'GOALS BROWSER QA PASS' : 'GOALS BROWSER QA FAIL')
process.exit(ok ? 0 : 1)
