# Phase E Audit — search, command, form, store and planning systems

Audited on `arena/01a07d32-habbit-trackerrr` at `b232fad`, before any Phase E code was
written. Every line number below was read, not assumed.

The verdict in one line: **the capture *destination* is complete and must not be touched;
what is missing is the *entry point* and the parsing in front of it.**

---

## 1. What already exists (reuse, do not rebuild)

### 1.1 Search — exists and is complete

| Piece | Where | What it does |
|---|---|---|
| `searchAll(state, query, limit)` | `src/lib/analytics.js:716` | Token-AND match across habits, projects (incl. their tasks), assignments (incl. subtasks), routines, check-in notes, mood reflections, dates and work deadlines. Returns `{groups, count}`. Refuses under 2 characters. |
| `SearchPalette` | `src/components/layout/SearchPalette.jsx` | `Sheet`-based palette. Arrow Up/Down/Enter, hover-tracks the cursor, `TYPE_META` icon per result, `pick()` routes per type. |
| `/` shortcut | `src/App.jsx:82-95` | Opens search anywhere except inside a field, a `contentEditable`, or while a sheet is open (`isSheetOpen()`). |

**Gap:** navigation only. Search cannot *do* anything, and has no natural-language filters.

### 1.2 Command system — the ranking half already exists, the execution half does not

This is the most important finding in the audit. Phase B already built E11:

| Piece | Where | Status |
|---|---|---|
| `QUICK_ACTIONS` | `src/lib/personalization.js` | 8 actions **including `{ id: 'capture', signal: 'capture' }`** — declared in Phase B, deliberately unrendered. |
| `quickActions(state, {limit, days})` | `src/lib/personalization.js` | Deterministic ranking from real signals. Returns `source: 'observed' \| 'default'` and an honest `reason`. With no behaviour it is byte-identical to the default order. |
| `SIGNAL_TYPES['capture']` | `src/lib/personalization.js` | Already reads `'Used quick capture'`. **E9 needs no new signal type.** |
| Inline signal recording | `src/store.jsx` `ADD_HABIT` / `ADD_PROJECT` / `ADD_ASSIGNMENT` | The reducer itself appends `habit-add` / `work-add` signals. Capture inherits this for free. |
| `ACTION_ICON` | `src/components/today/AdaptiveHome.jsx:40` | Filters to actions with a real handler. The comment says outright: *"Quick capture arrives in Phase E and joins this map then."* |

**Gap:** no command registry, no `executeCommand()`, no ⌘K handler, and `capture` has no icon
entry so it is invisible today.

### 1.3 Forms — exist, are thorough, and must stay the deep path

| Piece | Where | Notes |
|---|---|---|
| `ProjectForm` | `src/components/work/WorkForms.jsx:46` | Milestone parsing, priority picker, estimates, validation. |
| `AssignmentForm` | `src/components/work/WorkForms.jsx:222` | Subtasks, subject, progress mode, `DEADLINE_PRESETS`, validation, `defaultProjectId`. |
| `HabitUIProvider` | `src/components/habits/HabitUIProvider.jsx` | `openAdd()` / `openEdit(h)` / `openDetail(h)` / `archive` / `remove`. |
| `WorkUIProvider` | `src/components/work/WorkUIProvider.jsx` | `newProject()`, `newAssignment(projectId)`, `editProject`, `editAssignment`, `deleteProject`/`deleteAssignment` **with Undo**, `setAssignmentProgress`, celebration. |
| `useToast()` | `src/components/ui/Toaster.jsx:7` | One visible toast, optional action button — already used for "Deleted … Undo". |

**Gap:** the forms take `{open, onClose, editing, defaultProjectId}` only. They cannot be
pre-filled from a capture. That is fine — Quick Capture creates directly through the store
(E4 confirmation replaces the form), and *Edit* hands off to these existing forms.

### 1.4 Store — reducer-first, and already offline-correct

Factories and reducers in `src/store.jsx`:

- `ADD_HABIT` (`:349`), `ADD_PROJECT` (`:449`), `ADD_TASK` (`:493`), `ADD_ASSIGNMENT` (`:557`),
  `ADD_GOAL` (`:620`), `ADD_GOAL_MILESTONE` (`:650`).
- `baseProject` (`:173`), `baseAssignment`, `baseGoal`, `baseGoalMilestone` all spread the
  caller's payload **last**, so a partial payload is filled in safely and a caller-supplied `id`
  wins.
- **`export const newId = uid`** (`:19`) — the id generator is public.

That last point decides E17 and E18. Ids are minted inside the reducer, so a naive
`dispatch(ADD_ASSIGNMENT)` leaves the caller unable to name what it just created. Because
`newId` is exported and the factories honour a supplied `id`, Quick Capture can mint the id,
dispatch with it, and still offer *"Add to today's plan"* / *"Make this your next best action"*
on the exact object it made. **No new storage layer, no new reducer needed** — E23 is satisfied
by construction, because everything already flows dispatch → local state → `localStorage` →
`syncEngine`.

Offline: `syncEngine.js` has an `OFFLINE` state and `errors.js:26` already carries the honest
sentence *"You're offline. Changes are saved on this device and will sync when you reconnect."*
Capture that only touches local state is offline-safe with no extra work.

### 1.5 Planning and priority — exist and stay authoritative

`getNextBestAction` and `getTodayPriorities` (`src/lib/adaptive.js:53,67`), `buildDayPlan`,
`buildWeekPlan`, `recoveryPlan`, `replan`, `focusRecommendation` (`src/lib/planning.js`),
`personalizedRanking` (`src/lib/personalization.js`, `authoritative: 'deterministic'`).

`getNextBestAction` already returns exactly the shape E14 asks for:
`{item, reason, urgency, estimatedMin, deadline, signals}`. **E14 is a call, not an implementation.**

### 1.6 Accessibility infrastructure — exists

`src/components/ui/Sheet.jsx` already provides `role="dialog"`, a Tab focus trap, Escape,
focus-restore on close, `aria-modal`, and — important for E19 — a `visualViewport` listener that
publishes the real visible height as a CSS variable so the on-screen keyboard cannot cover the
confirmation actions. `isSheetOpen()` (`:19`) is exported.

---

## 2. Gap analysis against E1–E35

| # | Requirement | Status | Plan |
|---|---|---|---|
| E1 | ⌘K / Ctrl+K entry | **missing** | new handler in `App.jsx`, lazy palette |
| E1 | Mobile quick capture | **missing** | existing mobile rail gets one action |
| E1 | keep `/` | exists | untouched |
| E2 | single capture input | **missing** | new |
| E3 | deterministic classification | **missing** | new `quickCapture.js` |
| E4 | confirmation preview | **missing** | new; never dispatches without it |
| E5 | ambiguity → ask | **missing** | new |
| E6 | relative date parsing | **missing** | new; boundary tests required |
| E7 | duration parsing | **missing** | new |
| E8 | project/goal linking | **missing** | new, confirmation-gated |
| E9 | capture signal | **foundation exists** | `SIGNAL_TYPES.capture` + reducer already record; dispatch one `capture` signal on confirmed use |
| E10 | command center | **missing** | new registry |
| E11 | smart action ranking | **exists** | reuse `quickActions()` verbatim |
| E12 | search ≠ command | exists (search) | two explicit zones, never merged |
| E13 | NL filters | **missing** | map to existing engines only |
| E14 | next best action command | **exists** | call `getNextBestAction()` |
| E15 | universal action model | **missing** | new `commandActions.js` |
| E16 | one-tap execution | partial (Today) | extend via existing reducers |
| E17 | capture → plan | **missing** | offer only; existing planning engine |
| E18 | capture → next action | **missing** | offer only |
| E19/E20 | mobile + desktop QA | — | CSS + tests |
| E21 | a11y | **foundation exists** | reuse `Sheet` |
| E22/E23 | offline + sync | **satisfied by construction** | verify with a test |
| E24 | duplicate protection | **missing** | recent-capture detection + confirm |
| E25 | error handling | **missing** | "Couldn't confidently classify this." + Save as note |
| E26 | no fake intelligence | — | enforced by tests |
| E27 | bundle | **tight** | 3.5 kB headroom; palette must be lazy |
| E28 | module layout | — | three pure modules |

---

## 3. Decisions locked before writing code

1. **Nothing existing is rewritten.** `SearchPalette`, `searchAll`, the forms, the providers, the
   reducers and the planning engine are called, not replaced.
2. **Three pure modules, no React inside them:** `src/lib/quickCapture.js` (parsing),
   `src/lib/commandActions.js` (registry + universal actions), `src/lib/queryParser.js` (NL
   filters). Parsing never touches a component.
3. **`parseCapture` returns a confidence, and the UI obeys it.** `confident` → confirm;
   `ambiguous` → ask which type; `unresolved` → "Couldn't confidently classify this." with
   Save as note / Edit / Cancel. A guess is never presented as a recognition.
4. **Nothing is invented.** No date, duration, project, goal, priority or estimate is filled in
   unless the text literally contained it. Omitted means `null`, and the preview says
   *"Not specified"*.
5. **Confirmation is not optional.** There is no code path from text to `dispatch` that does not
   pass through the preview. That is asserted by a test, not by a comment.
6. **`/` still opens search, unchanged.** ⌘K opens the Command Center, which keeps Command and
   Search as two separate zones with their own headings.
7. **Bundle discipline.** `App.jsx` gains only the keydown handler and a `React.lazy` import.
   `advancedAnalytics.js` stays lazy — a test from Phase D already enforces its single importer,
   and this phase must not break it.
8. **Deterministic priority stays authoritative.** Quick capture never reorders anything; it hands
   the new object to the existing engines and lets them decide.

---

## 4. Risk register

| Risk | Mitigation |
|---|---|
| 3.5 kB of headroom | Palette is `React.lazy`; parsing modules are tiny and only imported by it |
| ⌘K colliding with the existing `/` handler or a focused field | Reuse the exact field/sheet guard `App.jsx:84-88` already uses |
| Inventing a date from an ambiguous phrase ("Friday" with no week) | Parse only the listed safe phrases; anything else → `null` + "Not specified" |
| Silently creating duplicates | Recent-capture detection surfaces a warning, never blocks |
| Claiming a link that was not stated | `suggestLinks` requires a literal name match and always asks |

---

## 5. Phase E — delivered

Five commits: `040b479` (this audit) → `25f0548` (registry + filters) → `ac36123` (parser
fixes) → `103f809` (UI) → `e3eb00c` (UI tests).

### What shipped

| Module | Role |
|---|---|
| `src/lib/quickCapture.js` | `resolveRelativeDate`, `parseDuration`, `classifyCapture`, `parseCapture`, `extractTitle`, `suggestLinks`, `validateCapture`, `detectDuplicate`, `captureToAction` |
| `src/lib/commandActions.js` | `COMMANDS`, `availableCommands`, `matchCommands`, `executeCommand`, `nextActionResult`, `itemActions`, `resolveItem` |
| `src/lib/queryParser.js` | `matchQuery`, `runQuery`, `answerQuery` over six filters |
| `src/lib/intents.js` | one-slot handoff so a command opened from any route can reach the panels on Today |
| `src/components/layout/QuickCapture.jsx` | `CaptureBody` (reusable) + a standalone `Sheet` wrapper |
| `src/components/layout/CommandCenter.jsx` | the ⌘K palette |

All four lib modules are pure — no React, no dispatch. `executeCommand` returns a descriptor;
the component performs it.

### The one design correction worth recording

The first build put a command/search box at the top of the palette and made Quick Capture a
*second* sheet. The tests failed immediately: nothing rendered the live read-out, because the
field the user types into was not the capture field. The brief asks for **one** input under ⌘K,
so `CaptureBody` was extracted and rendered inline behind the palette's own field. The standalone
sheet now wraps the same body, so the FAB and the Today quick action share one implementation.

### Three parser defects only the mounted UI could find

1. **Entity names were read as type words.** "Finish API work for Habit OS" classified as a
   *habit* because the project is called "Habit OS"; a goal called "Daily Reading" made anything
   mentioning it look like a recurrence. `classifyCapture` now strips existing project and goal
   names before looking for type words.
2. **A dateless one-off was reported as unclassifiable.** "Prepare presentation" now asks
   Assignment vs Project task — the brief's own E5 example. With a resolvable date the deadline
   fallback still applies, so "Finish DSA Chapter 4 by Friday" stays a *suggested* assignment.
3. **`extractTitle` left a trailing "due"** once the date phrase was removed, so "Physics set due
   Friday" became "Physics set due" and duplicate detection silently missed the existing
   "Physics set".

A fourth defect was caught by the command tests: `itemActions` and `resolveItem` used
`toISOString()` for "today" while the app keys check-ins by local day — an off-by-one either side
of midnight. Both now use `dayStr()`, and `resolveItem` takes an injectable clock.

### Bundle

| | Initial JS gz | Headroom of 236 kB | New chunk |
|---|---|---|---|
| Phase D | 232.5 | 3.5 kB | — |
| Phase E | **232.9** | **3.1 kB** | `CommandCenter` 40.65 kB / **13.00 kB gz** |

CSS 37.4 → **37.9 kB gz** (cap 42). The 0.4 kB of initial growth is the ⌘K handler, the intents
module and the mobile nav entry. The parser, registry and palette — 13.00 kB gzipped — are paid
for only on first ⌘K.

Lazy proof, same method as Phase D (grepping *function names* finds nothing in a minified bundle):
`Couldn't confidently classify`, `How should I save this?`, `What do you need to do?` and
`You can also ask` each appear **zero times in `index-*.js`** and only in `CommandCenter-*.js`.
The Phase D guard still holds — `advancedAnalytics.js` has exactly one importer, and
`queryParser.js` deliberately reimplements two lines of workload arithmetic rather than import it.

### Verification

| Command | Phase D | Phase E |
|---|---|---|
| `npm test` | 513 / 32 | **662 / 36** |
| `npm run lint` | clean | clean |
| `npm run test:schema` | 28 / 28 | 28 / 28 |
| `npm run build` | 232.5 kB gz | **232.9 kB gz JS / 37.9 kB gz CSS** |
| `git diff --check` | clean | clean |

149 new tests: 69 parser, 47 registry/filters, 33 UI through the real app.

`npm run preview` checked by hand: `/` 200, `index-*.js` 200, `CommandCenter-*.js` 200
(40 794 b), `AnalyticsLab-*.js` 200, CSS 200, `release.json` 200. Puppeteer E2E remains
unavailable in this sandbox.

### Not done

- **E15/E16 universal actions are modelled but only partly surfaced.** `itemActions()` is
  complete and tested, and Today already had one-tap completion; the remaining surfaces
  (search rows, command results) still navigate rather than act. That belongs to Phase F,
  which owns the execution flow.
- **E19/E31 visual QA at 390×844, 430×932 and 1440×900 is unchecked** — it needs a real
  browser. The CSS is written mobile-first with 44px minimums and no fixed widths, but that
  is an intention, not a measurement.
- **E23 device-to-device sync is untested here.** Capture is correct by construction because
  it goes through the same reducers and `syncEngine` as everything else, and there is no
  separate storage layer, but two real devices were not available.
- **Not deployed.** The public site is untouched.
