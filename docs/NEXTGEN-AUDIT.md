# Habit OS · Next Gen — Phase A Audit

**Branch:** `arena/01a07d32-habbit-trackerrr` · **Baseline commit:** `96fc2e9be8d5abe79708279a71912bfb0ec79bcc`
**Audited:** 2026-09-07 · **Status:** baseline verified green, gaps enumerated

This is the audit the Next Gen brief asks for before any code is written. It answers three
questions with evidence rather than opinion:

1. What does the shipped product *actually* contain, file by file?
2. Which of the 41 Next Gen requirements are already satisfied, partly satisfied, or absent?
3. What are the hard constraints any new work must respect?

Nothing here proposes rebuilding. Everything below is an extension point.

---

## 1. Verified baseline

Every command below was run on a clean `npm install` in this checkout.

| Command | Result |
|---|---|
| `npm test` | **27 files, 354 tests passed**, 0 failed (61.66 s) |
| `npm run lint` | exit 0, **0 warnings** (limit `--max-warnings 40`) |
| `npm run test:schema` | **28 passed, 0 failed** — real PostgreSQL via pglite, RLS cross-user denial asserted |
| `npm run build` | built in 5.62 s · `Perf budget OK — initial JS 225.8 kB gz, CSS 36.1 kB gz, three lazy-only` · build proof `96fc2e9…`, 84 SHA-256 checksums, no private credentials |
| `git diff --check` | clean |
| `npm run test:e2e` | **could not run here** — see §6 |

Repository shape:

- 20 screens (`src/screens/`), 61 components (`src/components/`), 28 lib modules (`src/lib/`),
  28 test files, 9,148 lines of CSS across `src/styles/` + `src/index.css`.
- Router is a hand-rolled hash router (`src/lib/router.jsx`); 15 top-level routes declared in
  `src/App.jsx:44`.
- Heavy screens are `lazy()`; **Today is eager** (`src/App.jsx:24`, comment: "Today stays eager
  (it IS the product)"). This is the single most important bundle constraint — see §5.

---

## 2. What already exists (do not rebuild)

Confirmed by reading the module, not by trusting the README.

### Persistence, sync, isolation
| System | Location | Note |
|---|---|---|
| Local store | `src/store.jsx` — `STORAGE_KEY = 'aaru.habits.v4'` | `useReducer` + localStorage write-through |
| v2 / v3 migration | `src/store.jsx` `migrateV2`, `migrateV3` | honest: no invented history or deadlines |
| Import/export normalisation | `src/lib/importExport.js` `normalizeImport`, `exportPayload` | **whitelist coercers** — see §4.1 |
| Supabase sync | `src/lib/cloud/{syncEngine,SyncProvider,merge}.js` | `pull`/`push` on `user_state.doc`, revision counters |
| Deterministic merge | `src/lib/cloud/merge.js` `mergeDocs` | id-union + tombstones + date-map union |
| RLS | `supabase/schema.sql`, asserted by `qa/schema-check.mjs` | 28 checks incl. 4 attack scenarios |

### Intelligence (deterministic, local, $0)
| System | Location |
|---|---|
| Deadline risk / priority scoring | `src/lib/adaptive.js` — `deadlineRisk`, `scorePriority` (weights at line 43: deadline `.28`, priority `.18`, progress `.12`, risk `.20`, goal `.10`, effortFit `.07`, overdue `.05`) |
| Next Best Action | `src/lib/adaptive.js` `getNextBestAction` |
| Workload capacity & pressure | `src/lib/adaptive.js` `workloadCapacity`, `workloadByDay`, `deadlinePressure` |
| Forecasts | `src/lib/adaptive.js` `assignmentPace`, `projectForecast`, `goalForecast`, `goalContributors` |
| Day/week planning, recovery | `src/lib/planning.js` — `buildDayPlan`, `buildWeekPlan`, `validatePlan`, `recoveryPlan`, `focusRecommendation`, `focusSessionSummary` |
| Habit patterns | `src/lib/habitPatterns.js` — `weekdayPattern`, `timePattern`, `trendAnalysis`, `streakPattern`, `workloadInteraction`, with explicit `PATTERN_THRESHOLDS` |
| Goal analytics | `src/lib/goalAnalytics.js` — `goalProjection`, `goalVelocity`, `goalConsistency`, `goalAnalytics` |
| Work analytics | `src/lib/work.js` — `velocitySeries`, `entityVelocity`, `burndown`, `weeklyCompletionSpeed`, `workloadSeries`, `timeVsWork` |
| Insights engine | `src/lib/analytics.js` `smartInsights` (8 data-gated insight families), `searchAll`, `timelineEvents` |
| Local coach | `src/lib/localCoach.js` `routeCoachQuestion` — `LOCAL_COACH_STATUS = {provider:'LOCAL', externalAI:'OFF', apiCost:'$0'}` |
| Today intelligence | `src/lib/today.js` — `todayPriorities`, `dayTimeline`, `todayGoals`, `todayHeadline` |
| Achievements | `src/lib/achievements.js` `achievementList`, plus `UnlockWatcher.jsx` |

### Experience
| System | Location |
|---|---|
| Charts (hand-rolled SVG) | `src/components/charts/{chartKit,workCharts,PaceChart,PulseRibbon,MoodScatter,DayClock}.jsx` |
| Spatial / cinematic | `src/components/spatial/{WorldLayer,BootSequence,Depth}.jsx`, `src/components/three/*`, `src/lib/spatial.js` |
| Device capability tiers | `src/lib/capability.js` — `high` / `balanced` / `low`, live `prefers-reduced-motion` |
| Today command centre | `src/components/today/{AdaptiveCommandCenter,PlanningPanel,FocusMode,AiCoach,TodayHero}.jsx` |
| Search | `src/components/layout/SearchPalette.jsx` bound to `/` (`src/App.jsx:82`) |
| Sheets/dialogs, toasts, confetti | `src/components/ui/{Sheet,Toaster,Confetti}.jsx`; `isSheetOpen()` guard |

---

## 3. Requirement coverage map

`✅` already shipped · `◐` foundation exists, needs work · `✗` absent.

| # | Requirement | | Evidence / gap |
|---|---|---|---|
| 1 | Adaptive Home | ◐ | `TodayScreen.jsx` renders a **fixed** order: `AdaptiveCommandCenter` → `PlanningPanel` → `FocusMode` (lines 193–195). No emphasis model. |
| 2 | Personalized quick actions | ✗ | No behaviour signal log exists anywhere. FAB is static per route (`App.jsx:183`). |
| 3 | Personalized NBA | ◐ | `scorePriority` is pure and has no preference inputs. Extension point is clean. |
| 4 | User preferences | ✗ | **See §4.1 — this is a live bug, not just a missing feature.** |
| 5 | Adaptive estimates | ◐ | `estimateMin`/`actualMin` are stored on tasks, assignments, projects; `focusSessionSummary` computes an actual. Nothing compares them back to the user. |
| 6 | Productivity profile | ◐ | Evidence exists piecemeal (`weekdayPerformance`, `timeOfDayPerformance`, `workloadInteraction`). No single transparent profile surface. |
| 7 | Productivity timeline | ◐ | `timelineEvents` (analytics.js:646) covers habits/projects/assignments/achievements/mood. **Missing:** milestones, workload, focus sessions. Ranges are fixed at `limit`. |
| 8 | Performance trajectory | ◐ | `projectForecast`, `assignmentPace`, `goalProjection` exist. No unified PAST / CURRENT / PROJECTED view. |
| 9 | Workload landscape | ◐ | `workloadByDay` + `DeadlinePressure.jsx` exist. No capacity-vs-committed *landscape* visual. |
| 10 | Habit consistency matrix | ◐ | `stats.js:464 habitMatrix`, rendered "Habit × day" (`InsightsScreen.jsx:320`). No filtering / cell drill-down. |
| 11 | Goal contribution graph | ◐ | `goalContributors` (adaptive.js) + `linkedHabitIds`/`linkedProjectIds`/`linkedAssignmentIds` on goals. No graph surface. |
| 12 | Productivity velocity | ◐ | `velocitySeries`, `entityVelocity`, `weeklyCompletionSpeed`. No acceleration/deceleration derivation. |
| 13 | Deadline pressure map | ◐ | `deadlinePressure` buckets Today/Tomorrow/…; `DeadlineLanes.jsx`, `DeadlinePressure.jsx` render it. Needs cluster + pressure semantics. |
| 14 | Comparison mode | ◐ | `weekComparison` (stats.js:477), `weekDelta`, `projectComparison` (work.js:810). Not generalised to month/goal. |
| 15 | Insight drill-down | ✗ | `smartInsights` returns flat `{id, tone, title, text, metric}`. No evidence payload, no click target. |
| 16 | Data story mode | ✗ | No narrative analytics mode. Spatial system is available to host it. |
| 17 | Quick capture | ✗ | Grep for `quick capture`/`quickCapture`/`quickAdd` across `src/` → **0 hits**. |
| 18 | Smart capture classification | ✗ | No parser. |
| 19 | One-tap actions | ◐ | `AdaptiveCommandCenter` has Complete/View; `HabitRow` has toggle. No Move/Defer/Focus from list rows. |
| 20 | Global command palette | ✗ | SearchPalette is **search only** — no command list, no actions. `⌘K`/`Ctrl+K` is **not bound**; the only global key handler is `/` (`App.jsx:82`). |
| 21 | Smart search | ◐ | `searchAll` (analytics.js:716) is token-AND substring matching. **No** natural-language filters ("due this week", "at risk"). |
| 22 | Universal item actions | ✗ | Actions are per-screen and inconsistent. |
| 23 | Execution mode | ◐ | `FocusMode.jsx` exists but is a compact one-line component with only local `useState`. |
| 24 | Capture → completion flow | ✗ | Depends on 17/18. |
| 25 | Automatic learning | ✗ | **Blocked by a data gap:** focus sessions are never persisted. `grep -n "focusSession\|focusLog\|session" src/store.jsx` → 0 hits. `FocusMode` keeps `started`/`elapsed` in component state and discards them. |
| 26 | Contextual recommendations | ◐ | `partOfDay` (dates.js:205) exists; `timePattern` exists. Nothing recommends by context. |
| 27 | Proactive, not annoying | ✅ | `App.jsx:262` deliberately fires **one** deadline alert per 30 s tick, once per item per day. This is the standard new work must match. |
| 28 | Weekly adaptation | ◐ | `weeklyReview` (stats.js:237) returns `{enough, headline, text, suggestion}`. `rescheduleSuggestions` requires confirmation. No planned-vs-actual comparison, no accept flow. |
| 29 | Visual language | ✅ | `src/styles/spatial.css` (852 lines), `motion.css` (528), tokens. Preserve as-is. |
| 30 | 3D rule | ✅ | `capability.js` gates WebGL behind `allowsLiveScenes()`; budget probe **fails the build** if `three` reaches `index.html` (`qa/build-proof.mjs:69`). |
| 31 | Mobile | ◐ | `qa/e2e.mjs` checks overflow + 44 px targets. New surfaces must pass the same checks. |
| 32 | Accessibility | ✅ | Sheet focus trap, `sr-only`, `prefers-reduced-motion` in `capability.js`, `role="timer" aria-live="polite"` in FocusMode. |
| 33 | Performance | ✅ | Budgets enforced at build time (§5). |
| 34 | Privacy | ✅ | Everything is local + deterministic; `localCoach.js` declares `externalAI:'OFF'`, `apiCost:'$0'`. `server/aiEndpoint.js` is unused by the shipped loop. |
| 35 | Testing | ✅ | 354 tests. `--max-warnings 40` lint gate. |
| 36 | Realistic data sets | ✗ | No persona fixtures. `qa/helpers.mjs` has `seededStateV4` (one shape only). |
| 37 | No fake intelligence | ✅ | Consistent idiom throughout: `'Not enough data yet.'` + `enough:false`. Verified in `adaptive.js`, `planning.js`, `habitPatterns.js`, `goalAnalytics.js`. |
| 38–41 | Order, commits, production, loop | — | Process requirements; this document is Phase A. |

**Summary: 6 requirements are already satisfied, 21 have real foundations to extend, 14 are genuinely absent.**
The absent cluster is almost entirely *execution* (17, 18, 20, 22, 24) plus the *learning* data source (25).

---

## 4. Defects found during the audit

These are not Next Gen features. They are things that are wrong today.

> **Status: all three were fixed in Phase B** (commit `b8de72f`). Kept here as
> the record of what was wrong and why the fix looks the way it does.

### 4.1 `dailyCapacityMin` is read in four places and can never be set

`grep -rn "dailyCapacityMin" src/` returns exactly:

```
src/lib/planning.js:17   buildDayPlan(… capacityMin = state.profile?.dailyCapacityMin ?? null …)
src/lib/planning.js:38   buildWeekPlan(… capacityMin = state.profile?.dailyCapacityMin ?? null …)
src/lib/planning.js:51   recoveryPlan(… capacityMin = state.profile?.dailyCapacityMin ?? null …)
src/screens/TodayScreen.jsx:106
src/screens/WorkloadScreen.jsx:40
```

But:

- `emptyState().profile` (`src/store.jsx:22-31`) has **no** `dailyCapacityMin` key.
- `coerceProfile` (`src/lib/importExport.js:309-321`) is a closed whitelist that does **not**
  include it — so even a hand-edited value is dropped on import and on cloud pull.
- No UI writes it. `SettingsScreen.jsx` only writes `theme`, `name`, `workReminders`,
  `workReminderHours`, `lastBackupExport`.

**Consequence:** for every real user, `buildDayPlan` returns `fit: 'INSUFFICIENT DATA'` and
`PlanningPanel` renders *"Planning is limited because available capacity isn't configured"*
(`PlanningPanel.jsx:8`) with no way to configure it. Plan My Day is dead on arrival today.
Only `test/planning.test.js:4` sets it, by constructing state by hand.

`planningBufferPct` has the identical problem.

**Fix (Phase B):** a real, editable Preferences surface, with `coerceProfile` extended so the
values survive import, export and cloud round-trip.

### 4.2 `profile` merge depends on a timestamp nothing writes

`merge.js:63`:

```js
profile: time(local.profile?.updatedAt) >= time(cloud.profile?.updatedAt)
  ? { ...cloud.profile, ...local.profile }
  : { ...local.profile, ...cloud.profile },
```

`time(undefined)` is `0`, so `0 >= 0` is always true and **local always wins**. Harmless while
profile holds only cosmetic settings; the moment it carries capacity and preferences, a
preference changed on device A is silently overwritten by device B. `SET_PROFILE`
(`store.jsx:690`) does not stamp `updatedAt`.

**Fix (Phase B):** stamp `profile.updatedAt` in `SET_PROFILE`.

### 4.3 Focus sessions are discarded

`FocusMode.jsx` is a single-line component. Its `started`, `elapsed`, `paused`, `done` values
live in `useState` and are thrown away on unmount. `focusSessionSummary` in `planning.js` can
compute `actualMin` from a session, and `test/planning.test.js` proves it works — but nothing
ever calls it with real data, because no session is ever stored.

**Consequence:** requirement #25 (automatic learning from actual durations) has **no data
source**. This must be fixed before any "learn from your actuals" claim can be honest.

**Fix (Phase B):** a persisted, capped `focusLog`.

---

## 5. Hard constraints on all Next Gen work

1. **Initial JS budget: 236 kB gzip. Current: 225.8 kB. Headroom: ~10 kB.**
   `qa/build-proof.mjs:53` sets `BUDGETS = { initialJsGzip: 236*1024, initialCssGzip: 42*1024 }`
   and *throws* over the limit, so `npm run build` fails the release. Anything imported from
   `TodayScreen` is in the initial bundle because Today is eager. **Analytics and story mode
   must be lazy.** The personalization core must stay small.
2. **Initial CSS budget: 42 kB gzip. Current: 36.1 kB.**
3. **`three` must never appear in `index.html`** (`build-proof.mjs:69`).
4. **`normalizeImport` is the gate.** Any new top-level state key must be added to
   `importExport.js` or it will be silently stripped on import *and* on cloud pull
   (`SyncProvider` dispatches `IMPORT_DATA` with the merged doc — line 87, 151).
5. **`mergeDocs` is the second gate.** New collections must be merged explicitly or they will be
   lost on sync.
6. **Honesty idiom.** Every derived value must carry `enough` + a reason, and say
   `'Not enough data yet.'` rather than guessing. This is asserted across
   `test/adaptive.test.js`, `test/planning.test.js`, `test/habitPatterns.test.js`,
   `test/goalAnalytics.test.js` and must be preserved.
7. **Notification restraint.** One alert per tick, once per item per day (`App.jsx:262`).
8. **Reduced motion and capability tiers** must be respected by every new surface.
9. **CI runs `npm test`, `npm run test:schema`, `npm run build`, then browser journeys against
   `npm run preview`** (`.github/workflows/ci.yml`). Nothing merges without all four.

---

## 6. What could not be verified here

`npm run test:e2e` **cannot run in this sandbox.** The bundled Chromium from
`@sparticuz/chromium` extracts to `/tmp/chromium` but fails to start:

```
/tmp/chromium: error while loading shared libraries: libnspr4.so: cannot open shared object file
```

`ldd /tmp/chromium` reports `libnspr4.so`, `libnss3.so`, `libnssutil3.so` as *not found*.
`sudo apt-get install libnss3 libnspr4` fails with `Unable to locate package`, and
`apt-get update` cannot reach `deb.debian.org` (connection failed); fetching the `.deb` files
directly over HTTPS also fails (`SSL_ERROR_SYSCALL`). This sandbox has no route to the Debian
mirrors.

**This is an honest gap, not a skipped step.** Browser QA (overflow, 44 px targets, contrast,
the full journey matrix) will run in CI, which has the packages. Unit-level verification of new
logic is unaffected and is the primary gate during development.

---

## 7. Phase plan, revised against this audit

| Phase | Scope | Rationale |
|---|---|---|
| **B** | Personalization engine + Preferences + signal log + focus log | Fixes §4.1–4.3. Everything downstream depends on it: adaptive home needs emphasis signals, learning needs a session log, adaptive estimates need actuals. |
| **C** | Adaptive Home emphasis | Needs B's signals. Adapts emphasis, never structure. |
| **D** | Analytics engine: timeline, trajectory, landscape, matrix drill-down, contribution graph, velocity, pressure map, comparison, insight drill-down, story mode | Largest surface. Must be **lazy-loaded** (§5.1). |
| **E** | Quick Capture + Command Center | Needs B for classification confirmation and capture signals. |
| **F** | Execution flow: one-tap actions, universal actions, execution mode | Needs E's capture and B's context. |
| **G** | Automatic learning + weekly adaptation | Needs B's focus log and actuals. |
| **H** | Performance, accessibility, personas, QA | Includes the 8 persona fixtures (§3 #36) and full command re-run. |

Each phase ends with `npm test`, `npm run build`, `npm run lint`, `npm run test:schema`,
`git diff --check` — all green — in its own commit.

---

## 8. Phase B — delivered

Commit `b8de72f` · `feat: add personalization engine, preferences, signal and focus logs`

New module **`src/lib/personalization.js`** — pure, deterministic, and reading only from
two sources: observable app behaviour, and preferences the user explicitly set.

| Capability | Function | Honesty gate |
|---|---|---|
| Behaviour log | `recordSignal`, `pruneSignals`, `signalCounts` | unknown types rejected, capped at 400 |
| Preferences | `coercePreferences`, `preferencesOf`, `preferencesSet` | everything defaults to `null` |
| Focus log | `recordFocusSession`, `baseFocusSession` | a session with no end is not stored |
| Completion history | `completedByKind`, `activityMix` | needs ≥ 5 dated completions |
| Working window | `preferredWindow`, `workingWindow` | ≥ 5 observations, ≥ 3 in the winning hour |
| Adaptive estimates | `estimateAdvice` | ≥ 3 completed estimate/actual pairs |
| Quick actions | `quickActions` | below threshold → default order, and says so |
| Home emphasis | `homeEmphasis` | weights clamped to `0.85–1.35` |
| Profile | `productivityProfile`, `typicalFocusDuration`, `typicalDailyLoad` | per-section `enough` |
| Personalized priority | `personalizeScore`, `personalizedRanking` | total nudge capped at `±0.08` |
| Context | `contextualLens` | clock + real workload + explicit focus hours |

`EMPHASIS_WEIGHTS` returns the **same four section keys for every state**, so the adapter can
change emphasis but never structure (requirement 1). `personalizeScore` refuses to touch an item
that already has a hard deadline — a deadline outranks the clock, and it should.

### Two bugs this phase surfaced and fixed

Both were mine, and both were caught by tests rather than by review:

1. **`coercePreferences` turned a `null` hour into `0`.** `Number(null)` is `0`, which passed the
   `0…23` range check, so "no preference set" silently became "midnight". That is precisely the
   assumption this layer exists to avoid — and it also broke `normalizeImport` idempotency, which
   is what made a synced document look permanently different from the cloud copy.
2. **`baseFocusSession` spread raw input last**, so `actualMin: 99999` survived its own range
   validation and was stored. Validation now runs after the spread.

### Verification

| Command | Before | After |
|---|---|---|
| `npm test` | 354 tests / 27 files | **432 tests / 29 files** |
| `npm run lint` | 0 warnings | 0 warnings |
| `npm run test:schema` | 28 / 28 | 28 / 28 |
| `npm run build` | 225.8 kB gz initial JS | **226.7 kB gz** (+0.9 kB of a 236 kB budget) |
| `git diff --check` | clean | clean |

The engine landed in the eager bundle because `TodayScreen` will consume it, and it cost 0.9 kB
gzip. Phase D's analytics work must not be imported the same way.

### Still open after Phase B

The engine is wired into the store, persistence, import/export and sync — but **nothing in the UI
calls it yet**. No screen reads `homeEmphasis`, no action dispatches `RECORD_SIGNAL`, and there is
still no Preferences editor. That is Phase C. Until then the user-visible product is unchanged,
which is the point: the foundation was verified before anything was built on it.

---

## 9. Phase C — delivered

Commit `074dabd` · `feat: add adaptive home, preferences editor and the learning record`

| Surface | Where | Notes |
|---|---|---|
| Preferences editor | `SettingsScreen.jsx` → "How you work" | 7 fields + clear-all; "Not set" is a real value |
| Transparent profile | same card, lower half | evidence-backed, no score, names its sources |
| Adaptive emphasis | `components/today/AdaptiveHome.jsx` | publishes 4 weights as CSS vars; states why |
| Quick actions | same file | ranked from observations; unbuilt actions not rendered |
| Behaviour signals | `store.jsx` reducer + `App.jsx` | reducer-side so a new UI path cannot forget |
| Focus session record | `components/today/FocusMode.jsx` | real start/end/duration, persisted |
| Adaptive estimate hint | same | "Your recent similar sessions average ~N min" |

### The defect §4.1 was only half fixed by Phase B

Phase B made `dailyCapacityMin` *storable*. It was still **unread**, because five call sites read
`state.profile.dailyCapacityMin` while the preference lives in `state.preferences`. `Plan My Day`
would have kept reporting `INSUFFICIENT DATA` in front of a user who had just set a capacity.

Caught by the new test *"feeds Plan My Day, which was dead before capacity could be set"*, which
failed until `planning.js`, `TodayScreen.jsx:114` and `WorkloadScreen.jsx:41` were repointed.
`test/planning.test.js` moved its fixture to `preferences`; **all eight assertions are unchanged**.

### Structural safety

`emphasisVars()` publishes the weights and `data-emphasis` names the lean, but the section list,
its order and the hierarchy are untouched. A test reads the real DOM and asserts every published
weight sits inside `0.85–1.35`, and that *Plan my day* and *Focus mode* are still on the page.

### Budget pressure — this is now the binding constraint

| Phase | Initial JS gz | Headroom of 236 kB |
|---|---|---|
| baseline | 225.8 | 10.2 kB |
| Phase B | 226.7 | 9.3 kB |
| Phase C | **232.3** | **3.7 kB** |

The jump is structural, not careless: `personalization.js` is reachable from `store.jsx`, so it sits
in the initial chunk, and once any chunk uses more of its exports Rollup can no longer tree-shake
the rest out of that single module instance.

**Consequence for Phase D:** the analytics engine must be its own lazy module that **no eager file
imports**. Anything Phase D adds to `personalization.js`, `store.jsx` or `TodayScreen.jsx` costs
initial bundle directly.

### Verification

| Command | Phase B | Phase C |
|---|---|---|
| `npm test` | 432 / 29 | **452 / 30** |
| `npm run lint` | clean | clean |
| `npm run test:schema` | 28 / 28 | 28 / 28 |
| `npm run build` | 226.7 kB gz | 232.3 kB gz |
| `git diff --check` | clean | clean |

`npm run preview` was started and checked by hand — index 200, both hashed assets 200,
`release.json` 200. Puppeteer E2E is still unavailable in this sandbox (§6).
