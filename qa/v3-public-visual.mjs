/* V3 PUBLIC visual QA -- the same closing battery as qa/v3-final-visual.mjs,
 * driven against the DEPLOYED cloud-configured production build instead of a
 * Supabase-less preview.
 *
 * The deployed build gates every surface behind the real AuthGate (AuthScreen
 * sign-in), so this driver signs in as the pre-confirmed TEST_A account
 * through the real UI -- the exact pattern qa/habits-e2e.mjs uses on the
 * public site (REQUIRE_AUTH=1, service-worker warm-up, fixture seeding that
 * keeps the 'aaru.auth' session, migration-prompt resolution) -- then runs
 * the V3 battery unchanged: same fifteen surfaces, same checks, same counts.
 * With REQUIRE_AUTH unset it behaves exactly like v3-final-visual.mjs.
 *
 * Release tooling only -- lives on the release session branch, never merged.
 *
 *   Public production site (real sign-in with the pre-confirmed TEST_A):
 *     REQUIRE_AUTH=1 V3_QA_VIEWPORT=390x844 TEST_A_EMAIL=... TEST_A_PASSWORD=... \
 *       node qa/v3-public-visual.mjs https://aaru1yg.github.io/habbit-trackerrr
 */
import { mkdirSync, writeFileSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import sharp from 'sharp'
import { launch, newPage, seedAndGoto, seededStateV4, check, report, results, sleep } from './helpers.mjs'

const base = (process.argv[2] || 'http://localhost:4173').replace(/\/+$/, '')
const output = process.env.V3_QA_OUT || 'qa/shots/v3final'
const PUBLIC = process.env.REQUIRE_AUTH === '1'
const credentials = { email: process.env.TEST_A_EMAIL?.trim(), password: process.env.TEST_A_PASSWORD }
if (PUBLIC && (!credentials.email || !credentials.password)) throw new Error('REQUIRE_AUTH=1 needs the pre-confirmed TEST_A_EMAIL/TEST_A_PASSWORD; no partial pass.')
// Public runs keep the real session and the remembered first-link choice across
// fixture resets so a seeded reload behaves like a signed-in device.
const KEEP = PUBLIC ? ['aaru.auth', 'aaru.habits.migration.v1'] : []
const safe = (text) => [credentials.email, credentials.password].filter(Boolean).reduce((out, value) => out.replaceAll(value, '[redacted]'), String(text))
mkdirSync(output, { recursive: true })
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()

const viewports = [
  { width: 390, height: 844, isMobile: true, hasTouch: true },
  { width: 430, height: 932, isMobile: true, hasTouch: true },
  { width: 1440, height: 900 },
]
const selected = viewports.filter(v => !process.env.V3_QA_VIEWPORT || process.env.V3_QA_VIEWPORT === `${v.width}x${v.height}`)
if (!selected.length) throw new Error('Unknown V3_QA_VIEWPORT')
const metadata = { commit, version: null, target: `${base}/`, mode: PUBLIC ? 'public' : 'local', viewports: [], results }

/* ------------------------------------------------------------------ */
/* In-page visual battery. One evaluate call per surface: geometry,    */
/* overlap, clipping, targets, assets — everything measurable in the   */
/* settled DOM.                                                        */
/* ------------------------------------------------------------------ */
const BATTERY = () => {
  const out = { docOverflow: 0, overflow: [], overlaps: [], clipped: [], tiny: [], brokenImgs: [], glow: [] }
  const de = document.documentElement
  out.docOverflow = de.scrollWidth - de.clientWidth
  const vw = window.innerWidth
  const mobile = vw < 768
  // With a sheet/dialog open the page behind it is covered and inert; the
  // surface under audit is the modal itself.
  const scope = document.querySelector('[role="dialog"]') || document
  const visible = (el) => {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false
    // Chromium keeps layout boxes for the content of a collapsed <details>
    // (the slot is content-visibility:hidden, not display:none), so geometry
    // alone would report phantom overlaps with the sections that visually
    // occupy that space. Only the summary stays painted when collapsed.
    let d = el.closest('details')
    while (d) {
      if (!d.open && !el.closest('summary')) return false
      d = d.parentElement?.closest('details')
    }
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  // An ancestor that deliberately scrolls or clips horizontally makes
  // off-viewport geometry intentional (charts, matrices, sheets).
  const clippedByAncestor = (el) => {
    let p = el.parentElement
    while (p && p !== document.body) {
      const cs = getComputedStyle(p)
      if (/(auto|scroll|hidden|clip)/.test(cs.overflowX) || cs.overflow === 'hidden') return true
      p = p.parentElement
    }
    return false
  }
  const fixed = (el) => {
    let p = el
    while (p && p !== document.body) {
      const pos = getComputedStyle(p).position
      if (pos === 'fixed' || pos === 'sticky') return true
      p = p.parentElement
    }
    return false
  }
  // The paint clip a text line is subject to: the intersection of every
  // clipping box from the element's own border box upward. overflow:hidden
  // truncation is design, so lines beyond the clip are not painted and
  // cannot overlap anything. (The element's own box counts: ellipsised
  // labels clip themselves.)
  const clipRectOf = (el) => {
    let clip = null
    let p = el
    while (p && p !== document.body) {
      const cs = getComputedStyle(p)
      if (/(auto|scroll|hidden|clip)/.test(cs.overflow) || /(auto|scroll|hidden|clip)/.test(cs.overflowX) || /(auto|scroll|hidden|clip)/.test(cs.overflowY)) {
        const r = p.getBoundingClientRect()
        clip = clip
          ? { left: Math.max(clip.left, r.left), top: Math.max(clip.top, r.top), right: Math.min(clip.right, r.right), bottom: Math.min(clip.bottom, r.bottom) }
          : { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
      }
      p = p.parentElement
    }
    return clip
  }
  const paintBox = (box, clip) => {
    if (!clip) return box
    const ox = Math.min(box.right, clip.right) - Math.max(box.left, clip.left)
    const oy = Math.min(box.bottom, clip.bottom) - Math.max(box.top, clip.top)
    // Only the intersected extent is painted; the clipped-away tail cannot
    // overlap anything.
    return ox > 0 && oy > 0
      ? { left: Math.max(box.left, clip.left), top: Math.max(box.top, clip.top), right: Math.min(box.right, clip.right), bottom: Math.min(box.bottom, clip.bottom) }
      : null
  }

  /* 1 · document + element horizontal overflow */
  for (const el of scope.querySelectorAll('*')) {
    if (!visible(el) || fixed(el)) continue
    if (el.closest('.backdrop')) continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    if ((r.right > vw + 1.5 || r.left < -1.5) && !clippedByAncestor(el)) {
      const cls = (el.className || '').toString().split(' ').filter(Boolean).slice(0, 2).join('.')
      out.overflow.push(`${el.tagName.toLowerCase()}${cls ? '.' + cls : ''} [${Math.round(r.left)}..${Math.round(r.right)}]`)
    }
  }

  /* 2 · text-on-text overlap. Compared as painted line boxes (Range rects
     intersected with the clipping ancestors), so line-height leading and
     overflow-hidden truncation cannot fake an intersection: two text runs
     must overlap by more than a leading's worth (> 6px) on both axes. */
  const textLeaves = [...scope.querySelectorAll('*')].filter((el) => {
    if (!visible(el)) return false
    if (el.closest('svg') || el.classList.contains('sr-only')) return false
    return [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())
  }).slice(0, 400)
  const lineBoxes = (el) => {
    const range = document.createRange()
    const clip = clipRectOf(el)
    let boxes = []
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.textContent.trim()) {
        range.selectNodeContents(n)
        boxes = boxes.concat([...range.getClientRects()].map(b => paintBox(b, clip)).filter(Boolean))
      }
    }
    return boxes
  }
  const label = (el) => `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ').filter(Boolean).slice(0, 2).join('.')} "${el.textContent.trim().slice(0, 24)}"`
  const boxesOf = new Map()
  for (const el of textLeaves) boxesOf.set(el, lineBoxes(el))
  for (let i = 0; i < textLeaves.length; i++) {
    for (let j = i + 1; j < textLeaves.length; j++) {
      const a = textLeaves[i], b = textLeaves[j]
      // Fixed/sticky chrome (navs, FABs) scrolls over static content by
      // design; only compare within the same positioning world.
      if (fixed(a) !== fixed(b)) continue
      if (a.contains(b) || b.contains(a)) continue
      let hit = false
      for (const ra of boxesOf.get(a)) {
        for (const rb of boxesOf.get(b)) {
          const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left)
          const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top)
          if (ox > 6 && oy > 6) { hit = true; break }
        }
        if (hit) break
      }
      if (hit) out.overlaps.push(`${label(a)} × ${label(b)}`)
    }
  }

  /* 3 · clipped text: hidden-overflow boxes whose content is cut without an
     intentional ellipsis. (ellipsis is a design decision, a raw cut is not;
     .sr-only text is deliberately 1px-clipped for screen readers) */
  for (const el of scope.querySelectorAll('*')) {
    if (!visible(el) || el.children.length || el.closest('svg')) continue
    if (el.classList.contains('sr-only') || el.closest('.sr-only')) continue
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue
    const cs = getComputedStyle(el)
    if (!/(hidden|clip)/.test(cs.overflowX)) continue
    if (cs.textOverflow === 'ellipsis') continue
    if (clippedByAncestor(el.parentElement)) continue
    if (el.scrollWidth > el.clientWidth + 3) {
      out.clipped.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ').filter(Boolean).slice(0, 2).join('.')} "${el.textContent.trim().slice(0, 24)}" ${el.scrollWidth}>${el.clientWidth}`)
    }
  }

  /* 4 · tap targets (mobile only) — same exceptions the E2E suite credits:
     44px checkbox labels and transparent ::after hit-area expansion. */
  if (mobile) {
    for (const el of scope.querySelectorAll('button, a, [role="button"], input[type="checkbox"], select')) {
      if (!visible(el)) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (el instanceof HTMLInputElement && el.type === 'checkbox' &&
          [...(el.labels || [])].some(l => l.getBoundingClientRect().width >= 43.99 && l.getBoundingClientRect().height >= 43.99)) continue
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
      if (hit.h < 43.99 || hit.w < 43.99) {
        out.tiny.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 28)}" ${Math.round(hit.w)}x${Math.round(hit.h)}`)
      }
    }
  }

  /* 5 · broken raster assets */
  for (const img of scope.querySelectorAll('img')) {
    if (!visible(img)) continue
    if (img.getAttribute('loading') === 'lazy' && !img.complete) continue
    if (img.complete && img.naturalWidth === 0) out.brokenImgs.push(img.getAttribute('src'))
  }

  /* 6 · excessive glow, measured not guessed: a large blur whose colour is
     bright or saturated is decoration dominating content. Deep near-black
     blurs are elevation shadows, the established sheet/card depth language,
     and are intentionally not glows. */
  const isGlowColor = (color) => {
    const m = color.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/)
    if (!m) return !/var\(--e|--shadow/.test(color) // unknown colour: only flag if clearly not an elevation token
    const [r, g, b] = [+m[1], +m[2], +m[3]]
    const sum = r + g + b
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    return sum > 300 || (max - min > 100 && max > 150)
  }
  for (const el of scope.querySelectorAll('*')) {
    if (!visible(el)) continue
    const cs = getComputedStyle(el)
    for (const shadow of [cs.boxShadow, cs.textShadow]) {
      if (!shadow || shadow === 'none') continue
      // Chromium serialises each layer as "colour x y blur [spread]"; strip
      // colour functions first so their commas cannot split layers.
      const layers = shadow.replace(/(rgba?|hsla?|color-mix|var)\([^)]*\)/g, '#').split(',')
      for (const layer of layers) {
        const lens = layer.match(/(-?\d*\.?\d+)px/g)?.map(s => parseFloat(s)) || []
        if (lens.length < 3 || lens[2] <= 60) continue
        const color = (shadow.match(/(rgba?\([^)]*\)|hsla?\([^)]*\))/) || [])[1] || ''
        if (isGlowColor(color) && !el.closest('[data-decorative]')) {
          out.glow.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ').filter(Boolean).slice(0, 2).join('.')} blur ${lens[2]}px ${color}`)
          break
        }
      }
    }
  }
  return out
}

let browser
try {
  let launched = null
  for (let attempt = 1; attempt <= 2 && !launched; attempt++) {
    // A runner whose Chrome process never starts is infrastructure, never
    // product evidence. Retry once, then fail loudly. (Public driver only --
    // the merged script is untouched.)
    try {
      launched = await launch()
    } catch (error) {
      console.log(`browser launch attempt ${attempt} failed (${safe(error.message).split('\n')[0]}); ${attempt === 2 ? 'no more retries' : 'retrying once'}`)
      if (attempt === 2) throw error
      await sleep(5000)
    }
  }
  browser = launched
  metadata.version = await browser.version()
  console.log(`Real browser: ${metadata.version}; commit: ${commit}; target: ${base}/ (${PUBLIC ? 'public site, real sign-in' : 'local build'})`)

  for (const viewport of selected) {
    const prefix = `${viewport.width}x${viewport.height}`
    const mobile = viewport.width < 768
    const context = await browser.createBrowserContext()
    const page = await newPage(context, { ...viewport, deviceScaleFactor: 1 })
    const evidence = { viewport: prefix, surfaces: [], consoleErrors: [], pageErrors: [], failedRequests: [] }
    metadata.viewports.push(evidence)
    const state = () => page._qa
    let mark = { c: 0, p: 0, f: 0 }
    const snap = () => { const s = state(); return { c: s.consoleErrors.length, p: s.pageErrors.length, f: s.failedRequests.length } }
    const settle = async () => { await page.evaluate(() => document.fonts.ready); await sleep(700) }
    /* Section reveals and chart draws fire once, on entering the viewport
       (useInViewOnce). Without walking the page, below-fold sections stay
       opacity:0 and fullPage screenshots would capture empty halves. Walk
       down in sub-viewport steps so every section crosses its threshold,
       let the staggered transitions finish, then return to the top. */
    const revealAll = async () => {
      await page.evaluate(async () => {
        const step = Math.max(200, Math.round(window.innerHeight * 0.7))
        const bottom = document.documentElement.scrollHeight
        for (let y = 0; y < bottom; y += step) {
          scrollTo(0, y)
          await new Promise(r => setTimeout(r, 260))
        }
        scrollTo(0, document.documentElement.scrollHeight)
        await new Promise(r => setTimeout(r, 420))
        scrollTo(0, 0)
        await new Promise(r => setTimeout(r, 420))
      })
    }
    const waitFor = (selector, timeout = 15000) => page.waitForSelector(selector, { timeout })
    const exists = async (selector) => page.$(selector).then(Boolean).catch(() => false)
    /* Public site only. The production service worker claims the first page
       of a fresh profile and reloads it once (src/main.jsx controllerchange).
       Warm the profile up with a plain visit first, so that one-off reload has
       already happened before any credentials are typed; every later document
       is controlled from birth and never reloads itself. */
    const warmUp = async () => {
      // The claim-time reload can interrupt this very navigation; that is the
      // event being waited out, not a failure.
      await page.goto(`${base}/`, { waitUntil: 'networkidle0' }).catch(() => {})
      const stop = Date.now() + 15000
      while (Date.now() < stop) {
        await page.waitForNetworkIdle({ idleTime: 1500, timeout: 10000 }).catch(() => {})
        const controlled = await page.evaluate(() => !('serviceWorker' in navigator) || !!navigator.serviceWorker.controller).catch(() => false)
        if (controlled) break
        await sleep(250)
      }
      await sleep(1500)
    }
    /* Public site only: the real auth screen, typed credentials, the real
       sign-in request. Never a token injection, never a mocked session. */
    const signIn = async () => {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await page.waitForNetworkIdle({ idleTime: 1000, timeout: 10000 }).catch(() => {})
          await page.waitForFunction(() => !('serviceWorker' in navigator) || !!navigator.serviceWorker.controller, { timeout: 10000 }).catch(() => {})
          if (!(await exists('#auth-email'))) return // session restored by the app itself
          await page.waitForSelector('#auth-email', { visible: true, timeout: 20000 })
          await page.type('#auth-email', credentials.email)
          await page.type('#auth-password', credentials.password)
          await click('.auth-submit')
          await page.waitForFunction(() => !document.querySelector('#auth-email') && !document.querySelector('.auth-loading'), { timeout: 30000 })
          return
        } catch (error) {
          if (attempt === 2) throw error
          console.log(`  · sign-in attempt ${attempt} interrupted (${safe(error.message).split('\n')[0]}); retrying once`)
        }
      }
    }
    /* Public site only: after each seeded load, pass the AuthGate the way a
       signed-in device does, then resolve the first-link migration prompt (a
       pre-existing account meeting freshly seeded device data) through the
       real dialog -- the app remembers the choice for later reloads. */
    const settleCloud = async () => {
      await page.waitForFunction(() => document.querySelector('#auth-email') || (!document.querySelector('.auth-loading') && document.querySelector('main#content')), { timeout: 30000 })
      await signIn()
      await page.waitForNetworkIdle({ idleTime: 1500, timeout: 20000 }).catch(() => {})
      await sleep(700)
      if (await exists('#migrate-title')) {
        const keep = await page.$('::-p-text(Keep my local data)')
        if (!keep) throw new Error('Migration prompt without a "Keep my local data" choice')
        await keep.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
        await keep.click()
        await page.waitForFunction(() => !document.querySelector('#migrate-title'), { timeout: 30000 })
        await settle()
      }
    }
    const goto = async (route, target) => {
      if (PUBLIC) {
        // A hash-only goto is same-document navigation: the seed script never
        // runs. Leave the origin first so seedAndGoto creates a fresh,
        // deterministically seeded document -- but let a pending debounced
        // cloud push finish before leaving, so an in-flight request is never
        // torn down by the navigation itself (the sweep's failed-request
        // battery would rightly count that as a failure).
        await page.waitForNetworkIdle({ idleTime: 1500, timeout: 20000 }).catch(() => {})
        await page.goto('about:blank')
      }
      await seedAndGoto(page, seededStateV4(), route, base, { keep: KEEP })
      if (PUBLIC) await settleCloud()
      if (target) await waitFor(target)
      await settle()
    }
    const click = async (selector) => {
      await waitFor(selector, 15000)
      await page.$eval(selector, el => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
      await sleep(120)
      await page.click(selector)
      await settle()
    }
    const byText = async (text, scope = 'body') => {
      const ok = await page.evaluate((text, scope) => {
        const els = [...document.querySelectorAll(`${scope} button, ${scope} [role="tab"], ${scope} a`)]
        const el = els.find(e => (e.textContent || '').trim().includes(text) || (e.getAttribute('aria-label') || '').includes(text))
        if (!el) return false
        el.scrollIntoView({ block: 'center', behavior: 'instant' })
        el.click()
        return true
      }, text, scope)
      if (!ok) throw new Error(`byText: not found "${text}"`)
      await settle()
    }
    // Native pointer input for the chart tooltip (hover is a real pointer event).
    const hover = async (selector) => {
      await page.waitForSelector(selector, { visible: true })
      const box = await page.$eval(selector, el => { el.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width * 0.6, y: r.top + r.height * 0.4 } })
      await page.mouse.move(box.x, box.y, { steps: 4 })
      await sleep(450)
    }

    /* The battery every captured surface must pass. `mode` picks the
       screenshot: full surfaces get viewport + fullPage; modal layers
       (sheets/dialogs) are fixed-position, so the viewport is the truth. */
    const sweep = async (name, { mode = 'both', errors = true } = {}) => {
      await settle()
      if (mode === 'both') await revealAll()
      const before = mark
      const nowMark = snap()
      const s = state()
      const errs = {
        console: s.consoleErrors.slice(before.c),
        page: s.pageErrors.slice(before.p),
        requests: s.failedRequests.slice(before.f),
      }
      mark = nowMark
      evidence.consoleErrors.push(...errs.console)
      evidence.pageErrors.push(...errs.page)
      evidence.failedRequests.push(...errs.requests)
      if (errors) {
        check(`[${name}] no console errors`, errs.console.length === 0, errs.console.slice(0, 2).join(' | ').slice(0, 220))
        check(`[${name}] no uncaught exceptions`, errs.page.length === 0, errs.page.slice(0, 2).join(' | ').slice(0, 220))
        check(`[${name}] no failed requests`, errs.requests.length === 0, errs.requests.slice(0, 2).join(' | ').slice(0, 220))
      }
      const bat = await page.evaluate(BATTERY)
      check(`[${name}] no horizontal page scroll`, bat.docOverflow <= 1, `scrollWidth exceeds viewport by ${bat.docOverflow}px`)
      check(`[${name}] no elements past the viewport`, bat.overflow.length === 0, [...new Set(bat.overflow)].slice(0, 3).join(' | '))
      check(`[${name}] no overlapping text`, bat.overlaps.length === 0, [...new Set(bat.overlaps)].slice(0, 3).join(' | '))
      check(`[${name}] no clipped text`, bat.clipped.length === 0, [...new Set(bat.clipped)].slice(0, 3).join(' | '))
      if (mobile) check(`[${name}] controls ≥ 44px`, bat.tiny.length === 0, [...new Set(bat.tiny)].slice(0, 4).join(' | '))
      check(`[${name}] no broken assets`, bat.brokenImgs.length === 0, bat.brokenImgs.slice(0, 3).join(' | '))
      check(`[${name}] no excessive glow`, bat.glow.length === 0, [...new Set(bat.glow)].slice(0, 3).join(' | '))
      await page.screenshot({ path: `${output}/${prefix}-${name}.png` })
      if (mode === 'both') await page.screenshot({ path: `${output}/${prefix}-${name}-full.png`, fullPage: true })
      evidence.surfaces.push(name)
      return bat
    }

    if (PUBLIC) await warmUp()

    /* ---------------- 1 · Today ---------------- */
    await goto('today', '#today-screen')
    await sweep('01-today')
    check('[today] V3 hero present', !!(await page.$('.today-hero-v3')))
    check('[today] command center renders next-best-action', !!(await page.$('.adaptive-next, .adaptive-priorities')))
    const habitCards = await page.$$eval('.habit-row.habit-card', els => els.map(el => ({
      ring: !!el.querySelector('.habit-ring'),
      streak: el.querySelector('.habit-ring-streak')?.textContent || null,
      name: el.querySelector('.habit-name, strong')?.textContent || '',
    })))
    check('[today] habit cards render', habitCards.length >= 3, `count=${habitCards.length}`)
    check('[today] every habit card carries a ring', habitCards.length > 0 && habitCards.every(c => c.ring))
    check('[today] at least one live streak is shown', habitCards.some(c => c.streak), JSON.stringify(habitCards.map(c => c.streak)))
    // The category accent must resolve to a real colour (not a dangling var).
    const accent = await page.evaluate(() => {
      const card = document.querySelector('.habit-row.habit-card')
      if (!card) return null
      const probe = document.createElement('span')
      probe.style.color = 'var(--habit-color, var(--accent-1))'
      card.appendChild(probe)
      const cs = getComputedStyle(probe).color
      probe.remove()
      return cs
    })
    check('[today] habit accent resolves to a real colour', !!accent && /^rgba?\(/.test(accent) && !/rgba?\(0, 0, 0, 0\)/.test(accent), `computed=${accent}`)
    if (mobile) {
      const heroTop = await page.$eval('.today-hero-v3', el => el.getBoundingClientRect().top + window.scrollY)
      check('[today] primary content visible early (mobile)', heroTop < 520, `hero at ${Math.round(heroTop)}px`)
    } else {
      check('[desktop] sidebar navigation present', !!(await page.$('.sidebar')))
      check('[desktop] bottom nav hidden', await page.$eval('.bottom-nav', el => getComputedStyle(el).display === 'none').catch(() => true))
    }

    /* ---------------- 2 · Work + multi-series capacity chart ---------------- */
    await goto('work', '#work-screen')
    await sweep('02-work')
    check('[work] multi-series capacity chart present', !!(await page.$('.work-capacity-visual')))
    const seriesButtons = await page.$$eval('[aria-label="Capacity series"] .chart-series-button', els => els.map(el => ({ label: el.textContent.trim(), pressed: el.getAttribute('aria-pressed') })))
    check('[work] three capacity series in the legend', seriesButtons.length === 3, JSON.stringify(seriesButtons))
    check('[work] all series start active', seriesButtons.length === 3 && seriesButtons.every(b => b.pressed === 'true'))
    const pathsBefore = await page.$eval('.work-capacity-visual svg', el => el.querySelectorAll('path').length)
    await click('[aria-label="Capacity series"] .chart-series-button:nth-child(2)')
    const toggled = await page.$eval('[aria-label="Capacity series"] .chart-series-button:nth-child(2)', el => el.getAttribute('aria-pressed'))
    const pathsAfter = await page.$eval('.work-capacity-visual svg', el => el.querySelectorAll('path').length)
    check('[work] series toggle de-emphasises a line', toggled === 'false' && pathsAfter < pathsBefore, `pressed=${toggled} paths ${pathsBefore}→${pathsAfter}`)
    await click('[aria-label="Capacity series"] .chart-series-button:nth-child(2)')
    const summary = await page.$eval('.work-capacity-visual .chart-summary', el => el.textContent.trim())
    check('[work] chart carries an accessible text summary', summary.length > 20, summary.slice(0, 80))
    await hover('.work-capacity-visual .trend-chart svg')
    const tooltip = await page.evaluate(() => {
      const svg = document.querySelector('.work-capacity-visual .trend-chart svg')
      const texts = [...svg.querySelectorAll('text')].map(t => t.textContent.trim())
      // shortDate renders "Sep 12"; a hovered column shows the date plus a
      // value line per visible series ("Committed: 240m").
      return texts.some(t => /^[A-Z][a-z]{2} \d{1,2}$/.test(t)) && texts.some(t => /: \d+m$/.test(t))
    })
    check('[work] chart tooltip appears on hover', tooltip, 'no date + per-series value text rendered on the chart after pointer move')
    await page.screenshot({ path: `${output}/${prefix}-02b-work-chart-tooltip.png` })

    /* ---------------- 3 · Habits ---------------- */
    await goto('habits', '#habits-screen')
    await sweep('03-habits')
    const rings = await page.$$eval('#habits-screen .habit-ring', els => els.length)
    check('[habits] habit list renders rings for every habit', rings >= 5, `rings=${rings}`)
    const ringScale = await page.evaluate(() => {
      const ring = document.querySelector('#habits-screen .habit-ring')
      if (!ring) return null
      const r = ring.getBoundingClientRect()
      const circle = ring.querySelector('.habit-ring-progress')
      return { w: r.width, h: r.height, stroke: circle ? getComputedStyle(circle).stroke : null }
    })
    // The V3 ring scale hierarchy: 38px in the compact Habits list, 48px on
    // Today's cards, 88px as the detail hero. HabitList passes size={38}.
    check('[habits] ring scale is the compact 38px list language', ringScale && Math.abs(ringScale.w - 38) <= 2 && Math.abs(ringScale.h - 38) <= 2, JSON.stringify(ringScale))
    check('[habits] ring stroke uses the accent gradient', !!ringScale && /^url\(["']?#habit-ring/.test(ringScale.stroke || ''), `stroke=${ringScale && ringScale.stroke}`)

    /* ---------------- 4 · Calendar ---------------- */
    await goto('calendar', '.cal-cell, .calendar')
    await sweep('04-calendar')
    check('[calendar] density grid renders', (await page.$$('.cal-cell')).length >= 28)

    /* ---------------- 5 · Habit Detail ---------------- */
    await goto('habits/h-run', '.habit-ring')
    await sweep('05-habit-detail')
    const bigRing = await page.evaluate(() => {
      const ring = document.querySelector('.habit-ring')
      return ring ? ring.getBoundingClientRect().width : 0
    })
    check('[habit detail] hero ring scales up to 88px', Math.abs(bigRing - 88) <= 2, `width=${bigRing}`)

    /* ---------------- 6 · Goals ---------------- */
    await goto('goals', '#goals-screen')
    await sweep('06-goals')
    check('[goals] seeded goals render', (await page.$$eval('#goals-screen [class*="goal"]', els => els.length)) > 0)

    /* ---------------- 7 · Goal Atlas ---------------- */
    await byText('Atlas', '#goals-screen')
    await waitFor('.atlas-wrap')
    await settle()
    await sweep('07-goal-atlas')
    const atlasImg = await page.$eval('.atlas-scene', el => ({ complete: el.complete, w: el.naturalWidth }))
    check('[goal atlas] constellation scene asset loads', atlasImg.complete && atlasImg.w > 0, JSON.stringify(atlasImg))
    check('[goal atlas] goal nodes render', (await page.$$('.atlas-node')).length >= 2)

    /* ---------------- 8 · Goal Detail + pace chart ---------------- */
    await goto('goals/g-run', '#goal-detail-screen')
    await sweep('08-goal-detail')
    check('[goal detail] pace legend names actual + expected', !!(await page.$('.pace-legend-actual')) && !!(await page.$('.pace-legend-expected')))
    const pace = await page.evaluate(() => ({
      expectedLine: !!document.querySelector('#goal-detail-screen .chart-fade'),
      actualLine: !!document.querySelector('#goal-detail-screen .chart-line'),
      required: /Required pace/.test(document.body.textContent),
    }))
    check('[goal detail] expected (dashed) line drawn', pace.expectedLine)
    check('[goal detail] actual progress line drawn', pace.actualLine)
    check('[goal detail] required pace is stated', pace.required)

    /* ---------------- 9 · Insights ---------------- */
    await goto('insights', '#insights-screen')
    await sweep('09-insights')
    check('[insights] trend chart renders', !!(await page.$('.insights-trend .trend-chart svg')))
    check('[insights] heatmap renders with legend', !!(await page.$('.heatmap')) && !!(await page.$('.hm-legend')))
    check('[insights] habit matrix renders', !!(await page.$('.habit-matrix')))

    /* ---------------- 10 · Analytics (Lab) ---------------- */
    await byText('Lab', '#insights-screen')
    await waitFor('.lab')
    await settle()
    // The Lab defaults to the Story view; the Actual vs Expected trajectory
    // is its own tab.
    await byText('Trajectory', '.lab')
    await waitFor('.lab-trajectory')
    await sweep('10-analytics')
    await hover('.lab-trajectory .trend-chart svg')
    const labSeries = await page.evaluate(() => {
      const svg = document.querySelector('.lab-trajectory .trend-chart svg')
      if (!svg) return { paths: 0, labels: 0, strokes: [] }
      return {
        paths: svg.querySelectorAll('path').length,
        labels: [...svg.querySelectorAll('text')].filter(t => /^(Actual|Expected): /.test(t.textContent.trim())).length,
        strokes: [...svg.querySelectorAll('path')].map(p => `${p.getAttribute('stroke')}${p.getAttribute('stroke-dasharray') ? ' dashed' : ''}`),
      }
    })
    check('[analytics] trajectory chart draws Actual vs Expected', labSeries.paths >= 2 && labSeries.labels >= 2, JSON.stringify(labSeries))
    await page.screenshot({ path: `${output}/${prefix}-10b-analytics-tooltip.png` })

    /* ---------------- 11 · Omni (search + capture) ---------------- */
    await goto('today', '#today-screen')
    await click('button[aria-label="Search"]')
    await waitFor('[role="dialog"]')
    await sweep('11-omni', { mode: 'viewport' })
    await page.type('#command-input', 'run')
    await sleep(600)
    const results = await page.evaluate(() => document.querySelector('[role="dialog"]')?.innerText || '')
    check('[omni] search returns real seeded results', /Morning run|half marathon|run/i.test(results), results.slice(0, 90).replace(/\n/g, ' '))
    await page.screenshot({ path: `${output}/${prefix}-11b-omni-results.png` })
    await page.keyboard.press('Escape')
    await settle()
    check('[omni] Escape closes the panel', !(await page.$('[role="dialog"]')))

    /* ---------------- 12 · Habit Form ---------------- */
    await goto('habits', '#habits-screen')
    await click('button[aria-label="New habit"]')
    await waitFor('[role="dialog"]')
    await settle()
    await sweep('12-habit-form', { mode: 'viewport' })
    const habitForm = await page.evaluate(() => ({
      title: document.querySelector('.sheet-title')?.textContent,
      fields: [...document.querySelectorAll('[role="dialog"] input, [role="dialog"] select, [role="dialog"] [role="group"]')].length,
      close: !!document.querySelector('[role="dialog"] button[aria-label="Close"]'),
    }))
    check('[habit form] sheet titled "New habit"', habitForm.title === 'New habit', habitForm.title)
    check('[habit form] form fields present', habitForm.fields >= 3, `fields=${habitForm.fields}`)
    check('[habit form] close control present', habitForm.close)
    await page.keyboard.press('Escape')
    await settle()

    /* ---------------- 13 · Goal Form ---------------- */
    await goto('goals', '#goals-screen')
    await byText('New goal', '#goals-screen')
    await waitFor('[role="dialog"]')
    await settle()
    await sweep('13-goal-form', { mode: 'viewport' })
    const goalForm = await page.evaluate(() => ({
      title: document.querySelector('.sheet-title')?.textContent,
      fields: [...document.querySelectorAll('[role="dialog"] input, [role="dialog"] select, [role="dialog"] textarea, [role="dialog"] [role="group"]')].length,
    }))
    check('[goal form] sheet titled "New goal"', goalForm.title === 'New goal', goalForm.title)
    check('[goal form] form fields present', goalForm.fields >= 4, `fields=${goalForm.fields}`)
    await page.keyboard.press('Escape')
    await settle()

    /* ---------------- 14 · Work / assignment forms + quick capture ----------------
       Mobile reaches the forms through the FAB stack; desktop hides the FAB
       and exposes the same sheets from the workspace header (and Today's
       quick actions for capture). */
    await goto('projects', '#work-screen')
    if (mobile) await click('button[aria-label="Add a project"]')
    else await byText('Create project', '#work-screen')
    await waitFor('[role="dialog"]')
    await settle()
    await sweep('14a-project-form', { mode: 'viewport' })
    check('[project form] sheet titled "New project"', (await page.$eval('.sheet-title', el => el.textContent)) === 'New project')
    await page.keyboard.press('Escape')
    await settle()
    await goto('assignments', '#work-screen')
    if (mobile) await click('button[aria-label="Add an assignment"]')
    else await byText('Create work', '#work-screen')
    await waitFor('[role="dialog"]')
    await settle()
    await sweep('14b-assignment-form', { mode: 'viewport' })
    check('[assignment form] sheet titled "New assignment"', (await page.$eval('.sheet-title', el => el.textContent)) === 'New assignment')
    await page.keyboard.press('Escape')
    await settle()
    if (mobile) {
      await goto('work', '#work-screen')
      await click('button[aria-label="Create work with quick capture"]')
    } else {
      await goto('today', '#today-screen')
      await byText('Quick capture', '#today-screen')
    }
    await waitFor('[role="dialog"]')
    await settle()
    await page.type('#command-input', 'Finish DSA report tomorrow 5pm')
    await sleep(700)
    await sweep('14c-quick-capture', { mode: 'viewport' })
    const capture = await page.evaluate(() => document.querySelector('[role="dialog"]')?.innerText || '')
    check('[quick capture] intent preview parses a real assignment', /DSA report|assignment/i.test(capture), capture.slice(0, 90).replace(/\n/g, ' '))
    await page.keyboard.press('Escape')
    await settle()

    /* ---------------- 15 · Major sheets + dialogs ---------------- */
    if (mobile) {
      await goto('today', '#today-screen')
      await click('button[aria-label="More sections"]')
      await waitFor('[role="dialog"]')
      await settle()
      await sweep('15a-more-sheet', { mode: 'viewport' })
      check('[more sheet] secondary sections listed', (await page.$$eval('[role="dialog"] a, [role="dialog"] button', els => els.length)) >= 4)
      await page.keyboard.press('Escape')
      await settle()
    }
    await goto('work', '#work-screen')
    const focusTarget = await page.$('button[aria-label^="Focus on"]')
    check('[work] focus action available on work rows', !!focusTarget)
    if (focusTarget) {
      await click('button[aria-label^="Focus on"]')
      await waitFor('[role="dialog"]')
      await settle()
      await sweep('15b-focus-dialog', { mode: 'viewport' })
      const focusDialog = await page.evaluate(() => ({
        label: document.querySelector('[role="dialog"]')?.getAttribute('aria-label') || '',
        focusVisible: !!document.activeElement && document.querySelector('[role="dialog"]')?.contains(document.activeElement),
      }))
      check('[focus mode] dialog opens with an accessible name', /focus/i.test(focusDialog.label), focusDialog.label)
      check('[focus mode] focus starts inside the dialog', focusDialog.focusVisible)
      await page.keyboard.press('Escape')
      await sleep(400)
      check('[focus mode] Escape closes and restores', !(await page.$('[role="dialog"]')))
    }

    /* ---------------- 16 · Keyboard navigation + visible focus ---------------- */
    await goto('today', '#today-screen')
    const focusPass = await page.evaluate(async () => {
      const seen = []
      for (let i = 0; i < 8; i++) {
        const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
        const handled = !document.activeElement.dispatchEvent(ev)
        if (handled) {
          // let the app's own key handler move focus
          await new Promise(r => setTimeout(r, 30))
        } else {
          const focusables = [...document.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')]
            .filter(el => el.offsetParent !== null || el === document.activeElement)
          const idx = focusables.indexOf(document.activeElement)
          const next = focusables[idx + 1] || focusables[0]
          next?.focus()
        }
        const el = document.activeElement
        if (!el || el === document.body) continue
        const cs = getComputedStyle(el)
        const ring = (parseFloat(cs.outlineWidth) > 0 && cs.outlineStyle !== 'none') ||
          (cs.boxShadow && cs.boxShadow !== 'none') ||
          el.matches(':focus-visible')
        seen.push({ tag: el.tagName, label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 18), ring })
      }
      return seen
    })
    const focusableCount = focusPass.filter(f => f.tag).length
    const withRing = focusPass.filter(f => f.ring).length
    check('[keyboard] Tab reaches interactive elements', focusableCount >= 5, JSON.stringify(focusPass.slice(0, 4)))
    check('[keyboard] visible focus on keyboard-operated controls', withRing >= Math.ceil(focusableCount * 0.6), `${withRing}/${focusableCount} show a ring`)

    /* ---------------- 17 · Headings + dialog aria ---------------- */
    const aria = await page.evaluate(() => {
      const h1 = document.querySelectorAll('h1').length
      const unlabeledDialogs = [...document.querySelectorAll('[role="dialog"]')].filter(d => !(d.getAttribute('aria-label') || d.getAttribute('aria-labelledby') || d.querySelector('h1,h2,h3')))
      return { h1, unlabeledDialogs: unlabeledDialogs.length }
    })
    check('[a11y] exactly one h1 per screen', aria.h1 === 1, `h1 count=${aria.h1}`)
    check('[a11y] no unlabeled dialogs remain open', aria.unlabeledDialogs === 0)

    /* ---------------- 18 · Reduced motion ---------------- */
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    for (const [route, target, name] of [['today', '#today-screen', '16a-reduced-today'], ['work', '#work-screen', '16b-reduced-work'], ['habits', '#habits-screen', '16c-reduced-habits']]) {
      await goto(route, target)
      await sweep(name, { mode: 'viewport' })
    }
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
    await page.close()
    await context.close()
  }

  /* ---------------- 19 · Screenshot pixel sanity ----------------
     A surface can render "successfully" as a blank sheet. Statistics on
     the captured PNG catch what the DOM cannot: flat/blank output. */
  const pngs = readdirSync(output).filter(f => f.endsWith('.png'))
  for (const file of pngs) {
    const stats = await sharp(`${output}/${file}`).stats()
    const flat = stats.channels.every(c => c.stdev < 1.5)
    check(`[pixels] ${file} is not a blank frame`, !flat, `stdev=${stats.channels.map(c => c.stdev.toFixed(2)).join(',')}`)
  }
} catch (err) {
  console.error('FATAL:', err)
  results.fail++
  results.failures.push(`fatal: ${err.message}`)
} finally {
  try { await browser?.close() } catch { /* already gone */ }
}

writeFileSync(`${output}/results.json`, JSON.stringify(metadata, null, 2))
console.log(`\nSurfaces captured: ${metadata.viewports.map(v => `${v.viewport}: ${v.surfaces.length}`).join(', ')}`)
report('V3 final visual QA')
