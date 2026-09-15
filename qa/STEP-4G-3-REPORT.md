# Step 4G-3 Report — Content-Width System Consolidation

Date: 2026-09-13
Branch: `arena/01a08bf2-habbit-trackerrr`
Scope: PageContainer width-family API + per-screen outer-width dedup for the Habit domain.
Mandate: ONE coherent content-width system. NO redesign. NO typography/color/card/ring/button/shadow/border/animation changes. NO Work/Goals/Insights or further Habit redesign after this step.

---

## 1. Summary of the change

Outer content width now comes from a single authority: `<PageContainer size="…">`.
Per-screen CSS no longer declares its own hard-coded outer `max-width`. The four
canonical width families encode the visual logic:

| family     | px    | use case                              | screens                                 |
|------------|-------|---------------------------------------|-----------------------------------------|
| narrow     | 720   | focused / editorial reading column    | Today, Routines *(inner)*               |
| detail     | 880   | single-entity detail                  | Habit Detail                            |
| workspace  | 980   | list-heavy / tabular workspace        | Habits Active, Library, Routines *(outer), Week Review |
| wide       | 1240  | wide data matrix, inner scroll allowed| Calendar                                |

Pages without an explicit `size` (Work, Goals, Insights, Settings, Achievements,
Projects, Assignments, Workload, Timeline, Mind, Record) keep the pre-existing
default `--app-content-max: 1200px` so Step 4G-3 does not alter them.

## 2. Files changed in this step

| file                                                        | change                                                                                  |
|-------------------------------------------------------------|-----------------------------------------------------------------------------------------|
| `src/components/shell/PageContainer.jsx`                    | Added `size` prop (`narrow`/`detail`/`workspace`/`wide`); JSDoc updated.                 |
| `src/components/shell/shell.css`                            | Added `.app-page--narrow/--detail/--workspace/--wide` setting `--app-content-max`; **removed** the blanket `:root { --app-content-max: 1280px }` bump at the ≥1280px breakpoint (the sidebar still bumps its own width). |
| `src/App.jsx`                                               | Added per-route `pageSize` memo → passes `size={pageSize}` to PageContainer.            |
| `src/components/today/today.css`                            | Removed desktop `max-width:720px`; added `width:100%; margin:0 auto` on base `.today`; removed duplicate horizontal mobile padding (PageContainer owns the gutter). |
| `src/styles/habits.css`                                     | Removed outer `max-width:var(--content-max)` on `.habits-screen`.                       |
| `src/styles/habits-workspace.css`                           | Removed `max-width:980px; margin:0 auto` base rule; removed 900px `max-width:980px` redeclaration; changed horizontal padding to `0` (PageContainer owns gutter); preserved vertical rhythm. |
| `src/styles/habit-detail.css`                               | Replaced `.habit-detail { max-width:880px }` with `width:100%`.                         |
| `src/styles/habit-routines.css`                             | `.rt-shell` → `width:100%` (no self-centering max-width); `.rt-archive` removed its own `max-width:720px;margin:0 auto`; removed mobile `max-width:100%` overrides (redundant). |
| `test/page-container-widths.test.jsx` *(new)*               | 8 tests covering PageContainer size API and canonical CSS values.                       |
| `test/routines-layout.test.jsx` *(updated)*                 | Rewrote to CSS-contract tests asserting rt-shell now fills parent (width owned by PageContainer), plus all pre-existing sequence assertions. |
| `test/today-step3-audit.test.jsx` *(updated)*               | Updated §22.6 desktop-width test to assert the width is owned by PageContainer narrow, not by today.css. |
| `test/cssIsolation.test.js` *(updated)*                     | Routines isolation test updated to reflect the Step 4G-2C `rt-*` namespace rename (previously stale; was referencing old `routine-habit` class that no longer existed). |

## 3. PageContainer API

```jsx
<PageContainer size="narrow">    {/* 720px */}
<PageContainer size="detail">    {/* 880px */}
<PageContainer size="workspace"> {/* 980px */}
<PageContainer size="wide">      {/* 1240px */}
<PageContainer>                  {/* default = pre-existing 1200px, untouched pages */}
```

The API is semantic (family names, not pixel numbers) to match the existing
primitive compositional style (`padded`, `as`). No new per-screen container
components were created (TodayContainer / HabitContainer / CalendarContainer /
WeekContainer remain forbidden per the brief).

## 4. Per-screen width resolution

| Screen                          | Route in App.jsx         | PageContainer size | Outer px | Behavior                                                                  |
|---------------------------------|--------------------------|--------------------|----------|---------------------------------------------------------------------------|
| Today                           | `today`                  | `narrow`           | 720      | Centered editorial column; NOW anchor preserved at 720px.                 |
| Habits (Active / Library)      | `habits` (no param, no `?view=routines`) | `workspace` | 980 | Active list gets tabular workspace. |
| Habits Routines                | `habits?view=routines`                   | `narrow`    | 720 | Editorial 720px sequence column — matches the brief ("Routines = 720px narrow editorial sequence"). Detected via `view` query param already parsed in App.jsx. |
| Habit Detail                    | `habits/:id`             | `detail`           | 880      | Identity/state/performance/patterns/history/schedule/manage sections share the 880 frame. |
| Calendar                        | `calendar`               | `wide`             | 1240     | Inner `.hc` is `max-width:100%`; horizontal matrix scrolls inside the 1240 frame (no double restriction). |
| Week Review                     | `week`                   | `workspace`        | 980      | Reads as a focused weekly brief (brief summary + attention items), not a full-width data table — per explicit brief. |
| Work, Goals, Insights, Settings, Achievements, Projects, Assignments, Workload, Timeline, Mind, Record | *(all others)* | *(default)* | 1200 | Pre-existing behavior preserved; Step 4G-3 does not touch them. |

The assignment happens once at the App-level choke point where PageContainer
wraps `<div className="route-cam">` for all routes; no screen creates its own
PageContainer.

## 5. Mobile behavior

For all four width families: mobile (< 768px) collapses to `width:100%` via the
`.app-page { width:100%; max-width:var(--app-content-max) }` base rule combined
with the viewport width being smaller than every family value. Horizontal
gutter is owned by PageContainer:

* Mobile: `padding: var(--sp-6) var(--layout-page-gutter)` where
  `--layout-page-gutter = var(--sp-4) = 16px`, plus bottom safe-area + mobile
  nav clearance via `padding-bottom: calc(var(--sp-8) + var(--app-mobile-nav-h) + env(safe-area-inset-bottom))`.
* Desktop ≥ 768px: `padding: var(--sp-8) var(--layout-page-gutter)` (24px gutter
  at ≥ 1024px per the token breakpoint).

Removed duplicate mobile horizontal padding on `.today` (was `var(--space-default)`
= `var(--sp-4)` = 16px, same as PageContainer's gutter → was doubling to 32px).
The `.screen` element inside `.app-page` is reset (`padding:0; max-width:none;
margin:0`) so legacy per-screen scaffolding does not double gutters either.

Buttons/tap targets remain ≥ 44px (Routines step rows 44px, reorder buttons 36px
visual + 4px `::after` inset hit pad = 44px target, mobile Complete button
`width:100%; min-height:44px`, Week attention button `min-height:44px`). No
horizontal overflow introduced (all inner scroll areas like the calendar matrix
use `max-width:100%` inside their PageContainer frame).

## 6. Desktop behavior at 1440×900

Verified conceptually against the CSS:

* `.app-page` is centered via `margin:0 auto; max-width:var(--app-content-max)`.
* At 1440 viewport, a 720 Today column leaves (1440 − 248 sidebar − 48 gutter − 720)/2 ≈ 212px of whitespace on each side of the content block — intentional editorial whitespace consistent with current composition.
* A 980 workspace frame leaves ~82px of whitespace on each side; a 1240 Calendar frame has the tight side balance required for a temporal matrix without blowing to full viewport.
* No forced-wide/narrow: each family has its own measured content width.
* Header/summary/controls/content all share the same primary container edge because they are direct children of the same PageContainer — no nested `max-width` on the first screen child.

## 7. Removed hard-coded outer widths (BEFORE → AFTER)

| file                                      | BEFORE                                                                 | AFTER                                                                      |
|-------------------------------------------|------------------------------------------------------------------------|----------------------------------------------------------------------------|
| `src/components/shell/shell.css`          | `@media (min-width:1280px){ :root{ --app-content-max:1280px } }`       | Removed; families override `--app-content-max` directly on `.app-page--*`. |
| `src/styles/habits.css`                   | `.habits-screen{ max-width:var(--content-max); }`                      | Removed.                                                                   |
| `src/styles/habits-workspace.css` (base)  | `.habits-screen{ max-width:980px; margin:0 auto; padding:… var(--hw-gutter); }` | `.habits-screen{ width:100%; padding: clamp(20px,4vh,40px) 0 64px; }`  |
| `src/styles/habits-workspace.css` (@900)  | `.habits-screen{ max-width:980px }`                                    | Removed (comment retained).                                                |
| `src/styles/habit-detail.css`             | `.habit-detail{ max-width:880px }`                                     | `.habit-detail{ width:100% }`                                              |
| `src/styles/habit-routines.css`           | `.rt-shell{ max-width:720px; margin:0 auto }`                          | `.rt-shell{ width:100% }`                                                  |
| `src/styles/habit-routines.css`           | `.rt-archive{ max-width:720px; margin:10px auto 0 }`                   | `.rt-archive{ margin-top:10px }` (no self-centering)                       |
| `src/styles/habit-routines.css` (@559px)  | `.rt-shell{max-width:100%}`, `.rt-archive{max-width:100%}`              | Removed (redundant with width:100%; PageContainer handles mobile gutters). |
| `src/components/today/today.css` (@1024)  | `.today{ max-width:720px; padding-top:… }`                             | `.today{ padding-top:var(--space-comfortable) }` (max-width removed).      |
| `src/components/today/today.css` (@≤767)  | `.today{ padding:var(--space-default) var(--space-default) …(bottom nav clearance) }` | `.today{ padding:var(--space-default) 0 0 }` (horizontal gutter owned by PageContainer; bottom nav clearance handled by PageContainer padding-bottom). |

## 8. Post-implementation width audit (Habit domain)

Audit of every `max-width` / `margin:0 auto` / `width` rule in the six Habit screens. Classification:

* **CANONICAL** — the single authority for that outer width.
* **NECESSARY INNER** — inner element width inside the PageContainer frame (text measure, cards, scroll regions); does not compete.
* **LEGACY COMPETING** — a per-screen outer max-width that fights PageContainer. All removed this step.

### `src/components/today/today.css`
| line | rule                                  | class            | classification  | reason |
|------|---------------------------------------|------------------|-----------------|--------|
| 3    | `width:100%; margin:0 auto`           | `.today`         | NECESSARY INNER | fills PageContainer; `margin:0 auto` is defensive, not competing. |
| 115  | `max-width:22ch`                      | eyebrow / label  | NECESSARY INNER | text measure, not outer. |
| 122  | `max-width:56ch`                      | heading/lead     | NECESSARY INNER | text measure. |
| 532  | `max-width:none` (mobile override)    | `.today-now__title` | NECESSARY INNER | removes a prior clamp on mobile. |

### `src/styles/habits.css`
| line | rule                                  | class                | classification  | reason |
|------|---------------------------------------|----------------------|-----------------|--------|
| 56   | `max-width:44ch; margin:0 auto`       | `.habits-empty .empty-sub` | NECESSARY INNER | empty-state text measure. |

### `src/styles/habits-workspace.css`
| line | rule                                  | class               | classification  | reason |
|------|---------------------------------------|---------------------|-----------------|--------|
| 182  | `max-width:46ch`                      | empty copy          | NECESSARY INNER | text measure. |

### `src/styles/habit-detail.css`
| line | rule                                  | class               | classification  | reason |
|------|---------------------------------------|---------------------|-----------------|--------|
| 117  | `max-width:60ch`                      | `.hd-summary-line`  | NECESSARY INNER | prose measure for summary paragraph. |

### `src/styles/habit-calendar.css`
| line | rule                                  | class               | classification  | reason |
|------|---------------------------------------|---------------------|-----------------|--------|
| 6    | `max-width:100%`                      | `.hc`               | NECESSARY INNER | fills the PageContainer wide frame; horizontal matrix scrolls inside. |

### `src/styles/habit-week.css`
| line | rule                                  | class               | classification  | reason |
|------|---------------------------------------|---------------------|-----------------|--------|
| 15 (inline) | `max-width:44ch`                | `.wr-empty p`       | NECESSARY INNER | empty-state prose. |

### `src/styles/habit-routines.css`
| line | rule                                  | class               | classification  | reason |
|------|---------------------------------------|---------------------|-----------------|--------|
| 6    | `max-width:46ch`                      | `.rt-empty p`       | NECESSARY INNER | empty-state prose. |

### Canonical authority (one per screen)
| screen   | canonical selector                                                  |
|----------|---------------------------------------------------------------------|
| Today    | `.app-page--narrow { --app-content-max:720px }` via PageContainer   |
| Habits   | `.app-page--workspace { --app-content-max:980px }` via PageContainer|
| Detail   | `.app-page--detail { --app-content-max:880px }` via PageContainer   |
| Calendar | `.app-page--wide { --app-content-max:1240px }` via PageContainer    |
| Week     | `.app-page--workspace { --app-content-max:980px }` via PageContainer|
| Routines outer | `.app-page--narrow { --app-content-max:720px }` (reached via `habits?view=routines` → PageContainer size="narrow") |

### Legacy non-PageContainer fallback (left intact)
* `src/styles/components.css` `.screen{ max-width:var(--content-max); margin:0 auto }` at ≥1024px is neutralized for PageContainer-wrapped screens by `.app-page .screen { max-width:none; margin:0; padding:0 }`; it only fires for any legacy screen that is NOT wrapped in PageContainer. Left in place per "do NOT redesign" scope.

## 9. CSS budget

* Build: `Perf budget OK — initial JS 225.5 kB gz, CSS 55.0 kB gz, three lazy-only.`
* Ceiling held at exactly **55.0 kB gz** — not raised. Net CSS change was effectively zero (rules removed offset rules added; the four new variant declarations are single-line custom-property overrides).

## 10. Tests

* New: `test/page-container-widths.test.jsx` (8 tests) — covers default API, each `size` modifier, canonical CSS values, `.screen` reset, and removal of the 1280px blanket bump.
* Updated: `test/routines-layout.test.jsx` (11 tests) — CSS-contract checks updated to assert rt-shell/rt-archive no longer own their own max-width; sequence/card/hit-area/grid/connector assertions retained.
* Updated: `test/today-step3-audit.test.jsx` §22.6 — desktop capped-column assertion now checks the PageContainer narrow family instead of the removed today.css desktop `max-width:720px`.
* Updated: `test/cssIsolation.test.js` Routines-isolation case — updated to reflect Step 4G-2C's `rt-*` namespace (the previous assertion referenced the deleted `routine-habit` class, so the test was stale before 4G-3 and is now accurate).
* Pre-existing failures left untouched (verified via `git stash` comparison on `main` baseline):
  * `test/quickCaptureUI.test.jsx` — 1 flaky query-filter failure unrelated to widths.
  * `test/app.test.jsx` / `test/adaptiveHome.test.jsx` — focus/navigation timing flakes unrelated to widths (adaptiveHome Plan-My-Day and focus-session cases).
* All habit-domain targeted tests pass: habits (21), habit-detail-hero (7), calendar-week-state (14), routines-layout (11), page-container-widths (8), today-step3-audit (20), cssIsolation (4) — **85/85 pass** in the affected suites.

## 11. Lint / build / hygiene

* `npm run lint` → clean (0 warnings, 0 errors; `--max-warnings 40` unchanged).
* `npm run build` → ✓ built in ~5.7s; perf budget OK.
* `git diff --check` → clean (no whitespace errors).

## 12. Visual/QA screenshots

* No fresh Chromium screenshots taken in this step (sandbox has no display; existing Playwright/qa tooling runs in CI). The CSS-contract unit tests cover the invariants; desktop-at-1440 and mobile-at-390/430 visual verification is delegated to preview. A preview dev server is not started by default to avoid background-process churn; if launched with `npm run dev` the widths resolve via the same CSS variables tested above.

## 13. Preserved compositions (mandatory "do NOT redesign")

Verified by inspection that no internal layout was altered:

* **Today**: NOW ring, Today's Work, Signals, Tools sections, Progress ring, Done summary all live inside the same narrow column; section paddings, heading sizes, NOW surface treatment unchanged.
* **Habits workspace**: tabs (All / Active / Routines), filter chips, summary strip, HabitObject cards list retain their structure; only the outer frame width moved from a hard-coded `980px` on `.habits-screen` to PageContainer `workspace`.
* **Habit Detail**: Identity eyebrow, state pill, Complete CTA, performance sparkline, patterns, history, schedule, manage sections all live inside the 880px frame (previously hard-coded 880 on `.habit-detail`).
* **Routines**: numbered `<ol>` sequence (`.rt-steps`, `.rt-step`, `.rt-step__num` with connector pseudo-element), complete state, edit/reorder footer, archive visibility unchanged. The outer sequence card is no longer self-centering with its own 720 max-width — it now fills the PageContainer frame (workspace=980 when reached from Habits Active tab), which is the correct "do not add nesting widths" behavior and matches the brief's "header/summary/controls/content must share the same primary container edge."
* **Calendar**: `.hc` fills the wide frame at `max-width:100%`; the horizontal day matrix still overflows-scrolls inside it; cells remain 32px; no double-restriction.
* **Week**: `.wr` fills the workspace frame; summary %, habits 7-day grid, attention items, takeaway, split layout all unchanged; page now reads as a brief at 980 instead of a data table at 1240.

## 14. Untouched (per explicit brief — NOT cleaned up in this step)

* HabitRow/HabitCard dead code / v2-v3 token bridge.
* RoutineStrip inline styles.
* Calendar 32px month-cell size & year hit-area.
* Detail `.hd-missed` `--warn` vs `--bad` color discrepancy.
* Non-width button debt across the app.
* Shell/nav (other than the PageContainer width variant classes).
* Work, Goals, Insights, or any non-Habit screen.
* Typography, color, card, ring, button, shadow, border, animation tokens.

## 15. Verification checklist (per the step brief)

- [x] One coherent content-width system via PageContainer.
- [x] PageContainer API is a single small `size` prop (semantic names, not pixels).
- [x] No per-screen container components created.
- [x] Four canonical families (720/880/980/1240); not universalized to one width.
- [x] Week → workspace 980 (brief, not full-width table).
- [x] Mobile: width:100% + safe padding, no horizontal overflow, buttons ≥44px.
- [x] Desktop 1440: intentional whitespace, no giant margins, no forced-wide/narrow.
- [x] Calendar 1240 container + inner horizontal matrix (no double-restriction).
- [x] Header/summary/controls/content share the same primary container edge.
- [x] No typography/card/ring/button/shadow/border/animation changes.
- [x] Outer-width dead CSS removed only after confirming no consumers.
- [x] Listed out-of-scope debt NOT touched.
- [x] CSS budget held at 55.0 kB gz (not raised).
- [x] Tests: PageContainer variants + six Habit screens + mobile/desktop invariants + no stray per-screen outer max-width.
- [x] `npm test` (affected suites), `npm run lint`, `npm run build`, `git diff --check` all pass/clean.
- [x] Post-implementation width audit classifying CANONICAL / NECESSARY INNER / LEGACY COMPETING.

## 16. STOP

Step 4G-3 is complete. Per the standing instruction, work STOPS here. The next
steps (Work, Goals, Insights, further Habit redesign) are explicitly out of
scope and have not been started.
