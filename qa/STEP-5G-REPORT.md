# Step 5G — Work Project Detail Report

Project Detail redesign (`#/projects/:id`) — execution/detail workspace.

## 1. Files changed
- `src/screens/ProjectDetailScreen.jsx`
  - Replaced the old screen-head + "Status" SectionCard hero with a new header + project-health section built on `.dlv*` primitives (same visual language as Overview/Deliverables/Projects/Workload/Deadlines):
    - Back link ("‹ Work") to Projects as the eyebrow anchor.
    - Project identity row: `<KindTag project>`, `<StatusPill>`, phase pill (when deadline set and not complete).
    - H1 project title (`.dlv__title`, 1.75rem, `overflow-wrap: anywhere`), description as `.dlv__sub`.
    - Head actions (Edit pencil, Delete in bad tone) in `.wo__head-actions-inline`.
    - **Project Snapshot** as four `.dlv__pill`s: Progress (%), Deadline/days-left, Tasks (done/total), Milestones (reached/total) — semantic tones via existing `status.tone` / `status.complete` / `behind`.
    - **One project visual**: a compact progress rail (14px) with the project's `status.pct` fill (good/bad/accent-1 tone) and a vertical pace marker at `status.elapsedPct%` (when deadline + elapsed exist), replacing the old MeterRow; descriptive deadline/days-left/duration/% time-gone line + on-pace/behind/ahead signal line.
    - **Needs attention** compact surface (only when `status.tone === 'danger' || status.behind > 15`): bad left-border, eyebrow "Needs attention", one-line guidance text — restrained, not a giant red card.
  - The rest of the existing ProjectDetail screen (Next work, Milestones stepper, Tasks/Timeline/Analytics tabs, TaskList with drag-reorder, Add milestone, Linked deliverables, ProjectForecastCard, ProjectTimeline, ProjectAnalyticsDetail, Visual project track `<details>`, Details rail with kv metadata, Habits carrying this, See it in context links, Notes textarea) remains untouched — all existing actions, dialog flows, deep links (`?task=`, `?milestone=`), Reorder, undo toast, and analytics continue to work.
  - Removed unused `MeterRow` import (replaced by custom progress rail).
  - Re-added `<div class="stack">` wrapper inside `.detail-layout` that was lost during edit to keep existing layout hierarchy correct.
- `src/styles/workspace.css` — **zero changes**. All new styling is via inline styles on `.dlv*` structural classes that already exist.
- `test/work-project-detail-5g.test.jsx` — new: 10 tests.

## 2. Architecture / data reused
- Data: `projectStatus(project, now)`, `projectProgress(project)`, `milestoneTrack(project)`, `projectPhase/phaseTone/PROJECT_PHASES`, `linkedAssignments`, `linkedHabits`, QuickProgress (no-tasks progress), existing `workWorkspace({projects:[project]})` for nextWork — all real calculations, no new algorithms, no fake data, no schema changes.
- Components: existing `KindTag`, `StatusPill`, `QuickProgress`, `MilestoneStepper`, `UniversalWorkRow`, `SectionCard/CardHead`, `ProjectTrack`, `ProjectForecastCard`, `ProjectAnalyticsDetail`, `ProjectTimeline`, task/milestone actions, Reorder drag-reorder, undo toast, ItemActions flows all preserved.
- PageContainer: already `size="detail"` (~880px) via App.jsx for `projects/:id` routes — no change.
- Routes preserved: `#/projects/:id`, `?task=` / `?milestone=` deep-scroll targets, Back link to `#/work?view=projects`, cross-links to Workload/All deadlines/Goals.
- No new dependencies, no new CSS, no Habit UI (rings/calendar/routines).

## 3. Project-health approach
- Single horizontal progress rail (the one allowed visual) showing:
  - Fill = project progress (green when complete, red when danger/behind, accent-1 otherwise).
  - Pace marker = elapsed-time percentage (vertical tick) when a deadline exists.
  - Under-rail caption with deadline, days-left, window length, % time gone; on-pace/behind/ahead line with semantic color.
- Snapshot pills answer "how much done", "when is it due", "how many tasks", "milestone progress" at a glance.
- "Needs attention" only appears when `status.tone === 'danger' || status.behind > 15`; it's a thin-bordered surface with one sentence and no flashing/giant-card treatment.
- When there are no tasks yet, QuickProgress still appears for manual %.

## 4. Visual changes
- Old header: `back-link` + KindTag/StatusPill under screen-head; hero SectionCard "Status" with MeterRow pace bars and extra CardHead chrome.
- New header/hero: Work eyebrow → title → sub → four quiet pills → single progress rail with pace marker → (optional) Needs attention strip — consistent with the rest of the Work pillar.
- Title is the dominant anchor (1.75rem); metadata stays in pills; progress is read in 2 seconds.
- Desktop: `.dlv` header/pills/rail (full width of the existing 880px detail container) followed by existing `.detail-layout` stack + rail, unchanged.
- Mobile: existing `@media (max-width: 760px)` stacks `.detail-layout` single-column; header wraps via flex-wrap on `.dlv__head`; 44px targets preserved (btns, inputs, summary).

## 5. Responsive QA (structural)
- 1440/1024: header/pills/rail at full detail width (880px); existing rail sidebar sits to the right.
- 430/390: `.dlv__head` wraps; pills wrap via flex-wrap; progress rail remains 14px tall and 100% wide; existing `@media (max-width:760px)` stacks the detail column and rail; task/deep-link titles wrap; action buttons ≥44px.
- No new horizontal min-width; title uses `overflow-wrap: anywhere`.

## 6. Tests
- `test/work-project-detail-5g.test.jsx`: **10 tests** — back link + h1 + Project tag + snapshot pills; one progress viz (no dashboard); real % in snapshot; Next work heading; Milestones heading; Edit/Delete buttons present; `?task=t1` deep link scrolls to target; Details rail has category/deadline/tasks; Workload/Timeline context links; responsive media query, no danger-card/alert elements.
- Full relevant suite: **130 / 130 PASS** (26 workspace + 12 work-entity + 11 overview-5b + 11 deliverables-5c + 10 projects-5d + 11 workload-5e + 11 deadlines-5f + 10 project-detail-5g + 8 page-container-widths + 20 today-step3-audit).
- No regressions in 5A–5F.

## 7. Lint / diff / build
- `npm run lint`: clean (0 errors, 0 warnings) after removing unused `fireEvent` import in test and unused `MeterRow` import in component.
- `git diff --check`: clean.
- `npm run build`: ✓ built; Perf budget OK.
  - Initial JS gzip: **225.4 kB**
  - Initial CSS gzip: **55,987 bytes** (zero new CSS bytes — same 333-byte margin under ceiling; budget NOT raised).

## 8. Self-check questions
1. **Premium project detail workspace?** Yes — strong type scale, restrained semantic color, consistent eyebrow/title/pill language with the rest of Work, and a single purposeful progress rail instead of chrome-heavy cards.
2. **Project identity immediately clear?** Yes — the H1 dominates, the "‹ Work" back link anchors context, snapshot pills tell you status/deadline/tasks/milestones within a second.
3. **Project health quickly understandable?** Yes — progress fill vs pace marker is a one-glance answer; red/green/warn tones encode status without alarm.
4. **Clear what to work on next?** Yes — "Next work" row directly below the health section uses the existing UniversalWorkRow, and "Needs attention" appears only when there is real risk.
5. **Richer than old Project Detail?** Yes — stronger hierarchy, cleaner identity, a real progress-vs-pace visual, less chrome (MeterRow/CardHead nesting removed) but more information density.
6. **Same product as the rest of Work?** Yes — `.dlv__eyebrow/title/sub/snap/pill/pulse/focus` vocabulary is identical to Deliverables/Projects/Workload/Deadlines; existing detail sections sit underneath without visual friction.

## 9. Scope discipline
- ONLY `#/projects/:id` changed. Overview/Deliverables/Projects/Workload/Deadlines, Assignment Detail, Goals, Insights, Today, Habits: untouched beyond shared primitives.
- No new reducers/engines/APIs/dependencies; all existing Project Detail functionality preserved (tasks, milestones, reorder, notes, habits, analytics, timeline, forecast, deep links).
- CSS ceiling NOT raised.

## 10. Commit / push
- Branch: `arena/01a08bf2-habbit-trackerrr`
- Commit recorded + pushed after this report.

## 11. STOP
Per scope, Step 5G ends here. Do **not** proceed to 5H Assignment Detail.
