# Step 7C — Mind / Behavioural Insights redesign

**Branch:** `arena/01a0a0dc-habbit-trackerrr` (fast-forwarded onto the 7B lineage `93e2ab6` before work began — see §0)
**Scope:** Insights → Mind only. Overview, Records, Achievements, Advanced/Lab, Work, Habits, Goals, Today untouched.
**Stop condition:** met. 7D not started.

---

## 0. Branch note (important)

This session's branch was created from `main` (`7cbdab9`, a squashed commit), which does **not** contain 5H–7B.
Those commits existed only on `origin/arena/01a08bf2-habbit-trackerrr`. Before touching anything the session
branch was fast-forwarded to that lineage (`93e2ab6` = Step 7B), so 7C continues the real 7B state instead of
re-building on a stale base. No reset, no rewrite, no merge to `main`.

---

## 1. Files changed

| File | Change |
|---|---|
| `src/screens/MindScreen.jsx` | Rewrote the **read side** of Mind. Kept the write surfaces (mood faces, 1–5 capacity rows, note, reflection) with their original markup, handlers and `SET_MOOD` dispatch — per 7A §15 those are input controls, not analytics. Added the primary `CoMove` visual, the identity signal strip, the weekday reading, the correlation card and the honest-empty states. |
| `src/styles/mind.css` | **New lazy stylesheet**, imported from `MindScreen.jsx`. Holds the Mind-only rules lifted out of `work.css`, plus the new layout. All selectors scoped to `#mind-screen`. |
| `src/styles/insights.css` | Received the pillar-shared rules that used to be eager (`.stat-trio`, `.stat-num`, `.corr-*`, `.dayclock*`, `.scatter*`), with the duplicated `work.css` + `system.css` pair merged into one definition each. |
| `src/styles/work.css` | Removed the legacy Insights/Mind block (stat, corr, mood-row, level, dim-label, mood-strip). |
| `src/styles/system.css` | Removed the duplicate `.level-btn` / `.mood-strip > span` / `.corr-row, .stat-trio > div` refinements and the Deep-Dive-only `.dayclock*` / `.scatter*` blocks. `.mood-btn` **stays eager** (HabitForm uses it). |
| `test/mind-7c.test.jsx` | New: 22 focused tests. |
| `qa/mind-7c-browser.mjs` | New: real-Chromium QA across 1440 / 1024 / 430 / 390 (95 assertions), including computed-style colour checks and a lazy-boundary probe. |
| `qa/STEP-7C-REPORT.md` | This file. |

No engine, store, schema, route or dependency was changed. No new analytics module.

---

## 2. Analytics reused (nothing re-implemented)

| Reading on screen | Engine reused | File |
|---|---|---|
| Mood / energy / focus / motivation per day, averages, null gaps | `mindSeries()` | `lib/analytics.js` |
| Signal-tile averages | same `mindSeries()` output (no second pass) | — |
| High-days vs low-days completion split | `moodCorrelations()` (≥4 days each side, ≥10-pt delta) | `lib/analytics.js` |
| Pearson r + trend strength per dimension | `moodScatter()` + `scatterTrend()` (n ≥ 8, \|r\| ≥ 0.3) | `lib/analytics.js` |
| Mood 4–5 vs 1–2 overall | `moodHabitLink()` | `lib/stats.js` |
| Weekday completion, best/worst, sample counts | `weekdayPerformance()` | `lib/analytics.js` |
| Weekday vs weekend split | `weekdayVsWeekend()` | `lib/analytics.js` |
| Habit ↔ habit co-occurrence | `habitCorrelations()` (≥4 + ≥15 pts) | `lib/analytics.js` |
| Habit ↔ workload day-type | `workloadInteraction()` (75th-percentile load split) | `lib/habitPatterns.js` |
| Mood distribution / faces / counts | `MOODS`, `moodOf()`, `moodStats()` | `lib/stats.js` |
| Habit identity colours | `habit.category` → `--cat-*` | state + tokens |

The only new computation is a presentation roll-up: window halves for the tile deltas, and mean mood per
weekday — both derived from `mindSeries()` output that is already in memory, not a second data path.
`advancedAnalytics.js` is **not** imported by Mind (verified by test and by the Chromium resource list).

---

## 3. Primary visualization

**"Do your capable days turn into doing days?"** — one inline SVG (`CoMove`, no chart library), one question:

- **Top plane (0–5):** four self-reported dimensions — Mood `--cat-mind`, Energy `--accent-2`, Focus `--accent-1`, Drive `--cat-creative`. Solid lines, weights 2.6 → 1.6 so the headline dimension leads.
- **Gaps are gaps:** `segments()` breaks the path at unlogged days instead of interpolating; a lone logged day renders as a marker, never as a line.
- **Non-colour redundancy:** each dimension also owns a **marker shape** (circle / diamond / square / triangle) that repeats in the legend key and the signal tiles, so identity survives greyscale and colour-blind viewing.
- **Reference:** dashed mood mean in the mood's own colour; `--accent-1` "Today" marker with an arrowhead that flips inside when today sits on the right edge.
- **Bottom plane (0–100):** daily completion from the same window, one bar per day, neutral `--text-3` at 0.5 opacity, dashed window-mean line. Days with scheduled habits but no completion signal get a hairline tick — absence shown, not hidden.
- **Legend:** shape key + label + average per series, plus "Completion %" and "Window mean".
- **Accessible name:** computed from the data — series in the window, per-dimension logged-day counts and averages, completion mean, and an explicit "a blank day is not a zero".
- **Interpretation footer:** the strongest co-variance among the four dimensions, from `moodScatter()` + `scatterTrend()` (`r`, shared-day count, strength, direction) — or the honest sentence explaining why no line is drawn.

Range switch (30D / 60D / 90D) sits in the screen header and re-scopes the series, the correlations, the scatter and the workload split together, so the headline, the chart and every caption always describe the same window.

---

## 4. Secondary visualizations

Each answers its own single question, and each is an existing primitive rather than a new system:

1. **Identity signal strip** — four `.ins-signal` tiles (the Overview's existing component): value, `/5`, and the window-over-window shift. Doubles as the chart's legend key, so the colour vocabulary is learned once.
2. **Weekday reading** — reused `.dist` / `.dist-row` / `.meter thin` rows: completion meter + samples, with the average mood that weekday in a violet chip. `.mind-wd__row` adds only the mood column. Plus `CompareBars` for weekday-vs-weekend, and a sentence that only claims a pattern when the day you feel best and the day you do most can actually be compared.
3. **"What moves together" card, three labelled groups** —
   *Level of the day vs execution*: `moodCorrelations()` rows with `CompareBars` (identity colour for the high side, neutral for the low side) and the dimension's `r`;
   *Habits that appear together*: `habitCorrelations()` pairs painted in each habit's category colour;
   *Heaviest vs lightest work days*: `workloadInteraction()` per habit, capped at three.
4. **"In your own words"** — reflections and notes as evidence, on `.corr-row`, with the reminder that numbers say nothing about why.

Removed from Mind: the duplicate 30-day `mood-strip` (a second reading of the same series the chart now shows every day of) and the four-tile `stat-trio` inside the trend card (its numbers are the signal strip now).

Deliberately **not** added: donut/ring analytics, MiniMonth, `MoodScatter` and `DayClock` (those belong to Deep Dive; Mind must not duplicate them), any AI/coaching copy, any new chart dependency.

---

## 5. Colour model — the 7A defect fixed

7A §9 problem 1: *"The Mind 4-series chart uses `good / accent-1 / warn` for energy/focus/motivation."* That is now impossible by construction:

- The four dimensions are **neutral identities** → `--cat-mind`, `--accent-2`, `--accent-1`, `--cat-creative`. Two violet shades + cyan + pink: controlled, within the existing vocabulary, no rainbow.
- Semantic `--good` / `--warn` / `--bad` appear in exactly two places, where a real state exists: the tile's **value colour** when the window-over-window delta clears ±0.3, and the weekday meter's **best/worst** ends (the 7A §12.4 rule for ranked bars). `.corr-up` / `.corr-down` still mark delta direction, as before.
- The completion series is a **neutral reference** (`--text-3`), never a health judgement, and never good/warn/bad.
- `qa/mind-7c-browser.mjs` reads the computed `stroke` of every series path in Chromium and fails if it equals the computed value of `--good`, `--warn` or `--bad`; `test/mind-7c.test.jsx` asserts the exact allowed set at unit speed.

---

## 6. Correlation handling / trust

- Every row is gated by its own engine's `enough`; when it is false the card prints **why** (which threshold, how many days exist) and no number is invented. Verified on a two-logged-day fixture: zero comparison rows, three honest notes, no `r`, no percentages in that card.
- Language is associational throughout: "Completion ran higher by N points on your strongest mood days", "co-occurrence, not cause", "association, not causation", "a pattern in your log, not a rule about weekdays".
- `workloadInteraction()`'s built-in string *"Completion rate is lower on high-workload days"* is **not** printed: it asserts a direction regardless of the data. Mind derives the wording from `high` vs `low` instead, and explicitly calls out the case where heavier days are *better*.
- Causal verbs outside an explicit negation fail the suite (sentence-level check in both test layers).
- Nulls stay nulls: `mindSeries` gaps, `rate == null` → "no data", missing mood chip → `—`.

---

## 7. Lazy-loading behaviour

| Boundary | Status |
|---|---|
| `MindScreen` `React.lazy` in `App.jsx` | unchanged ✓ (asserted in test) |
| `InsightsScreen` → `AnalyticsLab` double-lazy | unchanged ✓ |
| `advancedAnalytics.js` | still never eager — `0` references from `index.html`; the Chromium run asserts no advanced chunk is requested while on Mind ✓ |
| Mind CSS | new `mind.css`, lazy (imported by `MindScreen.jsx`, not `index.css`) — asserted by test |
| Pillar CSS | `insights.css` lazy; Mind imports the same file, so the shared rules are paid once per pillar visit |

Chunk sizes after the step: `MindScreen-*.js` 8.90 kB gz (was 3.72) — it now owns its chart and imports `habitPatterns`, which stays in its own lazy chunk; `MindScreen-*.css` 1,193 B gz; `insights-*.css` 1,900 B gz.

---

## 8. CSS budget

Metric: `gzipSync` over the assets `index.html` references — the same measurement `qa/build-proof.mjs` enforces.

| | Before 7C | After 7C |
|---|---|---|
| Initial CSS gz | **56,313 B** (7 B under the ceiling) | **55,830 B** |
| Headroom to the 56,320 B ceiling | 7 B | **490 B** |
| Ceiling | 56,320 B | **unchanged — not raised** |
| Lazy Insights CSS gz | 1,604 B | 1,900 B |
| Lazy Mind CSS gz | 0 | 1,193 B |
| Initial JS gz | 230,143 B | 230,170 B (+27 B) |

Initial CSS went **down 483 bytes**: the removed eager rules (including a `work.css` + `system.css` pair that styled the same classes twice, and a `.level-btn[data-on]` rule pointing at `--accent`, a token that no longer exists) outweigh the moved declarations. No new global vocabulary, no selector added to an eager layer.

---

## 9. Responsive QA (real Chromium, 1440 / 1024 / 430 / 390)

- **Not a shrunk desktop:** `CoMove` carries two geometry presets and swaps them at `max-width: 640px`. Narrow gets a 360-unit viewBox with 11px axis text, 4 x-labels, y-ticks at 1/3/5 and the "mood avg" annotation dropped; wide gets 780 units with the full tick set. Asserted in both layers (jsdom stubs `matchMedia` to prove the tight path; Chromium measures the *rendered* text ≥ 8 px at every viewport).
- Check-in card: two columns ≥1024, one column below; reflection lives inside the mood column so the card has no hole under the shorter side.
- Signal strip: 4 across → 2×2 at ≤620 → still 2×2 at 390 (one column would push the primary visual off-screen), collapsing to a single column only below 340.
- Weekday rows drop to `34px / 1fr / 74px / 52px` at ≤620; mood numbers shrink at ≤390.
- `overflow-x: auto` nowhere; `scrollWidth - clientWidth === 0` at all four widths; no element crosses the viewport edge.
- Legend wraps rather than clipping; `.ins-svg-wrap` keeps the chart inside its card at every width.

---

## 10. Accessibility QA

- Single `h1` per screen; every card an `h2`; the three correlation groups are real `h3`s (new CSS rule only resets their default margin).
- Charts: `role="img"` + data-derived `aria-label` for both the primary visual and the weekday comparison; per-point and per-bar `<title>` tooltips for pointer users.
- Colour is never load-bearing: marker shapes duplicate series identity, "no data" / `—` states are textual, deltas carry sign **and** the words "higher/lower", best/worst weekdays are labelled by name in the sentence below the bars.
- Keyboard: window switch, mood faces, capacity buttons, reflection toggle, note save — all native `<button>`/`<input>`; `aria-pressed` on every toggle, `aria-expanded` on the disclosure, `role="group"` + labels on the level rows and the window switch.
- Focus: the Chromium run asserts a visible indicator on the window control; shell `:focus-visible` ring inherited.
- Touch: `#mind-screen .ins-range button { min-height: 44px }` — the Overview's 36px affordance was genuinely too small here (found in browser QA, fixed in Mind's scope only, Overview untouched). `.level-btn` keeps `--touch`, `.mood-btn` inherits it; all measured ≥44px at 390.
- `role="status"` on the save confirmation; the empty state explains what will unlock rather than flattering the user.

---

## 11. Tests

`test/mind-7c.test.jsx` — 22 tests, all passing:

both routes · primary visual is one labelled real-data SVG · exactly one line per logged dimension and none for unlogged ones · series strokes are the identity set and never `--good/--warn/--bad` · legend keys every series with name + average + shape · tiles carry `--dim-c` identity and tone only where a delta exists · window reported on every reading · gates closed on a two-day fixture (no rows, no `r`, three honest notes) · readings present when gates open (incl. workload) · association wording present · no un-negated causal claim · window switch re-scopes chart + copy · narrow geometry path · write surfaces still persist `SET_MOOD` and unlock the note · Overview unchanged by 7C (incl. pillar deep-link into Mind) · Lab still lazy and not pulled by Mind · CSS laziness + ceiling constant guards · Record/Achievements/Today/Habits/Work/Goals still render. Plus 3 engine-level guards re-asserting `mindSeries` nulls, `moodCorrelations` and `habitCorrelations` / `workloadInteraction` gates against the same fixtures the screen uses.

`qa/mind-7c-browser.mjs` — 95 assertions × 4 viewports, 0 failures.

**Command results** — see §13 for the tail after the final build.

---

## 12. What was deliberately left alone

Insights Overview (7B) · Deep Dive · Records · Achievements · AnalyticsLab / Advanced · Work · Habits · Goals · Today · the router · the store · Supabase config · `advancedAnalytics.js` · `qa/build-proof.mjs`'s ceiling.

Historical failures in this sandbox were **not** "fixed" to look green (see §13).

---

## 13. Verification tail

| Command | Result |
|---|---|
| `npm run lint` | clean — 0 errors, 0 warnings (`src test qa --max-warnings 40`) |
| `git diff --check` | clean (no whitespace/conflict markers) |
| `npm run build` | `Perf budget OK — initial JS 224.8 kB gz, CSS 54.5 kB gz, three lazy-only.` · `Build proof: …; no private credentials.` |
| `npx vitest run test/mind-7c.test.jsx` | **22 / 22 passed** |
| `node qa/mind-7c-browser.mjs` (1440/1024/430/390) | **95 / 95 passed** |
| `npm test -- --run` | 8 failed files / 68 failed / **1111 passed** / 35 skipped (74 files) — see §13a |
| Commit / push | the 7C checkpoint commit (see `git log -1`) pushed to `arena/01a0a0dc-habbit-trackerrr` only. No deploy, no merge to `main`. |

### 13a. Full-suite baseline, measured in this same sandbox

The suite here is CPU-starved and its failures are 10 s `findBy*` timeouts, so a global count alone proves
little. Both sides were therefore measured under the same conditions, and the ambiguous files were re-measured
against the **7B commit itself** using a throw-away `git worktree` at `93e2ab6` (nothing in this working tree
was touched, reset or stashed):

| File | 7B baseline (`93e2ab6`) | after 7C |
|---|---|---|
| `test/app.test.jsx` | 7 failed | **7 failed** ✓ |
| `test/analyticsLab.test.jsx` | 17 failed | 17 failed ✓ (Lab's own lazy-import timeouts) |
| `test/habit-week.test.jsx` | 2 failed | 2 failed ✓ |
| `test/cssIsolation.test.js` | 1 failed (`.adaptive-risk`, from 6A) | 1 failed ✓ (no new leak) |
| `test/insights-overview-7b.test.jsx` | 10 passed | **10 passed** ✓ |
| `test/insightsV3 / analytics / stats / achievements / accessibility / phase7 / iaRoutes` | pass | **pass** ✓ |
| `test/mind-7c.test.jsx` | — | **22 passed** (new) |

Full run: 8 failed files / 67 failed / 1090 passed → 8 failed files / 68 failed / **1111 passed**. The +21 is
exactly the new 7C suite; no previously-green test went red. Historical failures were left as they are, per the
brief.

### 13b. One real regression caught and fixed (not papered over)

The first full run showed `app.test.jsx` at 8 failures instead of 7. Cause: `test/app.test.jsx:149` navigates to
Mind and asserts the mood card's copy `/How are you feeling today/i`, which 7C had rephrased. Rather than edit
someone else's test to match new copy, **the copy was restored** (`How are you feeling today?` is now the label
inside the `Today` card) and `app.test.jsx` re-measured back to its baseline 7. That is also why the write surface
was kept verbatim: other domains' tests depend on it.
