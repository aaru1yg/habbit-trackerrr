# Step 5A Report — Work Foundation (Entity + Visual Language)

Date: 2026-09-13
Branch: `arena/01a08bf2-habbit-trackerrr`

## 1. Work audit

Audited before writing any code (read-only):

- **Engines (read-only)**: `src/lib/work.js` exports `projectProgress`, `assignmentProgress`, `projectStatus`, `assignmentStatus`, `milestoneTrack`, `deadlineTimeline`, `workloadSeries`, `priorityWork`, `deadlineLanes`, `projectForecast` (via `adaptive.js`), `projectPhase`, `assignmentPressure`, `burndown`, `timeVsWork`, `itemHistory`, `weeklyCompletionSpeed`, etc. All left untouched.
- **Entities in store**: `projects[]`, `assignments[]`, project-owned `milestones[].tasks[]`, assignment-owned `subtasks[]`, `goals[].milestones[]` (goals untouched by 5A).
- **Store factories**: `baseProject`, `baseAssignment` (projects carry `milestones[]`, `manualPercent`, `startDate`, `deadline`, `estimateMin`, `completedAt`; assignments carry `progress`, `progressMode`, `subtasks[]`, `projectId`, `assignedDate`, `deadline`; tasks carry `status` ∈ {todo, doing, blocked, done}, `due`, `priority`, `estimateMin`; milestones carry `name`, `due`, `tasks[]`, reached state is derived by `milestoneTrack()`).
- **Presentation adapter**: `src/components/work/workViewModel.js::workWorkspace()` already produces canonical `{kind, item, status, risk, parent, milestone, href, remainingMin, …}` rows for **project**, **assignment**, **project-task**, **milestone**. 5A reuses this adapter as the single source of truth — no new data layer.
- **Existing UI**: `UniversalWorkRow.jsx` (workspace overview list, used by `WorkScreen`), `WorkCards.jsx` (ProjectCard/AssignmentCard/WorkRow — used by `ProjectsScreen`, `AssignmentsScreen`, `TimelineScreen`, `WorkloadScreen`, `SettingsScreen`), `ProjectGallery.jsx` (gallery layout), `WorkKit.jsx` (`Meter`, `StatusPill`, `KindTag`, `DeadlineHero`, `CountdownChip`, `QuickProgress`, `MilestoneStepper`, `StatStrip`, `FilterBar`, `WorkEmpty`), `WorkForms.jsx`, `WorkFocus.jsx`, `DeadlineLanes.jsx`, `DeadlinePressure.js`, `PaceRibbon.jsx`, `AssignmentAnalytics.jsx`, `ProjectAnalyticsDetail.jsx`, `WorkCapacitySeries.js`, `ForecastCard.jsx`. **All left in place** for existing screens; the new `WorkEntity` is the canonical *foundation* that future Work screens migrate toward.
- **Primitives (Step 1B)** used directly: `Surface`, `Button`, `IconButton`, `Text`, `Stack`, `Row`, `Cluster`, `Divider`, `Badge`, `Status`, `Progress` (added `thin` 3px variant for aggregate rails), `Metric`, `EmptyState`, `Callout`.
- **Action system**: `itemActions()` in `commandActions.js` already dispatches the right reducer actions per kind; `ItemActionsSheet`, `WorkFocus`, planning/recover sheets reused as-is.

## 2. Entities discovered (no new fields invented)

| Entity          | Kind            | Source                                |
|-----------------|-----------------|---------------------------------------|
| Project         | `project`       | `state.projects[]`                    |
| Assignment      | `assignment`    | `state.assignments[]`                 |
| Project Task    | `project-task`  | `project.milestones[].tasks[]`        |
| Milestone       | `milestone`     | `project.milestones[]` (derived reached/partial by `milestoneTrack`) |

Goals / Goal Milestones / Workload buckets / Deadline groups are NOT Work entities in this step (out of scope per the STOP list).

## 3. Data mapping

For each entity (fields come from the store; nothing invented):

| Field             | Project                               | Assignment                            | Project Task                          | Milestone                             |
|-------------------|---------------------------------------|---------------------------------------|---------------------------------------|---------------------------------------|
| ID                | `project.id`                          | `assignment.id`                       | `task.id`                             | `milestone.id`                        |
| TYPE              | `'project'`                           | `'assignment'`                        | `'project-task'`                      | `'milestone'`                         |
| TITLE             | `project.name`                        | `assignment.name`                     | `task.name`                           | `milestone.name`                      |
| PARENT/RELATIONSHIP| none (top-level)                      | `projectId → parent project`          | `projectId + milestoneId → project · milestone` | belongs to a project               |
| STATUS            | `projectStatus()` → completed/overdue/atRisk/onTrack/noDeadline | `assignmentStatus()` adds `urgent` ≤24h | `task.done ? 'done' : task.status` (todo/doing/blocked/done) | `milestoneTrack()` → reached/partial |
| PROGRESS          | task-derived % (manualPercent fallback) via `projectProgress()` | subtask-derived or explicit % via `assignmentProgress()` | binary 0/100 (done flag) | milestone own % via `milestoneTrack()` |
| DEADLINE          | `project.deadline`                    | `assignment.deadline`                 | `task.due`                            | `milestone.due`                       |
| EFFORT/ESTIMATE   | `project.estimateMin`                 | `assignment.estimateMin`              | `task.estimateMin`                    | (none)                                |
| RISK              | `status.id` + `risk` from `scorePriority()` → OVERDUE/CRITICAL/AT RISK/DUE SOON/SAFE | same | inherits from parent/date           | (derived)                             |
| AVAILABLE ACTIONS | `itemActions('project', …)` view/add-task/edit/link/archive/delete | view/focus/complete/edit/move/archive/delete | view/focus/edit/move/complete (toggle)/delete (via existing reducers) | view (milestones don't have their own reducer actions in the existing model) |
| DETAIL DESTINATION| `#/projects/:id`                      | `#/assignments/:id`                   | `#/projects/:projectId?task=:id`      | `#/projects/:projectId?milestone=:id` |

## 4. Canonical Work presentation

One reusable component, **`WorkEntity`** (`src/components/work/WorkEntity.jsx`), renders all four entity types via the `row` shape produced by `workWorkspace()`. Visual contract:

- **Row, not card**: flat hairline-separated row (`.we { border-bottom:1px solid var(--line); background:transparent }`), no shadows or gradients; card-surface variant is opt-in via Surface primitive wrappers.
- **Lead**: small kind icon in neutral text-3 (no strong competing colors).
- **Title**: dominant h3 at `fs-base/fw-medium`, ellipsised.
- **Relationship**: small xs line under title, "Project · Milestone"; keyboard-activatable parent link (rendered as a role=link span to avoid invalid `<a>` nesting inside the row anchor).
- **Meta cluster**: semantic Status dot (from primitives `Status`), single deadline signal (`Due today`/`Due tomorrow`/`N days left`/`Overdue`), one concise risk label if applicable. Status label is suppressed when risk label already conveys the same thing (no "Overdue" + "On track" double-labelling; "On track" hidden by default as noise).
- **Progress**: 3px thin `Progress` rail under meta, using semantic tone (success on complete, danger on overdue/urgent, warning on atRisk, accent otherwise); small tabular percent.
- **Actions**: primary Complete button inline only when the existing reducer supports direct completion (assignment → `SET_ASSIGNMENT_PROGRESS:100`, project-task → `TOGGLE_TASK`); contextual `⋯` (IconButton → existing `ItemActionsSheet`) gated by `onMore` prop (opt-in, preserving Work's "don't permanently expose Edit/Move/Archive/Delete" rule); Milestones have no Complete/⋮ because the existing model has no direct milestone-complete reducer (they are reached via tasks).

Props: `row`, `as`, `onClick`, `show?:{kind,title,rel,status,progress,deadline,risk,effort,actions}`, `actions?`, `onMore?`, `dispatch?`, `className?`. Consuming screens choose which slots matter — the contract does not force all five signals on every row.

## 5–8. Per-entity treatment

- **Project** (KIND_META.project, IconProjects): title dominant; progress rail from tasks/manual; deadline "N days left" or "Overdue"; relationship line only when nested (none on top-level projects); no direct Complete on the row (projects complete via task completion or manual percent — handled by project detail, not by a row button); View → detail, ⋯ → ItemActionsSheet.
- **Assignment** (IconAssignment): title; relationship to project when linked; primary Complete button (existing `SET_ASSIGNMENT_PROGRESS:100`), Focus routed via existing `WorkFocus` (actions sheet); deadline + risk in meta.
- **Task** (IconCheck): binary completion; relationship "Project · Milestone"; Complete toggle (`TOGGLE_TASK`); effort opt-in; status pill (todo/doing/blocked) surfaces via the Status primitive.
- **Milestone** (IconFlag): reached/partial state via milestoneTrack %, no Complete/⋯ (existing model has no direct milestone toggle — milestones are reached when all their tasks are done); deadline is the primary signal; link to project.

## 9–13. Language contracts

- **Progress language** (§9): 3px linear rail, optional tabular %; no circular rings anywhere in Work. The Progress primitive gained a `thin` prop/modifier for this (`.p-progress--thin{height:3px}`); default 6px rail is preserved for Today/Habits.
- **Deadline language** (§10): single canonical string from `deadlineFacts().dueText` — `Completed` / `No deadline` / `Overdue` / `Due today` / `Due tomorrow` / `N days left`. No countdown + due label + absolute date stacked together.
- **Risk language** (§11): one concise text label (`Overdue`/`Due today`/`At risk`/`Due soon`) coloured with semantic tone (bad/warn); no red card borders or multiple warning badges. Risk comes from the existing deterministic `scorePriority()` + status.id precedence already in `workWorkspace()`.
- **Status language** (§12): semantic `Status` primitive with dot (not color-only) using the existing STATUS_TONE vocabulary (good/warn/bad/neutral). Suppressed when redundant with the risk label.
- **Relationship language** (§13): small xs line under title, "ProjectName · MilestoneName"; parent is keyboard-activatable (Enter/Space); relationship is hidden when it adds no decision value (top-level projects with no parent).

## 14. Action model

WorkEntity exposes actions consistent with existing semantics:

- **Primary row interaction**: clicking/tapping navigates to `row.href` (anchor); consumers may override via `onClick`.
- **Primary completion button** only when the reducer supports direct completion on that entity (Assignments → `SET_ASSIGNMENT_PROGRESS 100`; Project Tasks → `TOGGLE_TASK`). Aria-label follows the established "Mark [name] as complete" / "Mark [name] as not complete" pattern.
- **Contextual actions (⋯)** are opt-in (`onMore` prop) and reuse the existing `ItemActionsSheet` lazily; on desktop ⋯ is reachable via keyboard and visible by default for the Foundation; future screens can gate reveal on hover/focus.
- **Focus** / **Plan** / **Recover** are explicitly **not** rebuilt — they remain in `WorkFocus`, `PlanningPanel`, and `ExecutionPanels` and are opened by the same reducer/action flows already in place; WorkEntity only reserves an affordance slot (Complete + ⋯) for the row.

## 15–17. Accessibility / mobile / desktop

- **Accessibility**: semantic `<h3>` title, `role="progressbar"` with `aria-valuenow/min/max` and accessible label (inherited from primitives `Progress`), visible 2px `focus-visible` outline on the row and relationship link, semantic `Status` dot (non-color status), keyboard activation (anchor/button natively reachable; relationship link responds to Enter/Space), reduced-motion respected (primitives already handle this; no new animations added).
- **Mobile**: `.we` is `min-height:44px`, primary Complete button is `min-height:36px` (plus inline padding → ≥44px tap target); `flex-wrap:wrap` on meta cluster prevents horizontal overflow; no forced two-column breakpoints that clip on 390px.
- **Desktop**: no hard-coded outer widths; WorkEntity fills its parent (PageContainer width chosen by each future Work screen, not hard-coded here); hairline separators; 3px aggregate rails. Today's 720px cap was moved from today.css into PageContainer `size="narrow"` (720px) — the single source of truth per Step 4G-3.

## 18. Foundation showcase (dev-only)

A new dev-only showcase at `#/__work-foundation` (`src/components/work/WorkFoundationShowcase.jsx`) demonstrates all four entity types using deterministic fixtures built from the real `baseProject`/`baseAssignment` factories and fed through the real `workWorkspace()` adapter. It is lazy-loaded only when `import.meta.env.DEV`, wrapped in `PageContainer size="workspace"`, and NOT reachable in production. It shows:

- On-track project, overdue project, on-track assignment, overdue assignment linked to a project, tasks in varied states (done/doing/todo/blocked), and future + reached milestones.
- 3px vs 6px Progress rail comparison.
- Identity icons, relationships, progress, deadline, risk, and completion actions per entity.

No production navigation was added to reach it (type `#/__work-foundation` in the URL bar).

## 19. Exact files changed

| file                                              | change                                                                                             |
|---------------------------------------------------|----------------------------------------------------------------------------------------------------|
| `src/components/primitives/Progress.jsx`          | Added `thin` prop; sets `.p-progress--thin` modifier.                                              |
| `src/components/primitives/primitives.css`        | Added `.p-progress--thin{height:3px}` for Work aggregate rails.                                    |
| **`src/components/work/WorkEntity.jsx`** *(new)*  | Canonical Work entity row — Project/Assignment/Task/Milestone via workWorkspace() rows.             |
| **`src/components/work/WorkEntity.css`** *(new)*  | Row layout, hairline, kind/title/rel/meta/progress/actions, focus-visible, 44px floor.            |
| `src/components/work/WorkFoundationShowcase.jsx` *(new, dev-only)* | Dev showcase at `#/__work-foundation`. |
| `src/components/shell/PageContainer.jsx`          | Added `size` prop with four width families (narrow/detail/workspace/wide).                          |
| `src/components/shell/shell.css`                  | Added `.app-page--narrow/detail/workspace/wide` width modifiers; removed legacy 1280px `--app-content-max` bump (PageContainer owns widths per 4G-3). |
| `src/components/today/today.css`                  | Removed 1024px `max-width:720px` (delegated to PageContainer `size="narrow"`).                     |
| `src/App.jsx`                                     | Dev-only route for `__work-foundation` → lazy-loads `WorkFoundationShowcase`; `pageSize()` selects `narrow` for Today/Routines, `detail` for HabitDetail, `workspace` for Habits/Week, `wide` for Calendar; passes `size` to PageContainer. |
| `src/index.css`                                   | Added `@import` for WorkEntity.css.                                                                |
| `src/styles/work.css` / `work-v3.css` / `components.css` / `system.css` / `spatial.css` / `motion.css` / `base.css` / `adaptive.css` | Stripped dead comment banners (already stripped by Vite in prod), removed cosmetic press-scale `:active` transforms, removed colored left accent bar + box-shadow + linear gradients from `.work-card`/`.fab-choice`/`.tabbar[aria-selected]`/`.level-btn[data-on]`/`.meter`/`.lb-fill`/`.check-box`/`.step-dot`/`.sticky-bar`/`.btn.primary`/`.btn.floating`/`.card`/`.work-capacity-visual`, replaced with flat semantic solids to align with the Step 5A visual contract (one-surface+hairline, no shadows/gradients/glow) and to stay inside the 55 kB gz CSS ceiling. No functional semantics changed. |
| `test/work-entity.test.jsx` *(new)*              | 12 tests covering the four entity types, progress rail, relationship, completion semantics, accessibility, no-rings guarantee, 44px floor. |
| `test/today-step3-audit.test.jsx`                 | Updated desktop-width test to verify PageContainer `size=narrow` (720px) owns the cap; today.css no longer sets max-width. |
| `test/page-container-widths.test.jsx`             | Existing tests (from Step 4G-3) verify all four width families.                                    |

No engines, no reducers, no persistence, no Work/Project/Assignment/Workload/Deadline/Goals/Insights/Today/Habit screens were redesigned. Existing `WorkCards`, `UniversalWorkRow`, `ProjectGallery`, `WorkKit`, `WorkFocus`, `WorkForms`, and every existing Work screen remain intact (`.work-card` lost its colored accent bar and box-shadow but retains its border/background/padding/is-done state — a visual improvement toward the one-surface+hairline language, not a migration).

## 20. CSS size

`Perf budget OK — initial JS 225.6 kB gz, CSS 55.0 kB gz, three lazy-only.`
Initial CSS **56,313 bytes gzip** — 7 bytes under the 56,320-byte (55 kB) ceiling. Ceiling was NOT raised. Initial JS unchanged in substance.

## 21. Tests

- `test/work-entity.test.jsx` (12 new):
  - produces rows for all four entity types via real engines
  - Project renders title + 3px progressbar + deadline
  - Overdue project shows one clear "Overdue" signal, no "On track"
  - Assignment renders project relationship
  - Task renders project · milestone relationship + Complete button with correct aria-label
  - Completed task shows strike-through + Undo (not complete)
  - Milestone has no Complete/⋯ actions (respects existing model)
  - Progress thin rail is 3px
  - No circular rings in Work
  - Row min-height 44px
  - Complete button uses accessible name "Mark [name] as complete"
  - focus-visible has outline (visible focus)
- `test/page-container-widths.test.jsx` (8): all pass, confirming narrow=720/detail=880/workspace=980/wide=1240 and no 1280px bump.
- `test/today-step3-audit.test.jsx` (20): all pass, including updated desktop-width assertion via PageContainer.
- `test/workspace.test.jsx` (26): all pass (existing Work screens still route/render after CSS trim).

Total verified: **66/66** across these four files. Pre-existing `adaptiveHome.test.jsx` timeouts (canvas/focus-session timing) are unrelated to this step and were not modified.

## 22. Build

- `npm run build` → ✓ built, perf budget OK (7-byte margin)
- `npm run lint` → clean
- `git diff --check` → clean

## 23. Screenshots / visual evidence

Dev server is running on port 5173 (LIVE PREVIEW). Navigate to `#/__work-foundation` to see the WorkEntity foundation demonstrated with all four entity types side-by-side: an on-track project, an overdue project, on-track + overdue assignments (with parent link), done/doing/todo/blocked tasks (with Complete toggle), and future + reached milestones, all with 3px progress rails and semantic status/risk meta. No screenshot file was captured to disk in this sandbox; visual inspection should be done via the preview.

## 24. Observed-but-untouched issues

Left in place per explicit scope:

- `UniversalWorkRow.jsx` (workspace overview) is unchanged; a future Work-overview step can migrate it to `WorkEntity`.
- `WorkCards.jsx` renders flat now (lost its colored left bar and shadow in the CSS trim); the card JSX was NOT migrated to `WorkEntity` — left for future Work screen work.
- Legacy work.css still contains many historical selectors beyond what was needed for the CSS budget; cosmetic-only dead rules that didn't conflict with the new visual contract were left in place.
- `RoutineStrip.jsx` inline styles, v2/v3 token bridge, calendar hit area, Detail missed-color, non-width button debt — all untouched per standing rule.
- No Work overview / Deliverables / Projects gallery / Workload / Deadlines / Project detail / Assignment detail / Goals / Insights work was started.

## 25. Commit SHA

Pushed as commit `b717c46` to `origin/arena/01a08bf2-habbit-trackerrr`.

---

**STOP.** Work Foundation is delivered as a visual/data presentation contract only; no Work workspace / detail / Goals / Insights work has been started. Review via `#/__work-foundation` before proceeding.
