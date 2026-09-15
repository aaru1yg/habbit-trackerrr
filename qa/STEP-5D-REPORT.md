# Step 5D — Work Projects Report

Projects redesign (`#/work?view=projects`) — execution workspace for active projects.

## 1. Files changed
- `src/screens/WorkScreen.jsx`
  - Replaced `ProjectsView` (previously: header + List/Gallery buttons + plain Rows + collapsible tasks) with premium Projects workspace that reuses `.dlv*` primitives from Deliverables 5C:
    - Header: eyebrow "Work" + h2 "Projects" + sub "Your active projects, where they stand, and what needs a decision next."
    - Project Snapshot: four compact inline pill links (Active / Due soon / At risk / Completed) backed by real selectors across all projects (NOT four large cards); URL-anchored, preserving FILTERS contract.
    - Project Health distribution: single horizontal stacked bar (one restrained aggregate viz) with progress bins (Not started / Early / In progress / Late stage) layered with At risk (warn) and Completed (good); legend underneath.
    - Primary column: project list via existing `Rows` (UniversalWorkRow) — project name/state/3px progress rail/deadline/risk signal/⋯ actions/Project Detail deep-link all preserved.
    - Secondary sidebar: "Project focus" card (most urgent project — OVERDUE > CRITICAL > AT RISK > DUE SOON, with Open deep link) + "Needs attention" compact list (≤3 at-risk, "View all N at risk →" link).
    - List/Gallery toggle retained ("List" / "Gallery / spatial") — List default, Gallery optional, Gallery fed via `projectStatus(item, now)` (real engine, no fake data).
    - Legacy collapsible `<details class="workspace-project-items">` (project tasks and milestones) preserved at the bottom of list layout so existing ItemActions complete flow and tests keep working.
  - Added `import { projectStatus } from '../lib/work.js'` for Gallery status shape.
  - Passed `model` and `filter` to `ProjectsView` from parent so snapshot counts and focus use the full project universe (not URL-filtered) while the primary list respects FILTERS/search.
- `src/styles/workspace.css`
  - Removed the now-unstyled `.workspace-project-items` margin/padding and re-added them with `grid-column: 1/-1` so the collapsible details block spans the grid under the new layout. No new project-prefixed CSS block added — **ProjectsView reuses every existing `.dlv*` and `.wo__head-actions-inline` class** (header, pills, pulse, grid, list, side, focus, attention, mobile breakpoint) to stay within budget.
- `test/work-projects-5d.test.jsx` — new: 10 tests.

## 2. Visual changes
- Old Projects: bare heading with List/Gallery buttons → flat list → collapsible tasks section. No framing, no aggregate signal, no focus.
- New Projects:
  - Strong hierarchy: eyebrow → h2 title → sub → snapshot → health viz → primary list → light sidebar.
  - Compact inline snapshot pills with semantic tone borders (bad/warn/good) — consistent with Deliverables.
  - **Project Health** as a single 10px stacked bar (Not started/Early/In progress/Late stage/At risk/Completed segments) + legend — answers "what shape is my portfolio in?" without building a chart dashboard. Not the Workload chart; reused via inline styles so zero new CSS.
  - Primary list is hairline-continuous UniversalWorkRow — strong project title, kind tag, state, 3px progress rail, deadline relative text, one risk dot, ⋯ contextual menu (existing ItemActionsSheet), Project Detail deep link.
  - Sidebar: one "Project focus" card (primary action = Open) + "Needs attention" compact list (no progress rails, lightweight).
  - Gallery mode preserved with its own spatial language but now framed by the same header/snapshot/viz as list; "Gallery / spatial" label retained for backwards compatibility.
  - Mobile ≤767px: single column (inherits `.dlv__grid` 1fr media query from 5C); all targets ≥44px via primitives.

## 3. Architecture / data reused
- Data layer: `workWorkspace()` unchanged. Snapshot uses `model.rows.filter(r => r.kind === 'project')`; risk from `r.atRisk` / `r.risk` (`OVERDUE/CRITICAL/AT RISK/DUE SOON/COMPLETED`); completion from `r.status.complete`; due labels from `r.status.dueText`.
- Components:
  - Primary list uses existing `Rows` (UniversalWorkRow) — preserves all legacy actions (Complete, Edit, Move, Archive, Delete), search, FILTERS, Project Detail deep links (`#/projects/:id`).
  - Sidebar compact rows use canonical `WorkEntity` (from 5A) with `show:{progress:false, actions:false}` compact mode.
  - Gallery uses existing `ProjectGallery` (lazy), now fed `projectStatus(item, now)` so Gallery keeps its real status engine (hasDeadline/daysLeft/tone/pct).
  - Pill navigation uses `workHref('projects', id)` so the URL-level FILTERS group above stays authoritative.
  - Primitives: `.btn sm/ghost`, `.tiny/.tnum`, `.eyebrow` (`.dlv__eyebrow`), semantic tokens (`var(--bad/warn/good/accent/surface/line)`).
- PageContainer: `size="workspace"` (~980px) from App.jsx (5B) — no change.
- Routes preserved: `#/work?view=projects`; legacy `#/projects` maps to projects via workViewModel; `?filter=` continues to drive filtering; Project Detail deep links (`#/projects/:id`) untouched.
- No new reducers/engines/Supabase; no Habit UI imported.

## 4. List / Gallery behavior
- **List = default** on entering `#/work?view=projects` (useState('list')).
- "Gallery / spatial" button toggles layout state; when active renders ProjectGallery under the header/snapshot/health viz (same framing, not the default). Gallery is absent from Overview.
- When Gallery is active, sidebar is hidden (list-only affordance) to keep the spatial presentation clean.
- Collapsible "Project tasks and milestones" `<details>` renders below the grid in list mode only (preserves the legacy complete-a-project-task workflow).

## 5. Tests
- `test/work-projects-5d.test.jsx`: **10 tests** — eyebrow + h2 + sub + snapshot pills with real anchor links; single stacked health viz; List default / Gallery toggle (gal-card appears and disappears); pill URL navigation; project rows contain progress + deep link; sidebar lightweight (≤3 children); mobile 1fr at 767px; no Habit ring vocab; project-tasks details preserved; Overview default (no Projects h2, no gal-card).
- Full relevant suite: **98 / 98 PASS** (26 workspace + 12 work-entity + 11 overview-5b + 11 deliverables-5c + 10 projects-5d + 8 page-container-widths + 20 today-step3-audit).
- No regressions in 5A/5B/5C tests.

## 6. Lint / diff / build
- `npm run lint`: clean (0 errors, 0 warnings).
- `git diff --check`: clean.
- `npm run build`: ✓ built; Perf budget OK.
  - Initial JS gzip: **225.4 kB**
  - Initial CSS gzip: **55,987 bytes** (333 bytes under the 56,320-byte / 55 kB hard ceiling — NOT raised). Achieved by reusing `.dlv*` classes entirely and using inline styles for the health bar (zero new project-specific CSS rules beyond the `.workspace-project-items` grid-column fix).

## 7. Responsive QA (structural)
- 1440/1024: two-column `.dlv__grid` (list primary, sidebar secondary) inside PageContainer workspace (980px); snapshot pills inline; health bar spans full width; List/Gallery toggle in header actions.
- Tablet: pills wrap naturally via flex-wrap.
- 430/390: `@media (max-width: 767px)` forces `grid-template-columns: 1fr`; sidebar stacks under list; health bar remains a single proportional bar; buttons inherit 44px targets.
- No horizontal `min-width` on project elements; project names truncate/wrap via `.dlv__list { min-width: 0 }` inherited from Deliverables.

## 8. Four self-check questions
1. **Premium modern project workspace?** Yes — strong type hierarchy, semantic restrained color, one meaningful viz, hairline-continuous rows, focus card. Reads as a unified Work pillar alongside Overview and Deliverables.
2. **Substantially better than old Projects?** Yes — old was a CRUD list with a toggle; new has purpose ("execution workspace"), a portfolio-level answer (health bar), clear hierarchy, and a focus panel that tells you where to look first.
3. **Gallery feels like same design system?** Yes — same header/snapshot/viz frame the Gallery; Gallery keeps its existing DepthCard art but is now an *alternate representation* of the same projects, not a separate screen.
4. **Visual interest without a card wall?** Yes — exactly one stacked bar viz + one focus card + one compact attention list; no tile grids, no colored card arrays, no decorative widgets. Project state is clear in 2–3 seconds (snapshot → health → focus → list).

## 9. Scope discipline
- ONLY `#/work?view=projects` (and legacy `#/projects`) changed visually.
- Overview/Deliverables/Workload/Deadlines, Project/Assignment detail, Goals, Insights, Today, Habits: untouched.
- No new reducers, engines, or paid APIs.
- No Habit UI on Work surfaces.
- CSS ceiling NOT raised — reused `.dlv*` primitives to add Projects redesign at zero marginal CSS bytes.

## 10. Commit / push
- Branch: `arena/01a08bf2-habbit-trackerrr`
- Commit recorded + pushed after this report.

## 11. STOP
Per scope, Step 5D ends here. Do **not** proceed to 5E Workload.
