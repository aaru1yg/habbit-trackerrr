# HABIT DOMAIN DESIGN AUDIT

**Scope:** Read-only product/design consistency review across the six completed Habit surfaces (Active, Detail, Calendar, Week, Routines) plus Today's habit presentation. **No code was changed.**
**Date:** 2026-09-13 · branch `arena/01a08bf2-habbit-trackerrr` · commit `7242158`
**Build state:** JS 224.6 kB gz · CSS 55.0 kB gz (at ceiling) · tests green within the habit suite.

---

## 1. Overall verdict

The Habit domain is **functionally complete** and **structurally coherent**, but it is not yet *visually* one product. Three distinct visual systems sit side-by-side in the same domain:

1. The **new primitive/token system** (Surface, Stack, Button, primitives.css, tokens/) used by HabitObject, Habits Workspace, Habit Detail, Week Review.
2. The **post-blueprint Routines** sequence design (`.rt-*`) built directly against the new tokens but with its own bespoke class vocabulary and its own button/rail/connector language.
3. The **legacy V4 Calendar** (`.hc-*`), the legacy V4 Today habit/HabitRing presentation, and chunks of legacy V4 CSS (`habits.css`, `components.css`, `work.css`, `base.css`, `system.css`) that still ship because the rebuild is only partial.

The result is an experience where **Habit Detail → Week → Routines → Calendar feel like four different apps glued together by a shared nav and a shared data model**. The data model and reducer layer are pristine; the visual system and the target/padding/typography contracts are not.

The good news: the architecture to fix this is already in place (tokens, primitives, semantic surface, `--accent`/`--good`/`--warn`/`--bad`, category color derivation via `--cat-<area>`). It just needs to be *applied consistently* once the next domain starts.

**Coherence score: 6 / 10.**
Solid data layer and strong individual surfaces, but the six surfaces do not yet read as one Habit OS.

---

## 2. Visual consistency

### Typography
- **HabitObject/Habits Workspace/Habit Detail/Week** use the new Inter + Manrope mix and the `--fs-*` fluid scale (`--fs-display`, `--fs-h1`, `--fs-base`, `--fs-sm`, `--fs-xs`, `--fs-micro`) plus `font-variant-numeric: tabular-nums` on metrics.
- **Routines (`.rt-*`)** uses the same font variables but sets its own sizes via one-off `font: var(--fw-semibold) var(--fs-xs)/1 ...` declarations; eyebrow/label scale is consistent.
- **Calendar (`.hc-*`)** still uses the legacy `--fs-xs` / `--fs-sm` from `tokens.css` directly (pre-primitive) and mixes `font: ...` shorthand with hard-coded `12px/13px` values in places. Headings use the older `screen-title` class, not the new `display` scale.
- **Today** (RoutineStrip, HabitRing/HabitRow) still uses V4 classes (`habit-row`, `today-*`, `.routine-strip-head`) and V4 type scale.
- **Eyebrow language** is inconsistent: Detail uses `eyebrow`, Week uses `wr-habits__head-label`, Routines uses `rt-state__label` (uppercase 10px + 0.06em letter-spacing), Calendar uses `hc-title`/`hc-range`, Active uses `section-head`. The uppercase + letter-spaced eyebrow is *mostly* there but the class names and exact sizes shift by 1–2 px per surface.

### Spacing
- Active / Detail / Week work off the new `--sp-*` 4px scale with consistent 16 / 20 / 24 px section gaps.
- Routines uses `gap: 20px` between blocks, `padding: 16px 18px` heads, `padding: 10px 18px` steps — slightly denser than the primitive spec (which calls for 16/20 on mobile, 20/24 on desktop) but internally consistent.
- Calendar (`hc-grid`) uses `--hc-cell=28px` cells with `gap: 4px` — a tight, GitHub-heatmap-inspired density that is deliberately different from the list density; acceptable but visually reads as "different app."
- Mobile breakpoints are inconsistent: Routines uses `@media (max-width:559px)`, Active/HabitObject primitives use the new `--bp-sm = 480px`, Calendar hard-codes `@media (max-width: 767px)`.

### Surfaces / borders / depth
- Detail/Week/Active: flat canvas with hairline `1px solid var(--line)` on grouped blocks; elevation reserved for sheets. This matches the blueprint ("mostly flat + selective depth").
- Routines: `.rt-block` uses `border:1px solid var(--line); border-radius:14px; background:var(--surface); overflow:hidden` — a hairline surface matching the new spec; `.rt-foot` uses `background:var(--surface-2)` as a subtle inset, consistent.
- Calendar: `.hc-grid` renders directly on canvas (good), but surrounding chrome (month switcher, range tabs) still uses V4 `btn-group` and legacy `box-shadow` for pressed state, making the header feel older than the grid.
- Today habits/RoutineStrip: uses legacy `.rt-strip-card { border:1px solid var(--border); border-radius:var(--r-md); background:var(--surface) }` — the border is `var(--border)` instead of `var(--line)`; the radius is `var(--r-md)` (12px) vs Routines' `14px`; background var differs. Same concept, 1–2 px off everywhere.

### Icon sizing
- Routines: 16px kind icon, 12px check, 13px pencil/trash — consistent 12/13/16 scale.
- HabitObject: 15px check, 18px more, 12/22px ring check depending on variant — consistent but **slightly larger** than Routines (15 vs 12).
- Calendar: cell icons at 14px, header nav at 18px — roughly consistent.
- Week: icons in wr-habit rows vary (some inline 12px, some 16px).

### Action hierarchy
- **Active/HabitObject** — secondary "Complete" button + icon-only "more" — clear hierarchy.
- **Routines** — contextual "Do it/Done/Start/—" action per step (strong on current, quiet otherwise) + footer ghost sm buttons. Consistent internally; the "Do it" button uses `border-color:var(--accent); color:var(--accent)` — different visual treatment from the HabitObject "Complete" secondary button.
- **Calendar cells** — filled squares act as the action; no secondary actions inline. Consistent with its own model.
- **Week marks** — small inline buttons, same visual as Calendar cells — good.
- **Detail (hd-actions)** — primary "Complete" in the hero, then secondary "Pause"/"Archive"/"Delete" in Manage section. Solid hierarchy.

### Completed states
- HabitObject: ring fills to category color, checkmark appears in center, button flips to `quiet` (green via class).
- Routines: step num fills `var(--good)` with white check, button goes green "Done", routine gets `.is-complete` green title and "All steps complete" strip. **Note: Routines uses `var(--good)` (semantic) while HabitObject fills with the category color** — this is the most visible color inconsistency.
- Calendar: cell fills `var(--good)` on completion — consistent with Routines, **inconsistent with HabitObject's category fill**.
- Week cells: same as calendar, `var(--good)` fill.

**→ HabitObject's completed ring is the outlier.** The blueprint called for category-accented progress rails with `var(--good)` reserved for *completed/achieved* state; HabitObject's filled-ring in category color is a holdover from Step 4A that has not been reconciled with Calendar/Week/Routines' semantic-green completion.

### Warning states
- `atRisk` streak in HabitObject uses `data-at-risk=true` → maps to `var(--warn)` (amber).
- Missed pills in Active use `--warn`.
- Routines has no warn state (non-scheduled is dashed + neutral gray; incomplete is neutral). Good — it doesn't need one.
- Week review uses `--bad` for missed days, `--warn` for partial days — consistent.

---

## 3. Information hierarchy

| Surface | Primary question | Primary action | Supporting info | Deep info | Verdict |
|---|---|---|---|---|---|
| **Today** habits | "What should I do now?" | Check off next habit | Routine strip, priorities, at-risk warning | Plan/Focus/Mood panels (triggered) | Today is overcrowded (pre-existing) but the habit portion stays focused. **Unclear boundary** because Today also shows streak warnings, backup reminder, achievements — but that is outside Habit's control. |
| **Habits (Active)** | "What habits do I manage?" | Complete / edit / reorder | Category filter, hw-summary (counts) | Habit detail sheet | **Clean.** One question, one primary action. |
| **Habit Detail** | "How is this habit performing?" | Complete / Pause / Edit | 30-day rate, streak, schedule, reminder, heatmap, patterns | History sheet, linked goals/routines | **Mostly clean**, but the hero still carries a ring + rate + streak + reminder; 4 metrics above the fold is pushing it. |
| **Calendar** | "What happened over time?" | Tap a day to toggle | Month nav, range switch, legend, month pager | Note sheet (long-press/N) | **Clean.** Single question; no CRUD on the page. |
| **Week** | "How did I do this week?" | Tap a missed cell to backlog | Completion %, strongest/weakest, missed log | (none yet — week is intentionally compact) | **Clean.** |
| **Routines** | "What sequence should I perform?" | Tap "Do it" on current step | Done/total + thin rail, 28-day rate footer | Edit/Reorder/Archive | **Clean.** One question; no ring hero. |

**Boundaries that are unclear:**
1. **Today ↔ Habits Active** both show a list of habits with a complete button. Today's habit rows are V4 HabitRow/HabitRing; Habits Active uses the new HabitObject. Two visual dialects for the same entity on two sibling screens.
2. **Habit Detail hero** mixes *now* (complete button, today status) with *history* (30-day rate, streak, best streak) with *management* (reminder, schedule). The hero answers 3 questions at once ("is it done today?" / "how am I doing?" / "how is it configured?").
3. **Calendar ↔ Week** render overlapping temporal information (daily checkin grid), but Calendar is a month matrix with `hc-cell` and Week is a per-habit row grid with `wr-habits__day`. The user learns two different cell lexicons for the same action (tap a day → toggle checkin).
4. **Routines** introduces its own "done" visual (green numbered marker + green "Done" button) that doesn't echo the HabitObject "Complete" button, so when a user sees a habit both as a standalone item and inside a routine, it looks like two different interactions even though both call `TOGGLE_CHECKIN`.

---

## 4. HabitObject consistency

| Surface | Habit entity visual | Reuses `HabitObject`? | Notes |
|---|---|---|---|
| Habits → Active | `HabitObject` (variant `default`, ring 40px, secondary Complete button) | ✅ canonical | Correct. |
| Habit Detail hero | **Custom SVG ring** (`hd-hero-ring`, 120px) + duplicate meta layout | ❌ bespoke | Different stroke language (3.5px vs 3px), different color (uses `--cat-color` same as HabitObject, but structure is duplicated). |
| Habit Detail performance row | custom `.hd-fact` metrics | ❌ | Fine; these are stats, not the entity. |
| Today → habit rows | **Legacy `HabitRow` + `HabitRing` (V4)** | ❌ | Old visual. Different ring, different button, different meta order. |
| Today → RoutineStrip | `.rt-strip-card` bespoke list with inline checkbox glyphs | ❌ | Steps are rendered as plain spans + tiny button, not HabitObject. Acceptable because it's a compressed strip, but accent dot and check style don't match Routines steps. |
| Calendar | `hc-cell` squares + habit name row with dot | ❌ bespoke | Acceptable (matrix view), but the habit name + accent dot row is duplicated from Routines with slightly different dot size (8px vs 6px). |
| Week | `wr-habit` rows with wr-mark | ❌ bespoke | Acceptable (week matrix), same caveat as Calendar. |
| Routines steps | `.rt-step` numbered marker + accent dot + link + button | ❌ bespoke | Steps don't use HabitObject at all — this was an intentional choice per 4F brief ("no nested HabitObjects, flat editorial sequence"). It works visually but it means the "habit identity" now has three renderings: HabitObject ring (40px), rt-step dot+name (linear), and legacy HabitRing on Today. |

**Older habit visuals still in the codebase that ship to users:**
- `HabitRing.jsx` (used by Today, old HabitCard)
- `HabitRow.jsx` (used by Today)
- `HabitCard.jsx` (still imported in a few places, largely replaced)
- `habitRowModel.js` is still the derivation engine and is correct/used by HabitObject — keep.

**Conclusion:** HabitObject is canonical only on Habits → Active. Detail, Today, Calendar, Week, Routines, and RoutineStrip all have their own habit rendering. This is the single largest source of visual inconsistency in the domain.

---

## 5. Interaction consistency

### Completion
- **HabitObject:** Button label `Mark <name> complete` / `Mark <name> as not done`; `aria-pressed={done}`; dispatches `TOGGLE_CHECKIN` via `onToggleComplete` prop.
- **Routines step:** Button label `Mark done: <h> in <r>` / `Mark not done: <h> in <r>`; `aria-pressed={done}`; same `TOGGLE_CHECKIN`. ✅ Semantics match; wording differs ("Mark X complete" vs "Mark done: X in R").
- **Calendar cell:** Label `Mark done: <habit>, <date>` / `Mark not done: ...`; `aria-pressed`; same reducer. ✅
- **Week cell:** same as calendar. ✅
- **Detail hero:** `Mark <name> complete` / `Mark <name> not done`; same reducer. ✅
- **Today HabitRow:** legacy label `Mark <name> done` / `Mark <name> not done`; same reducer. Wording differs.

**→ All completion buttons call the same reducer with `aria-pressed`, which is excellent. The aria-label wording varies across four surfaces.** ("Mark X complete" / "Mark done: X" / "Mark X done" / "Mark done: X in R") — a small but noticeable lexical inconsistency.

### Undo
- Delete habit: toast "Undo" (ItemActionsSheet).
- Delete routine: toast "Undo" (Routines footer).
- Archive/activate routine: toast "Undo".
- Pause habit: toast "Undo" (ItemActionsSheet).
- ✅ Consistent toast-with-undo pattern across destructive/state actions.

### Detail navigation
- HabitObject name → `<a href="#/habits/:id">` (real link, keyboard focusable). ✅
- Routines step name → `<Link to="habits/:id">`. ✅
- Calendar habit name row → `<Link to={\`habits/${h.id}\`}` ✅
- Week habit name → needs spot-check; row is clickable.
- Detail → back link uses router back (consistent).

### More actions
- HabitObject → `IconButton` "More actions for <name>" → opens `ItemActionsSheet`. ✅
- Routines does NOT have a "more" per step — actions are in the footer per routine (Edit/Archive/Delete), which is correct for a sequence.
- Calendar/Week have no "more" per cell (only toggle), appropriate for the matrix view.
- Detail has explicit buttons instead of an overflow menu, appropriate for the management surface.

### Edit / Archive / Delete
- **Habit** edit/archive/delete: lives in ItemActionsSheet ("⋯") → consistent across Habits Active + Today.
- **Routine** edit/archive/delete: footer ghost buttons, always visible. Different (no "⋯" sheet) but intentional per 4F ("no permanently exposed giant action bar" — they are small ghost buttons). Acceptable.
- Routine delete is **one-click with toast-undo**, unlike habit delete which uses a two-step confirm in ItemActionsSheet. **Inconsistency:** habits and routines use different deletion safety patterns.

### Logging (missed backlog)
- Active "Missed" row → button "Log Morning run for <date>".
- Week missed list → button on missed cell.
- ✅ Same `TOGGLE_CHECKIN` for past dates, same "Log ... for" label pattern.

### Reorder
- Routines ↑/↓ in footer — reorder the routines list. Works.
- Habits reorder on Today is drag-to-reorder; in Habits Active reorder is currently absent/moved to drag (not exposed as buttons). Pre-existing.

### Keyboard
- All habit tick buttons use real `<button>` with visible focus-visible styles in HabitObject and Routines (`.rt-step__btn:focus-visible { outline:2px solid var(--focus-ring); outline-offset:2px }`), Calendar cells (`.hc-cell:focus-visible`), Week cells (`.wr-habits__day:focus-visible`).
- HabitObject defines a real `<a>` for name and doesn't use `role=button` on the article (nested-interactive safety — well done).
- Routines step names are real `<Link>`s.
- **Gap:** focus-visible on `.rt-move button` is defined; on HabitObject actions it inherits from the primitive Button; on Calendar cells the outline color is `var(--focus)` while Routines uses `var(--focus-ring,var(--accent))`. Two focus-ring variables.

### Back navigation
- Habit detail → back uses router `back()`; Calendar/Week/Routines are in-tab modes, no back needed.

---

## 6. Mobile issues (390×844 / 430×932)

### Touch targets — the headline problem
The product standard is **44px minimum interactive target**. Survey of Habit-domain surfaces:

| Surface / element | Declared min-height | Meets 44px? |
|---|---|---|
| HabitObject "Complete" button (default variant) | inherits from primitive `Button size=sm` → **36px** (per primitives.css `.btn--sm { min-height:36px }`) | ❌ **36px** |
| HabitObject "More" icon button (md) | primitive IconButton md → **40px** | ❌ **40px** |
| HabitObject "More" icon button (sm/compact) | **32px** | ❌ **32px** |
| Routines step button `.rt-step__btn` | `min-height:32px; min-width:56px` | ❌ **32px** (flagged in brief) |
| Routines footer `.btn.sm` | `.btn.sm { min-height:30px }` | ❌ **30px** (footnote actions) |
| Routines reorder ↑/↓ buttons | `width:28px; height:28px` | ❌ **28px** (worst offender) |
| Calendar `.hc-cell` | `width:var(--hc-cell); aspect-ratio:1` → **28px** (mobile) | ❌ **28px** (intentional density — heatmap cells) |
| Week `.wr-habits__day` | ≈ **28–32px** square | ❌ **~30px** |
| Week missed log button | `.btn.sm` → 30–36px | ❌ |
| Habit form filter-bar chips | `.btn.sm` → 36px | ❌ |
| Routine form step reorder ↑/↓ | `.btn.ghost.sm` → ~30px | ❌ |
| Segmented view tabs (Active/Calendar/Week/Routines) | `.tab` → ~36–40px | ❌ ~36–40px |
| Detail page icon buttons (hd-actions) | IconButton md/sm → 32–40px | ❌ |
| Sheet primary buttons (`btn.primary`) | 44px (per primitives.css) | ✅ |
| Bottom nav items | `var(--nav-h)=56px` | ✅ |
| Omni FAB | 56px circle | ✅ |

**→ Routines' 32px target was explicitly called out in the brief and is real, but it is far from the only offender. Across Habit surfaces, *most* secondary/icon/sm buttons land between 28–40px.** The entire domain needs a 44px touch-target pass; Routines is the most visible but not unique.

### Action placement
- Active: primary action on the right of each HabitObject row (Complete button). Consistent.
- Routines: primary "Do it" on the right of each step (same axis as Active), good.
- Calendar: cell *is* the action; no other actions inline. Good.
- Week: same as calendar.
- Detail: hero "Complete" sits in the header; management actions sit in a section below. Good.

### Wrapping / horizontal overflow
- HabitObject meta line (schedule · reminder · streak · status) wraps with `flex-wrap:wrap` — tested safe.
- Routines `.rt-sub` wraps; `.rt-foot` wraps; good.
- Calendar `.hc-grid` uses a CSS variable for cell size and shrinks to viewport; `overflow-x:auto` is enabled. At 320px cells go down to ~22px — still tappable? borderline.
- Week wr-habits uses horizontal scroll on the per-habit grid.
- **Risk:** Routines progress rail sits at 100% with the fill inside; no overflow risk. The `.rt-move` ↑/↓ are fixed 28px — safe.

### Navigation duplication
- Sidebar (hidden) + bottom-nav (4 primary) + "•••" More sheet (Goals/Settings/legacy) is consistent. Mobile does not double-expose top-level tabs.
- Habits screen's in-page tab bar (Active / Routines / Calendar / Week) is a second tab row *on top of* bottom-nav. That's standard and acceptable (in-page sub-tabs).

### Excessive scrolling
- Routines stacks vertically; each routine is ~180–250px plus steps; with 3–4 routines the view fits on one mobile screen. Good.
- Habits Active: each HabitObject row is ~64px (default variant) → 8 habits = ~512px + header fits in one scroll. Good.
- Detail hero is ~260px + sections → scroll is required but each section is tight.
- Calendar: month grid + legend ~ 520px → fits in one viewport.
- Week is the tightest surface.

### Inconsistent spacing
- Routines uses 14px head padding / 10px step padding; HabitObject rows use 14px vertical padding via primitives; Calendar uses 4px grid gaps. The vertical rhythm shifts between surfaces — most visible when tabbing Active → Routines.

---

## 7. Desktop issues (1440×900)

### Content width / alignment
- **Habits, Detail, Week, Routines** use the `PageContainer` primitive, capped at ~1200px max-width with 32px gutters, centered. ✅
- **Calendar** still uses legacy `#calendar-screen` which sets `max-width: var(--content-max, 1240px)` with slightly different side padding. It is *close* but the heading sits 8–12px to the right of where Habits/Routines headings sit.
- **Detail** at 1440px is a single 720px column (intentional, per 4C). Good — reads focused.
- **Week** uses a narrower 720px column (intentional, per 4E). Good.
- **Routines** uses full content width (not a 720px reading column). At 1440px a routine block stretches to ~1100px with steps inside at 1fr — the "name + meta" column becomes very wide, while the action button sits far right. This makes the eye travel far between the numbered marker and the action. A 720px cap would help; currently **too wide**.
- **Active Habits list** uses full content width — acceptable for a list but feels sparse at 1440px with no secondary column.

### Density
- Active and Detail feel comfortable at desktop density.
- Routines footer has 6 controls in one row (meta + ↑ + ↓ + Edit + Archive + Delete); at desktop widths they spread out with no grouping, which reads as a loose button strip.
- Calendar month grid cells are ~32px on desktop vs ~22px on mobile, consistent with GitHub-style heatmaps.

### Column usage
- No two-column layout is used in Habits, even on wide desktop (unlike Today's two-column plan). This is intentional per the blueprint ("one hero per screen"), but it leaves ~300px of whitespace to the right of the 720px Detail/Week columns.

### Visual anchors
- Active, Detail, Week, Routines all expose the in-page tabs (Active/Routines/Calendar/Week) at the top — good, consistent anchor.
- Calendar's range tabs are styled slightly differently, breaking the anchor feel.

### Section rhythm
- Between sections: 24px (Active, Detail, Week) vs 20px (Routines) vs 16px (Calendar headers). Minor.

**Feels too narrow:** none are too narrow; Detail at 720px is correct.
**Feels too wide:** Routines blocks at 1440px.
**Feels too sparse:** Active habit list on 1440px (long whitespace to the right).
**Feels too dense:** Calendar header row (month title + range tabs + nav buttons) on desktop.
**Feels too dashboard-like:** none — the flat-canvas choice is holding.

---

## 8. Color consistency

### Entity colors (habit categories)
- HabitObject: category color derived from `--cat-<area>` via `style={{'--cat-color': 'var(--cat-fitness)'}}`; ring fills with category color on completion. ✅
- Routines: step dot uses `var(--cat-<area>)` via `categoryOf(h.category).cssVar`. ✅ (Same system.)
- Calendar: habit row uses `--cat-<area>` dot. ✅
- Week: wr-mark uses habit color dot. ✅
- Detail hero ring uses `--cat-color`. ✅
- Today HabitRing still reads from legacy `--habit-color` inline style set by `HabitRow.jsx` — **diverged color path**, but happens to map to the same hue because `categoryOf` and the legacy mapper are equivalent.

**→ Category dots and habit accents are consistent across 5/6 surfaces (Today lags).**

### Semantic states
- `--good` completion fill: Calendar ✅, Week ✅, Routines (done marker + button + rail) ✅, Detail hero ✅, HabitObject ring ❌ (fills category color instead of good).
- `--warn` at-risk streak: HabitObject ✅, Week ✅, Calendar N/A, Routines N/A.
- `--bad` missed/deleted: Week missed cells ✅, Active missed pill ✅, danger-text delete button ✅.

**→ HabitObject's done-state color is the only semantic-color violation; it predates Routines and Calendar/Week's completion semantics.**

### Random new palette
- Routines uses `var(--accent)` for the current-step ring/button. That is the blueprint accent (violet), consistent with primary CTAs elsewhere. ✅
- Calendar uses `var(--good)` for filled cells consistently. ✅
- No rogue hex values added by Step 4F; everything uses tokens.

### Flooding with habit color
- HabitObject: category color appears in ring (always), ring dot, filled ring on completion — roughly 10% of the row's visual weight.
- Routines: category color is *only* the 6px dot — deliberately minimal (matches blueprint "no flooding").
- Calendar/Week: same 6–8px dot.
- **→ HabitObject is the most color-forward surface; Routines is the most restrained. Different philosophy, same tokens.**

### Light/dark (Daylight)
- New surfaces (Routines, HabitObject, Detail, Week) all use `var(--surface)` / `var(--line)` / `var(--text-*)` tokens that are themed in `src/styles/themes/`. ✅
- Calendar's `hc-*` rules use legacy `--bg`, `--bg-2`, `--text`, `--line` tokens which are themed; cells look acceptable in Daylight.
- Today's V4 habits/RoutineStrip use legacy tokens that have Daylight mappings.
- No Daylight-only bugs observed in source (will need real visual QA to confirm).

---

## 9. Ring / progress consistency

Current progress representations in Habit:

| Artifact | Where | Stroke / scale | Semantic |
|---|---|---|---|
| `HabitObject` ring | Active list, Today RoutineStrip link | 40px default / 28px compact / 56px featured, stroke 2.5–3.5px | Binary done/not-done + category color |
| HabitDetail hero ring | Detail hero | 120px, 3.5px stroke | Same binary, scaled up as hero |
| Routines progress rail | Routines header | 3px linear, `var(--good)` fill | N/total today |
| Calendar `hc-cell` | Calendar matrix | 28–32px square fill, `var(--good)` | Per-day binary |
| Week `wr-mark/wr-habits__day` | Week grid | ~28–32px square/round fill | Per-day binary |
| `hw-summary` counts | Active header | text (`0 of 2 done today`) | Aggregate, no graphic |
| `hd-heatmap` | Detail 90-day heatmap | small filled squares, `--good` sequential | Historical density |
| Detail `wr-compare` bars | Week section | horizontal bars | Week vs previous |

### Observations
1. **Two completion dialects:** HabitObject + Detail hero use *category-colored rings* (one per habit), while Calendar/Week/Routines use *semantic green filled shapes* for the same binary done/not-done concept.
2. **Hero scale violation:** Blueprint explicitly retired 120–148px rings. HabitDetail's 120px hero ring is a holdover from 4C that survived Routines; it reads as a "system monitor" rather than editorial.
3. **Routines chose the rail over the ring** — this is the correct call per the blueprint ("linear progress rail, no ring hero") but it is the *only* Habit surface that did so.
4. **Calendar + Week cells share a semantic language** (green square = done, muted = unscheduled, amber = today outline). HabitObject ring does not participate in that language.
5. **NOW ring is Today's** (not Habit's) and is fine there.

### Recommended canonical pattern (not implemented now)
- **Binary today state (in a list row):** small 28–32px ring OR a status dot + linear rail. The blueprint calls for the dot+rail as primary; HabitObject currently uses a 40px ring — needs a decision.
- **Hero completion metric (on a dedicated detail page):** one large *number* with supporting text, not a giant ring. Detail hero should move to a numeric + sparkline treatment.
- **Historical matrix:** filled squares, `--good` with 4 sequential alpha steps (Calendar/Week already do this correctly).
- **Aggregate progress (routines, today):** 3px linear rail, Routines' `.rt-rail` becomes the reference.
- **Inline % (rows, tables only):** ≤40px ring, 4px stroke, neutral track.
- **Decorative rings:** none.

---

## 10. Card / surface audit

### Surface treatments in Habit screens
1. **Canvas (no surface)** — Calendar grid background, Week habits head, Routines between blocks, Habits between rows.
2. **Hairline `1px solid --line` flat surface** — Routines `.rt-block`, HabitObject `article` (no card — flat with bottom border), Habit Detail sections (`.hd-section`), Week wr-habits `<section>`.
3. **`surface-2` inset** — Routines `.rt-foot`, Habit Detail "Manage" section, inputs/chip groups.
4. **Raised sheets/dialogs** — HabitForm (Sheet), ItemActionsSheet, Note sheet, RoutineForm (Sheet), Detail sheet on mobile. These use `surface-3` + scrim. ✅
5. **Legacy SectionCard** — still used by Today's habit sections (V4) and some Calendar header wrappers. Not used inside Habits Active/Detail/Routines/Week (new code).
6. **Nested card situations:**
   - Routines: zero nested cards (single `.rt-block`, flat interior — ✅ matches brief).
   - Active: HabitObjects are separated by hairlines, not nested in cards — ✅.
   - Detail: `.hd-section` blocks sit on canvas, no nested cards — ✅.
   - Week: `.wr-habits` is a single surface — ✅.
   - Calendar: surrounding `.hc-screen` has no card, grid is on canvas — ✅.
   - **Today's RoutineStrip** still wraps steps inside the `.rt-strip-card` surface with a separate `.rt-strip-head` — this is a card-in-card relative to Today's surface, inherited from V4.

### Radius usage
- Routines: 14px block / 7–8px buttons / 10px markers.
- HabitObject primitives: `--r-md = 12px` cards / `--r-sm = 8px` buttons.
- Detail: 16px sections, 8px badges.
- Calendar: 6–8px cells (squares with slight rounding).
- Week: rounded cells ~6px.

**→ Radii vary by 2–6 px between surfaces. No consistent radius scale applied across the domain; primitives.css defines one, but Routines and Calendar use their own values.**

### Shadows
- Routines uses zero shadows (hairline only) — ✅ matches blueprint.
- HabitObject uses zero resting shadow — ✅.
- Detail uses zero resting shadow — ✅.
- Calendar header buttons still use `box-shadow: inset 0 0 0 1px ...` for pressed state (legacy) and the month switcher uses a subtle pressed shadow.
- Sheets use `--e-2` / `--e-3` — appropriate.

### Redundant containers
- `.hc-screen` has an extra `<div class="hc-inner">` wrapper that could collapse into the screen.
- `.rt-step__action` span wrapper exists solely to hold the button — could be removed (minor).
- Week `.wr-habits` wraps a `<div class="wr-habits__grid">` inside a `<section>` — minor duplication.

**Overall:** mostly flat, selective depth. Routines is the most disciplined. Calendar retains the most legacy wrappers.

---

## 11. Duplicated information

### Repeated facts
1. **Today's done/total** appears in:
   - `hw-summary` in Habits Active header ("X of Y done today")
   - Routines `.rt-state` per routine ("done/total")
   - Today hero stats
   - (Pre-existing) Today progress rail

2. **Streak count** appears in:
   - HabitObject row (flame + count when ≥3)
   - HabitDetail hero (30-day + current streak + best streak — three numbers)
   - Today At-Risk warning
   - Insights habit performance table
   The Habit detail hero shows **current + best + 30-day** — three streak numbers simultaneously.

3. **Schedule (Every day / Weekdays)** appears in:
   - HabitObject row
   - Habit Detail "Schedule" field
   - Calendar day dots implicit (doesn't label)
   - RoutineForm when editing
   Acceptable — each view needs the schedule cue.

4. **Completion rate** appears in:
   - Detail hero (30-day %)
   - Week review headline (week %)
   - Insights performance table (7/30/90 rates)
   - Routines footer ("Fully done X of last 28 days")
   Not duplicated *within* a surface, but four surfaces expose rate metrics. Acceptable per-view; detail hero could drop the 30-day rate into the Performance section instead of the hero.

5. **Habit name + category dot** appears as the identity in 5 places (HabitObject, RoutineStrip, Routine step, Calendar row, Week row). That's expected — it *is* the entity identity.

### Useful existing data currently absent from the best place
- **Routine stacking efficiency** (do routines actually chain completions? computed in `analytics.js`) is not shown anywhere. Footer shows "fully done X of 28 days" but not intra-routine ordering effect.
- **Habit × weekday pattern** (best day) is computed by `habitPatterns` and shown on Detail, but Calendar/Week don't surface it.
- **Completion time-of-day** is in `checkins[].at` but only surfaced in Insights Lab, not on Detail.
- **Skip vs fail distinction** is in state (`.skips[]`) but HabitObject only shows "paused" and "archived"; skipped days render as unscheduled.

### Missing data that would help
- None of these require new engines.

---

## 12. Accessibility inconsistencies

### Headings
- Habits Screen: `<h1>Habits</h1>` then tabs. ✅
- Routines: routine names are `<h3 class="rt-title">`. There is no `<h2>` "Routines" inside the view — the tab label and page title serve that role, but screen-reader users browsing by headings will jump from `<h1>Habits</h1>` to `<h3>Morning reset</h3>`, skipping a level.
- Calendar: `<h1>Calendar</h1>` then month labels as `<strong>` not headings — acceptable.
- Week: `<h1>Week review</h1>` then subsections as `<h3>`s (missed, strongest/weakest).
- Detail: `<h1>{habit name}</h1>` then `<h2>Today</h2>`, `<h2>Performance</h2>`, `<h2>Patterns</h2>`, `<h2>History</h2>`, `<h2>Schedule</h2>`, `<h2>Manage</h2>` — excellent.
- **→ Routines has the heading-level skip (no h2 for the block list).**

### Landmarks
- Each screen is wrapped in `<main>` (PageContainer). ✅
- Tab bar uses `role="navigation" aria-label="Habit sections"`. ✅
- Filters use `role="group" aria-label="Habit filters"`. ✅
- Steps list uses `<ol class="rt-steps" aria-label="{name} steps">` — ✅ correct ordered list.
- Routines archive uses native `<details>/<summary>` — ✅.
- **Calendar grid** does not expose `role="grid"`/`role="gridcell"`; cells are `<button>`s in a `<div>` grid. Functionally fine (buttons are buttons), but a grid role would better describe the matrix for screen readers.

### Aria-labels
- Completion buttons are all labelled. ✅
- Reorder buttons: `Move {name} earlier/later` — ✅.
- Icon-only buttons have `aria-label` in HabitObject (More), Routines (Delete, Edit), Calendar nav. ✅
- **Gap:** Routines `.rt-move` has `aria-label="Reorder {name}"` on a `<span>` that contains two buttons — the label is on a non-interactive wrapper, which is harmless but not useful. The buttons' own labels are correct.
- **Gap:** Calendar's previous/next month icons are labelled. ✅

### Aria-pressed
- Every completion button uses `aria-pressed`. ✅ Consistent across all 6 surfaces.
- Segmented view tabs (Active/Routines/Calendar/Week) use `aria-pressed`/`aria-current` inconsistently — some use `aria-current="page"` on the active link (correct for tabs that are links), some use `aria-pressed`.

### Keyboard navigation
- All tick buttons are reachable via Tab.
- Routines reorder buttons are Tab-reachable.
- Calendar cells are Tab-reachable.
- HabitObject card has `onClick` on the article but provides a real link for the name and real buttons for actions; card click is filtered to ignore buttons/links — keyboard users can tab to the link and buttons without hitting the article. ✅
- Routines block header is not interactive. ✅

### Focus-visible
- HabitObject buttons: inherit from primitive Button (2px outline). ✅
- Routines buttons: explicit `outline:2px solid var(--focus-ring,var(--accent)); outline-offset:2px`. ✅
- Routines reorder buttons: same. ✅
- Calendar cells: `.hc-cell:focus-visible` outline, but color is `var(--focus)` (legacy) vs Routines' `var(--focus-ring,var(--accent))` — **two focus-ring variables**.
- Week cells: `.wr-habits__day:focus-visible` present.
- Tab focus: `.tab[aria-current="page"]` has a visual indicator (underline). ✅

### Reduced motion
- Routines `.rt-rail__fill` transition is disabled under `@media (prefers-reduced-motion: reduce)`. ✅
- HabitObject confetti/burst respects reduced-motion via `motion.js`. ✅
- Calendar has no enter animation on cells (good).
- Week bars use `AnimatedNumber` which respects reduced motion. ✅
- Sheet open/close springs disable under reduced motion. ✅

### Color-independent states
- Done state has both color (green fill) and a check glyph (HabitObject, Routines steps, Calendar tooltip, Week cells). ✅
- Paused/archived use text decoration + dashed styling + labels, not color alone. ✅
- "Current step" in Routines uses accent ring + accent text + "Next up" label + border — not color alone. ✅
- At-risk streak uses `data-at-risk=true` + flame color + text "Missed" — label is present. ✅

### Target sizes (also see §6)
- Routines step button: **32px (flagged)**
- Reorder ↑/↓ buttons: **28px (flagged)**
- Calendar/Week cells: **28px** (acceptable for heatmap density but below 44px)
- Most sm buttons: 30–36px.
- **→ 44px target standard is met only by primary CTAs, sheet confirm buttons, bottom nav, and FAB. Every secondary/sm/icon button in Habit falls short. This is a domain-wide issue, not a Routines-only issue.**

---

## 13. CSS / performance observations

Current state: **55.0 kB gz exactly at ceiling** (post-4F). No room to add.

### Duplicated CSS
1. **Two button systems ship simultaneously:**
   - Legacy `.btn`, `.btn.primary`, `.btn.ghost`, `.btn.sm`, `.btn.danger-text` in `components.css` (~2 kB).
   - New primitives `.btn--primary`, `.btn--secondary`, `.btn--ghost`, `.btn--sm`, `.IconButton` in `components/primitives/primitives.css` (~3 kB).
   - Routines mixes both: its own `.rt-step__btn` custom button (≈200 bytes) plus legacy `.btn.ghost.sm.danger-text` for footer actions.
   - Net: three button implementations in parallel, ≈5 kB gz duplicate.

2. **Two surface / card systems:**
   - Legacy `--e-card`, `.section-card`, `.surface` in components.css.
   - New primitives `.Surface` + semantic `--surface-1/2/3` in primitives.css.
   - Routines uses its own `.rt-block` bespoke surface.
   - Calendar uses no surface (flat) — ✅.

3. **Two focus-ring variables:** `--focus` (legacy, violet-500) and `--focus-ring` (new, semantic `var(--accent)`). Routines uses `var(--focus-ring,var(--accent))` as a fallback; Calendar/Week/HabitObject use the new one; legacy buttons use `--focus`.

4. **Two border variables:** `--line` (new, semantic) and `--border` (legacy). Routines uses `--line`; Today's RoutineStrip still uses `--border`; Calendar uses `--border`; Detail uses `--line`. One concept, two tokens.

5. **Two radius scales:** `--r-md/r-lg` (legacy, mixed 12/16/18) and `--radius-sm/md/lg/xl` (new primitives, 8/12/16/22).

6. **Two type-scale systems:** `--fs-*` fluid scale (new) coexists with hard-coded `font-size: 10px/11px/12px` in Calendar/Routines/legacy `.btn.sm`.

### Dead rules (suspect, not verified by removal)
- Legacy `.routine-*` selectors in `habits.css` were removed in 4F; legacy `.routine-stack/.routine-step` in `work.css` were removed. Good.
- Legacy `#habit-list` V3 selectors likely dead (HabitList uses `.habit-list` now).
- `.habit-card`, `.habit-row` V4 selectors in `habits-v3.css` still ship because Today still uses them.
- `.workspace-next`, `.empty-hint`, `.add-habit-btn` legacy selectors likely dead weight.
- `.aurora-blob` still ships globally but is only used on boot/selected hero surfaces.

### Parallel component styling
- **Habit action buttons** are styled three ways: `.habit-obj__complete` (HabitObject.css), `.rt-step__btn` (habit-routines.css), `.hc-cell` (habit-calendar.css), `.wr-habits__day` (habit-week.css). All represent a done/not-done toggle for a habit on a given day. **Net ~600 bytes of duplicated styling** for what is semantically one component.
- **Accent dots** are inline `width:6px/8px; height:6px/8px; border-radius:99px;` in Routines, Calendar, Week, Habits. No shared `.cat-dot` primitive.
- **Eyebrow labels** (`text-transform:uppercase; letter-spacing:.05–.08em; font-size:10–11px; color:var(--text-3)`) are duplicated in `.rt-state__label`, `.eyebrow`, `.hc-eyebrow`, `.wr-eyebrow`.

### Opportunities (NOT acting on them now)
- Collapse to one button primitive → estimated 2–3 kB gz savings.
- Introduce one shared `.habit-toggle` and `.cat-dot` primitive → ~0.7 kB gz savings across habit-*.css.
- Retire one border/focus/radius token alias → ~0.3 kB gz.
- Total potential headroom: ~3–4 kB gz, enough to bring Routines step buttons up to 44px targets without blowing budget.
- **Do NOT raise the budget.**

---

## 14. Route / cross-link issues

Tested via code inspection (no click-through in this audit):

| From → To | Present? | Notes |
|---|---|---|
| Habits Workspace → Habit Detail | ✅ | HabitObject name link; card click. |
| Habit Detail → Calendar / Week | ✅ | Sub-links in Detail header (Calendar/Week) |
| Calendar → Habit Detail | ✅ | Habit name row in calendar sidebar → `#/habits/:id` |
| Week → Habit Detail | ✅ | Habit name is a link |
| Routines → Habit Detail | ✅ | Each step name is a `<Link to="habits/:id">` |
| Today → Habit Detail | ✅ | HabitRow click → detail sheet/route |
| Legacy routes | ✅ | `#/library`, `#/week`, `#/calendar` still canonical-parent redirect |

### Awkward transitions
1. **Today → Habits:** both show "today's habits" but with different visuals (V4 HabitRow vs HabitObject). Switching between them feels like two different apps.
2. **Routines step name → Habit Detail → back** returns to `#/habits` which defaults to Active, not Routines. The back button returns to the previous route in history; deep-linking a step name from inside the Routines tab loses the tab state. This is a known single-hash-query limitation (the tab is `?view=routines`, which survives reload but back-after-detail relies on router history).
3. **Calendar → Habit Detail** opens a full-screen detail route on mobile, replacing the calendar rather than opening a sheet — different pattern from Workspace which uses an overlay sheet. Mixed modality.
4. **Archive → Undo** toast on Routines re-activates the routine but does not move focus back to the Archive button / routine block. Minor a11y polish item.
5. No cross-link from Habit Detail back to a specific routine (it only links to the Routines tab in general: `habits?view=routines`). Acceptable.

### Broken links
- None found in source inspection.

---

## 15. Strongest parts

1. **Routines (Step 4F)** — the cleanest execution of the "flat editorial sequence" language in the whole Habit domain. Single surface, no nested cards, correct order, current-step logic is honest and minimal, "All steps complete" strip is well-judged, archived routines use native `<details>`. This is the new reference pattern for sequences.
2. **HabitObject** as a presentation-only component — excellent API separation (callers own data/reducers), correct nested-interactive handling (no `role=button` on the card, real link for the name), category color derivation, proper `aria-pressed` completion button.
3. **Calendar cells** — the matrix is the most data-honest element in the domain; cells show truth without visual noise, respect forced-colors (via standard background), long-press for notes, keyboard N for note, swallowed single post-hold click. Strong work.
4. **Week review** — compact, opinionated, answers one question; uses the same green-square language as Calendar; doesn't bloat itself with charts that belong in Insights.
5. **Reducer/data layer** — untouched, honest, shared across all surfaces; `TOGGLE_CHECKIN` is the single write path for completion from every surface. This is the foundation that makes cross-surface consistency *possible*.
6. **Archived patterns** — Routines uses `<details>`; habits in Active are filtered out of the main list under an "Archived" filter chip; both preserve undo. Consistent mental model.
7. **A11y baseline** — aria-pressed, focus-visible, reduced-motion, semantic lists (`<ol>` for ordered routines), real buttons, labelled icon buttons are all present. The gaps are small and specific.

---

## 16. Weakest parts

1. **Two visual dialects (V4 vs new) still coexist on Today's habit presentation** (`HabitRing`/`HabitRow`). It is the first screen users see and it doesn't match Habits/Detail/Routines.
2. **Completion color language is split** — HabitObject fills with category color, while Routines/Calendar/Week all use semantic `--good`. Same action, different color semantics.
3. **44px mobile target is missed almost everywhere** in secondary/icon/sm buttons across the domain. Routines' 32px step button is the named offender, but 28px reorder buttons, 28px calendar/week cells, 30px footer buttons, 36px `.btn.sm` are all below the bar.
4. **Habit Detail hero** still uses a 120px ring as the hero graphic (contradicts the blueprint "no giant ring hero") and stacks current-streak + best-streak + 30-day-rate in one place.
5. **Routines blocks are too wide on 1440px** — name-meta-action distance is too long. Should cap at ~720px reading column like Detail/Week.
6. **Focus ring, border, radius, and button tokens exist in duplicate** (legacy + primitives), causing 1–2 px visual drift between surfaces.
7. **Calendar header chrome** (month/title/range-tabs/nav) still uses V4 `.btn-group` styling that sits at a different visual weight than the new Habits/Detail/Routines header.
8. **Habit entity is rendered 5 different ways** (HabitObject, Routine step, Calendar row, Week row, Today HabitRow) with slightly different dot sizes, name weights, and meta order.
9. **Delete safety is inconsistent** — habits require confirm in ItemActionsSheet, routines delete immediately with toast-undo.
10. **Aria-label wording for tick buttons** differs across four surfaces ("Mark X complete" / "Mark done: X" / "Mark X done" / "Mark done: X in R").

---

## 17. Exact things to fix later (NOT now)

Ordered by value:

1. **Bring Today's habit rows (HabitRow/HabitRing) onto HabitObject.** Retire `HabitRing` V4. This closes the single largest visual gap between Today and Habits.
2. **Decide completion color.** Either (a) move Calendar/Week/Routines to category-color fills (loses the "semantic green = done" system) or (b) move HabitObject/Detail ring fills to `--good` with the category color reserved for the dot + ring track accent. The blueprint argues for (b).
3. **44px mobile touch pass across Habit** — elevate `.btn.sm` to 40–44px, `.IconButton--sm` to 40px, make Routines step/action buttons 44px, make reorder controls 44px (can keep visual size while expanding hit area via invisible padding). Calendar/Week heatmap cells are the one case where density legitimately wins; expose a compact-density note.
4. **Retire duplicate tokens** — alias `--border` to `--line`, `--focus` to `--focus-ring`, `--r-md` to `--radius-md` in primitives; eventually remove legacy aliases.
5. **Cap Routines content width at ~720px** on ≥1024px (same column as Detail/Week) so the eye doesn't travel.
6. **Replace Habit Detail's 120px hero ring** with a big-number + sparkline + completion control (per blueprint §11); move the ring to a ≤40px secondary glyph if kept.
7. **Unify eyebrow / status-pill** — one `.eyebrow` class (uppercase, 11px, 0.06em tracking, `--text-3`) used across rt-state__label, hd-eyebrow, wr-eyebrow, hc-eyebrow.
8. **Extract a shared `.cat-dot` primitive** (6px colored dot) and a shared `.habit-toggle` button primitive (done/not-done, aria-pressed, check glyph, 44px hit) that HabitObject / Routine step / Calendar cell / Week cell all compose.
9. **Unify delete safety pattern** across habits and routines — either both one-click+toast-undo, or both confirm. Habit OS's prevailing pattern is toast-undo; routines are already there, habits should follow (or vice versa if research shows habit delete is more consequential).
10. **Unify tick-button aria-label wording** to one canonical form — recommend `Mark {done/not done}: {habit} [{in routine}]` across every surface, matching Routines' form because it supports preposition context.
11. **Add a `<h2 class="screen-only">Routines</h2>` (visually hidden but accessible)** inside the Routines view to fix the heading-level skip.
12. **Calendar grid** consider adding `role="grid"`/`role="gridcell"` for richer screen-reader semantics.
13. **Calendar header** (month/tabs/nav) restyle onto primitives.
14. **Routines' reorder ↑/↓** wrap hit area to 44px and visually align with HabitObject IconButtons.
15. **Back-from-detail-when-entered-from-Routines-tab** — preserve `?view=routines` on return (router already carries query on forward nav; verify back/close behavior).

---

## 18. Exact things NOT worth changing

1. **Routines numbered circular markers** — the 01..N + vertical connector is editorial and distinctive. Don't flatten it to dots or HabitObjects.
2. **Routines `rt-*` bespoke class vocabulary** — it's isolated in one stylesheet, namespaced, and won't leak. Don't force it into primitives prematurely.
3. **Calendar heatmap cell density** — 28px is tight but is the right density for a 52-week matrix; don't blow it up to 44px, add visible padding to hit area instead.
4. **Archived routines as `<details>`** — native, accessible, collapses cleanly. Don't replace with a custom collapsible.
5. **Week review compactness** — it is intentionally a short surface, don't add charts/sections.
6. **HabitObject card-click-to-detail behavior** (as opposed to requiring the chevron/name) — already handled correctly (real link for keyboard users, filtered click for mouse). Don't remove.
7. **The 28-day routine rate in footer** ("Fully done X of last 28 days") is specific and useful; keep it rather than genericising to "last 30 days".
8. **Toast-undo pattern** for archive/delete — it's consistent across the app and has proven reliable.
9. **Category color derivation (8 hues from categories)** — don't introduce a per-habit color picker.
10. **Habit form, Schedule form, and RoutineForm as Sheets (bottom-sheet modals)** — don't convert to inline or fullscreen.
11. **Progress rail height (3px)** on Routines — thin is intentional and matches blueprint; don't thicken it for "visibility".

---

## 19. Readiness for Work

### What should be reused as-is for the Work domain
- **Token/primitive system** (`tokens/primitives.css`, `semantic.css`, primitives `Button/IconButton/Surface/Stack/Cluster/Metric/Progress/Ring`) — already proven across Habit Object, Detail, Week.
- **EntityRow pattern** (HabitObject is a specialised EntityRow): leading visual (dot/small ring), name+meta line, trailing actions, hairline separation, press-scale micro-interaction, focus-visible, aria-pressed. Work items (projects, assignments, tasks) should slot into a generic EntityRow primitive parameterised by leading visual (checkbox for tasks, progress ring for assignments, accent stripe for projects).
- **Sheet pattern** for create/edit/detail — Sheet.jsx is already the one authoritative overlay; WorkForms should move off inline toggles onto it.
- **Segmented view tabs** (Active/Week/Calendar/Routines) are the direct model for Work's tabs (Overview / Deadlines / Projects / Workload).
- **Status-pill / health-badge language** (`data-tone=good/warn/bad/neutral`, uppercase 11px eyebrow, `var(--good)/--warn/--bad`) — maps cleanly to on-track/at-risk/overdue.
- **Linear progress rail** (Routines' `.rt-rail` 3px) becomes the canonical pattern for % progress on project/assignment rows, replacing the legacy `Meter`/`PaceRibbon`.
- **Accent dots and category derivation** pattern — extend from 8 habit categories to project categories and assignment types; don't invent a new color system.
- **Toast-with-undo** for archive/delete/complete — works for "mark done", "archive project", "delete assignment" too.
- **A11y contract**: `aria-pressed` on toggles, real buttons for actions, focus-visible outline ≥2px, reduced-motion transitions, keyboard ↑/↓ across lists (when Work builds list view, follow HabitObject's keyboard plan).
- **Mobile shell** (bottom-nav, Omni, More sheet) — already proves the pattern; Work just adds a primary tab.

### What should NOT be copied from Habit into Work
- **Per-surface bespoke stylesheets in the style of early Step 4A-C** (each view inventing its own class vocabulary like `.rt-*`). After Routines, the rule should be: compose from primitives; add view-specific CSS only for things primitives cannot express (like the vertical step connector).
- **The 120px hero ring.** Do not introduce a giant progress ring for project/goal completion; use a linear rail or big number.
- **Calendar/Week heatmap cell language.** Work's deadline timeline is chronological, not a calendar grid; don't force project status into a coloured cell matrix.
- **Two-button reorder controls (↑/↓)** for Work list reorder; prefer drag-reorder where natural, and use IconButtons with larger hit targets than Routines' 28px.
- **Legacy `SectionCard`** from V4. Routines proved it isn't needed.
- **The Habit-Detail hero as a template** for project detail; the project detail should lead with a pace line (actual vs expected, per blueprint §12), not a ring.

### What remains unresolved before Work can start
1. **Button primitive consolidation.** Three button systems currently ship; Work needs one. Consolidate `.btn.ghost.sm` + `.btn--sm` + `.rt-step__btn` into one Button component before Work builds new rows, otherwise Work will add a fourth.
2. **EntityRow primitive extraction.** HabitObject is ~80% of EntityRow already but it hard-codes the leading ring. Extract `EntityRow` (leading visual slot, name, meta, actions, press state) and have HabitObject compose it. Work's project/assignment rows will then be straightforward variants.
3. **Touch-target elevation to 44px** across existing primitives. Do this once in primitives.css and all six Habit surfaces + Work inherit the fix.
4. **Token alias unification** (`--border→--line`, `--focus→--focus-ring`, `--r-md→--radius-md`). Work must not add a third alias set.
5. **Progress primitive promotion.** Routines `.rt-rail` should be pulled up to primitives as `<Progress variant="rail" value={pct} tone="good"/>` so Work can use it for project/assignment progress without reimplementation.
6. **Completion color decision.** Before Work adds a fourth surface using the same toggles, decide category-accent vs semantic-good, so project/assignment completion doesn't pick a third dialect.
7. **Decision on Routines' content-width cap** — if 720px is correct for reading surfaces, encode it as `--content-readable` in the token layer; Detail and Week already sit at that width.
8. **Delete-safety pattern decision** (confirm vs toast-undo) should be set before Work deletes anything.

### Verdict on readiness
**The Habit domain is 75% ready to be a design reference for Work.** The data model, the a11y contracts, the semantic color system, the sheet pattern, the segmented-tab pattern, and the linear-progress pattern are all proven. The missing 25% is consolidation work (one Button, one EntityRow, one focus token, 44px targets, completion-color decision) that must happen *as part of* Work foundation (Phase 5 Step 19), not before. Starting Work with the current primitives as-is will simply duplicate the consolidation debt further.

---

## 20. Recommended next implementation order

After this audit (and per STOP, no new work starts now), the recommended order when Habit OS moves on is:

1. **Consolidation pass (Habit polish, before Work starts):**
   - Single Button + IconButton primitive (retire legacy `.btn` classes) at 44px min-hit.
   - Single focus-ring token, single border token, single radius scale.
   - Extract `EntityRow` from HabitObject; refactor HabitObject to compose it.
   - Promote Routines `.rt-rail` to a `<Progress>` primitive.
   - Decide completion color; apply uniformly.
   - Bring Today's HabitRow/HabitRing onto HabitObject (retire V4 habit visuals).
   - Cap Routines column width on desktop; add hidden h2.
   - HabitDetail hero: replace 120px ring with number + sparkline.
   - Calendar header restyle onto primitives.
   - Unify delete-safety and aria-label wording.
   - This pass is the "Design System 1.0" close-out; expected budget win ~3–4 kB gz.

2. **Work domain foundation (Phase 5):**
   - Build Work project/assignment/task rows *on top of* EntityRow.
   - Build Work tabs using the same segmented pattern as Habits.
   - Build Work deadline timeline using the new Progress primitive + pace-line variant.
   - Build Project/Assignment detail as sheets (like HabitDetail).
   - Workload chart uses existing chart primitives from Insights prep.

3. **Goals** (Phase 8) after Work is stable — goals reuse EntityRow, HealthBadge semantic, and pace-line from Work.

4. **Insights** (Phase 7) is mostly chart-primitive work and can proceed in parallel once Charts primitives exist.

**Do not proceed to Work without step 1.** Shipping Work against the current three-button-system / two-token-scale state will multiply the debt and force another broad refactor later.

---

*Audit complete. No code modified, no commit created, no server left running. Ready to STOP.*
