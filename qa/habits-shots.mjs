/* ============================================================
   PHASE 5 — Habits screenshots + layout facts at the three target
   viewports (390×844, 430×932, 1440×900).

     QA_LIBRARY_PATH=… node qa/habits-shots.mjs http://localhost:4173

   Writes qa/shots/phase5-after/*.png (gitignored, regenerable) and
   prints one row per route: title, document x-overflow (must be 0),
   page height, calendar scroll width and the first card title.
   ============================================================ */
import { launch, newPage, seedAndGoto, seededStateV4, sleep, VIEWPORTS } from './helpers.mjs'
import { mkdirSync } from 'node:fs'
const BASE = (process.argv[2] || 'http://localhost:4173').replace(/\/$/, '')
const DIR = 'qa/shots/phase5-after'
mkdirSync(DIR, { recursive: true })
const browser = await launch()
const sizes = { m390: { width: 390, height: 844, isMobile: true, hasTouch: true }, m430: { width: 430, height: 932, isMobile: true, hasTouch: true }, desktop: VIEWPORTS.desktop }
const routes = ['habits', 'habits?view=routines', 'habits?view=calendar', 'habits?view=week', 'habits/h-run', 'library', 'calendar', 'week', 'today']
const out = []
for (const [vn, vp] of Object.entries(sizes)) {
  const page = await newPage(browser, vp)
  for (const r of routes) {
    await seedAndGoto(page, seededStateV4(), r, BASE)
    await sleep(900)
    const m = await page.evaluate(() => ({ hash: location.hash, title: document.querySelector('main .screen-title')?.textContent.trim(), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, height: document.documentElement.scrollHeight, calWrapScroll: (() => { const w = document.querySelector('.cal-wrap'); return w ? w.scrollWidth - w.clientWidth : null })(), firstCardTitle: document.querySelector('.card-title')?.textContent.trim(), h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()), h2: [...document.querySelectorAll('h2')].map((h) => h.textContent.trim()).slice(0, 8) }))
    out.push({ vp: vn, route: r, ...m })
    await page.screenshot({ path: `${DIR}/${vn}-${r.replace(/[?=/]/g, '_')}.png`, fullPage: false })
  }
  // empty state — hop through about:blank so the seeding init script re-runs
  // (a hash-only goto would keep the previous state)
  await page.goto('about:blank')
  await seedAndGoto(page, { ...seededStateV4(), habits: [], checkins: {}, routines: [] }, 'habits', BASE)
  await sleep(700)
  await page.screenshot({ path: `${DIR}/${vn}-habits-empty.png`, fullPage: false })
  out.push({ vp: vn, route: 'habits(empty)', ...(await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, text: document.body.textContent.includes("You don't have any habits yet."), imgs: [...document.querySelectorAll('.empty img')].map((i) => i.getAttribute('src')) }))) })
  await page.close()
}
console.table(out.map((o) => ({ vp: o.vp, route: o.route, title: o.title, overflow: o.overflow, height: o.height, calScroll: o.calWrapScroll, first: o.firstCardTitle })))
console.log(JSON.stringify(out.filter((o) => o.route === 'habits/h-run').map((o) => o.h2)))
await browser.close()
