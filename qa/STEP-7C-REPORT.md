# Step 7C — Mind / Behavioral Insights

## Scope
Redesigned **only** the Mind behavioral-patterns screen at `#/insights?view=mind` (and legacy `/mind` alias). Daily mood/capacity/reflection check-in kept; analytics below rebuilt around the four core pattern questions (when best / repeating patterns / co-movement / weekday-time-mood-workload splits). Records, Achievements, Advanced/Lab, Overview, Work, Habits, Goals, Today untouched except the lazy `insights.css` header comment was updated.

## Files changed
- `src/screens/MindScreen.jsx` — full rewrite of the analytics section; check-in/capacity/reflection/notes retained and reflowed into a two-column grid on wide screens. Added `CapacityTrend` inline SVG, capacity dimension chip toggle, range switch (14/30/60D), secondary 2×2 pattern grid, pattern-insight cards, cross-link footer.
- `src/styles/insights.css` — added a Mind section (identity palette `--mind-cap-score/energy/focus/motivation`, `.mind-checkin-grid`, `.mind-dim-toggle`, `.mind-dim-chip`, `.mind-pattern-card`, `.mind-chart`/`.mind-legend`, `.mind-grid` (2-col → 1-col), `.mind-split`, `.mind-pair`, `.mind-insights`/`.mind-insight` Signal/Evidence/Meaning/Action cards, `.mind-foot` cross-links, responsive breakpoints at 1023/720/620/390 px). Initial CSS **untouched** — all Mind rules live in the existing lazy Insights CSS that was created in 7B.
- `test/insights-mind-7c.test.jsx` — 10 new tests.
- `qa/STEP-7C-REPORT.md` — this report.

## Analytics engines reused (no new engines)
- `mindSeries`, `moodCorrelations` — `lib/analytics.js`
- `weekdayPerformance`, `weekdayVsWeekend`, `timeOfDayPerformance`, `habitCorrelations` — `lib/analytics.js`
- `moodStats`, `moodHabitLink`, `activeHabits`, `eligibleOn`, `isDone`, `MOODS`, `moodOf` — `lib/stats.js`
- Reused chart primitives: `HBarList`, `CompareBars` from `components/charts/workCharts.jsx`.
- `AnalyticsLab` double-lazy boundary preserved (still `lazy(() => import('./AnalyticsLab.jsx'))` inside InsightsScreen; `advancedAnalytics.js` not referenced by MindScreen).

## Primary visualization
`CapacityTrend` — custom inline SVG (viewBox `0 0 780 260`) answering *"How does my chosen capacity track move alongside completion?"*:
- Left y-axis = completion % (0/50/100 grid).
- Right y-axis = capacity 1–5 (dotted reference grid).
- **Aggregate completion** — 2.4 px solid `--accent-2` with gradient fill.
- **Selected capacity dimension** — 1.8 px solid in its own identity color (`--mind-cap-score` = `--cat-mind`, `--mind-cap-energy` = warm amber, `--mind-cap-focus` = calm blue, `--mind-cap-motivation` = muted rose).
- **Top 1–3 active habits** — 1.3 px dashed lines in each habit's `--cat-{category}` color at 0.75 opacity; values smoothed with a 2-day rolling average so the trace reads as presence rather than a square wave; capped at 3 to avoid rainbow.
- **Today marker** — dashed vertical + arrowhead in `--accent-1`.
- **Null gaps break paths** (no interpolation, no smoothing).
- X-ticks at 5 evenly-spaced shortDates.
- Descriptive `role="img"` aria-label built from real data (range, avg completion, avg capacity, overlaid habit names).
- Segmented range control 14D / 30D / 60D.
- Pill-style dimension toggle (Mood / Energy / Focus / Motivation) with colored dot swatch.

## Secondary visuals (each answers ONE question)
1. **Weekly rhythm** (HBarList) — completion per weekday, best day highlighted with a 3px good-tone rail; weekday vs weekend delta underneath.
2. **When in the day** (HBarList) — time-of-day distribution from existing `timeOfDayPerformance()`; peak segment colored in `--accent-2`.
3. **How capacity lines up with habits** (CompareBars rows) — low vs good mood and per-dimension high/low splits using each dimension's identity color vs `--text-3` baseline.
4. **Pairs that travel together** (custom rows) — top 3 habit co-occurrence pairs with category-color swatches and delta chip.

## Pattern insight objects (Signal / Evidence / Interpretation / Action)
Deterministic cards built from existing engines (≤4). Each has:
- 3px data-tone left rail (`good`/`warn`/`neutral`).
- Signal: what pattern.
- Evidence: terse numeric proof.
- Meaning: association-only interpretation ("travel together", "higher on…days", "clusters in the…").
- Optional Action deep-link when a real deterministic next step exists (e.g. open a habit detail).

## Color model (§11 / §12 fix)
- The old 7A-flagged bug (energy/focus/motivation lines using `--good`/`--warn` semantic colors as identity) is fixed.
- Capacity dimensions now use neutral identity palette (`--mind-cap-*`) declared at the top of `insights.css`; no semantic tones on chart lines.
- Habit traces use `--cat-{category}` identity colors only.
- Reference/grid = `--grid` / `--text-3` muted.
- Aggregate = `--accent-2`.
- Today = `--accent-1`.
- Semantic `--good`/`--warn`/`--bad` appear **only** on:
  - signal/insight-card left-border tone rails,
  - numeric delta chips (corr-up/corr-down),
  - best-day highlight on the weekday HBarList.
  They are never used to distinguish neutral dimensions. Enforced by test.

## Correlation handling
- All copy uses association language ("travel together", "associated with", "higher on … days", "completion clusters in").
- No "caused", no "because".
- Existing `enough` gates preserved everywhere:
  - `weekdayPerformance.enough` before the weekday bars; otherwise "Not enough weeks yet".
  - `timeOfDayPerformance.enough` (≥8 samples) before the time-of-day bars.
  - `habitCorrelations.enough` before pairs.
  - Capacity splits only when `moodHabitLink` or `moodCorrelations.rows` exist with ≥15-pt gap.
  - Empty "No moods logged yet" state (EmptyState) when there is no mood history.
  - "Check in a few more days — patterns need some runway" for the insights panel when no engine clears thresholds.

## Lazy loading / performance
- MindScreen remains a `React.lazy` chunk in App.jsx. It imports `../styles/insights.css` (already lazy) — Mind styles now ride the existing lazy Insights CSS rather than adding anything to initial CSS.
- `AnalyticsLab` double-lazy boundary untouched (still `lazy(() => import('./AnalyticsLab.jsx'))` inside `InsightsScreen.jsx`; `advancedAnalytics.js` not touched).
- No new chart library added; primary graph is a hand-rolled SVG (same approach as 7B's PrimaryTrend) scoped to the questions it answers.
- **Initial CSS gzip: 55,987 bytes — UNCHANGED** (333-byte headroom preserved; ceiling NOT raised).
- **Lazy insights CSS gzip: 2,374 bytes** (+770 B from the 1,604 B 7B baseline; still well inside any lazy budget and zero impact on initial paint).
- Initial JS 224.8 kB gz — unchanged.

## Responsive QA
- ≥1024 px: check-in two-column, secondary grid 2-col, insights grid 2-col.
- 720–1023 px: secondary grid collapses to 1-col; insights stay 2-col.
- ≤720 px: check-in stacks to single column.
- ≤620 px: insights grid 1-col, chips shrink, pair rows stack.
- ≤390 px: no horizontal overflow, viewBox-scaled SVG responsive, chips/pillars still ≥34 px (mood buttons 64 px), footer stacks vertically.
- All buttons ≥36 px (chips), 44+ px (mood faces, level strips, range segments) — touch-target compliant.
- No MiniMonth/horizontal-scroll pattern introduced.

## Accessibility
- Single h1 "Behavioral patterns", CardHead supplies h2 for each section, insight cards use `<p>` (no false heading level).
- Primary SVG `role="img"` with computed aria-label.
- Range switch `role="group" aria-label="Trend range"` + `aria-pressed`.
- Capacity chips `role="group" aria-label="Capacity dimension to overlay"` + `aria-pressed`.
- Level strips already had `role="group"` + per-button `aria-label` (preserved).
- Color is NOT the only signal — left-border rails + labels + numeric sign (`+/−`, "higher"/"lower" wording) carry meaning.
- Native `<button>` / `<a>` for interactivity → keyboard + visible focus rings intact.

## Tests
- **New:** `test/insights-mind-7c.test.jsx` — 10 tests, all passing:
  1. Renders header/check-in/section headers.
  2. Primary SVG renders with role=img and real-data aria-label.
  3. Range toggle 14D/30D/60D with aria-pressed.
  4. Capacity chips select without semantic colors on chips themselves.
  5. Habit legend swatches use `--cat-*`, never `--good/--warn/--bad`.
  6. No causal language / "Great job!" fluff; "association" wording present.
  7. All four secondary sections render.
  8. Honest empty state with no history.
  9. Back-to-Overview nav preserves Overview (signal strip visible).
  10. Touch targets ≥34 px on all visible buttons.
- **Regression batch:** 11 files, 168 tests all passing (mind-7c + insights-overview-7b + insightsV3 + analytics + advancedAnalytics + achievements + goals-analytics-6d + iaRoutes + page-container-widths + primitives + shell).
- Pre-existing baseline failures in app/adaptiveHome/habit-week/cssIsolation unchanged.

## Gates
| Gate | Result |
|---|---|
| `npm run lint` | ✅ 0 errors, 0 warnings |
| `git diff --check` | ✅ clean |
| `npm run build` | ✅ Perf budget OK |
| Initial CSS gz | **55,987 bytes** (unchanged) |
| Lazy insights CSS gz | **2,374 bytes** |
| Mind tests | 10/10 |
| Regression | 168/168 |
| Working tree after commit | clean |

## Commit
`Step 7C: Mind — behavioral patterns (primary multi-series, identity colors, S/E/I/A cards)` → to `arena/01a08bf2-habbit-trackerrr`.
