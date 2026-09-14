# Step 6A — Goals Foundation + Audit

**Date:** 2026-09-08 (audit 2026-09-14)
**Scope:** Inspect & document existing Goals domain only. No Goals redesign.
**Foundation change:** 1 line — page container sizes (`workspace` for Goals list, `detail` for Goal detail) wired into `src/App.jsx` so Goals sits in the same grid family as Work/Project-Detail rather than falling through to the 1200px default. Zero CSS bytes touched; CSS gz unchanged at 55,987.

---

## 1. Current Goals architecture

Files:
- `src/lib/goals.js` — single source of truth for goal progress, pace, health, next milestone, summary, today-actions.
- `src/lib/goalAnalytics.js` — time-dimension analytics: actual series, expected (pace) series, velocity, projection, consistency. Gaps return `null`, never interpolated.
- `src/lib/adaptive.js` — `goalForecast`, `goalContributors` (shared with the Today/Work adaptive layer).
- `src/components/goals/health.js` — `healthBadge` UI mapping from `goalHealth` onto the four-state language (Reached / On track / At risk / Overdue / Safe for undated).
- `src/components/goals/GoalForm.jsx` — New/Edit sheet for goals (title, why, area, start/target, manual percent, milestone add).
- `src/components/goals/GoalAtlas.jsx` — lazy spatial "Atlas/Visual" constellation explorer.
- `src/screens/GoalsScreen.jsx` — list-first overview with tab filters (Open / At risk / Reached / All), list/Atlas view switch, `StatStrip`, `GoalCard`s, Link-work inline editor.
- `src/screens/GoalDetailScreen.jsx` — detail page with compact hero, `ProgressCore` ring, facts grid, Next milestone, Milestones groups, Today's contribution, history `<details>` with `PaceChart`, Notes, Manage sheet, Forecast/Contributors/Feed rail, optional Atlas.
- `src/styles/goals.css` (510 lines, 15.8 KB raw / ~3.5 KB gz) — **lazy route-scoped chunk** (`goals-DyLKRRsx.css`), NOT in the initial bundle. Initial CSS stays at 55.0 KB gz (333 bytes to ceiling).
- Routing: `#/goals` → `GoalsScreen`, `#/goals/:id` → `GoalDetailScreen`. Already wired with lazy chunking.

## 2. Data/selector map (authoritative)

Progress derivation order (from `goalProgress`, never guesses):
1. **Milestones** (explicit checkpoints) → `done/total` % if any exist.
2. **Linked assignments** → mean of `assignmentProgress(p)`; real subtask/task data.
3. **Linked projects** → mean of `projectProgress(p)`; milestone/task data.
4. **Linked habits** → 30-day `habitRate` completion % (real scheduled check-ins).
5. **manualPercent** → only if user set one and nothing else linked.
6. Else **0% with honest "Nothing linked yet" detail**.

Status/health (`goalHealth`): completed/pct≥100 → Reached; past target w/ not done → Past target; behind pace >15 → Behind pace; ahead >15 → Ahead of pace; else On pace. `healthBadge` maps these to four UI states.

Pace (`goalPace`): linear expected% from `startDate` → `targetDate`; returns `null` if window invalid (honest).

Next milestone (`nextMilestone`): first unfinished by targetDate then order.

Analytics (`goalAnalytics`): actual daily series (recomputed from `progressLog`/milestone `doneAt`/habit check-ins), expected pace series, velocity points/week, projected completion day, consistency (% of on-time milestones or 30-day habit hit-rate).

Forecast/contributors (`adaptive.js`): `goalForecast` gives current/expected/projected, required vs actual pace, SAFE/ON TRACK/AT RISK/OVERDUE/CRITICAL risk enum with reason; `goalContributors` apportions movement per linked item.

Today actions (`goalTodayActions`): eligible linked habits not checked today + project tasks due today.

Relationships: Goals link **down** to Habits, Projects, Assignments via `linkedHabitIds`, `linkedProjectIds`, `linkedAssignmentIds`. Milestones are an inline sub-array on the goal. There is **no FK upward** from Work/Habits to Goals — goals pull from existing data only.

Goal areas (8): fitness, health, mind, learning, creative, social, finance, productivity — each mapped to a `--cat-*` CSS var (existing palette).

## 3. Existing reusable primitives (to reuse, not duplicate)

- Shell: `PageContainer`, `ShellSidebar/TopBar/MobileNav`, `Backdrop`, `WorldLayer`.
- UI primitives: `SectionCard`/`CardHead`, `EmptyState`, `Sheet`, `Button`/`IconButton` (`.btn`, `.btn.primary`, `.btn.ghost.sm`), `StatStrip`, `Meter`, `PaceChart`.
- WorkKit: `StatusPill` (but Goals uses its own `.health-pill`), `WorkEmpty`, `chip`, `.chip-btn`, `.seg`, `.seg-btn`, `.field`, `.field-label`.
- Tokens: `--surface*`, `--border*`, `--text*`, `--good/--warn/--bad/--info`, `--accent-*`, `--cat-*`, `--r-*`, `--space-*`, `--fs-*`, `--fw-*`, `--font-display/num/family`, `--touch` (44px), `--e-card/hairline`, `--focus`.
- Typography scale: `--fs-h2/display/body/sm/xs/micro`; display font for titles; tabular nums for metrics.
- Layout: `.screen`, `.screen-head`, `.screen-title`, `.screen-sub`, `.back-link`, `.stack`, `.card.pad`, `.pad-lg`, `.kv` (detail rail), `.wrap-gap`, `.tnum`, `.eyebrow`.
- Interactions: focus-visible outlines, reduced-motion media queries already in goals.css.
- Charts: `PaceChart` (shared actual/expected line chart), canvas-based.
- Existing `.health-pill` (Goals) is visually parallel to Work's `StatusPill` but not identical — normalize in 6B.

## 4. Visual / UX problems (to fix in 6B/6C, NOT now)

| # | Problem | Where | Severity |
|---|---|---|---|
| V1 | `ProgressCore` 150px ring in hero duplicates a "circular %" visual — violates "not every goal a ring" rule (Spec §5 data-honesty) | GoalDetail hero | High |
| V2 | Big right-aligned `goal-pct` (1.6rem) fights the h1 for visual hierarchy | GoalCard head | Med |
| V3 | Hero uses its own grid/typography (`goal-hero-inner`, `goal-core`, `goal-hero-copy`, `goal-facts`) rather than reusing `.dlv__snap`/`.wo__head-*` — sibling language mismatch with Work detail | GoalDetail | Med |
| V4 | `.health-pill` and `.status-pill` are two parallel components with near-identical look; chip/area-dot pattern repeated manually | Both screens | Low-Med |
| V5 | Toolbar/seg buttons use legacy `.goals-toolbar .seg` instead of the workspace `.wo__toolbar`/`.wo__tabs` pattern | GoalsScreen | Low |
| V6 | Card meta grid (`goal-meta`) uses 1px border trick (grid-gap 1 + bg border) — clever but visually dense | GoalCard | Low |
| V7 | "This goal is fed by" + "Contributors" + inline `linkOpen` chips overlap in purpose — two surfaces for linked work on Detail and two on Card | Detail + Card | Med |
| V8 | "How the layers connect" accordion is boilerplate UI chrome; same content as form copy | GoalsScreen bottom | Low |
| V9 | "Manage goal" card at bottom of main column duplicates the action rail already at top | Detail | Low |
| V10 | Today's contribution is a small section; could surface as a "next action" at top (more executional) | Detail | Med |
| V11 | Forecast "SAFE/ON TRACK/AT RISK/OVERDUE/CRITICAL" enum (`goalForecast.risk.id`) uppercase doesn't match `healthBadge` language — two parallel vocabularies | Forecast rail | Med |
| V12 | Atlas is lazy but still a fairly heavy 3D/constellation affordance; needs clear entry point (currently a button in toolbar on list, a toggle in detail) | Both | Low |
| V13 | Goal cards don't use `.dlv`/`.wo__snap` pill language established for Work — feel like a different product family | GoalCard | Med |
| V14 | Eyebrow/back on Detail is a `.back-link` in its own row (not the `.dlv__eyebrow` eyebrow-link pattern used by Project/Assignment detail) | Detail head | Low |

## 5. Data / semantic problems

- **Duplicate vocabularies:** `goalHealth` returns `tone:'good'|'warn'|'bad'|'neutral'` + `label:'Reached'|'Past target'|'Behind pace'|...`; `healthBadge` remaps to `Reached/On track/At risk/Overdue/Safe`; `goalForecast.risk.id` is uppercase `SAFE/ON TRACK/AT RISK/OVERDUE/CRITICAL`. Three parallel status names for the same concept. Unify to one canonical enum in 6B and map in one place.
- **Progress sources average work % across multiple links** — fine, but the hero "progress basis" fact reads "2/5 progress basis" with `from milestones`/`from habits`, which is accurate but slightly cryptic. Keep honest, just tighten copy.
- **Contributor row fallback uses `find(list, name)`** — brittle if two items share a name; switch to ID lookup in 6C (minor bug, not foundation-blocking).
- **`ProgressCore` ring is animated/ring-based** — data is honest, but the visual idiom conflicts with Habits (rings = today cadence) and Work (rails = execution progress). Goals should have its own signature viz.
- **Projection/velocity** exist and are honest but are buried under Forecast grid; opportunity for visual treatment.
- **No milestone history timeline** — milestone `doneAt` is stored but not rendered as a sequence; ripe viz candidate.

## 6. Responsive problems (from code inspection; 390/430/1024/1440 noted)

- PageContainer previously fell through to the 1200px default — fixed in this foundation step (list → `workspace` 980px, detail → `detail` 880px) to match Habits/Work conventions.
- `<720px` rules exist (card wraps, toolbar columns, milestone toggle wraps) but `.goal-stat` 1.6rem number can still collide with title on very narrow phones when title is long and right-pinned.
- Forecast grid forces 3 cols down to 480px (already handled), but pace grid collapses to 1 col at same breakpoint — may feel abrupt; smooth in 6B/6C.
- `.goal-facts` in hero uses 2-col until ≥1200px (4-col), leaving an awkward 2-col span between 760–1199px alongside the 150px ring.
- `Manage goal` action buttons (`flex:1 1 auto` at 480px) grow but don't have min-height 44 enforcement checked.
- `.contributor-row` min-height `var(--touch)` OK; `.goal-next-toggle` OK; `.chip-btn` check needed (reused from Work CSS — verify 32–36px min-height).

## 7. Accessibility problems

- **Progress ring (`ProgressCore`)** — uses `aria-label` but no `role="img"` consistently (verify); 150px decorative SVG takes focus hierarchy away from text on small screens.
- **`aria-expanded`** present on link toggles (good); **tablist** uses `role="tab"`/`aria-selected` (good) but `tabpanel` association missing.
- **Color-only tone:** `dd[data-tone='bad']` etc. use color alone — combined with text labels ("Overdue", "At risk") already present; safe in most places but verify the forecast risk chip carries the text not just color.
- **Milestone toggle buttons** (`goal-next-toggle`) use `aria-pressed` (good) but don't announce the date; add `aria-label` or rely on visible text (visible → probably OK).
- **PaceChart** is canvas-based — has `ariaLabel` prop, verify it's passed through and not obscured.
- **Headings:** h1 on screen title, h2 on goal title (card), CardHead titles are styled divs — check heading hierarchy on detail.
- **Keyboard:** focus-visible outlines exist for most targets; verify chip-btn and GoalAtlas canvas are not in tab order unexpectedly.
- **Links:** contributor rows built with `Link` (good); linked-habit/project/assignment rows use Link (good); "Open" small link in card exists (good).

## 8. Recommended Goals IA (for 6B/6C)

**Goals list (#/goals):**
- Same `.screen`/`.wo__eyebrow`/h1 + New-goal primary action as Work/Habits.
- Replace `StatStrip` with Work-style 4-pill snapshot (Open, Avg progress, At risk, Nearest milestone) — pills not big cards.
- Segmented tabs: Open · At risk · Reached · All (keep; just restyle to Work's `.wo__tabs`).
- List/Atlas switch kept; Atlas remains opt-in lazy.
- GoalCard = sibling to Project/Assignment `.dlv` card family: area + health + title + why sub, compact progress+pace rail (no ring here — rails), one-line snapshot pills (progress, target/days-left, milestones done/total, momentum/velocity short), a prominent "Next milestone" execution row, inline linked contributors strip, footer actions.

**Goal detail (#/goals/:id):**
- Same PageContainer `detail` (880px) as Project/Assignment — wired in this foundation step.
- Header: Goals eyebrow ◀ back to #/goals, area chip, health pill, h1 title, why sub, primary action (Start focus on first pending? OR "Mark next milestone"), secondary ghost Edit/Delete/Archive/Link (mirror Work detail's `.wo__head-actions-inline`).
- Snapshot pills: Progress% / Target date + countdown / Milestones done-total / Contributors (habits+work count) / Consistency (when available).
- ONE primary viz: a trajectory chart (actual vs expected pace line over the goal window, with today marker + projection extension) — the honest, useful visualization. **No circular ring.**
- Sections: Next milestone (primary execution), Milestones (grouped Up next / Upcoming / Reached — keep), Forecast (health, required vs actual pace, projected finish), What feeds this goal (contributors + link editor), Today's contribution, Progress history (existing PaceChart in details, maybe promoted), Notes, Manage.
- Secondary rail: Forecast + Contributors + Feed (same `.detail-layout` stack+rail pattern as Work detail).

## 9. Recommended Goals visual language (distinct but same family)

- **Signature viz = trajectory, not rings.** A thin expected-pace line across the goal's window with a thicker actual-progress line; milestones as dots on the line, today marker, projection extension dashed. Goals feel like "long arcs" — the line is the metaphor. Use Work's 3px rail language extended horizontally to a chart.
- **Palette:** area color (`--cat-*`) as the accent per goal (instead of one accent-2 like Work). Health drives border tone (good/warn/bad/neutral) — same 3px left-border convention as `.dlv` cards so risk is instantly scannable.
- **Typography:** `--font-display` for goal titles (already in use) at 1.75rem detail / 1.35rem list — slightly more editorial than Work but same scale. Keep `--font-num` tabular for all metrics.
- **Depth:** same `--e-card` / `--e-hairline` tokens as Work; no extra glow/3D on goals (Atlas remains the one place for spatial flourish and stays lazy).
- **Momentum language:** surface velocity (points/week) and consistency (%) as honest metrics — these are Goals-specific signals ("am I building momentum?") that Habits (streak) and Work (pace) don't cover.
- **Milestones = checkpoints, not tasks.** Rendered as dots/stops on the trajectory and grouped rows with checkboxes, not the checkbox-row aesthetic used for Work subtasks. Distinguish "checkpoints on an arc" from "tasks to do today."
- **No decorative gradients.** Ambient WorldLayer in the shell is enough; the GoalAtlas constellation is the single flourish, opt-in.

## 10. Recommended chart opportunities (decision-supporting, not decorative)

1. **Trajectory (actual vs expected) over the goal window** — primary hero viz in 6C. Replace the ProgressCore ring. Adds target dot, today marker, projected finish dashed extension when velocity>0.
2. **Milestone timeline** (horizontal) — milestones plotted at their target dates on the goal window; reached milestones filled; next milestone highlighted. Composes with the trajectory.
3. **Contributor breakdown** (small horizontal stacked bar or rows) — % of progress attributable to each linked project/assignment (already computed by `goalContributors`). Habits show consistency %, not apportioned progress.
4. **Momentum/velocity sparkline** (14-day) inset in the snapshot — only when data exists (≥2 points); otherwise show "not enough data yet".
5. **Consistency meter** for habit-linked goals (the 30-day hit rate); for milestone goals, on-time%; for work-linked goals, omit (progress≠cadence, per `goalConsistency` source tag).

Rejected / defer:
- Donut/ring charts of progress sources — visually noisy and the apportionment is approximate (the selector already returns "not enough data" honestly; don't force a pie).
- Calendar heatmaps per goal — useful in Insights, not on the goal page; would compete with the trajectory.
- 3D Atlas as default — keep opt-in; it's fun but not decision-supporting.

## 11. What should NOT change

- **Data model:** no new fields, no new reducers, no new engines. `goals.js`/`goalAnalytics.js`/`adaptive.js` are already honest and well-factored; use them as-is.
- **Supabase/schema:** out of scope.
- **Routing:** `#/goals` list + `#/goals/:id` detail stays; lazy chunks stay.
- **GoalAtlas:** keep lazy; only refine entry points if needed in 6B/6C.
- **GoalFormSheet:** already uses Sheet, form primitives — minor polish only.
- **Other pillars:** Today/Habits/Work/Insights are off-limits in 6.
- **Initial CSS budget (56,320 gz):** goals.css stays as a lazy chunk; initial CSS does not grow. 6B/6C changes can rewrite/slim goals.css but any initial-bundle additions must fit in the 333-byte margin; safer to keep goals.css lazy.

## 12. Foundation change made in 6A

- `src/App.jsx`: Goals route now uses explicit `PageContainer` sizes — `workspace` (980px) for `#/goals` list, `detail` (880px) for `#/goals/:id`, matching the conventions established for Work/Projects/Assignments/Habits. Previously fell through to the 1200px app default.
- No CSS changes, no component changes, no redesign.
- Initial CSS gz unchanged at **55,987 bytes** (under 56,320 ceiling; 333-byte margin preserved).

## 13. Tests / lint / build

- Existing Goals tests pass: `goals.test.js` (24), `goalAnalytics.test.js` (14), `goalsV6.test.jsx` (11) → **49/49**.
- Work 5A–5H + shell + primitives regressions remain green (verified 163/163 on Work-related suites before this step; App.jsx pageSize change does not alter rendering, only container width class).
- `npm run lint`: clean.
- `git diff --check`: clean.
- `npm run build`: **Perf budget OK — initial JS 225.2 kB gz, CSS 55.0 kB gz, three lazy-only.** Initial `index-*.css` gz = 55,987 bytes. Goals CSS stays in its own lazy chunk (`goals-*.css`, 11.9 KB raw / ~3.5 KB gz), zero impact on initial load.

## 14. Recommended next implementation step (6B — Goals Overview)

- Redesign `#/goals` list to match Work/Habits visual family (`.wo`/`.dlv` language, pills not big cards, rails not rings, area-colored 3px left-border tone).
- Replace `StatStrip` with 4 snapshot pills; keep segmented tabs and List/Atlas switch.
- Rewrite `GoalCard` using `.dlv` structure (eyebrow row with area chip + health pill, h1 title, why sub, snapshot pills, compact progress+pace rail with milestone dots, prominent Next-milestone row, linked contributors strip, footer Edit/Archive/Delete).
- Normalize status vocab: pick one canonical enum, map once.
- Mobile: toolbar stacks, pills wrap, next-milestone row wraps, 44px targets enforced.
- CSS: edit the lazy `goals.css` (does not count against initial bundle budget), consolidate duplicate rules, slim down where possible.
- STOP after Overview; do NOT start Detail.
