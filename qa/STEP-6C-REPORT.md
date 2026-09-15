# Step 6C — Goal Detail Redesign — QA Report

**Date:** 2026-09-14
**Scope:** `#/goals/:id` only. Goals Overview, GoalAtlas internals, Goal Analytics (6D), Work, Habits, Today, Insights NOT redesigned.

## What changed
- **`src/screens/GoalDetailScreen.jsx`** — rewritten deep execution view. Removed the old 150px `ProgressCore` ring hero + duplicate goal-fact grid + "Manage goal" duplicate card; replaced with `.dlv` language (same family as Project/Assignment detail but Goals-identity):
  - **Header:** `.dlv__back` "◀ Goals" eyebrow link; area chip (category color), unified health status pill, horizon chip (target date + countdown/late/due); h1 title (clamp 1.6→2.1rem); why sub; `.wo__head-actions-inline` ghost buttons for Edit / Link / Atlas / Archive / Delete.
  - **Snapshot pills** (`.dlv__snap`): Progress%, Days left/Late/Due or Target date, Projected finish (only when real projection exists), Milestones done/total, Momentum (honest wording), Linked count. Only real values, no placeholders.
  - **Primary visual — Trajectory** (`.goal-detail__trajectory`, 200px tall inline SVG): baseline + 25/50/75 guides, **solid area-color actual line** with gradient fill and end dot, **dashed expected pace** line (colored by health tone warn/bad/neutral), **dashed projected extension** only when `goalForecast.reason === 'projected'` (≤30 days out), milestone dots (filled=reached, hollow=upcoming; names labeled above upcoming milestones when they fit), today marker with arrow + "Today" label, 5 date anchors along x-axis, % labels on y-axis, legend. Gaps remain null (no interpolation).
  - **"Needs attention" surface** (`.dlv__focus`, 3px colored left-border) shown only for Overdue/At risk; explains risk + calls out next milestone.
  - **Main/aside layout** (`.dlv__grid` — matches Project/Assignment detail, 880px PageContainer detail width):
    - MAIN: Next milestone (prominent toggleable row), Today's contribution (linked habits/tasks due today), Milestones (Upcoming / Reached timeline grouping with strike-through for reached), Notes, Manage (Edit / Archive / Delete).
    - ASIDE: Forecast kv (Progress, Expected today, Target, Projected, Required pace, Velocity, Consistency) with unified health label; "What feeds this goal" linked habits/projects/assignments with deep links + inline link editor; optional lazy GoalAtlas when toggled.
  - **Health vocabulary unified** (matches 6B): Completed / Overdue / At risk / Ahead / On track / No date — one presentation layer, no duplicate uppercase `SAFE/ON TRACK/etc`.
  - **GoalAtlas** remains lazy (`React.lazy`) and opt-in via the "Atlas" header toggle; is NOT the default.
  - Archive/Delete confirm sheets preserved with undo toasts; all existing reducers (`UPDATE_GOAL`, `DELETE_GOAL`, `RESTORE_GOAL`, `TOGGLE_GOAL_MILESTONE`) used unchanged.
  - **No new data engines or selectors.**

- **`src/styles/goals.css`** (lazy chunk): consolidated — removed old `.goal-hero-*`/`.goal-fact*`/`.forecast-grid*` legacy rules; added `.goal-detail__head`, `.goal-detail__trajectory`, `.goal-detail__trajectory-viz`, `.ms-timeline`, feed-kind/project/assignment colors. Still in the **lazy** goals CSS chunk; initial bundle untouched.

- **`test/goals-detail-6c.test.jsx`** — 10 new tests covering: correct goal loads, title/area/health/back link, trajectory SVG (no rings), snapshot pills, real-data rendering (no interpolation test), next-milestone toggle dispatches existing engine, deep links to linked habits/projects/assignments, archive confirm sheet opens, GoalAtlas opt-in lazy mount, Completed state (no risk warning), Overdue state shows Needs attention, back link returns to Goals overview.

- **`test/goalsV6.test.jsx`** — assertions updated for the new unified health vocab ("On track" not "ON TRACK"; "What feeds this goal" not "This goal is fed by"; "Trajectory" not "View progress history"; Completed tab; "Needs attention" tab).

## Data/selectors reused (no new engines)
- `goalProgress`, `goalHealth`, `goalPace`, `nextMilestone`, `goalTodayActions`, `areaOf` — `src/lib/goals.js`.
- `goalAnalytics` (actual/expected/velocity/consistency/projection) — `src/lib/goalAnalytics.js`.
- `goalForecast` (risk, projected completion, requiredPace, reason) — `src/lib/adaptive.js`.
- `habitStreak`, `activeHabits` — `src/lib/stats.js`.
- `projectProgress`, `assignmentProgress` — `src/lib/work.js`.
- Existing milestone toggle / archive / delete / undo-restore flows preserved.

## Trajectory implementation
- Inline SVG 780×200, viewBox-scaled for responsiveness; no chart library added, no canvas.
- Uses category color (`--cat-*`) as stroke/fill for the goal identity; health tones (good/warn/bad/neutral) color the expected dashed line and left-border.
- Actual line breaks at null data points (no interpolation).
- Projection only drawn when `goalForecast.reason === 'projected'`.
- Upcoming milestone labels use short-date target positioning along the expected line; reached milestones pin to the actual point nearest their doneAt.
- Today marker is a dashed vertical with arrow + "Today" label.
- Five horizontal guides (0/25/50/75/100%) and five date anchors for orientation.

## Health handling
- One `goalHealthLabel` mapping (matches 6B): completed→Completed, past-target→Overdue, no-date→No date, behind pace >15→At risk, ahead >15→Ahead, else→On track. Removed uppercase `ON TRACK/SAFE/AT RISK/OVERDUE/CRITICAL` vocab from detail; mapped forecast risk text to the same unified labels via tone colors.

## Linked-work handling
- Linked habits (with streak flame), projects (% progress), assignments (% progress) rendered as rows in the aside with deep links to `#/habits/:id`, `#/projects/:id`, `#/assignments/:id`. Each uses `.feed-kind` pills color-coded by domain.
- Link editor (toggleable) uses existing chip-btn pattern with Habits/Projects/Assignments sections; only open (non-archived, non-completed) items offered. Toggles dispatch `UPDATE_GOAL` with existing `linkedHabitIds/linkedProjectIds/linkedAssignmentIds` arrays.
- **No deliverable relationship fabricated** — the model does not have one.

## Tests
- Goals suites (5 files): `goals-detail-6c` (10) + `goals-overview-6b` (9) + `goalsV6` (11) + `goals.test` (24) + `goalAnalytics.test` (14) = **68/68**.
- Work/Today/shell/primitives/page-container regressions (work-*, workspace, today-step3-audit, work-entity, primitives, shell, page-container-widths) = **179/179**.
- Combined = **247/247 passing**.

## Lint / build / CSS
- `npm run lint`: clean (0 errors, 1 pre-existing react-hooks exhaustive-deps warning resolved; final 0 warnings >40 cap is for pre-existing unrelated items — this run produced only the pre-existing warning count 0).
- `git diff --check`: clean.
- `npm run build`: **Perf budget OK — initial JS 225.0 kB gz, CSS 55.0 kB gz, three lazy-only.**
- **Initial `index-*.css` gz = 55,987 bytes** (unchanged — under 56,320 ceiling; 333-byte margin preserved; ceiling NOT raised).
- **Lazy `goals-*.css` gz = 2,523 bytes** (slightly smaller than 6B's 2,933 because legacy hero/forecast-grid/grid duplication was consolidated).

## Responsive QA
- 1440/1024: PageContainer detail (880px); trajectory stretches across main column with clear labels; aside 300px; pills wrap; all buttons ≥44px.
- 430/390: `<760px` media stacks the head actions, collapses the grid to a single column, slightly reduces trajectory height to 170–180px, makes manage buttons flex-grow; no horizontal overflow; h1 wraps; linked-work rows stack vertically after pills.
- No ProgressCore/ring appears at any width. GoalAtlas canvas stays inside its card when toggled.

## STOP
Per Spec §24, halting after Goal Detail. Goal Analytics (6D) and Insights are not started; Goals Overview / Work / Habits / Today untouched beyond 6A–6B.
