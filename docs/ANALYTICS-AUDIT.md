# Habit OS · Phase D — Analytics Audit & Gap Analysis

**Purpose:** establish what already exists before writing a single new calculation.
Requirement 22 of the brief — *search the repository first, one source of truth*.

Everything below was read from the source, not from the README.

---

## 1. What already exists (reuse, do not rebuild)

### `src/lib/stats.js` — habit-side series
| Function | Returns |
|---|---|
| `dayStats(state, date)` | `{ done, total, pct }` for eligible habits |
| `trendSeries(state, days)` | per-day `{ date, pct, done, total }`, oldest → newest |
| `heatmapSeries(state, weeks)` | GitHub-style weeks of `{ date, weekday, pct, level, future }` |
| `heatLevel(pct)` | 0–4 bucket |
| `habitMatrix(state, days)` | per-habit cells `{ date, scheduled, done, future }` |
| `weekStats`, `weekDays`, `weekDelta`, `weekComparison` | week roll-ups + signed delta |
| `habitPerformance(state, from, to)` | per-habit rate + streak + best |
| `habitRate`, `habitStreak`, `habitBestStreak`, `rankHabits`, `strongestHabit`, `weakestHabit` | scalars |
| `yearOverview`, `moodHabitLink`, `achievements` | calendar year + mood link + badges |
| `dailyInsight`, `weeklyReview` | plain-language read-outs |

### `src/lib/analytics.js` — habit analytics
`weekdayPerformance`, `weekdayVsWeekend`, `consistencyScore`, `consistencyRanking`,
`streakHistory`, `completionDistribution`, `timeOfDayPerformance`, `habitCorrelations`,
`moodCorrelations`, `moodScatter`, `scatterTrend`, `monthlyPulse`, `personalBests`,
**`smartInsights`** (8 data-gated families), **`timelineEvents`**, `searchAll`,
`habitDetail`, `streakMilestone`, `mindSeries`, `weekHabitTable`.

### `src/lib/work.js` — work-side analytics
`projectProgress`, `assignmentProgress`, `projectStatus`, `assignmentStatus`, `projectPhase`,
`projectPace`, `assignmentPressure`, **`workloadSeries`** (per-day minutes + the actual
assignments/projects/tasks/milestones landing that day), `workloadSummary`,
**`deadlineLanes`**, **`deadlineTimeline`**, `calendarMarkers`, `progressSeries`,
**`velocitySeries`** (tasks/subtasks completed per day), `entityVelocity`, `burndown`,
`timeVsWork`, `itemHistory`, `projectsSummary`, `assignmentsSummary`, `priorityWork`,
`projectCompletionTrend`, `assignmentCompletionTrend`, **`weeklyCompletionSpeed`**,
`projectComparison`, `timeDistribution`.

### `src/lib/goalAnalytics.js`
`goalProgressAt`, **`goalActualSeries`**, **`goalExpectedSeries`** (the pace line),
**`goalVelocity`** (points/week), **`goalProjection`** (with `reason: projected | insufficient | stalled | complete`),
`goalConsistency`, `goalAnalytics`.

### `src/lib/goals.js`
`goalProgress`, `goalPace`, `goalHealth`, `nextMilestone`, `goalSummary`, `goalTodayActions`.

### `src/lib/adaptive.js`
`deadlineRisk`, `scorePriority`, `getTodayPriorities`, `getNextBestAction`,
`workloadCapacity`, `workloadByDay`, **`deadlinePressure`**, `rescheduleSuggestions`,
`assignmentPace`, **`goalForecast`**, **`projectForecast`**, **`goalContributors`**.

### `src/lib/habitPatterns.js`
`weekdayPattern`, `timePattern`, `trendAnalysis`, `streakPattern`, `workloadInteraction`.

### Charts (`src/components/charts/`)
`chartKit`: `TrendChart`, `WeekBars`, `Heatmap`, **`HabitMatrix`**
`workCharts`: `LineSeries`, `BurndownChart`, **`LoadBars`**, `LoadColumns`, **`HBarList`**,
`BucketColumns`, `TimeVsWorkBars`, `Sparkline`, **`CompareBars`**, `DonutStat`
Plus `PaceChart`, `PulseRibbon`, `MoodScatter`, `DayClock`.

**These are the source of truth for rendering.** Phase D adds no new chart primitives.

---

## 2. Gap analysis

| Brief | Exists? | Gap |
|---|---|---|
| **2 Timeline** | ◐ `timelineEvents` covers habits, streaks, notes, project start/progress/complete, assignment complete/progress, reflections, achievements | **Missing:** project tasks, goal milestones, focus sessions, workload. **Missing:** 7D/30D/90D/6M/1Y/ALL ranges and filtering. |
| **3 Trajectory** | ◐ `goalActualSeries`+`goalExpectedSeries`+`goalProjection`; `progressSeries`; `projectForecast`; `assignmentPace` | **Missing:** one PAST / CURRENT / PROJECTED shape across all four kinds, and an honest "nothing to project" for habits. |
| **4 Workload landscape** | ◐ `workloadSeries` already returns per-day minutes *and* the items behind them | **Missing:** capacity/committed/overload framing and a drill-down surface. |
| **5 Consistency matrix** | ◐ `habitMatrix` + `HabitMatrix` chart | **Missing:** habit filtering, range control, weekday analysis, and per-cell drill-down. |
| **6 Goal contribution** | ◐ `goalContributors` returns linked habits/projects/assignments with a contribution share | **Missing:** the milestone layer, and the nested GOAL→MILESTONES→PROJECTS→ASSIGNMENTS→HABITS shape. |
| **7 Velocity** | ◐ `weeklyCompletionSpeed` (tasks+subtasks/week), `goalVelocity`, `velocitySeries` | **Missing:** one defined metric covering *all* completion kinds, plus acceleration/deceleration. `weeklyCompletionSpeed` counts only tasks and subtasks — it misses habit check-ins, milestones and whole-item completions. |
| **8 Deadline pressure map** | ◐ `deadlinePressure` (adaptive.js) buckets items by day; `deadlineLanes` | **Missing:** the TODAY/TOMORROW/3D/7D/30D buckets with counts, effort, at-risk, critical and overloaded days. |
| **9 Comparison** | ◐ `weekComparison`, `weekDelta`, `projectComparison` | **Missing:** month vs month, and goal/assignment/habit-consistency comparisons under one validity gate. |
| **10 Insight drill-down** | ✗ | `smartInsights` returns flat `{id, tone, title, text, metric}` with **no evidence payload and no click target**. This is the largest true gap. |
| **11 Story mode** | ✗ | No guided narrative. The spatial system is available to host it. |
| **12 Chart quality** | ✅ | Existing kit has aria labels, `onDayTap`/`onSelect` hooks, and reduced-motion handling in `motion.css`. |
| **13 Drill-down contract** | ◐ | Individual screens show detail, but there is no consistent VISUAL → DETAIL → UNDERLYING DATA path. |

**Summary: 1 chart-layer gap (none), 2 fully missing capabilities (10, 11), 8 partial.**
Nothing needs rebuilding. Everything needs a consistent surface over the top.

---

## 3. Decisions taken from this audit

1. **One completion-event source.** Tasks, subtasks, milestones, check-ins and whole-item
   completions are counted in four different places today. `completionEvents()` becomes the
   single dated list; velocity, timeline and comparisons all filter it. No new counting logic.
2. **No new forecasts.** Trajectory and projection reuse `goalProjection`, `projectForecast`,
   `assignmentPace` verbatim. Where a projection cannot be computed the reason is passed through.
3. **Habits get no projection.** A habit measures cadence, not completion — projecting a
   percentage for it would be invention. It says so.
4. **No new chart primitives.** Every visual is composed from `chartKit` / `workCharts`.
5. **The module is lazy and stays lazy.** `advancedAnalytics.js` is imported only by
   `AnalyticsLab.jsx`, which `InsightsScreen` loads with `React.lazy`. Nothing eager touches it.

---

## 4. Metric definitions (requirement 7 — documented calculations)

**Completion event** — one of, each with a real timestamp:
- habit check-in with `done: true`
- project task with `completedAt`
- assignment subtask with `completedAt`
- goal milestone with `doneAt`
- project or assignment with `completedAt`

**Velocity** — completion events in the most recent *complete* week (Mon–Sun), per week.

**Baseline** — mean completions/week over the preceding `baselineWeeks` (default 4) complete weeks.

**Acceleration** — `thisWeek − lastWeek`, in completions per week.

**Trend** — `ACCELERATING` if acceleration ≥ +15 % of baseline, `DECELERATING` if ≤ −15 %,
otherwise `STEADY`. Requires both weeks and a non-zero baseline; otherwise `INSUFFICIENT DATA`.

**Expected work** (workload landscape) — `preferences.dailyCapacityMin`, only when the user set
it. Never inferred. When unset the landscape shows committed work and says capacity is unknown.

**Pressure** — for each horizon, the sum of `estimateMin × (1 − progress)` over open items whose
deadline falls inside it, plus counts of `AT RISK` / `CRITICAL` / `OVERDUE` from the existing
`assignmentStatus` / `projectStatus` engines.

**Contribution share** — `goalContributors` unchanged: `progress ÷ Σ progress` across linked
projects and assignments that have real progress. Habits are listed with `null`, never a
invented percentage.
