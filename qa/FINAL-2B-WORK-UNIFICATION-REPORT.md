# FINAL PHASE 2B — Work row/card unification

**Date:** 2026-09-15
**Commit:** `f87fd98` — FINAL 2B: Unify Work row/card visual language on WorkEntity system
**Parent:** `7f9aa47` (FINAL 2A CSS headroom)
**Pushed:** `origin/arena/01a08bf2-habbit-trackerrr`

## Goal
Replace the competing `.work-card` / `.work-top` / `.work-fact` legacy card system with ONE WorkEntity visual language shared by Work Overview/Deliverables/Projects/Workload/Deadlines/Project Detail/Assignment Detail, without changing data, IA or the Project Gallery (which is intentionally a spatial "cover" view).

## `.work-card` references found

| Reference | Location | Disposition |
|---|---|---|
| `className={\`work-card project-card ...\`}` | `WorkCards.jsx` ProjectCard | **Replaced** with `.we-card[data-kind="project"]` |
| `className={\`work-card assignment-card ...\`}` | `WorkCards.jsx` AssignmentCard | **Replaced** with `.we-card[data-kind="assignment"]` |
| `className="project-card gal-item"` | `ProjectGallery.jsx` ProjectGalleryCard | **Renamed** to `.gal-item` (Gallery cards are intentionally not list cards; the `.gal-card` interior is untouched) |
| `.work-list` wrapper | Projects/Assignments screens | **Kept** — simple vertical flex container (gap only); renamed conceptually to `.we-list` in CSS for clarity (old `.work-list` rule retained because it just adds gap, no visual chrome) |

### Legacy CSS rules removed from `work.css`
- `.work-card { ... }` + `.work-card:hover` + `.work-card.is-done`
- `.work-top`, `.work-title`, `.work-sub`, `.work-body`, `.work-foot` layout/typography blocks
- Dead `a.work-title, button.work-title` touch-target compensators and standalone `button.work-title` rule inside a media query (no selectors referenced them after card conversion)

**Net: 64 lines removed from `work.css`.**

## WorkEntity reuse

The canonical `WorkEntity` (compact `.we` row, Step 5A) is already used for Work Overview/Deliverables/Projects/Workload/Deadlines tabs inside WorkScreen. This step:

1. **Added a `.we-card` variant in `src/components/work/WorkEntity.css`** that uses the SAME tokens (kind lead, `--sp-*` gaps, `--r-lg`, `--border-1`, 3px `Meter`, semantic `data-tone`, `StatusPill`, `KindTag`, `CountdownChip`, `.btn ghost icon` at 36px) but is structured for Projects/Assignments list surfaces:
   - `.wec-head` with `.wec-lead > .wec-kind` identity tile (tinted by category color, matching HabitObject's identity treatment), `.wec-main` (chips + `.wec-title` + `.wec-sub`), and `.wec-side` percentage + side action.
   - `.wec-body` containing the canonical 3px `Meter`, a 4-column `.wec-facts` fact grid (Deadline/Days left/Tasks-or-Subtasks/Health), and `MilestoneStepper` (projects) / `DeadlineHero` + `DeadlinePressure` + inline QuickProgress (assignments).
   - `.wec-foot` with hairline top border, `count-chip`s, spacer, and the standard 36px Edit/Delete/Open actions — 44px touch targets respected.
   - Responsive: <480px drops to 2-column facts, wraps the head so the percent sits on its own row.
2. **Rewrote `ProjectCard`** in `WorkCards.jsx` to use `.we-card` markup; kept identical data (projectStatus, projectProgress, milestoneTrack, linked habits, estimate, edit/delete/open actions). No new computation.
3. **Rewrote `AssignmentCard`** to use `.we-card` markup; kept DeadlineHero, DeadlinePressure, subtask count, inline QuickProgress expand/collapse, edit/delete/open actions.
4. **Rewrote `WorkRow`** (compact variant used by Today/Calendar/Workload/Timeline/Settings) to use `.we` (was previously `.tl-item` + `.tl-meter`, which was timeline-only CSS); now aligns typography/rail/touch targets with the rest of Work.
5. **Added `import '../components/work/WorkEntity.css'`** to `ProjectsScreen.jsx`, `AssignmentsScreen.jsx`, `ProjectDetailScreen.jsx`, `AssignmentDetailScreen.jsx`. WorkScreen already imported it from 2A. Because all five lazy screens import the same CSS file, Vite extracts it into a shared `WorkEntity-*.css` chunk (3,724 B gz) that loads once when any Work route is entered.

## Visual consistency changes

- Projects and Assignments list cards now render with the same 3px rail, same meta-chip language (status/deadline/risk), same 44px icon actions and same hairline-separated foot used on Work Overview rows — instead of the previous floating `.work-card` with its own typography, hover, padding, and meter.
- Kind identity tiles use category-tinted surfaces (project=cat-mind/accent-2, assignment=cat-body/bronze) — restrained, no gradients, no full-card colored backgrounds.
- Risk stays a single chip (not a background tint on the whole card). Completed cards fade to `opacity:0.72` with strike-through title — identical to the `.we.is-complete` treatment.
- Gallery view is untouched in information architecture but the wrapper class is renamed (`.gal-item`) to remove the collision with the old card selector; `.gal-card` interior and DepthCard depth are unchanged.

## Files changed (this commit only, 8 files, +211/−155)
- `src/components/work/WorkCards.jsx` — ProjectCard + AssignmentCard → `.we-card`; WorkRow → `.we`
- `src/components/work/WorkEntity.css` — added `.we-card` family + `.we-list`; small `.we` improvements (focus-visible, hover, icon-button size)
- `src/components/work/ProjectGallery.jsx` — `.project-card gal-item` → `.gal-item`
- `src/screens/ProjectsScreen.jsx` — added WorkEntity.css import
- `src/screens/AssignmentsScreen.jsx` — added WorkEntity.css import
- `src/screens/ProjectDetailScreen.jsx` — added WorkEntity.css import
- `src/screens/AssignmentDetailScreen.jsx` — added WorkEntity.css import
- `src/styles/work.css` — removed dead legacy `.work-card` + related blocks

No reducers, selectors, scoring, deadlines, workload, or routing touched.

## Verification

### Build / perf
- `npm run build` ✓ built in ~5.4 s; `Perf budget OK — initial JS 225.0 kB gz, CSS 47.7 kB gz, three lazy-only.`

| Chunk | Before 2B gz | After 2B gz |
|---|---:|---:|
| **Initial CSS (`index-*.css`)** | **48,691 B** | **48,499 B** |
| Ceiling | 56,320 B | 56,320 B |
| **Headroom** | 7,629 B | **7,821 B** |
| Target (≤ 54 kB) | ✅ 48.7 kB | ✅ 48.5 kB |
| `WorkEntity-*.css` (shared lazy) | — (in WorkScreen 1,213 B) | 3,724 B (shared across all 5 work routes) |
| `WorkScreen-*.css` | 1,213 B | 763 B |
| Goals lazy | 2,756 B | 2,756 B |
| Insights lazy | 3,636 B | 3,636 B |
| Habits lazy | 3,437 B | 3,437 B |

(WorkEntity CSS moved from the WorkScreen-specific chunk to a shared WorkEntity chunk so it is fetched once regardless of which Work route is entered first; initial CSS went *down* by 192 B because the dead `.work-card` and `.work-title` rules were bigger than the small `.we` improvements added.)

### Lint / diff check
- `npm run lint` — clean
- `git diff --check` — clean

### HTTP smoke (dev server, port 5176)
All 10 routes return 200: `/`, `/#/work`, `/#/projects`, `/#/assignments`, `/#/workload`, `/#/timeline`, `/#/projects/p1`, `/#/assignments/a1`, `/#/today`, `/#/insights`. WorkEntity.css served (200) and is imported by ProjectsScreen/AssignmentsScreen.

### Targeted tests
- `test/cssIsolation.test.js`, `test/advancedAnalytics.test.js`, `test/build-proof.test.js` — pass
- `test/work-entity.test.jsx` — 11/12 pass; 1 pre-existing failure (Overdue-label fixture was already failing on HEAD `7f9aa47` before any 2B edits — verified by `git stash` + rerun; unrelated to this refactor). Left for a later polish pass as it predates this step.

### Visual QA
Smoke-checked Work Overview, Projects, Assignments, Project Detail, Assignment Detail against the old card look:
- 1440px: cards align to a single row rhythm; kind/title/meta/rail/actions all line up across projects and assignments; 3px rails identical to Overview rows.
- 390px: fact grid collapses to 2-col; action icons 36–44px; no horizontal overflow; rails stay visible; `MilestoneStepper` wraps inside `.wec-body`.
- Progress percentage, CountdownChip, DeadlineHero, DeadlinePressure, QuickProgress expand/collapse all still render in their expected positions.

## Stop condition met
STOP after 2B. No HabitObject, no accessibility sweep, no Calendar/Week, no Achievements, no deploy. Ready for Phase 2C (HabitObject adoption) when you give the word.
