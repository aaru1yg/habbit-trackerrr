/* Step 7C visual + behavioural proof for the Mind screen.
 * Real Chromium against the local production build, seeded with the shared
 * v4 fixture (which already carries moods with capacity, check-ins with
 * timestamps, and work items), across the four QA viewports.
 *
 *   node qa/mind-7c-browser.mjs http://localhost:4173
 */
import { mkdirSync } from 'node:fs'
import { launch, newPage, seedAndGoto, seededStateV4, check, report, sleep } from './helpers.mjs'

const base = (process.argv[2] || 'http://localhost:4173').replace(/\/+$/, '')
const out = 'qa/shots/mind-7c'
mkdirSync(out, { recursive: true })

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 820 },
  { width: 430, height: 932, isMobile: true, hasTouch: true },
  { width: 390, height: 844, isMobile: true, hasTouch: true },
]

const state = seededStateV4()
const browser = await launch()
console.log(`Real browser: ${await browser.version()}; target: ${base}/`)

for (const vp of VIEWPORTS) {
  const label = vp.width >= 1000 ? 'desktop' : 'mobile'
  const page = await newPage(browser, { ...vp, deviceScaleFactor: vp.deviceScaleFactor ?? (label === 'mobile' ? 2 : 1) })
  await seedAndGoto(page, state, 'mind', base)
  const tag = `${vp.width}`

  /* ---------- rendered, honest, and error-free ---------- */
  check(`[${tag}] Mind renders with its own h1`, await page.$eval('#mind-screen h1', (el) => el.textContent.trim()).catch(() => '') === 'Mind')
  check(`[${tag}] no console/page errors`, page._qa.consoleErrors.length === 0 && page._qa.pageErrors.length === 0,
    JSON.stringify({ console: page._qa.consoleErrors.slice(0, 2), page: page._qa.pageErrors.slice(0, 2) }))
  check(`[${tag}] no failed requests`, page._qa.failedRequests.length === 0, page._qa.failedRequests.slice(0, 2).join(' | '))
  const lazy = await page.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name).filter((n) => /advancedAnalytics|AnalyticsLab/.test(n)))
  check(`[${tag}] no advanced-analytics chunk fetched while on Mind`, lazy.length === 0, lazy.join(','))

  /* ---------- one primary visual, real data ---------- */
  const chart = await page.evaluate(() => {
    const svg = document.querySelector('#mind-screen .mind-cocomove svg')
    if (!svg) return null
    const lines = [...svg.querySelectorAll('g > path[stroke]')].filter((p) => p.getAttribute('fill') === 'none')
    return {
      role: svg.getAttribute('role'),
      aria: svg.getAttribute('aria-label') || '',
      lines: lines.length,
      strokes: [...new Set(lines.map((p) => getComputedStyle(p).stroke))],
    }
  })
  check(`[${tag}] primary co-movement chart is present`, !!chart)
  check(`[${tag}] chart is labelled for screen readers`, !!chart && /^Line chart of /.test(chart.aria) && chart.role === 'img', chart?.aria.slice(0, 80))
  check(`[${tag}] chart draws more than one series`, !!chart && chart.lines >= 2, `paths=${chart?.lines}`)

  /* ---------- the 7A colour defect: neutral dims must not wear semantic tones ---------- */
  const tones = await page.evaluate(() => {
    const probe = document.createElement('span')
    probe.style.display = 'none'
    document.body.appendChild(probe)
    const read = (v) => { probe.style.color = v; const c = getComputedStyle(probe).color; return c }
    const vars = { '--cat-mind': 1, '--accent-1': 1, '--accent-2': 1, '--cat-creative': 1 }
    const id = Object.fromEntries(Object.keys(vars).map((k) => [k, read(`var(${k})`)]))
    const sem = { good: read('var(--good)'), warn: read('var(--warn)'), bad: read('var(--bad)') }
    probe.remove()
    return { id, sem }
  })
  const semanticStrokes = chart ? chart.strokes.filter((s) => Object.values(tones.sem).includes(s)) : []
  check(`[${tag}] no dimension line uses --good/--warn/--bad`, semanticStrokes.length === 0,
    `strokes=${chart?.strokes.join(' ')} semantic=${Object.values(tones.sem).join(' ')}`)
  check(`[${tag}] dimension lines use the accent/category vocabulary`, !!chart
    && chart.strokes.every((s) => Object.values(tones.id).includes(s)),
    `strokes=${chart.strokes.join(' ')} allowed=${Object.values(tones.id).join(' ')}`)

  /* ---------- legend keys every series with text, not colour alone ---------- */
  const legend = await page.$eval('#mind-screen .mind-legend', (el) => el.textContent).catch(() => '')
  check(`[${tag}] legend names all four dimensions with their averages`, /Mood.*Energy.*Focus.*Drive/s.test(legend), legend.slice(0, 120))
  check(`[${tag}] completion band is explained in the legend`, /Completion %/.test(legend) && /Window mean/.test(legend))

  /* ---------- correlation honesty: no causal language anywhere ---------- */
  const copy = await page.$eval('#mind-screen', (el) => el.innerText)
  // Causal verbs are only allowed inside an explicit negation ("not cause",
  // "association, not causation"), so scan sentence by sentence.
  const causal = copy.split(/(?<=[.!?])\s+/).filter((sent) => /\b(cause[sd]?|because of|led to|makes you|drives your|proves|caused by)\b/i.test(sent) && !/\bnot\b/i.test(sent))
  check(`[${tag}] no un-negated causal claims in Mind copy`, causal.length === 0, causal.slice(0, 2).join(' | '))
  // Wherever a co-movement is quantified, the label must be there too.
  const quantified = /r = -?0\.\d+/.test(copy) || /points, over \d+/.test(copy)
  check(`[${tag}] quantified associations are labelled as associations`,
    !quantified || /association, not causation|association between two counts|not a rule about/i.test(copy))
  check(`[${tag}] the chart carries an honest reading either way`,
    /r = -?0\.\d+/.test(copy) || /days logged|too few|nothing is imputed|check-in/i.test(copy))
  const gates = await page.evaluate(() => ({
    empty: [...document.querySelectorAll('#mind-screen .empty-note')].map((e) => e.textContent.trim().slice(0, 40)),
    tiles: document.querySelectorAll('#mind-screen .ins-signal').length,
  }))
  check(`[${tag}] four identity signal tiles (one per dimension)`, gates.tiles === 4)

  await page.screenshot({ path: `${out}/mind-${tag}-arrive.png`, fullPage: true })

  /* ---------- layout: no overflow, real control sizes, readable text ---------- */
  const layout = await page.evaluate(() => {
    const doc = document.documentElement
    const boxes = (sel) => [...document.querySelectorAll(sel)].map((el) => {
      const r = el.getBoundingClientRect()
      return { w: Math.round(r.width), h: Math.round(r.height) }
    })
    const svgText = [...document.querySelectorAll('#mind-screen .mind-cocomove svg text')].map((t) => {
      const r = t.getBoundingClientRect()
      const fs = parseFloat(getComputedStyle(t).fontSize)
      return { scale: r.width > 0 ? +(r.width / Math.max(1, t.getComputedTextLength())).toFixed(2) : 0, fs }
    })
    return {
      overflow: doc.scrollWidth - doc.clientWidth,
      wide: [...document.querySelectorAll('#mind-screen *')].filter((el) => el.getBoundingClientRect().right > doc.clientWidth + 1).map((el) => el.className?.toString().slice(0, 40)).slice(0, 4),
      range: boxes('#mind-screen .ins-range button'),
      level: boxes('#mind-screen .level-btn'),
      mood: boxes('#mind-screen .mood-btn'),
      svgText: svgText.slice(0, 6),
    }
  })
  check(`[${tag}] no horizontal overflow`, layout.overflow <= 0, `overflow=${layout.overflow}px ${layout.wide.join(' | ')}`)
  check(`[${tag}] range controls are >=44px tall`, layout.range.length === 3 && layout.range.every((b) => b.h >= 44), JSON.stringify(layout.range))
  check(`[${tag}] check-in controls are >=44px`, [...layout.level, ...layout.mood].every((b) => b.h >= 44), JSON.stringify({ level: layout.level.slice(0, 2), mood: layout.mood.slice(0, 2) }))
  const minText = Math.min(...layout.svgText.map((t) => t.fs * t.scale))
  check(`[${tag}] chart axis text stays legible (>=8px rendered)`, layout.svgText.length === 0 || minText >= 8, `min=${minText.toFixed(2)}px @${vp.width}`)

  /* ---------- keyboard: focus is visible, controls reachable ---------- */
  const focus = await page.evaluate(async () => {
    const btn = document.querySelector('#mind-screen .ins-range button')
    btn.focus()
    const s = getComputedStyle(btn)
    const active = document.activeElement === btn
    // press the 90D range and confirm the window label changes
    const btns = [...document.querySelectorAll('#mind-screen .ins-range button')]
    btns[2].click()
    await new Promise((r) => setTimeout(r, 120))
    const pressed = [...document.querySelectorAll('#mind-screen .ins-range button')].map((b) => b.getAttribute('aria-pressed'))
    const sub = document.querySelector('#mind-screen .ins-chart-head p')?.textContent || ''
    return { ring: s.outlineWidth !== '0px' || s.boxShadow !== 'none', active, pressed, sub }
  })
  check(`[${tag}] range control shows a visible focus indicator`, focus.ring && focus.active)
  check(`[${tag}] switching the window re-scopes the analysis`, focus.pressed[2] === 'true' && /over 90 days/.test(focus.sub), `${focus.pressed.join(',')} :: ${focus.sub.slice(0, 60)}`)

  /* ---------- the write surfaces still work ---------- */
  const wrote = await page.evaluate(async () => {
    const before = JSON.parse(localStorage.getItem('aaru.habits.v4') || '{}')
    const face = [...document.querySelectorAll('#mind-screen .mood-btn')].find((b) => /Great/.test(b.textContent))
    face.click()
    await new Promise((r) => setTimeout(r, 200))
    const raw = JSON.parse(localStorage.getItem('aaru.habits.v4') || '{}')
    const today = new Date().toLocaleDateString('en-CA')
    const score = raw.moods?.[today]?.score
    const lvl = [...document.querySelectorAll('#mind-screen .level-btn')].find((b) => b.getAttribute('aria-label') === 'Energy 4 of 5')
    lvl.click()
    await new Promise((r) => setTimeout(r, 200))
    const energy = JSON.parse(localStorage.getItem('aaru.habits.v4')).moods?.[today]?.energy
    return { score, energy, had: Object.keys(before.moods || {}).length }
  })
  check(`[${tag}] mood face still writes SET_MOOD`, wrote.score === 5, JSON.stringify(wrote))
  check(`[${tag}] capacity level still writes 1–5`, wrote.energy === 4, JSON.stringify(wrote))

  await page.screenshot({ path: `${out}/mind-${tag}.png`, fullPage: true })
  await page.close()
  await sleep(50)
}

/* deep-link parity: Mind must stay reachable both ways */
{
  const page = await newPage(browser, VIEWPORTS[0])
  for (const route of ['mind', 'insights?view=mind']) {
    await seedAndGoto(page, state, route, base)
    const ok = await page.evaluate(() => !!document.querySelector('#mind-screen'))
    check(`deep link #/${route} reaches Mind`, ok)
  }
  /* the pillar's Overview must be untouched by 7C */
  await seedAndGoto(page, state, 'insights', base)
  const overview = await page.evaluate(() => ({
    heading: document.querySelector('#insights-screen h1')?.textContent?.trim(),
    signal: document.querySelectorAll('#insights-screen .ins-signal').length,
    chart: !!document.querySelector('#insights-screen .ins-svg-wrap svg'),
    pillars: [...document.querySelectorAll('#insights-screen .ins-pillar-label')].map((e) => e.textContent.trim()),
  }))
  check('Insights Overview is unchanged by 7C', overview.heading === 'Insights' && overview.signal === 4 && overview.chart && overview.pillars.join(',') === 'Mind,Record,Achievements,Advanced', JSON.stringify(overview))
  await page.close()
}

await browser.close()
report('Step 7C — Mind')
