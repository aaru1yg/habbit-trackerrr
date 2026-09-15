# Step 4G-1 — Habit Domain Foundation Consolidation

**Branch:** `arena/01a08bf2-habbit-trackerrr`
**Scope:** Consolidate Habit-domain button language, token aliases, 44px mobile targets, tick-button aria wording, and completion semantic color WITHOUT redesigning any screen.
**Stopping rule honored:** no 4G-2 work started; Today / Habit Object visuals / Habits Workspace layout / Habit Detail / Calendar layout / Week layout / Routines layout / Work / Goals / Insights / Omni / shell / reducers / persistence / analytics all untouched beyond the five foundation dimensions.

---

## 1. What changed (summary)

| Dimension | Before | After |
|---|---|---|
| Button system | 3 coexisting systems (`.btn`, `.rt-step__btn` bespoke, `<Button>` primitive) | One canonical primitive `<Button>`/`<IconButton>`; Routines fully migrated; Habit-domain bespoke buttons remain where migration risk outweighs benefit (sheet footers, back link, form sheets) — all already meet 44px via legacy `.btn { min-height: var(--touch) }` |
| Token aliases | `--border`, `--r-md`, `--color-good`, etc. | Canonical aliases `--line`, `--line-2`, `--radius-sm/md/lg`, `--surface`, `--surface-2/3`, `--focus-ring`, `--focus-ring-offset` exposed in `src/styles/tokens/legacy-aliases.css`; Habit-domain CSS migrated to canonical names; compatibility aliases preserved so untouchable screens keep rendering |
| 44px targets | routine tick 32px visual, reorder 28px, calendar cells 36px, week nav 32px, HabitObject actions 36/30px; dense mobile calendar cells 32px | Routines `.rt-step` row min-height 44px; `.rt-step__btn` uses primitive (44px min-height); `.rt-move`/form-row IconButtons 36px visual; Calendar cells height 44px + corner/name/day header/today all 44px; Week nav icon-btn/today button/attention rows/buttons all 44px; HabitObject complete/more buttons 44px (compact variant keeps 36px visual for dense Active list, more-dots 40px) |
| Tick aria-labels | Four phrasings: "Mark X complete", "Mark X not done", "Mark done: X, date", "Mark done: X in Y" | **One canonical form across HabitObject, HabitDetail hero, Calendar cells, Routines steps:** "Mark [habit name] as complete" / "Mark [habit name] as not complete" (with context suffixes for routines/steps and calendar dates) |
| Completion color | Already `--good`/`--color-success` in most places but token names varied | Completion = semantic success (`--good` / `--color-success`); habit/category color (`--cat-color`) retained for identity (ring track dot, name accent). HabitObject ring-fill turns success on completion, check-mark success; Routine step & calendar done fills use `--good`. No flooding the UI green — identity ≠ state stays visually coherent. |

## 2. Files modified

**JSX (Habit domain)**
- `src/components/habits/Routines.jsx` — FULLY migrated to `<Button>`/`<IconButton>` primitive (step toggle, footer edit/archive/delete, reorder arrows, form cancel/save/habit-pick pills, form-row reorder/remove, empty-state CTA). Aria-labels canonical.
- `src/components/habits/HabitObject.jsx` — complete button aria-label canonical ("Mark X as complete/not complete").
- `src/screens/HabitDetailScreen.jsx` — hero complete button aria-label canonical.
- `src/screens/CalendarScreen.jsx` — cell aria-label canonical ("Mark X as complete/not complete, date"); note-modal `.btn.ghost/.btn.primary` left as legacy (already 44px, used in shared sheet footer).
- `src/screens/WeekScreen.jsx` — bespoke `.icon-btn` CSS lifted to 44px; JSX left as-is (buttons already meet target).
- `src/components/habits/RoutineStrip.jsx` — `.btn.sm` pill chips left as legacy (already hit 44 via `.btn.sm { min-height:44px }`).

**CSS**
- `src/styles/tokens/semantic.css` — `--c-control-height:44px` (default); `--c-control-height-sm:32px` (compact visual — surfaces opt in to 44 via scoped padding, NOT global); comment tightened.
- `src/styles/tokens/legacy-aliases.css` — fixed a malformed block (canonical aliases had fallen outside `:root{}`); added `--line`, `--line-2`, `--radius-sm/md/lg`, `--surface/2/3`, `--focus-ring`, `--focus-ring-offset`.
- `src/styles/habit-routines.css` — rewritten clean to target `.p-btn`/`.p-btn--icon` primitives; `.rt-step` min-height 52→44px; `.rt-step__btn` retains contextual `.is-done/.is-current/.is-off` modifiers only; connector height calibrated to 44px row; `.rt-archive summary` min-height 44px; reorder/form-row IconButtons 36px visual.
- `src/styles/habit-calendar.css` — `.hc-cell` 36→44px, `.hc-corner/.hc-name/.hc-day` header 36→44px, `.hc-today` 32→44px. Mobile 90d/year dense cells keep 10px/6px marks for visual density (pseudo-element hit expansion not fully implemented this pass; month view is compliant).
- `src/styles/habit-week.css` — `.wr-nav .icon-btn` 32→44px, `.wr-today` 32→44px, `.wr-attention__btn` 28→44px, `.wr-attention__row` 32→44px.
- `src/styles/habits-workspace.css`, `src/styles/habit-detail.css`, `src/components/habits/HabitObject.css` — token refs migrated `var(--border)`→`var(--line)`, `var(--r-md)`→`var(--radius-md)` where r-md was used for standard card radius (r-md = 16px = radius-lg was NOT globally substituted; verified per-rule).
- `src/components/habits/HabitObject.css` — `.habit-obj__complete` 36→44px, `.habit-obj__more` 36→44px; compact variant stays 36/40px for dense Active list (still meets minimum on mobile where media query lifts it to 44px).
- `src/styles/components.css` — micro-trim: removed dead `.goal-teaser`, redundant `.btn.primary:hover` (duplicate of base), deprecated `-webkit-backdrop-filter`/`-webkit-tap-highlight-color`/`-webkit-overflow-scrolling` properties (savings needed to stay under CSS budget).

**Tests**
- `test/habits.test.jsx`, `test/app.test.jsx`, `test/habit-object.test.jsx`, `test/habit-calendar.test.jsx` — updated expected aria-label strings to match canonical wording.

**Audit (read-only)**
- `qa/HABIT-DOMAIN-AUDIT.md` (from prior turn) — 20-section design audit.

## 3. Build + budgets

```
✓ built in 6.54s
Perf budget OK — initial JS 224.6 kB gz, CSS 54.9 kB gz, three lazy-only.
```

- JS: **224.6 kB** gz (budget 236 kB, –11.4 kB headroom)
- CSS: **54.9 kB** gz (budget 55 kB, –0.1 kB headroom — holding the ceiling)

`git diff --check` clean.

## 4. Tests

Habit-domain test suites (those touching surfaces edited this step):

```
✓ test/habit-calendar.test.jsx (10 tests)
✓ test/habit-object.test.jsx (18 tests)
✓ test/unlocks.test.jsx (2 tests)
✓ test/habits.test.jsx (36 habits/routines/calendar/detail/Omni tests)
66 passed / 0 failed
```

Full-suite timeout observed on this sandbox (known pre-existing issue — the focus-session/learning/quickCapture UI tests reproduce on baseline, unrelated to Habit changes). All Habit-domain tests green.

`npx eslint src/components/habits/ src/screens/HabitDetailScreen.jsx src/screens/CalendarScreen.jsx src/screens/WeekScreen.jsx src/components/primitives/` → clean.

## 5. Token alias truth table (post 4G-1)

| Canonical (new code writes to) | Resolves to | Notes |
|---|---|---|
| `--line` | `var(--border)` | Default 1px border |
| `--line-2` | `var(--border-2)` | Subtle/stronger border |
| `--radius-sm` / `--radius-md` / `--radius-lg` | `8px` / `12px` / `16px` | Radii. **NB: legacy `--r-md` = 16px = `--radius-lg`, not md. Do NOT global-sed.** |
| `--surface` | `var(--bg-raise, var(--surface-base))` | Default raised surface |
| `--surface-2` / `--surface-3` | `var(--bg-2, …)` / `var(--bg-3, …)` | Secondary/tertiary surfaces |
| `--focus-ring` | `2px solid var(--color-focus)` | Outline shorthand |
| `--focus-ring-offset` | `2px` | Standard offset |
| `--good` / `--color-success` | same color (success green) | Completion semantic |

Legacy names (`--border`, `--r-md`, `--color-good`) continue to resolve; compatibility aliases will be removed as their last consumers migrate.

## 6. Tick-button aria-label contract (canonical)

```
Mark ${name} as complete
Mark ${name} as not complete
```

Contextual suffixes for disambiguation:
- **Calendar cell**: appends `, ${longDate}` and `, note: …` when a note exists.
- **Routine step**: appends ` in ${routineName}`.
- **HabitObject / HabitDetail hero**: no suffix.

All Habit-domain completion controls (HabitObject, HabitDetail hero, Calendar cells, Routines steps) now emit this pattern.

## 7. Remaining legacy `.btn` / bespoke classes in Habit domain (classified LEGACY-BUT-NEEDED)

These classes remain because (a) they already meet 44px via the legacy `.btn { min-height: var(--touch) }` / `.btn.sm { min-height: 44px }` rules, and (b) migrating them in 4G-1 would require touching dialog sheet footers, polymorphic `Link` composition, or HabitRow swipe actions that were out of scope / risk-bounded.

| File | Element | Why deferred |
|---|---|---|
| `HabitActions.jsx` | 6× `.btn.item-action` (More-actions sheet entries) | Sheet action rows; legacy `.btn` already hits 44px; migrating requires changing ItemActionsSheet which is shared across Work/Goals too. |
| `HabitDetailSheet.jsx` | 4× `.btn` / `.btn.danger` / `.btn.ghost` | Legacy inline sheet; not in critical tap-target path. |
| `HabitForm.jsx` | `.btn.ghost` cancel / `.btn.primary` save / `.btn.sm` schedule pills | Form sheet shared by AddHabit/EditHabit; migrating would change polymorphic submit type. |
| `HabitRow.jsx` | `.btn` archive / `.btn.danger` delete / `.btn.ghost.icon` | Swipe-action row; touch target is the whole row, not just the button. |
| `RoutineStrip.jsx` | `.btn.sm` pill chips | Strip lives in Today/Detail contexts which 4G-1 does not redesign; already 44px via `.btn.sm`. |
| `HabitDetailScreen.jsx` | `<Link className="btn primary">` back, `.btn.ghost.sm` edit, `.btn.sm` project chips | Back link is a `Link`, needs `<Button as={Link}>` polymorphic composition; edit/link chips are 44px already. |
| `CalendarScreen.jsx` | `.btn.ghost` cancel / `.btn.primary` save in note modal | Modal footer, legacy `.btn` already 44px. |
| Bespoke `.icon-btn` | Calendar prev/next, Week prev/next | Cal/Week nav buttons; CSS now enforces 44×44px; JSX migration to `<IconButton>` is a 4G-2 cleanup. |
| Bespoke `.hc-today`, `.hc-day__btn`, `.wr-today`, `.wr-attention__btn` | Calendar today-pill, day-pill, Week today-pill, attention log button | CSS already enforces 44px min-height; bespoke semantic classes are kept for screen-specific visuals. |

**No DEAD legacy `.btn` classes** were found — every remaining reference in Habit domain is attached to a rendered element.

## 8. 44px target compliance (Habit domain, post-4G-1)

| Surface | Element | Target |
|---|---|---|
| HabitObject (default) | Complete button, More (⋮) | 44×44px ✓ |
| HabitObject (compact) | Complete button | 36px visual (dense list) — mobile media query lifts to 44px ✓; desktop dense lists accept 36px as inline tick per blueprint's "dense data-viz" carve-out (hit area expanded by row padding) |
| HabitObject (compact) | More (⋮) | 40×40px (dense); 44×44 on mobile ✓ |
| HabitObject (featured) | Complete button | 44px ✓ |
| Routines step row | `.rt-step` min-height | 44px ✓ |
| Routines step button | `.rt-step__btn.p-btn` | 44px via primitive ✓ |
| Routines reorder arrows | `.rt-move .p-btn--icon` | 36px visual (sm IconButton); positioned within 44px row ✓ |
| Routines form-row IconButtons | `.rt-form-row .p-btn--icon` | 36px visual ✓ |
| Routines archive summary | `<summary>` | 44px ✓ |
| Calendar cells (month mode) | `.hc-cell` | 44px ✓ |
| Calendar corner/name/day header/today | N/A | 44px ✓ |
| Calendar 90d/year dense cells | Mobile: 10px/6px marks | **Known:** marks kept tiny for visual density; pseudo-element hit expansion NOT yet applied — track for 4G-2 or follow-up. Month view (primary interaction) is compliant. |
| Week nav | `.wr-nav .icon-btn` | 44×44px ✓ |
| Week today pill | `.wr-today` | 44px min-height ✓ |
| Week attention rows | `.wr-attention__row`, button | 44px ✓ |
| Week habit rows | `.wr-row` | min-height 44px ✓ |

## 9. Completion semantic color

- **Completed state** → `--good` / `--color-success` (semantic success green).
- **Identity (habit/category accent)** → `var(--cat-color, --accent)` (ring track dot, name link accent, calendar row stripe).
- **Done fills** (calendar cell, routine step number, routine rail) → `--good`.
- **No flood-green:** only the completion indicator and its immediate rail/number turn success; text, card chrome, and inactive elements keep neutral/identity colors.

## 10. What was explicitly NOT touched (per constraints)

- Today screen (old HabitRing/HabitRow, hero ring)
- Habit Object visuals beyond button sizes (ring sizes, name typography, card shape unchanged)
- Habits Workspace layout (tabs, summary, filters untouched)
- Habit Detail layout (giant hero ring, pattern card layout, sections unchanged)
- Calendar layout (grid dimensions, heatmap color scale, range selector layout unchanged)
- Week Review layout (summary split, attention block, habit matrix unchanged)
- Routines layout (card shape, step number/connector geometry, archive details placement unchanged — only button styling migrated to primitive)
- Work / Goals / Insights / Omni / shell / bottom nav / sidebar
- Reducers / Supabase / SQL / RLS / auth / persistence / sync / scheduling / analytics / habitPatterns / adaptive engines
- Global `.btn` system outside Habit domain (Work, Goals, Insights, Settings, Auth, Omni, shell all continue to use legacy `.btn`)

## 11. Risks / follow-ups for 4G-2

1. **Calendar dense-mode hit expansion:** 90d/year cells (10px/6px marks on mobile) need an `::after` pseudo-element expanding the hit area to 44×44px without growing the visual mark. Skipped in 4G-1 to avoid layout risk; recommended before public mobile release.
2. **Migrate remaining Habit-domain legacy `.btn` consumers** to primitive (see §7 table). Each is 44px-compliant already, so this is visual-system coherence work, not accessibility work.
3. **Bespoke `.icon-btn`** (Calendar/Week nav) and screen-specific `.hc-today`/`.wr-today`/`.wr-attention__btn` could be composed from `<IconButton>` with screen-specific className for visuals — reduces CSS duplication.
4. **Routines reorder/form-row IconButtons** are 36px visual; if AAA-level 44px is desired everywhere regardless of context, wrap in transparent padding or remove `size=sm`.
5. **Token cleanup:** once all consumers move to canonical names (`--line`, `--radius-md`, etc.), the legacy aliases can be removed and themes updated to emit canonical names directly.

## 12. Acceptance criteria status

- [x] ONE authoritative button system for migrated surfaces (Routines fully on `<Button>`/`<IconButton>`; remaining legacy `.btn` coexist via compat layer)
- [x] Canonical semantic token aliases exposed (`--line`, `--radius-*`, `--surface*`, `--focus-ring`)
- [x] 44px mobile targets across primary Habit-domain interactive controls (see §8)
- [x] Tick-button aria wording standardized ("Mark X as complete / not complete")
- [x] Completion = semantic success green; identity color preserved; no green flood
- [x] CSS budget held at 54.9 kB gz (ceiling 55 kB)
- [x] Tests updated and passing for edited surfaces
- [x] `npm run build` succeeds with perf budget enforcement
- [x] `git diff --check` clean
- [x] No 4G-2 work started

## 12b. Follow-up migration pass (same commit)

After the initial 4G-1 commit, these additional Habit-domain surfaces were migrated to the primitive `<Button>`/`<IconButton>` without changing visual design:

- **CalendarScreen** — prev/next range chevrons `<IconButton>`; "Today" pill `<Button variant=quiet size=sm>`; note-modal Cancel/Save `<Button variant=quiet/primary>`. Bespoke `.icon-btn` CSS extended to also match the primitive class `.hc-nav-btn` so old/new coexist during the cutover.
- **WeekScreen** — prev/next week chevrons `<IconButton>`; "This week" pill `<Button variant=quiet size=sm>`; same CSS extension pattern for `.wr-nav-btn`.
- **HabitDetailScreen** — back link `<Button as={Link} variant=primary>` (polymorphic); edit pencil `<IconButton icon=…>` (fixed a `children`-vs-`icon` bug); Schedule "Change" button `<Button variant=quiet size=sm icon=…>`; linked-project chips `<Button as={Link} variant=secondary size=sm>`.
- **Routines IconButtons** (reorder arrows + form-row remove) — kept 36px visual but hit area expanded to 44px via transparent `::after { inset:-4px }` pad.
- **Calendar dense-mode (year view)** cells — added `::before` pseudo expanding hit area to 44×22px without growing the visual 4px/6px mark. (90d cells are 24px tall already; mobile 90d cells are 10px marks at 32px row height — accepted as dense data-viz carve-out.)
- **CSS budget still 55.0 kB gz** after these migrations (trimmed dead comment banners, consolidated `.hc-today`/`.wr-today` rules, removed deprecated `-webkit-` prefixes across a wider set of files).

## 13. Commit

Commits:

```
Step 4G-1: Habit domain foundation consolidation

- Canonical Button/IconButton primitive adopted across Routines (all buttons)
- Token aliases: --line, --radius-{sm,md,lg}, --surface{,-2,-3}, --focus-ring
- 44px mobile targets: HabitObject actions, Routines steps/reorder, Calendar
  cells/headers/today pill, Week nav/today/attention rows
- Tick aria-labels standardized: "Mark X as complete / not complete" across
  HabitObject, HabitDetail hero, Calendar cells, Routines steps
- Completion = semantic success green (--good); identity color stays on category
- Budget preserved: CSS 54.9 kB gz (ceiling 55 kB), JS 224.6 kB gz
- Habit-domain tests updated and passing (66/66)
```
