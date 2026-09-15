# Step 5H — Work Assignment Detail (`#/assignments/:id`) — QA Report

**Date:** 2026-09-08
**Commit:** see git log
**Spec section:** Work, Step 5H — Work Assignment Detail screen (standalone redesign).

## What changed
- Redesigned `src/screens/AssignmentDetailScreen.jsx` to match the premium focused-execution language established in Step 5G (Project Detail), but smaller and more focused.
- Replaced the old `screen-head` + oversized `.assignment-detail-hero` (with `DeadlineHero` and `MeterRow`) with a compact `.dlv` surface:
  - **Eyebrow/back:** "Work ◀" link to `#/work?view=deliverables`.
  - **Kind/status line:** `KindTag` + `StatusPill` + "High priority" chip (only when priority=high).
  - **Title:** h1 at 1.75rem (slightly smaller than Project Detail's 2rem) as the dominant anchor.
  - **Sub:** subject · **Deadline:** date+time countdown · project name.
  - **Header actions:** `.wo__head-actions-inline` with ghost Edit and Delete icon buttons.
  - **Snapshot pills** `.dlv__snap`: Progress (%), Due/countdown, Subtasks (done/total), Estimate — 4 real metrics only, no fabricated counts.
  - **Single compact pulse viz** `.dlv__pulse` — 14h progress rail with good/bad/accent color fill and a dashed pace tick at `elapsedPct%`, plus countdown indicator on the right, progress/pace/countdown legends, "remaining/estimate/subs" caption, and existing `QuickProgress` `<details>` kept.
  - **"Needs attention" surface** (`.dlv__focus`) shown only when real deterministic risk: `!complete && (status.id==='overdue' || status.id==='urgent' || behind>15)` — 3px bad left border, no giant red cards/flashing.
- **Next action** section restyled to Work uppercase eyebrow heading (`Next action`), with deadline line above, next-subtask or "Make progress" text, flex-wrap Start Focus + project link.
- **Body preserved** (no functionality removed): Subtasks SectionCard with sync-toggle + Framer-motion Reorder SubtaskRow + add-sub form; Forecast/pressure `DeadlinePressure`; lazy `<details>` `AssignmentAnalytics`; Notes textarea; rail aside with Details kv, "Change deadline" `AssignmentDeadlineField`, link-project select, Completion record history.
- **Context links:** back to Deliverables eyebrow, Project link (`#/projects/:id`) in both Next action and rail Details, Change deadline editor (existing). No Deliverable link — inspection confirmed assignments have no deliverable FK (`projectId` only); per Spec §10 we do not fabricate.
- Removed unused imports (`MeterRow`, `DeadlineHero`).
- **CSS changes:** zero — all new styles applied as inline style props reusing existing `.dlv*` / `.wo*` / `.detail-layout` / `.rail` / `.kv` / `.pad` classes. CSS gz stays at baseline.
- **Tests:** added `test/work-assignment-detail-5h.test.jsx` (10 tests: eyebrow+title+pills render, single pulse viz no rings, real % snapshot, Start Focus + project link, Edit/Delete actions remain, deep link to #/projects/p1, Subtasks + Add button, back-to-deliverables link, mobile stack CSS presence + no alert cards, completed state hides Start Focus).

## Data / selectors reused (no new data layer)
- `assignmentStatus`, `assignmentProgress`, `timeVsWork` (`src/lib/work.js`)
- `assignmentPace` (`src/lib/adaptive.js`)
- `assignmentPressure`, `itemHistory`, `PRIORITIES` (`src/lib/work.js`)
- `KindTag`, `StatusPill`, `QuickProgress`, `WorkFocus` (`src/components/work/`)
- `SectionCard`, `CardHead`, `Button`, `IconButton`, `DeadlinePressure`, `DeadlineHero` no longer needed
- Existing `work.editAssignment`, `work.deleteAssignment`, `work.setAssignmentProgress`, `work.toggleSubtask`, Framer `Reorder` drag
- Focus portal (`WorkFocus`) as sibling to `.screen` (implicit via component render)

## No regressions (140/140)
- All Work 5A–5G tests, workspace, page-container-widths, today-step3 audits pass.
- Existing `workspace.test.jsx` journey "opens a deliverable detail with deadline/progress before subtasks" continues to pass — "Deadline" now appears in Next-action pre-line, ensuring Deadline text precedes the "Next action" heading.

## Lint / build / CSS
- `npm run lint`: clean.
- `git diff --check`: clean.
- `npm run build`: **Perf budget OK — initial JS 225.1 kB gz, CSS 55.0 kB gz, three lazy-only.**
- **CSS gz = 55,987 bytes** — zero new bytes, 333-byte margin preserved under the 56,320 hard ceiling (not raised).

## Visual QA checklist
- [x] Sibling of Project Detail 5G (same typography scale family, `.dlv`/`.wo` token classes, snapshot pills, 3px rail semantics, tone palette, depth via existing tokens) — smaller (1.75rem vs 2rem title, 4 pills vs 5, no milestones block because assignments don't have them).
- [x] Assignment immediately understandable: title dominant, kind/status/priority, subject + deadline + project sub, progress pills, single pulse viz.
- [x] Next action quick: deadline line, 1-sentence "what's next", Start Focus primary, project link inline.
- [x] Deadline pressure obvious: snapshot Due pill, deadline line in Next-action section (bad tone when overdue), pulse rail with pace tick + countdown indicator, Forecast/pressure card, "Needs attention" only when real risk.
- [x] Premium but restrained: no decorative gradients, no habit rings, no chart dashboard, no alert banners.
- [x] Mobile single column via existing `.detail-layout` media query; ≥44px targets (Start Focus, Add subtask, deadline selector); title readable.
- [x] Other surfaces NOT redesigned: Overview/Deliverables/Projects/Workload/Deadlines/Project Detail/Goals/Insights/Today/Habits untouched.

## STOP
Per Spec §19, halting after Assignment Detail. No Goals/Insights work started.
