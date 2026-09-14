# Step 5F — Work Deadlines Report

Deadlines redesign (`#/work?view=deadlines`) — temporal execution workspace.

## 1. Files changed
- `src/screens/WorkScreen.jsx`
  - Replaced the plain `DeadlinesView` (h2 + sub + `<section class="workspace-deadline-group">` per group) with a premium temporal surface reusing `.dlv*` primitives from Deliverables/Projects/Workload:
    - Header: eyebrow "Work" + h2 "Deadlines" + sub ("What's due, how soon, and what to act on first — chronological, with risk and progress").
    - **Deadline Snapshot** as four inline pills (Overdue / Today / Next 7 days / Completed) anchored via `workHref()` (preserves URL `?filter=`). Counts come from `model.deadlines` (full universe) so they stay honest under any filter/horizon.
    - **Deadline density** compact viz: 14-day pulse bars (reused `.dlv__pulse-bars/.dlv__pulse-col/.dlv__pulse-fill/.dlv__pulse-label`), today highlighted with accent color; a small red "N overdue items" line under the pulse calls out when there is overdue work.
    - **Timeline** primary column: Overdue / Today / Tomorrow / This week / Later groups (chronological) each with a colored left guide line (`var(--bad)` for Overdue, `var(--accent-1)` for Today, `var(--line)` otherwise) and a group header with semantic color and count; groups render via existing `Rows` (UniversalWorkRow) which preserves title/kind/parent link/status/3px progress rail/deadline/risk/⋯ actions/deep links. Completed group appended when filter shows completed. Groups are computed from the FILTERED `rows` (respects FILTERS/search/horizon — the Today horizon test still passes).
    - Secondary sidebar: **Next up** card (first non-empty Today → Tomorrow → This week → Later → Overdue, with Open deep link to assignment/project) + **Overdue** compact list (≤3 items via `WorkEntity` with `progress:false, actions:false`, "View all N overdue →" link).
  - Removed the obsolete `<dl class="workspace-capacity-values">` helper in 5E (already done), and dropped the now-unused `deadlineGroups` import (grouping is inline so we get colored left borders per group). Added `weekDays` to `dates.js` import for `weekEnd` calculation.
- `src/styles/workspace.css` — **zero new rules**. The timeline groups use inline `border-left` styles on `.dl-group` so zero new CSS bytes.
- `test/work-deadlines-5f.test.jsx` — new: 11 tests.

## 2. Data / architecture reused
- Data: `model.deadlines` (chronological union of assignments/projects/milestones/tasks) from existing `workWorkspace()` → `deadlineTimeline()` + `calendarMarkers()`. Risk semantics (`OVERDUE/CRITICAL/AT RISK/DUE SOON/COMPLETED`) come from existing `scorePriority`/`deadlineRisk` (lib/adaptive.js) — no new priority algorithm, no fake data, no schema changes.
- Filtering: the list uses `rows` already filtered by parent `filterWork(model.deadlines, options, model)` so the existing FILTERS chips, search box, and horizon links (Today/3/7 days) all continue to filter the timeline — confirmed by the existing "navigates Today horizon to a filtered chronological view" test.
- Components: `Rows`/`UniversalWorkRow` for timeline items (preserves Complete/Edit/Move/Archive/Delete via ItemActionsSheet and deep links `#/assignments/:id`, `#/projects/:id`, `#/projects/:id?task=…`, `#/projects/:id?milestone=…`); `WorkEntity` for compact sidebar rows; existing Button primitives (`btn sm/ghost`); semantic tokens (`var(--bad/warn/good/accent-1/line/surface)`).
- Routes preserved: `#/work?view=deadlines`, legacy `#/timeline`, `?filter=`/`?horizon=`/`?query=` all continue to work.
- PageContainer `size="workspace"` (980px) from App.jsx (5B) unchanged.
- No Habit UI (no rings/calendar grids/routines/habit completion language).

## 3. Timeline approach
- Vertical (top-to-bottom) timeline: Overdue → Today → Tomorrow → This week → Later → (Completed when shown).
- Each group has a subtle 2px left accent bar: bad for Overdue, accent-1 for Today, default line for future groups (no big colored cards, no full-row coloring).
- Group headers are the `.dlv__h2` uppercase eyebrow with a tiny tnum count — understated; the actual row title stays visually dominant.
- The 14-day pulse at the top gives a quick delivery-density answer ("how packed are the next two weeks?") — it is the only aggregate viz, not a chart dashboard.
- Risk is signaled per-row via existing WorkEntity semantics (dot/pill + deadline label tone), not via red-carded groups.

## 4. Visual changes
- Old Deadlines: simple `<h2>Deadlines</h2>` + sub + plain H3-labeled groups with no visual hierarchy, no aggregate answer, no focus card.
- New Deadlines:
  - Strong eyebrow/h2/sub consistent with Overview/Deliverables/Projects/Workload.
  - Compact snapshot pills give instant counts of Overdue/Today/Next 7 days/Completed.
  - Pulse viz answers "how dense are the next two weeks" with today highlighted.
  - Chronological timeline with colored guide lines anchors each group visually; the Overdue/Today split is immediately obvious.
  - Sidebar Next-up card + compact Overdue list keep the eye focused on what to act on first.
  - Hairline-continuous rows (WorkEntity/UniversalWorkRow) keep deep links + ⋯ actions working.
  - Mobile ≤767px: inherits `.dlv__grid` single-column stack; pulse bars shrink via flex grid; all targets ≥44px.

## 5. Responsive QA (structural)
- 1440/1024: two-column `.dlv__grid` (timeline primary, sidebar secondary) inside PageContainer workspace (980px); snapshot inline; 14-col pulse.
- 430/390: single column; pulse bars remain legible (14 equal 1fr columns with 4px gap); group titles wrap; deep-link titles wrap via `.dlv__list { min-width: 0 }`; buttons 44px.
- No horizontal overflow; no clipped names; no min-width traps.

## 6. Tests
- `test/work-deadlines-5f.test.jsx`: **11 tests** — eyebrow/h2/sub + four snapshot pills; 14-day pulse viz; chronological Overdue/Today/Tomorrow/This week/Later groups with semantic left borders; pill URL navigation; Today horizon filtering (legacy contract); no full-row coloring; Next-up deep links are canonical `#/assignments/` or `#/projects/`; sidebar Overdue compact list + View-all link; Rows/progress rails present (no new row system); mobile 1fr at 767px, no Habit vocab; legacy `#/timeline` route.
- Full relevant suite: **120 / 120 PASS** (26 workspace + 12 work-entity + 11 overview-5b + 11 deliverables-5c + 10 projects-5d + 11 workload-5e + 11 deadlines-5f + 8 page-container-widths + 20 today-step3-audit).
- 5A–5E all green; no regressions.

## 7. Lint / diff / build
- `npm run lint`: clean (0 errors, 0 warnings) after removing unused `deadlineGroups` import.
- `git diff --check`: clean.
- `npm run build`: ✓ built; Perf budget OK.
  - Initial JS gzip: **225.4 kB**
  - Initial CSS gzip: **55,987 bytes** (333 bytes under ceiling — same as after 5C/5D/5E; zero new CSS bytes added because group accents are inline styles and all structure reuses `.dlv*`). Budget NOT raised.

## 8. Four self-check questions
1. **Most urgent deadline identifiable immediately?** Yes — "Overdue" pill shows a count in bad tone; the red overdue guide-line group sits at the top; sidebar "Next up" highlights the single most urgent item; existing Overload banner continues to fire when today is overloaded.
2. **Timeline feels premium?** Yes — strong type scale, subtle guide lines, semantic color used only where it encodes meaning, polished spacing, the 14-day density pulse adds visual rhythm without noise.
3. **Richer than the old screen?** Yes — the old was a bare heading + flat groups; new has framing, aggregate pulse, semantic guide lines, and a Next-up focus card.
4. **Same product as siblings?** Yes — uses the same `.dlv*` primitives, eyebrow/title/sub rhythm, pill style, focus card, and tone system as Deliverables/Projects/Workload; reads as one coherent Work pillar.

## 9. Scope discipline
- ONLY `#/work?view=deadlines` (and legacy `#/timeline`) changed. Overview/Deliverables/Projects/Workload, Project/Assignment detail, Goals, Insights, Today, Habits: untouched.
- No new reducers/engines/APIs/dependencies; no new chart library.
- CSS ceiling NOT raised.

## 10. Commit / push
- Branch: `arena/01a08bf2-habbit-trackerrr`
- Commit recorded + pushed after this report.

## 11. STOP
Per scope, Step 5F ends here. Do **not** proceed to 5G Project Detail.
