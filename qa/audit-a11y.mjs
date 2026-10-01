/* ============================================================
   ACCESSIBILITY AUDIT — contrast, focus and touch targets.

   These checks were originally run as throwaway scripts, which
   meant the result was a claim in a commit message that nobody
   could re-check. This version lives in the repo so the numbers
   can be reproduced, and so a regression shows up as a failing
   command rather than as something a reviewer has to notice.

   It measures real computed styles in a real browser, against
   the actual rendered background behind each text node, rather
   than trusting the token palette. Tokens are what we intended;
   this is what shipped.

     node qa/audit-a11y.mjs                  # dev server on 5173
     BASE=http://127.0.0.1:4173 node qa/audit-a11y.mjs
   ============================================================ */
import { launch, VIEWPORTS } from './helpers.mjs'

const BASE = (process.env.BASE || 'http://127.0.0.1:5173').replace(/\/+$/, '')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const ROUTES = [
  'today', 'habits', 'habit/h1', 'work', 'work/w1',
  'goals', 'insights', 'settings', 'account', 'privacy', 'terms',
]

/* WCAG relative luminance and contrast ratio. */
const channel = (v) => {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}
const rgb = (s) => {
  const m = (s || '').match(/[\d.]+/g)
  return m && m.length >= 3 ? m.slice(0, 3).map(Number) : null
}

const now = new Date().toISOString()
const iso = (d) => { const x = new Date(); x.setDate(x.getDate() - d); return x.toISOString().slice(0, 10) }

/* Enough real content that screens render their populated state;
   an empty app hides most of its own text. */
function seed(theme) {
  const habits = [
    ['h1', 'Read 20 pages', 'book', 'mind'],
    ['h2', 'Strength training', 'gym', 'body'],
    ['h3', 'Morning walk', 'run', 'body'],
  ].map(([id, name, icon, category], order) => ({
    id, name, icon, category,
    target: { type: 'done', goal: 1, unit: '' }, cadence: { type: 'daily' },
    cue: '', notes: '', createdAt: iso(40), archivedAt: null, updatedAt: now, order,
  }))
  const checkins = {}
  for (const h of habits) {
    checkins[h.id] = {}
    for (let d = 0; d < 30; d++) if ((d + h.order) % 3 !== 0) checkins[h.id][iso(d)] = { value: 1, at: now }
  }
  return {
    version: 5,
    profile: { name: 'Dana', onboarded: true, theme, motion: 'full', weekStart: 1, lastExport: null, updatedAt: now },
    habits,
    checkins,
    work: [{
      id: 'w1', kind: 'project', title: 'Ship the quarterly report', notes: '',
      deadline: null, startedAt: iso(12),
      tasks: [{ id: 't1', title: 'Draft', done: true }, { id: 't2', title: 'Review', done: false }],
      manual: null, goalId: 'g1', log: [], createdAt: iso(12), doneAt: null, archivedAt: null, order: 0,
    }],
    goals: [{
      id: 'g1', title: 'Finish the certification', notes: '', due: iso(-60),
      habitIds: ['h1'], createdAt: iso(30), doneAt: null, archivedAt: null, updatedAt: now, order: 0,
    }],
    moods: {}, deleted: {},
  }
}

const browser = await launch()
const failures = []
let textNodes = 0

/* ---- Contrast, every route and both themes ----------------- */
for (const theme of ['light', 'dark']) {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport(VIEWPORTS.desktop)
  await page.goto(`${BASE}/#/today`, { waitUntil: 'networkidle2' })
  await page.evaluate((s) => localStorage.setItem('aaru.os.v5', JSON.stringify(s)), seed(theme))

  for (const route of ROUTES) {
    await page.goto('about:blank')
    await page.goto(`${BASE}/#/${route}`, { waitUntil: 'networkidle2' })
    await sleep(600)

    const nodes = await page.evaluate(() => {
      const behind = (el) => {
        let n = el
        while (n && n !== document.documentElement) {
          const c = getComputedStyle(n).backgroundColor
          if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c
          n = n.parentElement
        }
        return getComputedStyle(document.documentElement).backgroundColor
      }
      const out = []
      for (const el of document.querySelectorAll('body *')) {
        const own = [...el.childNodes].filter((n) => n.nodeType === 3)
          .map((n) => n.textContent.trim()).join(' ')
        if (!own) continue
        const cs = getComputedStyle(el)
        if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue
        const r = el.getBoundingClientRect()
        if (!r.width || !r.height) continue
        const size = parseFloat(cs.fontSize)
        const large = size >= 24 || (size >= 18.66 && (+cs.fontWeight || 400) >= 700)
        out.push({
          text: own.slice(0, 48), fg: cs.color, bg: behind(el),
          need: large ? 3 : 4.5, cls: el.className?.toString?.().slice(0, 32) || el.tagName,
        })
      }
      return out
    })

    for (const n of nodes) {
      const fg = rgb(n.fg); const bg = rgb(n.bg)
      if (!fg || !bg) continue
      textNodes++
      const ratio = contrast(fg, bg)
      if (ratio < n.need - 0.01) {
        failures.push(`contrast ${ratio.toFixed(2)} < ${n.need}  ${theme}/${route}  "${n.text}"  .${n.cls}`)
      }
    }
  }
  await ctx.close()
}

/* ---- Focus visibility, walking the real tab order ----------- */
const ctx = await browser.createBrowserContext()
const page = await ctx.newPage()
await page.setViewport(VIEWPORTS.desktop)
await page.goto(`${BASE}/#/today`, { waitUntil: 'networkidle2' })
await page.evaluate((s) => localStorage.setItem('aaru.os.v5', JSON.stringify(s)), seed('light'))

let stops = 0
for (const route of ['today', 'habits', 'settings', 'account']) {
  await page.goto('about:blank')
  await page.goto(`${BASE}/#/${route}`, { waitUntil: 'networkidle2' })
  await sleep(600)
  const seen = new Set()
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab')
    const info = await page.evaluate(() => {
      const a = document.activeElement
      if (!a || a === document.body) return null
      const cs = getComputedStyle(a)
      return {
        key: a.tagName + (a.className?.toString?.() || '') + (a.textContent || '').slice(0, 20),
        tag: a.tagName,
        cls: a.className?.toString?.().slice(0, 32),
        /* :focus-visible is the real test; a programmatic focus does not match it. */
        visible: a.matches(':focus-visible'),
        outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0,
        shadow: cs.boxShadow && cs.boxShadow !== 'none',
      }
    })
    if (!info) break
    if (seen.has(info.key)) break
    seen.add(info.key)
    stops++
    if (info.visible && !info.outline && !info.shadow) {
      failures.push(`focus ring missing  ${route}  ${info.tag}.${info.cls}`)
    }
  }
}

/* ---- Touch targets on a coarse pointer ----------------------
   WCAG 2.2 AA (2.5.8) asks for 24x24, with two exceptions that
   matter here. An audit that ignores them reports noise until
   people stop reading it:

     Inline    a link inside a sentence, sized by the surrounding
               line height, is exempt.
     Spacing   an undersized target is fine if a 24px circle on
               its centre does not reach another target.

   Two measurement traps, both of which produced false positives
   before they were handled: a target must be scrolled into view
   before its position means anything, and the fixed dock sits
   over the footer until the page is scrolled to the end. So each
   candidate is scrolled into view first, then hit-tested with
   elementFromPoint, which answers the question that actually
   matters: would a finger here reach this control?            */
await page.setViewport({ ...VIEWPORTS.mobile, hasTouch: true, isMobile: true })
let targets = 0
for (const route of ['today', 'habits', 'settings', 'account']) {
  await page.goto('about:blank')
  await page.goto(`${BASE}/#/${route}`, { waitUntil: 'networkidle2' })
  await sleep(600)
  const found = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    const visible = (el) => {
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none') return false
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) return false
      /* Visually hidden controls are driven by a visible label,
         which is the target a finger actually meets. */
      return !el.classList.contains('sr-only') && !(r.width <= 2 && r.height <= 2)
    }
    const all = [...document.querySelectorAll('button, a[href], input, select, [role=button]')]
      .filter(visible)

    const inline = (el) => {
      const p = el.parentElement
      if (!p) return false
      if (!/^(inline|inline-block|contents)$/.test(getComputedStyle(el).display)) return false
      return [...p.childNodes].filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.trim()).join('').length > 0
    }

    const out = []
    for (const el of all) {
      const first = el.getBoundingClientRect()
      if (first.width >= 24 && first.height >= 24) continue
      if (inline(el)) continue

      el.scrollIntoView({ block: 'center', behavior: 'instant' })
      await sleep(60)
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2

      /* Obscured by something painted on top? */
      const hit = document.elementFromPoint(cx, cy)
      const reachable = hit && (hit === el || el.contains(hit) || hit.contains(el))
      if (!reachable) {
        out.push({ why: 'obscured', tag: el.tagName, cls: el.className?.toString?.().slice(0, 30),
          w: Math.round(r.width), h: Math.round(r.height),
          text: (el.textContent || '').trim().slice(0, 24),
          by: hit ? (hit.className?.toString?.().slice(0, 24) || hit.tagName) : 'nothing' })
        continue
      }

      /* Spacing exception, against targets that share the page
         flow. A fixed overlay is covered by the hit test above. */
      const centre = (b) => ({ x: b.left + b.width / 2, y: b.top + b.height / 2 })
      const gapToRect = (c, b) => Math.hypot(
        Math.max(b.left - c.x, 0, c.x - b.right),
        Math.max(b.top - c.y, 0, c.y - b.bottom))
      let neighbour = null
      for (const other of all) {
        if (other === el || el.contains(other) || other.contains(el)) continue
        if (getComputedStyle(other).position === 'fixed') continue
        const b = other.getBoundingClientRect()
        if (!b.width || !b.height) continue
        const undersized = b.width < 24 || b.height < 24
        const d = undersized
          ? Math.hypot(centre(b).x - cx, centre(b).y - cy)
          : gapToRect({ x: cx, y: cy }, b)
        if (undersized ? d < 24 : d < 12) {
          neighbour = (other.textContent || '').trim().slice(0, 20)
            || other.className?.toString?.().slice(0, 20) || other.tagName
          break
        }
      }
      if (!neighbour) continue
      out.push({ why: 'crowded', tag: el.tagName, cls: el.className?.toString?.().slice(0, 30),
        w: Math.round(r.width), h: Math.round(r.height),
        text: (el.textContent || '').trim().slice(0, 24), by: neighbour })
    }
    return { n: all.length, out }
  })
  targets += found.n
  for (const t of found.out) {
    failures.push(t.why === 'obscured'
      ? `target obscured by "${t.by}"  ${route}  ${t.tag}.${t.cls} "${t.text}"`
      : `touch target ${t.w}x${t.h}, within 24px of "${t.by}"  ${route}  ${t.tag}.${t.cls} "${t.text}"`)
  }
}

/* ---- Horizontal overflow on a narrow screen ----------------
   An unbreakable string, usually user-supplied, widens the page
   and makes every screen scroll sideways. Cheap to check, easy
   to miss by eye.                                              */
for (const width of [320, 390]) {
  await page.setViewport({ width, height: 780, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  for (const route of ROUTES) {
    await page.goto('about:blank')
    await page.goto(`${BASE}/#/${route}`, { waitUntil: 'networkidle2' })
    await sleep(400)
    const m = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    }))
    if (m.sw > m.cw + 1) failures.push(`horizontal overflow ${m.sw} > ${m.cw}  ${width}px /${route}`)
  }
}

await browser.close()

console.log(`contrast: ${textNodes} text nodes across ${ROUTES.length} routes x 2 themes`)
console.log(`focus:    ${stops} tab stops`)
console.log(`touch:    ${targets} interactive targets`)
console.log(`overflow: ${ROUTES.length * 2} route/width combinations`)

if (failures.length) {
  console.log(`\n${failures.length} failures:`)
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
console.log('\nNo accessibility regressions.')
