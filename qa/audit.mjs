/* Programmatic visual audit — overflow, tap targets, contrast, console errors.
 * Usage: node qa/audit.mjs [baseUrl]
 */
import { launch, newPage, seedAndGoto, seededStateV4, sleep } from './helpers.mjs'

const base = process.argv[2] || 'http://localhost:5173'

const VIEWPORTS = [
  ['320x800', { width: 320, height: 800, isMobile: true, hasTouch: true }],
  ['360x800', { width: 360, height: 800, isMobile: true, hasTouch: true }],
  ['375x812', { width: 375, height: 812, isMobile: true, hasTouch: true }],
  ['390x844', { width: 390, height: 844, isMobile: true, hasTouch: true }],
  ['414x896', { width: 414, height: 896, isMobile: true, hasTouch: true }],
  ['430x932', { width: 430, height: 932, isMobile: true, hasTouch: true }],
  ['768x1024', { width: 768, height: 1024 }],
  ['1024x768', { width: 1024, height: 768 }],
  ['1440x900', { width: 1440, height: 900 }],
  ['1920x1080', { width: 1920, height: 1080 }],
]

const ROUTES = [
  'today', 'calendar', 'week', 'goals', 'projects', 'assignments',
  'workload', 'timeline', 'insights', 'mind', 'library', 'record', 'settings',
]

const findings = []
const note = (v, r, kind, msg) => findings.push({ v, r, kind, msg })

const browser = await launch()
try {
  for (const [vname, viewport] of VIEWPORTS) {
    const page = await newPage(browser, viewport)
    for (const route of ROUTES) {
      await seedAndGoto(page, seededStateV4(), route, base)
      await sleep(700)
      const res = await page.evaluate(() => {
        const out = { overflow: [], tiny: [], docOverflow: 0, innerW: 0 }
        const de = document.documentElement
        out.docOverflow = de.scrollWidth - de.clientWidth
        out.innerW = window.innerWidth
        const vw = window.innerWidth
        const clipped = (el) => {
          // ignore anything whose ancestor deliberately scrolls or clips
          let p = el.parentElement
          while (p && p !== document.body) {
            const cs = getComputedStyle(p)
            if (/(auto|scroll|hidden)/.test(cs.overflowX) || cs.overflow === 'hidden') return true
            p = p.parentElement
          }
          return false
        }
        for (const el of document.querySelectorAll('body *')) {
          const cs = getComputedStyle(el)
          if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue
          if (el.closest('.backdrop')) continue
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) continue
          if (r.right > vw + 1.5 || r.left < -1.5) {
            if (clipped(el)) continue
            const cls = (el.className || '').toString().split(' ').filter(Boolean).slice(0, 2).join('.')
            out.overflow.push(`${el.tagName.toLowerCase()}${cls ? '.' + cls : ''} [${Math.round(r.left)}..${Math.round(r.right)}]`)
          }
        }
        // tap targets
        const interactive = [...document.querySelectorAll('button, a, [role="button"], input[type="checkbox"], select')]
        for (const el of interactive) {
          const cs = getComputedStyle(el)
          if (cs.display === 'none' || cs.visibility === 'hidden') continue
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) continue
          // A control may expand its real tap area with a transparent ::after
          // (see .switch). Credit that expansion — it is what the finger hits.
          let hit = { w: r.width, h: r.height }
          const af = getComputedStyle(el, '::after')
          if (af.content !== 'none' && af.position === 'absolute') {
            const top = parseFloat(af.top), bottom = parseFloat(af.bottom)
            const left = parseFloat(af.left), right = parseFloat(af.right)
            if (Number.isFinite(top) && top < 0) hit.h += -top * 2
            else if (Number.isFinite(bottom) && bottom < 0) hit.h += -bottom * 2
            if (Number.isFinite(left) && left < 0) hit.w += -left * 2
            else if (Number.isFinite(right) && right < 0) hit.w += -right * 2
          }
          if (hit.h < 44 || hit.w < 24) {
            out.tiny.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 28)}" ${Math.round(hit.w)}x${Math.round(hit.h)}`)
          }
        }
        return out
      })
      if (res.docOverflow > 1) note(vname, route, 'overflow-x', `document overflows by ${res.docOverflow}px`)
      for (const o of [...new Set(res.overflow)].slice(0, 6)) note(vname, route, 'overflow-el', o)
      for (const t of [...new Set(res.tiny)].slice(0, 8)) note(vname, route, 'tap-target', t)
      const errs = [...page._qa.pageErrors, ...page._qa.consoleErrors]
      for (const e of errs.slice(0, 3)) note(vname, route, 'console', e.slice(0, 160))
    }
    await page.close()
  }
} finally {
  await browser.close()
}

const byKind = {}
for (const f of findings) (byKind[f.kind] ||= []).push(f)
let total = 0
for (const [kind, list] of Object.entries(byKind)) {
  console.log(`\n## ${kind} — ${list.length}`)
  total += list.length
  const seen = new Map()
  for (const f of list) {
    const k = f.r + '|' + f.msg
    seen.set(k, (seen.get(k) || []).concat(f.v))
  }
  for (const [k, vs] of [...seen.entries()].slice(0, 60)) {
    const [route, msg] = k.split('|')
    console.log(`  ${route.padEnd(12)} ${msg}   [${vs.length} vp: ${vs.slice(0, 5).join(', ')}${vs.length > 5 ? '…' : ''}]`)
  }
}
console.log(`\nTOTAL findings: ${total}`)
