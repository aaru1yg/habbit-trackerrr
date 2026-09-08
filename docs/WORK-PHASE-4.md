# Phase 4 — Unified Work workspace

## Audit of the checkout

Audited `9fd085dc81af613f8b59c44c5519861dc99966d4` before implementing.

- `#/projects`: ProjectsScreen, gallery-first, its own summary/filter/analytics controls.
- `#/assignments`: AssignmentsScreen, another summary, risk/pressure cards and analytics.
- `#/workload`: WorkloadScreen, repeated overdue, priority, capacity, lane and load presentations.
- `#/timeline`: TimelineScreen, parent-project and assignment deadlines by date.
- No `#/work` destination. The mobile Work link opened Projects. The checked-out shell still had Today/Calendar/Work/Insights rather than the brief's five primary destinations.
- Project detail put the large progress object, forecast and visual track ahead of milestones/tasks.
- Assignment detail put a countdown/progress hero ahead of subtasks; this checkout did not have a contextual Focus entry point there.

### Authoritative systems located and retained

| Concern | Existing source used |
| --- | --- |
| Progress/status | `work.js`: projectStatus, assignmentStatus, projectProgress, assignmentProgress, milestoneTrack |
| Risk and next action | `adaptive.js`: scorePriority/deadlineRisk, getNextBestAction |
| Capacity | `adaptive.js`: workloadByDay → workloadCapacity; underlying work.js workloadSeries |
| Deadline chronology | `work.js`: deadlineTimeline; calendarMarkers for dated project tasks/milestones, which deadlineTimeline does not emit |
| Forecast/pace/analytics | projectForecast, assignmentPace, assignmentPressure, existing project and assignment analytics |
| Plan/recover/focus | `planning.js`; existing PlanningPanel and FocusMode |
| Actions | `commandActions.js`: itemActions/resolveItem; ItemActionsSheet, WorkUIProvider and existing reducers |
| Search/preferences | Existing matchesQuery and Omni/Search; personalization.js preferencesOf |

Also inspected goals.js and analytics.js. Their engines and destination screens were not changed. No second search, deadline, workload, risk or priority engine was introduced.

## Delivered composition

1. **Old structure:** Four top-level work surfaces with duplicate dashboards and a gallery-first entry point (above).
2. **New structure:** Lazy `WorkScreen` with Overview, Deliverables, Projects, Workload and Deadlines. Canonical URLs are `#/work` and `#/work?view=…`. Compact filters are URL-backed (`filter=all|risk|soon|overdue|active|completed`). `horizon=today|tomorrow|3|7` is a linkable deadline filter. Overview summary drilldowns expose a unified all-work list, not just projects.
3. **Projects:** Compact list by default, optional lazy Gallery / spatial mode using the existing ProjectGallery. Tasks and milestones are available in a disclosure and open automatically when only child work matches. Project detail now leads with status and next work, then milestones/tasks, forecast and optional analytics/visual track. Burndown, pace, history, task editing/reordering, notes and linked habits remain available. Real linked deliverables are visible. Task/milestone query links focus the original project detail controls.
4. **Deliverables:** Assignment records remain unchanged. Rows show title, deadline, source-derived progress, remaining effort, risk, real project relationship and actions. Assignment detail leads with deadline, progress and next action; subtasks precede pressure/forecast, optional progress/velocity analytics and details. Start Focus names the chosen assignment rather than recommending a different one.
5. **Workload:** Available, Committed and Remaining for the selected day, seven selectable day cells, then contributors. Values are passed through from workloadByDay, not recomputed with a competing model. Missing capacity links to Settings. Unknown estimates are explicitly described as uncounted.
6. **Deadlines:** Chronological original references, grouped Overdue / Today / Tomorrow / This week / Later. Week grouping uses the existing Monday-based week helper; the 3/7-day horizons are explicitly rolling calendar-day windows. Parent deadlines still come from deadlineTimeline. Child dates come from calendarMarkers, deduplicated by typed identity. No copied deadlines are persisted.
7. **Risk consolidation:** One presentation adapter joins existing status/risk outputs with explicit display precedence. Completed/archived work is excluded from attention. Overdue, critical, at-risk and due-soon context is centralized. Calendar-only task/milestone dates are normalized to end-of-local-day before calling the existing timestamp-based risk selector, matching work.js date semantics. Overload is one explanation with contributor types/names and Plan/Recover, not four warning cards.
8. **Universal work row:** Shared compact pattern for projects, assignments, project tasks and milestones. Text type indicators, progress meter, deadline/effort/risk, direct View and appropriate Focus/Complete actions. Overflow actions use ItemActionsSheet. Assignment Edit/Move open existing forms; task Edit/Move open the actual task editor. Delete retains confirmation/undo; Archive requires confirmation. Milestones have no fabricated bulk-complete action: their original task/anchor semantics remain authoritative.
9. **Mobile:** Scoped single-column structure at mobile widths, wrapping navigation/filters and long titles, touch-sized controls, compact heading/summary and active work before secondary content. Target viewports in browser QA: 390×844 and 430×932. Visual/fold/overflow measurements remain **unverified locally** because Chromium could not launch.
10. **Desktop:** Shared Work navigation stays visible, with a two-column overview for active work/attention, workload snapshot/due horizons and recent work. Project and assignment details retain readable fact rails. Target browser QA viewport: 1440×900. No gallery is mounted by default.
11. **Accessibility:** Real navigation links and aria-current, native button groups with aria-pressed, labelled search, descriptive row buttons, headings, visible focus and reduced-motion CSS. Existing Sheet handles dialog labelling, Escape, focus trap and restoration. Project task/milestone deep links move keyboard focus into detail. No nested links/buttons in rows.
12. **Performance:** Baseline production initial JS **234.6 KiB gzip**, CSS **38.3 KiB**. Phase 4 initial JS **233.2 KiB gzip**, CSS **38.3 KiB** (build-proof passes the unchanged 236/42 KiB budgets). Work CSS is route-loaded. ProjectGallery, ProjectTrack and extracted detail analytics are lazy. Analytics Lab / three.js are not newly loaded by Work. No new dependencies.
13. **Tests:** Existing unit/integration cases retained, with obsolete navigation/presentation assertions updated. Added 26 Work cases covering canonical/query/legacy routes, view switching, overview, deterministic aggregation, local date horizons, source workload equality, filters/search, empty/completed/overloaded states, universal rows, real task/detail/focus journeys, Edit/Move/Archive/Delete/Undo and keyboard/responsive contracts. Final results: `npm test` — **836 passed, 43 files**; `npm run lint` — **passed, zero warnings**; `npm run build` — **passed**; `npm run test:schema` — **28 passed**; `git diff --check` — **passed**.
14. **E2E:** Added `npm run test:e2e:work` (A–E journeys and target viewport assertions), integrated into the existing CI browser job. Updated affected original E2E/release navigation checks and added canonical routes to layout/contrast sweeps. **Local execution blocked:** bundled `/tmp/chromium` exits 127 because `libnspr4.so` is missing. Attempting to install the browser libraries was blocked by unavailable Debian package mirrors. No screenshot, contrast, live-browser accessibility, or viewport pass is claimed. CI has not been triggered in this local-only phase.
15. **Commit:** Recorded in the final agent report / `git log -1`; work remains on `arena/01a08091-habbit-trackerrr`. No push, merge or deployment.
16. **Phase 5:** Not started. Today, Habits, Goals, Insights, Calendar internals, analytics engines, database schemas, Supabase/RLS and sync remain outside this phase. Follow the next phase's brief rather than assuming its scope. Outstanding Phase 4 validation is a successful Chromium/CI run and visual sign-off at the three target sizes; that is not silently reclassified as Phase 5.

## Guardrails and known source limitations

- `workViewModel.js` is a **read-only presentation join**, not a persisted unified entity or replacement intelligence engine. Typed identities keep Project and Assignment separate.
- Workload retains the existing engine's deadline-based commitments, including parent/task estimate overlap where both have estimates. The UI labels this model and does not pretend it is a scheduled-time budget. No new workload arithmetic is substituted.
- Forecasts stay conservative: the existing project forecast needs velocity evidence; when it cannot project a date the UI says “Not enough history,” rather than fabricating one.
- Parent/project, assignment explicit/subtask, task and milestone completion models remain distinct. A universal work row is a display/action pattern, not a universal completion formula.
- npm installation reported five pre-existing dependency advisories (3 moderate, 1 high, 1 critical). Dependency remediation is not part of this UX-only patch; no forced dependency upgrades were made.
