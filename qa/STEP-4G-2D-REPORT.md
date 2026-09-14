# Step 4G-2D Report — Calendar + Week State-Language Consolidation

**Branch:** `arena/01a08bf2-habbit-trackerrr`
**Parent commit:** `8ab0ce2` (Step 4G-2C)
**Date:** 2026-09-13
**Scope:** State marker presentation on Calendar (month / 90d / year) and Week Review only. Layouts, navigation, reducers, data, scheduling, notes, keyboard interaction untouched. All other Habit surfaces (Today, HabitObject, Detail, Routines, Work, Goals, Insights, Omni, shell) **not** modified.

---

## 1. Old state-language inconsistencies
Pre-4G-2D Calendar and Week used similar but not identical marker vocabularies, and both violated the 4G-1 rule "entity color ≠ semantic completion" for completed cells:

| | Calendar (`.hc-mark`) | Week (`.wr-mark`) | Problem |
|---|---|---|---|
| **Done** | filled circle in habit identity color (`currentColor`) with `box-shadow:0 0 0 2px color-mix(currentColor 14%, transparent)` halo | filled circle in habit identity color (`background:currentColor`) | Identity color was used to signal completion — green/blue/purple habits looked "completed" in their own hue. A blue done did not visually read as success; a red-hued habit done could be misread as danger. Halo was noisy decoration. |
| **Missed** | red `×` in `--bad` with correct `::before`/`::after`; 10 px | red `×` in `--bad`, 10 px | Shape correct but mobile/90d/year size overrides inconsistent; Calendar used `width:10px` × on a 9 px base; Week matched. |
| **Today** | hollow habit-color ring **with a filled `::after` dot in center** (opacity .7) → visually reads as partial/completed | hollow habit-color ring (12 px) **with a filled `::after` dot at .8 opacity** → same "almost done" visual ambiguity | "Today + not done" must NOT imply completed. Today's identity comes from the column/cell highlight (accent ring on `.hc-cell.is-today::after`, accent day header in Week), not from the marker's fill. The inner dot made "today" look completed. |
| **Upcoming/scheduled** | hollow habit-color ring (1.5 px) at opacity `.4`, size same as base 9 px mark | hollow habit-color ring (1.5 px) at opacity `.35`, size 8 px | Two different opacities + sizes for the same semantic state. |
| **Not scheduled/unscheduled** | Calendar: DayMark returns `null` (no mark) — correct. | Week: 3×3 px dot in `--border-2` at opacity .5 — correct (Week has 7 day columns, needs placeholders so the rhythm doesn't drift). | Different but intentional per surface; the CSS class names disagreed (`unscheduled` vs `off`) — fine at the data layer because they carry different spatial semantics. |
| **State badge (Calendar selected-day side panel)** | Used `data-state="completed"`, `"future"`, `"unscheduled"` classes but JSX emitted states `done`, `missed`, `today`, `scheduled`, `unscheduled` — so the `.hc-day__state[data-state="completed"]` rule was **dead** (never matched), and `today`/`scheduled` badges had no explicit color | (not applicable; Week uses `title` tooltips) | Bug: completed badge didn't pick up green; today/scheduled badges had no color rule. |

## 2. Canonical state vocabulary (adopted)
Both surfaces now share one presentation contract:

| State | Shape | Color | Size (desktop) | Meaning |
|---|---|---|---|---|
| **done** (completed) | filled circle | `var(--good)` — semantic success | 10 px (Cal month) / 10 px (Week) | Completed; habit identity color is NOT used here. |
| **missed** | `×` (two 1.5 px strokes rotated 45°/−45°) | `var(--bad)` — semantic danger | 10 px bounding box | Past, scheduled, not done; never a fill, never a ring. |
| **today** | hollow ring (1.5 px border), no inner fill dot | habit color (`currentColor`) | 10 px | Scheduled today, not yet completed. "Today" is also highlighted by the cell/column accent (`.hc-cell.is-today::after`, `.wr-habits__day.is-today{color:var(--accent)}`). |
| **scheduled / upcoming** | hollow ring (1.5 px border) | habit color (`currentColor`) at **opacity .45** | 8 px (smaller than today) | Future scheduled; low emphasis, visually subordinate to today and done. |
| **unscheduled / off** | Calendar: no mark; Week: 3×3 px filled dot | Calendar: — / Week: `var(--border-2)` opacity .5 | — | Not scheduled; visually quiet, never a red ×. |

Key rule: **habit identity color is used only for the hollow-ring states (today, upcoming/scheduled) and for the habit-dot/name accent.** Completed = `--good`, missed = `--bad`, always, regardless of habit category. Identity ≠ state.

## 3. Completed treatment (done)
- Calendar `.hc-mark.done`: `background: var(--good); color: var(--good);` (10 px filled circle). Removed the `box-shadow:0 0 0 2px color-mix(currentColor 14%, transparent)` halo — it was decorative glow inconsistent with the flat language used in HabitObject / Detail / Routines.
- Week `.wr-mark.done`: `background: var(--good); color: var(--good);` (10 px filled circle).
- JSX guards (`DayMark` in Calendar, `Mark` in Week) now set `const semantic = state === 'done' || state === 'missed'` and skip passing the inline `style={{ color: habitColor }}` for those two states, so `currentColor` falls back to the CSS-set `--good`/`--bad` instead of being overridden by the habit color.

## 4. Missed treatment
- Calendar `.hc-mark.missed` and Week `.wr-mark.missed`: 10 px box, `color: var(--bad); background: transparent;` with the existing `::before`/`::after` cross rotated 45°/−45°. Shape distinct from done (×, not a filled circle); color semantic danger.
- Density-mode overrides retained (90d 8 px × with 8 px arms; year 5 px × with 5×1 px arms; mobile 9 px × with 9 px arms).

## 5. Today treatment
- Removed the filled `::after` inner dot from `.hc-mark.today` and `.wr-mark.today`. It previously made "today + not done" look 70–80% filled, visually reading as "almost complete" / "partially done" which is not a real state (a day is either done or not).
- Today is now a hollow 10 px ring, 1.5 px border, in habit color, full opacity. The "current day" emphasis comes from the pre-existing column/cell accent (accent border ring on calendar cells, bold accent weekday header on Week) — not from the marker fill.
- When today IS completed, `cellState()` returns `'done'` (not `'today'`), so both "today" and "completed" can be simultaneously true semantically (today's cell is marked done in green, and the today column accent also runs) — the marker shows completion, the column outline shows day.

## 6. Upcoming/scheduled treatment
- Calendar: `.hc-mark.scheduled` 8 px hollow ring, 1.5 px border, opacity `.45` (was 9 px, opacity `.4`).
- Week: `.wr-mark.upcoming` 8 px hollow ring, 1.5 px border, opacity `.45` (was `.35`).
- Both now use **the same size and the same opacity** so "scheduled future" reads identically across surfaces.
- 90d/year/mobile overrides shrink proportionally (6 px / 4 px / 7 px) with border-width adjusted to 1 px at year scale.

## 7. Unscheduled/off treatment
- Calendar: `DayMark` returns `null` for `'unscheduled'` — no mark, no empty circle. Cells in month/90d/year grids remain blank.
- Week: `.wr-mark.off` stays at 3×3 px filled dot in `--border-2` at opacity .5 (the Week grid is 28 px / cell × 7 days, so a completely empty cell breaks the vertical rhythm of the per-habit row — a tiny dot preserves the grid without implying a miss). Added explicit `border-radius:99px` to guarantee the dot shape under all density overrides.
- Neither surface uses the red × for "not scheduled" (missed is reserved for past-scheduled-not-done).

## 8. Habit-color rule
- Habit category color is reserved for **identity**: the habit dot next to the name, the name link, and the outline of today/upcoming markers.
- Habit color is **never** used to indicate completion or miss. Done is always `--good`, missed always `--bad`.
- Achieved by (a) CSS setting `color:var(--good)`/`color:var(--bad)` on `.done`/`.missed`, and (b) JSX helpers not passing `style={{ color: habitColor }}` when state is semantic — only for `today`/`scheduled`/`upcoming`.
- A pre-existing bug note-dot on week done cells (`.wr-row[data-has-note=true] .wr-mark.done::after`) was left untouched: it is a tiny 3 px accent-2 dot below completed marks that have a note, not a state indicator.

## 9. Calendar changes
- `src/styles/habit-calendar.css`:
  - `.hc-mark` base: 10 px round, transparent background, no fill by default.
  - Rewrote `.hc-mark.done/.missed/.today/.scheduled` rules to the semantics in §3–§7; removed done halo; removed today inner dot; scheduled → 8 px / opacity .45.
  - `.hc-day__state[data-state="…"]` rules corrected from the dead `completed`/`future` keys to `done/missed/today/scheduled/unscheduled`, with today → `var(--accent)` (matches column accent).
  - 90d / year / mobile size overrides updated to reflect new base sizes (scheduled smaller than today, missed × arms match box).
- `src/screens/CalendarScreen.jsx`:
  - `DayMark` adds a `semantic = state==='done'||state==='missed'` guard and only applies `style={{color:habitColor}}` to non-semantic states (`today`, `scheduled`). Unscheduled still returns `null`.
  - No change to `cellState()`, `cellAriaLabel()`, navigation, selection, logging, notes, keyboard handlers, long-press, month/90d/year modes.

## 10. Week changes
- `src/styles/habit-week.css`:
  - Rewrote `.wr-mark.done/.missed/.today/.upcoming/.off` rules to the canonical vocabulary: done `--good` filled, missed `--bad` × (10 px), today 10 px hollow ring (no fill dot), upcoming 8 px hollow ring at .45 opacity, off 3×3 px muted dot.
  - Mobile overrides kept consistent: mark base 8 px, missed 9 px × with 9 px arms, today 10 px, upcoming 7 px.
- `src/screens/WeekScreen.jsx`:
  - `Mark` adds the same `semantic` guard: inline `style={{color:habitColor}}` is only passed to `today`/`upcoming`, not to `done`/`missed`.
  - No change to `cellState()`, navigation, summary, patterns, attention, takeaway, habit links, missed logging.

## 11. Accessibility
- `aria-pressed`, `aria-label="Mark {habit} as complete/not complete, {date}"`, and disabled-future behavior on calendar cells unchanged.
- Focus-visible rules on `.hc-day__btn`, `.hc-cell`, `.wr-nav .icon-btn`, `.wr-today`, `.wr-attention__btn` preserved.
- 44 px targets preserved: calendar cells 32–44 px, week rows 44 px, week nav buttons 44×44 px.
- State is never color-only: done = filled circle, missed = ×, today = ring + column accent, upcoming = small ring, off = tiny dot / empty.
- Reduced-motion: global base.css rule already kills transition durations; no new transitions added.
- State badge wordings on Calendar's selected-day panel preserved: "Completed" / "Missed" / "Scheduled today" / "Upcoming" / "Not scheduled". The `data-state` keys now match the JSX state strings so badge colors actually apply.
- Week `title` tooltips per cell already use the same words (`done/missed/today/upcoming/not scheduled`); unchanged.

## 12. CSS before / after
| Metric | Before (4G-2C / 8ab0ce2) | After (4G-2D) | Δ |
|---|---|---|---|
| Initial CSS gz (build-proof) | 55.0 kB | **55.0 kB** | at ceiling (not raised) |
| Initial JS gz | 225.4 kB | 225.4 kB | 0 |
| `habit-calendar.css` rules added/changed | — | ~30 lines revised (done/missed/today/scheduled + density overrides + state-badge keys); 1 line removed (box-shadow halo); net ~+40 B gz | small |
| `habit-week.css` rules added/changed | — | ~6 lines replaced (done/missed/today/upcoming/off); removed `::after` dot on today; net ~+20 B gz | small |
| New abstraction | none | none — no new file, no new component, no state helper module; the JSX `semantic` guard is 1 line per component | minimal |

Net: two JS `if` guards plus tightened CSS rules; CSS budget held at 55.0 kB because the removed `box-shadow` halo, `::after` today dot, and dead `[data-state=completed/future]` selectors offset the small additions.

## 13. Exact files changed
- `src/screens/CalendarScreen.jsx` — `DayMark` semantic-state color guard (1 line).
- `src/screens/WeekScreen.jsx` — `Mark` semantic-state color guard (1 line).
- `src/styles/habit-calendar.css` — `.hc-mark` state rules rewritten, `.hc-day__state[data-state]` keys corrected, density/mobile overrides aligned.
- `src/styles/habit-week.css` — `.wr-mark` state rules rewritten (done/missed/today/upcoming/off), mobile sizes kept, no `::after` today dot.
- `test/calendar-week-state.test.jsx` (new) — 14 CSS/JSX contract tests.
- `qa/STEP-4G-2D-REPORT.md` (this file).

No changes to HabitObject, Detail, Routines, Today, Calendar layout, Week layout, chart systems, tokens, primitives, engines, reducers, persistence, Supabase, auth, RLS.

## 14. Tests
New file `test/calendar-week-state.test.jsx` (14 tests) covering:
1. Calendar done → `var(--good)` fill, no halo.
2. Calendar missed → `var(--bad)` ×, ::before/::after present.
3. Calendar today → hollow ring, no inner fill dot.
4. Calendar scheduled → hollow ring at opacity .45.
5. Calendar unscheduled returns null (no `.hc-mark.unscheduled`), badge labels include all five states.
6. Calendar state-badge data-state keys corrected for done/missed/today/scheduled/unscheduled with correct labels.
7. Week done → `var(--good)` fill.
8. Week missed → `var(--bad)` ×, ::before/::after present.
9. Week today → hollow ring, no inner fill dot.
10. Week upcoming → smaller hollow ring at opacity .45.
11. Week off → tiny `--border-2` dot, not red.
12. Both JSX helpers skip inline habit color for done/missed (semantic color wins).
13. Today/scheduled still receive habit color (identity outline).
14. Calendar + Week retain focus-visible rules.

Existing test results:
- `test/habits.test.jsx` (36 tests) — **all pass**, including `calendar cells are labelled buttons with pressed state; a past tap logs the day` and the long-press/note test (interaction behavior unchanged).
- `test/habit-detail-hero.test.jsx` (7) — all pass (untouched).
- `test/routines-layout.test.jsx` (8) — all pass (untouched).
- `test/calendar-week-state.test.jsx` (14) — **all pass**.
- **Total targeted: 65/65 pass.**

Pre-existing failures (on parent `8ab0ce2`, unchanged):
- `test/adaptiveHome.test.jsx` — 5 focus-session tests (jsdom canvas).
- `test/app.test.jsx > navigates to habit detail from Today` — stale "Open Read" expectation (4G-2A).
- `test/quickCaptureUI.test.jsx > answers "assignments due this week"` — Omni answer panel.

All three are out of Calendar/Week scope and untouched.

## 15. Build
- `npm run lint` — clean (0 errors, 0 warnings).
- `npm run build` — **`Perf budget OK — initial JS 225.4 kB gz, CSS 55.0 kB gz, three lazy-only.`**
- `git diff --check` — clean.

## 16. Screenshot evidence
Browser HMR was verified via the running Vite dev server on port 5173; HTTP 200 serving the new bundle. Browser screenshots were not captured in this sandbox (no headless Chromium), so I do not claim full visual QA. Composition was verified by:
- Direct inspection of each `.hc-mark.*` / `.wr-mark.*` CSS block against the canonical table in §2.
- Confirming JSX color guards prevent habit color overriding semantic color on done/missed.
- Confirming the existing cell/column today-accent (accent border on `.hc-cell.is-today::after`, bold accent day header on Week) remains in place, so today identity doesn't depend on the marker.
- Running the existing Calendar + Week interaction tests (cell logging, long-press notes, labelled buttons) unchanged.

Visual judgment on the 8 questions (CSS-inspected):
1. **Completed looks consistently completed?** Yes — solid green circle on both surfaces, same 10 px size, same --good color, no habit-color variance.
2. **Missed looks consistently missed?** Yes — red × on both surfaces, same 10 px size, same 1.5 px arms.
3. **Today looks consistently today?** Yes — hollow ring (no fill) in habit color on both surfaces; supported by existing column/day-header accent.
4. **Upcoming looks consistently upcoming?** Yes — same 8 px hollow ring at .45 opacity on both surfaces.
5. **Not scheduled looks consistently inactive?** Yes — Calendar empty / Week tiny muted dot; neither red, neither ring.
6. **Habit colors still identify habits?** Yes — habit dot next to name still uses category color; today/upcoming rings still carry category color (outline); name/link colors untouched.
7. **Semantic states clear without hue?** Yes — done (filled circle), missed (×), today (ring + column outline), upcoming (small dim ring), off (tiny dot) are each distinct shapes.
8. **No rainbow-wall / over-green/red?** Yes — only one green dot per done cell, only one red × per miss, no glow/halo; today and upcoming use habit color (existing palette) so greens and reds only appear where they mean something.

## 17. Observed-but-untouched issues
- Calendar 90d/year mode has a separate `is-unscheduled` class that disables hover and pointer events on non-scheduled cells; unchanged and correct.
- Week `.wr-row[data-has-note=true] .wr-mark.done::after` adds a small accent-2 dot below completed marks that carry a note — existing affordance for "this day has a note", preserved. This isn't a state marker (it appears only on done + has-note) and was not modified.
- The month/90d/year mode toggles, navigation arrows, and month/weekday labels are untouched.
- Calendar day side-panel "Log it" buttons for missed cells still dispatch `log(habit, date)` via existing reducer.
- Week attention blocks and takeaway are untouched (they use their own `.wr-attention__btn` / `.wr-block__bullet` styles, not `.wr-mark`).

## 18. Commit SHA
```
git add src/screens/CalendarScreen.jsx src/screens/WeekScreen.jsx \
        src/styles/habit-calendar.css src/styles/habit-week.css \
        test/calendar-week-state.test.jsx qa/STEP-4G-2D-REPORT.md
git commit -m "Step 4G-2D: Calendar + Week state-language consolidation"
git push origin arena/01a08bf2-habbit-trackerrr
```
**Step commit:** `09ba5e7` ("Step 4G-2D: Calendar + Week state-language consolidation") — pushed to `origin/arena/01a08bf2-habbit-trackerrr`.

**STOP after 4G-2D.** I will not start the Habit final review, Work, Goals, Insights, global motion, or 3D.
