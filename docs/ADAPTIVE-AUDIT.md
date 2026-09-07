# Adaptive Intelligence audit

## Baseline found

The repository already contains production foundations for authentication and Supabase/local persistence (`src/lib/cloud`, `SyncProvider`, RLS schema), offline status and local storage (`store.jsx`), habits/check-ins/schedules/streaks (`stats.js`, `schedule.js`), goals and milestones (`goals.js`, goal screens), projects/tasks/milestones (`work.js`), assignments/subtasks/deadlines (`work.js`), workload/calendar/timeline screens, and analytics/insights (`analytics.js`, `goalAnalytics.js`). Existing charts already include pace, deadline pressure and workload visualizations.

The existing work engine already calculates honest progress and basic on-track/at-risk/overdue display statuses. Existing analytics intentionally returns `enough: false` / null when samples are insufficient.

## Missing for adaptive intelligence

- A single pure, explainable prioritization model combining deadline, priority, progress, risk, goal importance and effort fit.
- A reusable next-best-action primitive for Today, Focus and planning.
- Capacity-aware workload arithmetic and explicit overload explanations.
- A generic deadline-risk contract that considers remaining effort and capacity (rather than only elapsed calendar pace).
- Forecast output that exposes actual progress, remaining effort, velocity and projected completion without fabricating velocity.
- Explicit user-controlled capacity preferences, accepted/editable day/week plans, recovery proposals, and focus-mode UI.
- Pattern/recommendation surfaces that consistently attach observation and evidence.

## Phase 1 implementation

`src/lib/adaptive.js` adds the pure deterministic primitives above. They are safe for local/offline use and do not mutate state. Missing inputs produce null/insufficient-data results rather than invented confidence. The next implementation phase should wire these selectors into Today and add reducer persistence for user-controlled capacity and accepted plans.

## Test baseline

The initial test command could not run before dependency installation (`vitest: not found`). Dependencies were installed with `npm ci`; the existing suite should now be run with `npm test` before each subsequent feature phase.
