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
    localStorage.setItem('aaru.habits.v4', JSON.stringify(s))
  }, state)
}

/** Seed storage deterministically, then load the app fresh at a route.
 *  The seed is injected before any app script runs (no stale-app writes),
 *  and the injection is removed so later reloads test real persistence. */
export async function seedAndGoto(page, state, route, base = 'http://localhost:4173') {
  const handle = await page.evaluateOnNewDocument((s) => {
    try {
      localStorage.clear()
      localStorage.setItem('aaru.habits.v4', JSON.stringify(s))
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

/**
 * v4 fixture: habits + check-ins + moods from seededState(), plus a real
 * work layer (projects, assignments, routines) with deadlines that land
 * around *today* so statuses, countdowns and workload bars are meaningful.
 * QA fixture only — the shipped app never invents data.
 */
export function seededStateV4() {
  const base = seededState()
  const shift = (n) => {
    const d = new Date()
    d.setDate(d.getDate() + n)
    return dayStr(d)
  }
  const at = (n, hhmm = '23:59') => `${shift(n)}T${hhmm}`

  const task = (id, name, done, over = {}) => ({
    id, name, done, status: done ? 'done' : 'todo',
    completedAt: done ? at(-3, '10:00') : null, due: null, priority: 'normal',
    estimateMin: null, actualMin: null, notes: '', order: 0, ...over,
  })

  // richer mind entries: capacity + a few reflections
  const moods = { ...base.moods }
  for (let i = 1; i <= 21; i++) {
    const d = subDays(i)
    if (!moods[d]) continue
    moods[d] = {
      ...moods[d],
      energy: 2 + ((i * 5) % 4),
      focus: 2 + ((i * 3) % 4),
      motivation: 1 + ((i * 7) % 5),
    }
  }
  moods[subDays(2)] = { ...(moods[subDays(2)] || { score: 4 }), note: 'Two deep-work blocks before lunch.', wentWell: 'Finished the AVL implementation and walked after lunch.', difficult: 'Evening got away from me — phone in the room.' }
  moods[subDays(6)] = { ...(moods[subDays(6)] || { score: 3 }), wentWell: 'Submitted the physics set a day early.', difficult: 'Slept badly, morning run skipped.' }
  moods[subDays(11)] = { ...(moods[subDays(11)] || { score: 2 }), wentWell: 'Kept the guitar streak alive.', difficult: 'Three back-to-back meetings ate the afternoon.' }

  const projects = [
    {
      id: 'p1', name: 'Portfolio site', description: 'A tight portfolio: three case studies, no filler.',
      category: 'Design', priority: 'normal', startDate: shift(-40), deadline: at(12, '18:00'),
      milestones: [
        { id: 'm1', name: 'Design', due: shift(-20), tasks: [task('t1', 'Pick typeface', true), task('t2', 'Hero section', true)] },
        { id: 'm2', name: 'Build', due: shift(6), tasks: [task('t3', 'Set up repo', true), task('t4', 'Case studies', false), task('t5', 'Deploy', false)] },
      ],
      linkedHabitIds: ['h-guitar'], notes: 'Keep the copy short. Ship before it feels ready.',
      estimateMin: 1200, actualMin: 540,
      progressLog: [
        { at: at(-30, '10:00'), pct: 10 }, { at: at(-21, '10:00'), pct: 25 },
        { at: at(-12, '10:00'), pct: 40 }, { at: at(-5, '10:00'), pct: 60 },
      ],
      createdAt: at(-40, '09:00'), createdAtDay: shift(-40), completedAt: null, archived: false, order: 0,
    },
    {
      id: 'p2', name: 'Thesis — chapter 3', description: 'Methods and results, 8,000 words.',
      category: 'Learning', priority: 'high', startDate: shift(-20), deadline: at(2, '23:59'),
      milestones: [
        { id: 'm3', name: 'Research', due: shift(-8), tasks: [task('t6', 'Source list', true), task('t7', 'Data cleaning', true)] },
        { id: 'm4', name: 'Drafting', due: shift(1), tasks: [task('t8', 'Methods section', false), task('t9', 'Results section', false), task('t10', 'Figures', false)] },
        { id: 'm5', name: 'Review', due: shift(2), tasks: [task('t11', 'Supervisor pass', false), task('t12', 'References', false), task('t13', 'Final read', false)] },
      ],
      linkedHabitIds: ['h-read'], notes: '', estimateMin: 900, actualMin: 260,
      progressLog: [{ at: at(-18, '11:00'), pct: 5 }, { at: at(-9, '11:00'), pct: 15 }, { at: at(-3, '11:00'), pct: 25 }],
      createdAt: at(-20, '09:00'), createdAtDay: shift(-20), completedAt: null, archived: false, order: 1,
    },
    {
      id: 'p3', name: 'Kitchen rebuild', description: 'Sand, repaint, replace the worktop.',
      category: 'Home', priority: 'low', startDate: shift(-60), deadline: at(-5, '18:00'),
      milestones: [
        { id: 'm6', name: 'Prep', tasks: [task('t14', 'Clear the room', true), task('t15', 'Sand the units', true)] },
        { id: 'm7', name: 'Finish', tasks: [task('t16', 'Two coats', true), task('t17', 'Fit worktop', true)] },
      ],
      linkedHabitIds: [], notes: '', estimateMin: 600, actualMin: 720,
      progressLog: [{ at: at(-40, '09:00'), pct: 20 }, { at: at(-20, '09:00'), pct: 60 }, { at: at(-6, '16:00'), pct: 100 }],
      createdAt: at(-60, '09:00'), createdAtDay: shift(-60), completedAt: at(-6, '16:00'), archived: false, order: 2,
    },
  ]

  const assignments = [
    {
      id: 'a1', name: 'DS Lab 3', subject: 'Data Structures', description: 'AVL tree with rotation tests.',
      priority: 'high', assignedDate: shift(-6), deadline: at(0, '23:59'),
      progressMode: 'subtasks', progress: 75,
      subtasks: [
        { id: 's1', name: 'Read the brief', done: true }, { id: 's2', name: 'Implement AVL tree', done: true },
        { id: 's3', name: 'Write rotation tests', done: true }, { id: 's4', name: 'Package submission', done: false },
      ],
      projectId: null, notes: 'Submit through the portal, not email.', estimateMin: 240, actualMin: 150,
      progressLog: [{ at: at(-5, '14:00'), pct: 25 }, { at: at(-3, '14:00'), pct: 50 }, { at: at(-1, '20:00'), pct: 75 }],
      createdAt: at(-6, '09:00'), createdAtDay: shift(-6), completedAt: null, archived: false, order: 0,
    },
    {
      id: 'a2', name: 'Physics problem set 7', subject: 'Physics', description: 'Rotational dynamics, 6 problems.',
      priority: 'normal', assignedDate: shift(-4), deadline: at(2, '18:00'),
      progressMode: 'explicit', progress: 40, subtasks: [], projectId: null, notes: '',
      estimateMin: 120, actualMin: 45,
      progressLog: [{ at: at(-3, '16:00'), pct: 10 }, { at: at(-1, '16:00'), pct: 40 }],
      createdAt: at(-4, '09:00'), createdAtDay: shift(-4), completedAt: null, archived: false, order: 1,
    },
    {
      id: 'a3', name: 'Literature matrix', subject: 'Research methods', description: '30 papers, coded by method.',
      priority: 'low', assignedDate: shift(-10), deadline: at(6, '23:59'),
      progressMode: 'explicit', progress: 20, subtasks: [], projectId: 'p2', notes: 'Feeds chapter 3 directly.',
      estimateMin: 180, actualMin: 40,
      progressLog: [{ at: at(-8, '12:00'), pct: 5 }, { at: at(-4, '12:00'), pct: 20 }],
      createdAt: at(-10, '09:00'), createdAtDay: shift(-10), completedAt: null, archived: false, order: 2,
    },
    {
      id: 'a4', name: 'Essay — cognitive load', subject: 'Psychology', description: '1,500 words with 8 sources.',
      priority: 'high', assignedDate: shift(-12), deadline: at(-2, '23:59'),
      progressMode: 'explicit', progress: 60, subtasks: [], projectId: null, notes: 'Extension requested.',
      estimateMin: 200, actualMin: 90,
      progressLog: [{ at: at(-10, '10:00'), pct: 20 }, { at: at(-6, '10:00'), pct: 45 }, { at: at(-3, '10:00'), pct: 60 }],
      createdAt: at(-12, '09:00'), createdAtDay: shift(-12), completedAt: null, archived: false, order: 3,
    },
    {
      id: 'a5', name: 'Statistics quiz prep', subject: 'Statistics', description: '',
      priority: 'normal', assignedDate: shift(-5), deadline: at(-1, '09:00'),
      progressMode: 'explicit', progress: 100, subtasks: [], projectId: null, notes: '',
      estimateMin: 60, actualMin: 55, progressLog: [{ at: at(-2, '18:00'), pct: 60 }, { at: at(-1, '08:00'), pct: 100 }],
      createdAt: at(-5, '09:00'), createdAtDay: shift(-5), completedAt: at(-1, '08:30'), archived: false, order: 4,
    },
  ]

  const routines = [
    { id: 'r1', name: 'Morning reset', kind: 'morning', habitIds: ['h-med', 'h-water', 'h-run'], active: true, order: 0, createdAt: shift(-30) },
    { id: 'r2', name: 'Wind down', kind: 'night', habitIds: ['h-read'], active: true, order: 1, createdAt: shift(-30) },
  ]

  // Goals — the outcome layer, linked down to real habits and projects.
  const goals = [
    {
      id: 'g-run', title: 'Run a half marathon', area: 'fitness',
      why: 'For the version of me who finishes things.',
      startDate: shift(-60), targetDate: shift(45),
      status: 'active', archived: false, order: 0,
      milestones: [
        { id: 'gm1', name: 'Comfortable at 10k', targetDate: shift(-30), done: true, doneAt: at(-30, '09:00'), order: 0 },
        { id: 'gm2', name: '16km long run', targetDate: shift(10), done: false, doneAt: null, order: 1 },
        { id: 'gm3', name: 'Race day', targetDate: shift(45), done: false, doneAt: null, order: 2 },
      ],
      linkedHabitIds: ['h-run'], linkedProjectIds: [], linkedAssignmentIds: [],
      manualPercent: null, notes: 'Keep the long run easy.',
      createdAt: at(-60, '09:00'), updatedAt: at(-1, '09:00'), completedAt: null,
    },
    {
      id: 'g-thesis', title: 'Finish the thesis', area: 'learning',
      why: 'It has been open long enough.',
      startDate: shift(-20), targetDate: shift(2),
      status: 'active', archived: false, order: 1,
      milestones: [
        { id: 'gm4', name: 'Methods section', targetDate: shift(1), done: false, doneAt: null, order: 0 },
        { id: 'gm5', name: 'Results and figures', targetDate: shift(2), done: false, doneAt: null, order: 1 },
      ],
      linkedHabitIds: ['h-read'], linkedProjectIds: ['p2'], linkedAssignmentIds: [],
      manualPercent: null, notes: '',
      createdAt: at(-20, '09:00'), updatedAt: at(-1, '09:00'), completedAt: null,
    },
    {
      id: 'g-guitar', title: 'Play three songs end to end', area: 'creative',
      why: 'Something that is only mine.',
      startDate: shift(-90), targetDate: shift(-5),
      status: 'active', archived: false, order: 2,
      milestones: [{ id: 'gm6', name: 'Clean chord changes', targetDate: shift(-10), done: false, doneAt: null, order: 0 }],
      linkedHabitIds: ['h-guitar'], linkedProjectIds: [], linkedAssignmentIds: [],
      manualPercent: null, notes: '',
      createdAt: at(-90, '09:00'), updatedAt: at(-2, '09:00'), completedAt: null,
    },
    {
      id: 'g-sleep', title: 'Sleep before midnight for a month', area: 'health',
      why: 'Everything is easier on eight hours.',
      startDate: shift(-40), targetDate: shift(-12),
      status: 'completed', archived: false, order: 3,
      milestones: [{ id: 'gm7', name: 'Fourteen days', targetDate: shift(-25), done: true, doneAt: at(-25, '22:00'), order: 0 }],
      linkedHabitIds: ['h-water'], linkedProjectIds: [], linkedAssignmentIds: [],
      manualPercent: null, notes: '',
      createdAt: at(-40, '09:00'), updatedAt: at(-12, '09:00'), completedAt: at(-12, '22:30'),
    },
  ]

  return {
    version: 4,
    profile: { ...base.profile, workReminders: true, workReminderHours: 24 },
    habits: base.habits,
    checkins: base.checkins,
    routines,
    projects,
    assignments,
    goals,
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
