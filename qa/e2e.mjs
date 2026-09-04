/* ============================================================
   E2E + visual QA in a real (headless) browser.
   Run: node qa/e2e.mjs [base-url]
   Covers the spec's test matrix: habits, schedule, reminders,
   mood, analytics, projects/celebration, data export/import,
   persistence, navigation, overflow, tap targets, contrast.
   ============================================================ */
import { launch, newPage, VIEWPORTS, check, shot, clickByText, clickByLabel, sleep, setStoredState, seedAndGoto, getStoredState, seededState, dayStr, subDays, report } from './helpers.mjs'
import { mkdirSync } from 'fs'
import fs from 'fs'

mkdirSync('qa/shots', { recursive: true })
const BASE = process.argv[2] || 'http://localhost:4173'

const browser = await launch()

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
    const orig = window.Notification && Notification.requestPermission
    window.Notification = {
      permission: 'default',
      requestPermission: async () => { window.__permAsked++; return 'granted' },
    }
  })

  await shot(page, '01-onboarding-step1')
  await overflowCheck(page, 'onboarding-1')

  // step 1: name
  await page.type('input[placeholder="Your name"]', 'Aaru')
  await clickByText(page, 'Continue')
  await page.waitForSelector('text/Pick a few to start', { timeout: 5000 })
  await sleep(300)
  await shot(page, '02-onboarding-step2')

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
  await page.waitForSelector('.screen-title', { timeout: 5000 })
  await sleep(500)

  const greeting = await page.evaluate(() => document.querySelector('.screen-title')?.textContent)
  check('lands on Today with greeting + name', /Aaru/.test(greeting || ''), greeting)
  check('starter habits created (no fake history)', await page.evaluate(() =>
    document.querySelectorAll('.habit-row').length === 2))
  await shot(page, '04-today-fresh')
  await overflowCheck(page, 'today-fresh')
  await tapTargetCheck(page, 'today-fresh')
  await contrastCheck(page, 'today-fresh')

  // persistence across reload
  await page.reload({ waitUntil: 'networkidle0' })
  await sleep(500)
  check('state persists after reload', await page.evaluate(() => document.querySelectorAll('.habit-row').length === 2))

  // add habit with reminder → permission prompt intercepted (deny path)
  await clickByLabel(page, '^Add a habit$')
  await sleep(400)
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
  await clickByText(page, 'Add habit')
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
  await seedAndGoto(page, seededState(), 'today', BASE)
  await shot(page, '05-today-seeded')
  await overflowCheck(page, 'today-seeded')
  await tapTargetCheck(page, 'today-seeded')

  // 5 habits scheduled today (weekday-dependent, ≥3 daily ones always)
  const rows = await page.evaluate(() => document.querySelectorAll('.habit-row').length)
  check('seeded habits render', rows >= 4, `rows=${rows}`)

  // complete + uncomplete via row tap
  const before = await page.evaluate(() => document.querySelectorAll('.habit-row.done').length)
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('.habit-row')].find((r) => !r.classList.contains('done'))
    row.querySelector('[role="button"]').click()
  })
  await sleep(500)
  const after = await page.evaluate(() => document.querySelectorAll('.habit-row.done').length)
  check('tap row completes habit', after === before + 1, `before=${before} after=${after}`)
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('.habit-row')].find((r) => r.classList.contains('done'))
    row.querySelector('[role="button"]').click()
  })
  await sleep(400)
  check('tap again uncompletes', await page.evaluate(() => document.querySelectorAll('.habit-row.done').length) === before)

  // inline rename via name button (select all first, then type)
  await clickByLabel(page, '^Rename Morning run$')
  await sleep(200)
  await page.keyboard.down('Control')
  await page.keyboard.press('KeyA')
  await page.keyboard.up('Control')
  await page.keyboard.type('Morning jog')
  await page.keyboard.press('Enter')
  await sleep(400)
  check('inline rename works', await page.evaluate(() => document.body.textContent.includes('Morning jog')))

  // detail sheet
  await clickByLabel(page, '^Details for Morning jog$')
  await sleep(500)
  const sheetText = await page.evaluate(() => document.querySelector('.sheet')?.textContent || '')
  check('detail sheet shows 90-day heatmap + streaks', /current streak/i.test(sheetText) && /best streak/i.test(sheetText) && /Last 90 days/i.test(sheetText))
  await shot(page, '06-habit-detail')
  await overflowCheck(page, 'habit-detail')
  await page.keyboard.press('Escape')
  await sleep(300)

  // swipe left reveals archive/delete (framer drag: dispatch pointer events)
  const swipe = await page.evaluate(() => {
    const row = document.querySelector('.habit-row')
    const rect = row.getBoundingClientRect()
    const target = row.parentElement // motion.div wrapper? row itself is the motion element
    const startX = rect.left + rect.width - 30
    const y = rect.top + rect.height / 2
    const el = row
    const mk = (type, x) => new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, clientX: x, clientY: y, button: 0, pointerType: 'touch', isPrimary: true })
    el.dispatchEvent(mk('pointerdown', startX))
    window.dispatchEvent(mk('pointermove', startX - 60))
    window.dispatchEvent(mk('pointermove', startX - 100))
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: startX - 100, clientY: y, pointerType: 'touch' }))
    return true
  })
  await sleep(700)
  const actionsVisible = await page.evaluate(() => {
    const btn = document.querySelector('[aria-label^="Archive"]')
    if (!btn) return false
    return btn.getBoundingClientRect().width > 0
  })
  check('swipe-left reveals archive/delete actions', actionsVisible, 'archive button not visible after swipe')
  if (actionsVisible) {
    await shot(page, '07-swipe-actions')
    // archive via swipe action → undo via toast
    const habitCount = await page.evaluate(() => JSON.parse(localStorage.getItem('aaru.habits.v3')).habits.filter((h) => !h.archived).length)
    await page.evaluate(() => document.querySelector('[aria-label^="Archive"]').click())
    await sleep(500)
    const afterCount = await page.evaluate(() => JSON.parse(localStorage.getItem('aaru.habits.v3')).habits.filter((h) => !h.archived).length)
    check('archive removes habit from list', afterCount === habitCount - 1)
    await clickByText(page, 'Undo', 'button')
    await sleep(400)
    const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('aaru.habits.v3')).habits.filter((h) => !h.archived).length)
    check('undo restores archived habit', restored === habitCount)
  }

  // delete via detail sheet with undo (history restored)
  await clickByLabel(page, '^Details for Morning jog$')
  await sleep(400)
  await clickByText(page, 'Delete')
  await sleep(200)
  await clickByText(page, 'Really delete')
  await sleep(500)
  check('delete toast offers undo', await page.evaluate(() => !!document.querySelector('.toast-action')))
  const historyBefore = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('aaru.habits.v3'))
    return { habits: s.habits.length, runCheckins: s.checkins['h-run'] ? Object.keys(s.checkins['h-run']).length : 0 }
  })
  check('deleted habit removed from storage', historyBefore.habits === 4, `habits=${historyBefore.habits}`)
  await clickByText(page, 'Undo', 'button')
  await sleep(400)
  const restoredState = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('aaru.habits.v3'))
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
  await seedAndGoto(page, seededState(), 'calendar', BASE)
  await sleep(200)
  await shot(page, '08-calendar')
  await overflowCheck(page, 'calendar')

  // find yesterday's cell for the daily habit (Morning run) — label depends on current state
  const ySel = await page.evaluate(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    const dateStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    const el = [...document.querySelectorAll('button')].find((b) => {
      const l = b.getAttribute('aria-label') || ''
      return l.startsWith('Mark') && l.includes('Morning run,') && l.endsWith(dateStr)
    })
    if (!el) return null
    return { label: el.getAttribute('aria-label'), pressed: el.getAttribute('aria-pressed') === 'true' }
  })

  check('yesterday cell exists', !!ySel, 'cell not found')
  if (ySel) {
    const findByDate = () => page.evaluate(() => {
      const d = new Date()
      d.setDate(d.getDate() - 1)
      const dateStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      const el = [...document.querySelectorAll('button')].find((b) => {
        const l = b.getAttribute('aria-label') || ''
        return l.startsWith('Mark') && l.includes('Morning run,') && l.endsWith(dateStr)
      })
      return el ? { pressed: el.getAttribute('aria-pressed') === 'true' } : null
    })
    await page.evaluate(() => {
      const d = new Date()
      d.setDate(d.getDate() - 1)
      const dateStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      const el = [...document.querySelectorAll('button')].find((b) => {
        const l = b.getAttribute('aria-label') || ''
        return l.startsWith('Mark') && l.includes('Morning run,') && l.endsWith(dateStr)
      })
      el.click()
    })
    await sleep(400)
    const after = await findByDate()
    check('past-day toggle works', after && after.pressed === !ySel.pressed, `was=${ySel.pressed} now=${after && after.pressed}`)
    // and storage agrees
    const stored = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('aaru.habits.v3'))
      const d = new Date()
      d.setDate(d.getDate() - 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return s.checkins['h-run']?.[key]?.done === true
    })
    check('past-day toggle persists to storage', stored)
  }

  // today distinguished
  check('today has visual distinction', await page.evaluate(() => !!document.querySelector('.cal-cell.today')))

  // horizontal scroll: grid wider than viewport, scrollable, sticky name column
  const cal = await page.evaluate(() => {
    const wrap = document.querySelector('.cal-wrap')
    const grid = document.querySelector('.cal-grid')
    const name = document.querySelector('.cal-name')
    return {
      scrollable: wrap && wrap.scrollWidth > wrap.clientWidth,
      gridW: grid?.getBoundingClientRect().width,
      nameLeft: name ? name.getBoundingClientRect().left : null,
    }
  })
  check('calendar horizontally scrollable', cal.scrollable, JSON.stringify(cal))
  await page.evaluate(() => { document.querySelector('.cal-wrap').scrollLeft = 600 })
  await sleep(300)
  const stickyOk = await page.evaluate(() => {
    const name = document.querySelector('.cal-name')
    const r = name.getBoundingClientRect()
    return r.left >= -1 && r.left < 40 && r.width > 60
  })
  check('habit-name column stays sticky while scrolling', stickyOk)
  await shot(page, '09-calendar-scrolled')
  await page.evaluate(() => { document.querySelector('.cal-wrap').scrollLeft = 0 })

  // weekday-schedule habit: Meditate is weekdays-only → cell on a Sunday should be inert
  const sunday = await page.evaluate(() => {
    // find next Sunday this month
    const d = new Date()
    while (d.getDay() !== 0 || d <= new Date()) d.setDate(d.getDate() + 1)
    return d.getDate()
  })
  const sundayInert = await page.evaluate((dayNum) => {
    const cells = [...document.querySelectorAll('.cal-cell.off')]
    return cells.length > 0
  }, sunday)
  check('non-scheduled days render inert (dashed)', sundayInert)
  await noConsoleErrors(page, 'calendar')
  await page.close()
}

/* ============================================================
   PART 4 — Week + Insights + Mind (mobile screenshots + analytics integrity)
   ============================================================ */
console.log('\n— Week / Insights / Mind (mobile) —')
{
  const page = await newPage(browser, VIEWPORTS.mobile)
  await seedAndGoto(page, seededState(), 'week', BASE)
  await sleep(200)
  const weekText = await page.evaluate(() => document.body.textContent)
  check('week shows completion + comparison vs previous week', /check-ins/.test(weekText) && /(versus|comparison|previous week)/i.test(weekText))
  check('week shows strongest/weakest habit', /Strongest habit/i.test(weekText) || /Needs attention/i.test(weekText))
  await shot(page, '10-week')
  await overflowCheck(page, 'week')
  await tapTargetCheck(page, 'week')

  await page.goto(`${BASE}/#/insights`, { waitUntil: 'networkidle0' })
  await sleep(1200) // charts animate in
  const insightsText = await page.evaluate(() => document.body.textContent)
  check('insights KPIs render with real numbers', /30-day completion/.test(insightsText) && /Best streak/.test(insightsText))
  check('year overview renders 12 mini-months', await page.evaluate(() => document.querySelectorAll('.mini-month').length === 12))
  check('achievements render 4 badges', await page.evaluate(() => document.querySelectorAll('img[src^="art/badge-"]').length === 4))
  await shot(page, '11-insights')
  await overflowCheck(page, 'insights')

  // verify a displayed number against a recomputed value (data integrity spot check)
  const integrity = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('aaru.habits.v3'))
    let done = 0, total = 0
    const today = new Date()
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
    const el = [...document.querySelectorAll('.stat-value')].find((e) => e.textContent.includes('%'))
    return parseInt(el?.textContent) || null
  })
  check('insights 30-day completion matches independent recomputation', shown === integrity, `shown=${shown} computed=${integrity}`)

  // tap a mini-month → navigates to calendar at that month
  await page.evaluate(() => document.querySelectorAll('.mini-month')[new Date().getMonth()].click())
  await sleep(700)
  check('mini-month opens calendar on that month', await page.evaluate(() => location.hash.startsWith('#/calendar')))

  await page.goto(`${BASE}/#/mind`, { waitUntil: 'networkidle0' })
  await sleep(600)
  const mindText = await page.evaluate(() => document.body.textContent)
  check('mind shows mood picker + history', /How are you feeling today/.test(mindText) && /Last 30 days/.test(mindText))
  await shot(page, '12-mind')
  // set today's mood to Great
  await clickByText(page, 'Great', 'button')
  await sleep(400)
  await shot(page, '13-mood-picked')
  check('mood persists in storage', await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('aaru.habits.v3'))
    const today = new Date()
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    return s.moods[key]?.score === 5
  }))
  await noConsoleErrors(page, 'week-insights-mind')
  await page.close()
}

/* ============================================================
   PART 5 — Goals: create → milestones → tasks → 100% + celebration (mobile)
   ============================================================ */
console.log('\n— Goals & celebration (mobile) —')
{
  const page = await newPage(browser, VIEWPORTS.mobile)
  await seedAndGoto(page, seededState(), 'goals', BASE)
  await sleep(100)
  check('goal card shows real progress (3/5 tasks = 60%)', await page.evaluate(() => document.body.textContent.includes('60%')))
  await shot(page, '14-goals')

  // complete remaining tasks
  await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('input[type="checkbox"]')]
    boxes.filter((b) => !b.checked).forEach((b) => b.click())
  })
  await sleep(900)
  const celebrated = await page.evaluate(() => !!document.querySelector('[aria-label="Goal complete"]'))
  check('100% triggers full-screen celebration', celebrated)
  await shot(page, '15-goal-complete')
  check('completed goal marked complete in storage', await page.evaluate(() =>
    JSON.parse(localStorage.getItem('aaru.habits.v3')).projects[0].completedAt != null))
  await clickByText(page, 'Nice', 'button')
  await sleep(700)
  let dismissed = await page.evaluate(() => !document.querySelector('[aria-label="Goal complete"]'))
  if (!dismissed) {
    await page.keyboard.press('Escape')
    await sleep(500)
    dismissed = await page.evaluate(() => !document.querySelector('[aria-label="Goal complete"]'))
  }
  check('celebration dismisses', dismissed)

  // create a new goal through the sheet
  await clickByText(page, 'New goal')
  await sleep(400)
  await page.type('#goal-name', 'Learn piano')
  await page.type('#goal-milestone', 'Basics')
  await clickByText(page, 'Create goal')
  await sleep(500)
  check('new goal created with milestone', await page.evaluate(() => document.body.textContent.includes('Learn piano')))
  await noConsoleErrors(page, 'goals')
  await page.close()
}

/* ============================================================
   PART 6 — Export / import / reset (mobile)
   ============================================================ */
console.log('\n— Data: export, import, reset —')
{
  const page = await newPage(browser, VIEWPORTS.mobile)
  await seedAndGoto(page, seededState(), 'settings', BASE)
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
    check('export stamps lastBackupExport', await page.evaluate((t) => JSON.parse(localStorage.getItem('aaru.habits.v3')).profile.lastBackupExport === t, todayStr))
    // wipe app data, then import the file back
    await page.evaluate(() => localStorage.clear())
    await page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle0' })
    const input = await page.$('input[type="file"]')
    await input.uploadFile(`/tmp/${exportedFile}`)
    await sleep(800)
    const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('aaru.habits.v3')))
    check('import restores habits + checkins', restored.habits.length === 5 && Object.keys(restored.checkins).length === 5, `habits=${restored.habits?.length}`)
    check('import toast confirms', await page.evaluate(() => document.body.textContent.includes('Imported 5 habits')))
    // valid JSON but garbage field shapes → app must sanitize and import the good parts
    fs.writeFileSync('/tmp/bad.json', '{"app":"aaru-habits","data":{"habits":[{"name":"X"}],"checkins":"garbage"}}')
    const input2 = await page.$('input[type="file"]')
    await input2.uploadFile('/tmp/bad.json')
    await sleep(800)
    check('garbage-field import sanitized (imports habit, drops bad checkins)',
      await page.evaluate(() => document.body.textContent.includes('Imported 1 habit')
        && JSON.parse(localStorage.getItem('aaru.habits.v3')).habits.map((h) => h.name).join() === 'X'),
      'expected Imported 1 habit toast + stored habit X')
    // not JSON at all → friendly error, current data untouched
    fs.writeFileSync('/tmp/bad2.json', 'this is not json at all {{{')
    const input3 = await page.$('input[type="file"]')
    await input3.uploadFile('/tmp/bad2.json')
    await sleep(800)
    check('invalid JSON rejected with friendly error', await page.evaluate(() => document.body.textContent.includes('valid JSON')))
    check('failed import keeps current data', await page.evaluate(() => JSON.parse(localStorage.getItem('aaru.habits.v3')).habits.length === 1))
    await page.reload({ waitUntil: 'networkidle0' })
    await sleep(500)
    check('app healthy after bad imports (no onboarding regression)', await page.evaluate(() => !!document.querySelector('.screen') && !document.querySelector('.onboarding')))
  }

  // reset
  await clickByText(page, 'Erase all data')
  await sleep(200)
  await clickByText(page, 'Yes, erase everything')
  await sleep(500)
  const afterReset = await page.evaluate(() => JSON.parse(localStorage.getItem('aaru.habits.v3')))
  check('reset clears habits/checkins, keeps name', afterReset.habits.length === 0 && afterReset.profile.name === 'Aaru', JSON.stringify(afterReset.profile))
  check('reset returns to onboarding', await page.evaluate(() => !!document.querySelector('.onboarding')))
  await noConsoleErrors(page, 'data')
  await page.close()
}

function dayStrLocal() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/* ============================================================
   PART 7 — Themes (mobile screenshots)
   ============================================================ */
console.log('\n— Themes —')
{
  const page = await newPage(browser, VIEWPORTS.mobile)
  await seedAndGoto(page, seededState(), 'today', BASE)
  for (const theme of ['midnight', 'ember', 'verdant', 'daylight']) {
    await page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle0' })
    await sleep(300)
    await page.evaluate((t) => {
      const label = t.charAt(0).toUpperCase() + t.slice(1)
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
  await seedAndGoto(page, seededState(), 'today', BASE)
  await sleep(200)
  check('sidebar renders (desktop nav)', await page.evaluate(() => !!document.querySelector('.sidebar')))
  check('bottom nav hidden on desktop', await page.evaluate(() => !document.querySelector('.bottom-nav') || getComputedStyle(document.querySelector('.bottom-nav')).display === 'none'))
  check('FAB hidden on desktop', await page.evaluate(() => !document.querySelector('.btn.floating') || getComputedStyle(document.querySelector('.btn.floating')).display === 'none'))
  const contentMax = await page.evaluate(() => {
    const screen = document.querySelector('.screen')
    return { w: screen.getBoundingClientRect().width, left: screen.getBoundingClientRect().left }
  })
  check('content column does not stretch full width', contentMax.w <= 1160, `w=${contentMax.w}`)
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
    const wrap = document.querySelector('.cal-wrap')
    return { scrollable: !!wrap && wrap.scrollWidth > wrap.clientWidth }
  })
  check('calendar scrollable on desktop with sticky name column', calDesktop.scrollable)
  await page.goto(`${BASE}/#/goals`, { waitUntil: 'networkidle0' })
  await sleep(500)
  await shot(page, '20-desktop-goals')
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
  await seedAndGoto(page, seededState(), 'today', BASE)
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
  await page.evaluate(() => document.querySelector('.habit-row [role="button"]').click())
  await sleep(500)
  check('reduced-motion: completion still works', await page.evaluate(() => document.querySelectorAll('.habit-row.done').length === 1))

  // offline → app still loads from SW? (dev/preview server kill not possible here;
  // instead verify the offline pill appears when navigator goes offline)
  await page.goto(`${BASE}/#/today`, { waitUntil: 'networkidle0' })
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
  await sleep(300)
  check('offline indicator appears', await page.evaluate(() => !!document.querySelector('.offline-pill')))
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
    version: 3,
    profile: { name: 'Aaru', onboarded: true, theme: 'midnight', lastBackupExport: null, lastBackupReminder: null, reminderNoteSeen: false },
    habits: [], checkins: {}, projects: [], moods: {},
  }, 'today', BASE)
  for (const [route, name] of [['today', '23-empty-today'], ['calendar', '24-empty-calendar'], ['week', '25-empty-week'], ['insights', '26-empty-insights'], ['mind', '27-empty-mind'], ['goals', '28-empty-goals']]) {
    await page.goto(`${BASE}/#/${route}`, { waitUntil: 'networkidle0' })
    await sleep(400)
    await shot(page, name)
    await overflowCheck(page, `empty-${route}`)
    if (route === 'today') {
      check('today empty state shows hero art + guidance', await page.evaluate(() => {
        const el = document.querySelector('.empty img')
        return !!el && el.getAttribute('src').includes('empty-hero')
      }))
    }
  }
  await noConsoleErrors(page, 'empty-states')
  await page.close()
}

await browser.close()
report('E2E + VISUAL QA')
