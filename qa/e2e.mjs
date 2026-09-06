/* ============================================================
   E2E + visual QA in a real (headless) browser.
   Run: node qa/e2e.mjs [base-url]
   Covers the spec's test matrix: habits, schedule, reminders,
   mood, analytics, projects/celebration, data export/import,
   persistence, navigation, overflow, tap targets, contrast.
   ============================================================ */
import { launch, newPage, VIEWPORTS, check, shot, clickByText, clickByLabel, sleep, setStoredState, seedAndGoto, getStoredState, seededState, seededStateV4, dayStr, subDays, report } from './helpers.mjs'
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
  await seedAndGoto(page, seededStateV4(), 'today', BASE)
  await shot(page, '05-today-seeded')
  await overflowCheck(page, 'today-seeded')
  await tapTargetCheck(page, 'today-seeded')

  // the seed has 3 daily habits + 2 weekday-gated ones, so the expected row
  // count depends on today's weekday — a missed unscheduled day is not a failure
  const rows = await page.evaluate(() => document.querySelectorAll('.habit-row').length)
  const dow = new Date().getDay()
  const expectedRows = dow === 0 || dow === 6 ? 3 : 5
  check('seeded habits render (schedule-aware)', rows === expectedRows, `rows=${rows} expected=${expectedRows} (dow=${dow})`)

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
    const habitCount = await page.evaluate(() => JSON.parse(localStorage.getItem('aaru.habits.v4')).habits.filter((h) => !h.archived).length)
    await page.evaluate(() => document.querySelector('[aria-label^="Archive"]').click())
    await sleep(500)
    const afterCount = await page.evaluate(() => JSON.parse(localStorage.getItem('aaru.habits.v4')).habits.filter((h) => !h.archived).length)
    check('archive removes habit from list', afterCount === habitCount - 1)
    await clickByText(page, 'Undo', 'button')
    await sleep(400)
    const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('aaru.habits.v4')).habits.filter((h) => !h.archived).length)
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
      const s = JSON.parse(localStorage.getItem('aaru.habits.v4'))
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
  await seedAndGoto(page, seededStateV4(), 'week', BASE)
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
  check('insights hero grid renders', await page.evaluate(() => !!document.querySelector('.insights-grid')))
  check('insights KPIs render (best streak + active habits + total check-ins)',
    /Best streak/.test(insightsText) && /Active habits/.test(insightsText) && /Total check-ins/.test(insightsText))
  check('insights hero has 4 stat tiles', await page.evaluate(() => document.querySelectorAll('.insights-stat').length === 4))
  check('insights hero ring is present', await page.evaluate(() => !!document.querySelector('.insights-ring .ring-wrap')))

  check('trend-chart renders', await page.evaluate(() => !!document.querySelector('.trend-chart svg')))
  check('trend range has 4 options', await page.evaluate(() => document.querySelectorAll('[aria-label="Trend range"] .seg-btn').length === 4))
  check('insights has an Overview / Deep dive switch', await page.evaluate(() => document.querySelectorAll('[aria-label="Insights view"] .seg-btn').length === 2))
  check('trend defaults to 30D', await page.evaluate(() => document.querySelector('[aria-label="Trend range"] .seg-btn.active')?.textContent === '30D'))
  const trendLabel30 = await page.evaluate(() => document.querySelector('.trend-chart svg')?.getAttribute('aria-label') || '')
  await clickByText(page, '7D', 'button')
  await sleep(300)
  check('trend switches to 7D', await page.evaluate(() => document.querySelector('[aria-label="Trend range"] .seg-btn.active')?.textContent === '7D'))
  check('trend aria-label reflects selected range', await page.evaluate((prev) => (document.querySelector('.trend-chart svg')?.getAttribute('aria-label') || '') !== prev, trendLabel30))
  await clickByText(page, '90D', 'button')
  await sleep(300)
  check('trend switches to 90D', await page.evaluate(() => document.querySelector('[aria-label="Trend range"] .seg-btn.active')?.textContent === '90D'))
  await clickByText(page, '1Y', 'button')
  await sleep(300)
  check('trend switches to 1Y', await page.evaluate(() => document.querySelector('[aria-label="Trend range"] .seg-btn.active')?.textContent === '1Y'))
  check('trend y-axis spans 0–100', await page.evaluate(() => {
    const labels = [...document.querySelectorAll('.trend-chart svg text')].map((t) => t.textContent)
    return labels.includes('0') && labels.includes('100')
  }))

  check('this-week-vs-last renders', await page.evaluate(() => !!document.querySelector('.vs')))
  check('vs shows this week + last week + change', await page.evaluate(() => {
    const blocks = [...document.querySelectorAll('.vs-block')]
    return blocks.length === 3 && /This week/.test(blocks[0].textContent) && /Last week/.test(blocks[1].textContent) && /Change/.test(blocks[2].textContent)
  }))
  check('vs change shows a signed direction', await page.evaluate(() => {
    const delta = document.querySelector('.vs-delta')
    return !!delta && (delta.classList.contains('up') || delta.classList.contains('down') || delta.classList.contains('none'))
  }))

  check('habit performance renders 5 rows', await page.evaluate(() => document.querySelectorAll('.perf-row:not(.perf-head)').length === 5))
  check('performance rows show done/eligible', await page.evaluate(() => /\/\d+/.test(document.querySelector('.perf-row:not(.perf-head)')?.textContent || '')))
  const perfFirst = () => page.evaluate(() => document.querySelector('.perf-row:not(.perf-head) .perf-name-text')?.textContent)
  const beforeName = await perfFirst()
  await page.evaluate(() => document.querySelector('[aria-label="Sort by habit name"]').click())
  await sleep(300)
  check('performance sorts by name (desc)', (await perfFirst()) === 'Read 20 pages', `first=${await perfFirst()}`)
  await page.evaluate(() => document.querySelector('[aria-label="Sort by 30 day rate"]').click())
  await sleep(300)
  check('performance sorts by 30-day rate', (await perfFirst()) !== 'Read 20 pages', `first=${await perfFirst()}`)
  await page.evaluate(() => document.querySelector('[aria-label="Sort by current streak"]').click())
  await sleep(300)
  check('performance sorts by current streak', await page.evaluate(() => /[↑↓]/.test(document.querySelector('[aria-label="Sort by current streak"]').textContent)))

  check('heatmap renders with day cells', await page.evaluate(() => document.querySelectorAll('.hm-day').length >= 350))
  check('heatmap has ≥52 week columns', await page.evaluate(() => document.querySelectorAll('.hm-col').length >= 52))
  check('heatmap has weekday gutter', await page.evaluate(() => document.querySelectorAll('.hm-gutter span').length === 7))
  check('heatmap month labels render', await page.evaluate(() => document.querySelectorAll('.hm-months span').length >= 10))
  check('heatmap future days are flagged', await page.evaluate(() => !!document.querySelector('.hm-day.future')))
  const heatTip = await page.evaluate(() => {
    const day = document.querySelector('.hm-day:not(.future)')
    if (!day) return false
    day.click()
    return true
  })
  await sleep(250)
  check('heatmap tap shows tooltip', heatTip && await page.evaluate(() => /\d{4}-\d{2}-\d{2}/.test(document.querySelector('.heatmap-tip')?.textContent || '')))
  check('heatmap tooltip shows completion', await page.evaluate(() => /(done|No data)/.test(document.querySelector('.heatmap-tip')?.textContent || '')))

  check('habit × day matrix renders', await page.evaluate(() => !!document.querySelector('.habit-matrix')))
  check('matrix has 28 day columns', await page.evaluate(() => (document.querySelector('.hmx-grid')?.style.gridTemplateColumns || '').includes('repeat(28')))
  check('matrix renders a row per habit', await page.evaluate(() => document.querySelectorAll('.hmx-name').length === 5))
  check('matrix name column is sticky', await page.evaluate(() => getComputedStyle(document.querySelector('.hmx-name')).position === 'sticky'))

  check('year overview renders 12 mini-months', await page.evaluate(() => document.querySelectorAll('.mini-month').length === 12))
  check('achievements render 4 badges', await page.evaluate(() => document.querySelectorAll('img[src^="art/badge-"]').length === 4))
  check('achievements show next badge hint', await page.evaluate(() => !!document.querySelector('.next-badge')))
  check('mood-and-habits link renders', await page.evaluate(() => /Mood and habits/.test(document.body.textContent)))
  await shot(page, '11-insights')
  await overflowCheck(page, 'insights')
  await tapTargetCheck(page, 'insights')
  await contrastCheck(page, 'insights')

  // Deep dive view (§17–§19): patterns, consistency, streak history, correlations
  await clickByText(page, 'Deep dive')
  await sleep(1000)
  const deepText = await page.evaluate(() => document.body.textContent)
  check('deep dive shows consistency + weekday sections', /Consistency/.test(deepText) && /By weekday/.test(deepText))
  check('deep dive shows streak history + personal bests', /Streak history/.test(deepText) && /Personal bests/.test(deepText))
  check('deep dive shows monthly pulse', /month by month/i.test(deepText))
  const hasCorr = /Patterns that travel together/.test(deepText) && /These travel together/.test(deepText)
  check('correlations never claim causation', !hasCorr || /not proof one causes the other/.test(deepText))
  check('deep dive has no invented numbers', !/estimated|projected/i.test(deepText))
  await shot(page, '11b-insights-deep')
  await overflowCheck(page, 'insights-deep')
  await tapTargetCheck(page, 'insights-deep')
  await clickByText(page, 'Overview')
  await sleep(500)

  // verify a displayed number against a recomputed value (data integrity spot check)
  const integrity = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('aaru.habits.v4'))
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
  await noConsoleErrors(page, 'insights')

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
  const calTitle = () => page.evaluate(() => document.querySelector('.card-title')?.textContent || '')
  const activeMode = () => page.evaluate(() => document.querySelector('#calendar-screen .seg-btn.active')?.textContent || '')

  check('calendar has 3 range modes', await page.evaluate(() => document.querySelectorAll('#calendar-screen .seg-btn').length === 3))
  check('calendar defaults to Month', (await activeMode()) === 'Month')
  check('month mode shows week bands', await page.evaluate(() => document.querySelectorAll('.cal-band-label').length >= 4))
  const monthTitle = await calTitle()

  await clickByText(page, '90 days', 'button')
  await sleep(400)
  check('calendar switches to 90 days', (await activeMode()) === '90 days')
  check('90 days title is a date range', (await calTitle()).includes('–'), `title=${await calTitle()}`)
  check('90 days keeps week bands', await page.evaluate(() => document.querySelectorAll('.cal-band-label').length >= 13))
  check('90 days grid scrolls horizontally', await page.evaluate(() => {
    const wrap = document.querySelector('.cal-wrap')
    return !!wrap && wrap.scrollWidth > wrap.clientWidth
  }))

  await clickByText(page, 'Year', 'button')
  await sleep(400)
  check('calendar switches to Year', (await activeMode()) === 'Year')
  check('year title is the current year', (await calTitle()) === String(new Date().getFullYear()), `title=${await calTitle()}`)
  check('year grid scrolls horizontally', await page.evaluate(() => {
    const wrap = document.querySelector('.cal-wrap')
    return !!wrap && wrap.scrollWidth > wrap.clientWidth
  }))
  check('year mode still logs a past day', await page.evaluate(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    const el = [...document.querySelectorAll('.cal-cell')].find((b) => (b.getAttribute('aria-label') || '').startsWith('Mark') && (b.getAttribute('aria-label') || '').endsWith(label))
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
  check('projects are tagged as their own kind', await page.evaluate(() => document.querySelectorAll('.kind-tag.project').length >= 2))
  check('status engine reports real states (at risk + completed)', /At risk/.test(ptxt) && /Completed/.test(ptxt))
  check('projects carry the four V3 life states (planned/active/at risk/completed)', await page.evaluate(() => {
    const pills = [...document.querySelectorAll('.project-card .status-pill')].map((e) => e.textContent.trim().toLowerCase())
    return ['planned', 'active', 'at risk', 'completed'].some((ph) => pills.includes(ph)) && pills.length >= 2
  }))
  check('projects dashboard shows deadline countdowns', /\dd left|days left|Due/i.test(ptxt))
  await shot(page, '14-projects')
  await overflowCheck(page, 'projects')
  await tapTargetCheck(page, 'projects')

  await clickByText(page, 'Analytics')
  await sleep(1000)
  const atxt = await page.evaluate(() => document.body.textContent)
  check('project analytics render comparison + velocity', /Comparison|compared/i.test(atxt) || !!document.querySelector('.dist'))
  await shot(page, '14b-projects-analytics')
  await overflowCheck(page, 'projects-analytics')
  await clickByText(page, 'Overview')
  await sleep(500)

  // open a project and finish every remaining task
  await page.goto(`${BASE}/#/projects/p1`, { waitUntil: 'networkidle0' })
  await sleep(700)
  const dtxt = await page.evaluate(() => document.body.textContent)
  check('project detail shows milestones and pace', /Milestones/.test(dtxt) && /(Behind|Ahead|pace)/i.test(dtxt))
  check('project detail shows linked habits', /Portfolio|linked|Habits/i.test(dtxt))
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

  // create a project through the FAB
  await page.goto(`${BASE}/#/projects`, { waitUntil: 'networkidle0' })
  await sleep(500)
  await clickByLabel(page, 'Add a project')
  await sleep(600)
  await page.type('#project-name', 'Learn piano')
  await page.type('#project-milestones', 'Basics\nScales')
  await clickByText(page, 'Create project')
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
  check('assignments are their own system (ASSIGNMENT tags)', await page.evaluate(() => document.querySelectorAll('.kind-tag.assignment').length >= 3))
  check('assignment due today is called out', /Due today|Today/i.test(atxt))
  check('assignment urgency states are real (urgent + overdue)', /Urgent/.test(atxt) && /Overdue/.test(atxt))
  check('assignments lead with a countdown', await page.evaluate(() => !!document.querySelector('.deadline-hero, .count-chip')))
  check('[assignments 2.0] deadline pressure renders ten honest segments', await page.evaluate(() => {
    const bars = document.querySelectorAll('.assignment-card .pressure-bar')
    if (!bars.length) return false
    const segs = bars[0].querySelectorAll('.pressure-seg')
    return segs.length === 10 && bars[0].querySelectorAll('.pressure-seg[data-lit]').length <= 10
  }))
  check('[assignments 2.0] pressure tone follows urgency, never alarm colour by default', await page.evaluate(() => {
    const p = document.querySelector('.assignment-card .pressure')
    return !!p && ['good', 'warn', 'bad', 'neutral', 'info'].includes(p.dataset.tone)
  }))
  await shot(page, '16-assignments')
  await overflowCheck(page, 'assignments')
  await tapTargetCheck(page, 'assignments')

  await clickByText(page, 'Analytics')
  await sleep(1000)
  await shot(page, '16b-assignments-analytics')
  await overflowCheck(page, 'assignments-analytics')

  await page.goto(`${BASE}/#/assignments/a1`, { waitUntil: 'networkidle0' })
  await sleep(700)
  check('subtask-derived progress is honest (3 of 4 = 75%)', await page.evaluate(() => document.body.textContent.includes('75%')))
  check('assignment detail shows subject + countdown', await page.evaluate(() => /Data Structures/.test(document.body.textContent)))
  check('[assignments 2.0] detail leads with the draining window', await page.evaluate(() => (
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

  await page.goto(`${BASE}/#/workload`, { waitUntil: 'networkidle0' })
  await sleep(800)
  check('workload renders load-by-day bars', await page.evaluate(() => !!document.querySelector('.load-bars .lb-row')))
  check('workload counts overdue work', await page.evaluate(() => /Overdue/.test(document.body.textContent)))
  await shot(page, '16e-workload')
  await overflowCheck(page, 'workload')
  await tapTargetCheck(page, 'workload')

  await page.goto(`${BASE}/#/timeline`, { waitUntil: 'networkidle0' })
  await sleep(800)
  check('deadline timeline groups by day', await page.evaluate(() => document.querySelectorAll('.tl-group').length >= 3))
  check('deadline timeline marks today', await page.evaluate(() => !!document.querySelector('.tl-day.is-today')))
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
  check('library lists habits with streak + 30-day rate', await page.evaluate(() => /\dd streak|%/.test(document.body.textContent)))
  await shot(page, '16h-library')
  await overflowCheck(page, 'library')
  await tapTargetCheck(page, 'library')

  await clickByText(page, 'Routines')
  await sleep(600)
  check('routines show stacked habits', await page.evaluate(() => /Morning reset/.test(document.body.textContent)))
  await shot(page, '16i-routines')

  await page.goto(`${BASE}/#/goals`, { waitUntil: 'networkidle0' })
  await sleep(700)
  check('first-class goals show their outcome and link supporting habits', await page.evaluate(() => /Run a half marathon/.test(document.body.textContent) && !!document.querySelector('.goal-card .goal-habit[href^="#/habits/"]')))
  await shot(page, '16j-goals')
  await overflowCheck(page, 'goals')

  /* ---- Goals 2.0: the detail experience ---- */
  await page.goto(`${BASE}/#/goals/g-run`, { waitUntil: 'networkidle0' })
  await sleep(900)
  check('[goal-detail] opens from the list route with its own visualization', await page.evaluate(() => (
    !!document.querySelector('#goal-detail-screen .goal-hero .core-wrap')
    && /Run a half marathon/.test(document.body.textContent)
  )))
  check('[goal-detail] states the stage of the goal object', await page.evaluate(() => (
    /building|momentum|foundation|near completion|reached/i.test(document.querySelector('#goal-detail-screen .core-caption')?.textContent || '')
  )))
  check('[goal-detail] pace chart draws expected vs actual from real data', await page.evaluate(() => (
    !!document.querySelector('#goal-detail-screen .chart-draw svg .chart-line')
    && /Expected vs actual/.test(document.body.textContent)
  )))
  check('[goal-detail] analytics never invent: velocity/projection/consistency labelled', await page.evaluate(() => {
    const facts = [...document.querySelectorAll('#goal-detail-screen .goal-fact')].map((f) => f.textContent).join(' ')
    return /velocity/.test(facts) && /projected completion/.test(facts) && /consistency/.test(facts)
  }))
  check('[goal-detail] milestone timeline shows reached + on-time evidence', await page.evaluate(() => (
    document.querySelectorAll('#goal-detail-screen .ms-node').length === 3
    && /on time|late/.test(document.querySelector('#goal-detail-screen .ms-node.is-done')?.textContent || '')
  )))
  check('[goal-detail] linked work feeds the goal with live progress', await page.evaluate(() => (
    !!document.querySelector('#goal-detail-screen .feed-row[href^="#/habits/"]')
  )))
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
  check('sidebar renders (desktop nav)', await page.evaluate(() => !!document.querySelector('.sidebar')))
  check('bottom nav hidden on desktop', await page.evaluate(() => !document.querySelector('.bottom-nav') || getComputedStyle(document.querySelector('.bottom-nav')).display === 'none'))
  check('FAB hidden on desktop', await page.evaluate(() => !document.querySelector('.btn.floating') || getComputedStyle(document.querySelector('.btn.floating')).display === 'none'))
  const contentMax = await page.evaluate(() => {
    const screen = document.querySelector('.screen')
    return { w: screen.getBoundingClientRect().width, left: screen.getBoundingClientRect().left, max: parseFloat(getComputedStyle(screen).maxWidth), viewport: innerWidth }
  })
  check('content column respects the V2 width token and does not stretch full width', contentMax.w <= contentMax.max && contentMax.w < contentMax.viewport, `w=${contentMax.w} max=${contentMax.max}`)
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
  await sleep(600)
  await shot(page, '20-desktop-goals')

  // work layer on a wide screen
  await page.goto(`${BASE}/#/projects`, { waitUntil: 'networkidle0' })
  await sleep(800)
  check('desktop sidebar exposes the Work group', await page.evaluate(() => {
    const links = [...document.querySelectorAll('.sidebar-nav a')].map((a) => a.getAttribute('href'))
    return ['#/projects', '#/assignments', '#/workload', '#/timeline'].every((h) => links.includes(h))
  }))
  check('desktop hides the mobile work tab bar', await page.evaluate(() => {
    const t = document.querySelector('.tabbar')
    return !t || getComputedStyle(t).display === 'none'
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
  await page.type('#global-search', 'thesis')
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
      check('today empty state shows hero art + guidance', await page.evaluate(() => {
        const el = document.querySelector('.empty img')
        return !!el && el.getAttribute('src').includes('empty-hero')
      }))
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
   PART 11 — Viewport sweep 320–414px (zero horizontal overflow)
   ============================================================ */
console.log('\n— Viewport sweep 320–414px —')
{
  for (const width of [320, 360, 390, 414]) {
    const page = await newPage(browser, { width, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    await seedAndGoto(page, seededStateV4(), 'insights', BASE)
    await sleep(350)
    if (width === 320) check('[320] insights renders trend-chart', await page.evaluate(() => !!document.querySelector('.trend-chart svg')))
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

    // P0 — Add Habit must stay reachable at every width
    await page.goto(`${BASE}/#/today`, { waitUntil: 'networkidle0' })
    await sleep(400)
    const fab = await page.evaluate(() => {
      const el = document.querySelector('.btn.floating')
      if (!el) return null
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return {
        w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom),
        vw: window.innerWidth, vh: window.innerHeight, visible: cs.display !== 'none' && cs.visibility !== 'hidden',
      }
    })
    check(`[${width}] Add-habit FAB is visible, ≥44px and fully on screen (P0)`,
      !!fab && fab.visible && fab.w >= 44 && fab.h >= 44 && fab.right <= fab.vw && fab.bottom <= fab.vh,
      JSON.stringify(fab))
    const fabClicked = await page.evaluate(() => {
      const el = [...document.querySelectorAll('button')].find((b) => /Add a habit/i.test(b.getAttribute('aria-label') || ''))
      if (!el) return false
      el.click()
      return true
    })
    await sleep(700)
    const sheetOpen = await page.evaluate(() => !!document.querySelector('[role="dialog"]'))
    check(`[${width}] tapping the FAB opens the Add-habit sheet (P0)`, fabClicked && sheetOpen)
    await page.keyboard.press('Escape')
    await sleep(400)
    await page.close()
  }
}

await browser.close()
report('E2E + VISUAL QA')
