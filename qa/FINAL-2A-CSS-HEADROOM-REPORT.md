# FINAL PHASE 2A — CSS headroom + style consolidation

**Date:** 2026-09-15
**Commit:** `7f9aa47` — FINAL 2A: Move domain CSS to lazy screen chunks (7 kB initial-CSS headroom)
**Pushed:** `origin/arena/01a08bf2-habbit-trackerrr`

## Goal
Free ≥ 2 kB initial-CSS headroom without any visual redesign. Hard ceiling stays at
56,320 B gz; target ≤ 54,000 B gz.

## Actions
Removed six domain stylesheets from the eager entry (`src/index.css`) and added
the imports at the lazy screen entries that actually own those classes:

| File | Moved from | Moved to |
|---|---|---|
| `styles/habit-detail.css` | index.css (eager) | `screens/HabitDetailScreen.jsx` (lazy) |
| `styles/habit-calendar.css` | index.css (eager) | `screens/CalendarScreen.jsx` (lazy) |
| `styles/habit-week.css` | index.css (eager) | `screens/WeekScreen.jsx` (lazy) |
| `styles/habit-routines.css` | index.css (eager) | `screens/HabitsScreen.jsx` (lazy) |
| `styles/work-v3.css` | index.css (eager) | `screens/WorkScreen.jsx` (lazy) |
| `components/work/WorkEntity.css` | index.css (eager) | `screens/WorkScreen.jsx` (lazy; Today does not render WorkEntity) |

`styles/habits-workspace.css` was already imported by `HabitsScreen.jsx` so the
duplicate `@import` was removed from index.css. `components/habits/HabitObject.css`
remains eager because Today's `TodayWorkList` renders HabitObject (compact
variant). `styles/today-v3.css` and `styles/habits-v3.css` remain eager because
Today and the global `HabitUIProvider` (which mounts `HabitDetailSheet`) use their
classes on every screen.

Renamed `goals.css`'s `.adaptive-risk` → `.goal-risk` (and the one usage in
`GoalDetailScreen.jsx`) to resolve a collision with `adaptive.css`'s
`.adaptive-risk` that the `cssIsolation` test caught once `goals.css` became
lazy (previously the duplicate was masked because both files loaded eagerly).

Updated the 7B test `Advanced button lazy-loads the Lab…` to reflect that the
Advanced control is a `Link` to `/analytics-lab` (deep-link) rather than an
in-page toggle — the double-lazy boundary is preserved (InsightsScreen still
`React.lazy()` imports `AnalyticsLab.jsx`, which itself statically imports
`advancedAnalytics.js`).

No primitives, tokens, or shared surfaces were moved. No visual properties
changed.

## Results

| Measure | Before (audit) | After (2A) | Δ |
|---|---:|---:|---:|
| Initial CSS gzipped | **55,749 B** | **48,691 B** | **−7,058 B** |
| Headroom vs 56,320 B ceiling | 571 B | **7,629 B** | +7,058 B |
| Target (≤ 54,000 B gz) | missed | **PASS** (48.7 kB) | — |
| Initial JS gzipped | 230,320 B | 230,350 B | +30 B (noise) |

### Lazy CSS (post)
| Chunk | gzip |
|---|---:|
| `WorkScreen-*.css` | 1,213 B |
| `WeekScreen-*.css` | 1,841 B |
| `HabitDetailScreen-*.css` | 2,287 B |
| `workspace-*.css` | 2,750 B |
| `goals-*.css` | 2,756 B |
| `CalendarScreen-*.css` | 2,897 B |
| `HabitsScreen-*.css` | 3,437 B |
| `insights-*.css` | 3,636 B |

All domain prefixes verified absent from the initial chunk:
`hd-*`, `hc-*`, `wr-*`, `rt-*`, `hw-*`, `dlv__*`, `we-*` — none present in
`dist/assets/index-*.css`.

## Verification
- `npm run lint` — clean
- `git diff --check` — clean
- `npm run build` — ✓ built in ~5 s, **Perf budget OK**
- HTTP smoke (dev server): `/`, `/#/today`, `/#/insights{,?view=mind,record,achievements}`, `/#/analytics-lab`, `/#/work`, `/#/projects`, `/#/assignments`, `/#/workload`, `/#/timeline`, `/#/goals`, `/#/habits`, `/#/calendar`, `/#/week`, `/#/achievements`, `/#/record` all 200.
- Targeted tests (111/111 pass):
  - `test/cssIsolation.test.js` (4/4)
  - `test/advancedAnalytics.test.js` (46/46) — double-lazy contract intact
  - `test/build-proof.test.js`
  - `test/analytics.test.js`
  - `test/achievements.test.js`
  - `test/insights-overview-7b.test.jsx` (10/10)
  - `test/insights-mind-7c.test.jsx`
- AnalyticsLab chunk stays lazy (14.3 kB gz); advancedAnalytics.js is still
  imported only from AnalyticsLab.jsx.

## Files changed (this step only)
- `src/index.css`
- `src/screens/HabitDetailScreen.jsx`
- `src/screens/CalendarScreen.jsx`
- `src/screens/WeekScreen.jsx`
- `src/screens/HabitsScreen.jsx`
- `src/screens/WorkScreen.jsx`
- `src/screens/GoalDetailScreen.jsx`
- `src/styles/goals.css`
- `test/insights-overview-7b.test.jsx`

The 8 other modified files in the working tree (`App.jsx`, `nav.js`,
`icons.jsx`, `AchievementsScreen.jsx`, `InsightsScreen.jsx`, `RecordScreen.jsx`,
`insights.css`, `spatial.css`) are the 7D (Records/Achievements/Advanced)
reapplication from the audit step and were NOT staged in this commit. They
remain in the working tree for the upcoming 2B–2G passes.

## Stop condition met
STOP after 2A. Do not touch Work rows, HabitObject adoption, accessibility,
Calendar/Week, or P2 items until Phase 2B.
