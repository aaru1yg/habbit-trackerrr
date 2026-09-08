# Phase F Audit — the execution flow

Audited at `0dbf515` before any Phase F code. Phase F covers requirement areas **19, 22, 23,
24, 26, 27, 28** — the gap between "I know what to do" and "it is done".

Headline: **the execution engine is mostly built and mostly hidden.** One piece
(`contextualLens`) is fully written and surfaced nowhere at all.

---

## 1. What already exists

### 1.1 Execution Mode (#23) — exists and is genuinely good

`src/components/today/FocusMode.jsx` already is the Execution Mode the brief describes:
one thing, a real timer, the *reason* rendered from `focusRecommendation`, a START button,
and a session written down with its **real** duration when it ends. It also shows the
historical average next to the estimate without substituting for it (`estimateAdvice`).

**Two real defects found:**

| Defect | Where | Why it matters |
|---|---|---|
| `complete()` only handles `habit` and `assignment` | `FocusMode.jsx:74-75` | `getNextBestAction` can return a **project**; pressing Complete then does nothing but still records a completed session. That is a silent lie. |
| `new Date().toISOString().slice(0,10)` for the check-in date | `FocusMode.jsx:74`, also `QuickCapture.jsx:107` | UTC. Either side of local midnight this writes the wrong day. The same class of bug Phase E found in `itemActions`. |

### 1.2 Contextual recommendations (#26) — written, never used

`contextualLens(state, {now})` in `src/lib/personalization.js:799` is complete: it returns
`{id, part, hour, inFocusHours, committedMin, capacityMin, loaded, prefers, reason, enough}`
with ids `critical | deep | wind-down | steady` and a human `reason` for each.

**`grep -rn contextualLens src/` returns exactly one hit — its own definition.** It has never
been wired to anything. Phase F's job is to surface it, not to rewrite it.

### 1.3 Universal actions (#22) — model exists from Phase E, surfaced nowhere

`itemActions(kind, entity, {now, today})` in `src/lib/commandActions.js` is complete and
tested: it returns only the valid actions per entity, flags destructive ones and carries undo
descriptors. Nothing in the UI calls it yet — Today, search results and command results all
navigate instead of acting.

### 1.4 Weekly review — descriptive, not adaptive

`weeklyReview(state)` (`stats.js:237`) is used by TodayScreen, InsightsScreen and the local
coach. It reports *what happened*: delta vs last week, strongest/weakest habit, weakest
weekday, one suggestion sentence.

**#28 asks for something different:** planned vs **actual** → suggestions the user accepts.
`weeklyReview` never looks at `focusLog`, so it cannot compare planned against actual at all.
The data exists — `focusLog` carries `plannedMin` and `actualMin` per session — but nothing
reads the pair.

### 1.5 One-tap completion (#19) — partial

`TOGGLE_CHECKIN` / `SET_ASSIGNMENT_PROGRESS` are already reachable from HabitRow,
RoutineStrip, AdaptiveCommandCenter, CalendarScreen, LibraryScreen and TodayScreen. What is
missing is a consistent action set on the *other* surfaces (search results, command results).

---

## 2. Gap analysis

| # | Requirement | Status | Plan |
|---|---|---|---|
| 19 | One-tap actions | partial | universal action sheet on the surfaces that only navigate |
| 22 | Universal item actions | model only | surface `itemActions()` |
| 23 | Execution Mode | **exists** | fix the two defects; do not rebuild |
| 24 | Capture → completion | **missing** | after capture, offer to start it now |
| 26 | Contextual recommendations | **built, unused** | wire `contextualLens` into the execution surface |
| 27 | Proactive, not spammy | — | one line, dismissible, never a modal |
| 28 | Weekly adaptation | **missing** | planned vs actual from `focusLog`, accepted by the user |

---

## 3. Decisions

1. **Do not rebuild FocusMode.** Fix the two defects and feed it better inputs.
2. **`contextualLens` is the recommendation engine.** Phase F adds no second one.
3. **Weekly adaptation compares `plannedMin` to `actualMin`** from the real focus log. Where
   there are too few sessions it says so instead of extrapolating.
4. **Proactive means one line.** No modal, no badge, no guilt copy, and a Dismiss that
   remembers. Nothing is pushed more than once per session.
5. **Suggestions are suggestions.** Weekly adaptation offers Accept / Dismiss and never edits
   a stored estimate — the same rule Phase B set for `estimateAdvice`.

---

## 4. Bundle constraint

Initial JS is **232.9 of 236 kB gz — 3.1 kB headroom.**

This is the tightest it has been, and Phase F is the first phase that wants to add code to
**eager** surfaces (Today is eager, so anything it imports is eager). Two rules follow:

- `commandActions.js` is currently lazy-only. Importing `itemActions` from an eager screen
  pulls the whole module into the initial chunk, so the universal action sheet must itself be
  `React.lazy`.
- The new execution module must be small and reuse existing primitives. Measure after every
  step, not at the end.

---

## 5. Out of scope for Phase F

- **#25 automatic learning from actual vs planned** — that is Phase G (the learning loop).
  Phase F *reads* planned vs actual to make a suggestion; it never writes an estimate.
- Visual QA at 390×844 / 430×932 / 1440×900 — needs a real browser (Phase H).
- Deployment.

---

## 6. Delivery record

Shipped in three commits on `arena/01a07d32-habbit-trackerrr`:

| Commit | What |
| --- | --- |
| `a63879a` | `feat: add the execution engine` — `completion.js`, `execution.js` |
| `c83fea1` | `feat: surface the execution flow on Today` — Focus Mode fix, `ItemActionsSheet`, `ExecutionPanels`, Today wiring, CSS |
| `791daab` | `test: cover the execution engine and its surfaces` — 51 tests |

### 6.1 Requirement status

| # | Requirement | Status |
| --- | --- | --- |
| 19 | One-tap actions | **Done** — every priority row on Today carries an action trigger; completion goes through one mapping. |
| 22 | Universal item actions | **Done** — `itemActions()` was complete and unused in Phase E; `ItemActionsSheet` now renders it. |
| 23 | Execution Mode | **Fixed, not rebuilt** — Focus Mode already was this. The project no-op is gone. |
| 24 | Capture → completion | **Partial** — capture can hand off to Focus Mode (Phase E intent); the reverse link is not built. |
| 26 | Contextual recommendations | **Done** — `contextualLens` had zero call sites; `executionContext` composes it with `getNextBestAction`. |
| 27 | Proactive, not spammy | **Done** — one nudge, dismissible, keyed, stored in `sessionStorage` rather than user data. |
| 28 | Weekly adaptation | **Done** — planned vs actual from the real focus log; never writes an estimate. |
| 25 | Automatic learning | **Deferred** — Phase G, as scoped. |

### 6.2 Two defects found and fixed

**Focus Mode lied about projects.** `complete()` switched on `habit` and `assignment` only.
A project fell through, recorded a finished session, and changed nothing. It now uses one
mapping, and the Complete button is replaced with an explanation for a kind that has no
honest one-tap completion.

**`ExecutionPanels` read an empty state.** `useStore()` returns `{ state, dispatch }`, not
the state. The component passed the wrapper to every engine, so all three panels silently
rendered nothing. The engine tests passed while the UI showed nothing — only the UI test
caught it. That is the argument for testing the surface and not just the engine.

### 6.3 Bundle

The audit predicted the risk in §4 and it arrived exactly as described. Wiring
`contextualLens` — dead code until Phase F — into an eager screen pulled its dependency
subgraph into the initial chunk:

| | initial JS (gz) | vs 236 kB cap |
| --- | --- | --- |
| Phase E (`0dbf515`) | 232.9 kB | 3.1 kB headroom |
| Phase F, first wiring | 235.5 kB | **0.5 kB headroom — rejected** |
| Phase F, after the split | **233.7 kB** | **2.3 kB headroom** |

The fix was a split along the eager/lazy line, not a compression pass:

- `completion.js` — the kind → action mapping. Depends only on `dates.js`, so it is cheap
  enough for eager Focus Mode.
- `execution.js` — contextual, weekly and nudge logic. Reached only through
  `ExecutionPanels`, which TodayScreen loads with `React.lazy`.

New lazy chunks: `ExecutionPanels` 6.03 kB / **2.46 kB gz**, `ItemActionsSheet` 1.89 kB /
**1.01 kB gz**. `CommandCenter` shrank 13.00 → **11.89 kB gz** because the action registry
moved to a shared chunk. Verified by grepping literals that survive minification — each
appears only in its own chunk.

CSS 37.9 → 38.2 kB gz against a 42 kB cap.

### 6.4 Gates at `791daab`

- `npm test` — **713 passed / 37 files** (was 662 / 36). No existing test changed.
- `npm run lint` — clean.
- `npm run test:schema` — 28 passed, 0 failed.
- `npm run build` — `Perf budget OK — initial JS 233.7 kB gz, CSS 38.2 kB gz, three lazy-only`.
- `git diff --check` — clean.
- Preview on :4173 — `/`, `release.json`, and all five JS chunks plus CSS return 200.

### 6.5 Not done

- #24's reverse link (completion → capture) and #25 automatic learning — Phase G.
- Visual QA at 390×844 / 430×932 / 1440×900 — Phase H, needs a real browser.
- Nothing deployed.
