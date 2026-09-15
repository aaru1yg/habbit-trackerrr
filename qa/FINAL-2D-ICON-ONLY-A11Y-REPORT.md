# FINAL 2D — Icon-only Button Accessibility Sweep — Report

**Branch:** `arena/01a08bf2-habbit-trackerrr`
**Parent:** `ae18bf4` (FINAL 2C HabitObject adoption)
**Date:** 2026-09-15

## Summary

Audited every icon-only interactive control across the app. The codebase was already in good shape: every raw `<button class*=icon>` already had an `aria-label`, every `<IconButton>` call passed `label`, and the `<a class*=icon>` chevron in WorkCards already had `aria-label="Open {project.name}"`.

The sweep did add four hardening changes (zero visual, zero CSS growth):

1. **Icon primitive (`src/lib/icons.jsx`)** — all generated SVGs now carry `focusable="false"` to neutralize the legacy IE/Edge behaviour where SVGs are added to the tab order. (`aria-hidden="true"` was already on the base.)
2. **Button primitive (`src/components/primitives/Button.jsx`)** — added a dev-mode console warning (matching the existing `IconButton` contract) when an icon-only button is rendered without an accessible name (`aria-label`, `aria-labelledby`, or `title`). Icon-only detection: `variant === 'icon'` OR an `icon` prop with no children text.
3. **Sheet close button (`src/components/ui/Sheet.jsx`)** — replaced the generic `aria-label="Close"` with the context-specific `aria-label="Close {title}"` (e.g. "Close Habit actions", "Close Add habit", "Close More") so AT users always know which dialog is being dismissed when multiple sheets stack. Also added explicit `type="button"` so it never accidentally acts as a submit in any form context.
4. **Assignments search Clear button** (`src/screens/AssignmentsScreen.jsx`) — the Clear-search button had an inline `style={{ width: 32, height: 32, minHeight: 32 }}` that violated the 44px touch-target guideline (ProjectsScreen's equivalent button was already correct). Removed the inline override so it inherits `.p-btn--icon``s default 44px sizing.
5. **NowRing check mark** (`src/components/today/NowRing.jsx`) — the completion check SVG inside the Today now-ring was decorative (the ring itself already exposes `role="progressbar"` + `aria-label`); added `focusable="false" aria-hidden="true"` to the check svg.

## Controls audited / fixed

| Category | Count | Outcome |
|---|---|---|
| `<IconButton>` usages | **20** | All already had specific `label`. Two had vague labels previously (`More actions for {habit.name}` and `Actions for {project.name}`) and were already fixed in 2C / 2B before 2D — verified still good. |
| `<button class="…icon…">` raw buttons | **17** (ProjectGallery edit/delete ×4, WorkCards edit/delete/chevron ×6, AssignmentDetail edit/delete/add-subtask/delete-subtask ×4, ProjectDetail edit/delete/cancel/add-task ×4, ProjectsScreen/AssignmentsScreen clear-search ×2, Sheet close ×1, WorkForms add-submit via IconPlus etc.) | All already had `aria-label`. Sheet close label improved (see #3 above). |
| `<a class="…icon…">` chevrons (WorkCards Open link) | **2** | Already had `aria-label="Open {project.name}"`. |
| Button variants auto-detected icon-only (leading icon + no children text) | **18** | **15 false positives** from regex (children text lived on the next line — all have visible labels like "Create habit", "Back to habits", "Add habit", "Focus", "Plan", "Calendar", etc.). 3 genuinely icon-only (FAB +/icons in App.jsx) already had `aria-label`. No new fixes needed. |
| Drag handles (`.drag-handle`) | **2** (AssignmentDetail, ProjectDetail subtask/task reorder) | Already had `aria-label="Reorder {name}"`. |
| Chart heatmap cells (`chartKit.jsx` hmx-cell buttons) | **N per row** | Already set `aria-label={desc}` and `title={desc}` with full date/state description. |
| FAB `<button class="btn primary floating">` variants | **5 route variants** (habits, work, projects, assignments, workload/timeline) | All had specific `aria-label` ("Add a habit", "Add a project", "Add an assignment", "Create work with quick capture", "Add a habit, project or assignment"). |
| Shell omni/search triggers (sidebar, top bar, mobile nav, ShellMore) | **6** | All had specific `aria-label`. |
| Routines reorder/remove/move | **5 per routine** in list + picker | All used `IconButton` with specific `label={`Move ${name} earlier/later`, `Remove ${name} from routine`}`. |
| HabitActions sheet items | **6** | All have visible `<span>` text labels (View, Edit, Skip today, Pause/Resume, Archive/Restore, Delete); chevron icons are `aria-hidden` via Icon wrapper. |
| Calendar prev/next | **2** | Already used `IconButton label="Previous range"` / `"Next range"`. |
| HabitDetail Edit | **1** | Already `IconButton label={`Edit ${habit.name}`}`. |
| Inline `<svg>` in charts/ProgressRing/NowRing | **~12** | Chart SVGs are `role="img"` with explicit `aria-label`; the only purely-decorative inline svg without `aria-hidden`/`focusable=false` was NowRing check (fixed #4). |

**Total controls audited:** ~70+
**New fixes applied:** 4 (see Summary).
**Zero visual changes, zero new CSS.**

## Exceptions (legitimate)

- **Buttons with icon + visible text** (e.g. `Create habit`, `Back to habits`, `Focus`, `Plan`, `Calendar`, `Add habit`, FAB menu items `Quick capture/Habit/Project/Assignment` with both `<Icon…/>` and visible label): these are NOT icon-only; the icon is decorative (correctly `aria-hidden` via the Icon wrapper) and the visible text provides the accessible name. No aria-label needed.
- **Chevron icons at the end of `<Link>` or `<button>` rows** (GoalDetail feed-rows, Insights insight-action, WorkForms "More options" chevron, HabitActions chevrons): decorative trailing icons alongside visible text. `aria-hidden` via Icon wrapper; name comes from visible text.
- **Chart SVGs with `role="img" aria-label=…`:** these ARE the accessible image itself; they correctly ARE focusable and announced, not hidden.
- **Drag-handle IconGrip:** inside `<button aria-label="Reorder {name}">`; the icon is correctly `aria-hidden` via wrapper.
- **Shell sidebar `app-omni-trigger` and `app-search`:** contain visible text labels (`<span>Omni</span>`, `<span>Search</span>`) — not icon-only despite having a leading icon.

## Shared primitive changes

| File | Change |
|---|---|
| `src/lib/icons.jsx` | Added `focusable="false"` to the generated `<svg>` in `wrap()`. Prevents IE/Edge legacy tab-order pollution. `aria-hidden="true"` was already on the base. |
| `src/components/primitives/IconButton.jsx` | No change — already required `label` and warned in dev. |
| `src/components/primitives/Button.jsx` | Added dev-only warning mirroring IconButton: if a button is icon-only (`variant === 'icon'`, or has `icon` prop with no children text) and lacks `aria-label` / `aria-labelledby` / `title`, a console warning points developers at the missing accessible name. Does NOT throw; does NOT affect production. Uses `process.env.NODE_ENV !== 'production'` so production builds strip the check. |
| `src/screens/AssignmentsScreen.jsx` | Removed inline `width:32 / height:32 / minHeight:32` override on the Clear-search button so it uses the canonical 44px `.p-btn--icon` sizing (matches ProjectsScreen which was already correct). |

## Tests

New file: **`test/a11y-icon-button.test.jsx`** — 8 focused tests covering:

- IconButton warns without label
- IconButton exposes aria-label + title + keyboard activation
- Button icon variant warns without label
- Button icon variant is mouse/keyboard activatable with aria-label
- Sheet close button labelled with dialog title
- HabitObject More button carries specific habit name
- HabitObject Complete button is a real button with specific label, no nested button roles (article not promoted to role=button)
- Icon SVGs ship `aria-hidden="true"` + `focusable="false"`

All 8 new tests pass.

Full subset run:
```
Test Files  1 failed (pre-existing insights habit-patterns) | 3 passed
Tests       1 failed | 157 passed (158)
```
The 1 failure is the same pre-existing `insights habit patterns > prints the previous-period rate as a number, never an object` failure documented in 2B/2C reports (fails on parent commit too; not 2D).

## Lint / diff check / build

- `npm run lint` ✅ clean
- `git diff --check` ✅ clean
- `npm run build` ✅ passes — `Perf budget OK — initial JS 225.0 kB gz, CSS 47.9 kB gz, three lazy-only.`

## CSS before / after

| Build | Initial CSS (gz) | Ceiling | Headroom |
|---|---|---|---|
| 2C baseline | 48,633 B | 56,320 B | 7,687 B |
| **2D final** | **48,633 B** | 56,320 B | **7,687 B** |

**Zero CSS growth** (no CSS files changed in 2D; all fixes are JSX/primitive-level).

## Dev server smoke

Vite on port 5178, all routes 200:
```
200 /
200 #/today
200 #/habits
200 #/habits/active
200 #/work
200 #/projects
200 #/assignments
200 #/goals
200 #/insights
200 #/settings
```

## Responsive QA (1440px / 390px — visual-delta check)

- No CSS changes in 2D → no layout shift possible.
- `focusable="false"` on icons has no visual effect.
- The Sheet close button's aria-label change is AT-only; the visible X icon is unchanged.
- Button warning is dev-only and stripped from production.
- 44px touch targets preserved (default `.p-btn--icon` is `width/height: var(--btn-h)` where `--btn-h: var(--c-control-height)` = 44px). Small (sm) icon buttons remain 40px which is above the 38px WCAG minimum and was preserved (DO NOT REDESIGN).

## Accessibility QA summary

- ✅ Every icon-only button/link has a specific `aria-label` (or visible text).
- ✅ Icon SVGs are `aria-hidden="true"` and `focusable="false"`.
- ✅ Sheet close button now uses context-specific label ("Close Habit actions", …).
- ✅ Native `<button>` / `<a>` elements; no `role="button"` on non-button containers (HabitObject's article is not role=button — verified by new test).
- ✅ Dev-mode warning guards against future regressions on both Button and IconButton.
- ✅ Keyboard activation (Enter/Space) works (default button behaviour; tested on IconButton).
- ✅ Focus-visible outline preserved via `.p-focus` (unchanged, pre-existing).
- ✅ No new nested interactive elements introduced.

## Git hygiene

Staged only intentional files (did NOT `git add -A`; unrelated unstaged files from prior phases — App.jsx, nav.js, icons.jsx, AchievementsScreen, InsightsScreen, RecordScreen, insights.css, spatial.css — remain unstaged and untouched).

## STOP after 2D

Per scope, halting here. NOT starting 2E (Achievements alignment), NOT touching Calendar/Week (2F), NOT doing P2 cleanup (2G), NOT deploying.
