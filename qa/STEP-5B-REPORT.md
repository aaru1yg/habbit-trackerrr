# Step 5B Report — Work Overview (Execution Workspace)

Date: 2026-09-13
Branch: `arena/01a08bf2-habbit-trackerrr`

## 1. Old Work Overview problems (audited)

- The previous Overview mixed four competing things: summary metric **cards** (3 at-a-glance tiles), the **WorkCapacitySeries** chart (a 390px-tall capacity visualization), "Active work" showing `UniversalWorkRow` card-surfaced rows, a "Needs attention" strip, a "Due soon" *card grid* (horizons), a "Workload snapshot" *card*, and a "Recent/upcoming" card. It answered five questions at once.
- The Active Work list was capped at 2 items and linked to "View all work" — the first thing the eye saw was metric cards and a chart, not the work itself.
- Project cards used `.work-card` (colored 3px left accent bar, `box-shadow`, gradient primary button) — visually louder than the rest of Habit OS.
- `WorkTabs` lived in `Navigation.jsx`; the page had no PageContainer width class so it inherited the legacy `.workspace{max-width:1240px}` rule, not the canonical 980px workspace family.
- The default #/work view pulled in the chart CSS (`work-v3.css` trend chart, radial-gradient backgrounds), inflating initial CSS cost.
- Completed work was mixed in with Active and only reachable via a Completed toggle *inside* the Active Work section; there was no single clear attention list (overdue/critical/at-risk each competed visually).
- Empty state was a `.card pad` block with the headline "Your work starts here." and a Create button; there was no secondary planning action.

## 2. New hierarchy

`#/work` now follows the IA contract:

1. **Header** (page shell `screen-head`) — h1 "Work" + supporting line "What deserves your attention right now." + New work / Create project actions.
2. **Segmented tabs** (`nav[aria-label="Work sections"]`) — Overview / Deliverables / Projects / Workload / Deadlines, all addressable via `#/work?view=…`.
3. **Work Snapshot** (`.wo__snapshot[aria-label="Work summary"]`) — inline pills: `8 active · 6 due soon · 4 need attention · 2h 30m over today`, each a link to the filtered view.
4. **Active Work** (`.wo__active h2 "Active work"`) — canonical `WorkEntity` rows (Step 5A), 3px thin progress rails, hairline-separated; top 7 rows with a "View all" link and an Active/Completed toggle.
5. **Needs attention** (`.wo__attention` sidebar) — ONE list of `WorkEntity` rows sorted OVERDUE → CRITICAL → AT RISK, each using existing risk semantics; no red cards, no double badge, no per-condition banners.
6. **Coming up** (`.wo__coming` sidebar) — compact Today/Tomorrow/This week count rows linking to the Deadlines view; no full timeline.
7. **Workload snapshot** (`.wo__cap-block`) — single line with remaining capacity + link to Workload; NOT the full WorkCapacitySeries chart (that stays on the Workload contextual view).

When overloaded, the existing Overload banner (`.workspace-overload`) still fires Plan/Recover — preserved verbatim from the prior WorkOverview.

## 3. Snapshot

Four inline pills (link chips) drawn from real selectors in `workWorkspace()`: active count, due-soon count (next 7 days), need-attention count (OVERDUE/CRITICAL/AT RISK), and today's remaining minutes from `workloadByDay()`. Pills use semantic borders (`.is-warn` / `.is-bad`) only when there is overdue/critical/overload signal — never four colored card backgrounds. The snapshot is `role="group"` with `aria-label="Work summary"`, reachable via the Accessibility API.

## 4. Active Work

Uses **WorkEntity** (Step 5A canonical entity) directly, not `UniversalWorkRow`. The row show-prop chooses the right slots: kind icon, title, relationship line ("Project · Milestone"), status pill, deadline, one risk label, 3px thin progress rail, percent, Complete button when the reducer supports it, and an `⋯` that lazily opens the existing `ItemActionsSheet`. Top 7 items shown, with "View all active/completed work (n)" link to the existing filtered view; the Active/Completed toggle sits next to the section heading (same pattern Today uses).

## 5. Attention

One section, one list, no multiple banners. Deterministic ordering from `scorePriority()` + `projectStatus/assignmentStatus` (the same attentionOrder the model already used): OVERDUE → CRITICAL → AT RISK, capped at 5. Uses compact WorkEntity (progress rail hidden via `show.progress:false`, kind icon hidden via `show.kind:false`) so titles are the focus. Risk color is the semantic `data-tone` on `.we-meta__item` — no red backgrounds.

## 6. Coming up

Compact two-column count list under a single "Coming up" heading: Today, Tomorrow, This week (reusing the existing horizon selectors from `workWorkspace().horizons`). Each is a link to `#/work?view=deadlines&horizon=…`; final "View deadlines →" goes to Deadlines. No day-by-day groups, no `.workspace-deadline-group` headings (those remain on the Deadlines view).

## 7. Contextual navigation

`WorkTabsLite` replaces the imported `WorkTabs` (removed from `Navigation.jsx` import chain). Five tabs (Overview/Deliverables/Projects/Workload/Deadlines) preserve the existing `#/work?view=` URLs, `aria-current="page"`, and 44px minimum hit area. Legacy routes (`#/projects`, `#/assignments`, `#/workload`, `#/timeline`) continue to resolve via `LEGACY_WORK_VIEWS` in `workViewModel.js`; no routing architecture was changed.

## 8. Project gallery treatment

Default Overview NEVER renders the ProjectGallery. The Gallery is **only** reachable from the Projects contextual view via the "Gallery / spatial" toggle (default pressed = "List"); the toggle preserves the existing Suspense lazy-load of `ProjectGallery.jsx`. Gallery markup is never mounted on `#/work`, satisfying the "old project gallery must NOT be the default Work Overview" rule.

## 9. WorkEntity usage

All four Work entity types (Project/Assignment/Task/Milestone) render through `WorkEntity` in Active Work and Attention — no `OverviewWorkRow`, `ProjectOverviewCard`, `AttentionCard`, or `DeadlineCard` was introduced. Rows are styled by the Step 5A `.we` / `.we-meta` / `.we-progress` CSS; no parallel visual system.

## 10. Desktop

- `PageContainer size="workspace"` (980px) is applied to `#/work`, `#/projects`, `#/assignments`, `#/workload`, `#/timeline` via App.jsx `pageSize()`.
- `.wo` grid: `minmax(0,1fr) minmax(280px,340px)` two-column at 1440×900, with Active Work in the primary column and Attention/Coming up/Workload snapshot stacked in the secondary column.
- No hard-coded outer widths; the grid inherits from PageContainer.
- First scroll target is Active Work — the header, snapshot, then primary column occupy the left eye-path.

## 11. Mobile

At ≤767px the grid collapses to `grid-template-columns:1fr` with order: header → tabs → snapshot → active → side (Attention → Coming up → Workload tile). No horizontal overflow; `flex-wrap:wrap` on meta and tabbar; all tabs and `.btn`s retain 44px min-height via the existing `.workspace .btn{min-height:44px}` and `.workspace-tabs a{min-height:44px}` rules. Tested with `@media (max-width: 767px)` CSS check in the new 5B test file.

## 12. Accessibility

- Semantic h1 "Work" (always visible, including empty state), h2 "Active work" / "Needs attention" / "Coming up" / "Workload snapshot".
- Segmented nav uses `aria-label="Work sections"` + `aria-current="page"`.
- Snapshot group `role="group" aria-label="Work summary"`, pills are real links with accessible names set via `aria-label` (e.g. "Active work") so screen readers announce the number first.
- WorkEntity retains its Step 5A semantics: `role="progressbar"`, 44px minimum row, visible `:focus-visible`, non-color Status dot, keyboard activation on the parent relation (role=link span, Enter/Space activate).
- Reduced motion: existing `@media (prefers-reduced-motion: reduce)` rule in workspace.css zeroes transitions.

## 13. Performance / CSS

Initial CSS **56,313 bytes gzip** — 7 bytes under the 56,320-byte (55 kB) ceiling. Ceiling not raised.
Offset strategy: removed the old `.workspace-overview` grid + metric cards CSS and `.workspace-summary > a` card styling, replaced with lean inline-chip `.wo__snapshot` + two-column `.wo` grid; removed the colored `.work-card` accent/box-shadow in Step 5A already helped clear headroom for the new `.wo` rules. The full WorkCapacitySeries chart is no longer pulled into the Overview render path (it's still loaded on the Workload tab), so Overview no longer pays the chart CSS cost on first paint.

## 14. CSS size

`Perf budget OK — initial JS 225.4 kB gz, CSS 55.0 kB gz, three lazy-only.`
56,313 / 56,320 bytes — 7-byte margin.

## 15. Exact files changed

| file                                              | change                                                                                                   |
|---------------------------------------------------|----------------------------------------------------------------------------------------------------------|
| **`src/screens/WorkScreen.jsx`**                  | Rewrote WorkOverview composition (Header → Snapshot → Active → Attention → Coming Up → Workload tile); replaced WorkTabs import with lightweight WorkTabsLite; added Active/Completed inline filter; routed PageContainer size via App; EmptyState now uses Step 1B EmptyState primitive with "Your work starts here." title. |
| **`src/styles/workspace.css`**                    | Removed legacy `.workspace-overview/.workspace-summary/.workspace-active/.workspace-attention/.workspace-horizon/.workspace-capacity/.workspace-recent` card-grid rules; added `.wo` composition (grid, head, snapshot, active, side, attention, coming, cap, filters, view-all, mobile 1fr collapse); retained existing .workspace-row / .workspace-filters / overload / projects / deadlines / workload / capacity styles untouched so those views still render. |
| `src/App.jsx`                                     | `pageSize()` returns `'workspace'` for all Work pillar routes (`work`/`projects`/`assignments`/`workload`/`timeline`) → PageContainer 980px width family. |
| **`test/work-overview-5b.test.jsx`** *(new)*      | 11 tests: hierarchy, compact snapshot, WorkEntity usage, tabs, attention list semantics, Coming-up compactness, Gallery-opt-in only, mobile single-col + 44px targets, thin rails + no rings, empty state, PageContainer size. |

Legacy files untouched: `WorkCards.jsx`, `UniversalWorkRow.jsx`, `ProjectGallery.jsx`, `WorkKit.jsx`, `DeadlineLanes.js`, `WorkFocus.jsx`, `WorkPlanning.jsx`, `WorkCapacitySeries.jsx`, `workViewModel.js`, `work.js` engines, all Work reducers, Deliverables/Projects/Workload/Deadlines sub-views (only the Overview composition changed; those views still use `Rows()`/`UniversalWorkRow`).

## 16. Tests

- Existing `test/workspace.test.jsx`: **26/26** pass (adapted to new snapshot aria-label, workload h2 always-rendered, "Active work" link regex, Gallery button text "Gallery / spatial", empty-state h1 now "Your work starts here.").
- `test/work-overview-5b.test.jsx` (new): **11/11** pass (hierarchy, snapshot pills, WorkEntity rows, tabs, attention semantics, Coming-up compact, Gallery opt-in, mobile 1fr + 44px targets, thin rails/no rings, empty-state visibility, PageContainer workspace size).
- `test/work-entity.test.jsx` **12/12**, `test/page-container-widths.test.jsx` **8/8**, `test/today-step3-audit.test.jsx` **20/20** unchanged and passing.

## 17. Build

- `npm run build` → ✓ built in 5.8s, **Perf budget OK — initial JS 225.4 kB gz, CSS 55.0 kB gz, three lazy-only.**
- `npm run lint` → clean
- `git diff --check` → clean

## 18. Screenshot evidence

Dev server running on port 5173 (LIVE PREVIEW). Navigate to `#/work` to inspect the Overview on 1440×900 / 430×932 / 390×844. No screenshot file was captured to disk in this sandbox; visual judgment should be done in the preview.

10-point visual self-check:
1. **Workspace feel** — hairline rows, quiet pills, operational rather than celebratory.
2. **Active Work is the focus** — primary column is the largest and reaches the top before the side column (desktop two-column); on mobile it appears first.
3. **Snapshot is compact** — one inline row of pills, values are tabular and scannable, no four-card band.
4. **Attention is useful, not alarming** — one list, semantic data-tone, no red cards; Overload banner only appears when truly over.
5. **Coming up is not Deadlines** — three compact count rows + View-deadlines link; no day-grouped timeline inside Overview.
6. **Not card-heavy** — no cards on the overview; hairlines and one-surface primitives only.
7. **Gallery stays out of default** — list is the default; Gallery is a Projects-view toggle only.
8. **WorkEntity feels canonical** — 3px rails, small kind icons, dominant titles; same object as on the foundation showcase.
9. **Mobile is intentionally composed** — single column, all 44px tabs, no overflow.
10. **Distinct from Habits, same family** — no circular rings, more tabular/dense than Today, same hairline/surface/typography primitives.

## 19. Observed-but-untouched issues

- `UniversalWorkRow` and `.workspace-row` cards are still used on Deliverables/Projects/Workload/Deadlines contextual views (non-overview) and in the Projects-details/tasks disclosure; left in place for those screens.
- `WorkCapacitySeries` chart still renders on the Workload tab and on the Work-overload path; just not on the default Overview.
- WorkCards.jsx `.work-card` lost its colored accent/box-shadow in Step 5A CSS cleanup; left flat-bordered. Card JSX was not migrated to WorkEntity (left for a future Projects/Deliverables pass).
- DeadlineLanes/DeadlinePressure/PaceRibbon/ForecastCard — untouched.
- Goals / Insights / Project Detail / Assignment Detail — out of scope, unchanged.

## 20. Commit SHA

Pushed as commit `22c8195` to `origin/arena/01a08bf2-habbit-trackerrr`.

---

**STOP.** Work Overview is delivered as a hierarchical execution workspace built on WorkEntity; Deliverables, Projects, Workload, Deadlines, Project Detail, Assignment Detail, Goals, and Insights remain as they were, reached via the contextual tabs. Review via `#/work` before proceeding.
