/* Visual audit: fresh screenshots of every major screen at both viewports.
 * fullPage is unusable here (fixed .backdrop + fixed navs), so we capture
 * viewport-sized segments while scrolling, which is what the user actually sees.
 * Usage: node qa/audit.mjs <outDir> */
import { mkdirSync } from 'fs'
import { launch, newPage, VIEWPORTS, seededStateV4, seedAndGoto, sleep } from './helpers.mjs'

const outDir = process.argv[2] || 'qa/shots/before'
const BASE = 'http://localhost:4173'
const MAX_SEG = 4

const ROUTES = [
  ['today', ''], ['calendar', 'calendar'], ['week', 'week'], ['insights', 'insights'],
  ['mind', 'mind'], ['projects', 'projects'], ['project-detail', 'projects/p1'],
  ['assignments', 'assignments'], ['assignment-detail', 'assignments/a1'],
  ['workload', 'workload'], ['goals', 'goals'], ['library', 'library'],
  ['timeline', 'timeline'], ['settings', 'settings'],
]

const browser = await launch()
const issues = []
try {
  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    mkdirSync(`${outDir}/${vpName}`, { recursive: true })
    const page = await newPage(browser, vp)
    for (const [name, route] of ROUTES) {
      await seedAndGoto(page, seededStateV4(), route, BASE)
      await sleep(700)
      const h = await page.evaluate(() => document.documentElement.scrollHeight)
      const segs = Math.min(MAX_SEG, Math.max(1, Math.ceil(h / vp.height)))
      for (let i = 0; i < segs; i++) {
        await page.evaluate((y) => window.scrollTo(0, y), i * vp.height)
        await sleep(350)
        const suffix = segs > 1 ? `-${i + 1}` : ''
        await page.screenshot({ path: `${outDir}/${vpName}/${name}${suffix}.png` })
      }
      await page.evaluate(() => window.scrollTo(0, 0))

      // Real overflow only: ignore decorative fixed blobs and anything living
      // inside a legitimate horizontal scroll container.
      const info = await page.evaluate(() => {
        const de = document.documentElement
        const bad = []
        for (const el of document.querySelectorAll('body *')) {
          const cls = (el.className?.baseVal ?? el.className ?? '').toString()
          if (/aurora-blob|backdrop/.test(cls)) continue
          if (getComputedStyle(el).position === 'fixed') continue
          let scroller = false
          for (let p = el.parentElement; p; p = p.parentElement) {
            const ox = getComputedStyle(p).overflowX
            if (ox === 'auto' || ox === 'scroll') { scroller = true; break }
          }
          if (scroller) continue
          const r = el.getBoundingClientRect()
          if (r.width > 0 && (r.right > de.clientWidth + 1 || r.left < -1)) {
            bad.push(`${el.tagName}.${cls.split(' ')[0]}[${Math.round(r.left)},${Math.round(r.right)}]`)
          }
        }
        return { hScroll: de.scrollWidth > de.clientWidth + 1, bad: [...new Set(bad)].slice(0, 6) }
      })
      if (info.hScroll || info.bad.length) issues.push(`${vpName}/${name}: ${info.hScroll ? 'H-SCROLL ' : ''}${info.bad.join(' | ')}`)

      // Touch-target audit (mobile only): interactive elements under 44px.
      if (vpName === 'mobile') {
        const small = await page.evaluate(() => {
          const out = []
          for (const el of document.querySelectorAll('button, a, input, select, [role="button"]')) {
            const r = el.getBoundingClientRect()
            if (r.width === 0 || r.height === 0) continue
            if (el.type === 'file' || el.type === 'range') continue
            if (r.height >= 44 && r.width >= 32) continue
            // A small box is fine if the real hit area (::after pads etc.) is 44px:
            // probe ±21px from the centre and see if we still land on the control.
            el.scrollIntoView({ block: 'center' })
            const b = el.getBoundingClientRect()
            const cx = Math.round(b.left + b.width / 2)
            const cy = Math.round(b.top + b.height / 2)
            const hits = (dy) => { const t = document.elementFromPoint(cx, cy + dy); return !!t && (t === el || el.contains(t)) }
            if (hits(-21) && hits(21)) continue
            const label = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24)
            out.push(`${el.tagName}"${label}" ${Math.round(r.width)}x${Math.round(r.height)}`)
          }
          return [...new Set(out)].slice(0, 8)
        })
        if (small.length) issues.push(`TOUCH ${name}: ${small.join(' | ')}`)
      }
      const errs = [...page._qa.pageErrors, ...page._qa.consoleErrors]
      if (errs.length) issues.push(`JS ${vpName}/${name}: ${errs.slice(0, 2).join(' ; ')}`)
      console.log(`  captured ${vpName}/${name} (${segs} seg)`)
    }
    await page.close()
  }
} finally { await browser.close() }

console.log('\n=== ISSUES ===')
console.log(issues.length ? issues.join('\n') : 'none')
