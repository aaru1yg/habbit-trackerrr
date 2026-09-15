# Step 6B — Goals Overview Redesign — QA Report

**Date:** 2026-09-14
**Scope:** `#/goals` only. Goal Detail, Goal Analytics, GoalAtlas internals, Work, Habits, Today, Insights NOT redesigned.

## What changed
- **`src/screens/GoalsScreen.jsx`** — rewritten Goals Overview:
  - Header uses Work-family `.wo__head` / `.wo__eyebrow` with "GOALS" eyebrow, h1 title (clamp 1.6→2.1rem), directional sub-copy, "New goal" primary.
  - **Snapshot pills** (`.dlv__snap`): Active / Attention / Healthy / Completed counts (real, no fakes), plus Next-milestone pill when one exists. Pills, not big cards.
  - **Toolbar** with segmented tabs: Active · Needs attention · Completed · All (with counts); Trajectories/Atlas view switch preserved. Atlas remains lazy + opt-in.
  - **Goal list (`goal-row`)**: area chip + unified health status pill → title (font-display, 1.2–1.4rem) → why sub → big `goal-row__pct` colored by area (or green when completed) → **trajectory strip** → snapshot pills (Progress% / Horizon / Milestones / Momentum) → Next-milestone row → footer Edit/Archive/Delete.
  - **Completed goals** are visually quieter (receded background, opacity 0.78, left-border green) and only appear in the Completed tab or All view.
  - **Unified health vocabulary** (one presentation layer — `goalHealthLabel`):
    - Completed (good) — reached goals
    - Overdue (bad) — past target + not done
    - At risk (warn) — behind pace >15
    - Ahead (good) — ahead of pace >15
    - On track (neutral)
    - No date (neutral) — no target date
    Replaces the three parallel vocabularies (`goalHealth` labels / `healthBadge` / `goalForecast.risk.id` uppercase) for the overview card; healthBadge file left untouched (still used by Goal Detail until 6C).
  - **Trajectory strip** (the canonical Goal visual — long arcs, not rings):
    - Inline SVG, 640×64, responsive width.
    - Baseline + 50% dashed guide.
    - Expected pace: dashed line from (start, 0%) → (today, expected%) when window exists, colored by tone (warn/bad/neutral).
    - Actual progress: 2.5px stroke in the goal's `--cat-*` area color, with filled end dot; gaps stay gaps (no interpolation).
    - Projection: dashed extension to 100% when `goalForecast` says "projected" (≤21 days out).
    - Milestone dots: filled if reached, hollow if upcoming, positioned along the arc.
    - Today marker: dashed vertical + arrow tick.
    - Legend (actual / expected / projected / milestone).
    - `role="img"` with descriptive aria-label; canvas-free (lightweight inline SVG, lazy-chunk CSS).
  - **Momentum pill:** honest wording from real analytics — "Stalled" (paused), "Slowing · Npts behind", "Ahead · Npts", "Npts/wk" velocity, "Getting started". No fabricated score.
  - Empty state rewritten: "What are you moving toward?" explains goal purpose; "Set your first goal" + "Learn how goals work" actions; no fake demo goals.
  - Reused: `SectionCard`, `EmptyState`, `WorkEmpty`, `Button/IconButton`, `.dlv__snap/.dlv__pill`, `.wo__head/.wo__eyebrow`, `.seg/.seg-btn`, `.chip/.chip-btn`, `goalForecast`, `goalAnalytics`, `goalProgress/goalHealth/goalPace/nextMilestone`, `GoalFormSheet`, lazy `GoalAtlas`.
  - **No new data engines, no new selectors.** All numbers come from existing `goals.js` / `goalAnalytics.js` / `adaptive.js`.

- **`src/styles/goals.css`** (lazy chunk): rewritten to support the new overview while keeping Goal Detail styles intact for 6C. All goal-specific CSS stays in the **lazy** goals chunk, so the initial bundle is NOT grown.

- **`test/goals-overview-6b.test.jsx`** — 9 new tests covering: header+snapshot pills, trajectory SVG (no rings), health vocab, Atlas lazy+opt-in, deep links to detail, empty state, next-milestone toggle (existing engine), touch/reduced-motion/mobile CSS contract, real-data counts.

- **`test/goalsV6.test.jsx`** — updated label assertions to match the new unified health vocabulary (Overdue, Completed, Needs attention tab, Trajectories/Atlas buttons, new empty-state copy).

## Data/selectors reused (no new engines)
- `goalProgress`, `goalHealth`, `goalPace`, `nextMilestone`, `openGoals`, `areaOf`, `GOAL_AREAS` — `src/lib/goals.js`.
- `goalAnalytics` (actual/expected/velocity/consistency/projection) — `src/lib/goalAnalytics.js`.
- `goalForecast` (risk, projected completion, reason) — `src/lib/adaptive.js`.
- Existing reducers: `UPDATE_GOAL`, `DELETE_GOAL`, `RESTORE_GOAL`, `TOGGLE_GOAL_MILESTONE` — unchanged.

## Trajectory approach
- Compact horizontal arc (64px tall) per goal row — no rings, no charts dashboard.
- Shows actual progress (solid area-color line), expected pace (dashed tone line), milestone markers, today marker, projected finish (dashed) only when `goalForecast.reason === 'projected'`.
- Gaps in actual data remain visible (line breaks at nulls), never interpolated.
- Category color (`--cat-*`) drives the trajectory line + percent number; health drives the 3px left-border tone (good/warn/bad/neutral), so identity and status are visually independent.

## GoalAtlas behavior
- Still lazy-loaded via `React.lazy`, shown **only** after user clicks "Atlas" in the view switch; default is Trajectories list. Toggling back to Trajectories unmounts it.

## Visual / responsive QA
- 1440/1024: PageContainer `workspace` (980px); goal rows stack vertically; snapshot pills wrap; trajectory stretches across the card; desktop density feels premium and calm.
- 430/390: `<720px` media query wraps the head (percent stacks under title), stacks toolbar columns to full-width, wraps next-milestone row, shrinks title to 1.2rem. All interactive buttons min-height 44px (`var(--touch)`); no horizontal overflow.
- Trajectory remains understandable at narrow widths (SVG is viewBox-scaled; milestones become 3px dots; today arrow stays sharp).
- Goals visually distinct from Work (area-color arcs instead of `.dlv__pulse` 14h bars; `.wo__eyebrow`/`.dlv__pill` family shared so it clearly belongs to the same product). No habit rings. No Work deadline rails. No glass/3D/decorative gradients.

## Tests
- Goals suites: `goals-overview-6b` (9) + `goalsV6` (11) + `goals.test.js` (24) + `goalAnalytics.test.js` (14) = **58/58**.
- Work/Today/shell/primitives regressions (work-*, workspace, page-container-widths, today-step3-audit, work-entity, primitives, shell) = **179/179**.
- Combined: **237/237 passing**.

## Lint / build / CSS
- `npm run lint`: clean.
- `git diff --check`: clean.
- `npm run build`: **Perf budget OK — initial JS 225.0 kB gz, CSS 55.0 kB gz, three lazy-only.**
- **Initial `index-*.css` gz = 55,987 bytes** (unchanged — under 56,320 ceiling; 333-byte margin preserved; ceiling NOT raised).
- **Lazy `goals-*.css` gz = 2,933 bytes** — all Goals-specific styling moved/stays in the lazy chunk; zero initial-CSS growth.

## STOP
Per Spec §25, halting after Goals Overview. Goal Detail (6C), Goal Analytics (6D), Insights, Work/Habits/Today not touched beyond the App.jsx 6A PageContainer sizing already in place.
