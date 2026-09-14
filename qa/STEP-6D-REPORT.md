# Step 6D — Goal Analytics / Progress — QA Report

**Date:** 2026-09-14
**Scope:** Progress analytics surface on `#/goals/:id` only. Goals Overview, GoalAtlas internals, Goal Detail non-analytics layout, Work, Habits, Today, Insights NOT redesigned.

## What changed
- **`src/screens/GoalDetailScreen.jsx`** — added a "Progress analytics" `SectionCard` between Milestones and Notes. The section houses a single information-dense multi-series trajectory chart (primary visual) plus four secondary analytics stat tiles (Velocity, Consistency, Projection, Pace) and a data-backed insight sentence. The header trajectory strip remains as a quick orientation; the new analytics section provides the richer decision-support view.
- **`src/styles/goals.css`** (lazy chunk): added `.goal-analytics`, `.goal-analytics__chart`, `.goal-analytics__grid`, `.goal-analytics__stat`, `.cons-strip`, `.goal-analytics__insight` rules plus mobile density rules; all in the lazy Goals chunk. No initial-bundle CSS touched.
- **`test/goals-analytics-6d.test.jsx`** — 8 new tests.

Files changed: 3 (screen + css + test + report = 4).

## Analytics / data reused (no new engines)
- `goalAnalytics(state, goal)`: `actual`, `expected`, `velocity` (perWeek, points, fromDay/toDay), `projection` (day/reason/daysLeft/pct), `consistency` (pct, detail, source) — `src/lib/goalAnalytics.js`.
- `goalForecast(state, goal)`: `risk`, `requiredPacePerDay`, `actualPacePerDay`, `reason`, `deadline`, `projectedCompletion` — `src/lib/adaptive.js`.
- `goalProgress`, `goalPace`, `goalHealth`, `nextMilestone`, `daysUntil`, `daysBetween`, `prettyDate/shortDate/dayOf/isValidDayStr`.
- No new selectors, no new forecasting math, no smoothing/interpolation.

## Chart approach (single information-dense SVG)
- 780×260 inline SVG (scaled responsively to 220px on narrow screens) — no chart library added.
- **Series:**
  - **Actual:** solid 2.8px category-color (`--cat-*`) stroke over a subtle gradient fill — what has really happened.
  - **Expected:** 1.6px dashed tone-colored line (bad/warn/neutral) from (start, 0%) → (today, expected%) → (target, 100%) — only when a start+target window exists.
  - **Projection:** 2px dashed category-color line from last known point out to a projected-100% intersection, only when `goalForecast.reason === 'projected'` and ≤30 days out; otherwise omitted.
  - **Milestones:** filled circles for reached, hollow circles for upcoming, with short labels above upcoming milestone dots when they fit.
  - **Today:** dashed vertical + arrow + "Today" label in identity color.
  - **Target:** dashed vertical + "Target" label when a target date exists.
  - **Projected-end:** dashed vertical + "Projected" label when projection drawn.
  - **Velocity bars:** 14 tiny bars behind the actual line visualizing per-segment progress (relative scale, same identity color, low opacity).
- **Axes:** 0/25/50/75/100% y-guides with labels; 6 date anchors along x-axis; honest gaps remain gaps (line breaks at null points — no interpolation).
- **Legend:** actual / expected / projected / milestone — all semantic, no rainbow.

## Forecast / velocity / consistency handling
- **Velocity tile:** shows `velocity.perWeek + " pts/wk"` when available, with point count + day span sub-caption ("across N points, D days"); falls back to "Not enough data yet."
- **Consistency tile:** shows `consistency.pct + "%"`; a 14-segment `.cons-strip` bar visualizes recent activity windows (filled = movement, empty = no recorded change). Sub-caption uses `consistency.detail` (which is source-aware: "N of M scheduled habit days completed", "N of M milestones met target date", "Work-linked goals measure progress, not cadence").
- **Projection tile:** shows projected pretty-date when `reason === 'projected'`; "Stalled" when stalled; "Reached" when complete; "—" with "Need more progress data" otherwise.
- **Pace tile:** shows expected% + `N pts behind/ahead` sentence when a window exists; otherwise prompts to set a target date.
- **Insight strip:** colored left-border by health tone; copy is data-backed (e.g. "Current velocity projects completion after the target." / "Tracking N points ahead of expected pace." / "Progress has stalled" / "Set a start date and target date to see expected pace and projection.") — no motivational fluff.

## Empty / insufficient-data states
- `known.length < 2` → honest message: "Not enough progress history yet to draw a trajectory. As milestones are reached or linked work moves, the arc will appear here." No skeleton grid, no fake straight line.
- No target date → expected/projection lines not drawn; Pace tile says "Set a target date for a pace line."; insight says "Set a start date and target date to see expected pace and projection."
- Completed goals → "Goal reached." insight + good-tone border; projection tile says "Reached"; no Needs-attention warning.
- Stalled projection → "Stalled. Recent velocity is zero."

## Tests
- Goals suites: `goals-analytics-6d` (8) + `goals-detail-6c` (10) + `goals-overview-6b` (9) + `goalsV6` (11) + `goals.test` (24) + `goalAnalytics.test` (14) = **76/76**.
- Full regression: Work 5A–5H + workspace + page-container + today-step3 + work-entity + primitives + shell + Goals = **19 test files / 255/255 passing**.

## Lint / build / CSS
- `npm run lint`: clean.
- `git diff --check`: clean.
- `npm run build`: Perf budget OK — initial JS 225.0 kB gz.
- **Initial CSS gz = 55,987 bytes** (unchanged; 333-byte margin under 56,320 — ceiling NOT raised).
- **Lazy goals-*.css gz = 2,762 bytes** (≈240 bytes larger than 6C due to analytics CSS; still well within Goals' own lazy chunk).

## Responsive QA
- 1440/1024: analytics chart is the dominant width on the main column; 4-col stat grid sits cleanly below; milestone names above dots don't collide at desktop density; insight strip is a single calm line.
- 430/390: chart height reduced to 220px; stat grid collapses to 2 columns; pills wrap; trajectory keeps today+target markers; legend wraps; buttons remain 44px; no horizontal overflow.
- GoalAtlas remains lazy and opt-in; not loaded by analytics.

## STOP
Per Spec §22, halting after Goal Analytics. Insights not started; Goals Overview / Goal Detail layout / Work / Habits / Today untouched beyond the analytics card insertion in Goal Detail.
