/* Screenshot capture for visual QA.
 * Usage: node qa/shots.mjs [baseUrl] [tag]
 * Writes qa/shots/<tag>/<viewport>-<route>.png
 */
import { mkdirSync } from 'fs'
import { launch, newPage, seedAndGoto, seededStateV4, sleep, VIEWPORTS } from './helpers.mjs'

const base = process.argv[2] || 'http://localhost:5173'
const tag = process.argv[3] || 'current'
const only = process.argv[4] ? process.argv[4].split(',') : null

const VIEWPORTS_TO_USE = {
  m390: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  m430: { width: 430, height: 932, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  t768: { width: 768, height: 1024, deviceScaleFactor: 1 },
  d1440: { width: 1440, height: 900, deviceScaleFactor: 1 },
}

const ROUTES = [
  'today', 'calendar', 'week', 'habits', 'goals', 'projects', 'assignments',
  'workload', 'timeline', 'insights', 'mind', 'library', 'record', 'settings',
  'achievements', 'habits/h-run',
]

const dir = `qa/shots/${tag}`
mkdirSync(dir, { recursive: true })

const browser = await launch()
try {
  for (const [vname, viewport] of Object.entries(VIEWPORTS_TO_USE)) {
    if (only && !only.includes(vname)) continue
    const page = await newPage(browser, viewport)
    for (const route of ROUTES) {
      await seedAndGoto(page, seededStateV4(), route, base)
      await sleep(900)
      await page.screenshot({ path: `${dir}/${vname}-${route}.png` })
      const errs = page._qa.pageErrors.length + page._qa.consoleErrors.length
      console.log(`${vname}-${route}  (errors: ${errs})`)
    }
    await page.close()
  }
} finally {
  await browser.close()
}
console.log('done →', dir)
