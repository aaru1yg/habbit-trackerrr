/* Visual QA: seeds realistic data, screenshots every screen. */
import { mkdirSync, writeFileSync } from 'fs'
import { launch, VIEWPORTS } from './helpers.mjs'

const BASE = process.env.QA_BASE || 'http://localhost:5173/'
const OUT = 'qa/shots'
mkdirSync(OUT, { recursive: true })

const day = (n = 0) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }

function seed() {
  const habits = [
    { id: 'h1', name: 'Read 20 pages', icon: '📖', category: 'mind', target: { type: 'done', goal: 1, unit: '' }, cadence: { type: 'daily' }, cue: 'After morning coffee', notes: '', createdAt: null, archivedAt: null, order: 0 },
    { id: 'h2', name: 'Drink water', icon: '💧', category: 'body', target: { type: 'count', goal: 8, unit: 'glasses' }, cadence: { type: 'daily' }, cue: 'Bottle on the desk', notes: '', createdAt: null, archivedAt: null, order: 1 },
    { id: 'h3', name: 'Deep work', icon: '💻', category: 'craft', target: { type: 'minutes', goal: 90, unit: 'min' }, cadence: { type: 'days', days: [1,2,3,4,5] }, cue: '9am, phone in a drawer', notes: '', createdAt: null, archivedAt: null, order: 2 },
    { id: 'h4', name: 'Gym', icon: '💪', category: 'body', target: { type: 'done', goal: 1, unit: '' }, cadence: { type: 'weekly', perWeek: 3 }, cue: '', notes: '', createdAt: null, archivedAt: null, order: 3 },
    { id: 'h5', name: 'Call someone', icon: '🤝', category: 'social', target: { type: 'done', goal: 1, unit: '' }, cadence: { type: 'days', days: [0, 3] }, cue: '', notes: '', createdAt: null, archivedAt: null, order: 4 },
  ]
  const checkins = {}
  const moods = {}
  for (let i = 0; i < 150; i++) {
    const d = day(-i)
    const dow = new Date(d).getDay()
    const roll = (p) => Math.random() < p
    if (roll(0.78 - i * 0.0012)) checkins.h1 = { ...(checkins.h1 || {}), [d]: { value: 1, at: `${d}T08:12` } }
    const g = Math.round(3 + Math.random() * 5)
    if (roll(0.85)) checkins.h2 = { ...(checkins.h2 || {}), [d]: { value: g, at: `${d}T20:00` } }
    if (dow >= 1 && dow <= 5 && roll(0.66)) checkins.h3 = { ...(checkins.h3 || {}), [d]: { value: 60 + Math.round(Math.random() * 60), at: `${d}T11:00` } }
    if (roll(0.4)) checkins.h4 = { ...(checkins.h4 || {}), [d]: { value: 1, at: `${d}T18:30` } }
    if ((dow === 0 || dow === 3) && roll(0.55)) checkins.h5 = { ...(checkins.h5 || {}), [d]: { value: 1, at: `${d}T19:00` } }
    if (i < 70 && roll(0.7)) moods[d] = { mood: Math.max(1, Math.min(5, Math.round(2 + Math.random() * 3))), energy: null, note: '' }
  }
  delete checkins.h3?.[day(0)]

  const work = [
    { id: 'w1', kind: 'project', title: 'Dissertation — chapter 3', notes: 'Methods + results.', deadline: `${day(9)}T18:00`, startedAt: day(-40), tasks: [
      { id: 't1', title: 'Outline', done: true, due: null, doneAt: `${day(-30)}T12:00` },
      { id: 't2', title: 'Draft methods', done: true, due: null, doneAt: `${day(-14)}T12:00` },
      { id: 't3', title: 'Run the analysis', done: true, due: null, doneAt: `${day(-6)}T12:00` },
      { id: 't4', title: 'Write results', done: false, due: day(4), doneAt: null },
      { id: 't5', title: 'Supervisor review', done: false, due: day(8), doneAt: null },
    ], manual: null, goalId: 'g1', log: [
      { at: `${day(-6)}T14:00`, percent: null, minutes: 180, note: '' },
      { at: `${day(-3)}T10:00`, percent: null, minutes: 120, note: '' },
      { at: `${day(-1)}T16:00`, percent: null, minutes: 95, note: '' },
    ], createdAt: day(-40), doneAt: null, archivedAt: null, order: 0 },
    { id: 'w2', kind: 'task', title: 'Renew the passport', notes: '', deadline: `${day(-1)}T17:00`, startedAt: day(-20), tasks: [], manual: 40, goalId: null, log: [], createdAt: day(-20), doneAt: null, archivedAt: null, order: 1 },
    { id: 'w3', kind: 'task', title: 'Submit grant form', notes: '', deadline: `${day(0)}T22:00`, startedAt: day(-5), tasks: [], manual: 75, goalId: null, log: [], createdAt: day(-5), doneAt: null, archivedAt: null, order: 2 },
    { id: 'w4', kind: 'project', title: 'Half-marathon training block', notes: '', deadline: `${day(46)}T09:00`, startedAt: day(-14), tasks: [
      { id: 't6', title: 'Base weeks', done: true, due: null, doneAt: `${day(-2)}T12:00` },
      { id: 't7', title: 'Tempo block', done: false, due: null, doneAt: null },
      { id: 't8', title: 'Taper', done: false, due: null, doneAt: null },
    ], manual: null, goalId: 'g2', log: [], createdAt: day(-14), doneAt: null, archivedAt: null, order: 3 },
    { id: 'w5', kind: 'task', title: 'Fix the bike', notes: '', deadline: null, startedAt: day(-9), tasks: [], manual: 0, goalId: null, log: [], createdAt: day(-9), doneAt: null, archivedAt: null, order: 4 },
    { id: 'w6', kind: 'task', title: 'File the taxes', notes: '', deadline: `${day(-12)}T18:00`, startedAt: day(-30), tasks: [], manual: 100, goalId: null, log: [], createdAt: day(-30), doneAt: `${day(-13)}T15:00`, archivedAt: null, order: 5 },
  ]

  const goals = [
    { id: 'g1', title: 'Submit the thesis by spring', why: 'So I can start the job in April without this hanging over me.', due: day(120), habitIds: ['h1', 'h3'], createdAt: day(-60), doneAt: null, order: 0 },
    { id: 'g2', title: 'Run a half marathon', why: '', due: day(46), habitIds: ['h4'], createdAt: day(-30), doneAt: null, order: 1 },
  ]

  return { version: 5, profile: { name: 'Aaru', onboarded: true, theme: 'midnight', motion: 'full', weekStart: 1, lastExport: null }, habits, checkins, work, goals, moods }
}

const SHOTS = [
  ['today', '#/today'],
  ['habits', '#/habits'],
  ['habit-detail', '#/habit/h1'],
  ['work', '#/work'],
  ['work-detail', '#/work/w1'],
  ['goals', '#/goals'],
  ['goal-detail', '#/goal/g1'],
  ['insights', '#/insights'],
  ['settings', '#/settings'],
]

const browser = await launch()
const errors = []

for (const [vp, dims] of Object.entries(VIEWPORTS)) {
  const page = await browser.newPage()
  await page.setViewport(dims)
  page.on('pageerror', (e) => errors.push(`${vp}: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${vp} console: ${m.text()}`) })

  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  const data = seed()
  await page.evaluate((d) => localStorage.setItem('aaru.os.v5', JSON.stringify(d)), data)

  for (const [name, hash] of SHOTS) {
    if (vp === 'mobile' && !['today', 'habits', 'work', 'insights'].includes(name)) continue
    // Full document load each time: a hash-only change would reuse the
    // already-booted store and skip the route's first-paint path.
    await page.goto('about:blank')
    await page.goto(BASE + hash, { waitUntil: 'networkidle0' })
    await new Promise((r) => setTimeout(r, 1400))
    await page.screenshot({ path: `${OUT}/${vp}-${name}.png`, fullPage: vp === 'desktop' })
  }
  await page.close()
}

await browser.close()
writeFileSync(`${OUT}/errors.json`, JSON.stringify(errors, null, 2))
console.log(errors.length ? `❌ ${errors.length} errors:\n` + errors.slice(0, 20).join('\n') : '✅ no runtime errors')
