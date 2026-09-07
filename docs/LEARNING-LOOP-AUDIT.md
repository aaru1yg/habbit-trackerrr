# Phase G Audit — the learning loop

Scope: **#25 automatic learning from actual vs planned duration**, and the rule that governs
it — *never silently mutate a stored estimate*.

Audited at `1928b3c` (Phase F complete). Every line reference below was read, not assumed.

---

## 1. The central finding

**The learning loop is one-directional. It observes, it explains, and then it stops.**

Phase F shipped a panel that ends with the sentence:

> `src/components/today/ExecutionPanels.jsx:77` — *"Nothing changes unless you accept it."*

There is no accept control anywhere in that file. The only button in the weekly panel is
`Dismiss`. So the product makes a promise to the user in its own copy and offers no way to
keep it. That is worse than saying nothing: it teaches the user that the product's
conclusions are decoration.

This is not a new gap Phase G invented — Phase F surfaced it, and it is the honest reason
#25 was deferred rather than skipped.

---

## 2. What already exists

### 2.1 `estimateAdvice` — complete, and used as read-only text

`src/lib/personalization.js:382`. Computes, from completed work with both an estimate and an
actual:

```
{ enough, kind, samples, suggestedMin, actualMeanMin, plannedMeanMin,
  deltaMin, ratio, estimateMin, reason }
```

Floor: `PERSONALIZATION_THRESHOLDS.estimateSamples = 3` (`personalization.js:36`). Below it,
`enough: false` and `reason: 'Not enough data yet.'` — the honesty rule is already correct.

It has **exactly one call site**: `src/components/today/FocusMode.jsx:26`, which renders it
as a `<p role="note">`:

> "Your recent similar sessions average ~67 min · 4 sessions"

`suggestedMin` — the actual number the user could adopt — is computed and thrown away. The
advice is delivered as trivia.

### 2.2 `estimateSamples` — the evidence collector

`src/lib/personalization.js:353`. Private. Reads completed assignments, projects and project
tasks (estimate vs actual on the record) plus completed habit focus sessions (planned vs
actual from the focus log). Window: `completionDays = 90`.

### 2.3 `weeklyAdaptation` — Phase F, produces suggestions nothing can apply

`src/lib/execution.js:85`. Groups the focus log by kind, needs ≥3 measured sessions and ≥2
samples per bucket, and emits `{ id, kind, samples, meanPlannedMin, meanActualMin, drift,
tone, title, text }`. Correct and well-tested (27 tests). Rendered, not actionable.

### 2.4 The write path already exists

No new reducer is needed to accept an estimate:

| Kind | Action | Location |
| --- | --- | --- |
| assignment | `UPDATE_ASSIGNMENT {id, patch}` | `store.jsx:565` |
| project | `UPDATE_PROJECT {id, patch}` | `store.jsx:457` |
| project-task | `UPDATE_TASK {projectId, milestoneId, taskId, patch}` | `store.jsx:510` |

And undo already exists for each: `RESTORE_ASSIGNMENT` (`store.jsx:575`), `RESTORE_PROJECT`
(`store.jsx:466`), `RESTORE_TASK` (`store.jsx:538`). The undo-toast pattern is established in
`src/components/work/WorkUIProvider.jsx:58-70`.

### 2.5 Signals

`SIGNAL_TYPES` (`personalization.js:50`) has nine types. Nothing records that a suggestion
was accepted, so the product cannot tell "the user agreed" from "the user ignored it". Tests
only assert `toContain('focus-complete')` and that unknown keys are rejected
(`test/personalization.test.js:78-79`), so adding a type is safe.

---

## 3. The constraint that shapes the design

**A habit has no stored estimate.** `estimateSamples` handles `kind === 'habit'` by reading
`plannedMin` off focus sessions, but the habit record itself carries no `estimateMin` — the
only `estimateMin: null` defaults in the store are `baseProject` (`store.jsx:185`) and
`baseAssignment` (`store.jsx:214`); a task gets one at creation (`store.jsx:504`).

So a habit suggestion **cannot** be applied to a stored field. Any accept path must return
`null` for a habit and say why, rather than writing a field nothing reads. Inventing a
`habit.estimateMin` would be exactly the silent mutation #25 forbids.

Applyable kinds: **assignment, project, project-task**. Nothing else.

---

## 4. Decisions

1. **Close the loop; do not add a new observation.** The evidence collection is already
   correct and well-tested. Phase G adds the *accept* path, not another measurement.
2. **Accept is an explicit action with undo.** One button, named with the number it will
   write ("Plan 45m instead"), dispatching an existing reducer action, followed by the
   established undo toast. Nothing is written on render, on mount, or on a timer.
3. **Never a bulk apply.** A suggestion covers one kind across several sessions. Applying it
   must name the single record it changes. A "fix all my estimates" action is out of scope —
   it would be a silent mass mutation wearing a button.
4. **Habits are explained, not applied.** The UI states that a habit has no stored estimate,
   so the suggestion is information only.
5. **Acceptance is recorded as a signal** (`estimate-accept`), so the product can eventually
   tell which of its suggestions the user acts on. That is observable product behaviour, not
   an inferred attribute.
6. **The estimate stays the user's.** Accepting writes the number the user pressed. The
   historical average is shown alongside and never substituted silently — the rule from
   Phase B holds here.

---

## 5. Bundle constraint

`Perf budget OK — initial JS 233.7 kB gz` against a 236 kB cap: **2.3 kB headroom.**

- `ExecutionPanels` is already `React.lazy`, so wiring the accept path into the weekly panel
  costs the initial chunk nothing.
- `FocusMode` is **eager**. Importing a new module there lands in the initial chunk. The
  eager surface must stay small, and the cost must be measured, not assumed — Phase F went
  232.9 → 235.5 kB by making one previously-dead export reachable.
- `personalization.js` is already eager, so a module that depends only on it is cheap.

---

## 6. Out of scope for Phase G

- **Recommending schedules or reordering work from learned behaviour.** `personalizeScore`
  already nudges within `ADJUSTMENT_CAP = 0.08` (`personalization.js:702`); changing that is
  a Phase B concern, not a learning one.
- **Predicting future durations per item.** No model, no extrapolation. Only the observed
  mean of comparable completed work.
- **A learning dashboard.** `productivityProfile` (`personalization.js:611`) already surfaces
  this in Settings; Phase G does not duplicate it.
- Visual QA at 390×844 / 430×932 — Phase H.
- Deployment.

---

## 7. Delivery record

Shipped in five commits on `arena/01a07d32-habbit-trackerrr`:

| Commit | What |
| --- | --- |
| `5c37678` | `docs: audit the learning loop before phase G` |
| `58259c5` | `feat: add the learning loop's accept path` — `learning.js`, `estimate-accept` signal |
| `5e3c8fb` | `feat: surface the accept path where the evidence is shown` — weekly panel + Focus Mode |
| `2a84c24` | `test: cover the learning loop and its accept path` — 40 tests |
| `1e612f2` | `perf: keep the kind-level suggestion out of the initial chunk` |

### 7.1 What changed

**The weekly panel now keeps its promise.** Phase F shipped it ending with *"Nothing changes
unless you accept it."* and no accept control in the file. It now renders one button per
suggestion, labelled with the number it writes (`Plan 45m instead`), dispatching an existing
reducer action, followed by the established undo toast.

**Focus Mode's advice became actionable.** `estimateAdvice` computed `suggestedMin` and the
UI threw it away as read-only text. The stored estimate is still shown alongside and is
still never substituted silently.

**Acceptance is recorded** as a new `estimate-accept` signal, so the product can eventually
distinguish acted-on from ignored. That is observable product behaviour, not an inferred
attribute.

### 7.2 Three design corrections made during the build

**A habit is explained, not applied.** A habit record carries no `estimateMin`, so the accept
path returns `null` for one and the UI states why. Inventing the field would be exactly the
silent mutation #25 forbids.

**One evidence source per claim.** The first version re-derived the number through
`estimateAdvice`, which reads *completed records*, while the weekly suggestion is measured
from the *focus log*. Two sources for one claim meant the panel could quote a figure the
button would not write — or not appear at all. `kindSuggestion` now writes the figure the
suggestion itself measured.

**No local "Applied" flag.** It went stale the moment a user pressed Undo. The suggestion is
derived from state, so it resolves itself once the estimate matches the evidence and returns
if the change is undone.

### 7.3 Bundle

The audit predicted in §5 that Focus Mode is eager and would cost the initial chunk. It did,
and a second cost was missed until the built bundle was grepped.

| | initial JS (gz) | vs 236 kB cap |
| --- | --- | --- |
| Phase F (`1928b3c`) | 233.7 kB | 2.3 kB headroom |
| Phase G, first wiring | 234.9 kB | 1.1 kB headroom |
| Phase G, after the split | **234.5 kB** | **1.5 kB headroom** |

Wiring the accept path into the lazy `ExecutionPanels` was assumed to be free. It was not:
`learning.js` is also imported by the eager Focus Mode, so the whole module — including
`kindSuggestion`, used only by the lazy panel — was pulled into the initial chunk. Grepping
the built bundle showed the panel's own literals present in `index-*.js` and absent from the
`ExecutionPanels` chunk. Splitting into `learning.js` (eager-safe) and `learningKinds.js`
(lazy-only) fixed it.

**Headroom is now 1.5 kB.** Phase H adds no eager code by design.

### 7.4 Gates at `1e612f2`

- `npm test` — **753 passed / 39 files** (was 713 / 37). No existing test changed.
- `npm run lint` — clean.
- `npm run test:schema` — 28 passed, 0 failed.
- `npm run build` — `Perf budget OK — initial JS 234.5 kB gz, CSS 38.3 kB gz, three lazy-only`.
- `git diff --check` — clean.
- Preview on :4173 — `/`, `release.json`, and all JS chunks plus CSS return 200.
- Laziness verified by grepping literals that survive minification: the panel's strings
  appear only in `ExecutionPanels-*.js`; Focus Mode's correctly appear in `index-*.js`.

### 7.5 Not done

- **No learning dashboard.** `productivityProfile` already surfaces this in Settings.
- **No bulk apply, and none is planned.** A suggestion resolves to one named record.
- **No prediction.** Only the observed mean of comparable completed work — no model, no
  extrapolation.
- Visual QA at 390×844 / 430×932 / 1440×900 — Phase H, needs a real browser.
- Nothing deployed.
