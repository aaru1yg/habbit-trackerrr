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
