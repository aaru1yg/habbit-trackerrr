# Step 4G-2A — Unify Today habits with the definitive HabitObject

**Branch:** `arena/01a08bf2-habbit-trackerrr`
**Scope:** Replace Today's legacy HabitRow/HabitRing with the canonical HabitObject (compact variant). Only the habit representation inside Today's Work changes — header/NOW/Today's Work structure/signals/tools, WorkRow for assignments/projects/tasks, and all other screens are untouched.

## 1. Old Today habit implementation

`src/components/today/TodayWorkList.jsx` rendered a bespoke `HabitToggle` — a 32px inline SVG ring with custom track/bar/core/dot styles in `src/components/today/today.css` (`.today-row__ring`, `.today-row__ring-track/bar/core/dot`, `.today-row--habit { grid-template-columns:32px 1fr auto; }`). The row used the generic Today WorkRow anatomy (eyebrow "Habit" + name + signals), which produced a different visual dialect from Habits workspace HabitObject: different ring stroke width, different core/dot geometry, different hover, different pressed treatment, different text meta layout. Same habit looked like two products.

## 2. HabitObject integration

- Reused canonical `HabitObject` directly — NO TodayHabitObject/Card/Ring fork.
- Variant used: **`compact`** (28px ring, 2.5px stroke) — existing variant, density matches Today's execution-first rhythm; on mobile HabitObject's built-in media query lifts the complete button to 44px.
- One small CSS hook: `.today-hobj` modifier on HabitObject flattens card chrome (transparent background, zero padding, no border, no border-radius, hides the "More (⋯)" button, hides the "Complete/Completed" text label leaving just the 44px icon-style check button). This is scoped to `.today-hobj` only — Habits-workspace HabitObject rendering is unchanged.
- Habit rows are wrapped in a `li.today-row.today-row--habit-obj` reset to `display:block` so the outer `.today-row` 28/1fr/auto grid doesn't fight HabitObject's internal layout. The row still carries the bottom divider and preserves Today's list rhythm.
- Work items (assignment/project/task/milestone) still use the unchanged WorkRow with rail + %. The list reads as one coherent execution list because both habit and work rows share the same divider/hover rules via `.today-list`.

## 3. Data mapping

Today's existing `buildWorkList` produces `{ kind:'habit', item:h }` — we reuse that item directly without recomputing priority/sorting/scheduling:

| HabitObject prop | Source |
|---|---|
| `habit` | `item` (the raw habit from state) |
| `done` | `isDone(state, item.id, today)` |
| `streak` | `habitStreak(state, item)` (same util Habits workspace uses) |
| `schedule` | `scheduleLabel(item)` ("Every day", "Weekdays", …) |
| `reminder` | `item.reminder` (rendered as 12h time by HabitObject's `formatTime`) |
| `variant` | `"compact"` |
| `scheduledToday` | `true` (buildWorkList already filtered to `isScheduled(h, today)`) |
| `paused` | `Boolean(item.pause)` |
| `archived` | `Boolean(item.archived)` (buildWorkList excludes archived but belt-and-suspenders) |
| `onToggleComplete` | existing `onToggleHabit(item)` → `TOGGLE_CHECKIN` (unchanged) |
| `onDetail` | `(h) => navigate('habits/' + h.id)` |
| `href` | `#/habits/${item.id}` (keyboard/accessible name link) |
| `className` | `"today-hobj"` |

Status/atRisk are intentionally NOT passed — Today is execution-first; status ("Completed") is already conveyed by ring + pressed state, and HabitObject suppresses redundant "Completed" text in that case (same rule as Habits workspace). No new data calculations introduced; sorting/prioritization/deadline/Next Best Action all untouched.

## 4. Preserved behaviors

- Completion toggle still dispatches `TOGGLE_CHECKIN` — same reducer, same undo semantics.
- Card click (outside buttons/links) → navigates to habit detail; name is a real focusable `<a>` (keyboard accessible, no nested interactive violation).
- Streak displays flame + N-day count (same as Habits workspace).
- Reminder time renders in 12h format.
- Schedule label shows ("Every day", etc.).
- Completion button uses canonical aria-label "Mark X as complete / as not complete" (Step 4G-1 consistency).
- No More (⋯) button in Today (execution-first: complete + detail are the only actions needed; More belongs in the Habits workspace).
- Work rows (assignments/projects/tasks/milestones) are untouched — still use WorkCheckButton + rail + go-link.
- Dividers/hover/focus-within list rhythm preserved.

## 5. Density / variant choice

`variant="compact"` was chosen over default (40px) / featured (56px):
- 28px ring visually subordinate to NOW's 72px signature ring (today hierarchy preserved).
- Compact meta uses 11px caption type matching Today's other signals.
- Compact complete button stays at 44px hit target via `.today-hobj .habit-obj__complete{--btn-h:44px}` override (mobile WCAG).
- No text label on Complete ("Completed" label hidden) — keeps rows to one visual line, dense enough for Today.
- Row padding tightened to 7px vertical so Today's work list doesn't grow; rows still meet 44px via the button height.

## 6. Completion / color behavior

Same as Habits workspace (no new dialect):
- Ring fill → `--cat-color` (habit identity)
- When done → ring fill switches to `--color-success`, check mark appears, ring dot fades out, name desaturates to `--text-secondary`.
- Button in pressed state → `--color-success` soft background + success text+border.
- No "flood everything green"; identity color stays on hover/focus accents only.

## 7. Accessibility

- Semantic `<article>` per habit, with computed aria-label including name + completed state + streak.
- Name is a real keyboard-focusable `<a href="#/habits/:id">` (fixes legacy Today issue where the whole row used mouse-only click-to-detail with no keyboard path).
- Complete button uses `aria-pressed` + canonical "Mark X as complete" label.
- Focus-visible outlines preserved (inherited from HabitObject CSS).
- Reduced-motion transition suppression preserved.
- No nested interactives (article has onClick that ignores clicks on `button, a`; same guard used in Habits workspace).
- 44px hit target on the completion button.

## 8. Mobile (390×844 / 430×932)

- HabitObject's built-in compact mobile media query already lifts the complete button to 44px flex-row; `.today-hobj` keeps that.
- Outer list still scrolls vertically as before; no horizontal overflow introduced (HabitObject uses `minmax(0,1fr)` for body column).
- Rows kept short (single visual line) so the NBA stays above the fold.
- Typography is NOT shrunk below HabitObject's existing compact specs (11px meta, 14px name).

## 9. Desktop (1440×900)

- `.today-hobj` override renders transparent with 7px vertical padding; habits sit flat in the editorial list (no floating cards that would turn Today into a Habit-management dashboard).
- NOW ring still dominates (72–84px); habits rows are visually lighter.
- Work items and habits read as ONE list (shared divider, shared hover).

## 10. Legacy references removed

Deleted from `src/components/today/today.css` (dead, no JS references remain):
- `.today-row--habit { grid-template-columns: 32px 1fr auto }`
- `.today-row__ring` (block)
- `.today-row__ring svg`
- `.today-row__ring-track`
- `.today-row__ring-bar`
- `.today-row__ring-core`
- `.today-row__ring-dot`
- `.today-row__ring[aria-pressed="true"] .today-row__ring-core`
- `.today-row__ring:hover .today-row__ring-core`
- `.today-row__ring:focus-visible`
- Stray leftover selector fragment from the regex strip

Deleted from `src/components/today/TodayWorkList.jsx`:
- Inline `HabitToggle` component (SVG ring + dot logic replaced entirely by HabitObject).
- Habit-specific signal rendering inside WorkRow (streak/Today/estimate signals now live inside HabitObject's meta).

Classifications:
- **ACTIVE elsewhere**: none of the deleted selectors are referenced outside Today.
- **DEAD**: all the `.today-row__ring*` rules.
- **KEPT (scoped)**: `.today-row__lead-mark`, `.today-row--danger/warning/done`, `.today-row__rail/progress-cluster` — still used by work items.

HabitObject component itself was NOT forked, NOT extended with Today-specific branches. The only coupling is the `.today-hobj` class name used for scoped CSS overrides.

## 11. Exact files changed

- `src/components/today/TodayWorkList.jsx` — Habit rows now render `<HabitObject variant="compact" className="today-hobj">`; work-item row preserved inline; deleted `HabitToggle`; imported `habitStreak`, `scheduleLabel`, `HabitObject`, `navigate`.
- `src/components/today/today.css` — removed legacy `.today-row__ring*` blocks (~1 KB uncompressed), added `.today-row--habit-obj` reset + `.today-hobj.habit-obj--compact` scoped overrides (flatten card chrome, hide More/Complete label, keep 44px complete button).
- `test/today-step3-audit.test.jsx` — updated "restrained inline rings" assertion to reflect canonical HabitObject (28px compact ring, `.today-hobj`, no `.today-row__ring`), added a §4G-2A regression block (3 tests: HabitObject presence + canonical labels + detail link, completion toggle dispatches, no More button).

## 12. Tests

```
✓ test/habits.test.jsx         (36 tests)
✓ test/habit-calendar.test.jsx (10 tests)
✓ test/habit-object.test.jsx   (18 tests)
✓ test/today-step3-audit.test.jsx (20 tests, incl. 3 new §4G-2A)
✓ test/unlocks.test.jsx        (2 tests)
─────────────────────────────────────
86 passed / 0 failed
```

- ESLint clean on all edited JSX.
- `git diff --check` clean.

## 13. Build

```
✓ built in ~6s
Perf budget OK — initial JS 225.4 kB gz, CSS 54.9 kB gz, three lazy-only.
```

- JS: 225.4 kB gz (budget 236 kB — change came from HabitObject.jsx already being in the initial bundle via HabitsScreen; Today now imports it directly rather than duplicating ring code).
- CSS: 54.9 kB gz (budget 55 kB — net even because we removed ~1 KB of dead `.today-row__ring*` rules and added ~0.5 KB of `.today-hobj` overrides).

## 14. CSS size

54.9 kB gz (at ceiling); no legacy `.btn` or new visual system introduced. HabitObject CSS (already loaded) is reused — zero duplication.

## 15. Observed-but-untouched issues (out of 4G-2A scope)

- NOW/Today's Work/Today Signals/Tools structure unchanged.
- Work rows still use bespoke rail + check (Work unification belongs to a future step, not 4G-2A).
- Bottom navigation, Today Hero, Omni, AdaptiveCommandCenter all untouched.
- Legacy HabitRow/HabitRing components: Today was the last in-house renderer of the 32px ring, but `HabitRing.jsx`/legacy component files were NOT searched for other consumers or deleted — left for a global legacy-cleanup pass to avoid touching Work/TodayHero/NowRing that share geometry.
- Completion button on mobile for Today-habit is 44px; text label hidden keeps row to one line. If design later wants the label back, remove `.today-hobj .habit-obj__complete-label{display:none}`.

## 16. Commit SHA

To be committed/pushed as `Step 4G-2A: Unify Today habits with canonical HabitObject`.
