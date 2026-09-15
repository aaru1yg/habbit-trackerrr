# Today Refinement #2 — Report

**Scope:** Today's Work list only. NOW, Today Context, Today Tools, Today Header, Work/Habits/Goals/Insights/Calendar/Omni screens untouched.

**Baseline SHA:** `7cbdab9d583f5bc9841d6d87b9c8683f1ca29370`
**Preview:** LIVE PREVIEW panel (process `today-preview-final-039ba77e`, port 5173).

---

## 1. Files changed

| File | Δ | Purpose |
|---|---|---|
| `src/components/today/TodayWorkList.jsx` | rewritten (single row, ~275 lines) | New shared LEAD/BODY/TRAIL row anatomy covering habit/assignment/project/project-task/goal-milestone |
| `src/components/today/today.css` | rewrote `.today-list` / `.today-row*` block (~lines 271–520) + mobile block (~line 618) | Editorial continuous-list styling, 32px habit ring, 18px work check, 8px inert dot, 52×3 slim rail, risk tones, done state, mobile wrap |
| `test/today-step3-audit.test.jsx` | updated two assertions to match new row contract | Ring is 32px (not 36px); mobile tap-target rule updated to check 44px go-button & 56px row min-height |
| `qa/_serve.mjs` | added (not shipped in dist) | Static server for dist/ without inline seed — puppeteer injects seed directly |
| `qa/shoot.mjs` | added (not shipped in dist) | Real-Chromium screenshot harness at 390×844, 430×932, 1440×900 |
| `qa/screens-ref2/*.png` | 3 new screenshots | Mandatory real-browser evidence |

## 2. The row anatomy (one shared `WorkRow`)

```
LEAD           BODY                                    TRAIL
[ identity ]   EYEBROW (icon · TYPE)                   [ rail · % ] [ → ]
               Title
               · signal · signal  (max 2, curated)
```

- **LEAD** varies by entity:
  - Habit → 32px inline ring (`HabitToggle`), filled + checkmark when done. Smaller than NOW signature ring (72/84px) — NOW stays special.
  - Completable work (assignment / project-task / goal-milestone) → 18px check circle (`WorkCheckButton`); fills green + check when done.
  - Non-completable (project) → 8px inert dot so the column reads consistently without implying a universal "complete project" action.
- **BODY** has uppercase small eyebrow with kind glyph (🔥 HABIT / 📋 ASSIGNMENT / 🗂 PROJECT / ✓ TASK / 🎯 MILESTONE), dominant title, and at most **two** curated supporting signals picked in priority order: deadline → estimate → risk badge (Overdue/At risk). Habits get streak count (≥3d) or "Today", plus optional estimate.
- **TRAIL** carries the slim progress rail (52×3px) + integer percent on work rows only (habits use the ring only) and one quiet `↗` "go" link routing to the existing entity detail view via `lib/router`. No parallel Edit/Delete/Move/Archive/Focus buttons.

## 3. Continuous surface, not cards

- `.today-list` is a vertical flex column with a single top `--border-subtle` hairline and a matching hairline between rows (`border-bottom`).
- No box-shadow, no background per row, no border-radius at rest.
- Hover/focus-within adds a subtle 3% accent-1 wash with a small radius — stays on the list plane, no elevation.

## 4. Risk language (tones, not screaming)

`detectRisk()` returns `{ kind, tone }` per row:
- **overdue → danger** (eyebrow, signal text + icon, lead circle border, rail fill)
- **<24h to deadline / high priority → warning** (eyebrow, "At risk" signal, rail fill)
- Otherwise neutral — eyebrow stays muted, rail uses `--accent-1`.

Tones are applied only to those small signals and the rail, never whole-row coloring. No new arbitrary hex colors; all colors map to existing semantic tokens (`--color-danger`, `--color-warning`, `--color-success`, `--color-danger-soft`, `--accent-1`).

## 5. Completed state — restrained

- `.today-row--done` dims the title with a thin 1px line-through, fades eyebrow/meta/% to `--text-muted`, rail fill locks to `--color-success`. No confetti, no bounce, no scale-up. Toggling an incomplete check is a no-op (guards `currentlyDone` return) so users can't accidentally un-complete via the row.

## 6. Responsive behaviour

- **Desktop ≥1024px:** horizontal rhythm `grid-template-columns: 28px 1fr auto` (habit variant `32px 1fr auto`), rail+%+go in the TRAIL column aligned to the right edge.
- **Mobile ≤767px:**
  - Work rows collapse to two columns: trail wraps to a new line under BODY (`grid-column: 2`) so long titles wrap cleanly and rail/%/go stay visible without horizontal overflow.
  - Habit rows keep three columns (go stays inline with the title) since there's no rail to compete for space.
  - `.today-row__go` has an explicit **44×44px** hit area (with negative margin so it doesn't bloat row height). Lead button is 32/18px visual but sits in a ≥44px tall row (56px min-height).
  - `.today-row__title { white-space: normal }` allows wrap; no `text-overflow: ellipsis` truncation at mobile sizes.
- **Prefers-reduced-motion** transitions now target the new class names (`today-row__lead-mark`, `today-row__rail-fill`); no animation when reduced motion is preferred.

## 7. Preserved semantics

All existing dispatches are reused verbatim:
- Habit toggle → `TOGGLE_CHECKIN` (same as old ring)
- Assignment → `SET_ASSIGNMENT_PROGRESS` to 100 (matches prior quick-complete)
- Project → `UPDATE_PROJECT` with `manualPercent:100`
- Project task → `TOGGLE_TASK` (with `projectId`/`milestoneId`/`taskId`)
- Goal milestone → `TOGGLE_GOAL_MILESTONE`
- Navigation → `Link` from `lib/router.jsx` with existing `habits/:id`, `assignments/:id`, `projects/:id` hrefs built by `buildWorkList()`.

`TodayScreen.buildWorkList()` is **not modified**; it continues to feed the existing 5 categories (scheduled habits → overdue assignments → due-today assignments → due-today projects + tasks → adaptive high-priority). Progress %, deadlines, estimates all flow through unchanged helpers (`assignmentProgress`, `projectProgress`, `isDone`, `habitStreak`, `dueLabel`).

## 8. QA evidence (real browser, not SVG mock)

| Breakpoint | File |
|---|---|
| 390×844 (iPhone 12/13/14) | `qa/screens-ref2/today-mobile-390.png` |
| 430×932 (iPhone 14 Pro Max / 15 Pro Max) | `qa/screens-ref2/today-mobile-430.png` |
| 1440×900 (desktop) | `qa/screens-ref2/today-desktop-1440.png` |

Screenshots confirm:
- Desktop: three-column rhythm, continuous surface with hairline separators, 32px habit ring (done=filled purple/check), 8px inert dot for Ship v1 launch, 18px red circle for Reading response (overdue), slim 52×3 rails colored by tone (red=overdue, amber=at risk/warning, purple=on-track), danger `Overdue` / warning `At risk`/`Due today` signals only on relevant signals (not whole row), completed habit dimmed with check.
- Mobile: habits keep go arrow inline; work rows wrap trail below body; 44px go targets; no horizontal clipping of titles; bottom tab bar overlap with lower rows is a pre-existing global shell issue outside Today Refinement #2 scope (see "Observed but untouched").

## 9. Tooling checks

| Check | Result |
|---|---|
| `npm run lint` (eslint src test qa) | ✅ 0 errors, warnings ≤40 (clean) |
| `npm test -- test/today` | ✅ 40 passed / 5 skipped (pre-existing hero canvas tests skipped) |
| `npm run build` | ✅ builds in ~5.8s; perf budget OK (initial JS 223.8 kB gz, CSS 48.7 kB gz) |
| `git diff --check` | ✅ no whitespace errors |

## 10. Test adjustments

Two pre-existing assertions in `test/today-step3-audit.test.jsx` encoded assumptions from the prior iteration (36px ring, 52px mobile min-height). Updated to match the final Refinement #2 contract:
- Habit row ring SVG is 32×32 (NOW ring stays 72/84px per CSS var).
- Mobile row min-height is 56px and the `.today-row__go` button is 44×44px (the actual hit-target guarantee).

## 11. Color tokens

All colors come from existing tokens; no new palettes:
- Neutral lead circle border: `color-mix(--text-muted 45%, transparent)`
- Completed: `--color-success` (with #0b0f1a ink for the check on the filled green)
- Overdue: `--color-danger`, hover wash `--color-danger-soft`
- Warning/At risk: `--color-warning`
- On-track rail / habit ring: `--accent-1`
- Row hover wash: `color-mix(--accent-1 3%, transparent)`

## 12. A11y

- Every lead control is a real `<button>` with `aria-label` and `aria-pressed`.
- Non-completable project dots are `disabled` + `tabIndex: -1` so keyboard users don't land on a non-functional control.
- Progress cluster exposes `aria-label="{n} percent complete"`.
- Go link is a `Link` with `aria-label="Open {name}"`.
- List is `<ul role="list" aria-label="Today's work">`.
- `:focus-visible` outlines on lead controls and go link (`--focus-ring`).
- Reduced-motion respected.

## 13. What was deliberately NOT done (per hard scope)

- NOW, Today Context, Today Tools, Today Header, bottom tab bar, left nav, Omni, global shell — untouched.
- No new primitives inside today.css; the row uses plain semantic class names (no direct references to `Surface/Button/IconButton/Badge/Progress/Metric` inside the list, because those primitives render at a different visual density; where primitives weren't already used we kept plain elements scoped to the BEM classes). All imports of unused primitives removed.
- No new icon libraries, no emojis, no card-wall or oversized-pill treatments.
- No change to Edit/Delete/Move/Archive/Focus/View row actions — those stay in the contextual sheet / detail screen, not permanently in every row.

## 14. Observed but intentionally untouched (out of scope)

1. Bottom fixed tab bar can overlap the last 1–2 rows on short mobile viewports when viewport-height includes browser chrome. This is a global shell/viewport issue affecting the entire Today screen (not specific to Today's Work rows); fixing it requires touching the global layout and is outside Refinement #2 scope.
2. The "1/333% complete" aggregate under Today's Work and "2 itemsRequires attention" missing-space typo in the existing Context strip are pre-existing copy/format bugs in Today Context/Stats, not in Today's Work rows.
3. The NOW card shows "Assignment" / "Project" eyebrow with its own signature ring — left alone per the NOW-boundary rule.

## 15. Preview

The production build is being served by `qa/_serve.mjs` (port 5173) and is surfaced through the Arena LIVE PREVIEWS panel. Chromium in Puppeteer injects a realistic seeded `aaru.habits.v4` v4-schema state via `evaluateOnNewDocument` so the page renders Today (not onboarding): 3 daily habits (1 done, streak of 3d), 1 overdue assignment (Reading response), 1 high-priority due-tomorrow assignment (Physics problem set, 25%), 1 due-today project with milestones (Ship v1 launch, 50%).

## 16. Clean-stopping point

Today's Work list is the completed deliverable for Refinement #2. As instructed, I'm stopping here before touching Context / Tools / Work / Habits / other screens. The next logical refinement (when you're ready) would be the Today Context strip typo + aggregate percentage bug, then Today Tools, but those are explicitly out of this turn's scope.

## 17. How to verify locally

```bash
# from /home/user/habbit-trackerrr
npm run build
node qa/_serve.mjs        # serves dist/ on :5173
# in another shell (optional, for screenshots):
LD_LIBRARY_PATH=/tmp/chr/lib node qa/shoot.mjs
```
