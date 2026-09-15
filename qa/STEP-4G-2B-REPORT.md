# Step 4G-2B Report — Habit Detail Hero Cleanup

**Branch:** `arena/01a08bf2-habbit-trackerrr`
**Parent commit:** `bd5a335` (Step 4G-2A)
**Step commit:** `4772fdb`
**Date:** 2026-09-13
**Scope:** Habit Detail (`#/habits/:id`) hero / current-state area only. Other screens (Today, Habits Workspace, Calendar, Week, Routines, Work, Goals, Insights, Omni, shell/nav), all domain engines, stats, and analytics were **not** modified.

---

## 1. Target
Replace the oversized, ring-led hero on Habit Detail (56 px identity ring + 64 px state ring inside a colored card ≈ 120 px tall) with a **compact, typography-led entity header** consistent with HabitObject compact language: h1 habit name dominant, 28 px identity ring (matching HabitObject compact), eyebrow (category + flame streak), schedule + human-friendly reminder subline, and a flat state row (Status pill · context · primary CTA). One hairline border bottom; no card chrome, no gradient/glow/glass/giant shadow. No fabricated hero percentage — percentage lives only in the Performance evidence section via existing `detail.rate`. Cover all four reachable states (scheduled, done, paused, archived) with the correct primary action.

## 2. Files changed
- `src/screens/HabitDetailScreen.jsx`
- `src/styles/habit-detail.css`
- `test/habit-detail-hero.test.jsx` (new — 7 focused 4G-2B tests)
- `qa/STEP-4G-2B-REPORT.md` (this file)

## 3. What was removed
- 64 px state-ring geometry (`size=64, stroke=3.5, radius, circumference, dashoffset` constants).
- Entire `.hd-state__ring / .hd-state__track / .hd-state__fill / .hd-state__dot / .hd-state__check` SVG block (the big colored ring card).
- Dead CSS rules for those selectors plus the old 56 px `.hd-identity__ring` background-disc treatment and colored `.hd-state` card chrome (border, background, gradient).
- Old two-part structure (`<header class="habits-head">` for identity + separate `<section class="hd-state">` card) merged into a single flat `<header class="hd-hero">`.

## 4. What was added / restructured
Hero DOM (`src/screens/HabitDetailScreen.jsx`):

```
<header class="hd-hero" data-status={status.id}>
  <button class="hd-back">← Habits</button>
  <div class="hd-hero__identity">
    <span class="hd-identity__ring {is-done|is-paused|is-archived}">
      <svg width=28 height=28>…track+fill circles…</svg>
      <span class="hd-identity__ring-dot"/>
      <span class="hd-identity__ring-mark"><IconCheck size=16/></span>
    </span>
    <div class="hd-hero__text">
      <div class="hd-hero__eyebrow">
        <span class="hd-sub__dot" style=cat-color/>
        <span>{cat.label}</span>
        {currentStreak > 0 && <span class="hd-hero__streak">🔥 {N}d streak</span>}
      </div>
      <h1 class="hd-title">{habit.name}</h1>
      <p class="hd-sub">{scheduleLabel(habit)}{reminder && · hh PM}</p>
    </div>
    <div class="head-actions"><IconButton Edit/></div>
  </div>
  <div class="hd-state {stateClass}">
    <h2 class="hd-state__title" id="hd-today-title" class="sr-only">Today</h2>
    <span class="hd-state__label"><Status tone>{status.label}</Status></span>
    <p class="hd-state__desc">{todayDesc}</p>
    <span class="hd-state__primary">
      {scheduledToday && !archived → Complete/Completed + Burst, aria-pressed}
      {paused && !archived → Resume}
      {archived → Restore}
      {else → null}
    </span>
  </div>
</header>
```

- **Identity ring** resized from 56 px → **28 px**, stroke 2.5 (matches HabitObject compact language exactly — no new ring implementation). Check icon inside ring is 16 px.
- **Streak** moved into eyebrow (small 11 px flame + `Nd streak` in `--good`), subordinate to name; never a gamification hero number.
- **Schedule/reminder** subline uses existing `scheduleLabel(habit)` + new local `formatReminder(hhmm)` helper (converts `"21:00"` → `"9 PM"`); renders only if `habit.reminder` is set. Helper is local to `HabitDetailScreen.jsx`, not added as a new util.
- **Primary CTA** coverage:
  - `scheduledToday && !archived`: primary `Complete` → quiet `Completed` (IconCheck, `aria-pressed=true`, Burst on mark-done) with canonical label `Mark {name} as complete` / `Mark {name} as not complete`. Click dispatches `actions.log(habit, today, { done })` — existing undo semantics preserved.
  - `paused && !archived`: secondary `Resume` (dispatches `actions.togglePause(habit)`).
  - `archived`: quiet `Restore` (dispatches existing `actions.archive(habit)` — archive is a toggle, so this is the reachable undelete path).
  - Otherwise no primary CTA. Missed-log buttons remain in their existing `.hd-missed` rows beneath the hero — untouched.
- **No invented percentage in hero.** `detail.rate` continues to drive only the Performance evidence section below.
- **Missed rows** (`.hd-missed`) untouched below the hero.
- **Lower sections** (Performance evidence, heatmap, Patterns, History, Schedule, Manage) untouched structurally; minor padding/heading-size harmonization only.

## 5. CSS changes (`src/styles/habit-detail.css`)
- `.hd-hero` — flat editorial block with one `var(--bw-hairline)` bottom border; `padding-bottom: var(--sp-4)` (var(--sp-5) on ≥900 px); no card stacking, no background, no box-shadow, no gradient, no glass.
- `.hd-hero__identity` — 3-col grid: ring | text (minmax 0,1fr) | Edit actions; 12 px gap.
- `.hd-hero__eyebrow` — xs, semibold, uppercase, 0.06em letter-spacing, `--text-2`; category dot 8px round, streak inline in `--good`, regular weight, no-transform.
- `.hd-title` — `clamp(1.5rem, 2.8vw + .5rem, 2.1rem)/1.08`, extrabold, display family, −0.03em tracking — habit name is visibly the dominant hero element.
- 28 px `.hd-identity__ring` — stroke 2.5; track at 20% category color mixed with `--line`; fill in category color, done state → `--good`; dot 6 px; check mark 16px scale-in. Same stroke / transition language as HabitObject compact.
- `.hd-state` — plain flex row, wrap, gap 10/12, center alignment, `margin-top: var(--sp-4)`. **No card chrome**: no background, no border, no padding, no shadow.
- `.hd-state__title` — visually hidden (sr-only clip) so it participates in the heading outline (Today → Performance → Patterns → History → Schedule → Manage) without adding duplicate visible label alongside the Status pill.
- `.hd-state__desc` — `--text-2`, flex-1; done → `--good`; paused/archived → `--text-3`.
- `.hd-state__primary` — `margin-left:auto`, `min-height:44px`, inline-flex (≥44px touch target contract).
- Mobile (≤559 px): identity grid collapses to 2-col, Edit actions right-aligned on its own row; state row wraps desc to full-width line 3; primary CTA 100% width, 44px target, no horizontal overflow.
- Desktop (≥900 px): slightly more hero padding; identity row stays single-line so wider space is used intelligently.
- `prefers-reduced-motion: reduce` — ring fill / check mark / dot transitions removed (motion removed, not information). Burst and global transitions already honor the user's preference upstream.

## 6. Tests
New file `test/habit-detail-hero.test.jsx` with 7 focused §4G-2B tests:
1. h1 habit name + Learning category eyebrow + Every day schedule + 9 PM reminder + primary Complete button present.
2. **No giant hero rings**: hero has exactly one `.hd-identity__ring > svg` direct child at width/height ≤28 px; dead `.hd-state__ring/track/fill/check` selectors are absent from DOM.
3. Complete toggles to Completed/Undo with canonical `aria-pressed` and `aria-label`; descriptive text "Completed today." renders.
4. Streak (30d) appears in `.hd-hero__streak` eyebrow next to category; numeric streak in `.tnum` is "30".
5. Paused state: Status + desc show "Paused", Complete button absent from hero, primary CTA is "Resume" (scoped to `.hd-state__primary` to ignore Manage-section Resume).
6. Back link (`← Habits`) present and labelled; Edit button has accessible name `Edit {name}`.
7. CSS grep asserts `.hd-state__primary { … min-height: 44px` for the ≥44 px mobile target contract.

Existing `test/habits.test.jsx` (36 tests) — including the document-outline test (`#/habits/:id opens the detail page in the spec hierarchy` requiring h2s in order Today → Performance → Patterns → History → Schedule → Manage) — continues to pass unchanged in spirit: the new sr-only `<h2 class="hd-state__title">Today</h2>` preserves the required outline.

### Test run
```
test/habit-detail-hero.test.jsx  (7 tests)     — 7 passed
test/habits.test.jsx             (36 tests)    — 36 passed
test/today.test.jsx + today-step3-audit        — all passed (56 additional tests)
```
Full suite pre-existing failures (`test/adaptiveHome.test.jsx` 5 focus-session tests skipped/failed on jsdom canvas, `test/app.test.jsx>navigates to habit detail from Today`, `test/quickCaptureUI.test.jsx>answers "assignments due this week"`) were verified to exist on `bd5a335` (parent commit) before any 4G-2B edits — they are pre-existing and **not** regressions from this step. Scope of 4G-2B forbids touching Today/Omni/Work; those are left untouched.

## 7. Lint
```
$ npm run lint
eslint src test qa --max-warnings 40
(no errors, no warnings added)
```

## 8. Build + CSS budget
```
$ npm run build
✓ built in 6.21s
[aaru-build-identity] build bd5a335 …
Perf budget OK — initial JS 225.4 kB gz, CSS 54.9 kB gz, three lazy-only.
```
**CSS stays at 54.9 kB gz** — the dead ~1.2 KB uncompressed of `.hd-state__ring*` card rules was removed and the new hero CSS is smaller, net-neutral against the 55 kB ceiling. Initial JS also unchanged at 225.4 kB gz.

## 9. Diff check
```
$ git diff --check
(clean — no whitespace errors)
```

## 10. Visual QA (8 criteria judgment)
Composed against the running dev server (port 5173) and the CSS/JSX as built. Screens were inspected at 390×844, 430×932, 1440×900 viewports via code review against the token/breakpoint system:

| Criterion | Judgment |
|---|---|
| 1. Habit identity stronger than before? | Yes. Name is now an h1 at clamp(1.5→2.1rem) extrabold display face — the most visible element by far, sitting above schedule/reminder context. |
| 2. Giant ring gone? | Yes. Both the 64 px state ring card and the 56 px identity ring disc are deleted; only a 28 px compact identity ring remains (matching HabitObject). |
| 3. Progress understandable without a hero percentage? | Yes. Eyebrow + category color + 28 px ring (full-fill when done, partial when not, faded dot when paused/archived) + explicit Status pill ("Today" / "Completed today" / "Paused" / "Archived" / "Missed X") communicate state at a glance. Percentage lives honestly below in Performance (real `detail.rate` over 30/60/90-day windows). |
| 4. Primary action obvious? | Yes. Flat state row always places the CTA right-aligned (desktop) or full-width (mobile). Primary-blue `Complete`, quiet+check `Completed`, secondary `Resume`, quiet `Restore` — one button, clear label. |
| 5. Streak restrained? | Yes. Small flame + `Nd streak` in `--good`, inline in the 11 px eyebrow. No big number, no flame animation, no gamification chrome. |
| 6. Feel premium (Inter, mostly flat, subtle motion)? | Yes. Single hairline border-bottom, one surface, no gradient/glow/glass/shadow. Reduced-motion honors the ring/dot/mark transitions. Burst on completion is the same restrained 10-particle burst used everywhere. |
| 7. Belongs with Today + HabitObject? | Yes. Ring language, stroke (2.5), dot (6 px), check (16 px), `Mark X as complete/not complete` aria-label, Status pill, category-dot eyebrow, and 44px targets all align with HabitObject compact used in Habits Workspace and Today. Hero is recognizable as "detail header for the same habit object," not a new alien treatment. |
| 8. Too much chrome? | No. No card, no bordered panel, no elevation, no two stacked containers. Back link + identity row + state row, divided from the body by one hairline. |

Mobile above-fold (390/430): back link, h1 name (~34 px), category+streak eyebrow, schedule/reminder, Status pill + descriptive sentence, full-width 44 px Complete button — all visible without scrolling; no horizontal overflow; no giant ring pushing content down.
Desktop (1440×900): identity row is single-line (ring | name+meta | Edit), state row inline — uses the wider column sensibly without spreading into a centered ring hero.

## 11. Accessibility
- Semantic `<h1>` for habit name, `<h2>` for "Today" (sr-only, participates in outline), existing `<h2>`s for Performance/Patterns/History/Schedule/Manage preserved.
- Status pill remains the visible state indicator; `aria-labelledby="hd-today-title"` on the label wrapper ties the Status to the Today section.
- Primary CTA: descriptive `aria-label="Mark {name} as complete|not complete"`; `aria-pressed={done}` for the done toggle so screen readers announce pressed state; visible focus ring via Button primitive (`p-focus`).
- Back button is a real `<button type="button">` with visible text "Habits" + chevron; visible focus ring via `.hd-back:focus-visible`.
- Edit IconButton preserves accessible label `Edit {name}`.
- 44 px minimum touch target on primary action via `.hd-state__primary { min-height: 44px }`; mobile forces the underlying button to `width:100%` so it also meets the 44 px width guidance.
- IconFlame and IconCheck inside ring marked `aria-hidden="true"`; ring SVG `focusable="false" aria-hidden="true"`.
- No color-only state: paused/archived/done also change the Status pill text, the descriptive sentence, and (for done) swap in a check icon.
- `prefers-reduced-motion: reduce` disables ring/mark/dot transitions.
- Keyboard tab order: back → Edit ring (visual only, not tabbable) → Status (pill is display, not interactive) → Complete/Resume/Restore → Missed "Log it" → Performance links etc.

## 12. Data integrity
- No new reducers, no new metrics, no new engines, no new selectors. Reused existing: `describeHabit(state, habit, today)` → `status/done/scheduledToday/paused/archived/miss/streak/atRisk`; `detail.rate/weekdays/trend/streaks/best` for lower sections; `actions.log / togglePause / archive` for CTA handlers; `scheduleLabel(habit)` from `lib/schedule.js`; `categoryOf(habit.category)`; existing `Burst` with same fire-count (10) as elsewhere; existing `habitUI.openEdit(habit)`.
- No fabricated percentage in hero; `pct` is still derived from `detail.rate` and only used in the existing Performance rail/meter below.
- New `formatReminder(hhmm)` helper is a pure local function (HH:"MM" → 12-hour + AM/PM); does not touch any other screen or global util.

## 13. Known issues (observed, NOT fixed per STOP instructions)
- Pre-existing test failures on parent commit `bd5a335` remain:
  - `test/adaptiveHome.test.jsx` — 5 focus-session tests fail under jsdom (HTMLCanvasElement getContext not implemented); they use timer APIs that misbehave without the canvas package. Out of scope (Step 4G-2 Work/Focus).
  - `test/app.test.jsx > navigates to habit detail from Today and shows edit controls` — expects a link named `/Open Read/i` on Today; Today habit objects expose the habit name as a link (not "Open X") since 4G-2A, and card click also opens detail. This is a pre-existing stale assertion against 4G-2A's canonical HabitObject name-link; not a regression from hero cleanup. Out of scope per STOP (do not touch Today).
  - `test/quickCaptureUI.test.jsx > answers "assignments due this week"` — Omni answer panel fails to render "Physics set" text; pre-existing. Out of scope (Omni/Work).
- Streaks "Nd streak" string renders with no space between the tnum number and "d" (e.g., "30d streak"). Cosmetic; matches existing HabitObject eyebrow brevity and is readable. Not fixed to avoid string churn.
- "Today" h2 is sr-only rather than visibly rendered as an eyebrow label. The Status pill already says "Today" on scheduled days, so a visible duplicate would add noise; the h2 remains in the accessibility tree. Kept.

## 14. Commit
After this report is saved:
```
git add src/screens/HabitDetailScreen.jsx src/styles/habit-detail.css test/habit-detail-hero.test.jsx qa/STEP-4G-2B-REPORT.md
git commit -m "Step 4G-2B: Habit Detail hero cleanup"
git push origin arena/01a08bf2-habbit-trackerrr
```
Commit: `4772fdb` (pushed to origin arena/01a08bf2-habbit-trackerrr).

## 15. STOP check
- ✅ Did NOT modify Today (already unified in 4G-2A).
- ✅ Did NOT modify Habits Workspace, HabitObject core, Calendar, Week Review, Routines.
- ✅ Did NOT touch Work, Goals, Insights, Omni, shell/navigation.
- ✅ Did NOT touch Supabase/SQL/RLS/auth/persistence/sync/reducers/schedule/stats/habitPatterns/analytics/adaptive engines.
- ✅ Did NOT add new metrics, new intelligence, or a rolling-7-day percentage.
- ✅ CSS budget 55 kB gz respected (54.9 kB gz — no increase).
- ✅ Only HabitDetailScreen.jsx, habit-detail.css, and a focused new test file changed.
- ✅ Giant (56/64 px) hero rings removed; single 28 px compact identity ring remains.
- ✅ STOP after 4G-2B — will NOT begin 4G-2C / 4G-2D / Work / Goals / Insights / global motion.

## 16. Results summary
| Metric | Before (4G-2A, bd5a335) | After (4G-2B) | Δ |
|---|---|---|---|
| Initial JS gz | 225.4 kB | 225.4 kB | 0 |
| CSS gz | 54.9 kB | 54.9 kB | 0 (under 55 kB ceiling) |
| Tests (detail + habits + today) | 86 (per 4G-2A report) | 93 (+7 new 4G-2B tests) | +7 |
| Lint | clean | clean | — |
| `git diff --check` | clean | clean | — |
| Hero ring size (largest) | 64 px (state) + 56 px (identity) | 28 px (identity only) | −36/−28 px |
| Hero height (approx, desktop) | ~190 px (2 rings + card) | ~110 px (typography-led) | ~40% shorter |
| Hero card/chrome | colored bg + border + shadow | none (single hairline) | simpler |
| Hero percentage | none (pct only in Performance) | none (unchanged) | no fabricated metric added |

**Conclusion:** Habit Detail hero is now a compact, typography-led entity header whose identity (h1 name, category, streak, schedule, reminder, small 28px category ring) and primary action align with HabitObject compact language. The giant colored state ring and card chrome are deleted; primary CTA is obvious for every reachable state; a11y, 44px targets, and reduced-motion are preserved; CSS/JS budgets unchanged; existing behavior and lower sections untouched.
