/* ============================================================
   STYLESHEET ISOLATION.

   src/index.css loads adaptive.css last, so any *bare* selector in it
   restyles every screen using that class — not just the Next Gen surface
   it was written for. Phase D reused .tl-group/.tl-day for the Lab's
   grouped list; because adaptive.css wins, that turned the Record,
   Timeline and Project timelines into a grid whose implicit track sized
   to max-content, blowing them out to 1069px inside a 320px viewport.
   qa/audit.mjs caught it in the browser; this catches it at unit speed.

   jsdom applies no CSS, so the check reads the source directly.
   ============================================================ */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(process.cwd(), 'src', 'styles')
const LAST_LAYER = 'adaptive.css'

const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')
const classesIn = (css) => new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]))

/* Cross-layer overrides that are deliberate, each with the reason it exists.
   A new entry here should be a decision, not a convenience — the second test
   fails if an entry stops being true, so this list cannot go stale. */
const INTENTIONAL = new Map([
  ['bottom-nav', 'Phase E adds a Capture item; the bar needs a tighter gap under 720px'],
  ['priority-row', 'Phase F anchors the per-row actions button, so the row must be a containing block'],
  ['priority-row-inner', 'Phase F reserves 44px on the right so content never sits under that button'],
])

/**
 * Selectors that apply to a class *everywhere*: a single compound with no
 * descendant/child combinator and no second qualifier. `.lab-tl-day` is bare;
 * `.hmx-cell.hmx-tap` and `.plain-row .muted` are scoped and left alone.
 */
function bareSelectors(css) {
  const out = []
  for (const [, sel] of css.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    for (let s of sel.split(',')) {
      s = s.trim()
      if (!s || s.startsWith('@')) continue
      const first = s.split(/[\s>+~]/)[0]
      if (first !== s) continue
      if ((first.match(/[.[:]/g) || []).length > 1) continue
      const cls = (first.match(/^\.([\w-]+)/) || [])[1]
      if (cls) out.push({ sel: s, cls })
    }
  }
  return out
}

const adaptive = strip(readFileSync(join(DIR, LAST_LAYER), 'utf8'))

/* Which earlier layer first styles each class — that is its owner. */
const ownedBy = new Map()
for (const f of readdirSync(DIR).filter((f) => f.endsWith('.css') && f !== LAST_LAYER)) {
  for (const c of classesIn(strip(readFileSync(join(DIR, f), 'utf8')))) {
    if (!ownedBy.has(c)) ownedBy.set(c, f)
  }
}

describe('stylesheet isolation', () => {
  it(`${LAST_LAYER} redefines no class owned by an earlier layer`, () => {
    const leaks = bareSelectors(adaptive)
      .filter(({ cls }) => ownedBy.has(cls) && !INTENTIONAL.has(cls))
      .map(({ sel, cls }) => `${sel} — .${cls} is styled by ${ownedBy.get(cls)}; scope it (e.g. .lab-…) or move it`)
    expect([...new Set(leaks)]).toEqual([])
  })

  it('every documented override is still real, and still justified', () => {
    for (const [cls, reason] of INTENTIONAL) {
      expect(ownedBy.has(cls), `.${cls} is no longer styled by an earlier layer — drop it from INTENTIONAL`).toBe(true)
      expect(bareSelectors(adaptive).some((b) => b.cls === cls), `.${cls} is not overridden any more — drop it from INTENTIONAL`).toBe(true)
      expect(reason.length).toBeGreaterThan(20)
    }
  })

  it('the Lab uses its own list classes, not the timeline ones', () => {
    /* The concrete regression: the Lab must not borrow .tl-group/.tl-day. */
    const lab = readFileSync(join(process.cwd(), 'src', 'screens', 'AnalyticsLab.jsx'), 'utf8')
    expect(lab).not.toMatch(/className="tl-(group|day)"/)
    expect(adaptive).not.toMatch(/^\.tl-(group|day)\{/m)
    expect(adaptive).toMatch(/\.lab-tl\{/)
  })

  it('the Habits routines list uses its own rt-* step classes, not the Work timeline .routine-step ones', () => {
    /* work.css is loaded globally and styles .routine-step as a timeline
       node (::before dot painted 25px LEFT of the row). Routines subview
       must NOT reuse that class or any other "routine-" root that Work
       already owns; Step 4G-2C renamed everything to the rt-* namespace
       (.rt-step, .rt-step__num, .rt-steps, etc.). */
    const routines = readFileSync(join(process.cwd(), 'src', 'components', 'habits', 'Routines.jsx'), 'utf8')
    const rtCss = strip(readFileSync(join(DIR, 'habit-routines.css'), 'utf8'))
    const work = strip(readFileSync(join(DIR, 'work.css'), 'utf8'))
    // Routines component must not use Work's .routine-step class.
    expect(routines).not.toMatch(/className="routine-steps?(-[\w-]+)?"/)
    // Routines should be using the Step 4G-2C rt-* namespace.
    expect(routines).toMatch(/className="rt-steps"/)
    expect(routines).toMatch(/className="rt-step/)
    // The routines stylesheet owns rt-step; work.css must not style .rt-step.
    expect(rtCss).toMatch(/\.rt-step\b/)
    expect(work).not.toMatch(/\.rt-step(?![\w-])/)
    expect(work).not.toMatch(/\.rt-steps(?![\w-])/)
  })
})
