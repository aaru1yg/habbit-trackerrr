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

`npm run build` → **initial JS 230.2 kB gzip, CSS 38.3 kB gzip** (budget
236 / 42), three.js still lazy-only. Lazy chunks: `HabitsScreen` 16.0 kB,
`HabitDetailScreen` 15.1 kB, `CalendarScreen`, `WeekScreen`, `habits.css`
(15.7 kB raw, route-loaded). Rows are derived once per render with `useMemo`.

## 14. Tests (§39)

`test/habits.test.jsx` — 26 cases: canonical/legacy routes, active/routine/
calendar/week/detail views, completion, editing, pause/resume, archive,
deletion (+undo), missed logging, filters, empty state, mobile structure,
accessible calendar cells, pattern display + insufficient data, Omni habit
creation, and the pure row model. Existing suites preserved and green.

## 15. Browser QA (§44)

Real Chromium (the `@sparticuz/chromium` binary with its bundled libraries)
against `vite preview`: `qa/release.mjs`, `qa/e2e.mjs`, `qa/audit.mjs`,
`qa/contrast.mjs`. Screenshots in `qa/shots/phase5-after/` at 390×844,
430×932 and 1440×900. QA scripts fixed for the Phase 1/2 IA (calendar and
achievements now live under `habits?view=` / `insights?view=`; Omni input
id; lazy project-detail tabs).

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

## 17. What remains

Phase 6 was not started. Outstanding: a GitHub-runner Chromium pass on the
pushed branch (CI status is not readable from the sandbox).
