# Step 7A — Insights Foundation + Audit

**Commit:** 0b178eb (HEAD after 6D)
**Branch:** `arena/01a08bf2-habbit-trackerrr`
**Date:** 2026-09-14
**Scope:** inspect and document only. No UI redesign, no new engines, no CSS added.

---

## 1. Current Insights architecture

Insights is already one of the five canonical pillars (alongside Today / Work / Habits / Goals) per `src/components/shell/nav.js` and `src/lib/router.jsx`. It is the parent of three child views reachable via `?view=` query param, plus two in-pillar surfaces that sit on the Insights route itself.

### Routing table (read from `src/App.jsx` lines 37–48 and 237)

| URL | Component | Lazy? | Notes |
|---|---|---|---|
| `#/insights` | `InsightsScreen` | ✅ `React.lazy` | Default Overview + Deep dive toggle + Lab toggle |
| `#/insights?view=mind` | `MindScreen` | ✅ `React.lazy` | Standalone screen under the Insights pillar |
| `#/insights?view=record` | `RecordScreen` | ✅ `React.lazy` | Standalone behavioural timeline |
| `#/insights?view=achievements` | `AchievementsScreen` | ✅ `React.lazy` | Standalone reward screen |
| `#/insights?view=deep` | renders `<InsightsDeepDive>` inside `InsightsScreen` | bundled with Insights chunk | not its own chunk |
| `#/insights` (view=`lab`) | renders `<AnalyticsLab>` inside `InsightsScreen` | ✅ **double-lazy** (`lazy(() => import('./AnalyticsLab.jsx'))` inside the already-lazy InsightsScreen) | so `advancedAnalytics.js` never enters the Insights chunk |

### Shell secondary nav (`src/components/shell/nav.js` lines 46–52)

Lists exactly three sub-items under Insights:
- Mind (`insights?view=mind`)
- Achievements (`insights?view=achievements`)
- Record (`insights?view=record`)

The "Deep dive" and "Lab" toggles are **not** in the nav; they live as a segmented control + "Lab" chip inside InsightsScreen itself.

### Bundle split (verified from `npm run build` output at commit 0b178eb)

| Chunk | JS gz | CSS gz |
|---|---|---|
| Initial (`index-*`) | 230.36 kB | **55,987 bytes** (333-byte headroom under 56,320 ceiling — **CEILING NOT RAISED**) |
| `InsightsScreen-*` | **9.13 kB** | **0 bytes** (no `import './styles/insights.css'`; see §12) |
| `AnalyticsLab-*` | **14.31 kB** | 0 bytes |
| `MindScreen-*` | 3.72 kB | 0 bytes |
| `AchievementsScreen-*` | 2.34 kB | 0 bytes |
| `RecordScreen-*` | 1.36 kB | 0 bytes |
| `chartKit-*` (shared with Habits/Goals) | 2.92 kB | 0 bytes |
| `workCharts-*` (shared) | 4.06 kB | 0 bytes |
| `InsightsDeepDive` | bundled into InsightsScreen | 0 bytes |

**Important:** unlike Work (`work.css` gz 2,750), Habits (5 lazy CSS chunks), and Goals (`goals.css` gz 2,762), the Insights pillar has **no dedicated lazy CSS file**. All Insights/Mind/Achievements/Record/Lab visual rules (~118 rules matched, see §12) currently live in the eager `system.css`/`components.css`/`spatial.css`/`adaptive.css` that ship on the initial shell. This is the biggest performance/style-split issue in the domain (documented in §12, not fixed in this audit).

---

## 2. Current routes/views — what each does

### 2.1 InsightsScreen — Overview (`#/insights` default)
11 stacked section cards, in this order:
1. **Habit patterns** — inline text rows from `habitPatterns()` (trend id, weekday best, workload observation).
2. **Hero** — 148 px ProgressRing (30-day %) + 4 stat tiles (best streak, current streak, active habits, total check-ins). Background decorative image `art/scene-data-room.webp`.
3. **Completion trend** — 7/30/90/365 segmented switch + `TrendChart` (aggregate completion %/day).
4. **This week vs last week** — three stat blocks + two-bar "Momentum" visual using `cmp` from `weekComparison()`.
5. **Habit performance** — sortable table (name / 30d rate / streak / best) with inline bar.
6. **Activity heatmap** — `Heatmap` GitHub-style 52-week grid.
7. **Habit × day** — `HabitMatrix` for last 28 days (read-only).
8. **Year at a glance** — 12 `MiniMonth`s.
9. **Achievements** — abridged badge strip from `achievements()`, plus "next badge" nudge.
10. **Mood and habits** — conditional `moodHabitLink()` text block.
11. **Deep dive link** — button that sets `view='deep'`.

The screen sits inside a `SpatialStage` with per-card `data-z` depth.

### 2.2 InsightsScreen — Deep dive (`?view=deep`)
Renders `<InsightsDeepDive>`, which is itself 9 stacked cards populated from `lib/analytics.js`:
- What your data says (`smartInsights()`, capped at 6) → insight cards
- Consistency → `consistencyRanking()` top 3 as `DonutStat` tiles linking to each habit
- By weekday → `weekdayPerformance()` + `HBarList` + weekday/weekend `CompareBars`
- When you check in → `timeOfDayPerformance()` + `DayClock`
- How your days land → `completionDistribution()` + `BucketColumns`
- Streak history → for the habit with the longest `habitBestStreak`, runs list via `HBarList`
- Month by month → `monthlyPulse()` + `PulseRibbon`
- Personal bests → `personalBests()` as a `kv` list
- Patterns that travel together → `habitCorrelations()` + `moodCorrelations()` + optional `MoodScatter`

### 2.3 AnalyticsLab (`?view` toggled to `lab`)
Double-lazy, double-import-gated. 7 sub-views rendered by `AnalyticsLab.jsx` (722 lines):
- Story — 5-step guided tour from `storySteps()` (What happened / What changed / Why / What is at risk / What to consider next)
- Timeline — filterable event feed from `timelineSeries()` (7D/30D/90D/6M/1Y/ALL × 8 filters)
- Trajectory — `trajectorySeries()` for goal/project/assignment/habit, rendered with `LineSeries`
- Workload — `workloadLandscape()` via `LoadBars` + drilldown sheet for individual days
- Habits — `consistencyMatrix()` rendered with `HabitMatrix` + weekday rollup
- Goals — `goalContribution()` nested list with milestones/projects/assignments/habits
- Trends — `productivityVelocity()` weekly bars + `comparisonSeries()` delta list

Every panel follows the `HEADLINE → FINDING → EVIDENCE → DETAIL` contract via the local `<Finding>` component.

### 2.4 MindScreen (`?view=mind`)
Five cards:
1. **How are you feeling today?** — 5 mood faces (sets `state.moods[date].score` via `SET_MOOD`), optional note.
2. **Today's capacity** — 1–5 button strips for energy/focus/motivation.
3. **Reflection** — "What went well?" / "What got in the way?" 400-char each; toggleable write surface + last 6 reflections.
4. **Last 30 days** — 4-metric stat trio + multi-series `LineSeries` (mood/energy/focus/motivation on 0–5 domain) + 30-day `mood-strip` + 30-day mood faces.
5. **How capacity lines up with habits** — `moodCorrelations()` + `moodHabitLink()`, with an explicit "association, not a cause" disclaimer.
6. **Recent notes** — reverse-chronological mood notes (up to 7).

### 2.5 RecordScreen (`?view=record`)
Behavioural timeline.
- FilterBar (Everything / Habits / Work / Reflections / Achievements) using `WorkKit.FilterBar`.
- `timelineEvents(state, 120)` grouped by day → `tl-day` / `tl-item` rows with an icon + title + meta + body.
- Event kinds: `habit-created`, `note`, `streak` (≥7d), `project-start`, `project-progress` (50%,100%), `project-complete`, `assignment-progress`, `assignment-complete`, `reflection`, `achievement`.
- Footer count + earliest date.

### 2.6 AchievementsScreen (`?view=achievements`)
Four sections:
1. **Hero** — 148 px ProgressRing of unlocked/total + tier-by-tier (bronze/silver/gold/diamond) dot counts.
2. **Most recently earned** — last few unlocks.
3. **Tier filter** (all/bronze/silver/gold/diamond) + grid of `AchievementCard`s.
4. **Closest to unlocking** — progress meters for next-up badges.

Achievement art falls back to a gradient `<span>` if the `art/badge-{tier}.webp` image fails to load. Celebratory `Burst` fires only when a badge unlocks while the screen is open (via the `aaru:feedback` window event).

### 2.7 Supporting components / engines (not screens)

- `UnlockWatcher` (`components/achievements/UnlockWatcher.jsx`) — listens for state changes and dispatches unlock events/toasts.
- `habitPatternsView.js` — used by HabitDetail (not Insights, but computes pattern-card copy).
- `MoodScatter`, `DayClock`, `PulseRibbon`, `PaceChart` — chart primitives under `components/charts/`.
- `chartKit.jsx` — `TrendChart`, `WeekBars`, `Heatmap`, `HabitMatrix`.
- `workCharts.jsx` — `LineSeries`, `BurndownChart`, `LoadBars`, `LoadColumns`, `HBarList`, `BucketColumns`, `TimeVsWorkBars`, `Sparkline`, `CompareBars`, `DonutStat`.

---

## 3. Data / engine map

Every engine below returns `enough: false` + `NOT_ENOUGH` when data is thin. No function manufactures a fill value. This is the strongest property of the existing architecture and must be preserved.

### Behavioral patterns
| Engine | Location | Used by | Returns |
|---|---|---|---|
| `habitPatterns()` | `lib/habitPatterns.js` | Insights Overview "Habit patterns" card; Habit Detail | per-habit `{weekday, time, trend, streak, workload}` with explicit thresholds |
| `weekdayPerformance()` | `lib/analytics.js` | Insights Deep Dive; smartInsights | per-weekday done/total/rate + best/worst |
| `weekdayVsWeekend()` | `lib/analytics.js` | Deep Dive; smartInsights | weekday vs weekend pct split |
| `consistencyScore()` / `consistencyRanking()` | `lib/analytics.js` | Deep Dive; Achievements; Goals card; smartInsights | 70% rate + 30% best-run score |
| `streakHistory()` | `lib/analytics.js` | Deep Dive; Record (≥7d runs) | start/end/length runs; interruptions; longest |
| `habitCorrelations()` | `lib/analytics.js` | Deep Dive; smartInsights | co-occurrence (≥15pt delta, ≥4 samples each side) |
| `moodCorrelations()` / `moodScatter()` / `scatterTrend()` | `lib/analytics.js` | Mind; Deep Dive | high/low splits; Pearson r |
| `trendAnalysis()` | `lib/habitPatterns.js` | Habit Detail | IMPROVING/STABLE/DECLINING, ≥10pt threshold |

### Analytics (trends, completion, long-term)
| Engine | Location | Used by |
|---|---|---|
| `trendSeries()` / `heatmapSeries()` / `habitMatrix()` / `weekComparison()` / `habitPerformance()` / `yearOverview()` / `moodHabitLink()` | `lib/stats.js` | Overview |
| `completionDistribution()` | `lib/analytics.js` | Deep Dive; smartInsights |
| `timeOfDayPerformance()` | `lib/analytics.js` | Deep Dive; smartInsights (only when entry timestamps exist) |
| `monthlyPulse()` | `lib/analytics.js` | Deep Dive; Lab Goals view |
| `personalBests()` | `lib/analytics.js` | Deep Dive (best week/month/day/longest streak/most consistent/biggest improvement) |
| `smartInsights()` | `lib/analytics.js` | Deep Dive; Today-insight cross-link — up to 8 data-gated families, capped at 6 |
| `completionEvents()` | `lib/advancedAnalytics.js` | Lab (one canonical list across habits/tasks/subtasks/projects/assignments/milestones/focus) |
| `productivityVelocity()` | `lib/advancedAnalytics.js` | Lab Trends (8-week acceleration/steady/decelerating vs baseline) |
| `comparisonSeries()` | `lib/advancedAnalytics.js` | Lab Trends (6 metric this-week vs last-week) |
| `deadlinePressureMap()` | `lib/advancedAnalytics.js` | Lab Story "What is at risk?" |
| `workloadLandscape()` | `lib/advancedAnalytics.js` | Lab Workload (per-day committed min vs capacity) |
| `consistencyMatrix()` / `matrixCellDetail()` | `lib/advancedAnalytics.js` | Lab Habits |
| `trajectorySeries()` | `lib/advancedAnalytics.js` | Lab Trajectory (unified past/expected/current/projected for goals/projects/assignments; habits explicitly return "no projection") |
| `goalContribution()` | `lib/advancedAnalytics.js` | Lab Goals (delegates to `adaptive.goalContributors` + adds milestone/project/assignment/habit rollup) |
| `explorableInsights()` / `insightDrilldown()` | `lib/advancedAnalytics.js` | Lab (observation + evidence + detail for 6 insight IDs + workload peak) |
| `storySteps()` | `lib/advancedAnalytics.js` | Lab Story mode (5 guided steps) |

### Records
| Engine | Location |
|---|---|
| `timelineEvents()` | `lib/analytics.js` (100k event cap, deduped by day+title) |
| `timelineSeries()` (extended) | `lib/advancedAnalytics.js` (adds tasks, milestones, focus, deadlines) |
| `personalBests()` | `lib/analytics.js` |
| `allCheckinDates()` / `checkinCount()` / `bestStreakEver()` | `lib/achievements.js` |

### Achievements
| Engine | Location | Notes |
|---|---|---|
| `achievements()` | `lib/stats.js` | Badge list (streak thresholds: 3/7/14/30/60/100/180/365) with earned/blurb/perHabit |
| `achievementSummary()` | `lib/achievements.js` | Aggregates by tier (bronze/silver/gold/diamond), recent, nextUp, completion % |
| `UnlockWatcher` | `components/achievements/UnlockWatcher.jsx` | Fires `aaru:feedback` CustomEvent with `kind: 'unlock'` on first render of a newly earned badge |

Achievement tiers are hard-coded to bronze/silver/gold/diamond; rarity names (common/rare/epic/legendary) are presentation-only and map 1:1.

### Personalization / adaptive suggestions
| Engine | Location | Notes |
|---|---|---|
| `personalization.js` | `lib/personalization.js` | Signal log (screen-visit / habit-add / focus-complete / plan-build / capture / estimate-accept etc.), working-window detection, estimate advice, capacity preferences, focus-session learning. All preference-based, no demographic inference. |
| `adaptive.js` | `lib/adaptive.js` | `getTodayPriorities`, `deadlineRisk`, `workloadCapacity`, `getNextBestAction`, `goalForecast`, `projectForecast`, `assignmentPace`, `rescheduleSuggestions`, `goalContributors`, `recoveryPlan`. Deterministic priority engine. |
| `learning.js` / `learningKinds.js` | `lib/learning.js` | Apply/undo estimate updates (only by explicit user button press; never silent writes). |
| `localCoach.js` | `lib/localCoach.js` | Keyword router for "what should I do / risk / overload / week / move / habit" — purely local, deterministic, no LLM. |
| `habitPatterns.workloadInteraction()` | `lib/habitPatterns.js` | High-workload vs low-workload completion split (top-quartile split). |

**Important:** nothing in the codebase currently produces generative/AI copy. All "insight" sentences are deterministic template strings keyed off real thresholds. That matches the brief's "no fake AI coaching" requirement and must stay true.

---

## 4. Existing visualizations

Inventory with the question each answers (brief §8: "one visual = one clear question"):

| Visual | File | Question it answers | Verdict |
|---|---|---|---|
| `ProgressRing` (hero 148 px) | `components/ui/ProgressRing.jsx` (reused) | What's my overall 30-day completion? | OK but duplicates what the trend chart already shows; decorative ring in hero is the single biggest "vanity metric" surface. |
| 4 stat tiles (best streak, current, habits, total check-ins) | inline in InsightsScreen | Quick pulse numbers | Fine. |
| `TrendChart` (completion trend, range switchable) | `chartKit.jsx` | How has my completion % moved over 7/30/90/365 days? | Primary trend visual — multi-series-capable, reused in Habit Detail too. Keep. |
| Week comparison bars + delta | inline CSS (`.compare-bar`, `.compare-marker`) | Did I do better or worse than last week? | Legible; overlaps with `CompareBars` primitive already in workCharts. |
| Sortable habit performance table with inline bars | inline | Which habits carry me, which need support? | Table is information-dense; inline bar duplicates `HBarList`. |
| `Heatmap` (52-week GitHub-style) | `chartKit.jsx` | Which days had completions in the last year? | Recognizable; useful density view. |
| `HabitMatrix` (28-day habit×day) | `chartKit.jsx` | Per-habit completion pattern, day by day? | Strong analytical surface; reused in Habits and in Lab. |
| 12x `MiniMonth` year grid | `components/ui/MiniMonth.jsx` | Year-overview completion density? | Functionally near-duplicate of Heatmap (both show year-level density). |
| `LineSeries` (4-dim mood line 0–5) | `workCharts.jsx` | How have mood/energy/focus/motivation moved over 30 days? | Proper multi-series — keep and potentially promote to Insights overview. |
| 30-day mood strip | inline CSS (`.mood-strip`) | Quick visual of mood history? | Fine compact strip. |
| `DonutStat` ×3 (Deep Dive "Consistency") | `workCharts.jsx` | Which are my most consistent habits? | Donut usage violates the brief's "no donut/rings" preference for analytics. |
| `HBarList` (weekday, streak runs) | `workCharts.jsx` | Relative magnitude comparison? | Good horizontal-bar primitive — keep. |
| `CompareBars` (weekday vs weekend) | `workCharts.jsx` | Two-bar comparison? | Good primitive. |
| `DayClock` | `components/charts/DayClock.jsx` | When during the day do I check in? | Nice radial visual, purpose-built. |
| `BucketColumns` (completion distribution) | `workCharts.jsx` | Do my days finish mostly-full or mostly-empty? | Clear histogram — keep. |
| `PulseRibbon` | `components/charts/PulseRibbon.jsx` | Monthly trend? | Compact ribbon, works. |
| `MoodScatter` (+ `scatterTrend` line) | `components/charts/MoodScatter.jsx` | Does completion track with mood? | Proper scatter with trend hint gated by \|r\|≥0.3. |
| Badge grid + ProgressRing hero (Achievements) | inline | How many achievements earned, locked badges' progress? | Appropriate for reward surface. |
| Record timeline (`.tl-*`) | inline CSS | What happened day-by-day? | Solid basic timeline. |
| Story mode steps | Lab inline | Guided 5-question walk-through | Strong narrative structure — candidate to promote in 7B. |
| `LoadBars` (workload per day) / `LoadColumns` | workCharts.jsx | Committed workload vs capacity per day? | Good. |
| Burndown / Sparkline | workCharts.jsx | Used by Work screens, not Insights yet | Available for reuse. |
| Trajectory multi-series (Lab) | Uses `LineSeries` with past/expected/projected | Past/current/projected for goals/projects/assignments? | Same visual language as Goal Detail 6D — strong candidate for the Overview. |

### Visualization problems (brief §7)

1. **Duplicate density views.** `Heatmap` (52-week), year-at-a-glance `MiniMonth`×12, and `mood-strip` (30-day) all encode "days with activity" at different zoom levels. The MiniMonth grid is the weakest (no intensity, no tap-detail from Insights screen).
2. **Ring overkill.** Hero ring shows aggregate 30-day % while `TrendChart` directly below it already shows the daily series that produces that number, and Week-compare adds another % number. The ring is decorative.
3. **Two donuts in Deep Dive "Consistency".** Three `DonutStat` tiles for top-3 habits is the wrong primitive for a consistency score — it encourages ring comparison and contradicts the brief's "no donut/rings for analytics" stance.
4. **Inline custom bars instead of primitives.** Week-compare uses bespoke `.compare-bar`/`.compare-marker` CSS while `CompareBars` exists; performance table uses bespoke `.perf-bar-track i` while `HBarList` exists. Consolidation opportunity.
5. **Mood chart uses 0–5 domain with hard-coded colors** (accent-2 for score, good/accent-1/warn for energy/focus/motivation) — fine for Mind, but does not document a color model (see §9).
6. **No cross-domain chart exists yet.** Nothing overlays workload on habit completion, or goal progress on work throughput. Section 17 lists which relationships the data actually supports.
7. **The year-at-a-glance MiniMonth grid uses `overflow-x: auto`**, which is the only known horizontal-scroll in Insights (responsive risk; §10).
8. **Decorative `art/scene-data-room.webp` image** in the hero adds visual weight without informing — borderline decorative. The brief warns against decorative visuals.
9. **Badge artwork.** Locked badges use `grayscale(0.9) opacity(0.6)` filter — honest, works.

---

## 5. Trust / honesty audit

This is the strongest area of the existing implementation. Most of the hard work is already done.

### What's already done well
- Every analytics function returns `enough: false` plus a plain `"Not enough data yet."` string. UI gates exist at every call site.
- Co-occurrence in `habitCorrelations` requires ≥4 samples on each side and ≥15-point delta before emitting a pair.
- Mood correlations require ≥4 high and ≥4 low days and ≥10-point delta.
- `moodScatter` requires ≥8 paired points and refuses to draw a trend line when |r| < 0.3 (`scatterTrend` minAbsR).
- Projections (goals/projects/assignments) return explicit reasons: `projected | insufficient | stalled | complete`. Habits return `not-applicable` with the sentence "A habit measures cadence, not completion."
- Mind screen prints "These travel together in your own log. That is an association, not a cause." under correlations.
- Deep Dive prints "A break is not a failure — it is a gap in the record. Missed unscheduled days never count."
- Achievements screen has no "hidden" unlocks — every badge lists real progress or "not started."
- Story mode prints "Generated {date}. Every step below is derived from your own logged data."
- `localCoach.js` explicitly returns `NOT_ENOUGH` when data is thin and never produces a recommendation not backed by an engine.
- `smartInsights` templates never use causal language for correlations; they say "often appear together" / "On days you completed X, Y happened Z% of the time."
- Estimate learning (`learning.js`) never writes to state without a user button press naming the number.

### Trust issues that should be corrected later (NOT fixed in this audit)
1. **Tone flags in `smartInsights` can be over-claiming.** The "least consistent" insight currently says "Pairing it with {top} may make it easier to keep." This is a *suggestion* derived from no pairing evidence — it's an unsupported recommendation. Should be softened to an observation in 7B/7C.
2. **`storySteps` step 5 ("What should I consider next?")** is the closest thing to a "recommendation" in the product. It uses deterministic heuristics ("A shorter first task usually restarts it", "Moving one non-critical item would flatten the peak") which are reasonable UX copy but are presented as factual findings rather than suggestions. Should be visually/typographically marked as a suggestion, not a conclusion.
3. **Achievement rarity labels ("common/rare/epic/legendary")** are presentation-only but imply a meaningful rarity distribution. The underlying bronze/silver/gold/diamond thresholds are fixed (streak days) rather than population-percentile rarity, so "legendary" overstates the claim. Consider renaming or accepting as gamification convention.
4. **`habitPatterns.workloadInteraction` splits load at the 75th percentile of observed days** rather than comparing to the user's own capacity setting. This means it reports "lower on high-workload days" even when the user has set no capacity. The observation is still accurate co-occurrence within the user's own distribution, but the wording "Completion rate is lower on high-workload days" should keep this wording and not escalate to causal language.
5. **No visible "gap" indicator on the trend chart** — null days (no scheduled habits, or outside habit lifetime) are rendered as discontinuities? To verify in 7B; if they are interpolated across that is a trust violation.
6. **AnimatedNumber + Burst celebration** is motivational polish, dishonest only if triggered by projected/non-eager milestones. Currently fires only when `e.detail?.kind === 'unlock'` from real data, so it is honest.

---

## 6. Information architecture problems

1. **Two layers of "more analytics" inside the Overview are undiscoverable.** "Deep dive" lives as a tab in the segmented switch *and* has a CTA card at the bottom of Overview. "Lab" is a separate button next to the segmented switch, not in the shell nav, not in the segmented switch, and visually looks like a secondary CTA. First-time users are unlikely to find it.
2. **"Deep dive" and "Lab" overlap in content.** Both show weekday performance, consistency, distribution, correlations, and time-of-day. Deep Dive is a card stack; Lab is a tabbed guided multi-view with drill-down sheets. Their existence as separate surfaces is not explained to the user.
3. **Achievements appears twice** — a truncated "Achievements" card on the Overview (3 badges + next-badge nudge) and a dedicated full AchievementsScreen. The Overview card is an ad for the real screen.
4. **Mood + capacity lives on Mind, but mood correlations also appear in Overview ("Mood and habits" conditional card) AND in Deep Dive ("Patterns that travel together").** The same `moodHabitLink` sentence appears in three places.
5. **"Habit patterns" card at the top of Overview** uses the older `habitPatterns()` engine (weekday best, trend id, workload observation) while Deep Dive right below uses `smartInsights()` and dedicated cards. These often say overlapping things.
6. **"Lab" / "Deep dive" terminology is engineering vocabulary, not user vocabulary.** "Deep dive" is fine; "Lab" sounds experimental.
7. **Mind is buried under Insights**, but it is also the most frequent write surface (daily mood + capacity + reflection). Users may expect it higher in the navigation hierarchy. For now it should stay under Insights per the existing IA; just note the trade-off.
8. **Records shows only the last 120 events** with no pagination. That's reasonable for a default view but long-term users will hit the cap silently.
9. **No `#/insights?view=advanced` or `?view=analytics` route exists.** Deep Dive and Lab are internal `view=` state toggles inside InsightsScreen, which means you can't deep-link to "Lab → Trajectory" view. Back/fwd navigation for those sub-views is not wired up.
10. **Secondary nav lists Mind/Achievements/Record but not Overview/Deep/Lab.** That is acceptable but the asymmetry should be resolved in 7B: either promote Lab to a nav item (likely too heavy) or consolidate Deep+Lab into one canonical surface.

### Recommended IA (for 7B onward; not implemented here)

```
Insights (pillar)
├── Overview      — Pattern-led landing (Signal → Evidence → Interpretation)
├── Mind          — daily mood/capacity/reflection (keep as dedicated screen)
├── Records       — behavioural timeline (keep)
├── Achievements  — reward screen (keep)
└── Advanced      — the existing Lab, promoted to a nav entry or renamed "Analysis"
```

"Deep dive" content (weekday, consistency, distribution, time-of-day, streaks, personal bests, correlations) should be folded into either Overview cards (where there is a clear headline insight) or Advanced. The Overview should NOT be a long card stack — see §14.

---

## 7. Responsive audit

Tested against the existing media queries and CSS. **No runtime testing at exact viewport widths was done in this audit pass**; observations are from CSS inspection.

| Breakpoint | Issue |
|---|---|
| 1440 px | Insights screen is a single-column `.stack` inside a `.screen` PageContainer (max-width set by the shell). Heatmap + Matrix sit side-by-side via `.insights-heatmap { grid-column: 1 }` / `.insights-matrix { grid-column: 2 }`, but the parent `.insights-layout > .stack` forces `grid-column: 1 / -1`, which means those two-column declarations currently have no effect (both stack full-width). Dead CSS. |
| 1024 px | Same single column. Hero grid becomes `150px repeat(2, minmax(0,1fr))` at ≥720 px, giving a 2-row ring-on-left layout. Works adequately. |
| 430 px / 390 px | `@media (max-width: 899px)` hides `.insights-scene` decorative image — good. `@media (max-width: 560px)` is only defined for `.insights-year .mini-grid` effectively (the same query that Goal Detail uses does not currently include Insights chart sizing). Specific issues: |
| | **Year at a glance** forces `overflow-x: auto` on `.mini-grid` → horizontal scroll, the only such surface. |
| | **Habit performance table** collapses to 2 columns at <620 px (streak/best hidden). That's honest. |
| | **Mood face row** (`.mood-row`) — inspected at narrow widths, no flex-wrap, 5 faces could compress. Need to confirm ≥44 px touch targets; faces are 26 px SVG inside buttons — the button itself has padding, but worth verifying ≥44 px in 7B. |
| | **Capacity 1–5 level buttons** (`.level-btn`) — same check. |
| | **Tier filter chips** on Achievements — 5 items wrap via flex-wrap (seg `.seg` is `flex-wrap: wrap`), OK. |
| | **Record filter bar** uses `WorkKit.FilterBar` which is already Work-domain tested for 44 px targets and wrapping — OK. |
| | **Lab tab chips** use `min-height: var(--touch,44px)` (set in `adaptive.css`) — good. |
| | **Lab evidence grid** collapses to `minmax(120px,1fr)` under the existing media query — good. |
| | **No dedicated Insights ≤480 px media query**, unlike Today/Work/Habits/Goals which each have mobile tuning. |

### Summary of responsive issues to fix in 7B+
- Year MiniMonth grid horizontal scroll (replace with a 4-col wrapping mini-pulse or horizontal scroll-snap with scroll-left reset).
- The dead two-column placement for heatmap/matrix should either be made real at ≥1024 px or removed.
- Verify all mood/level/seg buttons have 44 px minimum touch targets (most seg-btn already get min-height 40–44 via `.seg` base; confirm).
- Add a dedicated `@media (max-width: 480px)` block for Insights cards similar to Goals/Work.
- Trend chart and LineSeries SVG use responsive `width:100%` viewBox sizing, which works; verify the Mind 4-series LineSeries doesn't overflow at 390 px with 4 legend items.

---

## 8. Accessibility audit

### What's good
- Every screen has exactly one `<h1 className="screen-title">`.
- Segmented controls use `role="group"` + `aria-label` + `aria-pressed` correctly (Insights view switch, trend range, Mind levels, achievements tier).
- Visual-only graphics (mood faces, badge art, decorative scene image) have `aria-hidden="true"` or empty `alt=""`.
- Chart images (compare-visual, mood-strip, progress meters) have `role="img"` + descriptive `aria-label`.
- Sort buttons on the performance table have `aria-label`s.
- Unlock "Saved" status is a `role="status"` live region.
- Tier filter on Achievements uses `role="group"` + `aria-label`.
- Keyboard navigation uses native `<button>` everywhere (no div-onclick).
- Lab Story mode binds ArrowLeft/ArrowRight correctly.

### Accessibility issues (fix in 7B+, NOT here)
1. **Chart semantics are `role="img"` with single-string labels.** The TrendChart, Heatmap, HabitMatrix, LineSeries, LoadBars, HBarList, BucketColumns, DonutStat, DayClock, PulseRibbon, MoodScatter primitives do not expose data tables or tabular alternatives. For a full release this needs an accessible table fallback or at minimum a structured `aria-label` that summarizes, but it's a significant body of work across chart primitives.
2. **Card titles are `<p className="card-head">` or `<CardHead>` (styled spans/heads) but not headings.** Within the Insights stack there are no h2/h3 elements. Screen readers get a flat list. CardHeads should become `<h2>` (top-level section) and sub-heads `<h3>`.
3. **Color-only meaning.** Mood faces use color fill + mouth-curve (redundant shape) — good. The `.compare-marker`, `.vs-delta.up/down`, `corr-up/corr-down`, `.ach-tier-dot`, and rarity labels use color plus icon/shape — check: `.vs-delta` only uses `IconTrendUp/Down` which is good; `.corr-up/down` uses color only (a green/red span of "+N pts") — needs an icon or directional marker.
4. **The `aria-label` on compare-visual interpolates percentages** which is fine; however, `Weekly comparison. This week ${pct}%, last week ${pct}%.` is verbose; live regions on data updates would be nice but there are none on Insights currently.
5. **The animated decorative `art/scene-data-room.webp`** has `alt=""` (good — decorative), but it's an `<img>` with no intrinsic `loading="lazy"` check — actually it does have `loading="lazy" decoding="async"`; fine.
6. **Keyboard focus indicator** relies on global `:focus-visible` ring from tokens.css; spot-checked `.seg-btn`, `.mood-btn`, `.level-btn` which inherit this. Good.
7. **Reduced motion:** `prefers-reduced-motion: reduce` disables the `range-in` chart animation, badge sheen, and spatial depth transitions — good.
8. **No skip-link to main content on Insights specifically**, but the app shell already has global skip-link coverage (per shell tests passing).

---

## 9. Color strategy audit

Current category/identity colors (from `src/styles/tokens.css` lines 529–547):

| Category | Light | Dark |
|---|---|---|
| fitness | `#fb923c` | `#c2410c` |
| health | `#34d399` | `#047857` |
| **mind** | `#a78bfa` | `#6d28d9` |
| learning | `#38bdf8` | `#0369a1` |
| creative | `#f472b6` | `#be185d` |
| social | `#fbbf24` | `#a16207` |
| finance | `#4ade80` | `#15803d` |
| productivity | `#22d3ee` | `#0e7490` |

Semantic tones already used:
- `--good` (healthy/positive) — used for good-mood correlation, high-days delta, earned badges.
- `--warn` (amber) — hardest weekday, least consistent, low-days.
- `--bad` (red) — overdue deadlines in Record/Lab.
- `--accent-1` / `--accent-2` (identity accents) — used for focus/mood lines.
- `--text-3`, `--track`, `--border` (neutral reference) — used for inactive states, guide lines, future.

### Problems
1. **The Mind 4-series chart uses `good / accent-1 / warn` for energy/focus/motivation.** This assigns semantic "good/warn" colors to neutral dimensions, which can misread (e.g. motivation in `--warn` implies "warning" when it's just a category line).
2. **The Overview trend chart uses a single hard-coded color** (from `TrendChart`'s default, typically `--accent-2`). Adding the expected-pace reference or a workload overlay will need a color strategy.
3. **Correlation deltas are colored up=good / down=bad**, but for a *negative* habit (e.g., someone tracking cigarettes, though the app is positively-framed) a down-delta is actually good. For the current data model (all positive habits), this is acceptable.
4. **Heatmap level colors** come from tokens (0–4) which appear to be monochrome accent scales — that is fine, density is the only variable.
5. **Achievements use bronze/silver/gold/diamond with a rarity glow** on legendary/epic. This is conventional and acceptable for a reward surface.

### Recommended color model (for 7B onward)

Adopt the Goal Detail 6D model as canonical for Insights:
- **Identity / category** → `--cat-*` for habit/goal-category membership. Habit-category color encodes *which* thing; not health.
- **Actual (primary)** → habit/entity category color, solid 2.4–2.8 px stroke + subtle gradient fill.
- **Expected / reference** → muted text-3 or neutral, dashed 1.4–1.6 px, no fill.
- **Projected / forecast** → same category color at ~55% opacity, dashed, capped.
- **Health tone** (applied to left-border/insight headline color, never to chart lines):
  - `--good` → on track / reached / improving
  - `--warn` → uneven / drifting / approaching risk
  - `--bad`  → stalled / overdue / off-track
  - *no tone (neutral)* → observation / correlation / record
- **Comparison series** → `--accent-1` / `--accent-2` for secondary series that are not categories.
- **Reference lines** (today, target, average, baseline) → `--text-3` dashed, with labelled markers.
- **Achievement tiers** keep bronze/silver/gold/diamond as gamification exception.
- **No rainbow multi-series charts.** Maximum 4 simultaneous colors per chart; if more, panelize.

---

## 10. Performance / loading observations

### What's done well
- All four Insights screens (`InsightsScreen`, `MindScreen`, `RecordScreen`, `AchievementsScreen`) are `React.lazy`.
- `AnalyticsLab.jsx` is **double-lazy**: a `lazy(() => import('./AnalyticsLab.jsx'))` inside the already-lazy `InsightsScreen`, so `advancedAnalytics.js` (~989 lines, the heaviest engine in the repo) is never downloaded unless the user clicks "Lab".
- No chart library dependency (Recharts, D3, Chart.js, Victory, visx). All visuals are hand-built SVG primitives. **This must be preserved.**
- Engines gate all computation behind `useMemo` keyed on state.
- All images use `loading="lazy" decoding="async"`.

### Performance issues (fix later)
1. **Insights CSS is not lazy.** Unlike Work/Goals/Habits which each have a dedicated lazy `.css` imported from the screen file, Insights/Mind/Achievements/Record/Lab rules (~118 selectors across system.css/components.css/spatial.css/adaptive.css) live in the **initial** CSS chunk, eating 333 bytes of headroom. The 56,320 ceiling cannot be raised, so 7B must either (a) extract Insights CSS to a lazy `insights.css` imported from `InsightsScreen.jsx`, or (b) keep Insights additions scrupulously in lazy CSS and/or consolidate legacy rules to free initial CSS bytes.
2. **`InsightsDeepDive` is bundled into the main InsightsScreen chunk** (it's a direct import, not lazy). Deep Dive imports `DayClock`, `PulseRibbon`, `MoodScatter` (which are in the shared `chartKit`/`workCharts` chunks), but also pulls `habitCorrelations`/`moodCorrelations`/`streakHistory`/`completionDistribution`/`personalBests` from `analytics.js` (already imported by InsightsScreen) — acceptable for now.
3. **`analytics.js` (864 lines) is imported by InsightsScreen** (for `habitPatterns` caller dependency path via stats + analytics functions used by DeepDive) and by MindScreen. It is not code-split from the Insights chunk. Acceptable because `analytics.js` is pure functions and shared across Habits/Today.
4. **Year overview runs `yearOverview(state, YEAR)`** which walks 365 days' `dayStats` on every render; it is wrapped in `useMemo([state])`, which is correct.
5. **Habit performance sorts on every render** — `useMemo`'d.
6. **The heatmap/habitMatrix year views recompute only on state change** — good.
7. **No new heavy dependencies should be added** in 7B–7D. Any additional visual should be built as inline SVG (following the Goal Detail 6D pattern).

### Current CSS measurements
- Initial CSS: **55,987 bytes gz** (333 bytes under the 56,320 hard ceiling — **ceiling NOT raised**).
- Insights lazy CSS: **0 bytes** (no dedicated file — see issue #1).
- Other lazy CSS: `workspace.css` 2,750 gz; `goals.css` 2,762 gz; `HabitsScreen.css` 2,212 gz; daylight theme 893 gz.

---

## 11. Insights visual personality (recommended, NOT implemented here)

Distinct from the other pillars:

| Pillar | Feels like |
|---|---|
| Today | Now / decision / next action |
| Work | Execution / deadlines / capacity |
| Habits | Rhythm / repetition / calendar |
| Goals | Arc / trajectory / milestones |
| **Insights** | **Pattern · Evidence · Interpretation** |

Insights should feel:
- **Analytical** — information-dense, but not dense-for-dense's-sake. Multi-series charts with reference lines (expected, baseline, today markers).
- **Reflective** — typographically calm. Long-form insight sentences have room to breathe, not cramped into tiles.
- **Trustworthy** — every number cites its window ("over the last 30 days", "based on 42 logged days"), every projection states its confidence/reason, every correlation says "association, not cause."
- **Intelligent** — the content model (§13) moves from observation → evidence → interpretation, not a wall of KPI tiles.
- **Visually rich** — category-color actual lines, muted expected references, gradient-fills under the primary series, labelled markers, tight annotations, depth via existing `sp-depth` z-layering.

It should NOT feel like: a BI dashboard, a card wall, a donut shop, a generic analytics template, a screen full of rings, a chatbot, a motivational poster.

---

## 12. Recommended visualization system

Selective canonical set (not 20 primitives):

1. **Multi-series trajectory chart** (promote Goal Detail 6D's `AnalyticsSurface` chart to a shared primitive). Answers: "Where am I versus where I should be, and where am I heading?" Used for goal progress, work trajectory, and habit completion trend overlays. Series: actual (category color + gradient fill), expected (text-3 dashed), projected (category @ 0.55 dashed, capped), vertical markers (today / target / projected end), velocity bars behind.

2. **Multi-series line chart** (evolve `LineSeries`). Answers: "How have several related metrics moved over time?" Used for mood/energy/focus/motivation (Mind) and for velocity-over-time trends. Add today marker and optional baseline reference line.

3. **Distribution / histogram** (keep `BucketColumns`). Answers: "How do my days bucket by completion %?" Keep compact.

4. **Horizontal ranked bars** (keep `HBarList`). Answers: "Which weekday / habit / hour is strongest / weakest?" Apply good/warn tone only to best/worst, not to every bar.

5. **Heatmap (year density)** — keep the existing `Heatmap`; consider retiring the 12x `MiniMonth` year overview (duplicate).

6. **Habit × day matrix** — keep `HabitMatrix` (already strong).

7. **Consistency strip** (from Goal Detail 6D's `.cons-strip`, 14/28/90 small rectangles). Answers: "What does the recent rhythm look like at a glance?" Used as compact evidence under a consistency score, replacing the `DonutStat`.

8. **Evidence delta row** (like Goal Detail 6D's stat tiles, or the existing `lab-evidence` dl). Answers: "What is the one number I should remember?" Tight 4-tile grid with number + sub-caption.

9. **Correlation / comparison bars** (`CompareBars`). Keep. Used for weekday-vs-weekend, high-vs-low correlations.

10. **Record timeline** (`tl-*`). Keep for Record screen; consider a smaller sparkline version for insight-card drilldowns.

Retire / replace in 7B:
- Hero ProgressRing → replace with a compact multi-week trajectory or a stat-trio.
- 3× `DonutStat` in Deep Dive Consistency → replace with HBarList + consistency strip.
- Bespoke `.compare-bar` in Overview → use `CompareBars` primitive.
- Bespoke `.perf-bar-track` inline bars → use `HBarList`.
- 12-MiniMonth year grid → consolidate into the Heatmap (already year-length).

---

## 13. Recommended insight content model

Adopt the 4-part composition the Lab already uses in `Finding`, but make it the canonical insight-card language:

```
[ SIGNAL ]       ← one sentence, what changed / stands out
[ EVIDENCE ]     ← 2–4 small numeric tiles (the numbers behind the claim, always with a window)
[ VISUAL ]       ← ONE primary visual (multi-series chart, strip, or ranked bars) answering the one question
[ INTERPRETATION ] ← one careful sentence, honest about correlation vs causation
[ ACTION ]       ← (only when data supports it) one small, specific next step
```

**Rules:**
- Not every insight needs all four. If the data supports only observation+evidence, don't invent an action.
- The visual must answer a specific question — never "a chart to look nice."
- Interpretation must use cautious language: "Completion is lower on high-workload days" — not "Work is making you skip habits."
- Never write "Your goal is looking great!" or other pure-motivation copy. If things are good, say "On pace — N% done vs M% expected over the window."
- Always cite the window ("over the last 30 days", "across 42 logged days").
- Gaps must be visible (broken lines, not smoothed).

This model maps directly onto the existing `storySteps` and `Finding` components in the Lab — promoting that structure to Overview is the path of least change.

---

## 14. Cross-domain relationships the data actually supports

These can honestly be surfaced in 7B/7C/7D, **with correlation language only:**

1. **Habit completion ↔ mood/energy/focus/motivation.** Already implemented in `moodCorrelations()` and `moodHabitLink()`. Data requires ≥4 high and ≥4 low days. Supported. Phrase: "On high-energy days you completed X% of habits; on low days, Y%."
2. **Habit completion ↔ weekday.** Already implemented (`weekdayPerformance`, `weekdayVsWeekend`). Requires ≥2 weekdays with ≥6 samples total. Strong signal for most users.
3. **Habit ↔ habit co-occurrence.** Already implemented (`habitCorrelations`). ≥4 samples each side, ≥15-point delta. Useful for "keystone habit" observations (still correlation, not cause).
4. **Habit completion ↔ workload day-type.** Already implemented (`habitPatterns.workloadInteraction` and `workloadInteraction` — splits load into high/low quartiles). Phrase: "Completion was X% on your heaviest-workload days vs Y% on lighter days."
5. **Work completion velocity ↔ week-over-week.** Already implemented (`productivityVelocity`, `comparisonSeries`).
6. **Goal progress ↔ linked projects/assignments/habits.** Already implemented (`goalContribution` / `goalContributors`). Explicit shares.
7. **Focus sessions ↔ completions.** `completionEvents()` logs focus sessions as kind `focus`, so a "completions on focus days vs non-focus days" comparison could be derived. Not yet implemented; engine-ready.
8. **Deadline pressure ↔ habit drops.** NOT directly computed. `deadlinePressureMap` produces at-risk bands; `habitRate` produces per-day rates; a "7 days before a deadline" vs baseline comparison would be implementable with existing data but does not yet exist. Do not claim this relationship until the engine exists.
9. **Mood ↔ focus sessions.** Focus sessions store dates; moods store dates; correlation is calculable but not yet implemented.
10. **Goal achievement ↔ streak/milestone patterns.** Plausible (goal milestones vs habit streaks) but no engine yet.

**Relationships to avoid** until an engine proves them with proper controls:
- Causal mood claims ("Focus caused better habits").
- Causal workload claims ("Deadlines made you miss habits").
- Predictive claims beyond the existing linear projection ("You'll hit the goal on Oct 12" is fine if it comes from `goalProjection`; "You tend to quit after 14 days" is not supported).
- Personality-type claims ("You're a night owl" — the time-of-day engine says when you check in, not your chronotype).

---

## 15. What should NOT be changed

- **Do not raise the 56,320-byte initial CSS ceiling.**
- **Do not add a chart library.** Continue hand-rolled SVG primitives.
- **Do not add a new forecasting or risk engine.** Reuse `goalProjection`/`projectForecast`/`assignmentPace`/`deadlineRisk`/`goalHealth`.
- **Do not add an AI/LLM insight generator.** All insights stay deterministic template strings sourced from engines.
- **Do not remove any existing engine** (`smartInsights`, `storySteps`, `personalBests`, `habitPatterns`, etc.) — they are honest and well-tested. New surfaces should consume them.
- **Do not redesign Mind's write surfaces** (mood faces, capacity sliders, reflection textareas) — those are input controls, not analytics displays. Only the *display* side of Mind may be iterated in 7C.
- **Do not merge Record into Achievements or vice versa**; they answer different questions (what happened vs what was earned).
- **Do not remove the double-lazy boundary for AnalyticsLab**; keeping `advancedAnalytics.js` out of the Insights chunk is a hard requirement documented in `docs/NEXTGEN-AUDIT.md §9`.
- **Do not add silent writes to state** for personalization (existing `learning.js` already enforces this; keep it).
- **Do not fabricate numbers to fill cards.** Preserve every `enough: false` gate.

---

## 16. Foundation-level fixes

**None required for 7A.**

Verification baseline before starting 7B:
- Lint: 0 errors, 0 warnings.
- Tests (Insights-specific): 5 files / **108/108 passing** (analytics, advancedAnalytics, analyticsLab, insightsV3, achievements).
- All shell/routing/accessibility/primitives tests continue to pass.
- Build: perf budget OK. Initial CSS 55,987 gz; no initial-CSS deltas in this step.
- `git diff --check`: clean.
- Working tree is clean on commit `0b178eb`; no code changes were made in 7A.

The only "foundation" work deliberately deferred to 7B is extracting Insights CSS into a lazy `src/styles/insights.css` (imported from `InsightsScreen.jsx`, like `goals.css` is for Goals) to free initial-CSS headroom for upcoming Insights visuals. That is part of the Overview redesign, not a standalone fix.

---

## 17. Recommended next implementation step (Step 7B)

**7B Insights Overview** should:

1. **Create `src/styles/insights.css`** (lazy, imported from `InsightsScreen.jsx`) and move existing Insights-related selectors OUT of `system.css`/`components.css`/`spatial.css`/`adaptive.css` into it, to keep initial CSS at 55,987 gz or lower.
2. Replace the current 11-card Overview stack with a **Signal-Evidence-Interpretation** landing:
   - A primary multi-series trajectory chart (pulling from `trendSeries` across the recent window, overlaying baseline/expected where applicable).
   - 3–5 insight cards populated from `smartInsights()` (reusing the existing 8 data families), each following the content model in §13.
   - A compact behavioural pulse strip (the `completionEvents()` rolling 28-day strip) for quick rhythm context.
   - Clear entry points to Mind / Records / Achievements / Advanced (Lab).
3. **Retire the hero ProgressRing and decorative image**; replace with a useful headline figure (e.g., "42 completions in the last 14 days, 3 more than the prior window" sourced from `comparisonSeries`).
4. **Promote the Lab to the shell secondary nav** (as "Advanced" or "Analysis") and fold Deep Dive content into either Overview insight cards or Advanced sub-views.
5. Add a `?view=advanced` route to the query router so Advanced is deep-linkable.
6. Add a `@media (max-width: 480px)` block in the new `insights.css` tuning card density and chart size (mirroring Goal Detail's 220 px chart / 2-col stat grid pattern).
7. Update the color model for Mind's 4-series chart per §9 (category vs semantic separation).
8. Keep Mind / Records / Achievements screens **structurally unchanged** in 7B; they get dedicated passes in 7C and 7D.

Stop after 7B. Do not begin 7C in the same step.

---

## Appendix A: Baseline test failures (pre-existing, NOT caused by 7A)

Verified by running tests against the pre-audit commit `0b178eb` (same as after this audit — no code changes):

| File | Tests failing | Notes |
|---|---|---|
| `test/app.test.jsx` | 7 (habit edit nav, project progress math, goals §8 flow, Work sections switch, project creation from FAB, assignment deadline countdown, global search §30) | Pre-existing end-to-end flow failures, all timing/selector related. |
| `test/adaptiveHome.test.jsx` | 5 (preferences Plan My Day, 4 focus-session records) | Timeout-based (10 s) — likely timer/focus-mode regression not in Insights. |
| `test/habit-week.test.jsx` | 2 (7-day stripe, attention block Log button) | Pre-existing; Habits Week review. |
| `test/cssIsolation.test.js` | 1 (adaptive.css redefines prior-layer classes) | Pre-existing CSS ordering issue. |

**Total: 15 failures out of 1182 tests, all pre-existing on commit 0b178eb (verified identically on 6D commit 94bcd15). Not addressed in 7A per the brief's instruction not to "fix" unrelated historical failures.**

## Appendix B: Measurements

| Metric | Value |
|---|---|
| Initial JS gz | 230.36 kB |
| Initial CSS gz | **55,987 bytes** (333 bytes under ceiling) |
| Insights screen JS gz | 9.13 kB |
| AnalyticsLab JS gz | 14.31 kB |
| Insights lazy CSS gz | 0 bytes (no dedicated file) |
| MindScreen JS gz | 3.72 kB |
| RecordScreen JS gz | 1.36 kB |
| AchievementsScreen JS gz | 2.34 kB |
| Shared chartKit gz | 2.92 kB |
| Shared workCharts gz | 4.06 kB |
| Lazy Insights screens (Mind/Record/Achievements) all already lazy-loaded | ✅ |
| AnalyticsLab double-lazy (so advancedAnalytics.js stays out of Insights chunk) | ✅ |
| No chart library added | ✅ |
| No AI/LLM engine present | ✅ |
| All engines use `enough: false` gating | ✅ |
| Insights-related tests passing | 108/108 |
| Lint | 0 errors, 0 warnings |
| `git diff --check` | clean |

## Appendix C: Files changed in 7A

**Documentation only.** Created:
- `qa/STEP-7A-INSIGHTS-AUDIT.md` (this file).

No source, style, engine, route, or test files were modified.
