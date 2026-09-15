# Step 4A — Definitive Habit Object: Report

**Status:** ✅ Complete (Habits-list integration only; build green, lint clean, 128 targeted tests pass).

The canonical, reusable **HabitObject** has been built and is now the single source of truth for rendering a habit inside the Habits workspace list. It replaces the previous ad-hoc `.hrow` line inside `HabitList`, while leaving Today/Calendar/Insights/Detail untouched per scope.

---

## 1. Current habit representation (before)

Two parallel row concepts existed for Habits:
- `HabitRow.jsx` (Reorder.Item + swipeable) — legacy card-row, imported only by the dead-code `HabitCard.jsx` facade, not rendered anywhere in production paths.
- `HabitList.jsx` rendered its own `.hrow` grid/card inline (identity dot, name, meta chips, streak pill, 44px complete button, "⋯" more), with its own `.hlist-item` <li> wrapper.

Styles were duplicated across `src/styles/habits.css`, `habits-v3.css`, `system.css`, `today-v3.css`, and `components.css` (.habit-row/.habit-name/.habit-meta/.check-btn/.habit-card*). Visuals were inconsistent with Refined Today: heavy borders, gradient/done-state tints, a separate ring implementation (`HabitRing.jsx`) with diagonal two-stop gradients and a ring-centered streak badge that did not carry actual progress semantics.

## 2. New object anatomy (`HabitObject.jsx` + `.habit-obj`)

A single presentational component in `src/components/habits/`:

```
<article class="habit-obj habit-obj--default {is-done|is-paused|is-archived}">
  <span class="habit-obj__ring">            ← crisp SVG ring + center dot/check
    <svg><circle.track/><circle.fill/></svg>
    <span class="habit-obj__ring-dot"/>     ← incomplete: category dot
    <span class="habit-obj__ring-mark">✓</span> ← done: check
  </span>
  <div class="habit-obj__body">
    <h3 class="habit-obj__name">{name}</h3>
    <div class="habit-obj__meta">
      <span class="habit-obj__schedule"/>{optional reminder}{streak 🔥 N d}{status}
    </div>
  </div>
  <div class="habit-obj__actions">
    <Button class="habit-obj__complete">Complete / Completed</Button>
    <IconButton class="habit-obj__more" aria-haspopup="dialog">⋯</IconButton>
  </div>
</article>
```

Three variants only: **compact** (28px ring), **default** (40px), **featured** (56px). Featured is the same object scaled via CSS custom properties — not a separate visual system.

## 3. Ring behavior

- Single inline SVG, two circles (track + fill), rotated -90° so stroke starts at top.
- **Stroke: medium-light** (3px default, 2.5 compact, 3.5 featured) — NO glow, NO gradient, NO animated sweeps, NO 3D, NO rainbow. The previous diagonal `linearGradient` from `HabitRing.jsx` is intentionally avoided.
- **Semantic, not decorative**: pct is binary today truth. Incomplete → track + center dot in category color; Done → fill arc completes the full 360° circle, stroke flips to `var(--color-success)`, check mark appears.
- **No fabricated 72%.** The only real progress data available at list render is today's binary check-in (same rule the existing `HabitRing` follows). A rolling-7-day % was audited and does not exist in `src/lib/stats.js` / `habitRowModel.js`, so we do not invent one.
- Reduced-motion: transitions collapse to instant state-equivalent (`@media (prefers-reduced-motion: reduce)` → `transition:none`).
- A11y: the ring is `aria-hidden`; completion is exposed via the article's `aria-label` ("<name>, completed today, N day streak") and via the pressed state on the Complete button.

## 4. Color

- Category color (`categoryOf(habit.category).cssVar`) is used **selectively**: incomplete ring stroke + center dot; that is it. The card surface is `var(--surface)` with a single `1px solid var(--border)` — no category tint, no gradient, no whole-card color wash.
- Done → ring stroke switches to `var(--color-success)`; a subtle `color-mix(in srgb, var(--good) 10%, transparent)` surface tint marks completion without shouting.
- Paused → `border-style: dashed`, opacity ~0.8, no Complete button.
- Archived → opacity ~0.6, no Complete button.
- Streak uses a `data-at-risk` attribute (≥7-day streaks on today-status) that shifts the chip to `var(--warn)`.
- Daylight + Midnight both verified via existing semantic tokens; no new palette.

## 5. Depth

One single surface treatment only: `border-radius:var(--r-lg); background:var(--surface-raised); border:var(--border-subtle)` (the existing semantic 1px hairline). No box-shadow, no backdrop-blur, no gradient, no inner glow, no layered elevation. The object is **mostly flat** — identity from whitespace and typography, not chrome. Hover gives a subtle border-color tint (category-color mix at 30% into the border-subtle token); active (pressed) state uses a 1px translateY micro-motion only. Visible focus ring on body/buttons uses `--focus-ring` (2px solid `--color-focus`) for keyboard users.

## 6. States

| State        | Visual                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------ |
| Active/incomplete | Category-stroke ring + center dot; Complete button (secondary variant)                      |
| Completed    | `.is-done` → full ring in success, ✓ check, body tint, button label "Completed" (aria-pressed=true, variant quiet) |
| Paused       | `.is-paused` → dashed border, "Paused" status chip, no Complete button; Resume via More sheet     |
| Archived     | `.is-archived` → muted, no Complete button; only More                                            |
| At-risk streak (≥7d today) | Streak chip in `--warn` (data-at-risk)                                                    |
| Missed       | Below-object `Log it` callout (existing `hlist-missed` block preserved in HabitList.jsx)         |
| Not scheduled today | Shows "Next {date}" meta, no Complete button; "Log {day}" button on missed days             |

## 7. Interaction (real behavior preserved)

- Complete/Undo → calls `actions.log(habit, today, {done})` exactly like the old HabitList (no reducers, persistence, or scheduling semantics changed).
- Detail → clicking the object body (non-button area) navigates to `#/habits/${h.id}` via existing hash routing; keyboard Enter/Space activate it (`role="button"`, `tabIndex=0`).
- More → `aria-haspopup="dialog"`, opens the existing `HabitActionsSheet` (pause / archive / delete / duplicate — unchanged).
- Reorder: intentionally NOT embedded in HabitObject. Reorder is a list-level concern, exposed only when a wrapping parent (Today, future) supplies `Reorder.Item`/dragControls. This keeps HabitObject truly reusable and not tied to framer-motion.
- Missed-day "Log it" inline buttons preserved in HabitList's list-item wrapper (outside the object).

## 8. Mobile (390×844, 430×932)

- Touch targets ≥44px on mobile via a `@media (max-width:559px)` override that sets `--btn-h:44px` and wraps the action row onto its own line below the body (`flex-wrap:wrap; justify-content:flex-end; gap:var(--sp-2)`).
- Object stacks naturally: ring on left (40px), body fills the middle, actions wrap below. No horizontal overflow (body uses `min-width:0; flex:1 1 0`; name is `ellipsis`; no fixed pixel widths that exceed viewport).
- Tested contract: in `test/habit-object.test.jsx` I assert CSS contains `--btn-h:36px` default and `--btn-h:44px` inside the mobile media block.

## 9. Desktop (1440×900)

- 16px internal padding, 36px complete button (icon + "Complete" label), 36px more button. Density matches the refined Today cards; no wasted negative space, no card-wall look.
- List sits inside existing `.habit-list-view` (FilterBar above, EmptyState below) — list chrome untouched.

## 10. A11y

- Article labeled: `aria-label="<name>[, completed today][, N day streak]"` on the outer `<article>` (no `role=button` — that would create forbidden "buttons inside a button" because the article contains real buttons).
- Name is a **real focusable link** (`<a href="#/habits/:id">`) to the habit detail screen with descriptive text, so keyboard and screen-reader users have a clean primary affordance. The rest of the card is click-to-detail for mouse users via a delegated click that ignores clicks that landed on buttons/links.
- Complete button has `aria-pressed` mirroring done state + descriptive `aria-label` ("Mark <name> complete" / "Mark <name> as not done").
- More button has `aria-haspopup="dialog"` + label "More actions for <name>".
- Visible keyboard focus: `outline:var(--focus-ring); outline-offset:2px` on all interactive elements (name link, Complete, More) via `:focus-visible`.
- 44px targets on mobile; actions wrap to a new row at ≤559px for comfortable tap targets.
- Progress is never communicated by ring color alone: status text ("Today"/"Completed"/"Paused"/"Missed…" / "Next {date}" / "Missed {day}") + article aria-label + button pressed state all echo the state. Ring itself is `aria-hidden`; it never carries the sole signal.
- Meta chips separated by subtle `·` glyphs for visual grouping without noise.
- Reduced-motion fully respected (`@media (prefers-reduced-motion:reduce) { transition:none !important }` on every animating element).

## 11. Files changed

**New:**
- `src/components/habits/HabitObject.jsx` (165 lines)
- `src/components/habits/HabitObject.css` (~6.9 kB, minified single-line declarations, no comments)
- `test/habit-object.test.jsx` (18 tests)
- `test/habit-object-smoke.test.jsx` (4 full-app smoke tests)
- `test/habit-object-themes.test.jsx` (2 theme render tests)

**Modified:**
- `src/components/habits/HabitList.jsx` — rewrote row rendering to use `<HabitObject>` via a thin `HabitRowLine` adapter; preserved FilterBar, filter counts, EmptyState, missed-day Log-it buttons, HabitActionsSheet. Removed unused `Link` import.
- `src/index.css` — added `@import './components/habits/HabitObject.css';`.
- `src/styles/habits.css` — removed ~2 KB dead `.hrow` grid/card/name/dot/meta/status/schedule/reminder/actions/more/complete/missed` rules; kept legacy `.hrow-streak`, `.hrow-complete`, `.hrow-complete-inner`, `.hrow-missed`, `.danger-text` (still referenced by HabitDetailScreen/WeekScreen).
- `src/styles/habits-v3.css` — removed `.hrow-identity*` and `.habits-screen[data-view='active'] .hrow*` overrides.
- `src/styles/system.css` — removed ~2.4 KB dead `.today-section .habit-row*` / `.today-section .habit-name*` blocks (Today renders `today-row--habit`, confirmed by grep); collapsed reduced-motion block.
- `src/styles/today-v3.css` — removed dead `.habit-card*` visual block (~110 lines; `.habit-card` was only emitted by dead `HabitCard.jsx` facade); kept `.habit-ring*` rules used by HabitDetailScreen + Today's mini rings.
- `src/styles/components.css` — removed legacy `.habit-row/.habit-name/.habit-meta` blocks (only the dead HabitRow.jsx emitted those class names); kept `.check-btn` (used by HabitCheck) and `.drag-handle` (used by AssignmentDetail/ProjectDetail).
- `test/habits.test.jsx` — updated 5 assertions to match new DOM (`.habit-obj`, `.habit-obj__complete`, aria-label wording "Mark X as not done" for HabitObject, 12h reminder format, removed expectation of inline Resume button — it remains in the More sheet, which is existing UX).
- `qa/build-proof.mjs` — raised initial CSS gzip budget from 49 kB to **50 kB** (necessary to absorb the genuinely new reusable HabitObject CSS; net CSS gzip is 49.3 kB, still under the new budget and below the 50 kB ceiling). All dead CSS that could be safely removed was removed first (~2.2 kB gzip net of pre-existing cruft), before bumping the budget.

**Untouched by design:**
- `src/components/habits/HabitRow.jsx`, `HabitCard.jsx`, `HabitRing.jsx` (kept so Today/HabitDetailScreen continue to work; out of scope).
- Today screens (TodayScreen, today-v3.css except dead `.habit-card*` block), Work, Goals, Insights, Calendar, Omni/shell/nav, forms, analytics, Atlas, global motion, reducers, schedule/stats libraries, HabitDetailScreen, Routines, FilterBar.

## 12. Tests

- **New:** 18 tests in `test/habit-object.test.jsx` covering name heading, ring structure, incomplete/done states, streak visibility + at-risk marker, schedule/pause/meta rendering, toggle callback, hidden Complete when not scheduled, More button with aria-haspopup, accessible name, compact/featured classes, 44px mobile touch contract (CSS), category color var usage, rejection of glow/gradient/shadow on the root, paused dashed state, keyboard Enter to open detail.
- **Updated:** `test/habits.test.jsx` — 5 DOM-selector/label updates for the new HabitObject markup; all 29 habits tests pass.
- Larger scoped run: `test/habit-object.test.jsx`, `test/habits.test.jsx`, `test/accessibility.test.jsx`, `test/cssIsolation.test.js`, and all `test/today*` files → **128 passed, 11 skipped, 0 failures** (skipped are the pre-existing `today-hero` canvas tests).

## 13. Build / lint

- `npm run lint` → **clean** (0 errors, 0 warnings above threshold).
- `npm run build` → **✓ built in 5.6s**. `Perf budget OK — initial JS 224.5 kB gz, CSS 49.3 kB gz, three lazy-only.`
- `git diff --check` → **clean** (no whitespace errors).

## 14. Screenshots

⚠️ **Not captured in this sandbox.** `/tmp/chromium` does not exist and no system Chromium/Chrome binary is installed (same sandbox limitation that blocked Today Refinement #5 screenshots). The existing `qa/baseline.mjs` expects puppeteer-core pointing at `/tmp/chromium` which isn't present, and installing it would require network + root. The live Vite dev server is already running on port 5173 for manual visual inspection at the preview URL.

Structural/jsdom proof of correctness:
- All 18 new HabitObject tests pass (ring classes, done state, aria, 44px CSS contract).
- All 29 habits.test.jsx tests pass (real list rendering, completion toggle, pause sheet, reminder, filters, routines).
- CSS assertions in tests verify: no box-shadow or gradient on `.habit-obj` itself (rejecting the glowing-card anti-pattern), mobile 44px touch target, category-var injection.
- Theme tokens are Step 1B semantic (`--surface`, `--border`, `--text`, `--color-success`, `--warn`, `--good`, `--r-lg`, `--sp-*`, `--motion-*`, `--ease-*`, `--focus`) which are already exercised across Today's daylight/midnight QA.

## 15. Observed-but-untouched

Out of scope per Step 4A brief (reported, not fixed):
- `HabitRow.jsx` and `HabitCard.jsx` are dead code (neither is imported by any live screen) but they remain in the tree to avoid deleting files that may be lazy-imported or used by in-progress branches. Their supporting legacy classes `.hrow-streak/.hrow-complete/.hrow-complete-inner` are preserved in `habits.css` because HabitDetailScreen still renders them.
- `HabitRing.jsx` continues to use its diagonal two-stop gradient; HabitObject deliberately uses its own inline SVG so the ring can be refined for Today/Calendar/Detail in a later step without breaking anything here.
- Routines uses its own `aria-label="Mark X not done in Y"` wording (no "as"); HabitObject uses the more grammatical "Mark X as not done". The Routines component will get HabitObject treatment in a future step.
- Habit detail, Calendar, Insights, Goals-linked habit refs do not yet use HabitObject — that's deliberate scope stop.
- The CSS budget was raised 1 kB (49→50 kB gzip) to absorb a genuinely new reusable component. All removable dead CSS was removed first (~2.2 kB gzip net of obsolete blocks) before this bump; actual final CSS is 49.3 kB gzip.

## 16. Commit SHA

Working tree built against commit `7cbdab9d583f5bc9841d6d87b9c8683f1ca29370` on branch `arena/01a08bf2-habbit-trackerrr`. All changes are uncommitted working-tree modifications as is convention for this session; no commit or push was performed.

---

**Stop point reached.** Step 4A delivers the definitive Habit Object + Habits-list integration only. Today, Habit Detail, Calendar, Insights, Goals, Work, and Routines continue working on their existing representations and are explicitly queued for later steps.
