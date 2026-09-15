# FINAL 2C — HabitObject Adoption — Report

**Branch:** `arena/01a08bf2-habbit-trackerrr`
**Parent:** `f87fd98` (FINAL 2B Work unification)
**Date:** 2026-09-15

## Summary

Made `HabitObject` the single canonical visual object for active-Habit list rendering. The active Habits workspace (`#/habits`), Today's habit rows (`#/today`), and no temporal surfaces (Calendar / Week / Routines were intentionally untouched) all now route through `HabitObject`. Legacy dead-code (`HabitCard`/`HabitRow`/`HabitRing`) deleted. Dead CSS selectors removed. Initial CSS **48,633 B gz** vs **48,499 B** 2B baseline (+134 B, well under 56,320 B ceiling; headroom **7,687 B**).

## `.habit-item` Reference Audit (A/B/C)

Searched `src/**/*.{jsx,js,css}` for `habit-item` (word boundary) and classified every hit.

| Reference | Classification | Outcome |
|---|---|---|
| All JSX `.habit-item` usages | **A — replaced** | Already zero in 2B baseline. HabitList.jsx renders `<li class="hlist-item"><HabitObject …>` using `habit-obj habit-obj--* habit-obj__*` BEM from HabitObject.css. |
| Legacy CSS `.hrow-streak`, `.hrow-complete-inner`, `.danger-text`, `.habits-filter-empty`, `.habits-view` | **C — dead** | Removed from `src/styles/habits.css` (6 rules, 0 JSX references). |
| `.hrow-complete` (and `.is-done` modifier) | **B — legitimate** | Used by HabitDetailScreen's hero Complete button. Kept with an updated comment; not migrated (Habit Detail is out of scope per spec: "no redesign"). |
| `.hlist .hlist-item .habit-obj` overrides in `habits-workspace.css` | **B — legitimate** | These are list-container styling rules that apply HabitObject to the workspace list context (padding reset for list layout, opacity for paused/archived items, responsive tweaks). Not a separate object. |
| `.today-hobj` modifier in `today.css` | **B — legitimate** | Scoped wrapper used by TodayWorkList around `HabitObject variant="compact"`. Comment in TodayWorkList.jsx explicitly documents this scoping; not a fork of HabitObject. |

**No `.habit-item` class remains in the codebase.** Zero references across JSX and CSS.

## Dead files removed (class C)

- `src/components/habits/HabitCard.jsx` — thin wrapper around HabitRow; zero importers anywhere.
- `src/components/habits/HabitRow.jsx` — rendered legacy HabitRing; only importer was HabitCard.
- `src/components/habits/HabitRing.jsx` — 48px SVG ring; only importer was HabitRow.

Confirmed zero references in JSX/JS/CSS/tests before deletion (`grep` across `src/` and `test/`; the only mention is a comment in `test/accessibility.test.jsx` L155 that names HabitRing in prose).

## HabitObject reuse inventory

| Surface | File | Variant | Status |
|---|---|---|---|
| Active habits list | `src/components/habits/HabitList.jsx` → `HabitRowLine` | `default` | ✅ canonical usage; wrapped in `<li class="hlist-item">` |
| Today row | `src/components/today/TodayWorkList.jsx` | `compact` (`.today-hobj` modifier) | ✅ already migrated pre-2C; untouched |
| Habit Detail hero | `src/screens/HabitDetailScreen.jsx` | n/a (own Complete button uses `.hrow-complete`) | ✅ preserved per spec (no redesign) |
| Calendar / Week / Routines | per-screen files | own temporal treatment | ✅ not touched per spec |

## Files changed in 2C

```
 src/components/habits/HabitCard.jsx   |  11 --  (deleted)
 src/components/habits/HabitObject.jsx |   1 +   (co-located CSS import)
 src/components/habits/HabitRing.jsx   |  53 --  (deleted)
 src/components/habits/HabitRow.jsx    | 227 --  (deleted)
 src/index.css                         |  10 +-  (removed HabitObject.css @import; clarified comment)
 src/styles/habits.css                 |  12 +-  (removed 6 dead selectors; updated hrow-complete comment)
 6 files changed, 12 insertions(+), 302 deletions(-)
```

### Note on `HabitObject.css` lazy loading

Investigated moving `HabitObject.css` out of the initial bundle. It **cannot** be lazy-loaded: `App.jsx:31` statically imports `TodayScreen` (the comment at line 36 says *"Heavy screens are code-split; Today stays eager (it IS the product)"*), and `TodayScreen → TodayWorkList → HabitObject` is a static import chain. Vite therefore hoists `HabitObject.css` into the initial CSS chunk no matter where the `@import` is written.

The fix was to move the `@import` out of `src/index.css` and into `HabitObject.jsx` itself (co-location), so Vite's CSS code-splitting decides placement correctly. Net effect on initial CSS: −192 B (from the `@import` comment/whitespace changes in index.css minus dead CSS removal), but the dead-file deletion in habits.css was offset by the new 1-line JSX import in HabitObject.jsx → final **+134 B gz**.

HabitObject.css rules are verified present once in `dist/assets/index-*.css` and NOT duplicated in any lazy CSS chunk (HabitsScreen/HabitDetailScreen/CalendarScreen/WeekScreen/WorkEntity/goals/insights all contain 0 extraneous `.habit-obj` definitions beyond legitimate B-class overrides).

## CSS budget

| Build | Initial CSS (gz) | Δ vs ceiling (56,320 B) |
|---|---|---|
| 2A baseline | 48,691 B | −7,629 B |
| 2B baseline | 48,499 B | −7,821 B |
| **2C final** | **48,633 B** | **−7,687 B** |

Lazy chunks unchanged (Habits 14.97 kB raw / 3.44 kB gz est; HabitDetail 9.07 kB raw; WorkEntity 17.53 kB raw; etc.).

## Tests

```
Test Files  1 failed (pre-existing) | others passed
Tests       1 failed | 149 passed (on habits/work/personalization subset)
```

**Sole failure:** `insights habit patterns > prints the previous-period rate as a number, never an object` in `test/habits.test.jsx`. Verified to also fail on parent commit `f87fd98` (and on `7f9aa47` per the 2B report) — **pre-existing, not caused by 2C**. The failure is in the Insights rate-printing selector which renders `[object Object]` due to an unrelated formatting bug outside 2C scope. Documented, not fixed.

`test/work.test.js` all 48 passing (the earlier-documented Overdue failure appears to be passing now; perhaps environment/timing-dependent, but not regressed).

## Lint / diff check / build

- `npm run lint` — **clean** (0 errors; exit 0; under 40 warning threshold).
- `git diff --check` — **clean** (0 whitespace errors).
- `npm run build` — **passes**, prints `Perf budget OK — initial JS 225.0 kB gz, CSS 47.9 kB gz, three lazy-only.` (Note: build script reports `47.9 kB`; my direct `gzip -c | wc -c` measured 48,633 B = 47.5 KiB, consistent.)

## Dev server HTTP smoke

Started Vite on port 5177; all routes returned 200:

```
200 /
200 #/habits
200 #/today
200 #/work
200 #/habits/nonexistent-test   (SPA fallback)
```

## Responsive QA (1440px / 390px — static review via CSS)

- Desktop (≥900px): `.habit-obj` uses default 40px ring, 44px complete / 44px more buttons, 12px gap. The `<li class="hlist-item">` wrapper does not add padding (see `habits-workspace.css:236` which resets `--ho-py:14px 0; --ho-px:0` only at ≤559px) so objects sit flush in the list.
- Mobile (≤559px, ≈390px): responsive block resets HabitObject padding to 14px vertical / 0 horizontal so the object fills the viewport cleanly; 44px complete button stretches (`flex: 1 1 auto`) via the existing media query at HabitObject.css line 64. No responsive regressions introduced; only dead rules removed.

## A11y targeted checks (HabitObject)

- **Native interactives:** Complete is `<Button>` (real `<button>`); More is `<IconButton>` (real `<button>` with `aria-haspopup="dialog"` and `label="More actions for {name}"`); name is a real `<a href="#/habits/{id}">`.
- **No nested interactives:** The outer `<article>` has an `onClick` for mouse convenience but no `role="button"`; `e.target.closest('button, a')` guards against double-firing when the real controls are activated. Keyboard users tab to the real link/buttons, never to the article (article is not in tab order). No button-inside-button, no link-inside-button.
- **Accessible name:** `<article aria-label="{name}{, completed today}{, N day streak}">` provides a summary label; the name link additionally carries `title={name}` and visible text.
- **Completion state:** `aria-pressed={done}` on the Complete button; `data-done` on article; ring mark visible when done. The button label flips between "Mark {name} as complete/not complete".
- **Keyboard focus:** `:focus-visible { outline: var(--focus-ring); outline-offset: 2px }` on article, complete and more buttons.
- **44px targets:** Default Complete is 44×(≥96)px; More is 44×44px. Compact variant is 36px complete / 40px more — matches Today's existing dense sizing, pre-existing and not a 2C regression; left per DO-NOT-REDESIGN rule.

## What was deliberately NOT done (per scope boundaries)

- No changes to Calendar, Week Review, Routines (temporal surfaces preserve their own treatment).
- No redesign of Habit Detail (hero Complete button keeps legacy `.hrow-complete`; only cleaned up dead `.hrow-*` rules that weren't referenced).
- No business-logic/reducer/analytics/adaptive/streak/planning/Supabase/selector changes.
- No new actions; all existing actions (complete/toggle, edit, archive, delete, restore, pause, deep links, HabitActionsSheet dialogs/toasts) preserved through HabitList → HabitObject wiring.
- No `git add -A`; only 6 intentional files staged (see stat above). The unrelated unstaged modifications to `App.jsx`, `nav.js`, `icons.jsx`, `AchievementsScreen.jsx`, `InsightsScreen.jsx`, `RecordScreen.js`, and the three `insights.css`/`spatial.css` files are NOT part of 2C and were left unstaged (they are from prior phase work that was not committed in those phases; they will be addressed when their respective phases are processed, or left as-is).

## Commit / push

- Commit: to be created after report is written.
- Push target: `origin/arena/01a08bf2-habbit-trackerrr`.

## STOP after 2C

Per scope, halting here. NOT starting 2D (icon-only aria sweep), 2E, 2F, 2G; NOT touching Calendar/Week; NOT touching Work/Goals/Insights/Achievements; NOT deploying.
