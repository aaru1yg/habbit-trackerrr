/* V4 visual QA — captures the spatial screens + the boot moment. */
import { mkdirSync } from 'fs'
import { launch, newPage, seedAndGoto, seededStateV4, sleep } from './helpers.mjs'

const base = process.argv[2] || 'http://localhost:4173'
mkdirSync('qa/shots/v4', { recursive: true })

const browser = await launch()
const shots = []

async function cap(page, name, wait = 1100) {
  await sleep(wait)
  await page.screenshot({ path: `qa/shots/v4/${name}.png` })
  const errs = page._qa.pageErrors.length + page._qa.consoleErrors.length
  shots.push(`${name} (errors: ${errs})`)
  if (errs) console.log('ERRORS', name, page._qa.pageErrors.slice(0, 3), page._qa.consoleErrors.slice(0, 3))
}

/* ---- desktop spatial screens, seeded ---- */
const d1440 = { width: 1440, height: 900, deviceScaleFactor: 1 }
const p1 = await newPage(browser, d1440)
for (const route of ['today', 'projects', 'goals', 'assignments', 'insights', 'achievements', 'workload']) {
  await seedAndGoto(p1, seededStateV4(), route, base)
  await cap(p1, `d1440-${route}`)
}
await p1.close()

/* ---- boot overlay (forced via QA hook) on a fresh unseeded visit ---- */
const p2 = await newPage(browser, d1440)
await p2.setViewport(d1440)
await p2.evaluateOnNewDocument?.(() => {})
await p2.goto(`${base}/#/today`, { waitUntil: 'domcontentloaded' })
await p2.evaluate(() => {
  try { localStorage.setItem('aaru.boot', 'on'); sessionStorage.clear() } catch { /* */ }
})
await p2.reload({ waitUntil: 'domcontentloaded' })
await sleep(700)
await p2.screenshot({ path: 'qa/shots/v4/d1440-boot.png' })
shots.push('d1440-boot')
await p2.close()

/* ---- auth experience (no session) ---- */
const p3 = await newPage(browser, d1440)
await p3.evaluateOnNewDocument?.(() => {})
await p3.goto(base, { waitUntil: 'domcontentloaded' })
await sleep(700)
await p3.screenshot({ path: 'qa/shots/v4/d1440-landing.png' })
shots.push('d1440-landing')
await p3.close()

/* ---- mobile simplification ---- */
const m390 = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
const p4 = await newPage(browser, m390)
for (const route of ['today', 'projects', 'assignments']) {
  await seedAndGoto(p4, seededStateV4(), route, base)
  await cap(p4, `m390-${route}`)
}
/* horizontal overflow guard on the new surfaces */
for (const route of ['today', 'projects', 'goals', 'assignments', 'insights', 'achievements']) {
  await seedAndGoto(p4, seededStateV4(), route, base)
  await sleep(800)
  const r = await p4.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  }))
  const ok = r.scrollW <= r.clientW + 1
  console.log(`m390-${route} overflow: ${ok ? 'none' : `scrollW=${r.scrollW} clientW=${r.clientW}`}`)
  if (!ok) process.exitCode = 1
}
await p4.close()

await browser.close()
console.log(shots.join('\n'))
