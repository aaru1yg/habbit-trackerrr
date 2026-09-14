# Step 5C — Work Deliverables Report

Deliverables redesign (`#/work?view=deliverables`) — shipping/execution surface.

## 1. Files changed
- `src/screens/WorkScreen.jsx`
  - Replaced one-line `DeliverablesView` stub with full composition: header (eyebrow + h2 "Deliverables" + sub) → compact snapshot pills → Delivery Pulse (14-day due-distribution bars) → primary list + lightweight sidebar (Shipping focus + Needs attention).
  - Snapshot pills are anchor links navigating via `workHref()` to preserve URL-level `filter=` state (Active/Due soon/Overdue/Completed) — integrates with existing FILTERS group above.
  - Imports `dayStr, addDaysStr` from `src/lib/dates.js`; adds `model_today` local helper.
  - List renders through existing `Rows` (UniversalWorkRow) to preserve legacy contracts (search, complete, actions, details). Sidebar "Needs attention" uses `WorkEntity` directly in compact mode (no progress rails).
  - Heading is h2 (matches tab contract), heading id `deliverables-heading` for a11y labelling.
- `src/styles/workspace.css` — added `.dlv*` rules:
  - `.dlv` section, `.dlv__head` header, `.dlv__title/.dlv__sub` type scale.
  - `.dlv__snap` inline pill group (no big colored cards) with `.is-active/.is-bad/.is-warn/.is-good` tone borders.
  - `.dlv__pulse` 14-column due-distribution bar chart (`.dlv__pulse-col/track/fill` with `.is-bad` overdue bars and `.is-accent` today bar).
  - `.dlv__grid` two-column desktop layout collapsing to 1fr at `@media (max-width: 767px)`.
  - `.dlv__list`, `.dlv__side`, `.dlv__focus`, `.dlv__attention` with `.dlv__rows--compact` (hides progress rails for sidebar).
  - No rings, no calendar motifs, no routine connectors.
- `src/App.jsx` — already returns `'workspace'` for deliverables (set in 5B), no change needed.
- `test/work-deliverables-5c.test.jsx` — new: 11 tests.

## 2. Visual changes
- Old Deliverables: generic list with top filter chips only; no section framing; no aggregate signal.
- New Deliverables:
  - Header: "Shipping surface" eyebrow, `Deliverables` h2 title, sub "What needs to ship, when it's due, and what's at risk."
  - **Deliverable Snapshot** as four quiet inline pills (Active / Due soon / Overdue / Completed) with real counts and semantic tone borders (bad/warn/good) — NOT four large colored cards.
  - **Delivery Pulse**: 14-day bar chart showing due distribution (yesterday-today-tomorrow labeled, rest date numbers), overdue = red accent, today = primary accent — one compact viz, NOT the Workload chart.
  - **Primary list**: hairline-continuous rows through existing `Rows`/`UniversalWorkRow` with kind/title, parent link, status, 3px progress rail, deadline label, ⋯ actions menu opening existing `ItemActionsSheet`.
  - **Sidebar** (secondary): "Shipping focus" card (single most urgent deliverable: open button, parent/milestone, deadline+pct) and "Needs attention" compact list (≤3 overdue rows, "View all N overdue →" link); lightweight, NOT a multi-card dashboard.
  - Semantic status via tone only on signals (pill borders, pulse fills, risk dots); no full-row coloring / giant red cards.
  - Mobile ≤767px: single-column stack, 44px targets (inherited from `.btn`, `.icon-btn` primitives).

## 3. Architecture reused
- Data layer: `workWorkspace()` rows unchanged; no new reducers/engines/Supabase.
- Components: `Rows`/`UniversalWorkRow`, `WorkEntity`, `workHref`, `FILTERS`, Button primitives, `ItemActionsSheet` (via existing row actions).
- Primitives: tokens, type scale (`eyebrow`, `tiny`, `tnum`), spacing, semantic color vars, `btn sm` / `btn ghost sm`.
- PageContainer `size="workspace"` (~980px) via App.jsx (set in 5B).
- Preserved routes: `#/work?view=deliverables`, legacy `#/assignments`; query `?filter=` continues to drive top-level FILTERS.
- Preserved behavior: existing search, sort, complete via ItemActions, Edit/Move/Archive/Delete, deep-link to assignment detail, focus session, all legacy interactions — untouched.
- No Habit UI imported (no rings, calendar, routine connectors, habit-state language).

## 4. Tests
- `test/work-deliverables-5c.test.jsx`: **11 tests** — eyebrow/h2/sub/snapshot pills (real anchor navigation), 14-day pulse bars (not Workload chart), pill tone borders (no full-row coloring), canonical row with progress+actions, risk as compact signal (no banners), sidebar lightweight, mobile 1fr at 767px, no Habit vocabulary, search+Complete legacy contract, legacy `#/assignments` route.
- Full relevant suite: **88 / 88 PASS** (26 workspace + 12 work-entity + 11 overview-5b + 11 deliverables-5c + 8 page-container-widths + 20 today-step3-audit).
- No regressions in 5A WorkEntity or 5B Overview tests.

## 5. Lint / diff / build
- `npm run lint`: clean (0 errors, 0 warnings).
- `git diff --check`: clean (no whitespace errors).
- `npm run build`: ✓ built; Perf budget OK.
  - Initial JS gzip: **225.4 kB**
  - Initial CSS gzip: **55,987 bytes** (333 bytes under 56,320-byte / 55 kB hard ceiling — NOT raised).
  - Three lazy-only chunks.

## 6. Responsive QA (structural check)
- Desktop 1440 / 1024: two-column `.dlv__grid` (list primary, sidebar secondary) inside PageContainer `workspace` (980px); snapshot pills inline; pulse 14-col grid.
- Tablet: pill group wraps naturally (flex-wrap on `.dlv__snap`).
- Mobile 430 / 390: media query `(max-width: 767px)` forces `grid-template-columns: 1fr`; sidebar stacks below list; pulse bars remain legible (14 equal columns with 4px min width); all buttons/anchors inherit 44px hit targets.
- No overflow, no clipped controls, readable titles/due/status at all four widths (verified through CSS audit; no horizontal `min-width` on `.dlv*` blocks).

## 7. Four self-check questions
1. **Same premium family as Overview?** Yes — same eyebrow/title rhythm, same quiet semantic tones, same hairline rows, same token usage; Deliverables reads as the execution-focused sibling of Overview, not a different product.
2. **Visually interesting without being noisy?** Yes — one 14-day pulse viz provides rhythm; sidebar surfaces provide visual weight without clutter; no gradients/glow/glass/blobs/3D/noise; content remains hero, controls quiet.
3. **Hierarchy obvious in 2–3 seconds?** Yes — heading → snapshot (what's the state?) → pulse (when is it due?) → list (what do I ship?) → sidebar (what's critical?). Eye lands on list within a second.
4. **Clear improvement over the old stub?** Yes — the previous view was a generic filtered list with zero framing; the new view has clear purpose ("Shipping surface"), a real aggregate answer (pulse), and a lightweight focus/attention panel that tells you where to look first.

## 8. Scope discipline
- ONLY `#/work?view=deliverables` (and legacy `#/assignments`) changed.
- Overview/Projects/Workload/Deadlines, Project/Assignment detail, Goals, Insights, Today, Habits: untouched.
- No new reducers, engines, or paid APIs.
- No Habit UI on Work surfaces.
- CSS ceiling NOT raised; pruned by reusing existing Rows/UniversalWorkRow styling instead of duplicating a full second row system in CSS.

## 9. Commit / push
- Branch: `arena/01a08bf2-habbit-trackerrr`
- Final commit SHA: recorded after push.
- Push: `git push origin arena/01a08bf2-habbit-trackerrr`.

## 10. STOP
Per scope, Step 5C ends here. Do **not** proceed to 5D Projects.
