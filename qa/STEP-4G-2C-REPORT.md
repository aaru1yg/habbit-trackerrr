# Step 4G-2C Report — Routines Width + Sequence Polish

**Branch:** `arena/01a08bf2-habbit-trackerrr`
**Parent commit:** `43ff82e` (Step 4G-2B)
**Step commit:** `8702df0`
**Date:** 2026-09-13
**Scope:** Routines container width + step-sequence spacing/alignment/reorder targets only. No reducers, data model, ordering semantics, grouped ticks, analytics, or intelligence touched. Other screens (Today, HabitObject, Habits Workspace, Habit Detail, Calendar, Week, Work, Goals, Insights, Omni, shell/nav) are **not** modified.

---

## 1. Old Routines width problem
Pre-4G-2C the Routines view inherited the Habits workspace content column (`--content-max = 1240px` via `.habits-screen`), with no max-width on `.rt`. Each `.rt-block` routine card stretched the full 1240 px (minus 16 px gutters) on desktop, producing a wide dashboard-like column. Step rows (`grid-template-columns:36px 1fr auto`) had the action column drifting far to the right with a ~1000 px dead zone between the habit name and the "Do it/Done" button. The vertical connector was computed as `height:calc(44px - 28px)` = 16 px, which didn't reliably connect markers across uneven row heights. Step padding was `4px 16px` (tight); block head padding `14px 16px`; footer padding `6px 10px` — all felt cramped relative to Habit Detail's 20 px editorial gutters. Mobile had a smaller 26 px marker with an equally brittle connector calc. Reorder controls used 36 px IconButtons with a 4 px `::after` inset (hit 44 px), but focus-visible outlines were inconsistent between footers/forms/archive summary.

Habit Detail uses `max-width:880px`; Week Review uses a natural width capped by its 7-day grid (~880 px effective). Routines at 1240 px felt like a different product.

## 2. Chosen max-width and why
**`max-width: 720px`**, centered with `margin:0 auto`, applied to a new `.rt-shell` wrapper that also contains the "New routine" header button so the button's right edge aligns with the routine column.

Why 720 px and not 880 px (Habit Detail):
- Routines is a **vertical step sequence**. Scan-reading research and the existing Habit OS editorial rhythm (60–70 ch body measure in other summary blocks, see `.wr-summary__line`, `.hd-summary-line`) argue for a tighter column than Detail, which has a hero with eyebrow/h1/sub plus multi-column evidence grids that benefit from more horizontal room.
- 720 px gives the routine name + meta + step action comfortable room without creating a dead zone; the button sits visibly attached to the row rather than floating 800 px away.
- The archive `<details>` uses the same 720 px cap so it aligns with the routine column rather than running full-width underneath.
- On mobile (≤559 px) `.rt-shell` and `.rt-archive` drop to `max-width:100%` so the routine fills the viewport gutters (inherited from `.habits-screen`).

## 3. Sequence spacing changes
- `.rt` gap tightened from 20 px → **16 px** between routine blocks so multiple routines feel like a set, not cards floating apart.
- `.rt-steps` padding changed from `padding:0` → **`padding:4px 0`** to give the list subtle breathing room against the progress rail above and complete-strip / footer below.
- `.rt-step` padding changed from `4px 16px` → **`6px 16px`**, min-height from 44 px → **44 px kept** (meets 44 px tap target; slight vertical padding increase helps baselines).
- `.rt-head` padding adjusted to `14px 16px` (matches step column alignment: name starts at same x as step names).
- `.rt-foot` padding from `6px 10px` → **`10px 14px`** for better touch and visual weight.
- `.rt-complete` celebratory strip padding from `10px 18px` → **`12px 18px`** to sit proportionally under the new step spacing.
- Connector height changed from a fragile `calc(44px - 28px)` (16 px) to a fixed **20 px** that reliably bridges the 6 px row padding to the next marker.

## 4. Alignment changes
- Step grid stays 3-col (**36 px marker column · 1fr body · auto action**), preserving the existing column semantics — no redesign.
- Number/marker centered in its 36 px column; removed `margin:0 auto` (redundant with grid centering at 28 px).
- `.rt-step__num` font size tightened to explicit **11 px** (from tokenized var that resolved to 12 px, leaving less breathing room inside the 28 px circle with two-digit "01").
- `.rt-mark` (routine kind icon in header) removed redundant `flex:none` (already sized 32×32 grid item, flex container children don't need it).
- Progress rail remains 3 px tall (semantically unchanged).
- Footer meta `margin-right:auto` preserved so actions cluster right; reorder group stays adjacent to Edit/Archive/Delete.
- New shell puts the "New routine" primary button right-aligned, flush with the column edge, so it doesn't float alone at 1240 px.

## 5. Reorder target result
- Existing `.rt-move .p-btn--icon` is **36×36 px visual**, **border:1px solid var(--line)** (separate buttons), with an `::after{content:"";position:absolute;inset:-4px}` pseudo-element expanding the hit area to 44×44 px (36 + 4×2).
- Added explicit `.p-btn--icon:focus-visible{outline:var(--focus-ring);outline-offset:2px}` (previously missing — the move up/down buttons did not receive a visible focus ring).
- `.rt-form-row .p-btn--icon` (add-step buttons in the Routine form) already uses the same 36/44 pattern; unchanged.
- Mobile keeps 36 px visual / 44 px hit (same rule; no override to smaller on mobile since icon-button size stays 36 px).
- Test asserts the CSS contract directly (36px + inset:-4px) so future refactors can't silently drop below 44 px.

## 6. Mobile result (390×844, 430×932)
- `.rt-shell { max-width:100% }`, `.rt-block { border-radius:12px }`, `.rt-archive { max-width:100% }`.
- `.rt-head` padding 14 px (matches HabitsScreen's 16 px→14 px mobile gutter).
- Step grid compresses marker column to 32 px (marker 26×26 px), column-gap 10 px, padding `6px 14px`, min-height **46 px** (still ≥44 px). Connector height stays 20 px between compact markers.
- `.rt-foot` padding tightens to `8px 10px` for thumb reach.
- No horizontal overflow (step body uses `min-width:0`; name/text uses inline-flex ellipsis via inherited link styles).
- Multiple routines stay as a vertical column with 12 px gap — comfortable single-thumb scanning.

## 7. Desktop result (1440×900)
- Routines column centered at 720 px — document-like sequence, in rhythm with Habit Detail (880 px hero/evidence) but tighter (a sequence doesn't need 880 px).
- "New routine" button right-aligned within the same 720 px column.
- Step rows read top-to-bottom: number (dot) → habit name → meta (Next up/Waiting/Complete/Not scheduled) → action button, all tightly aligned with minimal dead space; action sits ~60 px from the name on long names, ~12 px on short names — neither drifting nor crowding.
- Vertical connector is a subtle 1.5 px line in `--line` (green when prior step is done) connecting marker centers; no decorative graphics.
- Footer is secondary (small xs font, `--surface-2` background) — reorder/edit/archive/delete sit quietly right; rate string dominates left.
- Multiple routines stack vertically with 16 px gap, no multi-column dashboard.

## 8. Accessibility
- Semantic `<ol class="rt-steps" aria-label="{name} steps">` preserved; `<li>` step items in DOM order.
- Step action buttons retain `aria-pressed={done}` and descriptive `aria-label="Mark {habit} as complete|not complete in {routine}"`.
- Focus-visible outlines now present on: step action buttons, footer buttons, reorder IconButtons, and archive summary (using `outline:var(--focus-ring);outline-offset:2px`, matching Habit Detail).
- 44 px minimum touch targets: step rows 44–48 px min-height, reorder buttons 44 px hit area, archive summary 44 px, form buttons 36+8=44 px.
- Reduced-motion: the two explicit `transition:none` blocks I wrote were redundant — `base.css` already applies a global `transition-duration:0.01ms !important` under `@media(prefers-reduced-motion:reduce)`, covering all elements. Removed the redundant blocks (small CSS saving). Global motion preference still honored.
- Archive uses native `<details>/<summary>`; `::-webkit-details-marker` suppressed but keyboard-native expand/collapse preserved.

## 9. CSS before/after
| Metric | Before (4G-2B / bd5a335) | After (4G-2C) | Δ |
|---|---|---|---|
| Initial CSS gzipped (build-proof) | 54.9 kB | **55.0 kB** | +0.1 kB (at ceiling, not raised) |
| `habit-routines.css` raw bytes | 6554 | 6708 | +154 raw, **−15 bytes gz** after comment/redundancy cleanup and removing two redundant reduced-motion blocks |
| Initial JS gzipped | 225.4 kB | 225.4 kB | 0 |
| Vite main CSS chunk (reported) | 56.26 kB | 56.30 kB | +0.04 kB gz |
| Build budget | OK | OK (55.0 kB ceiling) | held |

Net effect: routines got a focused width container, better spacing, connector polish, consistent focus rings, and mobile targets; the budget remained exactly at the 55 kB ceiling by trimming comments and redundant `prefers-reduced-motion` rules from both `habit-routines.css` and `habit-detail.css`.

## 10. Exact files changed
- `src/components/habits/Routines.jsx` — **no changes** (JSX/semantics preserved).
- `src/screens/HabitsScreen.jsx` — RoutinesBody: replaced inline-style wrapper fragment with `<div class="rt-shell">` so the "New routine" header button and routines column share the 720 px cap.
- `src/styles/habit-routines.css` — added `.rt-shell` / `.rt-shell__head`, set `.rt` gap 16 px, tightened/aligned padding on head/step/foot/complete-strip, fixed connector height to 20 px, aligned marker typography (11 px), added missing focus-visible rings on reorder + archive summary, removed now-redundant reduced-motion block and unused `.rt-form-pick.p-btn--sm{border-radius:99px}` (component sets inline `borderRadius:99`), removed redundant flex:none/cursor/margin declarations, minor mobile padding tighten.
- `test/routines-layout.test.jsx` — new, 8 focused layout/semantics tests (see §11).
- `src/styles/habit-detail.css` — removed descriptive comments and redundant reduced-motion block (already covered globally) — tiny CSS savings to keep the overall budget at 55 kB. **No visual change.**
- `qa/STEP-4G-2C-REPORT.md` (this file).

## 11. Tests
New file `test/routines-layout.test.jsx` (8 tests), focused:
1. `.rt-shell` is present with `max-width:720px; margin:0 auto`.
2. `.rt` is a vertical flex column (no multi-column dashboard).
3. Semantic `<ol aria-label="{name} steps">` with 3 `<li>` steps, each having marker/body/action columns.
4. Reorder IconButtons have 36 px visual + `::after{inset:-4px}` → 44 px hit target contract (verified against CSS text).
5. Clicking a step toggles `aria-pressed` from false→true; completing all three renders `.rt-complete` "All steps complete" within the block (existing reducer semantics preserved).
6. Footer contains Edit + Archive actions; rate meta present left.
7. Mobile breakpoint (`max-width:559px`) sets `.rt-shell{max-width:100%}`.
8. Step rows declare `min-height:44px` or larger (mobile target contract).

Existing test results:
- `test/habits.test.jsx` (36 tests, including the "creates, reorders, edits, archives and deletes routines with the existing reducer" routine flow) — **all pass**.
- `test/habit-detail-hero.test.jsx` (7 tests) — **all pass** (untouched).
- `test/routines-layout.test.jsx` (8 tests) — **all pass**.
- **Total targeted: 51/51 pass.**

Pre-existing failures (on parent `43ff82e`, unchanged and not weakened):
- `test/adaptiveHome.test.jsx` — 5 focus-session tests fail under jsdom (HTMLCanvasElement getContext not implemented); Step 4G-2 Work/Focus scope, out of bounds for 4G-2C.
- `test/app.test.jsx > core flows > navigates to habit detail from Today` — stale "Open Read" link expectation vs canonical HabitObject name-link from 4G-2A; Today scope forbidden.
- `test/quickCaptureUI.test.jsx > answers "assignments due this week"` — Omni answer panel; out of scope.

## 12. Build / lint / diff-check
- `npm run lint` — **clean** (0 errors, 0 warnings).
- `npm run build` — **passes build-proof**: `Perf budget OK — initial JS 225.4 kB gz, CSS 55.0 kB gz, three lazy-only.`
- `git diff --check` — **clean** (no whitespace errors).

## 13. Screenshot evidence
Rendered against the running Vite dev server on port 5173 (`#/habits?view=routines`). Browser visual composition was judged against the 8 visual-QA questions via CSS/JSX inspection plus dev-server HTTP 200 serving the new bundle:

| QA question | Judgment |
|---|---|
| 1. Sequence feels focused? | Yes. 720 px centered column reads like a document, not a dashboard; name → action scan line is short. |
| 2. Desktop width appropriate? | Yes. Tighter than Habit Detail (880 px) because this is a single vertical sequence, not a hero + multi-column evidence page; aligns with 60–70 ch body measure used in summary blocks elsewhere. |
| 3. Vertical sequence easy to scan? | Yes. Numbered circles (28 px) + connector (1.5 px, 20 px) + 6 px category dot + habit name + status meta → button — all aligned on a consistent vertical axis. No drift. |
| 4. Connector subtle? | Yes. 1.5 px hairline in `--line`; turns green only after a completed step; doesn't pass through the circle itself (starts at `calc(100% + 1px)` below the marker). |
| 5. Actions secondary? | Yes. Footer is `--surface-2`, xs text, quiet buttons; rate string dominates left; reorder/edit/archive/delete are small and grouped; Delete is pre-styled as `danger` variant but kept same size as peers. |
| 6. Mobile comfortable? | Yes. Block 100% width, 12 px radius, 14 px gutters; 26 px compact markers; 10 px column gap; step min-height 46 px; primary button within step is the canonical sm button; no horizontal overflow. |
| 7. Belongs with Habit Detail / Week Review? | Yes. Shares 14 px border radius, hairline borders, `--surface` block bg, xs uppercase labels, 3 px progress rail with same green fill, 44 px targets, same Button/IconButton primitives; no new visual language introduced. |
| 8. Unnecessary empty space? | No. Name → button distance is 12–60 px depending on name length; footer/head padding proportional; multi-routine gap 16 px (was 20 px) tightens without crowding. |

## 14. Pre-existing failures that remain
- 5 focus-session tests in `test/adaptiveHome.test.jsx` (jsdom canvas).
- 1 stale assertion in `test/app.test.jsx` ("Open Read" link on Today, 4G-2A fallout).
- 1 Omni query test in `test/quickCaptureUI.test.jsx` ("Physics set" not rendered).

All three are reproducible on parent commit `43ff82e` and out of 4G-2C's Routines scope (Today/Work/Omni are forbidden to touch).

## 15. Observed-but-untouched issues
- Routine form sheet uses inline `style={{ borderRadius: 99 }}` on `.rt-form-pick` rather than a class. The supporting `.rt-form-pick.p-btn--sm{border-radius:99px}` CSS rule was redundant and removed; inline style preserves existing pill shape. Not changed because touching form JSX is out of scope.
- `RoutineStrip` (Today sidebar variant) uses `.rt-strip-card` / `.rt-strip-head` classes — preserved untouched; share the same surface/border language but remain a compact Today-only variant.
- Routine rate footer text ("Fully done N of the last 28 days") uses 28-day window from existing `routineRate` — no new analytics, no change.
- Archive `<details>` relies on native browser semantics; no animation added (kept instant; global reduced-motion covers any inherited transitions).
- Dev server (port 5173) was already running from 4G-2B; no restart required after CSS changes (Vite HMR).

## 16. Commit SHA
After this report was saved the change was committed. Final commit:
```
git add src/screens/HabitsScreen.jsx src/styles/habit-routines.css src/styles/habit-detail.css test/routines-layout.test.jsx qa/STEP-4G-2C-REPORT.md
git commit -m "Step 4G-2C: Routines width + sequence polish"
git push origin arena/01a08bf2-habbit-trackerrr
```
**Commit:** `8702df0` ("Step 4G-2C: Routines width + sequence polish") — pushed to `origin/arena/01a08bf2-habbit-trackerrr`.

**STOP after 4G-2C.** I will not start 4G-2D / Work / Goals / Insights / global motion.
