# Phase H Audit — performance, accessibility, QA

Scope: requirements #32 (performance), #33 (privacy), #35 (datasets A–H), #37 (no fake
intelligence), and the accessibility clause of #31.

Audited at `1342b69`. Every figure below was measured, not estimated.

---

## 1. What this sandbox can and cannot verify

This matters more than anything else in the phase, so it comes first.

**Browser-based QA cannot run here.** `qa/audit.mjs`, `qa/contrast.mjs` and `qa/e2e.mjs` all
drive a real Chromium. That is unavailable, confirmed two independent ways:

- `libnspr4.so`, `libnss3.so` and `libnssutil3.so` are all absent (`ldconfig -p`).
- The `puppeteer` package is not installed — only `puppeteer-core`, which ships no browser.

So the following are **not** verified by this phase and must be run before release:

- Computed contrast ratios (`qa/contrast.mjs`).
- Viewport overflow at 390×844 and 430×932, clipped sheets, tiny charts (`qa/audit.mjs`).
- Real focus painting and keyboard traversal in a browser.
- Anything requiring a painted pixel.

What *is* verifiable here is verified below.

---

## 2. Accessibility — #31

### 2.1 One real defect found and fixed

`Heatmap` (`src/components/charts/chartKit.jsx:163`) rendered as `role="img"` with per-day
`<span title="...">` cells. `role="img"` flattens the entire subtree for assistive
technology, so those titles were decorative. A screen reader announced "Completion heatmap"
and nothing else — a chart that communicates zero information.

Fixed by adding an `aria-describedby` summary placed **outside** the `img` subtree, so it is
actually read. It describes the same data the grid shows:

> "58 days with data from 2026-07-12 to 2026-09-07, averaging 98% complete. 57 days at 100%,
> 1 day at 0%."

With no data it says "No days with recorded activity in this range yet." rather than
narrating an empty grid.

`HabitMatrix` was checked and is already correct: when tappable its cells are real
`<button>`s with `aria-label`, and when not it degrades to `role="img"` with no unnamed
buttons.

### 2.2 Survey results

- 52 component files already carry `role`/`aria-` attributes.
- 10 `:focus-visible` rules, 30 `prefers-reduced-motion` blocks.
- `--touch` resolves to a 44px minimum across the adaptive surfaces.
- A scan for clickable `div`/`span`/`li`/`p` with `onClick` and no `role`/`tabIndex` found
  exactly one hit: the heatmap's grid container. That is the defect above, now carrying a
  text alternative; it is a tooltip surface, not a navigation control.
- Every `<button>` on the rendered Today screen has an accessible name (asserted in test).

### 2.3 Two of my own assertions were wrong, not the code

The first draft of the suite asserted that Escape removes the dialog node. It does not — and
should not be expected to. `Sheet` wires Escape on `document` and calls `onClose`; the node
then lingers because framer-motion's `AnimatePresence` exit animation never completes under
jsdom. `isSheetOpen()` flips `true → false` correctly. The tests now assert that contract
rather than DOM removal, with the reason recorded in a comment so nobody "fixes" it later.

---

## 3. Performance — #32

### 3.1 The budget guard already exists and is enforced at build time

`qa/build-proof.mjs:53` pins `initialJsGzip: 236 kB` and `initialCssGzip: 42 kB`, and throws
on breach. It also fails the build if `three.js` is reachable from `index.html`.

Current: **234.5 kB gz JS / 38.3 kB gz CSS** — 1.5 kB and 3.7 kB of headroom.

Laziness was verified by grepping string literals that survive minification, not by trusting
chunk names:

| Literal | `index-*.js` | owning lazy chunk |
| --- | --- | --- |
| "Nothing open of that kind to apply it to" | 0 | `ExecutionPanels-*.js` |
| "already planned near that" | 0 | `ExecutionPanels-*.js` |
| "cannot be undone from here" | 0 | `ItemActionsSheet-*.js` |
| "A habit has no stored estimate" | 1 (eager FocusMode — correct) | — |

### 3.2 No historical metric is recomputed per render

A scan of every eager surface (`TodayScreen`, `App`, `AdaptiveHome`,
`AdaptiveCommandCenter`, `FocusMode`, `PlanningPanel`, `Navigation`, `QuickCapture`) for the
26 expensive engine entry points found **no unmemoized call**. The heuristic initially
flagged five; each was read in context and all five are false positives — three sit inside
the `useMemo` opening at `TodayScreen.jsx:134`, one inside the `useMemo` at
`FocusMode.jsx:29`, and one is a comment.

### 3.3 Bundle discipline cost real work twice

Phases F and G each nearly breached the cap by making a previously-dead export reachable
from an eager screen, which drags its whole dependency subgraph into the initial chunk:

| | initial JS (gz) | headroom |
| --- | --- | --- |
| Phase E | 232.9 kB | 3.1 kB |
| Phase F first wiring | 235.5 kB | 0.5 kB — rejected |
| Phase F after split | 233.7 kB | 2.3 kB |
| Phase G first wiring | 234.9 kB | 1.1 kB |
| Phase G after split | **234.5 kB** | **1.5 kB** |

Both were fixed the same way: split the module along the eager/lazy line rather than
compressing it.

---

## 4. Privacy — #33

A scan of `src/` for `fetch(`, `XMLHttpRequest`, `axios` and `navigator.sendBeacon`
excluding the Supabase client returned **zero** results. The only egress is the user's own
Supabase project, behind auth and RLS.

`LOCAL_COACH_STATUS` remains `{ provider: 'LOCAL', externalAI: 'OFF', apiCost: '$0' }`. No
external AI call exists anywhere in the tree.

---

## 5. Datasets A–H — #35

These did not exist. `test/datasets.js` now builds eight shapes:

| | Name | Shape |
| --- | --- | --- |
| A | light | 2 habits, 21 days at 60%, no capacity set |
| B | heavy-habit | 12 habits, 120 days, no work items |
| C | deadline-heavy | 7 assignments, one overdue, due dates 0–9 days out |
| D | project-heavy | 3 projects, 12 tasks, real progress logs and actuals |
| E | highly consistent | 2 habits, 150 consecutive days |
| F | highly inconsistent | bursts at days 1–2, 40–42, 88 — breaks naive streak maths |
| G | overloaded | ~870 committed minutes against a 120-minute capacity |
| H | new user | onboarded, nothing else |

`test/datasets.test.js` runs 28 engines against all eight. It is not a re-test — each engine
has its own suite. It targets the failure per-engine tests miss: an engine returning a
confident number for a user who gave it nothing to be confident about. Every engine must
either produce output backed by data actually in the state, or say it has nothing.

Dataset H is held to the strictest reading. A story step may report a real zero count
("Overdue: 0" is a fact); it may not invent a finding.

---

## 6. Delivery record

| Commit | What |
| --- | --- |
| `1342b69` | `test: add datasets A-H and run every engine against them` |
| `8496227` | `fix(a11y): give the heatmap a text alternative, and cover Phase D-G surfaces` |
| *(this commit)* | `docs: record the Phase H audit` |

### Gates at `8496227` (the last code commit; this doc changes no source)

- `npm test` — **796 passed / 41 files** (was 753 / 39 at the end of Phase G).
- `npm run lint` — clean.
- `npm run test:schema` — 28 passed, 0 failed.
- `npm run build` — `Perf budget OK — initial JS 234.5 kB gz, CSS 38.3 kB gz, three lazy-only`.
- `git diff --check` — clean.
- Preview on :4173 — `/`, `release.json` and all JS/CSS chunks return 200.

### Not done

- Browser QA (§1) — blocked in this sandbox, must run before release.
- Deployment. Nothing in this release has been published, and no claim is made that it is
  live.
