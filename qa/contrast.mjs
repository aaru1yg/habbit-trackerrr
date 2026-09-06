/* Contrast audit — walks every visible text node, resolves the effective
 * background (walking up through translucent layers) and reports WCAG
 * failures. Usage: node qa/contrast.mjs [baseUrl] [theme]
 */
import { launch, newPage, seedAndGoto, seededStateV4, sleep } from './helpers.mjs'

const base = process.argv[2] || 'http://localhost:5173'
const theme = process.argv[3] || null

const ROUTES = [
  'today', 'calendar', 'week', 'goals', 'projects', 'assignments',
  'workload', 'timeline', 'insights', 'mind', 'library', 'record', 'settings',
]

const browser = await launch()
const failures = []

function parse(c) {
  const m = c.match(/rgba?\(([^)]+)\)/)
  if (!m) return null
  const p = m[1].split(',').map((x) => parseFloat(x))
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
}
function lum({ r, g, b }) {
  const f = (v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
function ratio(a, b) {
  const l1 = lum(a), l2 = lum(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}
const over = (fg, bg) => ({
  r: fg.r * fg.a + bg.r * (1 - fg.a),
  g: fg.g * fg.a + bg.g * (1 - fg.a),
  b: fg.b * fg.a + bg.b * (1 - fg.a),
  a: 1,
})

try {
  const page = await newPage(browser, { width: 1440, height: 900 })
  for (const route of ROUTES) {
    const state = seededStateV4()
    if (theme) state.profile.theme = theme
    await seedAndGoto(page, state, route, base)
    await sleep(700)
    const rows = await page.evaluate(() => {
      const out = []
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      const seen = new Set()
      let n
      while ((n = walker.nextNode())) {
        const text = n.textContent.trim()
        if (!text) continue
        const el = n.parentElement
        if (!el || seen.has(el)) continue
        seen.add(el)
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.5) continue
        const r = el.getBoundingClientRect()
        if (r.width < 2 || r.height < 2) continue
        // effective background: walk up compositing translucent layers
        const stack = []
        let p = el
        while (p && p !== document.documentElement) {
          const b = getComputedStyle(p).backgroundColor
          const c = b.match(/rgba?\(([^)]+)\)/)
          if (c) {
            const parts = c[1].split(',').map(parseFloat)
            const a = parts.length > 3 ? parts[3] : 1
            if (a > 0) stack.push({ r: parts[0], g: parts[1], b: parts[2], a })
            if (a >= 1) break
          }
          p = p.parentElement
        }
        out.push({
          text: text.slice(0, 40),
          tag: el.tagName.toLowerCase(),
          cls: (el.className || '').toString().split(' ').slice(0, 2).join('.'),
          color: cs.color,
          bg: stack,
          size: parseFloat(cs.fontSize),
          weight: parseInt(cs.fontWeight, 10) || 400,
        })
      }
      return out
    })
    for (const row of rows) {
      const fg = parse(row.color)
      if (!fg) continue
      // composite background stack from bottom up
      let bg = { r: 11, g: 15, b: 26, a: 1 } // page base
      for (let i = row.bg.length - 1; i >= 0; i--) bg = over(row.bg[i], bg)
      const fgc = over(fg, bg)
      const cr = ratio(fgc, bg)
      const large = row.size >= 24 || (row.size >= 18.66 && row.weight >= 700)
      const need = large ? 3 : 4.5
      if (cr < need) {
        failures.push({ route, ...row, cr: cr.toFixed(2), need })
      }
    }
  }
  await page.close()
} finally {
  await browser.close()
}

const uniq = new Map()
for (const f of failures) {
  const k = `${f.cls || f.tag}|${f.color}|${f.size}`
  if (!uniq.has(k)) uniq.set(k, { ...f, routes: new Set() })
  uniq.get(k).routes.add(f.route)
}
console.log(`theme=${theme || 'default'} — ${failures.length} failing text nodes (${uniq.size} unique)\n`)
for (const f of [...uniq.values()].sort((a, b) => a.cr - b.cr)) {
  console.log(`  ${f.cr} (need ${f.need})  ${f.size}px w${f.weight}  ${f.tag}.${f.cls}  "${f.text}"  ${[...f.routes].join(',')}`)
}
