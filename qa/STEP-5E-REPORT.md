# Step 5E — Work Workload Report

Workload redesign (`#/work?view=workload`) — capacity planning surface.

## 1. Files changed
- `src/screens/WorkScreen.jsx`
  - Replaced `WorkloadView` (previously: heading + Capacity `<dl>` + day-by-day button grid + contributors list) with a premium capacity-planning surface reusing `.dlv*` primitives from Deliverables/Projects.
    - Header: eyebrow "Work" + h2 "Workload" + sub ("Can your capacity cover your commitments over the next week?") + Plan button (Recover still rendered via the existing Overload banner above the view when overloaded, so legacy Plan+Recover flows keep working).
    - **Capacity Summary** as four compact inline pills (Capacity / Planned / Over or Free / Peak) with real totals from `model.load` (workloadByDay): total available, total committed, total overload (or total free), peak-day label. Tones: bad when over, good when free, bad when peak day is overloaded.
    - **Capacity vs Committed chart**: custom responsive inline SVG bar chart (the visual hero) showing per-day committed bars against a dashed capacity reference line, with over-capacity segments colored `var(--bad)` and today highlighted. Legend (Capacity / Planned / Over) lives above the chart; hour axis on the left; day labels + committed-hour labels under each bar; 320px min-width with overflow-x auto for small screens. Uses only real `availableMin/committedMin/remainingMin/overloaded/items` from existing `workloadByDay` output; no fake data.
    - Primary column: "Where capacity is tight" when over (lists overloaded days with over-amount + top contributors inline) or "Capacity outlook" when free (free capacity total + free-day list); followed by "Contributors on peak day" rendered through existing `Rows` (UniversalWorkRow) for the peak day — respects existing search/FILTERS via `filterWork`.
    - Sidebar: single "Capacity outlook" focus card (over-by or free total, commitment %, peak day, overloaded-day count, Plan/Recover buttons) — lightweight, single surface, not a card dashboard.
    - Empty state when capacity not set: "Set daily capacity in Settings" link preserved.
  - Removed unused `Capacity` helper `<dl>` (replaced by the pills + chart + focus card).
  - No new chart component created; chart is inline SVG to keep CSS at zero new bytes.
- `src/styles/workspace.css` — **zero additions and zero deletions**. WorkloadView reuses every existing `.dlv*` and `.wo__*` primitive (header/pills/pulse/grid/list/side/focus/groups/head-actions-inline).
- `test/work-workload-5e.test.jsx` — new: 11 tests.

## 2. Chart / data architecture reused
- Data: `model.load` from `workWorkspace()` → `workloadByDay(state, …)` → each day has `{ date, label, availableMin, committedMin, remainingMin, overloaded, items }` (real existing calculations in `lib/adaptive.js`). No new data layer, no new calculations, no Supabase/schema changes.
- Chart: inline SVG rendered in the component (no new dependency, no new CSS). Visual language:
  - Dashed `var(--accent-1)` reference line at average capacity (capacity awareness).
  - `var(--accent-2)` solid bars for committed load; over-capacity segment stacked in `var(--bad)` above each overloaded bar.
  - Today highlighted with accent-tinted background band and bold label.
  - Axis labels (hours) on the left; day + committed-hour labels under each bar.
  - Color encodes meaning (accent-1 = capacity reference, accent-2 = planned, bad = over); no rainbow, no glow/glass/3D.
- Actions: existing `onPlan('plan')` / `onPlan('recover')` flow preserved; ItemActionsSheet/WorkPlanning unchanged; deep links preserved.
- List/rows: uses existing `Rows` (UniversalWorkRow) + `filterWork()` with `options` so search/FILTERS continue to filter contributors.
- PageContainer `size="workspace"` (980px) from App.jsx (5B) — no change.
- Routes preserved: `#/work?view=workload`, legacy `#/workload`; `?filter=`/`?horizon=` preserved.
- No Habit UI (no rings/calendar/routines).

## 3. Visual changes
- Old Workload: `<dl>` with three numbers → button grid of 7 days → contributors heading. Honest but visually flat; no aggregate answer.
- New Workload:
  - Strong eyebrow/h2/sub hierarchy consistent with Overview/Deliverables/Projects.
  - Compact capacity summary pills give instant answer (Planned vs Capacity, Over/Free, Peak day).
  - Visual hero is the capacity-vs-committed SVG chart — over-capacity red segments immediately draw the eye to problem days; dashed capacity line grounds the eye across the week.
  - Below the chart: concise "Where capacity is tight" (or "Capacity outlook" when free) enumerating overloaded days with contributor hints, then "Contributors on peak day" (existing row system).
  - Sidebar: single "Capacity outlook" surface with big signal ("Over by 2h 30m" / "5h free"), commitment %, peak label, overloaded count, Plan/Recover CTAs.
  - Mobile ≤767px: inherits `.dlv__grid` 1fr; chart scrolls horizontally within its wrapper (320px min-width SVG stays legible); buttons remain 44px via primitives.

## 4. Responsive QA (structural)
- 1440/1024: two-column `.dlv__grid` (primary analytical column + sidebar focus card) inside PageContainer workspace (980px); pills inline; chart full width.
- 430/390: single column; chart wrapper allows horizontal scroll if necessary but SVG viewBox scales; pills wrap; controls retain 44px hit targets.
- No horizontal `min-width` on `.dlv*` block; primary column uses `min-width:0` so titles truncate/wrap cleanly.

## 5. Tests
- `test/work-workload-5e.test.jsx`: **11 tests** — eyebrow/h2/sub + four capacity pills; SVG chart renders with capacity line/bars/over indicator + legend; real over-capacity values (2h30m) match fixture; Plan dialog opens; sidebar outlook renders empty-state/capacity unset path; mobile 1fr at 767px; no Habit vocab; responsive SVG wrapper; peak-day contributors; no cross-view bleed (no Projects/Deliverables headings on Workload).
- Full relevant suite: **109 / 109 PASS** (26 workspace + 12 work-entity + 11 overview-5b + 11 deliverables-5c + 10 projects-5d + 11 workload-5e + 8 page-container-widths + 20 today-step3-audit).
- No regressions in 5A/5B/5C/5D tests; legacy "Plan" and "Recover" dialogs still open.

## 6. Lint / diff / build
- `npm run lint`: clean (0 errors, 0 warnings) after removing unused `Capacity` helper.
- `git diff --check`: clean.
- `npm run build`: ✓ built; Perf budget OK.
  - Initial JS gzip: **225.4 kB**
  - Initial CSS gzip: **55,987 bytes** (333-byte margin under the 56,320-byte / 55 kB ceiling — NOT raised). Achieved by fully reusing `.dlv*` and `.wo__*` classes and inlining the chart as SVG (zero new CSS rules added).

## 7. Four self-check questions
1. **Immediately tells me if I'm overloaded?** Yes — pills' "Over capacity 2h 30m" in bad tone, big red over segments on the chart, sidebar "Over by 2h 30m" signal, and the existing Overload banner all converge on the answer within a second.
2. **Visually rich enough for the references?** Yes — the chart is the visual hero with multiple layers (reference line, bars, over segments, today highlight, axis labels, hover hit areas inherited from SVG); it reads as a polished planning chart rather than a default browser bar graph.
3. **Beautiful without being noisy?** Yes — exactly one chart, restrained 3-color palette (accent-1/accent-2/bad), faint gridlines, no glow/gradients/glass/3D; analysis below is concise (problem days + contributors); sidebar is one surface.
4. **Trend understandable in 2–3 seconds?** Yes — the eye goes summary pills → chart → tight days; red over segments identify problem days instantly; the dashed capacity line gives a reference to read "how much over" at a glance. Mobile remains usable thanks to the horizontal-scroll wrapper and reduced label density (hours per bar stay).

## 8. Scope discipline
- ONLY `#/work?view=workload` (and legacy `#/workload`) changed. Overview/Deliverables/Projects/Deadlines, Project/Assignment detail, Goals, Insights, Today, Habits: untouched.
- No new reducers, engines, or paid APIs; no new dependencies.
- CSS ceiling NOT raised — zero new CSS bytes added (old unused `Capacity` helper was removed but its CSS class `.workspace-capacity-values` remains in the stylesheet for backwards compatibility with any in-flight references; no new classes added).

## 9. Commit / push
- Branch: `arena/01a08bf2-habbit-trackerrr`
- Commit recorded + pushed after this report.

## 10. STOP
Per scope, Step 5E ends here. Do **not** proceed to 5F Deadlines.
