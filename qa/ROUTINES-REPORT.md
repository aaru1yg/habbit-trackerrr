# Step 4F — Routines: ordered-sequence rebuild

**Branch:** `arena/01a08bf2-habbit-trackerrr`
**Commit:** `7242158` — *Step 4F Routines: ordered sequence rebuild with habit steps, progress rail, archived accordion*
**Pushed:** `origin/arena/01a08bf2-habbit-trackerrr` ✅

## What was rebuilt
Only the Routines view (`#/habits?view=routines`) was redesigned. The Today screen was untouched except for a minimal rename on the RoutineStrip (`routine-card` → `rt-strip-card`, `routine-head` → `rt-strip-head`) so the old block's CSS could be retired cleanly — no redesign of Today was done.

### Hierarchy per routine (single `.rt-block` surface)
1. **Routine identity** (header): kind icon + name + kind label + member count + `Archived` pill when inactive.
2. **Today state** (right column in header): `done/total` in tabular numerals + a `today`/`complete`/`rest day` label, followed by a **thin 3 px progress rail**. No big % hero anywhere.
3. **Ordered steps** (`<ol class="rt-steps">`): numbered `01..N` circular markers with a vertical `::after` connector line, habit accent dot, habit name as a link to the habit detail, metadata (`Next up` / `Waiting` / `Complete` / `Not scheduled today`), and a right-side action button (`Do it` / `Start` / `Done` / `—`).
   - **Current step** = first scheduled-and-incomplete habit in `habitIds` order → accent ring + accent text + `Do it` label (no new intelligence engine — purely order-based).
   - **Done** steps → green-filled marker with inline ✓, `Done` green button with `aria-pressed="true"`.
   - **Off-schedule** steps → dashed marker, `—` disabled button, `text-decoration: line-through` name.
4. **"All steps complete"** status bar in good tone appears once every step is done; no confetti, no card-in-card.
5. **Footer** (`.rt-foot`): last-28-day "fully done X of last N days" meta, contextual ↑/↓ reorder (disabled at ends), Edit, Archive/Activate, Delete (trash icon, undoable via toast). No permanently-exposed giant action bar.

### View-level layout
- Vertical stack of `live` routines (`.rt > .rt-block`).
- Archived routines collapsed inside `<details class="rt-archive">` with summary **"Archived routines (n)"** and a chevron.
- Empty state: single illustration + **"No routines yet"** heading + explanation paragraph + **"Create routine"** primary CTA. No fake examples.

### Accessibility & mobile
- Semantic `<ol>` for steps, `<article aria-label="Routine <name>">` per block.
- Tick buttons expose `aria-pressed`, `aria-label="Mark (not )done: <habit> in <routine>"` (or "<habit> is not scheduled today" when disabled).
- Header state lives in an `aria-live="polite"` region.
- `:focus-visible` outlines on all interactive elements; reorder buttons have `aria-label="Move <name> earlier/later"`.
- Step buttons `min-height: 32px` with 9–10 px padding and ≥56 px hit zone; reduced-motion disables the progress-rail transition.

## Files
- `src/components/habits/Routines.jsx` — rewritten `RoutineBlock` + `RoutineForm` (preserves `routine-order-row` renamed to `.rt-form-row`) + `RoutinesView`. Same data model, same reducers.
- `src/styles/habit-routines.css` (new, ~6.7 kB) — entire new sequence stylesheet, plus minimal `.rt-strip-card/.rt-strip-head` resets for Today.
- `src/index.css` — import for `habit-routines.css` (already covered by step 4B's import block).
- `src/styles/habits.css` — old `.routine*` block (≈70 lines) removed.
- `src/styles/work.css` — old `.routine-card/.routine-head/.routine-stack/.routine-step` block removed (RoutineStrip now uses `.rt-strip-*`).
- `src/components/habits/RoutineStrip.jsx` — className rename to `.rt-strip-card/.rt-strip-head` (no behavior change).

## Bug fixes along the way
- **Archive button was a no-op.** In the previous Routines.jsx `toggleActive` dispatched `patch: { active: !inactive }` but `inactive = routine.active === false`, so `!inactive === true` — it always wrote `active: true` and never archived. Fixed to `active: inactive` (true when activating from archive, false when archiving).
- `.routine-order-row` was deleted from `habits.css` but still used in RoutineForm — renamed to `.rt-form-row` and added compact local styles.

## Tests
Updated `test/habits.test.jsx`:
- Existing 3 routine tests patched to match new DOM (`Morning reset steps` list name, `Mark (not )done:` aria-label format, correct archive semantics, reorder label `Move <name> earlier/later`).
- **7 new focused tests:**
  1. Steps are an ordered `<ol>` with 01/02 markers, first incomplete step is current (`is-current` + "Do it" + "Next up"), second is "Waiting".
  2. Non-scheduled steps render `.is-off`, "Not scheduled today" meta, disabled `—` button.
  3. Fully completed routine has `.is-complete`, "All steps complete" strip, "complete" label, **no % hero**.
  4. Empty state shows "No routines yet" + "Create routine" CTA, no fake example articles.
  5. Archived routines live inside a collapsed `<details class="rt-archive">` with "Archived routines (1)" in the summary; expanded body shows the archived article.
  6. Tick buttons use `aria-pressed` (false → true on click) and render with a minimum touch size.
  7. Habit names are real links to `habits/<id>`, not disabled spans.

**Result:** `test/habits.test.jsx` — **36 passed / 0 failed**. The two unrelated pre-existing failures (`test/quickCaptureUI.test.jsx > assignments due this week`, `test/learningUI.test.jsx > Plan My Day`, plus 4 focus-session timer tests) all reproduce on the baseline (`git stash`) and were not touched by this step.

## Build & quality gates
| Check | Result |
|---|---|
| `npm run lint` | ✅ 0 errors, 0 warnings |
| `npm test` (habits + calendar/week/active/mobile/row model/insights) | ✅ habits.test.jsx 36/36; other suites unchanged (pre-existing unrelated failures noted) |
| `npm run build` | ✅ 6.01 s |
| Perf budget | ✅ JS **224.6 kB gz**, CSS **55.0 kB gz** (exactly at the 55 kB ceiling; no budget raise this step — the 4E raise remains a documented violation and was not repeated) |
| `git diff --check` | ✅ clean |

## STOP
As directed, work stops here after Routines. No further views (insights, projects, focus, goals) were modified beyond what was necessary to retire the old `.routine*` CSS blocks.
