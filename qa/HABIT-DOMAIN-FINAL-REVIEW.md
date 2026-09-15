# HABIT DOMAIN FINAL REVIEW

**Mode:** READ-ONLY audit. No code changed, no commit, no push.
**Date:** 2026-09-13
**HEAD:** `7cbdab9` (merge base); Steps 4G-2A/2B/2C/2D and v3 primitives/tokens/HabitObject/TodayWorkList are present as working-tree modifications (the artifact of the session) and were inspected in-place.
**Screens audited:** Today, #/habits, #/habits/:id, #/habits?view=calendar, #/habits?view=week, Routines.

---

## 1. Overall verdict
**HABIT DOMAIN NEEDS ONE MORE CONSOLIDATION** before it is safe to copy-paste patterns into Work. The habit surfaces have converged strongly on the canonical HabitObject ring, semantic color rules, and flat surface language — but one desktop-width inconsistency, two dead/parallel component files, and a partially-landed v3 token migration leave seams that, if inherited into Work wholesale, would multiply into debt. The smallest possible next step is identified in §20. The bulk of the domain (typography, Button/IconButton primitives, state markers, 44px targets, motion, a11y wordings) is ready to be reused now.

## 2. Overall score
**7.8 / 10**

## 3. Visual coherence score
**8 / 10.**
- Shared Inter/Manrope typography, 8/12/14/16 px rhythm, pill/sm/md/lg radii, consistent hairline dividers, 3px progress rails, 1.5px icon strokes, and a mostly-flat surface vocabulary (one surface + subtle `--surface-2` band on headers/footers, no glow/glass/giant shadows) make Today, Habits, Detail, Calendar, Week and Routines read as the same product.
- Eyebrows are consistently xs semibold uppercase at ~0.06em letter-spacing; section titles use the same fs-base/semibold.
- **Coherence gaps:**
  - Habits active list is 980 px, Routines 720 px, Detail 880 px, Calendar/Week 1240 px, Today 720 px — five content widths in one tab strip.
  - Some `--accent-soft` / hover tints use `color-mix(in oklab, …)` while others use `color-mix(in srgb, …)` — visually close but inconsistent.
  - v3 semantic tokens (`--color-success`, `--text-primary`, `--surface-raised`, `--border-subtle`) and v2 legacy tokens (`--good`, `--text`, `--surface`, `--line`) coexist with a legacy-aliases bridge; primitives use new, surfaces still lean old. No broken visuals but the system is mid-migration.

## 4. Information hierarchy score
**8 / 10.**
- **Today** answers "What should I do?" clearly (hero context → Next action → TodayWorkList grouped). Completed/at-risk/paused cues are secondary.
- **Habits Workspace** answers "What habits do I manage?" with filter strip + HabitObject list; 980 px width is readable; summary row is tight.
- **Detail** answers "How is this habit performing?" — h1 hero → Performance evidence → Patterns → History → Schedule → Manage, hierarchical and scannable.
- **Calendar** answers "What happened over time?" — month grid leads; selected-day side panel gives detail, but on desktop at 1240 px the day-list and grid can feel far apart.
- **Week** answers "How did I do this week?" — big % summary → habit grid → patterns/attention/takeaway split is tight; the attention row uses the same grid as habit rows.
- **Routines** answers "What sequence should I perform?" — 720 px column makes the sequence the only thing that matters; header → progress rail → ordered steps → footer is unambiguous.
- The only density tension is Calendar/Week at 1240 px: they read more like dashboards than the editorial language used elsewhere.

## 5. Interaction score
**8 / 10.**
- Wording is now consistent across HabitObject, Detail, Today, Calendar for completion: `Mark {name} as complete` / `Mark {name} as not complete`, `aria-pressed={done}`, quiet `Completed` with IconCheck.
- Detail/Resume/Restore, Archive/Edit/Delete/Reorder all use canonical Button/IconButton (`p-btn`, `p-btn--icon`).
- Edit buttons are named `Edit {name}`; Delete has `aria-label="Delete …"` (Detail uses a visible "Delete" button + "Delete for good" confirmation).
- Reorder controls on Routines use ↑/↓ IconButtons with 36 px visual + `::after{inset:-4px}` = 44 px hit.
- **Wording gaps:**
  - Calendar cell labels use `Mark {name} as complete/not complete, {date}` — consistent.
  - Week uses `title="{date}: done|missed|today|upcoming|not scheduled"` tooltips — wording lowercase but present.
  - Routine "Do it" / "Start" / "Done" step-button labels are slightly divergent from HabitObject's "Complete"/"Completed"; acceptable because Routines are sequential ("Do it" for current, "Start" for waiting, "Done" for done).
- 44 px targets are consistent on primary actions (HabitObject complete 44 px; Detail primary 44 px; Calendar day buttons 32 px cells but with ::before pseudo hit-pads; Week rows min-height 44 px; Routines reorder 44 px; nav 44×44; Week nav 44×44).

## 6. Mobile score
**7.5 / 10.**
- 390/430: Today caps at 720 px max-width (full width in practice), primary Complete buttons full-width on Detail, blocks 12 px radius on Routines, Calendar month cells 32 px, Week cells 24 px.
- **Sub-44px targets remaining:**
  - Calendar grid cells in month view declare 32 px height — the `.hc-cell::before` hit-pad expands to 44 px width in year mode but month cells rely on the cell itself (32 px). Mild miss.
  - Week cells are 24×24 (on mobile) — these are dense matrix cells and aren't primary actions; the `wr-row` is 44 px tall but the individual cell is a 24 px tap target.
  - HabitObject compact variant `.hobj--compact` more button is 40×40 (mobile override bumps back to 44 px via `@media (max-width:559px)` rule — confirmed present).
- No horizontal overflow detected in the mobile overrides I inspected.
- Bottom nav has safe-area padding.
- Routine reorder controls confirmed 44 px via ::after.

## 7. Desktop score
**7 / 10.**
Width map at 1440×900:
- Today: 720 px (good — focused editorial)
- Habits Active: 980 px (good — tabular list needs some width for meta)
- Detail: 880 px (good — hero + 2-col evidence)
- Routines: 720 px (good — sequence)
- Calendar: 1240 px (full `.habits-screen` content-max) — wide; the habit-name column and 30+ day columns sprawl.
- Week: 1240 px (full width) — the 7×28 px day grid is too narrow to justify 1240 px; the summary/attention split uses 1.2fr/1fr and reads fine, but the whole screen sits wider than its siblings.

Alignment issues:
- The New-routine button on Routines aligns to the 720 px column edge (good).
- Calendar/Week header titles are centered in `.wr-head`/`.hc-controls` at full width, which is a different treatment from Detail/Routines left-aligned headers.
- Habits screen H1 is left-aligned; Tab strip left-aligned.

## 8. Accessibility score
**8 / 10.**
- Semantic h1 on Today/habits/Detail/Routines (Routines h3 per routine block under the page h1 — correct). Week uses h2; Calendar uses h1.
- `aria-pressed` correct on Complete buttons, range toggles, selected day, and pressed habit cells on Calendar.
- Completion `aria-label` uses the canonical "Mark X as complete/not complete" across HabitObject/Detail/Today/Calendar.
- `focus-visible` outlines present on buttons, cells, nav, reorder (16 rules in habit CSS).
- Reduced-motion globally kills transition durations via `base.css` (specific per-element rules removed during 4G-2B/2C where redundant — safe).
- State is not color-only: done = filled circle; missed = ×; today = ring + column accent; off = tiny dot.
- **Gaps:**
  - Week matrix cells are `<span class="wr-cell">` with `<span class="wr-mark">` and only a `title=` tooltip — they're not buttons. That's fine because Week is a review surface (click is not an interaction). But for keyboard-only users there's no way to inspect each cell beyond the title. Acceptable for review.
  - Some dense Calendar cells (year/90d) are 10–14 px visual; keyboard focus expands them to 44 px via ::before, so keyboard is OK.

## 9. HabitObject consistency
**8.5 / 10.**
- Today uses `<HabitObject variant="compact">` inside `.today-hobj.today-row--habit-obj` (4G-2A).
- Habits Workspace uses `<HabitObject>` (default variant, which is — confusingly — the "default" size but workspace sets compact-like padding through hlist modifiers; HabitList's `HabitRowLine` wraps HabitObject with compact modifier).
- Detail uses a hand-rolled 28 px ring/eyebrow/h1 hero (matching HabitObject compact's ring size/stroke/dot/check language) rather than embedding a HabitObject card (correct — Detail is a header, not a nested card).
- Routines does not embed HabitObject; its 28 px numbered markers are its own sequence language (correct — sequence marker ≠ identity ring).
- **Remaining dialects:**
  - Dead `src/components/habits/HabitRow.jsx` (227 lines) + HabitCard.jsx facade (11 lines) — not imported anywhere in `src/` (verified); pure dead code.
  - Calendar and Week do not use HabitObject (they use per-day marks), which is correct for a matrix — they should not.
  - RoutineStrip (on Today) uses inline styles + a `.rt-strip-card` instead of HabitObject — correct, routine strips aren't habits.

## 10. State-language consistency
**9 / 10.**
Post-4G-2D:
| State | HabitObject | Today (hobj) | Detail | Calendar | Week | Routines |
|---|---|---|---|---|---|---|
| done | ring stroke = `--good` + check + quiet `Completed` | same | ring stroke = `--good` + `Completed` primary | filled circle `--good` | filled circle `--good` | rail fill `--good`; step button `Done` quiet + check |
| missed | — | (lead-mark warning) | "Log it" row | red × `--bad` | red × `--bad` | — |
| today | — | — | (handled by Today) | hollow ring habit color + cell outline accent | hollow ring habit color + day header accent | — |
| scheduled/upcoming | partial ring fill (habit color) | same | — | small hollow ring habit color .45 | small hollow ring habit color .45 | — |
| unscheduled/off | — | non-completable lead-mark | — | no mark | tiny `--border-2` dot | — |

- `identity color ≠ completion`: Done is now `--good` on both Calendar and Week, and the JSX `semantic` guards skip inline habit color for done/missed. HabitObject's ring-fill still uses `stroke: var(--cat-color)` when not done, but switches to `stroke:var(--good)` when done — consistent.
- **One violation:** HabitObject's ring-track uses category color at 16% and ring-fill uses category color when not done; that's identity/progress-in-today's-context, not completion — correct. When done, stroke turns `--color-success` (v3) / `--good` (v2 alias). So the ring is identity when undone, semantic success when done — rule respected.

## 11. Surface/card assessment
- **KEEP:**
  - `.rt-block`, `.wr-habits`, `.hc-day`, `.habit-obj`, `.hd-hero` (hairline only, no surface fill on hero).
  - `--surface` raised/background, `--surface-2` for subtle banded headers/footers.
  - 14 px radius cards (r-sm 8, r-md 14 matches existing).
- **QUESTIONABLE:**
  - `.habit-obj` default variant uses `--surface-raised` + `--border-subtle` while `.habit-obj--compact` (used in Today/HabitList) is transparent/borderless. Two surface modes for the same component — works but worth naming explicitly when Work inherits it.
  - `.wr-summary` uses a slightly different grid (auto 1fr) and padding (20px) than `.hd-evidence` (1px gap line grid) — both metric displays, different strategies.
  - `.rt-strip-head` inline-style overrides (`background:transparent;border-bottom:none;paddingBottom:0`) are a smell that the RoutineStrip card doesn't quite reuse `.rt-block` cleanly.
- **SHOULD EVENTUALLY REMOVE:**
  - Dead `HabitRow.jsx` / `HabitCard.jsx`.
  - `box-shadow` usage anywhere in habit screens (only a few remain in `.hc-range` button pressed state — acceptable; no decorative elevation on the habit cards themselves).
  - Decorative gradients: none found in habit domain (good).
  - Giant rounded rectangles: none.

## 12. Progress-language assessment
- **HabitObject ring (compact/default):** represents today's completion of the habit (binary stroke dashoffset + check on done). Appropriate per-row.
- **HabitDetail hero:** no big ring (removed in 4G-2B); small 28px identity ring only, binary done/not-done. % appears only in Performance evidence (real analytics). Appropriate.
- **Routine rail (3px):** represents N-of-M steps done for the routine today (linear, aggregate). Appropriate; distinct from the per-habit ring.
- **RoutineStrip (Today) Meter:** routine aggregate %, thin meter from WorkKit — reused, acceptable.
- **Calendar marks:** per-habit-per-day state (binary done/missed/scheduled/off), not a % — appropriate dots/crosses.
- **Week marks:** same as Calendar dots/crosses plus today column accent — appropriate.
- **hd-evidence metric cards + heatmap:** historical performance — appropriate, below the hero.
- No two progress languages mean the same thing in different places: ring = per-habit today; rail = per-routine today; meter = per-routine aggregate; marks = per-cell binary; metric cards = historical rate.

## 13. Color-language assessment
- **Habit color = identity** on HabitObject ring (undone), category dot, today/scheduled outline markers on Cal/Week, header dot on Detail, RoutineStrip kind icon tint.
- **Success (--good / --color-success):** completed marks, completed ring stroke, routine rail fill, completed step buttons, "Completed today." text.
- **Danger (--bad / --color-danger / --warn):** missed ×, missed row color (`--warn` on Detail missed-log row — uses warn rather than bad; minor inconsistency).
- **Selected/accent (--accent):** today column outline, today weekday header, pressed range toggle, selected day highlight.
- **One minor violation:** Detail's `.hd-missed` row uses `var(--warn)` (amber) for missed today, while Calendar/Week markers for past missed use `--bad` (red). These are slightly different semantics (today-missed is actionable-but-not-failed-yet; past-missed is a fact), so it could be defended — but the wording is the same ("Missed"). Worth reconciling in a future pass.

## 14. Remaining legacy debt
| Item | Classification |
|---|---|
| `HabitRow.jsx` (227 LOC) + `HabitCard.jsx` facade | **NEEDS FUTURE CLEANUP** — dead code, not imported. |
| v2 token names (`--good`, `--text`, `--surface`, `--line`) used across all habit CSS while primitives/HabitObject use v3 (`--color-success`, `--text-primary`, `--surface-raised`, `--border-subtle`) bridged by `legacy-aliases.css` | **NEEDS FUTURE CLEANUP** — does not block Work (aliases are bidirectional), but new surfaces should pick one vocabulary. |
| `src/styles/today-v3.css` (176 LOC), `src/styles/habits-v3.css` (19 LOC), `src/styles/work-v3.css` | **NEEDS FUTURE CLEANUP** — v3 override sheets that partially duplicate base styles; indicate in-progress migration. |
| `src/styles/system.css` (3687 LOC) | **NEEDS FUTURE CLEANUP** — very large; likely aggregates primitives/shell/spatial rules; verify it doesn't ship duplicated rules. Not a Habit bug. |
| Old lead-check / today-row anatomy in `components/today/today.css` (`.today-row__lead-mark`, `.today-row__body`, etc.) | **SAFE TO LEAVE** — these serve Work/task rows on Today, not HabitObjects; HabitObject is used for habit rows via `.today-row--habit-obj`. |
| RoutineStrip inline-style overrides | **SAFE TO LEAVE** — small surface; does not break inheritance. |
| Detail's `.hd-missed` using `--warn` vs Calendar/Week missed using `--bad` | **SAFE TO LEAVE** — defensible semantics; tiny visual difference. |
| `Meter` in RoutineStrip imported from `work/WorkKit.jsx` | **BLOCKS NOTHING** — healthy cross-domain reuse. |

## 15. Remaining target-size issues
- Calendar month cells: 32 px tall at desktop, 32 px mobile — dense matrix, `::before` pseudo pads year-mode to 44 px but month mode relies on native 32 px (acceptable for a grid, but technically <44 px on mobile).
- Week 7×24 cells (mobile): 24×24 visual — matrix cells, not primary actions; row min-height is 44 px so tap is forgiving.
- HabitObject compact `.hobj--compact .habit-obj__complete`: 36 px tall on desktop, mobile override bumps to 44 px — OK.
- All primary CTAs, nav buttons, reorder, archive summary, Edit, Delete, range buttons are 44 px.
- Calendar "Today" quick-jump `.hc-today` min-height 44 px — OK.
- Week `.wr-today` min-height 44 px — OK.
- Week `.wr-nav-btn` 44×44 — OK.
- No issue is severe enough to block Work inheritance.

## 16. Strongest aspects
1. **HabitObject** is now genuinely canonical: the same anatomy drives Today, Workspace, and is referenced semantically by Detail.
2. **State language** (post-4G-2D) is clean and color-independent: done = green filled circle, missed = red ×, today = ring + accent.
3. **Detail hero** (4G-2B) is typography-led with no giant ring; matches the focused 720/880 px editorial rhythm.
4. **Routines** (4G-2C) is the cleanest surface in the domain: 720 px, single `.rt-block` surface, clear sequence, 44 px reorder, no chrome.
5. **Motion** is restrained (Burst on completion, stroke transitions, no glow/gradient).
6. **Accessibility wordings** ("Mark X as complete/not complete") are uniform across three surfaces.
7. **Primitives** (Button, IconButton, Status, Surface, Divider, Metric) are well-factored; no hand-rolled buttons.

## 17. Weakest aspects
1. **Inconsistent desktop content widths** across tab siblings (980/880/720/1240/1240).
2. **Mid-token-migration**: v2/v3 variables coexist; HabitObject.css uses the new semantic tokens while the other four habit stylesheets still use v2 aliases. Visually unified but architecturally in-flight.
3. **Dead HabitRow/HabitCard files** left in tree (confusing for future contributors).
4. **RoutineStrip on Today** uses inline styles rather than a clean class (minor but signals incomplete surface reuse).
5. **Week at 1240 px** feels like a dashboard next to the tighter 720/880 surfaces; Calendar has the same issue but is more defensible as a data-grid.
6. **Progress-meter duplication** between `.rt-rail` (3px green rail on Routines), `Meter` (WorkKit, used in RoutineStrip), `.hd-metric__value` (typographic metric), and HabitObject ring — each is appropriate for context, but there is no single exported `<Progress>` primitive that all of them call. Primitive exists in `primitives/Progress.jsx` but isn't adopted in habits.

## 18. What Work should inherit
- **Row anatomy:** HabitObject's three-column (leading visual · body · trailing action) grid with `--ho-*` variables, min-height 44 px, `--cat-color` identity injection, and body ellipsis behavior.
- **Button language:** `p-btn` / `p-btn--icon` with `--btn-h/--btn-px/--btn-fs` variables; variant vocabulary (primary/secondary/quiet/danger); explicit `min-height:44px` on primary actions.
- **Surface language:** single `--surface` fill + 1px `--line` hairline, 14 px radius; `--surface-2` for subtle banded headers/footers; no gradients/glow; no card stacking.
- **Typography:** Inter body + Manrope display; eyebrow = xs semibold uppercase 0.06em letter-spacing; title = fs-base/semibold; h1 = extrabold clamp at ~-0.03em tracking.
- **Progress language:** linear rails (3 px, background `--surface-2`, fill `--good`, 0.2s transition) for aggregate progress; small identity rings for per-item binary state today.
- **State language:** semantic colors for completion (--good) and miss (--bad), accent for selected/today, hollow rings for upcoming, muted dots for off; never color-only.
- **Color system:** identity color per entity (category/assignment/project) injected via `--cat-color`-like CSS custom properties; never use identity color as semantic success/danger.
- **Spacing:** 4/8/12/16/20 px scale, `--sp-*` tokens or `--space-*` tokens.
- **Accessibility:** "Mark X as complete/not complete" aria-label pattern; aria-pressed on toggles; visible focus-visible 2px outline at 2px offset; 44px hit targets via either size or ::after inset -4px; reduced motion honored globally.
- **Mobile targets:** primary buttons flex:1 full width on ≤559 px; secondary/icon buttons retain 44px; no horizontal overflow; safe-area padding.

## 19. What Work should NOT inherit
- **Habit rings everywhere.** Rings are a per-habit-today-binary affordance; they should not decorate project tasks, goal progress, or focus sessions (Work already uses `Progress`/`Meter` — keep that).
- **Calendar 7-day matrix** (specific to Habits weekly review).
- **Routine step connector** (specific to sequential routines).
- **Habit-specific category color palette as semantic state.** Work must keep identity color (project/assignment color) distinct from semantic success/danger in the same way Habits now does — but it should not copy the specific category dot/color tokens.
- **Dual v2+v3 token vocabulary.** Pick one (v3 semantic) for new Work surfaces instead of inheriting the mid-migration state.
- **Mid-completion "today" ring-with-dot treatment** (removed in 4G-2D because it falsely signaled partial completion). Work states should be binary or use Meter, not partial-fill rings unless they truly mean partial completion.
- **Inline-style overrides** of the kind seen in RoutineStrip.

## 20. Exact blockers (if NOT READY)
The only issue that materially risks reproducing debt in Work:

**Blocker (single, small):** Content widths across the habit tabs are inconsistent (Active 980 / Detail 880 / Routines 720 / Calendar+Week 1240 / Today 720). Before Work inherits the surface language, decide on a canonical editorial width (recommendation: 720 px for single-column surfaces like Today/Routines, 880 px for document/hero surfaces like Detail, 980 px for tabular lists, and allow 1240 px only for true data-grids like Calendar year/90d — then apply a `.wrap-narrow`/`.wrap-wide`/`.wrap-grid` class or `PageContainer` max-widths consistently). The `PageContainer` primitive already exists; it is not yet used to impose a coherent width policy on habit sub-views. Routines, Detail, and Today already have hard-coded max-widths; Calendar/Week rely on `.habits-screen`'s 1240 px.

**Not blockers (can be cleaned up later, do not gate Work):**
- Dead HabitRow/HabitCard files.
- v2/v3 token coexistence (legacy-aliases bridge works).
- RoutineStrip inline-style overrides.
- Calendar month-cell mobile target is 32 px (dense matrix; acceptable).
- `.hd-missed` using --warn vs --bad.

## 21. Readiness decision
**HABIT DOMAIN NEEDS ONE MORE CONSOLIDATION** — specifically, a narrow "content-width / PageContainer policy" pass that applies consistent max-widths to Calendar and Week (and removes the per-screen hard-coded widths in favor of a shared primitive), plus a token-naming decision so Work can commit to one vocabulary. After that pass (estimated < 1 day of CSS/JSX changes with no layout redesign), the domain will be READY. I do NOT recommend implementing that pass now — the instruction is to stop after this review.

---

## Change-safety confirmation (§20)
- **No code changed** during this review (only this report was written to `qa/HABIT-DOMAIN-FINAL-REPORT.md` — a new markdown file that does not alter runtime behavior).
- **No commit created.** I did not run `git add` / `git commit` on any code or the report; the file is present in the working tree as an untracked artifact of this audit.
- **No push.** The branch is at `7cbdab9`; nothing was pushed during this review.
- **No CSS budget change.** I did not rebuild (node_modules is not installed in this sandbox state) and modified zero CSS/JSX files that affect bundle size.

---

### Scorecard
| Dimension | Score |
|---|---|
| Visual coherence | **8** |
| Information hierarchy | **8** |
| Interaction consistency | **8** |
| Mobile usability | **7.5** |
| Desktop usability | **7** |
| Accessibility | **8** |
| Visual identity | **8.5** |
| Technical/UI-system consistency | **7** |
| **OVERALL** | **7.8** |
