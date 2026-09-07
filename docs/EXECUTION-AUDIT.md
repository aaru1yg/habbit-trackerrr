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
