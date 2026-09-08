# Phase 5 — The Habits experience

Scope: the Habits pillar only — the Habits workspace, Calendar, Habit detail,
Routines and Week review. Today, Work, Goals and Insights were not redesigned;
the habit engine, scheduling, streaks, check-in persistence, Supabase/RLS,
sync and the pattern intelligence were not rewritten. Nothing was deployed or
merged.

## 1. Audit of the old habit experience (before)

Audited on top of the merged Phase 1/2 + Phase 4 branches (`768d1a8`).

- Habit management was spread across five surfaces with no single "manage my
  habits" place: Today (rows + routine strip + a large **Missed recently**
  card), `#/habits` (a thin wrapper around `LibraryScreen`: tall cards with
  no today status and no completion control), `#/calendar` (matrix plus work
  deadline markers and a "Deadlines in this view" card — 2437 px tall on
  mobile), `#/week` (standalone screen with its own work-deadline card) and
  `#/habits/:id` (a ProgressRing hero, four stat tiles, then the heatmap;
  no today status, pause or archive).
- Habit patterns lived only in an Insights list.
- Baseline screenshots: `qa/shots/phase5-before/`.

### Authoritative systems located and retained

| Concern | Existing source used |
| --- | --- |
| Recurrence, pause, skip, labels | `schedule.js` (`isScheduled`, `isPaused`, `eligibleOn` via stats, `scheduleLabel`, `nextScheduledDate`) |
| Check-ins, streaks, rates, week maths | `stats.js` (`isDone`, `habitStreak`, `habitRate`, `dayDensity`, `weekStats`, `weekDelta`, `strongestHabit`, `weakestHabit`, `weeklyReview`) |
| Detail figures, heatmap series | `analytics.js` (`habitDetail`, `heatmapSeries`) |
| Behaviour patterns | `habitPatterns.js` (`habitPatterns`, its `enough` threshold) |
| Today execution model | `today.js`, `completion.js`, `personalization.js` |
| Reducers | `store.jsx` (`TOGGLE_CHECKIN`, `PAUSE_HABIT`, `SKIP_DAY`, `*_HABITS`, `*_ROUTINES`) |
| Forms / dialogs | `HabitForm` through `HabitUIProvider`, `Sheet` |
| Capture | Omni `parseCapture` deterministic parser + confirm step |

No second streak, calendar, analytics or completion engine was introduced.

## 2. New architecture

```
#/habits                 HabitsScreen  view=active    (canonical)
#/habits?view=routines   HabitsScreen  view=routines
#/habits?view=calendar   HabitsScreen  view=calendar  (embeds CalendarScreen)
#/habits?view=week       HabitsScreen  view=week      (embeds WeekScreen)
#/habits/:id             HabitDetailScreen
#/library  → active   #/calendar → calendar   #/week → week   (legacy, still work)
```

- `src/screens/HabitsScreen.jsx` owns the header (title, one-line summary,
  **New habit** / **New routine**) and the `[Active][Routines][Calendar][Week]`
  tabs (`nav.habit-tabs`, real links with `aria-current`). Calendar and Week
  are lazy chunks inside it.
- `src/components/habits/habitRowModel.js` — pure presentation adapter that
  names the six states (TODAY · COMPLETED · MISSED · NOT SCHEDULED · PAUSED ·
  ARCHIVED) from the engines, plus filters and the summary line.
- `src/components/habits/HabitList.jsx` — the active list, filters, empty
  state and the "⋯" sheet.
- `src/components/habits/HabitActions.jsx` — `useHabitActions()` (log,
  pause/resume, skip, edit, add, archive, delete, view) shared by rows, sheet,
  week review and detail; provider-optional so detail renders standalone.
- `src/components/habits/Routines.jsx` — routine cards + `RoutineForm`.
- `src/components/habits/habitPatternsView.js` — Observation → Evidence →
  Implication cards derived from `habitPatterns()`; `NOT_ENOUGH` copy.
- `src/styles/habits.css` — route-loaded by the two habit screens.
- `LibraryScreen.jsx` deleted (its behaviour lives in HabitList/Routines).

## 3. Active habits (§3-5, §20-22, §35-36)

Row order: NAME → TODAY STATUS → SCHEDULE (+ reminder, next date, paused
until) → STREAK → ACTIONS. Primary action is **Complete / Completed**
(`aria-pressed`, same `TOGGLE_CHECKIN` Today uses); "⋯" opens View · Edit ·
Skip today · Pause/Resume · Archive/Restore · Delete (confirmed, undoable).
A recent miss is a one-line strip under the row with **Log it** — no separate
"Missed recently" card. Filters: All · Today · Needs attention · Active ·
Paused · Archived (Archived only when something is archived). Paused rows
are quieter with a one-tap **Resume**.

## 4. Routines (§8-9, §25)

Routines are a first-class subview: name, kind, included habits in order,
today's grouped completion (○ Meditate ○ Drink water …) driven by the
ordinary habit check-in, 28-day full-completion count, Edit, reorder (↑/↓),
Archive/Restore and Delete (undo). `RoutineForm` reuses the existing routine
reducer actions and references existing habits only.

## 5. Calendar (§10-14)

Canonical `#/habits?view=calendar`; `#/calendar` and `#/calendar/YYYY-MM`
still work. Controls first (Month / 90 days / Year, previous/next, Today),
then the Habit × Day matrix with density band, then an "In this view" summary
(completion per habit and how many missed days can still be logged). Cells
are labelled buttons (`Mark done: <habit>, <weekday, month day>`, `aria-pressed`),
44 px on every viewport; a missed cell is dashed; long-press/N opens the note
sheet. Work-deadline markers and the deadlines card were removed. Mobile:
sticky habit column, horizontally scrollable date region only (document
overflow 0 at 390 and 430), compact segmented controls. Desktop uses the
1240 px column with a full month visible.

## 6. Week review (§15)

Canonical `#/habits?view=week`; `#/week` still works. Completion ring and
"N of M check-ins", delta vs previous week (`weekDelta`), Strongest habit /
Needs attention (`strongestHabit`/`weakestHabit`), a per-habit dot grid and a
"Missed days you can still log" list with inline logging. Work deadlines
removed.

## 7. Habit detail (§16-19)

Hierarchy: HEADER (name, category, schedule, Edit) → **Today** (current
streak + best, today's status, Complete / Log missed) → **Consistency**
(30/60/90-day rate, sparkline, heatmap with `[data-date][data-pct]`) →
**History** (streak list, notes in a disclosure) → **Patterns** →
**Schedule** (`<dl>` facts, connected routines/projects) → **Manage** (Edit ·
Pause for a week / Resume · Archive · Delete with inline "Delete for good"
confirmation). Renders without Toast/HabitUI providers (existing release
test).

## 8. Pattern integration (§18-19)

Only `habitPatterns()` output is shown. Each card is Observation → Evidence →
Implication; when `enough` is false the section shows a single "Not enough
data yet." line and nothing else — no empty charts, no repeated notices.

## 9. Today integration (§24-25)

Today keeps execution. The large "Missed recently" card became a compact
list with inline quick-log buttons and an **Open calendar** link; the
routines "Manage" link points at `habits?view=routines`; habit links across
Insights/Projects/ItemActionsSheet now open `#/habits/:id`.

## 10-11. Mobile / desktop

Mobile above the fold: title, summary line, tabs, first rows with Complete
reachable; document never scrolls horizontally (measured 0 px at 390×844 and
430×932 on every habit route). Desktop: header → tabs → list → compact
summary; calendar shows a full month; detail keeps the heatmap readable.

## 12. Accessibility (§37)

Semantic headings (h1 per screen, h2 per section), real links for tabs with
`aria-current`, `aria-pressed` on completion/calendar controls, labelled
buttons ("Mark X complete", "Log X for Mon", "More actions for X"), 44 px
targets on every habit route (qa/audit.mjs), reduced-motion rules in
`habits.css`, focus-visible outlines, `Sheet` dialogs for actions/forms.

## 13. Performance (§38, §43)

`npm run build` → **initial JS 230.3 kB gzip, CSS 38.3 kB gzip** (budget
236 / 42), three.js still lazy-only. Lazy chunks (gzip): `HabitsScreen`
5.4 kB, `HabitDetailScreen` 4.7 kB, `CalendarScreen` 4.0 kB, `WeekScreen`
3.2 kB, `habits.css` 3.5 kB (route-loaded). Rows are derived once per
render with `useMemo`.

## 14. Tests (§39)

`test/habits.test.jsx` — 31 cases: canonical/legacy routes, active/routine/
calendar/week/detail views, completion, editing, pause/resume, archive,
deletion (+undo), missed logging, filters, empty state, mobile structure,
accessible calendar cells, touch long-press note + keyboard N, pattern
display + insufficient data, Omni habit creation (typed text and the
Add habit command), Insights pattern line, and the pure row model.
Follow-up regressions live where they belong: `test/cssIsolation.test.js`
(habits/work class collision) and `test/accessibility.test.jsx` (sheet focus
return). Existing suites preserved; whole suite 870/870 at `0b493d6`.

## 15. Browser QA (§44)

Real Chromium (the `@sparticuz/chromium` binary with its bundled libraries)
against `vite preview`: `qa/release.mjs`, `qa/e2e.mjs`, `qa/audit.mjs`,
`qa/contrast.mjs`, `qa/workspace-e2e.mjs`. Screenshots in
`qa/shots/phase5-after/` at 390×844, 430×932 and 1440×900. QA scripts fixed
for the Phase 1/2 IA (calendar and achievements now live under
`habits?view=` / `insights?view=`; Omni input id; lazy project-detail tabs).

Final numbers at `0b493d6`: e2e 375 / 0 · release 100 checks · workspace-e2e
356 / 0 · audit 0 findings (10 viewports × 27 routes) · contrast 0 failing
text nodes on all five themes · horizontal overflow 0 on every habit route at
390 / 430 / 1440. The same gate ran green on the GitHub runner for every
commit on the branch via draft PR #27 (opened only to trigger `ci.yml`).

### 15.1 GitHub-hosted Chromium at 390 × 844, 430 × 932 and 1440 × 900

`ci.yml` drives the Habits journeys at 390 and 1440 (`qa/e2e.mjs`,
`qa/release.mjs`) and the layout audit at ten viewports including 430, but
no GitHub-hosted job ran the Habits *journeys* at 430 × 932 or published a
per-viewport count — only Work had that (`work-qa.yml`). The sign-off commit
adds the Habits equivalent, test-only:

- `qa/habits-e2e.mjs` — the §39-41 journeys against the production build
  with the persisted fixture (structure, completion / undo / keyboard,
  missed logging, filters, edit / pause / archive / delete, routines,
  calendar incl. legacy and deep links, week review, detail + patterns,
  empty state, Omni creation, reduced motion), each screen checked for
  horizontal overflow, clipped dialogs, broken images and 44 px targets;
  each viewport ends with zero console errors / exceptions / failed requests.
- `qa/publish-browser-proof.mjs` — `qa/publish-work-proof.mjs` generalised
  through `QA_PROOF_*`; posts the check run **"Habits visual evidence
  \<viewport\>"** titled `Real Chromium <viewport>: N passed / M failed`
  (readable via `gh api repos/…/commits/<sha>/check-runs`).
- `.github/workflows/habits-qa.yml` — `work-qa.yml` for this branch
  (push + `workflow_dispatch`; matrix 390x844 / 430x932 / 1440x900; a second
  job repeats unit, lint, build, schema and `git diff --check`).

Local run of the same script on the same build (HeadlessChrome/149,
`7ac5142`): **390 × 844 173 / 0 · 430 × 932 173 / 0 · 1440 × 900 156 / 0**
(desktop skips the 17 touch-target checks). The two script bugs found while
writing it were in the script, not the app: a toast (`z-index: 90`, from
`main`) sits above a sheet (`z-index: 80`, from `main`) for 4.5 s and can
cover the sheet's last row on a phone, so the proof waits for the toast to
clear like a person would; and the "New habit" header button is not shown
on the Routines tab by design.

## 16. Follow-up commit — CI gate green locally

After the Phase 5 commit the full CI browser gate was replayed locally
(e2e + release, then audit + five contrast themes, then the Work journeys).
Three pre-existing Work findings and one Insights bug were the only red
items, so they were fixed minimally in a follow-up commit rather than left
for Phase 6:

- `InsightsScreen` printed `trend.previous` — an object from
  `trendAnalysis()` — as "[object Object]%". It now prints
  `current − delta`, the same derivation the detail page uses; a test in
  `test/habits.test.jsx` locks the shape.
- Work tabs' active colour moved from `--accent-1` (3.05:1) to the existing
  `--accent-1-lift` text token (the shell's rule for accent-coloured text).
- The inline "Set daily capacity in Settings" link and single-word row titles
  ("Build") gained a 44 px hit area via `min-height`/`min-width` only.
- `qa/e2e.mjs`' "V4 pressure band" check targeted `AssignmentsScreen`, which
  Phase 4 replaced; it now asserts the same facts (deadline, labelled
  progress, risk) on the unified Deliverables rows.

No Work layout, engine or data model was changed.

### 16.1 Keyboard / reduced-motion probe and one visual defect

A second real-Chromium pass exercised the new screens keyboard-only and
under `prefers-reduced-motion: reduce`:

- Tab order on `#/habits` is New habit → the four section tabs → the six
  filters → Open <habit> → Mark <habit> complete; every stop shows a focus
  ring. Space completes (aria-pressed flips, label becomes "Mark … not
  done"), Enter undoes. "More actions" opens the sheet with focus inside a
  labelled dialog, Tab stays trapped, Escape closes it (≈300 ms fade) and
  focus returns to the trigger. Section tabs are links, so Enter navigates.
  Calendar cells take focus and Space logs a missed day. The detail page's
  outline is H1 → Today → Consistency → History → Patterns → Schedule →
  Manage, each a labelled section.
- Under reduced motion nothing on `#habits-screen` animates or transitions
  (> 50 ms); completing still flips state and label, with no particle burst.
- Defect found and fixed: `work.css` (loaded globally by Phase 4) already
  styles `.routine-step` as a timeline node with a `::before` dot painted
  25 px left of the row. The Routines subview reused the same class name, so
  each habit row grew a stray dot outside its card at every viewport. The
  rows are now `.routine-habit`/`.routine-habits`/`-name`/`-meta` (a pure
  rename — no markup, behaviour or Work change). `test/cssIsolation.test.js`
  now fails if the two stylesheets ever share a `routine*` class again. The
  remaining habit classes that also appear in shared sheets (`.cal-cell`,
  `.cal-legend`, `.week-habit`, `.status-pill`, `.calendar-matrix-card`) are
  the pre-existing Calendar/Week base that `habits.css` intentionally layers
  on (missed state, hint, `info` tone).

### 16.2 Creation entry points (§6-7, §26) checked end to end

Real-Chromium walk of every way a habit can be created, at 390 and 1440:

- **Header "New habit"**, **mobile FAB "Add a habit"** and the empty state's
  **Create habit** all open the one `HabitForm` ("New habit" · Name ·
  Schedule type · Reminder · Notes · **Add habit**).
- **Omni free text** "Run every morning": *Detected: Habit* → Review shows
  Type / Title / Deadline / Estimated time with nothing saved → Create adds
  exactly one habit (`schedule: {type: 'daily'}`) which appears in the
  Active list as TODAY and in the count line. "Stretch" (no recurrence, no
  type word) is *Not recognised*: the panel asks which type it is or offers
  Save as note; no Create button, nothing created.
- Defect found and fixed: the Omni **"Add habit" command** (⌘K → Create →
  Add habit, or typing "add habit" + Enter) dropped the user into that flat
  capture preview instead — a second, poorer habit form with no schedule
  control. `CommandCenter` now closes itself and calls `habitUI.openAdd()`
  for the habit preset, so the command lands in the same `HabitForm` with
  focus in Name (verified: one dialog, `#habit-name` focused, schedule group
  present, saving closes the form and stores the habit). Other Create
  presets (project, assignment, goal milestone, project task) are unchanged:
  they stay on the capture path, which is their only form. A test in
  `test/habits.test.jsx` pins the command → HabitForm route.

### 16.3 Touch long-press and dialog focus return (§12, §37)

Driving the calendar with a real touchscreen (CDP touch events, 390×844)
and tracing `focusin`/`focusout` across every habit dialog found two
defects, both pre-existing on `main` but squarely inside the Phase 5
surface:

- **Long-press to add a note never worked on touch.** The hold opened the
  note sheet at 480 ms, but lifting the finger still synthesises a click,
  which landed on the sheet's scrim and closed it ~10 ms later (mouse
  pointers never fire that trailing click, so it passed on desktop).
  `CalendarScreen` now swallows exactly one click after a completed hold
  (capture phase; disarmed by the next `pointerdown`), so the sheet stays,
  the cell does not toggle, and the next ordinary tap still logs the day.
  Verified: hold → type → Save note persists the note and the cell label
  reads "…, note: Felt great"; N on a focused cell opens the same sheet.
- **Focus fell to `<body>` after closing any auto-focusing sheet** (New
  habit, New routine, calendar note): `Sheet` captured the element to
  restore inside its open effect, but React commits a child's `autoFocus`
  before effects run, so it remembered the sheet's own first field. The
  opener is now captured on the opening render; when the opener itself is
  inside another sheet that is closing at the same moment (Omni → Add
  habit), it falls back to that sheet's opener. Verified: Escape returns
  focus to New habit / New routine / the calendar cell / Edit on the detail
  page / the "More actions" button, and Omni → Add habit → Escape lands on
  the button that opened the Omni.

Both have jsdom regression tests (`test/habits.test.jsx`,
`test/accessibility.test.jsx`) that fail against the previous code. The
touch pass also confirmed: cells and range controls ≥ 44 px, the habit
column stays put while the date region scrolls, page overflow 0.

## 17. What remains

Phase 6 was not started. The GitHub Actions run for draft PR #27 (CI gate
only, not for merging) completed green on every step; runner logs could
not be downloaded from the sandbox, so per-suite runner counts are not
recorded here.
