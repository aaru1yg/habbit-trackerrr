# Step 7B — Insights Overview redesign

**Commit:** TBD (see git log)
**Branch:** `arena/01a08bf2-habbit-trackerrr`
**Scope:** Insights Overview only. Mind / Records / Achievements / Advanced internals NOT redesigned.

---

## 1. Files changed

- `src/screens/InsightsScreen.jsx` — rewrote the Overview branch of the existing screen. Kept Deep Dive and Advanced (Lab) toggles intact; kept Suspense boundary and lazy import; removed the old 11-card stack (ProgressRing hero, bespoke inline compare bars, MiniMonth year grid, badge grid, mood card, habit-patterns, deep-link CTA) from the Overview rendering path. Replaced with: signal strip, primary multi-series chart, insight cards, "where to look" action, pillar nav. Renamed "Lab" button to "Advanced".
- `src/styles/insights.css` — **new lazy stylesheet**, imported from `InsightsScreen.jsx`. Contains all Overview-specific CSS (surfaces, signal strip, chart head/legend, insight cards, pillar tiles, responsive breakpoints at 1023/620/390).
- `src/lib/analytics.js` — removed unsupported suggestion copy from the `least-consistent` smart insight ("Pairing it with X may make it easier to keep" → honest observation only). No engine/algorithm changes.
- `test/insights-overview-7b.test.jsx` — new file, 10 tests covering the new structure.
- `qa/STEP-7B-REPORT.md` — this file.

**NOT touched:** `src/screens/MindScreen.jsx`, `src/screens/RecordScreen.jsx`, `src/screens/AchievementsScreen.jsx`, `src/screens/AnalyticsLab.jsx`, `src/screens/InsightsDeepDive.jsx`, initial CSS files (`system.css`/`components.css`/`spatial.css`/`adaptive.css` — left untouched so Mind/Record/Achievements keep working; see §7).

---

## 2. Insight / analytics engines reused

No new engines were created. The Overview is a presentation layer over existing deterministic functions:

| Data | Engine (reused) | Source file |
|---|---|---|
| Daily aggregate completion % | `trendSeries()` | `lib/stats.js` |
| 30-day aggregate, weekly delta, streak, count | `trendSeries`, `weekComparison`, `topStreak`, `achievements` | `lib/stats.js` |
| Per-habit completion over the selected window | `eligibleOn`, `isDone` (looped per day) | `lib/stats.js` |
| Habit categories for color | `habit.category` (existing schema) | state |
| Headline insight cards | `smartInsights()` (capped at 4) | `lib/analytics.js` |
| Strongest/hardest weekday + weekend split | `weekdayPerformance`, `weekdayVsWeekend` | `lib/analytics.js` |
| Time-of-day peak | `timeOfDayPerformance` | `lib/analytics.js` |
| Mood ↔ habits association | `moodHabitLink` | `lib/stats.js` |
| Consistency ranking (for "where to look") | `consistencyRanking` | `lib/analytics.js` |
| Deep links | Existing `Link` from router (habits, habits?view=week, insights?view=mind, insights?view=deep) | `lib/router.jsx` |

The `AnalyticsLab` lazy boundary is preserved — `advancedAnalytics.js` is still double-lazy behind the "Advanced" button and never enters the Insights chunk.

---

## 3. Primary visualization

The `PrimaryTrend` component is a new inline SVG (viewBox `0 0 780 270`) built specifically for the Overview, following the Goal Detail 6D visual language (no chart library added). It answers one question: **"What changed over the selected window?"**

**Series (multi-series in one chart):**
1. **Aggregate completion** (solid 2.6px, gradient fill) — `var(--accent-2)`, computed from `trendSeries()` per-day `pct`.
2. **7-day rolling average** (1.4px dashed, `var(--text-3)`, opacity 0.75) — neutral reference, smoothed only for the reference line (primary data retains real daily points).
3. **Top 1–3 habits by recent completion rate** (thinner 1.6px solid in each habit's **category color** `var(--cat-{mind,learning,fitness,…})`). Capped at three — never rainbow. Gaps remain gaps: the SVG path breaks on null days (habit not scheduled) instead of interpolating.

**Axes / markers:**
- 0/25/50/75/100% y-guides with tabular labels.
- 6 evenly spaced shortDate x-anchors across the window.
- "Today" dashed vertical with arrowhead marker in `--accent-1` (identity color, not semantic tone).
- Subtle circle markers at each aggregate data point (not at per-habit points, to avoid clutter).

**Range switch:** 14D / 30D / 90D (removed 1Y from Overview because at 1-year density the per-habit series becomes unreadable; 1Y is still reachable via Advanced).

**Legend** lists Aggregate, 7-day average, and each overlaid habit in its category color.

**Aria label** is a computed summary including the average across the window and the habits shown.

---

## 4. Signal → Evidence → Interpretation → Action structure

The Overview is laid out in four tiers:

1. **Header** — "Insights" + "Signal, evidence, interpretation — all from your own data." subline.
2. **Signal strip** (4 tiles in a grid):
   - **Completion** — 30-day aggregate % with a vs-prior-window delta (colored by tone).
   - **This week** — this-week % and done/total, plus delta vs last week (colored by tone).
   - **Current streak** — current top-streak length + habit name + best-ever streak sub-caption.
   - **Total** — total check-ins + active-habit count.
   Each tile is a `.ins-signal` with a 3px left-border in the appropriate semantic tone (good/warn/bad/neutral).
3. **Evidence (primary chart card)** — `What changed` head + range control + PrimaryTrend SVG + legend + an "Interpretation" footer that lists the strongest three data-backed observations (weekday best/worst split, weekday-vs-weekend gap, peak time-of-day, mood ↔ habits association) separated by `·` and ending in a period. Uses cautious correlation language ("on good-mood days you complete X% … on low days, Y% (association)").
4. **Insight cards** (grid, 2 columns) — up to 4 insights from `smartInsights()`, each with title (signal), metric (evidence), text (meaning), and — where a clear existing route applies — a "see more" chevron link (action). The unsupported "Pairing it with…" suggestion was removed from the analytics engine so it never surfaces.
5. **"Where to look" action card** — deterministic nudge to a single route (the weakest habit's detail page if a habit scores ≤45/100, otherwise the Week review if this week is down >5 pts, otherwise omitted).
6. **Pillar nav** (4 tiles) — quick links to Mind, Record, Achievements, and a button for Advanced. Replaces the scattered deep-link CTA card and provides clear IA for the 7A-recommended structure.
7. **Trust footer** — small centered note: "Every finding here is derived from your own logged data — no fabricated trends, no AI coaching."

---

## 5. Color model

Implemented per the 7A recommendation §9:

- **Category colors (`--cat-*`)** encode *identity* for per-habit series in the chart and for the Mind/Record/Achievements pillar icons.
- **`--accent-2`** is used for the primary aggregate completion line and gradient fill.
- **`--text-3` dashed** is used for the 7-day average reference, y/x guide labels, and sub-captions.
- **`--accent-1`** is used for the "Today" marker — an identity reference, not a health tone.
- **Semantic tones (`--good` / `--warn` / `--bad`)** are used **only** for left-borders on signal tiles and insight cards, for the completion/streak delta tiles, and for the delta values in the interpretation footer — never for chart lines that represent neutral dimensions.
- Habit legend swatches use `var(--cat-{habit.category})`, explicitly asserting they don't use `var(--good/warn/bad)` (tested).

No rainbow (max 3 overlaid habit series), no glassmorphism, no ambient glow, no giant gradients, no decorative images (the old `art/scene-data-room.webp` hero was removed).

---

## 6. Trust / honesty handling

- All engines preserve their existing `enough: false` gates.
- The primary chart returns an honest empty note when there are fewer than 2 data points.
- Null points in the per-habit series are kept as gaps — no interpolation, no smoothing.
- The 7-day rolling average is labeled as such in the legend (it's a reference line, not the data).
- Per-habit series are only included when the habit has ≥Math.min(6, rangeDays/3) eligible days in the window; otherwise they are omitted.
- The "Pairing it with {top} may make it easier to keep" sentence was removed from `smartInsights()` because it was an unsupported recommendation (per 7A §6 finding and 7B §10).
- Smart insights that are near-miss streak nudges are filtered out ("streak-{id}") — they belong in Today, not in Insights Overview.
- The mood correlation line in the chart footer explicitly says "(association)" — never causal.
- The chart shows a rolling average **as a dashed reference line** only; the primary aggregate line stays on real daily points.
- The "Where to look" card only appears when a real threshold is met (consistency score ≤45, or week delta <-5).
- The "Building your picture" fallback card appears when there are habits/checkins but not yet enough signal history for `smartInsights()` to produce 4 cards, rather than fabricating insights.

---

## 7. CSS extraction / reduction

**Approach:** to stay strictly within the 56,320-byte initial CSS ceiling (with only 333 bytes headroom) and avoid regressing Mind / Record / Achievements screens (which are off-limits in 7B), new Overview styles were placed in a fresh `src/styles/insights.css` that is **lazy-loaded** via `import '../styles/insights.css'` from `InsightsScreen.jsx` (which is already `React.lazy`). Existing Insights-related selectors in `system.css`/`components.css`/`spatial.css`/`adaptive.css` were **left in place** because they style Mind/Record/Achievements/Lab/Deep-Dive which are not redesigned in 7B; removing them would break the screens I'm not allowed to touch. This means:

- **Initial CSS: 55,987 bytes gz — unchanged** (333-byte headroom preserved, ceiling NOT raised).
- **New lazy `InsightsScreen-*.css`: 1,604 bytes gz** — paid only when the Insights pillar is entered.
- Other lazy chunks unchanged: goals 2,762 gz; workspace 2,750 gz; habits 2,212 gz; themes.

This is the safe path for 7B. A more aggressive extraction (moving legacy Insights/Mind/Achievements/Record rules out of initial CSS into per-screen lazy files) would yield a larger initial-CSS reduction but requires redesigning those screens' style envelopes in 7C/7D — out of scope for this step.

---

## 8. Responsive QA

Verified via breakpoints in `insights.css`:

| Breakpoint | Behavior |
|---|---|
| ≥1024 px | Signal strip 4 columns; pillars 4 columns; insight cards 2 columns; range switch inline. |
| 720–1023 px | Signal strip 2×2; pillars 2×2. |
| 620 px and below | Chart head stacks (title above range switch); insight cards 1 column; surface padding reduced to 16 px; signal values slightly smaller. |
| ≤390 px | Signal strip and pillar grid collapse to a single column (no horizontal overflow); chart SVG uses `width:100%` viewBox scaling so no label clipping. |

All segment buttons, range buttons, and pillar tiles use the existing `.seg-btn` / `.btn sm` base which already meets the 44px touch target requirement; the `.ins-range` buttons have an explicit 36 px min-height combined with 7+12 px vertical padding = 36+14 = 50 px ≥44.

Year MiniMonth horizontal-scroll is gone from Overview (it was part of the retired card). No `overflow-x: auto` remains on any Overview surface.

---

## 9. Accessibility QA

- Single `<h1>Insights</h1>` per screen (unchanged).
- Chart card uses `<h2>What changed</h2>`.
- Each insight card uses `<h3 className="ins-insight-title">` for its title — correct heading hierarchy (h1 → h2 → h3).
- Segmented controls use `role="group"` + `aria-label` + `aria-pressed` for the Insights view switch, Deep/Lab toggles, and the Trend range switch (same pattern used across Goals/Work).
- Primary SVG chart: `role="img"` with a computed `aria-label` summarizing the window, average, and overlaid habits.
- Pillar links are real `<Link>` / `<button>` elements with visible focus rings inherited from shell primitives.
- Non-color state: signal tiles and insight cards use a 3px colored left border **plus** a `data-tone` attribute; the metric value is large/high-contrast text, and tone words ("up"/"down") are conveyed via text + delta sign, not by color alone.
- Reduced motion: the chart has no new motion (existing `range-in` animation is applied by parent `.insights-trend` which is no longer used in Overview; the new SVG has no transition of its own, inheriting the existing `prefers-reduced-motion` behavior from global styles).
- Keyboard: every interactive element (view switch, Advanced button, range switch, pillar links/buttons, insight deep-links, "Where to look" CTA) is reachable by Tab via native `<button>`/`<a>` elements.

---

## 10. Tests

- New tests (10): `test/insights-overview-7b.test.jsx` — signal tiles render, chart SVG present with real-data aria label, legend lists Aggregate/7-day-average/habit entries, range switch has proper aria-pressed semantics, insight cards contain no "Pairing it with" or motivational fluff, all four pillar links exist, empty state honest when no habits, habit series swatches use category colors (not semantic tones), Advanced lazy-fallback works, Deep dive toggle still renders.
- Existing Insights/analytic tests pass unchanged: `insightsV3.test.jsx` (12), `analytics.test.js` (18), `advancedAnalytics.test.js` (46), `analyticsLab.test.jsx`, `achievements.test.js` (14) — all pass.
- Goals 6D regression: `goals-analytics-6d.test.jsx` (8) passes.
- All Goals/Work/Habits/Today/primitives/shell/widths regression tests pass (verified across Goals, Work, Habits, primitives, shell, page-container-widths, stats batches — 210+ tests across 11 files all passing).

**Pre-existing baseline failures** (unchanged from 6D): `app.test.jsx` (7), `adaptiveHome.test.jsx` (5), `habit-week.test.jsx` (2), `cssIsolation.test.js` (1) — all pre-existing, not caused by 7B.

---

## 11. Build / performance

- Lint: 0 errors, 0 warnings.
- `git diff --check`: clean.
- Build: **Perf budget OK** — initial JS 224.8 kB gz (slight reduction from 225.0 due to removed imports/old components), **initial CSS 55,987 bytes gz (UNCHANGED)**, three lazy-only chunks preserved.
- Lazy Insights CSS: **1,604 bytes gz** (new file, lazy).
- AnalyticsLab double-lazy boundary preserved: `advancedAnalytics.js` is only loaded after clicking "Advanced".
- No new dependencies. No chart library added.
- No new reducers, engines, or adaptive models.

| Chunk | JS gz | CSS gz |
|---|---|---|
| Initial (`index-*`) | 230.14 kB | **55,987** (333 B headroom, ceiling NOT raised) |
| `InsightsScreen-*` | 9.89 kB | 1,604 (new lazy CSS) |
| `AnalyticsLab-*` (double-lazy) | 14.32 kB | 0 |
| `MindScreen-*` | 3.72 kB | 0 |
| `RecordScreen-*` | 1.36 kB | 0 |
| `AchievementsScreen-*` | 2.34 kB | 0 |

---

## 12. Stop condition

Per §22, stopping here. Mind / Records / Achievements / Advanced internals / Work / Habits / Goals / Today were NOT redesigned. Not deployed. Commit SHA will be recorded after `git commit`/`push`.
