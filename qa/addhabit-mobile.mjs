/* Add Habit mobile viewport QA.
 *
 * Opens the New habit dialog at each target width and asserts the dialog is
 * genuinely usable: fits the viewport, footer + primary action reachable,
 * only the form body scrolls, no horizontal overflow, no body-scroll bleed.
 *
 * Usage: node qa/addhabit-mobile.mjs [baseUrl]
 */
import { mkdirSync } from 'fs'
import { launch, newPage, check, results, sleep, seedAndGoto, seededState } from './helpers.mjs'

const BASE = process.argv[2] || 'http://localhost:4173'

const WIDTHS = [
  { w: 320, h: 800 },
  { w: 360, h: 800 },
  { w: 375, h: 812 },
  { w: 390, h: 844 },
  { w: 414, h: 896 },
]

/** Build a state with N habits so we can test the control with a crowded list. */
function stateWithHabits(n) {
  const base = seededState()
  const habits = []
  for (let i = 0; i < n; i++) {
    habits.push({
      id: `bulk-${i}`,
      name: `Habit number ${i + 1}`,
      category: ['fitness', 'learning', 'mind', 'health', 'creative', 'social'][i % 6],
      schedule: { type: 'daily' },
      reminder: null,
      notes: '',
      createdAt: base.habits[0].createdAt,
      archived: false,
      order: i,
    })
  }
  return { ...base, habits, checkins: {} }
}

async function openAddHabit(page) {
  // The add control is present on Today; use the labelled trigger.
  await page.evaluate(() => {
    const els = [...document.querySelectorAll('button, a')]
    const el = els.find((e) => {
      const t = `${e.textContent || ''} ${e.getAttribute('aria-label') || ''}`.toLowerCase()
      return t.includes('add a habit') || t.includes('add habit') || t.includes('new habit')
    })
    if (!el) throw new Error('add habit control not found')
    el.click()
  })
  await sleep(450)
}

/** Geometry of the open dialog relative to the visual viewport. */
async function probe(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('.sheet-panel')
    if (!panel) return null
    const r = panel.getBoundingClientRect()
    const body = panel.querySelector('.sheet-body')
    const footer = panel.querySelector('.sheet-footer')
    const primary = [...panel.querySelectorAll('button')].find((b) =>
      /add habit|create habit|save changes/i.test(b.textContent || '')
    )
    const pr = primary?.getBoundingClientRect()
    const fr = footer?.getBoundingClientRect()
    const vh = window.innerHeight
    const vw = window.innerWidth
    // is the primary action actually the topmost element at its centre?
    let hit = false
    if (pr) {
      const x = pr.left + pr.width / 2
      const y = pr.top + pr.height / 2
      if (y > 0 && y < vh && x > 0 && x < vw) {
        const top = document.elementFromPoint(x, y)
        hit = !!top && (top === primary || primary.contains(top))
      }
    }
    return {
      vw,
      vh,
      panel: { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height },
      hasFooter: !!footer,
      footerBottom: fr ? fr.bottom : null,
      footerTop: fr ? fr.top : null,
      bodyScrollable: body ? body.scrollHeight > body.clientHeight + 1 : false,
      bodyOverflowY: body ? getComputedStyle(body).overflowY : null,
      primaryVisible: hit,
      primaryBottom: pr ? pr.bottom : null,
      docScrollW: document.documentElement.scrollWidth,
      bodyOverflow: getComputedStyle(document.body).overflow,
      scrollLocked: document.documentElement.hasAttribute('data-sheet-open'),
    }
  })
}

async function run() {
  mkdirSync('qa/shots', { recursive: true })
  const browser = await launch()
  console.log(`\nAdd Habit mobile QA → ${BASE}\n`)

  for (const { w, h } of WIDTHS) {
    const page = await newPage(browser, {
      width: w,
      height: h,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    console.log(`— ${w}×${h}`)
    await seedAndGoto(page, seededState(), 'today', BASE)
    await openAddHabit(page)
    const g = await probe(page)
    const tag = `${w}x${h}`

    check(`${tag} dialog present`, !!g)
    if (g) {
      check(`${tag} dialog top within viewport`, g.panel.top >= -1, `top=${g.panel.top.toFixed(1)}`)
      check(`${tag} dialog bottom within viewport`, g.panel.bottom <= g.vh + 1, `bottom=${g.panel.bottom.toFixed(1)} vh=${g.vh}`)
      check(`${tag} has sticky footer`, g.hasFooter)
      check(`${tag} footer inside viewport`, g.footerBottom !== null && g.footerBottom <= g.vh + 1, `footerBottom=${g.footerBottom}`)
      check(`${tag} primary action clickable`, g.primaryVisible === true)
      check(`${tag} form body is the scroll container`, g.bodyOverflowY === 'auto' || g.bodyOverflowY === 'scroll')
      check(`${tag} no horizontal overflow`, g.docScrollW <= g.vw + 1, `scrollW=${g.docScrollW} vw=${g.vw}`)
      check(`${tag} background scroll locked`, g.bodyOverflow === 'hidden' && g.scrollLocked)
    }

    await page.screenshot({ path: `qa/shots/addhabit-${tag}.png` })

    // Expanded state: specific weekdays open + long text, the tallest form.
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.sheet-panel button')].find((x) =>
        /specific days/i.test(x.textContent || '')
      )
      b?.click()
      const name = document.querySelector('#habit-name')
      if (name) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        setter.call(name, 'A very long habit name that should wrap and not break the dialog layout at all')
        name.dispatchEvent(new Event('input', { bubbles: true }))
      }
    })
    await sleep(350)
    const g2 = await probe(page)
    check(`${tag} expanded: dialog still within viewport`, g2 && g2.panel.bottom <= g2.vh + 1 && g2.panel.top >= -1)
    check(`${tag} expanded: primary action still clickable`, g2 && g2.primaryVisible === true)
    // The body must be *able* to scroll; on the tallest viewports the expanded
    // form may still fit outright, which is a pass, not a failure.
    check(`${tag} expanded: content reachable (scrolls or fits)`, !!g2 && (g2.bodyScrollable || g2.panel.bottom <= g2.vh + 1))
    await page.screenshot({ path: `qa/shots/addhabit-${tag}-expanded.png` })
    await page.close()
  }

  // Keyboard-open simulation: shrink the visual viewport the way an on-screen
  // keyboard does, and require the footer + focused field to stay visible.
  {
    const page = await newPage(browser, { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    await seedAndGoto(page, seededState(), 'today', BASE)
    await openAddHabit(page)
    // Emulate a ~336px keyboard by overriding what Sheet.jsx reads.
    await page.evaluate(() => {
      const KB = 336
      const vv = window.visualViewport
      Object.defineProperty(vv, 'height', { configurable: true, get: () => window.innerHeight - KB })
      Object.defineProperty(vv, 'offsetTop', { configurable: true, get: () => 0 })
      vv.dispatchEvent(new Event('resize'))
      document.querySelector('#habit-name')?.focus()
    })
    await sleep(600)
    const g = await page.evaluate(() => {
      const panel = document.querySelector('.sheet-panel')
      const footer = panel.querySelector('.sheet-footer')
      const input = document.querySelector('#habit-name')
      const visH = window.visualViewport.height
      const fr = footer.getBoundingClientRect()
      const ir = input.getBoundingClientRect()
      const pr = panel.getBoundingClientRect()
      return { visH, footerBottom: fr.bottom, footerTop: fr.top, inputTop: ir.top, inputBottom: ir.bottom, panelTop: pr.top }
    })
    check('keyboard open: panel stays above the keyboard', g.footerBottom <= g.visH + 1, `footerBottom=${g.footerBottom.toFixed(1)} visH=${g.visH}`)
    check('keyboard open: panel top still on screen', g.panelTop >= -1, `top=${g.panelTop.toFixed(1)}`)
    check('keyboard open: focused field visible', g.inputTop >= -1 && g.inputBottom <= g.footerTop + 1, `input=${g.inputTop.toFixed(1)}..${g.inputBottom.toFixed(1)} footerTop=${g.footerTop.toFixed(1)}`)
    await page.screenshot({ path: 'qa/shots/addhabit-390x844-keyboard.png' })
    await page.close()
  }

  // Habit-count sweep: the Add Habit control must stay reachable.
  for (const n of [0, 1, 5, 10, 20, 50]) {
    const page = await newPage(browser, { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    await seedAndGoto(page, stateWithHabits(n), 'today', BASE)
    let ok = true
    try {
      await openAddHabit(page)
    } catch {
      ok = false
    }
    const g = await probe(page)
    check(`${n} habits: Add Habit opens and fits`, ok && !!g && g.panel.bottom <= g.vh + 1 && g.primaryVisible === true)
    await page.close()
  }

  // Desktop must stay a centred dialog, not a full-screen sheet.
  {
    const page = await newPage(browser, { width: 1440, height: 900, deviceScaleFactor: 1 })
    await seedAndGoto(page, seededState(), 'today', BASE)
    await openAddHabit(page)
    const g = await probe(page)
    check('desktop: centred dialog (not full-bleed)', !!g && g.panel.left > 100 && g.panel.right < g.vw - 100, g ? `left=${g.panel.left} right=${g.panel.right}` : '')
    check('desktop: dialog within viewport', !!g && g.panel.top >= -1 && g.panel.bottom <= g.vh + 1)
    check('desktop: primary action clickable', !!g && g.primaryVisible === true)
    await page.screenshot({ path: 'qa/shots/addhabit-1440x900.png' })
    await page.close()
  }

  await browser.close()
  console.log(`\n${results.pass} passed, ${results.fail} failed`)
  if (results.fail) {
    for (const f of results.failures) console.log(`  ✗ ${f}`)
    process.exit(1)
  }
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
