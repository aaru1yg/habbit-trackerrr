/* Phase 4 browser journeys and viewport contracts. Run against a local build:
 * node qa/workspace-e2e.mjs http://localhost:4173
 * Chromium launch failures intentionally fail the run (never claim a pass). */
import { mkdirSync } from 'node:fs'
import { launch, newPage, seedAndGoto, check, report, clickByText, sleep } from './helpers.mjs'
import { workspaceFixture } from '../test/workspace.fixture.js'

const base = process.argv[2] || 'http://localhost:4173'
const browser = await launch()
mkdirSync('qa/shots/workspace', { recursive: true })
const viewports = [{ width: 1440, height: 900 }, { width: 390, height: 844, isMobile: true, hasTouch: true }, { width: 430, height: 932, isMobile: true, hasTouch: true }]
const goto = async (page, route) => {
  await page.evaluate(to => { location.hash = `#/${to}` }, route)
  await page.waitForSelector('#work-screen')
  await sleep(600)
}
const assertWidth = async (page, label) => {
  const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: document.documentElement.clientWidth }))
  check(`${label}: no horizontal overflow`, dimensions.scroll <= dimensions.width + 1, JSON.stringify(dimensions))
}
try {
  for (const viewport of viewports) {
    const page = await newPage(browser, { ...viewport, deviceScaleFactor: 1 })
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    const state = workspaceFixture()
    await seedAndGoto(page, state, 'work', base)
    await page.waitForSelector('#work-screen .workspace-summary')
    await sleep(500)
    const prefix = `${viewport.width}x${viewport.height}`
    check(`${prefix}: overview opens without gallery`, !(await page.$('.gal-card')))
    const activeTop = await page.$eval('.workspace-active', el => el.getBoundingClientRect().top)
    check(`${prefix}: active work begins above fold`, activeTop < viewport.height - 80, `top=${activeTop}`)
    await assertWidth(page, prefix)
    await page.screenshot({ path: `qa/shots/workspace/${prefix}-overview.png`, fullPage: true })
    for (const view of ['deliverables', 'projects', 'workload', 'deadlines']) {
      await goto(page, `work?view=${view}`)
      check(`${prefix}: ${view} selected`, await page.$eval(`.workspace-tabs a[href="#/work?view=${view}"]`, el => el.getAttribute('aria-current') === 'page'))
      await assertWidth(page, `${prefix} ${view}`)
    }
    // B: Deliverable → detail → its own focus session.
    await goto(page, 'work?view=deliverables')
    await page.click('[aria-label="View Submit DSA report"]')
    await page.waitForSelector('#assignment-detail')
    await assertWidth(page, `${prefix} assignment detail`)
    await clickByText(page, 'Start Focus', 'button')
    await page.waitForSelector('[role="dialog"] .focus-mode')
    check(`${prefix}: focus names chosen deliverable`, await page.$eval('[role="dialog"]', el => el.textContent.includes('Submit DSA report')))
    await clickByText(page, 'Start', '[role="dialog"] button')
    await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"] button')].some(el => el.textContent === 'Pause'))
    await page.keyboard.press('Escape')
    await page.waitForSelector('[role="dialog"]', { hidden: true })
    // C: Project → task deep link → completion.
    await goto(page, 'work?view=projects')
    await page.click('[aria-label="View Habit OS"]')
    await page.waitForSelector('#project-detail')
    await assertWidth(page, `${prefix} project detail`)
    await page.click('[aria-label="Mark Finish API layer done"]')
    await page.waitForSelector('[aria-label="Mark Finish API layer not done"]')
    // D: Workload overload → existing Plan and Recover.
    await goto(page, 'work?view=workload')
    await clickByText(page, 'Plan', '.workspace-overload button')
    await page.waitForSelector('[role="dialog"] .planning-panel')
    await page.keyboard.press('Escape')
    await page.waitForSelector('[role="dialog"]', { hidden: true })
    await clickByText(page, 'Recover', '.workspace-overload button')
    await page.waitForSelector('[role="dialog"]')
    check(`${prefix}: recovery remains suggestion-only`, await page.$eval('[role="dialog"]', el => el.textContent.includes('nothing moves automatically')))
    await page.keyboard.press('Escape')
    await page.waitForSelector('[role="dialog"]', { hidden: true })
    // E: Today deadline horizon → relevant detail.
    await goto(page, 'work')
    await page.click('.workspace-horizons a[href*="horizon=today"]')
    await page.waitForSelector('#deadlines-heading')
    await page.click('[aria-label="View Submit DSA report"]')
    await page.waitForSelector('#assignment-detail')
    // Keyboard filters and legacy URLs.
    for (const route of ['projects', 'assignments', 'workload', 'timeline']) { await goto(page, route); await assertWidth(page, `${prefix} legacy ${route}`) }
    await goto(page, 'work?view=deliverables')
    await page.focus('button[aria-pressed="false"]')
    await page.keyboard.press('Enter')
    check(`${prefix}: no uncaught errors`, page._qa.pageErrors.length === 0, page._qa.pageErrors.join('; '))
    await page.close()
  }
  report('Phase 4 Work')
} finally { await browser.close() }
