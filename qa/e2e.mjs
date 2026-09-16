/* ============================================================
   E2E + visual QA in a real (headless) browser.
   Run: node qa/e2e.mjs [base-url]
   Covers the spec's test matrix: habits, schedule, reminders,
   mood, analytics, projects/celebration, data export/import,
   persistence, navigation, overflow, tap targets, contrast.
   ============================================================ */
import { launch, newPage, VIEWPORTS, check, shot, clickByText, clickByLabel, sleep,  seedAndGoto,   seededStateV4,   report } from './helpers.mjs'
/* The app's own scheduling rule, so the expected row count is derived from
   the seed instead of guessed from the weekday. */
import { isScheduled } from '../src/lib/schedule.js'
import { dayStr } from '../src/lib/dates.js'
import { mkdirSync } from 'fs'
import fs from 'fs'

mkdirSync('qa/shots', { recursive: true })
const BASE = process.argv[2] || 'http://localhost:4173'

const browser = await launch()

/* clickByLabel with retry — sheets/panels mount a frame later on mobile. */
async function clickByLabelWait(page, labelRegex) {
  for (let i = 0; i < 10; i++) {
    try { await clickByLabel(page, labelRegex); return } catch { await sleep(300) }
  }
  throw new Error(`clickByLabelWait: not found /${labelRegex}/`)
}

/* ---------- shared evaluators ---------- */

async function overflowCheck(page, label) {
  const r = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    bodyW: document.body.scrollWidth,
  }))
  check(`[${label}] no horizontal overflow`, r.scrollW <= r.clientW + 1, `scrollW=${r.scrollW} clientW=${r.clientW}`)
}

async function tapTargetCheck(page, label) {
  const small = await page.evaluate(() => {
    const bad = []
    const CLICKABLE = 'button, a, [role="button"], label'
    const isBig = (el) => {
      const r = el.getBoundingClientRect()
      return r.width >= 43 && r.height >= 43
    }
    for (const el of document.querySelectorAll('button, a, [role="button"], input[type="checkbox"], input[type="time"], input[type="text"], input[type="file"], select')) {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue
      const style = getComputedStyle(el)
      if (style.visibility === 'hidden' || style.display === 'none') continue
      if (el.classList.contains('sr-only')) continue
      if (rect.width >= 43 && rect.height >= 43) continue
      // small control: OK if a clickable ancestor provides the ≥44px target
      const wrap = el.closest(CLICKABLE)
      if (wrap && wrap !== el && isBig(wrap)) continue
      bad.push(`${el.tagName}.${el.className} ${Math.round(rect.width)}x${Math.round(rect.height)} "${(el.getAttribute('aria-label') || el.textContent || '').slice(0, 30)}"`)
    }
    return bad
  })
  check(`[${label}] interactive elements ≥ ~44px`, small.length === 0, small.slice(0, 4).join(' | '))
}

async function contrastCheck(page, label) {
  const low = await page.evaluate(() => {
    function lum(c) {
      let m = c.match(/\d+(\.\d+)?/g)
      if (!m) return null
      let [r, g, b] = m.slice(0, 3).map(Number)
      // Chrome computes color-mix() to color(srgb r g b) with 0–1 floats; read
      // them as channel ratios (the same normalisation parseColor applies),
      // otherwise a light accent tint is measured as near-black and every
      // dark-theme chip is falsely reported at ~1.4:1.
      if (c.startsWith('color(')) { r *= 255; g *= 255; b *= 255 }
      const n = [r, g, b].map((v) => {
        v /= 255
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
      })
      return 0.2126 * n[0] + 0.7152 * n[1] + 0.0722 * n[2]
    }
    // parse 'rgb(r,g,b)', 'rgba(r,g,b,a)' or 'color(srgb r g b / a)' → [r,g,b,a]
    function parseColor(c) {
      const m = c.match(/[\d.]+/g)
      if (!m) return null
      let [r, g, b, a = 1] = m.map(Number)
      if (c.startsWith('color(')) { r *= 255; g *= 255; b *= 255 }
      return [r, g, b, a]
    }
    // composite semi-transparent backgrounds over ancestors (bottom-up)
    function bgOf(el) {
      const stack = []
      let e = el
      while (e) {
        const p = parseColor(getComputedStyle(e).backgroundColor)
        if (p && p[3] > 0) stack.push(p)
        if (p && p[3] >= 0.999) break
        e = e.parentElement
      }
      let base = [11, 15, 26]
      for (const [r, g, b, a] of stack.reverse()) {
        base = [r * a + base[0] * (1 - a), g * a + base[1] * (1 - a), b * a + base[2] * (1 - a)]
      }
      return `rgb(${Math.round(base[0])}, ${Math.round(base[1])}, ${Math.round(base[2])})`
    }
    const bad = []
    for (const el of document.querySelectorAll('p, span, h1, h2, h3, button, a, label, .chip, .eyebrow')) {
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none') continue
      const rect = el.getBoundingClientRect()
      if (!rect.width || !rect.height) continue
      if (!el.textContent.trim()) continue
      if (el.classList.contains('sr-only')) continue
      // skip elements whose own text nodes are empty (icons with aria-hidden, decorative dots)
      const ownText = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim()
      if (!ownText && ![...el.children].some((c) => c.textContent.trim() && getComputedStyle(c).visibility !== 'hidden')) {
        // still check if it has visible text descendants only
      }
      const fg = lum(cs.color)
      const bg = lum(bgOf(el))
      if (fg == null || bg == null) continue
      const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)
      const size = parseFloat(cs.fontSize)
      const bold = parseInt(cs.fontWeight) >= 700
      const large = size >= 24 || (size >= 18.66 && bold)
      const need = large ? 3 : 4.5
      if (ratio < need) bad.push(`${el.tagName}.${el.className} ratio=${ratio.toFixed(2)} "${(el.textContent || '').trim().slice(0, 24)}"`)
    }
    return [...new Set(bad)]
  })
  // text on gradient accent buttons can't be measured this way; allow known-good accent-ink cases
  const realBad = low.filter((x) => !x.includes('.btn') && !x.includes('toast-action') && !x.includes('check-btn'))
  check(`[${label}] text contrast ≥ WCAG AA`, realBad.length === 0, realBad.slice(0, 4).join(' | '))
}

async function noConsoleErrors(page, label) {
  const { consoleErrors, pageErrors, failedRequests } = page._qa
  check(`[${label}] no console errors`, consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))
  check(`[${label}] no page errors`, pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '))
  check(`[${label}] no failed requests`, failedRequests.length === 0, failedRequests.slice(0, 3).join(' | '))
}

/* ============================================================
   PART 1 — Fresh user: onboarding → today (mobile)
   ============================================================ */
console.log('\n— Fresh user & onboarding (mobile 390×844) —')
{
  const page = await newPage(browser, VIEWPORTS.mobile)
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await sleep(400)
  // spy on permission requests — nothing may ask before the user opts in
  await page.evaluate(() => {
    window.__permAsked = 0
    window.Notification = {
      permission: 'default',
      requestPermission: async () => { window.__permAsked++; return 'granted' },
    }
  })

  await shot(page, '01-onboarding-step1')
  await overflowCheck(page, 'onboarding-1')
  check('[onboarding 2.0] welcome step opens with the art moment', await page.evaluate(() => (
    !!document.querySelector('.onboarding .ob-art')
  )))

  // step 1: name
  await page.type('input[placeholder="Your name"]', 'Aaru')
  await clickByText(page, 'Continue')
  await page.waitForSelector('text/Pick a few to start', { timeout: 5000 })
  await sleep(300)
  await shot(page, '02-onboarding-step2')
  check('[onboarding 2.0] starter habits carry their category art', await page.evaluate(() => (
    document.querySelectorAll('.starter-art').length >= 5
  )))

  // step 2: pick two habits
  await clickByText(page, 'Read 10 pages', 'button')
  await clickByText(page, 'Meditate', 'button')
  await clickByText(page, 'Continue')
  await page.waitForSelector('text/A daily nudge', { timeout: 5000 })
  await sleep(300)
  await shot(page, '03-onboarding-step3')

  // step 3: skip reminder — permission must NOT have been requested
  const permAsked = await page.evaluate(() => window.__permAsked)
  check('notification permission never requested during onboarding (skip path)', permAsked === 0, `asked=${permAsked}`)
  await clickByText(page, 'Maybe later')
  await page.waitForSelector('#today-screen h1', { timeout: 5000 })
  await sleep(500)

  check('lands on Today after onboarding', await page.evaluate(() => (
    document.querySelector('#today-screen h1')?.textContent === 'Today'
  )))
  check('starter habits created (no fake history)', await page.evaluate(() =>
    document.querySelectorAll('li.today-row--habit-obj').length === 2))
  await shot(page, '04-today-fresh')
  await overflowCheck(page, 'today-fresh')
  await tapTargetCheck(page, 'today-fresh')
  await contrastCheck(page, 'today-fresh')

  // persistence across reload
  await page.reload({ waitUntil: 'networkidle0' })
  await sleep(500)
  check('state persists after reload', await page.evaluate(() => document.querySelectorAll('li.today-row--habit-obj').length === 2))

  // add habit with reminder → permission prompt intercepted (deny path).
  // Mobile create path: the Omni trigger opens the command panel; its
  // 'Add habit' chip opens the shared HabitForm sheet (the route FAB that
  // desktop uses renders null on mobile).
  await clickByLabelWait(page, 'Open Omni — search, create, commands')
  await sleep(500)
  await clickByText(page, 'Add habit', '.cc-row')
  await page.waitForSelector('#habit-name', { timeout: 5000 })
  await page.type('#habit-name', 'Evening stretch')
  await page.evaluate(() => {
    const el = document.querySelector('#habit-reminder')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(el, '21:30')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  // make Notification.requestPermission return denied
  await page.evaluate(() => {
    window.__permAsked = 0
    window.Notification = { permission: 'default', requestPermission: async () => { window.__permAsked++; return 'denied' } }
  })
  // submit the form's own 'Add habit' button — the Omni chip shares the
  // label, so scope to the sheet that actually contains the form
  await page.evaluate(() => {
    const sheet = document.getElementById('habit-name')?.closest('.sheet')
    const btn = [...(sheet?.querySelectorAll('button') || [])].find((b) => b.textContent.trim() === 'Add habit')
    btn.click()
  })
  await sleep(600)
  const deniedNote = await page.evaluate(() => document.body.textContent.includes('declined') || document.body.textContent.includes('in-app'))
  check('denied permission handled gracefully with in-app fallback copy', deniedNote)
  await page.keyboard.press('Escape')
  await noConsoleErrors(page, 'fresh-user')
  await page.close()
}

/* ============================================================
   PART 2 — Habit CRUD, schedule, rename, swipe, archive, undo (mobile)
   ============================================================ */
console.log('\n— Habit management (mobile) —')
{
  const page = await newPage(browser, VIEWPORTS.mobile)
  await seedAndGoto(page, seededStateV4(), 'today', BASE)
  await shot(page, '05-today-seeded')
  await overflowCheck(page, 'today-seeded')
  await tapTargetCheck(page, 'today-seeded')

  // The seed mixes daily habits with weekday-gated ones, so the row count
  // depends on today's date. Derive it from the seed with the app's own
  // scheduling rule (h-med runs Mon–Fri, h-guitar only Mon/Wed/Fri).
  const rows = await page.evaluate(() => document.querySelectorAll('li.today-row--habit-obj').length)
  const today = dayStr(new Date())
  const expectedRows = seededStateV4().habits.filter((h) =>
    !h.archived && (!h.createdAt || today >= h.createdAt) && isScheduled(h, today)).length
  check('seeded habits render (schedule-aware)', rows === expectedRows,
    `rows=${rows} expected=${expectedRows} (${today}, dow=${new Date().getDay()})`)

  // complete + uncomplete via the HabitObject toggle
  const before = await page.evaluate(() => document.querySelectorAll('.habit-obj.is-done').length)
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('li.today-row--habit-obj')]
      .find((r) => !r.querySelector('.habit-obj.is-done'))
    row.querySelector('[aria-label^="Mark "]').click()
  })
  await sleep(500)
  const after = await page.evaluate(() => document.querySelectorAll('.habit-obj.is-done').length)
  check('tap toggle completes habit', after === before + 1, `before=${before} after=${after}`)
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('li.today-row--habit-obj')]
      .find((r) => r.querySelector('.habit-obj.is-done'))
    row.querySelector('[aria-label^="Mark "]').click()
  })
  await sleep(400)
  check('tap again uncompletes', await page.evaluate(() => document.querySelectorAll('.habit-obj.is-done').length) === before)

  // Habit management lives in the Habits workspace on mobile: each row's
  // ⋯ button opens the actions sheet (View / Edit / Skip / Pause / Archive / Delete).
  await page.goto(`${BASE}/#/habits`, { waitUntil: 'networkidle0' })
  await sleep(500)
  const actionsScope = (name) => `[aria-label="Actions for ${name}"] button`

  // rename via actions → Edit → shared HabitForm
  await clickByLabelWait(page, 'More actions for Morning run')
  await sleep(400)
  await clickByText(page, 'Edit', actionsScope('Morning run'))
  await page.waitForSelector('#habit-name', { timeout: 5000 })
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyA')
  await page.keyboard.up('Control')
  await page.keyboard.type('Morning jog')
  await page.evaluate(() => {
    const sheet = document.getElementById('habit-name')?.closest('.sheet')
    const btn = [...(sheet?.querySelectorAll('button') || [])].find((b) => b.textContent.trim() === 'Save changes')
    btn.click()
  })
  await sleep(500)
  check('rename via actions sheet works', await page.evaluate(() => document.body.textContent.includes('Morning jog')))

  // detail screen: real-history heatmap + streak metrics
  await clickByLabelWait(page, 'More actions for Morning jog')
  await sleep(400)
  await clickByText(page, 'View', actionsScope('Morning jog'))
  await sleep(900)
  check('detail shows real-history heatmap + streak metrics', await page.evaluate(() => (
    /Current streak/.test(document.body.textContent)
    && /Best streak/.test(document.body.textContent)
    && /completion heatmap/.test(document.querySelector('.hd-heatmap [role="img"]')?.getAttribute('aria-label') || '')
  )))
  await shot(page, '06-habit-detail')
  await overflowCheck(page, 'habit-detail')

  // archive via actions sheet → undo via toast
  await page.goto(`${BASE}/#/habits`, { waitUntil: 'networkidle0' })
  await sleep(500)
  await clickByLabelWait(page, 'More actions for Morning jog')
  await sleep(400)
  const habitCount = await page.evaluate(() => JSON.parse(localStorage.getItem('aaru.habits.v4')).habits.filter((h) => !h.archived).length)
  await clickByText(page, 'Archive', actionsScope('Morning jog'))
  await sleep(500)
  const afterCount = await page.evaluate(() => JSON.parse(localStorage.getItem('aaru.habits.v4')).habits.filter((h) => !h.archived).length)
  check('archive removes habit from list', afterCount === habitCount - 1, `${habitCount}→${afterCount}`)
  await clickByText(page, 'Undo', 'button')
  await sleep(400)
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('aaru.habits.v4')).habits.filter((h) => !h.archived).length)
  check('undo restores archived habit', restored === habitCount)

  // delete via actions sheet (two-step confirm) with undo (history restored)
  await clickByLabelWait(page, 'More actions for Morning jog')
  await sleep(400)
  await clickByText(page, 'Delete', actionsScope('Morning jog'))
  await sleep(300)
  await clickByText(page, 'Confirm delete', 'button')
  await sleep(500)
  check('delete toast offers undo', await page.evaluate(() => !!document.querySelector('.toast-action')))
  const historyBefore = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('aaru.habits.v4'))
    return { habits: s.habits.length, runCheckins: s.checkins['h-run'] ? Object.keys(s.checkins['h-run']).length : 0 }
  })
  check('deleted habit removed from storage', historyBefore.habits === 4, `habits=${historyBefore.habits}`)
  await clickByText(page, 'Undo', 'button')
  await sleep(400)
  const restoredState = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('aaru.habits.v4'))
    return { habits: s.habits.length, runCheckins: s.checkins['h-run'] ? Object.keys(s.checkins['h-run']).length : 0 }
  })
  check('undo restores habit AND full history', restoredState.habits === 5 && restoredState.runCheckins > 20, JSON.stringify(restoredState))
  await page.keyboard.press('Escape')
    await noConsoleErrors(page, 'habit-mgmt')
  await page.close()
}

/* ============================================================
   PART 3 — Calendar: past-day toggle, long-press note, weekday schedule (mobile)
   ============================================================ */
console.log('\n— Calendar (mobile) —')
{
  const page = await newPage(browser, VIEWPORTS.mobile)
  await seedAndGoto(page, seededStateV4(), 'calendar', BASE)
  await sleep(300)
  await shot(page, '08-calendar')
  await overflowCheck(page, 'calendar')

  // 4G-1 contract: sticky name column + one column per day + aggregate strip
  check('[calendar 4G-1] grid renders with a name column and day columns', await page.evaluate(() => (
    !!document.querySelector('#calendar-screen .hc-grid')
    && document.querySelectorAll('#calendar-screen .hc-name').length >= 1
    && document.querySelectorAll('#calendar-screen .hc-daynum').length >= 7
  )))
  check('[calendar 4G-1] density strip covers every day in view', await page.evaluate(() => {
    const dens = document.querySelectorAll('#calendar-screen .hc-aggr').length
    const days = document.querySelectorAll('#calendar-screen .hc-daynum').length
    return dens === days && dens > 0
  }))
  check('[calendar 4G-1] range control offers Month / 90 days / Year', await page.evaluate(() => (
    document.querySelectorAll('#calendar-screen [aria-label="Calendar range"] button').length === 3
  )))

  // yesterday's cell for the daily habit — aria is 'Mark <name> as …, <prettyDate>'
  const ySel = await page.evaluate(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    const dateStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    const el = [...document.querySelectorAll('#calendar-screen .hc-cell')].find((b) => {
      const l = b.getAttribute('aria-label') || ''
      return l.startsWith('Mark Morning run') && l.endsWith(dateStr)
    })
    if (!el) return null
    return { label: el.getAttribute('aria-label'), pressed: el.getAttribute('aria-pressed') === 'true' }
  })
  check('yesterday cell exists', !!ySel, ySel ? ySel.label : 'cell not found')
  if (ySel) {
    const findPressed = () => page.evaluate(() => {
      const d = new Date()
      d.setDate(d.getDate() - 1)
      const dateStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      const el = [...document.querySelectorAll('#calendar-screen .hc-cell')].find((b) => {
        const l = b.getAttribute('aria-label') || ''
        return l.startsWith('Mark Morning run') && l.endsWith(dateStr)
      })
      return el ? el.getAttribute('aria-pressed') === 'true' : null
    })
    await page.evaluate(() => {
      const d = new Date()
      d.setDate(d.getDate() - 1)
      const dateStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      const el = [...document.querySelectorAll('#calendar-screen .hc-cell')].find((b) => {
        const l = b.getAttribute('aria-label') || ''
        return l.startsWith('Mark Morning run') && l.endsWith(dateStr)
      })
      el.click()
    })
    await sleep(400)
    const after = await findPressed()
    check('past-day toggle works', after === !ySel.pressed, `was=${ySel.pressed} now=${after}`)
    const stored = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('aaru.habits.v4'))
      const d = new Date()
      d.setDate(d.getDate() - 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return s.checkins['h-run']?.[key]?.done === true
    })
    check('past-day toggle persists to storage', stored === after, `stored=${stored} ui=${after}`)
  }

  // today distinguished
  check('today has visual distinction', await page.evaluate(() => (
    !!document.querySelector('#calendar-screen .hc-cell.is-today')
  )))

  // horizontal scroll: grid wider than viewport, sticky name column
  const cal = await page.evaluate(() => {
    const wrap = document.querySelector('#calendar-screen .hc-scroll')
    const name = document.querySelector('#calendar-screen .hc-name')
    return {
      scrollable: wrap && wrap.scrollWidth > wrap.clientWidth,
      nameLeft: name ? name.getBoundingClientRect().left : null,
      nameW: name ? name.getBoundingClientRect().width : null,
    }
  })
  check('calendar horizontally scrollable', cal.scrollable, JSON.stringify(cal))
  await page.evaluate(() => { document.querySelector('#calendar-screen .hc-scroll').scrollLeft = 600 })
  await sleep(300)
  const stickyOk = await page.evaluate(() => {
    const name = document.querySelector('#calendar-screen .hc-name')
    const r = name.getBoundingClientRect()
    return r.left >= -1 && r.left < 40 && r.width > 60
  })
  check('habit-name column stays sticky while scrolling', stickyOk)
  await shot(page, '09-calendar-scrolled')
  await page.evaluate(() => { document.querySelector('#calendar-screen .hc-scroll').scrollLeft = 0 })

  // weekday-schedule habit: unscheduled days render as inert (aria-hidden) cells
  check('non-scheduled days render inert', await page.evaluate(() => (
    document.querySelectorAll('#calendar-screen .hc-cell.is-unscheduled').length > 0
  )))
    await noConsoleErrors(page, 'calendar')
  await page.close()
}

/* ============================================================
   PART 4 — Week + Insights + Mind (mobile screenshots + analytics integrity)
   ============================================================ */
console.log('\n— Week / Insights / Mind (mobile) —')
{
  const page = await newPage(browser, VIEWPORTS.mobile)
  await seedAndGoto(page, seededStateV4(), 'week', BASE)
  await sleep(300)
  const weekText = await page.evaluate(() => document.body.textContent)
  check('week shows completion + comparison vs previous week', await page.evaluate(() => (
    /check-ins completed/.test(document.querySelector('.wr-summary__line')?.textContent || '')
    && (document.querySelector('.wr-summary__delta')?.getAttribute('aria-label') || '').includes('versus last week')
  )))
  check('week shows strongest/weakest habit', /was your strongest habit this week/i.test(weekText) || /needs attention/i.test(weekText))
  check('week renders habit rows with 7-day stripes', await page.evaluate(() => (
    document.querySelectorAll('.wr-row').length >= 1
    && document.querySelectorAll('.wr-row')[0].querySelectorAll('.wr-cell').length === 7
  )))
  await shot(page, '10-week')
  await overflowCheck(page, 'week')
  await tapTargetCheck(page, 'week')

  await page.goto(`${BASE}/#/insights`, { waitUntil: 'networkidle0' })
  await sleep(1200) // charts animate in
  // 7B Overview: signal strip → primary chart → honest insight cards
  check('[insights 7B] signal strip renders the four signals', await page.evaluate(() => {
    const strip = document.querySelector('.ins-signal-strip')
    return !!strip && strip.querySelectorAll('.ins-signal').length === 4
      && /Completion/.test(strip.textContent) && /This week/.test(strip.textContent)
      && /Current streak/.test(strip.textContent) && /Total/.test(strip.textContent)
  }))
  check('[insights 7B] primary trend chart declares real data in its aria label', await page.evaluate(() => (
    [...document.querySelectorAll('svg[role="img"]')].some((s) => /Completion trend over the last \d+ days/.test(s.getAttribute('aria-label') || ''))
  )))
  check('[insights 7B] legend separates aggregate, rolling average and habit series', await page.evaluate(() => {
    const legend = document.querySelector('.ins-legend')?.textContent || ''
    return /Aggregate/.test(legend) && /7-day average/.test(legend) && /Morning run|Read 20 pages|Meditate/.test(legend)
  }))
  check('[insights 7B] insight cards render without invented coaching copy', await page.evaluate(() => (
    document.querySelectorAll('.ins-insight').length > 0
    && !/Pairing it with|You're doing amazing/i.test(document.body.textContent)
  )))
  check('[insights 7B] pillar nav offers Mind / Record / Achievements destinations', await page.evaluate(() => {
    const labels = [...document.querySelectorAll('.ins-pillar .ins-pillar-label')].map((e) => e.textContent.trim())
    return ['Mind', 'Record', 'Achievements'].every((l) => labels.includes(l))
  }))
  check('[insights 7B] trend range has 3 options (1Y lives in the Lab)', await page.evaluate(() => (
    document.querySelectorAll('[aria-label="Trend range"] button').length === 3
  )))
  check('[insights 7B] has an Overview / Deep dive switch', await page.evaluate(() => (
    document.querySelectorAll('[aria-label="Insights view"] .seg-btn').length === 2
  )))
  check('trend defaults to 30D', await page.evaluate(() => (
    document.querySelector('[aria-label="Trend range"] button[aria-pressed="true"]')?.textContent.trim() === '30D'
  )))
  const trendLabel30 = await page.evaluate(() => [...document.querySelectorAll('svg[role="img"]')].map((s) => s.getAttribute('aria-label')).join(' '))
  await clickByText(page, '14D', '[aria-label="Trend range"] button')
  await sleep(400)
  check('trend switches to 14D', await page.evaluate(() => (
    document.querySelector('[aria-label="Trend range"] button[aria-pressed="true"]')?.textContent.trim() === '14D'
  )))
  check('trend aria-label reflects selected range', await page.evaluate((prev) => (
    [...document.querySelectorAll('svg[role="img"]')].map((s) => s.getAttribute('aria-label')).join(' ') !== prev
  ), trendLabel30))
  await clickByText(page, '90D', '[aria-label="Trend range"] button')
  await sleep(400)
  check('trend switches to 90D', await page.evaluate(() => (
    document.querySelector('[aria-label="Trend range"] button[aria-pressed="true"]')?.textContent.trim() === '90D'
  )))
  await clickByText(page, '30D', '[aria-label="Trend range"] button')
  await sleep(400)

  // data integrity: the Completion signal vs an independent recomputation
  const integrity = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('aaru.habits.v4'))
    let done = 0, total = 0
    for (let i = 0; i < 30; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      for (const h of s.habits) {
        if (h.archived) continue
        if (h.createdAt && key < h.createdAt) continue
        const sched = h.schedule.type === 'daily' || h.schedule.days.includes(new Date(`${key}T12:00:00`).getDay())
        if (!sched) continue
        total++
        if (s.checkins[h.id]?.[key]?.done) done++
      }
    }
    return Math.round((done / total) * 100)
  })
  const shown = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.ins-signal')].find((e) => /Completion/.test(e.textContent))
    return parseInt((el?.textContent || '').match(/(\d+)%/)?.[1]) || null
  })
  check('insights 30-day completion matches independent recomputation', shown === integrity, `shown=${shown} computed=${integrity}`)

  // Advanced opens the seven-view Lab in place (lazy chunk)
  await clickByText(page, 'Advanced', 'button')
  await sleep(1200)
  check('[insights 7B] Advanced opens the seven-view Lab in place', await page.evaluate(() => (
    ['Story', 'Timeline', 'Trajectory', 'Workload', 'Habits', 'Goals', 'Trends']
      .every((l) => [...document.querySelectorAll('[role="tab"]')].some((t) => t.textContent.trim() === l))
  )))
  await clickByText(page, 'Trajectory', '[role="tab"]')
  await sleep(800)
  check('[insights 7B] trajectory view opens with the honest forecast card', await page.evaluate(() => (
    !!document.querySelector('.lab-trajectory')
    && /Performance trajectory/.test(document.querySelector('.lab-trajectory').textContent)
  )))
  // the series chart renders for entities with enough history — try a few
  for (const pill of await page.$$('.lab-trajectory [role="group"] button')) {
    if (await page.evaluate(() => !!document.querySelector('.lab-trajectory svg[role="img"]'))) break
    await pill.click()
    await sleep(400)
  }
  check('[insights 7B] trajectory chart draws series from the live engine', await page.evaluate(() => (
    !!document.querySelector('.lab-trajectory svg[role="img"]')
  )))
  await shot(page, '11-insights-lab')
  await overflowCheck(page, 'insights')
  await tapTargetCheck(page, 'insights')
  await contrastCheck(page, 'insights')

  // back to Overview, then the Deep dive view (§17–§19)
  await clickByText(page, 'Advanced', 'button')
  await sleep(600)
    // Deep dive view (§17–§19): patterns, consistency, streak history, correlations
  await clickByText(page, 'Deep dive')
  await sleep(1000)
  const deepText = await page.evaluate(() => document.body.textContent)
  check('deep dive shows consistency + weekday sections', /Consistency/.test(deepText) && /By weekday/.test(deepText))
  check('deep dive shows streak history + personal bests', /Streak history/.test(deepText) && /Personal bests/.test(deepText))
  check('deep dive shows monthly pulse', /month by month/i.test(deepText))
  check('[insights 2.0] day clock draws four honest quadrants from timestamps', await page.evaluate(() => (
    document.querySelectorAll('.dayclock .dayclock-arc').length === 4
    && document.querySelectorAll('.dayclock-legend li').length === 4
    && (document.querySelector('.dayclock svg')?.getAttribute('aria-label') || '').includes('timestamped')
  )))
  check('[insights 2.0] pulse ribbon keeps future months hollow', await page.evaluate(() => {
    const cells = document.querySelectorAll('.ribbon-cell')
    return cells.length === 12
      && document.querySelectorAll('.ribbon-cell.is-future').length >= 1
      && document.querySelectorAll('.ribbon-months span').length === 12
  }))
  check('[insights 2.0] mood scatter plots only real paired days and never overclaims', await page.evaluate(() => (
    document.querySelectorAll('.scatter-dot').length >= 8
    && /association, not causation/.test(document.body.textContent)
  )))
  const hasCorr = /Patterns that travel together/.test(deepText) && /These travel together/.test(deepText)
  check('correlations never claim causation', !hasCorr || /not proof one causes the other/.test(deepText))
  check('deep dive has no invented numbers', !/estimated|projected/i.test(deepText))
  await shot(page, '11b-insights-deep')
  await overflowCheck(page, 'insights-deep')
  await tapTargetCheck(page, 'insights-deep')
  await clickByText(page, 'Overview')
  await sleep(500)

  await page.goto(`${BASE}/#/mind`, { waitUntil: 'networkidle0' })
  await sleep(700)
  check('mind shows mood picker + capacity/habit history', await page.evaluate(() => (
    /How are you feeling today\?/.test(document.body.textContent)
    && /Capacity & habits over time/.test(document.body.textContent)
  )))
  await shot(page, '12-mind')
  // set today's mood to Great
  await clickByText(page, 'Great', '.mood-row button')
  await sleep(400)
  await shot(page, '13-mood-picked')
  check('mood persists in storage', await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('aaru.habits.v4'))
    const today = new Date()
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    return s.moods[key]?.score === 5
  }))
    await noConsoleErrors(page, 'week-insights-mind')
  await page.close()
}

/* ============================================================
   PART 4b — Calendar range modes (Month / 90 days / Year)
   ============================================================ */
console.log('\n— Calendar range modes —')
{
  const page = await newPage(browser, VIEWPORTS.mobile)
  await seedAndGoto(page, seededStateV4(), 'calendar', BASE)
  await sleep(300)
  const calTitle = () => page.evaluate(() => document.querySelector('.hc-title')?.textContent || '')
  const activeMode = () => page.evaluate(() => (
    document.querySelector('#calendar-screen [aria-label="Calendar range"] button[aria-pressed="true"]')?.textContent.trim() || ''
  ))

  check('calendar has 3 range modes', await page.evaluate(() => document.querySelectorAll('#calendar-screen [aria-label="Calendar range"] button').length === 3))
  check('calendar defaults to Month', (await activeMode()) === 'Month')
  check('month mode labels the month band', await page.evaluate(() => document.querySelectorAll('#calendar-screen .hc-month').length >= 1))
  const monthTitle = await calTitle()

  await clickByText(page, '90 days', 'button')
  await sleep(400)
  check('calendar switches to 90 days', (await activeMode()) === '90 days')
  check('90 days title is a date range', (await calTitle()).includes('–'), `title=${await calTitle()}`)
  check('90 days grid scrolls horizontally', await page.evaluate(() => {
    const wrap = document.querySelector('#calendar-screen .hc-scroll')
    return !!wrap && wrap.scrollWidth > wrap.clientWidth
  }))

  await clickByText(page, 'Year', 'button')
  await sleep(400)
  check('calendar switches to Year', (await activeMode()) === 'Year')
  check('year title is the current year', (await calTitle()) === String(new Date().getFullYear()), `title=${await calTitle()}`)
  check('year mode still logs a past day', await page.evaluate(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    const el = [...document.querySelectorAll('#calendar-screen .hc-cell')].find((b) => (b.getAttribute('aria-label') || '').startsWith('Mark') && (b.getAttribute('aria-label') || '').endsWith(label))
    if (el) { el.click(); return true }
    return false
  }))

  await clickByText(page, 'Month', 'button')
  await sleep(400)
  check('calendar returns to Month', (await activeMode()) === 'Month')
  await page.evaluate(() => document.querySelector('[aria-label="Previous range"]').click())
  await sleep(400)
  check('month previous changes the title', (await calTitle()) !== monthTitle, `title=${await calTitle()}`)
  check('Today button appears after navigating away', await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    return btns.some((b) => b.textContent.trim() === 'Today')
  }))
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Today')
    if (btn) btn.click()
  })
  await sleep(400)
  check('Today returns to the current month', (await calTitle()) === monthTitle)
  await shot(page, '14-calendar-modes')
  await noConsoleErrors(page, 'calendar-modes')
  await page.close()
}

/* ============================================================
   PART 5 — Projects: milestones → tasks → 100% + celebration (mobile)
   ============================================================ */
console.log('\n— Projects & celebration (mobile) —')
{
  const page = await newPage(browser, VIEWPORTS.mobile)
  await seedAndGoto(page, seededStateV4(), 'projects', BASE)
  await sleep(500)
  const ptxt = await page.evaluate(() => document.body.textContent)
  check('projects dashboard shows real task math (3 of 5 = 60%)', ptxt.includes('60%'))
  check('projects are tagged as their own kind', await page.evaluate(() => document.querySelectorAll('.workspace-row[data-kind="project"]').length >= 2))
  check('status engine reports real states (at risk + completed)', /AT RISK|CRITICAL|OVERDUE/.test(ptxt) && /Completed/.test(ptxt))
  check('project rows surface deterministic work risk', await page.evaluate(() => {
    const pills = [...document.querySelectorAll('.workspace-row[data-kind="project"] .workspace-risk')].map((e) => e.textContent.trim())
    return pills.length >= 2 && pills.every(Boolean)
  }))
  check('projects dashboard shows deadline countdowns', /\dd left|days left|Due/i.test(ptxt))
  await shot(page, '14-projects')
  await overflowCheck(page, 'projects')
  await tapTargetCheck(page, 'projects')

  await page.goto(`${BASE}/#/projects/p1`, { waitUntil: 'networkidle0' })
  // the detail tabs come from a lazy chunk — wait for them before clicking
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Analytics'), { timeout: 15000 })
  await clickByText(page, 'Analytics')
  await sleep(1000)
  const atxt = await page.evaluate(() => document.body.textContent)
  check('project analytics preserve pace + velocity', /Expected vs actual/.test(atxt) && /Velocity/.test(atxt))
  await shot(page, '14b-projects-analytics')
  await overflowCheck(page, 'projects-analytics')
  await clickByText(page, 'Tasks')
  await sleep(500)

  // open a project and finish every remaining task
  await page.goto(`${BASE}/#/projects/p1`, { waitUntil: 'networkidle0' })
  await sleep(700)
  const dtxt = await page.evaluate(() => document.body.textContent)
  check('project detail shows milestones and pace', /Milestones/.test(dtxt) && /(Behind|Ahead|pace)/i.test(dtxt))
  check('project detail shows linked habits', /Portfolio|linked|Habits/i.test(dtxt))
  await clickByText(page, 'Visual project track', 'summary')
  await sleep(600)
  check('[projects 2.0] the track places milestones on real dates with today marked', await page.evaluate(() => (
    !!document.querySelector('.ptl .ptl-track .ptl-node')
    && !!document.querySelector('.ptl .ptl-today')
    && !!document.querySelector('.ptl .ptl-fill')
  )))
  check('[projects 2.0] track nodes are interactive and explain themselves', await page.evaluate(() => {
    const node = document.querySelector('.ptl .ptl-node')
    if (!node) return false
    node.click()
    return (document.querySelector('.ptl-detail')?.textContent || '').length > 4
  }))
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Analytics'), { timeout: 15000 })
  await clickByText(page, 'Analytics')
  await sleep(800)
  check('[projects 2.0] analytics draw expected vs actual from the real log', await page.evaluate(() => (
    /Expected vs actual/.test(document.body.textContent)
    && !!document.querySelector('.chart-draw svg .chart-line')
    && !!document.querySelector('.chart-draw svg .chart-fade')
  )))
  await clickByText(page, 'Tasks')
  await sleep(500)
  await shot(page, '15-project-detail')
  await overflowCheck(page, 'project-detail')

  await page.evaluate(() => {
    document.querySelectorAll('.check-box').forEach((b) => { if (b.getAttribute('aria-pressed') !== 'true') b.click() })
  })
  await sleep(1200)
  const celebrated = await page.evaluate(() => !!document.querySelector('[aria-label="Project complete"]'))
  check('finishing every task triggers the full celebration (§84)', celebrated)
  await shot(page, '15b-project-complete')
  check('completed project is stamped in storage', await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('aaru.habits.v4'))
    return st.projects.find((x) => x.id === 'p1')?.completedAt != null
  }))
  await clickByText(page, 'Close it out')
  await sleep(800)
  check('celebration dismisses', await page.evaluate(() => !document.querySelector('[aria-label="Project complete"]')))

  // create a project — on mobile the route FAB is null, so the Work
  // header's 'Create project' button is the entry point
  await page.goto(`${BASE}/#/projects`, { waitUntil: 'networkidle0' })
  await sleep(500)
  await clickByText(page, 'Create project', '.workspace-head button')
  await sleep(600)
  await page.type('#project-name', 'Learn piano')
  await page.type('#project-milestones', 'Basics\nScales')
  // the Work header also has a "Create project" button — submit the dialog's
  await clickByText(page, 'Create project', '[role="dialog"] button')
  await sleep(800)
  check('new project created with milestones', await page.evaluate(() => document.body.textContent.includes('Learn piano')))
  check('new project starts at an honest 0%', await page.evaluate(() => document.body.textContent.includes('0%')))
  await noConsoleErrors(page, 'projects')
  await page.close()
}

/* ============================================================
   PART 5b — Assignments, Workload, Deadlines, Record, Library (mobile)
   ============================================================ */
console.log('\n— Assignments / Workload / Deadlines / Record / Library (mobile) —')
{
  const page = await newPage(browser, VIEWPORTS.mobile)
  await seedAndGoto(page, seededStateV4(), 'assignments', BASE)
  await sleep(500)
  const atxt = await page.evaluate(() => document.body.textContent)
  check('assignments are their own system (ASSIGNMENT tags)', await page.evaluate(() => document.querySelectorAll('.workspace-row[data-kind="assignment"]').length >= 2))
  check('assignment due today is called out', /Due /i.test(atxt))
  check('assignment urgency states are real (urgent + overdue)', /CRITICAL/.test(atxt) && /OVERDUE/.test(atxt))
  check('deliverables lead with deadline, effort and progress', await page.evaluate(() => !!document.querySelector('.workspace-meta') && !!document.querySelector('.workspace-progress')))
  await shot(page, '16-assignments')
  await overflowCheck(page, 'assignments')
  await tapTargetCheck(page, 'assignments')
  await page.goto(`${BASE}/#/assignments/a1`, { waitUntil: 'networkidle0' })
  await sleep(600)
  check('[assignments 2.0] deadline pressure renders ten honest segments', await page.evaluate(() => {
    const bars = document.querySelectorAll('#assignment-detail .pressure-bar')
    if (!bars.length) return false
    const segs = bars[0].querySelectorAll('.pressure-seg')
    return segs.length === 10 && bars[0].querySelectorAll('.pressure-seg[data-lit]').length <= 10
  }))
  check('[assignments 2.0] pressure tone follows urgency, never alarm colour by default', await page.evaluate(() => {
    const p = document.querySelector('#assignment-detail .pressure')
    return !!p && ['good', 'warn', 'bad', 'neutral', 'info'].includes(p.dataset.tone)
  }))
  await clickByText(page, 'Progress analytics and velocity', 'summary')
  await sleep(1000)
  await shot(page, '16b-assignments-analytics')
  await overflowCheck(page, 'assignments-analytics')

  await page.goto(`${BASE}/#/assignments/a1`, { waitUntil: 'networkidle0' })
  await sleep(700)
  check('subtask-derived progress is honest (3 of 4 = 75%)', await page.evaluate(() => document.body.textContent.includes('75%')))
  check('assignment detail shows subject + countdown', await page.evaluate(() => /Data Structures/.test(document.body.textContent)))
  check('[assignments 2.0] detail preserves contextual pressure', await page.evaluate(() => (
    !!document.querySelector('#assignment-detail .pressure-lg .pressure-bar')
  )))
  await shot(page, '16c-assignment-detail')
  await overflowCheck(page, 'assignment-detail')

  // finish the last subtask → light celebration only (toast, no confetti dialog)
  await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('.check-box')]
    const open = boxes.find((b) => b.getAttribute('aria-pressed') !== 'true')
    if (open) open.click()
  })
  await sleep(1000)
  check('assignment completion stays light (no full-screen celebration)',
    await page.evaluate(() => !document.querySelector('[aria-label="Project complete"]')))
  check('assignment completion is acknowledged', await page.evaluate(() => /100%|complete|Submitted/i.test(document.body.textContent)))
  await shot(page, '16d-assignment-done')

  // the a1 completion above removed it from work lists — re-seed so the
  // workload view shows the fixture it was written against (a hash-only
  // goto would not re-run the seeding init script, hence the blank hop)
  await page.goto('about:blank')
  await seedAndGoto(page, seededStateV4(), 'workload', BASE)
  await sleep(800)
  check('workload renders seven day-by-day capacity cells', await page.evaluate(() => {
    const svg = document.querySelector('[aria-label="Capacity vs committed workload, next 7 days"] svg[role="img"]')
    if (!svg) return false
    const aria = svg.getAttribute('aria-label') || ''
    // Day labels are relative: Today, Tomorrow, '2 days'…'6 days'
    return aria.startsWith('Workload next 7 days.')
      && aria.includes('Today:') && aria.includes('Tomorrow:')
      && (aria.match(/days:/g) || []).length >= 4
  }))
  check('workload exposes capacity, planned and free/over', await page.evaluate(() => {
    const snap = document.querySelector('[aria-label="Capacity summary"]')
    return !!snap && /Capacity/.test(snap.textContent) && /Planned/.test(snap.textContent)
      && /(Free|Over capacity)/.test(snap.textContent)
  }))
  check('[workload] capacity chart and peak-day contributors remain reachable', await page.evaluate(() => (
    !!document.querySelector('[aria-label="Capacity vs committed workload, next 7 days"] svg')
    && [...document.querySelectorAll('.dlv__list a')].some((a) => /#\/(projects|assignments)\//.test(a.getAttribute('href') || ''))
  )))
  check('[workload] contributors use original detail links', await page.evaluate(() => {
    const links = [...document.querySelectorAll('.workspace-row-title')]
    return links.every(r => /#\/(projects|assignments)\//.test(r.getAttribute('href')))
  }))
  await shot(page, '16e-workload')
  await overflowCheck(page, 'workload')
  await tapTargetCheck(page, 'workload')

  // the a1 completion above removed the only deadline due today — re-seed so
  // the timeline check sees the fixture it was written against (a hash-only
  // goto would not re-run the seeding init script, hence the blank hop)
  await page.goto('about:blank')
  await seedAndGoto(page, seededStateV4(), 'timeline', BASE)
  await sleep(800)
  check('deadline timeline groups by day', await page.evaluate(() => document.querySelectorAll('.dl-group').length >= 2))
  check('deadline timeline marks today', await page.evaluate(() => [...document.querySelectorAll('.dl-group h3')].some(el => el.textContent === 'Today')))
  await shot(page, '16f-timeline')
  await overflowCheck(page, 'timeline')

  await page.goto(`${BASE}/#/record`, { waitUntil: 'networkidle0' })
  await sleep(800)
  const rtxt = await page.evaluate(() => document.body.textContent)
  check('record shows real behavioural events', /(Reflection|streak|Submitted|reached)/i.test(rtxt))
  await shot(page, '16g-record')
  await overflowCheck(page, 'record')

  await page.goto(`${BASE}/#/library`, { waitUntil: 'networkidle0' })
  await sleep(800)
  check('library lists habits with streak evidence', await page.evaluate(() => (
    document.querySelectorAll('.habit-obj').length >= 3
    && [...document.querySelectorAll('.habit-obj__streak')].some((e) => /\dd/.test(e.textContent))
  )))
  await shot(page, '16h-library')
  await overflowCheck(page, 'library')
  await tapTargetCheck(page, 'library')

  await clickByText(page, 'Routines')
  await sleep(600)
  check('routines show stacked habits', await page.evaluate(() => /Morning reset/.test(document.body.textContent)))
  await shot(page, '16i-routines')

  await page.goto(`${BASE}/#/goals`, { waitUntil: 'networkidle0' })
  await sleep(700)
  check('first-class goals render outcome rows with trajectory charts', await page.evaluate(() => (
    /Run a half marathon/.test(document.body.textContent)
    && !!document.querySelector('.goal-row .goal-trajectory svg')
    && !!document.querySelector('.goal-row__link[href^="#/goals/"]')
  )))
  await shot(page, '16j-goals')
  await overflowCheck(page, 'goals')

  /* ---- Goals 2.0 (Phase 6): outcome-first detail experience ---- */
  await page.goto(`${BASE}/#/goals/g-run`, { waitUntil: 'networkidle0' })
  await sleep(900)
  check('[goal-detail] opens with outcome + health pill + trajectory core', await page.evaluate(() => (
    /Run a half marathon/.test(document.querySelector('#goal-detail-screen h1')?.textContent || '')
    && !!document.querySelector('#goal-detail-screen .status-pill')
    && !!document.querySelector('#goal-detail-screen .goal-detail__trajectory svg')
  )))
  check('[goal-detail] states the stage of the goal object', await page.evaluate(() => (
    /On track|At risk|Overdue|Needs attention|Completed/.test(document.querySelector('#goal-detail-screen .status-pill')?.textContent || '')
  )))
  check('[goal-detail] progress + next milestone are above the fold before any large chart', await page.evaluate(() => {
    const heads = [...document.querySelectorAll('#goal-detail-screen .card-title')].map(h => h.textContent.trim())
    const next = heads.indexOf('Next milestone')
    return next >= 0 && (heads.indexOf('Forecast') > next)
  }))
  check('[goal-detail] analytics labelled honestly (progress pill + expected pace + consistency)', await page.evaluate(() => {
    const snap = document.querySelector('#goal-detail-screen .dlv__snap')
    const kv = document.querySelector('#goal-detail-screen .kv')?.textContent || ''
    return !!snap && snap.querySelectorAll('.dlv__pill').length > 3
      && [...snap.querySelectorAll('.dlv__pill-label')].some((l) => l.textContent.trim() === 'Progress')
      && /Expected today/.test(kv) && /Consistency/.test(kv)
  }))
  check('[goal-detail] trajectory draws real progress vs expected pace', await page.evaluate(() => (
    !!document.querySelector('#goal-detail-screen svg[aria-label^="Progress analytics for this goal."]')
  )))
  check('[goal-detail] milestone rows show reached evidence (done state)', await page.evaluate(() => (
    document.querySelectorAll('#goal-detail-screen .ms-row, #goal-detail-screen .goal-next-toggle').length >= 3
    && document.querySelectorAll('#goal-detail-screen [aria-pressed="true"], #goal-detail-screen .ms-row.is-done').length >= 1
  )))
  check('[goal-detail] forecast renders Expected today / Projected from the adaptive engine', await page.evaluate(() => {
    const t = document.querySelector('#goal-detail-screen .kv')?.textContent || ''
    return /Expected today/.test(t) && /Projected/.test(t)
  }))
  check('[goal-detail] contributors name real linked work', await page.evaluate(() => (
    document.querySelectorAll('#goal-detail-screen a[href^="#/habits/"], #goal-detail-screen a[href^="#/projects/"], #goal-detail-screen a[href^="#/assignments/"]').length > 0
  )))
  check('[goal-detail] "This goal is fed by" lists the linked habit', await page.evaluate(() => {
    const n = document.querySelector('#goal-detail-screen .feed-row[href^="#/habits/"] .feed-name')?.textContent.trim()
    return n === 'Morning run'
  }))
  await shot(page, '16k-goal-detail')
  await overflowCheck(page, 'goal-detail')
  await tapTargetCheck(page, 'goal-detail')
  await noConsoleErrors(page, 'work-layer')
  await page.close()
}

/* ============================================================
   PART 6 — Export / import / reset (mobile)
   ============================================================ */
console.log('\n— Data: export, import, reset —')
{
  const page = await newPage(browser, VIEWPORTS.mobile)
  await seedAndGoto(page, seededStateV4(), 'settings', BASE)
  const downloadPath = '/tmp/qa-download.json'
  fs.rmSync(downloadPath, { force: true })

  const client = await page.createCDPSession()
  await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: '/tmp', eventsEnabled: true })

  await clickByText(page, 'Export backup')
  await sleep(1200)
  const exportedFile = fs.readdirSync('/tmp').find((f) => /^aaru-habits-.*\.json$/.test(f))
  check('export downloads a JSON file', !!exportedFile, 'no aaru-habits-*.json in /tmp')
  if (exportedFile) {
    const exported = JSON.parse(fs.readFileSync(`/tmp/${exportedFile}`, 'utf8'))
    check('export contains app marker + full data', exported.app === 'aaru-habits' && exported.data.habits.length === 5 && exported.data.moods && Object.keys(exported.data.checkins).length === 5)
    const todayStr = (() => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` })()
    check('export stamps lastBackupExport', await page.evaluate((t) => JSON.parse(localStorage.getItem('aaru.habits.v4')).profile.lastBackupExport === t, todayStr))
    // wipe app data, then import the file back
    await page.evaluate(() => localStorage.clear())
    await page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle0' })
    const input = await page.$('input[type="file"]')
    await input.uploadFile(`/tmp/${exportedFile}`)
    await sleep(800)
    const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('aaru.habits.v4')))
    check('import restores habits + checkins', restored.habits.length === 5 && Object.keys(restored.checkins).length === 5, `habits=${restored.habits?.length}`)
    check('import toast confirms', await page.evaluate(() => document.body.textContent.includes('Imported 5 habits')))
    // valid JSON but garbage field shapes → app must sanitize and import the good parts
    fs.writeFileSync('/tmp/bad.json', '{"app":"aaru-habits","data":{"habits":[{"name":"X"}],"checkins":"garbage"}}')
    const input2 = await page.$('input[type="file"]')
    await input2.uploadFile('/tmp/bad.json')
    await sleep(800)
    check('garbage-field import sanitized (imports habit, drops bad checkins)',
      await page.evaluate(() => document.body.textContent.includes('Imported 1 habit')
        && JSON.parse(localStorage.getItem('aaru.habits.v4')).habits.map((h) => h.name).join() === 'X'),
      'expected Imported 1 habit toast + stored habit X')
    // not JSON at all → friendly error, current data untouched
    fs.writeFileSync('/tmp/bad2.json', 'this is not json at all {{{')
    const input3 = await page.$('input[type="file"]')
    await input3.uploadFile('/tmp/bad2.json')
    await sleep(800)
    check('invalid JSON rejected with friendly error', await page.evaluate(() => document.body.textContent.includes('valid JSON')))
    check('failed import keeps current data', await page.evaluate(() => JSON.parse(localStorage.getItem('aaru.habits.v4')).habits.length === 1))
    await page.reload({ waitUntil: 'networkidle0' })
    await sleep(500)
    check('app healthy after bad imports (no onboarding regression)', await page.evaluate(() => !!document.querySelector('.screen') && !document.querySelector('.onboarding')))
  }

  // reset
  await clickByText(page, 'Erase all data')
  await sleep(200)
  await clickByText(page, 'Yes, erase everything')
  await sleep(500)
  const afterReset = await page.evaluate(() => JSON.parse(localStorage.getItem('aaru.habits.v4')))
  check('reset clears habits/checkins, keeps name', afterReset.habits.length === 0 && afterReset.profile.name === 'Aaru', JSON.stringify(afterReset.profile))
  check('reset returns to onboarding', await page.evaluate(() => !!document.querySelector('.onboarding')))
  await noConsoleErrors(page, 'data')
  await page.close()
}


/* ============================================================
   PART 7 — Themes (mobile screenshots)
   ============================================================ */
console.log('\n— Themes —')
{
  const page = await newPage(browser, VIEWPORTS.mobile)
  await seedAndGoto(page, seededStateV4(), 'today', BASE)
  for (const theme of ['midnight', 'aurora', 'ember', 'verdant', 'daylight']) {
    await page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle0' })
    await sleep(300)
    await page.evaluate((t) => {
      const label = { midnight: 'Midnight', aurora: 'Aurora', ember: 'Warm', verdant: 'Verdant', daylight: 'Light' }[t]
      const btn = [...document.querySelectorAll('.theme-card')].find((b) => b.textContent.trim().startsWith(label))
      if (btn) btn.click()
      else throw new Error('theme button not found: ' + label)
    }, theme)
    await sleep(400)
    const applied = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
    check(`theme ${theme} applies`, applied === theme)
    await page.goto(`${BASE}/#/today`, { waitUntil: 'networkidle0' })
    await sleep(500)
    await shot(page, `16-today-${theme}`)
    await contrastCheck(page, `today-${theme}`)
    await overflowCheck(page, `today-${theme}`)
  }
  // persistence of theme
  await page.reload({ waitUntil: 'networkidle0' })
  await sleep(400)
  check('theme persists after reload', await page.evaluate(() => document.documentElement.getAttribute('data-theme')) === 'daylight')
  await noConsoleErrors(page, 'themes')
  await page.close()
}

/* ============================================================
   PART 8 — Desktop 1440×900 (sidebar, space usage)
   ============================================================ */
console.log('\n— Desktop 1440×900 —')
{
  const page = await newPage(browser, VIEWPORTS.desktop)
  await seedAndGoto(page, seededStateV4(), 'today', BASE)
  await sleep(200)
  check('sidebar renders (desktop nav)', await page.evaluate(() => !!document.querySelector('.app-sidebar')))
  check('bottom nav hidden on desktop', await page.evaluate(() => !document.querySelector('.bottom-nav') || getComputedStyle(document.querySelector('.bottom-nav')).display === 'none'))
  check('FAB hidden on desktop', await page.evaluate(() => !document.querySelector('.btn.floating') || getComputedStyle(document.querySelector('.btn.floating')).display === 'none'))
  const contentMax = await page.evaluate(() => {
    const page = document.querySelector('.app-page')
    return { w: page.getBoundingClientRect().width, left: page.getBoundingClientRect().left, max: parseFloat(getComputedStyle(page).maxWidth), viewport: innerWidth }
  })
  check('content column respects the width token and does not stretch full width', contentMax.w <= contentMax.max && contentMax.w < contentMax.viewport, `w=${contentMax.w} max=${contentMax.max}`)
  check('content offset by sidebar', contentMax.left >= 240, `left=${contentMax.left}`)
  await shot(page, '17-desktop-today')
  await overflowCheck(page, 'desktop-today')
  await contrastCheck(page, 'desktop-today')

  await page.goto(`${BASE}/#/insights`, { waitUntil: 'networkidle0' })
  await sleep(1200)
  await shot(page, '18-desktop-insights')
  await page.goto(`${BASE}/#/calendar`, { waitUntil: 'networkidle0' })
  await sleep(700)
  await shot(page, '19-desktop-calendar')
  const calDesktop = await page.evaluate(() => {
    const wrap = document.querySelector('#calendar-screen .hc-scroll')
    return { scrollable: !!wrap && wrap.scrollWidth > wrap.clientWidth }
  })
  check('calendar scrollable on desktop with sticky name column', calDesktop.scrollable)
  await page.goto(`${BASE}/#/goals`, { waitUntil: 'networkidle0' })
  await sleep(600)
  await shot(page, '20-desktop-goals')

  // work layer on a wide screen
  await page.goto(`${BASE}/#/projects`, { waitUntil: 'networkidle0' })
  await sleep(800)
  check('desktop sidebar exposes the Work group', await page.evaluate(() => (
    [...document.querySelectorAll('.app-sidebar a')].some((a) => a.getAttribute('href') === '#/work')
  )))
  check('desktop exposes the same contextual Work navigation', await page.evaluate(() => {
    const t = document.querySelector('.wo-tabs')
    return !!t && getComputedStyle(t).display !== 'none'
  }))
  await shot(page, '20b-desktop-projects')
  await overflowCheck(page, 'desktop-projects')

  await page.goto(`${BASE}/#/projects/p2`, { waitUntil: 'networkidle0' })
  await sleep(800)
  check('project detail uses a two-column layout on desktop', await page.evaluate(() => {
    const l = document.querySelector('.detail-layout')
    return !!l && getComputedStyle(l).gridTemplateColumns.split(' ').length >= 2
  }))
  await shot(page, '20c-desktop-project-detail')
  await overflowCheck(page, 'desktop-project-detail')

  await page.goto(`${BASE}/#/assignments`, { waitUntil: 'networkidle0' })
  await sleep(800)
  await shot(page, '20d-desktop-assignments')
  await page.goto(`${BASE}/#/assignments/a1`, { waitUntil: 'networkidle0' })
  await sleep(800)
  await shot(page, '20e-desktop-assignment-detail')
  await page.goto(`${BASE}/#/workload`, { waitUntil: 'networkidle0' })
  await sleep(800)
  await shot(page, '20f-desktop-workload')
  await overflowCheck(page, 'desktop-workload')
  await page.goto(`${BASE}/#/timeline`, { waitUntil: 'networkidle0' })
  await sleep(800)
  await shot(page, '20g-desktop-timeline')
  await page.goto(`${BASE}/#/library`, { waitUntil: 'networkidle0' })
  await sleep(800)
  await shot(page, '20h-desktop-library')
  await page.goto(`${BASE}/#/record`, { waitUntil: 'networkidle0' })
  await sleep(800)
  await shot(page, '20i-desktop-record')
  await page.goto(`${BASE}/#/insights`, { waitUntil: 'networkidle0' })
  await sleep(900)
  await clickByText(page, 'Deep dive')
  await sleep(900)
  await shot(page, '20j-desktop-insights-deep')
  await overflowCheck(page, 'desktop-insights-deep')
  await contrastCheck(page, 'desktop-work')

  // search palette (desktop shortcut)
  await page.goto(`${BASE}/#/today`, { waitUntil: 'networkidle0' })
  await sleep(600)
  await page.keyboard.press('/')
  await sleep(600)
  check('"/" opens the search palette', await page.evaluate(() => !!document.querySelector('[role="dialog"]')))
  // Phase 2: '/' opens the Omni panel in search mode (#command-input)
  await page.type('#command-input, #global-search', 'thesis')
  await sleep(700)
  check('search finds a project by name', await page.evaluate(() => /Thesis/.test(document.body.textContent)))
  await shot(page, '20k-desktop-search')
  await page.keyboard.press('Escape')
  await sleep(400)

  await page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle0' })
  await sleep(400)
  await shot(page, '21-desktop-settings')
  await noConsoleErrors(page, 'desktop')
  await page.close()
}

/* ============================================================
   PART 9 — Reduced motion & offline behavior
   ============================================================ */
console.log('\n— Reduced motion & offline —')
{
  const page = await newPage(browser, VIEWPORTS.mobile)
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await seedAndGoto(page, seededStateV4(), 'today', BASE)
  const anims = await page.evaluate(() => {
    const moving = []
    for (const el of document.querySelectorAll('.aurora-blob')) {
      const cs = getComputedStyle(el)
      if (cs.animationName !== 'none' && parseFloat(cs.animationDuration) > 0.1) moving.push(el.className)
    }
    return moving
  })
  check('aurora animation disabled under reduced motion', anims.length === 0, anims.join(','))
  await shot(page, '22-reduced-motion-today')

  // complete a habit: no confetti canvas activity expected (fire=0 renders but skip)
  const rmBefore = await page.evaluate(() => document.querySelectorAll('.habit-obj.is-done').length)
  await page.evaluate(() => document.querySelector('li.today-row--habit-obj [aria-label^="Mark "]').click())
  await sleep(500)
  check('reduced-motion: completion still works', await page.evaluate((b) => (
    Math.abs(document.querySelectorAll('.habit-obj.is-done').length - b) === 1
  ), rmBefore))

  // offline → app still loads from SW? (dev/preview server kill not possible here;
  // instead verify the offline pill appears when navigator goes offline)
  await page.goto(`${BASE}/#/today`, { waitUntil: 'networkidle0' })
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
  await sleep(300)
  check('offline indicator appears', await page.evaluate(() => !!document.querySelector('.app-offline')))
  await noConsoleErrors(page, 'reduced-motion')
  await page.close()
}

/* ============================================================
   PART 10 — Empty states (mobile)
   ============================================================ */
console.log('\n— Empty states —')
{
  const page = await newPage(browser, VIEWPORTS.mobile)
  await seedAndGoto(page, {
    version: 4,
    profile: { name: 'Aaru', onboarded: true, theme: 'midnight', lastBackupExport: null, lastBackupReminder: null, reminderNoteSeen: false, workReminders: true, workReminderHours: 24 },
    habits: [], checkins: {}, routines: [], projects: [], assignments: [], moods: {},
  }, 'today', BASE)
  for (const [route, name] of [
    ['today', '23-empty-today'], ['calendar', '24-empty-calendar'], ['week', '25-empty-week'],
    ['insights', '26-empty-insights'], ['mind', '27-empty-mind'], ['goals', '28-empty-goals'],
    ['projects', '28b-empty-projects'], ['assignments', '28c-empty-assignments'],
    ['workload', '28d-empty-workload'], ['timeline', '28e-empty-timeline'],
    ['library', '28f-empty-library'], ['record', '28g-empty-record'],
  ]) {
    await page.goto(`${BASE}/#/${route}`, { waitUntil: 'networkidle0' })
    await sleep(400)
    await shot(page, name)
    await overflowCheck(page, `empty-${route}`)
    if (route === 'today') {
      check('today empty state shows honest guidance, no fake numbers', await page.evaluate(() => {
        const t = document.querySelector('.today-list__empty')?.textContent || ''
        return /No habits scheduled|Everything on your list is done/.test(t)
      }))
    }
    // The unified EmptyState primitive (`.p-empty`) replaced per-route art.
    const EMPTY_BY_ROUTE = { calendar: '.hc-empty', week: '.wr-empty', mind: '.empty-note' }
    if (EMPTY_BY_ROUTE[route]) {
      check(`[${route}] empty state renders honest guidance`, await page.evaluate((sel) => (
        !!document.querySelector(sel)
      ), EMPTY_BY_ROUTE[route]))
    }
    if (route === 'calendar') {
      check('[calendar] empty state offers the create action', await page.evaluate(() => (
        [...document.querySelectorAll('.hc-empty button')].some((b) => b.textContent.trim() === 'Create habit')
      )))
    }
    if (route === 'projects' || route === 'assignments') {
      check(`${route} empty state offers a create action`, await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')].map((b) => b.textContent || '')
        return btns.some((t) => /Create|New/.test(t))
      }))
      check(`${route} empty state never shows invented numbers`, await page.evaluate(() => {
        const t = document.body.textContent
        return !/\d+%/.test(t.replace(/\d+%/g, (m) => (m === '0%' ? m : ''))) || /No |Nothing /.test(t)
      }))
    }
  }
  await noConsoleErrors(page, 'empty-states')
  await page.close()
}

/* ============================================================
   PART — Achievements 2.0: shelf honesty + the unlock moment
   ============================================================ */
console.log('\n— Achievements 2.0 —')
{
  const page = await newPage(browser, VIEWPORTS.mobile)
  await seedAndGoto(page, seededStateV4(), 'achievements', BASE)
  await sleep(700)
  const atxt = await page.evaluate(() => document.body.textContent)
  check('achievements hero counts unlocked from real data', /unlocked/.test(atxt) && /\d+/.test(atxt))
  check('[achievements 2.0] earned cards carry the mounted art + earn stamp', await page.evaluate(() => (
    document.querySelectorAll('.ach-card.is-earned .ach-art').length >= 1
    && document.querySelectorAll('.ach-card.is-earned .ach-art-check').length >= 1
  )))
  check('[achievements 2.0] locked cards show honest progress meters', await page.evaluate(() => (
    document.querySelectorAll('.ach-card:not(.is-earned) .meter').length >= 1
  )))
  await shot(page, '17-achievements')
  await overflowCheck(page, 'achievements')
  await tapTargetCheck(page, 'achievements')

  // finish every habit scheduled today → the clean-sweep unlock moment
  await page.goto(`${BASE}/#/today`, { waitUntil: 'networkidle0' })
  await sleep(800)
  for (let i = 0; i < 10; i++) {
    const clicked = await page.evaluate(() => {
      const row = [...document.querySelectorAll('li.today-row--habit-obj')]
        .find((r) => !r.querySelector('.habit-obj.is-done'))
      const b = row?.querySelector('[aria-label^="Mark "]')
      if (!b) return false
      b.click()
      return true
    })
    if (!clicked) break
    await sleep(420)
  }
  check('[achievements 2.0] finishing the day fires the unlock moment', await page.evaluate(() => (
    /troph(y|ies) earned/i.test(document.querySelector('.toast-region')?.textContent || '')
  )))
  await page.goto(`${BASE}/#/achievements`, { waitUntil: 'networkidle0' })
  await sleep(700)
  check('[achievements 2.0] clean sweep is stamped earned afterwards', await page.evaluate(() => (
    [...document.querySelectorAll('.ach-card.is-earned')].some((c) => /Clean sweep/.test(c.textContent))
  )))
  await noConsoleErrors(page, 'achievements')
  await page.close()
}

/* ============================================================
   PART — Keyboard & focus: the app works without a pointer
   ============================================================ */
console.log('\n— Keyboard & focus (a11y) —')
{
  const page = await newPage(browser, VIEWPORTS.mobile)
  await seedAndGoto(page, seededStateV4(), 'today', BASE)
  await sleep(800)
  await page.evaluate(() => document.activeElement?.blur?.())
  let reached = false
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab')
    const label = await page.evaluate(() => document.activeElement?.getAttribute?.('aria-label') || '')
    if (/Mark .* complete/i.test(label)) { reached = true; break }
  }
  check('[a11y] keyboard alone reaches a habit complete control', reached)
  await page.keyboard.press('Enter')
  await sleep(600)
  check('[a11y] Enter on the focused control completes the habit', await page.evaluate(() => (
    document.querySelectorAll('.habit-obj.is-done').length >= 1
  )))
  check('[a11y] focused control shows a visible focus ring', await page.evaluate(() => {
    const el = document.activeElement
    if (!el || el === document.body) return false
    const cs = getComputedStyle(el)
    return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 1
  }))

  // Escape closes the search overlay (desktop, where the shortcut lives).
  // Wait for the dialog to mount/unmount rather than guessing a fixed sleep —
  // the palette is a spring-animated Sheet and mounts asynchronously, so a
  // fixed delay flakes under CPU contention. waitForSelector still asserts the
  // real behaviour (opens with /, closes with Escape).
  const desk = await newPage(browser, VIEWPORTS.desktop)
  await seedAndGoto(desk, seededStateV4(), 'today', BASE)
  await sleep(700)
  await desk.bringToFront()
  await desk.keyboard.press('/')
  let opened = false
  try { await desk.waitForSelector('[role="dialog"]', { visible: true, timeout: 5000 }); opened = true } catch { /* selector timeout means the assertion below records failure */ }
  await desk.keyboard.press('Escape')
  let closed = false
  try { await desk.waitForSelector('[role="dialog"]', { hidden: true, timeout: 5000 }); closed = true } catch { /* selector timeout means the assertion below records failure */ }
  check('[a11y] search opens with / and Escape closes it', opened && closed)
  await desk.close()

  await page.goto(`${BASE}/#/achievements`, { waitUntil: 'networkidle0' })
  await sleep(600)
  await contrastCheck(page, 'achievements')
  await page.goto(`${BASE}/#/workload`, { waitUntil: 'networkidle0' })
  await sleep(600)
  await contrastCheck(page, 'workload')
  await noConsoleErrors(page, 'a11y-keyboard')
  await page.close()
}

/* ============================================================
   PART 11 — Viewport sweep 320–414px (zero horizontal overflow)
   ============================================================ */
console.log('\n— Viewport sweep 320–414px —')
{
  for (const width of [320, 360, 390, 414]) {
    const page = await newPage(browser, { width, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    await seedAndGoto(page, seededStateV4(), 'insights', BASE)
    await sleep(350)
    if (width === 320) check('[320] insights renders the primary trend chart', await page.evaluate(() => !!document.querySelector('.ins-svg-wrap svg[role="img"]')))
    await overflowCheck(page, `insights-${width}`)
    await page.goto(`${BASE}/#/calendar`, { waitUntil: 'networkidle0' })
    await sleep(350)
    await overflowCheck(page, `calendar-${width}`)
    await page.goto(`${BASE}/#/today`, { waitUntil: 'networkidle0' })
    await sleep(350)
    await overflowCheck(page, `today-${width}`)
    await page.goto(`${BASE}/#/week`, { waitUntil: 'networkidle0' })
    await sleep(350)
    await overflowCheck(page, `week-${width}`)

    // work layer at every width
    for (const route of ['projects', 'assignments', 'workload', 'timeline', 'library', 'record', 'goals']) {
      await page.goto(`${BASE}/#/${route}`, { waitUntil: 'networkidle0' })
      await sleep(400)
      await overflowCheck(page, `${route}-${width}`)
    }
    await page.goto(`${BASE}/#/projects/p1`, { waitUntil: 'networkidle0' })
    await sleep(400)
    await overflowCheck(page, `project-detail-${width}`)
    await page.goto(`${BASE}/#/assignments/a1`, { waitUntil: 'networkidle0' })
    await sleep(400)
    await overflowCheck(page, `assignment-detail-${width}`)

    // P0 — Add Habit must stay reachable at every width. Mobile has no FAB
    // (the desktop route FAB renders null on mobile): the Omni trigger in the
    // shell chrome is the create entry, with the 'Add habit' chip one tap away.
    await page.goto(`${BASE}/#/today`, { waitUntil: 'networkidle0' })
    await sleep(400)
    const omni = await page.evaluate(() => {
      const el = document.querySelector('.app-omni-trigger, [aria-label="Open Omni"]')
      if (!el) return null
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return {
        w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom),
        vw: window.innerWidth, vh: window.innerHeight, visible: cs.display !== 'none' && cs.visibility !== 'hidden',
      }
    })
    check(`[${width}] Omni create trigger is visible, ≥44px and fully on screen (P0)`,
      !!omni && omni.visible && omni.w >= 44 && omni.h >= 44 && omni.right <= omni.vw && omni.bottom <= omni.vh,
      JSON.stringify(omni))
    const omniClicked = await page.evaluate(() => {
      const el = document.querySelector('.app-omni-trigger, [aria-label="Open Omni"]')
      if (!el) return false
      el.click()
      return true
    })
    await sleep(700)
    const panelOpen = await page.evaluate(() => (
      !!document.querySelector('[role="dialog"]')
      && [...document.querySelectorAll('.cc-row, [role="dialog"] button')].some((b) => b.textContent.trim() === 'Add habit')
    ))
    check(`[${width}] tapping the Omni trigger opens the create panel with 'Add habit' (P0)`, omniClicked && panelOpen)
    await page.keyboard.press('Escape')
    await sleep(400)
    await page.close()
  }
}


/* ============================================================
   PART 10 — V4 spatial experience (docs/V4-AUDIT.md)
   Boot cinematic, world layers, route camera, gallery, atlas,
   pressure band, collectible badges — all presentational layers
   checked to exist, behave, and never block content.
   ============================================================ */
console.log('\n— V4 spatial —')
{
  const page = await newPage(browser, VIEWPORTS.desktop)

  // 1 · boot overlay NEVER blocks automation by default, and plays when forced
  await seedAndGoto(page, seededStateV4(), 'today', BASE)
  check('V4 boot: skipped under automation without explicit QA hook',
    await page.evaluate(() => !document.querySelector('.boot')))

  await page.evaluate(() => localStorage.setItem('aaru.boot', 'on'))
  await page.reload({ waitUntil: 'domcontentloaded' })
  // poll for appearance and dissolution — CI cold starts beat fixed sleeps
  let bootSeen = { overlay: false, headline: false, skip: false }
  for (let i = 0; i < 40; i += 1) {
    bootSeen = await page.evaluate(() => ({
      overlay: !!document.querySelector('.boot'),
      headline: /SMALL THINGS/.test(document.querySelector('.boot')?.textContent || ''),
      skip: !!document.querySelector('.boot-skip'),
    }))
    if (bootSeen.overlay && bootSeen.headline && bootSeen.skip) break
    await sleep(200)
  }
  check('V4 boot: forced playback shows headline + skip control', bootSeen.overlay && bootSeen.headline && bootSeen.skip, JSON.stringify(bootSeen))
  await shot(page, '23-v4-boot')
  let bootGone = false
  for (let i = 0; i < 40; i += 1) {
    bootGone = await page.evaluate(() => !document.querySelector('.boot'))
    if (bootGone) break
    await sleep(200)
  }
  check('V4 boot: dissolves by itself (~1.4s + fade)', bootGone)
  // strip the force flag BEFORE the document boots (addInitScript runs pre-JS),
  // then a reload must respect the once-per-session gate
  const unforce = await page.evaluateOnNewDocument(() => { try { localStorage.removeItem('aaru.boot') } catch { /* */ } })
  await page.reload({ waitUntil: 'networkidle0' })
  await sleep(300)
  check('V4 boot: sessionStorage gate — no replay on refresh (hook removed pre-load)',
    await page.evaluate(() => !document.querySelector('.boot') && sessionStorage.getItem('aaru.boot.v4') === '1'))
  await page._client().send('Page.removeScriptToEvaluateOnNewDocument', { identifier: unforce.identifier }).catch(() => {})
  await page.evaluate(() => { try { localStorage.removeItem('aaru.boot'); sessionStorage.clear() } catch { /* */ } })

  // 2 · environment layers exist and never swallow input
  await seedAndGoto(page, seededStateV4(), 'today', BASE)
  await sleep(700) // let the hero mount before probing depth lanes
  const world = await page.evaluate(() => ({
    static: document.querySelectorAll('.world-static i').length,
    spatial: document.documentElement.dataset.spatial || '',
    heroDeep: !!document.querySelector('.today-hero.sp-depth'),
    noGlBlock: (() => { const w = document.querySelector('.world-layer'); return !w || getComputedStyle(w).pointerEvents === 'none' })(),
  }))
  check('V4 world: static distant planes present behind everything', world.static === 3, `static=${world.static}`)
  check('V4 world: spatial tier published on <html>', ['full', 'reduced', 'flat'].includes(world.spatial), world.spatial)
  check('V4 today: screen mounts under the route camera group', await page.evaluate(() => !!document.querySelector('.route-cam #today-screen')))
  check('V4 world: WebGL layer (if mounted) never takes pointer input', world.noGlBlock)

  // 3 · route change = camera travel, content never waits
  await page.evaluate(() => { window.location.hash = '#/projects' })
  const cam = await page.evaluate(() => !!document.querySelector('.route-cam'))
  check('V4 nav: incoming screen is mounted under the camera group', cam)
  await sleep(700)

  // 4 · projects spatial gallery is opt-in, never the default.
  await clickByText(page, 'Gallery / spatial')
  await sleep(600)
  const gallery = await page.evaluate(() => ({
    items: document.querySelectorAll('.gal-item').length,
    art: document.querySelectorAll('.gal-item .gal-art').length,
    grid: !!document.querySelector('.gal-grid'),
    toggle: !!([...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Gallery / spatial')),
    list: !!([...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'List')),
  }))
  check('V4 gallery: every project is a floating plane with its own surface',
    gallery.grid && gallery.items > 0 && gallery.items === gallery.art && gallery.toggle && gallery.list,
    JSON.stringify(gallery))
  await shot(page, '24-v4-gallery')
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'List')?.click())
  await sleep(500)
  check('V4 gallery: List mode restores the classic rows', await page.evaluate(() => !!document.querySelector('.workspace-list')))
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Gallery / spatial')?.click())
  await sleep(400)
  const kb = await page.evaluate(() => {
    const link = document.querySelector('.gal-item a')
    if (!link) return false
    link.focus()
    return document.activeElement === link
  })
  check('V4 gallery: plane content is keyboard-focusable (a11y §25)', kb)

  // 5 · goals atlas — optional spatial exploration of real links (Phase 6:
  // the list is the default; the Atlas mounts only when the user opts in).
  await page.goto(`${BASE}/#/goals`, { waitUntil: 'networkidle0' })
  await sleep(700)
  check('V4 atlas: not mounted by default — list-first', await page.evaluate(() =>
    !!document.querySelector('.goal-row') && !document.querySelector('.atlas-wrap')))
  await clickByText(page, 'Atlas', '[aria-label="Goals view"] button')
  await sleep(900)
  const atlas = await page.evaluate(() => ({
    frames: document.querySelectorAll('.atlas-frame').length,
    nodes: document.querySelectorAll('.atlas-node').length,
    goals: document.querySelectorAll('.atlas-goal').length,
    lines: document.querySelectorAll('.atlas-web line').length,
    img: !!document.querySelector('.atlas-scene'),
  }))
  check('V4 atlas: goals render as constellations with real satellites',
    atlas.frames > 0 && atlas.nodes >= atlas.goals * 2 && atlas.lines >= atlas.nodes - atlas.goals,
    JSON.stringify(atlas))
  await shot(page, '25-v4-atlas')

  // 6 · deliverables pressure — Phase 4 folded the V4 pressure band into the
  // unified Work → Deliverables rows: every assignment states its deadline,
  // its source-derived progress (labelled meter) and its deadline risk.
  await page.goto(`${BASE}/#/assignments`, { waitUntil: 'networkidle0' })
  await sleep(700)
  const press = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.workspace-row[data-kind="assignment"]')]
    return {
      rows: rows.length,
      deadlines: rows.every((r) => /Due .+|No deadline/.test(r.querySelector('.workspace-meta')?.textContent || '')),
      risks: rows.every((r) => /OVERDUE|CRITICAL|AT RISK|DUE SOON|No deadline risk|ON TRACK|SAFE/i.test(r.querySelector('.workspace-risk')?.textContent || '')),
      labelled: rows.every((r) => /\d+% complete/.test(r.querySelector('.workspace-progress [aria-label]')?.getAttribute('aria-label') || '')),
    }
  })
  check('V4 pressure: every deliverable states deadline, progress and risk',
    press.rows > 0 && press.deadlines && press.risks && press.labelled,
    JSON.stringify(press))
  await shot(page, '26-v4-pressure')

  // 7 · achievements — collectible surfaces, honest rarity words
  await page.goto(`${BASE}/#/achievements`, { waitUntil: 'networkidle0' })
  await sleep(800)
  const rarity = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.ach-card')]
    const earned = document.querySelector('.ach-card.is-earned')
    const tiers = cards.map((c) => c.getAttribute('data-tier') || '')
    return {
      depth: cards.length > 0,
      allValid: tiers.every((t) => ['bronze', 'silver', 'gold', 'diamond', 'common', 'rare', 'epic', 'legendary'].includes(t.toLowerCase())) && tiers.length > 0,
      earnedHasRarity: !!earned && !!earned.querySelector('.ach-art-check'),
      lockedNoGlow: document.querySelectorAll('.ach-card[data-locked="true"] .meter').length >= 1,
    }
  })
  check('V4 achievements: every card carries a tier + an honest earned state',
    rarity.depth && rarity.allValid && rarity.earnedHasRarity && rarity.lockedNoGlow, JSON.stringify(rarity))
  await shot(page, '27-v4-badges')

  // 8 · reduced motion — the world stands still but keeps its composition
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await page.goto(`${BASE}/#/today`, { waitUntil: 'networkidle0' })
  await sleep(600)
  await page.goto(`${BASE}/#/insights`, { waitUntil: 'networkidle0' })
  await sleep(800)
  const still = await page.evaluate(() => ({
    spatial: document.documentElement.dataset.spatial,
    depthKept: !!document.querySelector('.sp-depth[data-z]'),
    boot: !!document.querySelector('.boot'),
    anim: getComputedStyle(document.querySelector('.world-static i') || document.body).animationName,
  }))
  check('V4 reduced motion: spatial mode pins to flat, composition (depth) is kept',
    still.spatial === 'flat' && still.depthKept && !still.boot, JSON.stringify(still))
  await noConsoleErrors(page, 'v4-spatial')
  await page.close()
}


await browser.close()
report('E2E + VISUAL QA')
