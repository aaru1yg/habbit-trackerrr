# HABIT OS — FINAL FRONTEND BLUEPRINT

> Step 0 reconnaissance complete. This document is the contract for the full
> frontend reset. **No UI code has been changed.** The existing V4 surface is
> treated as reference material only; nothing here preserves a component
> merely because it already exists.

---

## 0. SCOPE & GROUND RULES

### What we ARE rebuilding
- Page/screen compositions, layouts, navigation presentation
- Cards, rows, sections, heroes, forms, dialogs, sheets, overlays
- Chart visualization presentation (not the analytics math)
- Motion, typography, spacing, surfaces, themes
- All of `src/screens/*`, `src/components/*` (with exceptions below), all
  stylesheets under `src/styles/*`, the hash-router surface contract, and
  the `public/art/*` scene kit where it is visibly legacy.

### What we are KEEPING — the proven product/data layer
Nothing in this list will be rewritten, duplicated, or "cleaned up as long as
we're there." These modules are domain truth. The new UI will import them
exactly as they are.

| Layer | Modules | Why kept |
|---|---|---|
| Store / reducer | `src/store.jsx`, `src/lib/importExport.js` | Schema v4 is the honest single-document model; migrations are battle-tested. |
| Sync / auth | `src/lib/cloud/*` (AuthProvider, SyncProvider, syncEngine, merge, migrationState, supabase, errors) | Deterministic sync, honest conflict resolution, no-fake-cloud contract. |
| Domain engines | `src/lib/work.js` (904 LOC), `src/lib/goals.js`, `src/lib/goalAnalytics.js`, `src/lib/analytics.js`, `src/lib/advancedAnalytics.js`, `src/lib/stats.js`, `src/lib/adaptive.js`, `src/lib/planning.js`, `src/lib/habitPatterns.js`, `src/lib/completion.js`, `src/lib/execution.js`, `src/lib/schedule.js`, `src/lib/today.js`, `src/lib/achievements.js`, `src/lib/learning.js`, `src/lib/learningKinds.js`, `src/lib/personalization.js` | Contain all real business logic, scoring, pace math, streak math, forecasts. The UI renders their outputs. |
| Input / command layer | `src/lib/quickCapture.js`, `src/lib/commandActions.js`, `src/lib/queryParser.js`, `src/lib/intents.js` | Pure, deterministic, already decoupled from React. Omni reuses these verbatim. |
| Intelligence edge | `src/lib/ai.js`, `server/aiEndpoint.js`, `supabase/functions/ai/index.ts`, `src/lib/localCoach.js`, `src/lib/reminders.js` | Deterministic-fallback AI is the right contract. No new engine. |
| Supabase schema | `supabase/schema.sql`, Supabase Edge Function | Single-doc `user_state` model with generated counts, RLS-forced, idempotent. Proven. |
| Capability probe | `src/lib/capability.js`, `src/lib/spatial.js`, `src/lib/motion.js` | Tiered device capability + reduced-motion respect are non-negotiable. |
| Icons | `src/lib/icons.jsx` | Single stroke-weight system, 263 LOC, no dependency. Keep. |
| Dates | `src/lib/dates.js`, `src/lib/useNow.js` | Local timezone honest helpers. |
| Build / tooling | `vite.config.js`, `vitest.config.js`, `eslint.config.js` | Stable. |

### What we are THROWING AWAY / DEPRECATING
- **All V3/V4 CSS**: `styles/today-v3.css`, `styles/habits-v3.css`, `styles/work-v3.css`, `styles/workspace.css`, `styles/components.css`, `styles/base.css`, `styles/system.css`, `styles/habits.css`, `styles/work.css`, `styles/goals.css`, `styles/adaptive.css`, `styles/spatial.css`, `styles/motion.css`, `styles/auth.css` — replaced wholesale by a new token → primitive → component system. `tokens.css` is kept as a **reference** (the palette is good) but rewritten into a three-tier token architecture.
- **Legacy route aliases**: `#/library`, `#/timeline`, `#/week`, `#/mind`, `#/record`, `#/achievements`, `#/calendar`, `#/projects`, `#/assignments`, `#/workload` stay resolvable (bookmarks/links don't break) but no screen treats itself as primary under those names.
- **V4 scene artwork** (`public/art/scene-*.webp`) as visual heroes: kept as optional *decorative* layer, not as required UI. The product no longer relies on generated PNGs to communicate.
- **`SpatialStage`, `WorldLayer`, `BootSequence`, `PointerLight`, `Parallax`, `TiltCard`, `Burst`, three/ProgressCoreScene, three/WorldScene, three/SceneLayer**: kept as **opt-in scene primitives** for Atlas and one hero moment, not mounted globally. The ambient WebGL under every screen is removed.
- **Fab-stack per-route FAB** (`App.jsx` Fab): replaced by one universal Omni trigger and context-aware primary action inside each surface.
- **HabitRing, ProgressRing, ProgressCore (V4 form factor)**: rethought into the new habit language (§11); the old 148px rings and stacked cores are replaced.
- **Chart kit** (`components/charts/chartKit.jsx`, `workCharts.jsx`, `PaceChart`, `PulseRibbon`, `DayClock`, `MoodScatter`): rebuilt on a new minimal SVG chart core. The math from `analytics.js`/`advancedAnalytics.js`/`work.js` stays; only the rendering primitives change.
- **TodayHero, AdaptiveHome (emphasisVars), AdaptiveCommandCenter shims**: merged into the new Today surface.
- **SectionCard** as the universal container: replaced by a new `Surface` primitive with semantic variants.
- **GoalAtlas** in its current 3D constellation form: kept as a hidden "Atlas" spatial mode (opt-in) rather than the default goals presentation.
- **HabitCard v2 (11-line wrapper) + HabitRow + HabitList**: consolidated into one `EntityRow`/`EntityCard` primitive pair.

### Tests
- Domain logic tests under `test/*.test.js` (stats, goals, work, analytics, planning, commandActions, quickCapture, merge, personalization, learning, localCoach, adaptive, advancedAnalytics) **must keep passing unchanged**.
- UI tests (`*.test.jsx`, `*V3*.js`, `*V4*.test.jsx`, v2-release, iaRoutes, cssIsolation, analyticsLab, insightsV3, goalsV6, today-hero, executionUI, adaptiveHome, quickCaptureUI, motion, spatial, workspace, phase7, personalizationStore, unlocks, accessibility) will be rewritten against the new UX contract. They do **not** gate design decisions during Step 1+.

---

## 1. REPOSITORY MAP (FILE → RESPONSIBILITY → DISPOSITION)

### Entry & shell
| File | Responsibility | Disposition |
|---|---|---|
| `index.html` | Mount, PWA manifest link, theme-color | Keep; update font preload for new typography |
| `src/main.jsx` | React mount, providers | Keep; provider order unchanged |
| `src/App.jsx` | Route table, shell, modals, hotkeys | **Rebuild shell**; reduce global ambient layers |
| `src/store.jsx` | Single-doc reducer + localStorage persistence | **KEEP verbatim** |

### Screens (all compositions rebuild)
| Screen | Current role | Disposition |
|---|---|---|
| `TodayScreen.jsx` | Landing, hero, habits today, plan, focus, review | **Primary surface**; simplify, rebuild composition |
| `WorkScreen.jsx` | Workspace router (overview/deliverables/projects/workload/deadlines) | Promoted to a first-class **Work** domain |
| `ProjectsScreen.jsx`, `AssignmentsScreen.jsx`, `ProjectDetailScreen.jsx`, `AssignmentDetailScreen.jsx`, `WorkloadScreen.jsx`, `TimelineScreen.jsx`, `CalendarScreen.jsx`, `WeekScreen.jsx` | Secondary/legacy work views | Consolidate into Work surface + detail sheets; legacy routes resolve via router |
| `HabitsScreen.jsx`, `HabitDetailScreen.jsx` | Habit library, week/calendar, per-habit detail | Rebuild as one Habits domain with list/week/calendar modes inline |
| `GoalsScreen.jsx`, `GoalDetailScreen.jsx` | Goal list + per-goal | Rebuild; Atlas becomes opt-in |
| `InsightsScreen.jsx`, `InsightsDeepDive.jsx`, `AnalyticsLab.jsx`, `MindScreen.jsx`, `RecordScreen.jsx`, `AchievementsScreen.jsx` | Analysis / reflection | Merge into a unified **Insights** domain with modes |
| `SettingsScreen.jsx` | Profile, theme, data, capacity, reminders | Rebuild for clarity; keep forms flat |
| `Onboarding.jsx` | First-run | Rebuild (cinematic, minimal steps) |

### Components (rebased)
| Group | Keep | Rebuild/Replace |
|---|---|---|
| ui primitives | `Toaster`, `Sheet` (logic only), `EmptyState` (rewrite art+copy), `Confetti` (celebration only) | `ProgressRing`, `ProgressCore`, `AnimatedNumber`, `Bars`, `MiniMonth`, `SectionCard`, `ItemActionsSheet`, `AnimatedNumber` — all reborn as new primitives |
| layout | — | `Navigation` (sidebar + bottom nav + more sheet) → new AppChrome; `Backdrop` → new AmbientLayer; `CommandCenter`, `SearchPalette`, `QuickCapture` → unified Omni |
| today | — | `TodayHero`, `AdaptiveHome`, `AdaptiveCommandCenter`, `ExecutionPanels`, `FocusMode`, `PlanningPanel` → fold into new Today composition; `AiCoach` stub stays as hook point |
| habits | `HabitCheck` (behavior), `habitRowModel.js` (row derivations), `habitPatternsView.js`, `HabitUIProvider` (action API) | `HabitCard`, `HabitRing`, `HabitRow`, `HabitList`, `HabitActions`, `HabitDetailSheet`, `HabitForm`, `RoutineStrip`, `Routines` → redesign |
| work | `WorkUIProvider` (action API), `workViewModel.js`, `UniversalWorkRow` logic, `DeadlineField` date math, `WorkForms` field logic | `WorkCards`, `WorkKit`, `ProjectGallery`, `ProjectTrack`, `DeadlineLanes`, `DeadlinePressure`, `PaceRibbon`, `ForecastCard`, `WorkCapacitySeries`, `WorkFocus`, `WorkPlanning`, `AssignmentAnalytics`, `ProjectAnalyticsDetail` → re-compose |
| goals | `health.js`, `GoalForm` (fields) | `GoalAtlas` → keep as opt-in spatial scene only |
| charts | math callers stay | `chartKit`, `workCharts`, `PaceChart`, `PulseRibbon`, `DayClock`, `MoodScatter` → replace with new SVG chart primitives |
| motion | — | `Reveal`, `AnimateOnView`, `Burst`, `Parallax`, `PointerLight`, `TiltCard` → prune to a small motion primitive set; pointer light & parallax removed globally |
| spatial/three | — | `BootSequence`, `Depth`, `WorldLayer`, `ProgressCoreScene`, `SceneLayer`, `WorldScene` → demoted from "always on" to opt-in scene-only use (Atlas, boot) |
| shell | `OmniPanel.jsx` (4-line re-export) | becomes the real Omni implementation in the new shell |
| auth | `AuthGate`, `MigrationDialog` logic, `AccountCard` behavior | `AuthScreen`, `ResetPasswordScreen` → redesign with same auth flow |
| achievements | `UnlockWatcher` logic | — |

### Styles — wholesale replacement
All files under `src/styles/` are replaced. The new stylesheet graph:

```
src/styles/
  tokens.css         ← primitive tokens (kept & restructured)
  semantic.css       ← semantic tokens (new)
  components.css     ← component tokens + primitives (new, ~1/3 current size)
  motion.css         ← motion primitives + reduced-motion (rewritten, smaller)
  spatial.css        ← opt-in spatial scenes only (smaller)
  app.css            ← app chrome, routes, screen layout
```

---

## 2. DATA / SQL CAPABILITY MAP

The Supabase layer is a **single JSONB document per user** (`user_state.doc`)
with generated counts. All rich data lives inside `doc`. Schema version 4
contains the following entities. Every UI visualization must derive from
these real structures.

### Entity map

| Entity (doc key) | Fields & relations | Derived metrics available | UI surfaces that currently use it |
|---|---|---|---|
| `profile` | name, theme, onboarded, backup timestamps, reminder prefs | — | All |
| `habits[]` | id, name, category (8 cats), schedule (daily/weekly/xweekdays), reminder, notes, createdAt, archived, pause (from/until), skips[], order | today eligible, streak, best streak, rate windows, weekday patterns, consistency, completion time-of-day heatmap, category rollup, momentum (trend delta), habitPatterns (best day, workload correlation), skip vs fail, longest gap | Today, Habits, Insights, Analytics Lab, Goals (linked) |
| `checkins{habitId:{date:{done, at, note}}}` | per-day completion + timestamp + optional note | heatmap 52w, time-of-day, completion hour, 7/30/90/365 rates, yearOverview, weekComparison, habitMatrix, streaks (current/best), missed runs | Today, Habits, Insights, Analytics Lab |
| `routines[]` | id, name, kind, habitIds[], active, order, createdAt | routine progress, routine streak, stacked-completion rate | Today (RoutineStrip), Habits |
| `projects[]` | id, name, description, category, priority, startDate, deadline, milestones[] → tasks[] (name, done, status, due, priority, estimateMin, actualMin, notes, order, completedAt), linkedHabitIds[], notes, estimateMin, actualMin, manualPercent, legacyPercent, progressLog[], createdAt, updatedAt, completedAt, archived, order | projectProgress (task-weighted pct), projectStatus (on-track/at-risk/overdue), projectForecast, burn rate, task completion velocity, milestone completion, deadline gap, remaining effort | Work, Projects, Goals (linked), Insights workload |
| `assignments[]` | id, name, subject, description, priority, assignedDate, deadline, progress (0-100), progressMode, subtasks[], projectId, notes, estimateMin, actualMin, progressLog[], createdAt, updatedAt, completedAt, archived, order | assignmentProgress (subtask-aware), assignmentPace (expected vs actual, requiredMin/day), deadline pressure, forecast | Work, Assignments, Goals (linked) |
| `goals[]` | id, title, why, area (8 areas), startDate, targetDate, status, milestones[], linkedHabitIds[], linkedProjectIds[], linkedAssignmentIds[], manualPercent, notes, createdAt, updatedAt, completedAt, archived, order | goalProgress (milestone → assignment → project → habit → manual cascade), goalPace (expected %), goalHealth (on/behind/ahead/past/reached), goalForecast (velocity, projected completion), goalContributors (% from each link), goalTodayActions (today's linked work) | Goals, Today, Insights, Omni "at risk" |
| `moods{date:{score, energy, focus, motivation, note, wentWell, difficult}}` | 1-5 score + optional dimensional ratings + reflection | moodHabitLink (correlation with completion rate), mood trend, dimensional averages, streak of good/bad days | Mind, Insights, Record |
| `preferences` (DEFAULT_PREFERENCES coerced) | weekStartsOn, dailyCapacityMin, focusSessionMin, quiet hours | personalization scoring, homeEmphasis, capacity math | Adaptive priorities, Today emphasis, Workload |
| `signals[]` | screen-visit, habit-add, habit-complete, work-add (with at, target, note) | learning loop, next-best-action ranking, adaptive home emphasis | Adaptive (invisible to UI) |
| `focusLog[]` | recorded focus sessions (duration, target, at) | focus trend, capacity calibration | Focus mode, Insights |

### Generated columns & indexes (SQL)
- `user_state.habit_count`, `project_count`, `assignment_count` (STORED generated) → can power future "aggregate" meta-UI without loading the doc.
- `user_state_updated_at_idx` for "what changed since" / staleness sweeps.
- `user_state_doc_gin_idx` (jsonb_path_ops) for future containment queries — currently **unused** by the frontend.
- Triggers: auto-profile creation, `touch_updated_at` (immutable `created_at`), `delete_own_account` (security definer, scoped to `auth.uid()`).

### Capabilities the current UI is NOT fully using
These are real, tested, derivable today and should drive the redesign:

1. **`progressLog[]` on projects & assignments** → time-series progress charts (actual line vs expected pace line) — current UI shows only current % and forecast text.
2. **`checkins[].at` (completion timestamp)** → time-of-day completion pattern, DayClock-style "when do I actually do this" analysis — currently only used in reminders.
3. **`moods.difficult / wentWell` free-text reflections** → review surfaces (Record) barely use them.
4. **`habitPatterns` workload correlation** → "you perform 30% worse on days >2 commitments" is computed but only shown as a one-line sentence.
5. **`goalForecast` projected completion** → exists in `goalAnalytics.js`, surfaced only as status label, not as a trajectory.
6. **`signals[]` learning loop** → currently invisible; should quietly drive emphasis and Omni ranking, never be a dashboard.
7. **`focusLog[]`** → no trend UI.
8. **`moods.energy/focus/motivation` dimensions** → only score is visualized.
9. **Category coverage / balance** across habits/goals/projects → derived but no "life balance" view.
10. **Weekday × performance** heatmap (per-habit) → data ready; only the per-habit best-day sentence exists.
11. **`routine` stacking efficiency** (do you actually chain habits?) → computed but not shown.
12. **Reschedule suggestions** from `planning.js` exist (`rescheduleSuggestions`) and are surfaced in one overload card; they should be first-class Workload actions.
13. **Recovery plans** (`recoveryPlan`) → Today shows it only when behind.

---

## 3. CURRENT PRODUCT CAPABILITY MAP (by user intent, not route)

### EXECUTE — "What do I do, and let me do it now"
- Tap a habit done for today (TOGGLE_CHECKIN)
- Tap a habit done for a past day (calendar/week)
- Add a note to a check-in
- Check off a project task / assignment subtask
- Move assignment progress explicitly (0–100 slider)
- Skip a day for a habit / pause a habit
- Reorder habits (Today drag)
- Run a routine (batch completions)
- Quick Capture natural-language entry (habit/project/assignment/task/milestone/note with date/deadline parsing)
- Start a Focus session (timer, logged)
- Complete adaptive "next best action" in one tap
- Navigate to the at-risk item in one tap

### MANAGE — "Organize my world"
- CRUD habits (schedule, category, reminder, notes, pause)
- CRUD routines (stacked habits)
- CRUD projects (milestones, tasks, deadlines, priorities, estimates, linked habits)
- CRUD assignments (subtasks, deadlines, project link, progress)
- CRUD goals (areas, dates, milestones, linked habits/projects/assignments, manual %)
- Reorder projects/assignments/tasks/subtasks/milestones
- Archive / restore / delete all entity types
- Set daily capacity (min), week start, reminder preferences
- Theme selection (5 themes)
- Profile/name/avatar display
- Import/export (JSON), backup reminder
- Account: sign in/up, password reset, cloud sync with migration choice, delete account

### PLAN — "What is coming, what should I do next"
- Command Center: "What should I do next?", "Plan my day", "Plan my week", "Start focus", "View at-risk", "View workload", "Open analytics"
- Natural-language queries: "due this week", "at risk", "habits I'm missing", "overloaded days", "goals behind pace", "what should I do today"
- Today Priorities (adaptive scored list across all entity types)
- Next Best Action with reasons
- Workload capacity view (7 days), overload/recovery plan, reschedule suggestions
- Deadline pressure (today/tomorrow/next N days grouped)
- Deadline horizons (overdue/today/3d/7d/30d)
- Project forecast, assignment pace, required minutes/day
- Recovery plan after falling behind

### UNDERSTAND — "How am I doing"
- Today stats (done/total, best streak, headline)
- Daily insight sentence, weekly review summary
- Trend chart (7/30/90/365 days completion rate)
- Heatmap (52-week GitHub-style)
- Habit × day matrix (28 days)
- Habit performance table (rate, streak, best) sortable
- Habit patterns (trend, best weekday, workload correlation)
- 30-day ring + streak hero
- Achievements / badges (4 tiers × categories)
- Mood score tracking with dimensional ratings
- Mood ↔ habit correlation
- Goal health (on/behind/ahead/reached/past)
- Goal contributors (% of progress from each linked item)
- Work capacity time series (7d)
- Week-over-week comparison
- Analytics Lab (deep multi-series engine, lazy)

### REVIEW — "Reflect"
- Weekly review prompt (Sundays)
- Daily check-in mood entry + "went well / difficult" reflections
- Per-habit history sheet
- Per-project analytics detail (burn-up, task velocity)
- Per-assignment analytics (pace, remaining effort)
- Goal detail (milestones, contributors, trajectory)
- Mind reflection view (mood trend + reflections)
- Achievements/gallery

### EXPLORE — "See the bigger picture"
- Goal Atlas (3D constellation, currently optional/lazy)
- Project Gallery (spatial corridor)
- Calendar / week views (habit completion grid)
- Timeline (deadline chronological)
- Omni search across entities + commands
- Boot cinematic (first launch / session intro)
- Routine stacking view

---

## 4. PAIN-POINT AUDIT (ruthless)

### Feature fragmentation & navigation sprawl
- 16+ first-class routes in the hash router (today/work/calendar/week/insights/mind/goals/library/settings/projects/assignments/workload/timeline/record/habits/achievements). Bottom nav exposes 5; the rest hide under "More" sheet and legacy aliases. User cannot build a reliable mental map.
- Multiple routes render the same content under different names (`mind` → `insights?view=mind`, `record` → `insights?view=record`, `library` → `habits?view=active`, `timeline` → `work?view=deadlines`, `week` → `habits?view=week`, `projects`/`assignments`/`workload` duplicate Work's inner views).
- `canonicalParent()` already tries to paper over the fragmentation; that is the code telling us the IA is wrong.

### Overcrowded Today
- TodayScreen mounts: hero, greeting, stats, week bars, quick actions, routines strip, habit list (reorderable), at-risk streak warning, near-milestone hint, overdue row, AdaptiveCommandCenter, weekly-review card, backup reminder card, ExecutionPanels lazy, PlanningPanel lazy, FocusMode lazy, ItemActionsSheet lazy, AdaptiveEmphasis, AdaptiveQuickActions. That is 15+ distinct panels on one screen at 390px width.
- Multiple "priorities" lists: adaptive priorities, todayPlan.rows, recovery plan rows, routines, near-milestone, overdue, at-risk — each with slightly different ranking logic and visual treatment.
- Three different "AI/coach" affordances (AiCoach stub, AdaptiveCommandCenter, daily insight sentence).

### Cards, cards, cards
- `SectionCard` wraps almost every block, so the visual plane is a stack of identical rounded-corner rectangles with `sp-depth` hacks.
- Many cards contain a single sentence or a single chart.
- V4 scene images (`scene-data-room.webp`, `scene-hero.webp`) appear as decorative rectangles *inside* cards, breaking hierarchy and stealing vertical space.

### Weak visual hierarchy
- Almost every block uses the same card chrome (`--e-card`, `--r-lg`, hairline border), so real importance doesn't read.
- Headings vary between `screen-title` (`--fs-display`), `h2`, `h3`, `eyebrow`, `tiny muted`, `workspace-next` without a clear hierarchy.
- Primary actions compete: FAB changes meaning per route (add habit / add project / add assignment / open quick-capture menu).
- Badges/pills/tags (risk labels, categories, "today", "real history only") proliferate without a density rule.

### Repeated information
- "Streak" appears in Today hero, today stats, at-risk warning, top-streak block, habit row, habit detail, insights hero, habit performance table.
- "At risk" appears in: Command Center, Work overview summary, Work attention section, Deadlines view, Today priorities, goal health, Omni filter "view-at-risk". Each looks different.
- % progress on a project appears in: row meter, card, project detail, analytics detail, gallery card, track, linked from goal contributors.

### Hidden functionality
- Plan my day / Plan my week / Start focus live inside TodayScreen and are reachable only via the Command Center (⌘K) — no visible affordance.
- Skip day, pause habit, habit notes, checkin notes are buried in HabitRow/HabitActions/HabitDetailSheet sheets.
- Weekly review is gated behind Sunday + localStorage flag; users can never revisit it.
- Reschedule suggestions only appear inside the overload card.
- Mood tracking lives under `/#/insights?view=mind`, not a natural place for daily reflection.

### Duplicated interaction patterns
- Sheets vs dialogs vs popups vs inline forms are inconsistent: `HabitDetailSheet`, `ItemActionsSheet`, `WorkForms` inline toggle, `GoalForm` sheet, `QuickCapture` command palette, FAB menu, `MoreSheet`.
- Two distinct "percentage meters" (`Meter` in WorkKit vs custom bars in today/insights).
- Two ring implementations (`ProgressRing`, `HabitRing`, plus `ProgressCore` with layered WebGL fallback).

### Excessive decoration
- `WorldLayer`, `PointerLight`, `Backdrop`, `BootSequence`, `TiltCard`, `Parallax`, `SpatialStage`, `SpatialStage focus={1800} parallax={7}` on Insights hero — all ambient effects firing on every screen even though the user is looking at a checklist.
- `scene-*.webp` artwork appears in multiple sections and dominates on slow connections (34 kB is fine, but being *required* for hero composition is not).
- `aurora-*` gradients and noise texture are unconditionally painted under every surface.

### Poor mobile composition
- Content max is 1240 px but mobile (~390px) gets the same "stack of cards" with zero dedicated layout.
- Bottom nav competes with FAB-stack; FAB changes between screens causing muscle-memory friction.
- Sidebar is hidden behind hover/focus on mobile and becomes a drawer; the "More" sheet holds half the IA.
- Charts (trend, heatmap, WorkCapacitySeries, ProjectTrack) don't have small-density variants; they render full-size and scroll.
- Sheets at 100vh on mobile stack modals (detail sheet → actions sheet → form sheet).

### Poor data density
- 30-day progress on Insights is a giant 148px ring surrounded by whitespace, when a number + sparkline is enough.
- Habit rows on Today show the habit ring, name, category icon, streak, last-done, and three action buttons — for a task that is either done or not.
- Project cards in gallery mode use full-width hero art per project.

### Poor chart readability
- Charts use bespoke SVG (chartKit, workCharts) without a consistent axis/grid/legend language.
- "Actual vs expected" appears as a ribbon (PaceRibbon) on work items but not as a proper line chart.
- WorkCapacitySeries is a stacked bar with no axis labels in compact mode.
- Heatmap uses 8 opacity levels without a legend and doesn't respect forced colors / high contrast.
- MoodScatter uses a coordinate system without labeled axes.

### Inconsistent visual language
- 5 themes but only Midnight was tuned; Aurora/Ember/Verdant/Daylight inherit component shadows tuned for Midnight and look muddy.
- Two typefaces (Inter + Manrope) are loaded every time; numbers in Manrope don't always tabular-align.
- Buttons come in `btn`, `btn primary`, `btn ghost`, `btn sm`, `floating`, `fab-choice`, `seg-btn`, `workspace-*` variants with no single button spec.

### Unnecessary 3D / spatial
- `WorldLayer` (WebGL particles), `PointerLight` (mouse-following glow), and `ProgressCoreScene` fire on app boot even though the user's primary job is checking boxes.
- `SpatialStage` with parallax applied to the insights "overview" section adds scroll jank on mid-tier devices.
- Project Gallery "spatial corridor" is a presentation mode for what is ultimately a list of projects.
- `BootSequence` runs on every cold load (skippable but still mounted).

### Omni is underrealized
- OmniPanel is a 4-line re-export; the real panels are split between `CommandCenter`, `SearchPalette`, `QuickCapture`, with three separate keybindings (⌘K, `/`, FAB click) that open different modes of the same conceptual surface.
- No universal "ask Habit OS" natural-language result surface — queryParser detects a filter but then navigates away instead of showing results inline.

### Accessibility weak spots (already tested but will be re-tested)
- `aria-pressed` on segmented controls is good, but modals don't always return focus (FAB menu, More sheet, nested sheets).
- Focus ring (`--focus`) is violet but sits close to accent-1 on dark surfaces.
- Reduced motion is respected for confetti and boot, but route-cam and parallax still fire on some paths before CSS can disable them.
- Charts have no text fallback/summary tables.

---

## 5. NEW INFORMATION ARCHITECTURE

The IA is organized by **user intent** (Execute / Plan / Understand / Review)
collapsed into **four primary domains** plus a universal command surface.

```
APP SHELL
├── OMNI (⌘K / / · tap)        ← always available: capture, search, commands, coach
│
├── TODAY          ← PRIMARY (default landing)    EXECUTE
├── WORK           ← PRIMARY                      PLAN + EXECUTE
├── HABITS         ← PRIMARY                      UNDERSTAND + EXECUTE
├── INSIGHTS       ← PRIMARY                      UNDERSTAND + REVIEW
│
├── Goals                                         PLAN + REVIEW (contextual)
├── Settings                                      MANAGE
│
└── SPATIAL: ATLAS (opt-in, from Goals)           EXPLORE
```

### Primary (bottom-nav / sidebar top level)
1. **Today** — "What do I do right now?" (Execute)
2. **Work** — "What is on my plate across projects & deadlines?" (Plan)
3. **Habits** — "What am I building, and how consistently?" (Execute + Understand)
4. **Insights** — "How am I doing, over time?" (Understand + Review)

### Secondary (in-sidebar, not in bottom nav)
- **Goals** — outcomes layer. Accessible from sidebar and from any linked entity; goals also surface inside Today/Work/Habits as context.
- **Settings** — manage profile, theme, reminders, data, capacity, cloud.

### Contextual (only from a parent surface, not in primary nav)
- Project detail, Assignment detail, Habit detail, Goal detail — **sheets or sub-views**, not new top-level routes.
- Record (mood check-in) — initiated from Today or Insights; not its own tab.
- Week/Calendar for habits — modes **inside Habits**, not routes.
- Workload, Deadlines, Projects, Assignments — **tabs inside Work**, not routes.
- Deep dive, Lab, Achievements, Mind — **modes inside Insights**.
- Timeline of deadlines — a toggle inside Work's Deadlines tab.

### Discoverable only through Omni
- Analytics Lab deep filters ("show me habits with <50% completion in the last 30 days on Mondays")
- Focus timer (also in Today as a mode)
- Plan my day / Plan my week (also surfaced contextually)
- Natural-language search results ("due this week", "at risk", etc.)
- Quick capture advanced modes (add project task, link to goal, etc.)
- Keyboard navigation of entities
- Achievements (also accessible via Insights → Achievements mode)

### Routing changes
- Primary hash routes collapse to: `#/today`, `#/work`, `#/work/:tab`, `#/habits`, `#/habits/:mode`, `#/insights`, `#/insights/:mode`, `#/goals`, `#/goals/:id`, `#/settings`.
- Entity details open as **overlay sheets by default** (URLs like `#/work?focus=project/:id` OR full routes `/goals/:id` for deep-linking goals, which are outcome entities worth their own URL).
- Legacy routes (`library`, `timeline`, `week`, `mind`, `record`, `achievements`, `calendar`, `projects`, `assignments`, `workload`) resolve via one-line redirects to the canonical parent+mode so bookmarks don't break.

---

## 6. SCREEN RESPONSIBILITIES

### TODAY
- **Primary question:** "What should I do right now?"
- **Primary action:** Complete the next thing (habit, task, focus block).
- **Secondary context:** Date/greeting, today's completion progress, at-risk streak warning if it exists, today's top priorities (3–5, scored), top-of-mind goal or deadline, any scheduled routines.
- **Deep information:** Today-only plan panel (triggered), focus mode (triggered), weekly review card (Sunday, dismissible), mood check-in prompt (evening).
- **Does NOT belong here:** Full analytics, 52-week heatmap, gallery/project cards, boot cinematic, ambient particle layer, deep goal atlas, year-over-year stats, all active projects list, settings shortcuts, backup reminder (moves to settings + quiet notification), decorative scene artwork.

### WORK
- **Primary question:** "What is coming up, and can I actually do it?"
- **Primary action:** Triage what is next (mark progress, reschedule, start task).
- **Secondary context:** Tabs: Overview / Deadlines / Projects / Workload. Summary strip (At risk · Due soon · Active · Capacity remaining). Horizon chips.
- **Deep information:** Project detail (sheet or sub-route), assignment detail (sheet), workload by day, reschedule suggestions, recovery plan, plan-week panel.
- **Does NOT belong here:** Habit streaks, mood tracking, achievements, decorative hero art, spatial gallery as default.

### HABITS
- **Primary question:** "What habits am I building, and how are they going?"
- **Primary action:** Check off / edit / reorder habits; see consistency at a glance.
- **Secondary context:** Mode switch: Active / Week / Calendar / Routines. Category filter.
- **Deep information:** Habit detail sheet (history, heatmap, streaks, patterns, linked goals, notes), habit form, routine builder, pause/skip controls.
- **Does NOT belong here:** Project deadlines, assignments, goals in depth (links only), mood correlation (moves to Insights), full analytics lab.

### INSIGHTS
- **Primary question:** "How am I doing, really?"
- **Primary action:** Read & reflect. No primary transactional action.
- **Secondary context:** Modes: Overview / Trends / Mind / Achievements. Range switch (7/30/90/365).
- **Deep information:** Analytics Lab (lazy, advanced multi-series, comparisons, projections), per-habit deep dive, year review, mood×habit correlation, goal contributor analysis.
- **Does NOT belong here:** Check-in buttons, project CRUD, habit CRUD, calendar entry, quick capture, focus timer, decorative scene artwork under content.

### GOALS
- **Primary question:** "What am I trying to achieve, and am I on pace?"
- **Primary action:** Add or update a milestone; link real work to a goal.
- **Secondary context:** Health badge (on pace/behind/ahead/reached), actual vs expected line, contributors list, next milestone, linked today-actions.
- **Deep information:** Goal detail trajectory, Atlas view (opt-in spatial, lazy-loaded), linked-habit performance over window, forecast completion date.
- **Does NOT belong here:** Full habit library UI, project kanban/gallery as default, non-linked work, decorative ambient scene.

### SETTINGS
- **Primary question:** "How does this app work for me?"
- **Primary action:** Update preference; export/import data.
- **Secondary context:** Sections: Profile, Appearance (theme), Reminders, Capacity & Focus, Data (import/export/delete), Cloud (account, sync status).
- **Deep information:** Sync status, migration choices, account deletion (with SQL function).
- **Does NOT belong here:** Analytics, work items, decorative backgrounds, webgl.

### OMNI (global surface, not a screen)
- **Primary question:** "Do this / find this / go there."
- **Primary action:** Execute a command, capture an item, navigate to a result.
- **Secondary context:** Search results, commands, capture preview with parsed entities, next-action suggestion.
- **Does NOT belong here:** Full-page dashboards, settings forms, multi-step wizards.

### ATLAS (opt-in spatial scene, not default)
- **Primary question:** "Show me my goals as a system."
- **Primary action:** Explore; select a goal.
- Reuses WebGL tier gating. Not loaded unless user enters `/goals?mode=atlas` or taps "Atlas" on the Goals screen.

---

## 7. VISUAL ART DIRECTION

### Chosen direction: **Premium Productivity × Minimal Intelligence Dashboard**
A hybrid of three families, selected after evaluating against Habit OS's
actual job (daily decisions + honest data + calm premium feel):

| Family | Fit for Habit OS | Verdict |
|---|---|---|
| Cinematic editorial | Strong for hero moments and onboarding; too indulgent for a 10×a-day productivity surface. | Use sparingly for first-run and Atlas. |
| **Premium productivity** | Dense, confident, quiet, typographic. | **Primary voice.** |
| Spatial operating system | Beautiful but requires constant 3D which taxes mid-tier devices and hides density behind metaphor. | Used only in Atlas. |
| Modern data workspace (Linear/Vercel/Stripe-dashboard school) | Strong information density, hierarchy, typography; weak on warmth and the "alive" quality. | Adopt density & structure rules; reject cold SaaS blue. |
| Minimal intelligence dashboard (Arc/Linus–style) | Calm, intelligent, quiet motion, restrained palette. | **Secondary voice.** |
| Immersive command interface (ORCA-like terminal) | Pairs with Omni; too aggressive as default shell. | Use for Omni mode only. |

### Why this fits
Habit OS is opened many times per day, for 10 seconds at a time, and
occasionally for deep review. The default skin must:
- Let a single tap on a checkbox be the loudest thing on screen.
- Show data honestly (no glow around a 40% completion to make it feel good).
- Feel premium at first launch and invisible on the 400th launch.
- Let the intelligence (priorities, pace, risk) speak through typography and
  color, not through ornament.

### What to avoid
- Generic SaaS: large rounded cards, pastel gradients, 8px-soft shadows on everything, chart-filled dashboard heroes.
- Cyberpunk/gaming UI: neon outlines, starfields, HUD brackets, grid floors, lens flares, lens distortion.
- Excessive glass: heavy backdrop-blur everywhere (it tanks scroll performance and reduces contrast).
- Overdone 3D: no tilting cards, no pointer lights, no ambient particles on every screen.
- Anthropomorphic characters, mascots, trophies rendered as 3D objects.
- Rainbow category palettes — categories are semantic, not decorative.

### Visual hierarchy rules
1. **Content over chrome.** Every surface is divided into:
   - A narrow header (title + one primary action).
   - Content zones separated by spacing, not by cards.
   - A contextual footer rail only when needed.
2. **One hero per screen.** Today has the completion headline + next action. Work has the capacity strip. Insights has the primary metric.
3. **Elevation is rare.** 95% of UI sits on the canvas (no card). Elevation is reserved for: interactive rows on press, sheets/dialogs, the Omni surface, selected entities.
4. **Color carries meaning.** Accent color is reserved for primary actions, progress, and the selected entity — not for section headings.
5. **Density is user-controlled.** Two density modes: Comfortable (default, ~56px rows) and Compact (toggled in Settings, ~40px rows). Charts never go below a 28px touch target.

### Motion level
- Subtle, cinematic, **infrequent**.
- Default ease: `cubic-bezier(0.22, 1, 0.36, 1)` (material-style standard, already in tokens).
- Most state changes (checking a habit, opening a sheet) animate at 180–280ms.
- Page transitions are a **crossfade + subtle lift** of 8px over 320ms — not a full camera-travel.
- Reduced motion: collapses to opacity fades only; no translation, no scale.

### Spatial/3D usage
- Default shell: **zero 3D**, zero WebGL on app boot.
- 3D scenes opt-in and are only loaded when a user enters Atlas or activates the cinematic boot (first-run only).
- `allowsLiveScenes()` / `deviceTier()` gate from `capability.js` is respected — low tier gets static poster art.

### Chart language
- **Honest axes.** Every time-series chart has: baseline at 0 (or at actual data minimum for % diff charts), labeled Y axis with 2–3 tick values, labeled X axis at regular intervals, subtle gridlines.
- **Actual vs expected:** solid line (actual) + dashed line (expected).
- **No 3D bars/columns/pies.** No pie charts at all.
- **One accent color per chart + neutral gray for context.** Multi-series charts use the 8-color qualitative palette already in tokens (`--c1`..`--c8`), in order.
- **Interactive** only on Insights/Lab: hover shows tooltip with exact value; on tap (mobile) it pins the tooltip.
- **Sparklines** (no axis) for inline metrics (Today hero, list rows).

---

## 8. FINAL VISUAL PERSONALITY

When the user opens Habit OS they should feel:

- **Premium** — typographic, considered spacing, no cheap fills.
- **Intelligent** — the software is doing honest math on real data and showing what matters, not filling space with widgets.
- **Calm** — quiet surfaces, no alarmist red unless something is actually wrong.
- **Purposeful** — every element answers a question or performs an action.
- **Spatial** — when it matters (Atlas, first launch, one hero moment) the app opens up, then returns to flat.
- **Alive** — a check-in animates with quiet confidence, a streak milestone has a small burst, the Omni input cursor pulses gently.
- **Precise** — numbers are tabular, baselines align, grids snap.
- **Modern** — clean, contemporary, but not trend-chasing.

The emotional register is closer to **a calm control room** than to **a gamified to-do list** or **a generic SaaS dashboard**.

---

## 9. DESIGN SYSTEM DIRECTION

Three-tier token architecture: **Primitive → Semantic → Component**.

### 9.1 Typography
- **One family, two optical sizes:** Inter Variable for everything. Manrope is dropped (one fewer font load, one less visual opinion). Numbers use Inter's tabular-nums (`font-variant-numeric: tabular-nums`) for all metric/chart/table cells.
- **Display weight:** 600 (semibold) for large titles; 700 reserved for single big numbers (completion %, primary metric).
- **Tracking:** Tight -0.02em for display; -0.01em for h1/h2; 0 for body; 0.08em for uppercase eyebrows.

**Fluid scale (mobile → desktop):**

| Token | Size | Use |
|---|---|---|
| `--fs-metric` | clamp(2.75rem, 7vw, 4rem) | Single big number (Today %, Insights 30-day) |
| `--fs-display` | clamp(1.75rem, 3vw, 2.25rem) | Screen titles |
| `--fs-h1` | clamp(1.25rem, 2vw, 1.5rem) | Section headers |
| `--fs-h2` | 1.0625rem | Subsection headers, entity titles in rows |
| `--fs-body` | 0.9375rem | Body, labels |
| `--fs-sm` | 0.8125rem | Secondary text, metadata |
| `--fs-xs` | 0.75rem | Eyebrows, chart axis labels, badges |
| `--fs-micro` | 0.6875rem | Timestamps, legal |

Line heights: tight (1.15) for metrics/headings, snug (1.3) for section content, body (1.55) for paragraphs only.

### 9.2 Color
- **Base canvas:** One true dark flagship (Midnight, slightly deepened to `#0a0e18`) and one true light (Daylight, warmed). Aurora, Ember, Verdant remain as alternate themes but re-balanced to the same contrast ratios.
- **Color roles, not color names:** every color is referenced semantically (see Semantic tokens).
- **Accent is violet** (#7B5CFF, adjusted from #7048f5 for better contrast on Midnight surfaces) with **cyan** (#22d3ee) as the secondary energy color used only for pace lines, focus rings, and Omni.
- **Semantic status:** `good` (emerald), `warn` (amber), `bad` (rose), `info` (sky). Same across themes (shifts hue only to retain contrast).
- **Data palette:** 8 qualitative hues (current `--c1`–`--c8`) preserved; sequential palette (4 steps) for heatmaps. **No** red-green-only encoding (pair with shape/label).

### 9.3 Spacing
- Pure **4px base grid** (retiring the dual `--space-*`/`--sp-*` system in favor of a single `--sp-*` scale): `--sp-1=4, --sp-2=8, --sp-3=12, --sp-4=16, --sp-5=20, --sp-6=24, --sp-8=32, --sp-10=40, --sp-12=48, --sp-16=64`.
- Layout gutters: `--gap-page` (mobile 16px, desktop 24px), `--gap-section` (24px mobile, 32px desktop), `--gap-row` (12px), `--gap-inline` (8px).

### 9.4 Radius
- `--r-sm: 8px` — buttons, chips, badges.
- `--r-md: 12px` — inputs, inline rows, small cards.
- `--r-lg: 16px` — sheets, dialogs, larger surfaces.
- `--r-xl: 22px` — primary hero cards only.
- `--r-pill: 999px` — tabs, segmented controls, FAB.
- Remove `--r-hero` (32px); oversized corners look childish.

### 9.5 Surfaces
- Most UI is **on-canvas** (no surface card). When a surface is needed:
  - `surface-1` — subtle raised container (used for grouped lists, sheets).
  - `surface-2` — inset container (used for input fields, sunken regions).
  - `surface-3` — strong elevation (dialogs, popovers).
- Backdrop blur is used **only** for sheets and Omni (performance budget).
- Hairline (`1px solid --border`) instead of hard shadow for resting surfaces.

### 9.6 Borders / Depth / Shadows
- Default hairline: `1px solid rgba(255,255,255,0.07)` dark / `rgba(0,0,0,0.08)` light.
- Stronger border for selected/hovered rows: `--border-2`.
- Shadows only at elevation: sheets (`--e-2`), dialogs (`--e-3`), floating menus (`--e-2`). Resting cards use hairline + 0 1px 0 inset highlight — no drop shadow.
- **No glow.** `box-shadow: 0 0 24px …` is banned except for the focus ring (which is a 2px outline at `--accent-2`).

### 9.7 Icons
- Single stroke set (existing `lib/icons.jsx`), 1.5px stroke, 24px viewbox.
- Sizing: 16 (inline), 20 (row/button), 24 (primary actions/header), 28 (hero).
- No filled icons except for active tab state (filled variant paired with stroke).

### 9.8 Focus states
- Visible 2px solid outline using `--focus-visible` token; offset 2px.
- All interactive elements (buttons, rows, chips) must have a focus-visible style.
- Never remove outlines without providing an alternative.

### 9.9 Touch targets
- Minimum 44×44px for all interactive elements on touch devices.
- In compact density rows stay at 44px tall; padding shrinks, not the hit target.

### 9.10 Motion (see §14)

### 9.11 Responsive rules (see §15)

### Primitive tokens → Semantic tokens → Component tokens

**Primitive** (raw values): palette ramps, spacing scale, type scale, radius scale, motion curves, shadow primitives.
**Semantic** (intent):
- `--bg`, `--bg-raise`, `--surface-1/2/3`, `--text`, `--text-2`, `--text-3`, `--border`, `--border-2`, `--focus-ring`
- `--accent`, `--accent-soft`, `--accent-contrast`
- `--good/warn/bad/info` (+ `-soft`)
- `--data-1..8`, `--seq-0..4`
- `--cat-<area>` (8 categories, derived from accent hue × area)
- `--shadow-sm/md/lg`, `--radius-sm/md/lg/xl`
- `--dur-*`, `--ease-*`
- Entity scales (see §13): `--habit-<hue>`, `--goal-<hue>`, `--project-<hue>`, `--series-<n>` (derived, not hand-picked)
**Component** (only what primitives can't express):
- `--btn-h`, `--btn-pad-x`, `--btn-radius`, `--btn-fs`
- `--row-h-comfortable`, `--row-h-compact`
- `--sheet-w`, `--sheet-r`
- `--chart-grid`, `--chart-axis`, `--chart-tooltip-bg`
- `--nav-h`, `--sidebar-w`

---

## 10. SPATIAL / 3D STRATEGY

Strict three-tier classification:

### FLAT (default, 95% of product)
- All forms, inputs, tables, settings, lists, dialogs, sheets, Omni, charts, primary navigation.
- No transform, no Z, no backdrop-filter except sheets.
- Color + typography + hairlines carry hierarchy.

### DEPTH (contextual elevation)
- **Elevated rows on press** (scale 0.98, duration 120ms).
- **Selected entity card** (habits/goals/projects in their detail view): slight 0–2px lift with `--e-2`, border `--border-2`.
- **Sheets/dialogs/Omni** (layered over content, with scrim).
- **FAB** (always accessible, `--e-2` + solid surface).
- **Progress visualization on Today** and Goal detail (single dominant progress element, subtle depth — not a ring, see §11).
- NO pointer-tracking lights, NO tilting cards, NO parallax in scroll.

### SPATIAL (opt-in scenes)
- **Boot cinematic** (first-run only, skippable, reduced-motion = static poster).
- **Goal Atlas** (entered from Goals header, lazy-loads three/ on demand; low tier sees 2D constellation poster).
- That's it. No "every screen has a spatial layer." Spatial is a mode the user enters deliberately.

Spatial rules:
- Never load three.js on app boot. Dynamic `import('three')` inside Atlas and Boot only.
- On mobile (coarse pointer, touch), 3D scenes default to static poster; user can tap "Explore" to enter full spatial.
- All spatial scenes must render within 2s on a 2020 laptop; if the frame budget drops, auto-degrade to the static poster.
- No first-person camera flying. Scenes are observed from one elegant position.

---

## 11. HABIT VISUAL DIRECTION

The circular habit ring is retired as the default habit presentation. Rings
read as "system monitor," not as "small thing I do every day." New language:

### Daily-habit row (Today, Habits list)
- A **linear progress rail** to the left of the habit name: a 3px track with a fill segment for today's completed portion (binary = on/off; routines = sequential). The rail uses the habit's derived accent color.
- A **status dot** (filled = done, outline = pending, dim = skipped/paused) — the primary tap target.
- Name, category eyebrow, streak flame + count only when streak ≥ 3 (never shown by default on every habit to reduce noise).
- Swipe/tap on the dot completes; swipe right → schedule / skip / pause; tap the chevron or the row body → detail sheet.

### Habit card (Habits library, compact)
- Stacked **layered card**: 1px hairline frame, subtle accent left-stripe (4px wide, soft), name, category, 7-day completion sparkline (inline, no axis), current streak.
- No rings. No progress cores. No gradient fills.

### Streak visualization
- A streak is shown as a **small flame glyph + numeric count**, right-aligned. On milestone days (3, 7, 14, 30, 60, 90, 365) the count briefly pulses and the celebratory burst fires (respecting reduced motion).
- **Streak rail**: In Habit detail, a horizontal "streak chronology" — the longest streak as a filled bar, current streak overlaid, best streak labeled.
- Long streaks are **not** represented by growing rings that imply completion of something infinite; a streak is a count, not a percent.

### Progress (primary visual on Today & Goal detail)
- A single **linear completion track** on Today with today's total, done, and remaining as segments.
- On Goal detail: a **horizontal pace chart** (solid actual + dashed expected, X axis time).
- Circular rings remain available **only** as a small 32/40px glyph in rows where a percent needs a compact summary (e.g., project/assignment rows in Work) — a 4px stroke ring, not a hero.

### Accent color per habit
- Derived from category (8 categories → 8 hues), with opacity variants: soft, muted, strong, contrast (see §13). Users cannot pick arbitrary colors; they pick a category and the system derives the color. This preserves consistency across themes and prevents rainbow UIs.

### Premium feel, not gimmick
- Subtle 1px internal highlight on top of the filled rail to give it a polished light, not a glow.
- On completion: track fills in 240ms, dot scales 1→1.2→1 with a soft spring; counter (if visible) animates with `AnimatedNumber` (kept). No confetti per habit (confetti reserved for milestone/goal completion only).

---

## 12. DATA VISUALIZATION STRATEGY

Chart library: a new small in-house SVG core (`components/charts/` rebuilt),
pure React + inline SVG, no chart library dependency. Math comes from the
existing analytics modules.

Rule: **one chart per question.** No dashboard with 10 charts.

| Question | Chart | Where it lives |
|---|---|---|
| "How much of today is done?" | Linear progress bar (segmented done/total/at-risk) | Today hero |
| "Am I on pace for this goal?" | Actual vs expected line (solid actual, dashed expected, goal window shaded) | Goal detail, Work rows (mini) |
| "What's my completion trend?" | Multi-series line (7/30/90/365 day) with baseline at 0%, range selector | Insights → Trends |
| "When during the day do I complete habits?" | Circular 24h dot plot (DayClock reborn, readable axis) | Insights → Trends / Habit detail |
| "How consistent am I all year?" | Heatmap (52-week, GitHub-style, with legend, forced-colors friendly) | Insights → Overview |
| "Which habits are strongest?" | Sortable bar chart (habit rate, horizontal) | Insights → Trends |
| "How does this week compare to last?" | Paired bar (week vs week, with delta) | Insights → Overview sidecar |
| "Is my workload realistic?" | Stacked bar per day, capacity line overlay, overload highlighted | Work → Workload |
| "What's due and when?" | Timeline (horizontal lanes: Overdue/Today/7d/30d) | Work → Deadlines |
| "What is contributing to this goal?" | Stacked horizontal bar of contributors (habits/projects/assignments) | Goal detail |
| "Where is the risk across work?" | Horizon summary chips + sorted list, not a chart | Work → Overview |
| "How has my mood been?" | Multi-dimensional line (score/energy/focus/motivation) over selected window | Insights → Mind |
| "Does my mood correlate with habits?" | Scatter (completion rate × mood score, 28-day) with trend | Insights → Mind |
| "How is this project tracking?" | Burn-up (scope line + done line + projection) | Project detail |
| "How much time is left on this assignment?" | Pace ribbon → replaced by small actual-vs-expected line + remaining minutes number | Assignment row/detail |
| "How long are my focus sessions?" | Histogram of session durations | Insights → Trends (lazy) |
| "What categories are balanced in my life?" | Radar of categories (habit count × completion rate × goal focus) — use sparingly | Insights → Overview (hidden under "Balance" expandable) |

Chart rules:
- Sparkline (24–40px tall, no axis) for inline metrics.
- Small chart (120–180px tall, axis + labels) for dashboard/cards.
- Full chart (240–320px tall, axis + labels + legend + tooltip) for detail and Lab.
- No chart appears on Today except the completion rail and one sparkline in the header.
- Every chart has: an accessible title, a one-sentence plain-language summary, tabular data fallback for screen readers.
- No 3D, no donuts thicker than 8px, no animated intros on every render (animate on enter only).

---

## 13. COLOR PERSONALIZATION

All entity colors are **derived** from a small set of hues. Users don't pick
hex codes; they pick a category/area, and the system computes a tonal palette
that works in both themes.

### Derivation model
For each hue (category/area/series):
- **base** — the saturated reference hue (used for accents, tracks, links).
- **soft** — 12–16% alpha over canvas (used for pill backgrounds, filled regions).
- **muted** — 40% opacity, used for non-active elements (inactive track, forecast).
- **strong** — slightly darkened/lightened for text on surfaces (passes 4.5:1 AA on the surface it sits on).
- **contrast** — the color to place *on top* of `base` (white or near-black).

Categories (habits): fitness, health, mind, learning, creative, social, finance, productivity.
Areas (goals): same 8 hues.
Projects: inherit the linked goal's area hue when linked; default productivity hue otherwise; user can set category per project.
Assignments: inherit the project hue when linked; default info (sky blue).
Chart series: use `--data-1..8` which are the same 8 hues (shared visual language).

Personalization stays under **Appearance** in Settings:
- Theme (Midnight / Aurora / Ember / Verdant / Daylight) — re-derives all tonal scales against the chosen canvas.
- Density (Comfortable / Compact) — spacing and row heights, not color.
- Accent energy (subtle / standard) — controls saturation of accent color globally; "subtle" mutes the accent by 20% for users who find it loud.
- No per-entity color picker in v1. Categories *are* the personalization.

---

## 14. MOTION STRATEGY

### Categories & rules

| Category | Duration | Easing | Where | Forbidden |
|---|---|---|---|---|
| **micro** | 100–150ms | `ease-out` | Button press, checkbox, chip toggle, tab switch, tap highlight | Layout, text content |
| **interaction** | 180–280ms | `ease-out` | Row press (scale 0.985), sheet open/close, dialog in/out, Omni open/close, habit completion fill | Large page moves, background scenes |
| **layout** | 280–360ms | `ease-in-out` | List reorder (drag), tab content cross-fade, entity add/remove (FLIP), density change | Initial page paint |
| **section** | 320–420ms | `ease-out` | Route change (opacity + 8px lift), screen mount stagger for headings (first 2 sections only), expand/collapse sections | Every card on screen animating in (choreograph at most 2 sections) |
| **chart** | 500–800ms | `ease-out` | First draw (line draw-in, bars grow from 0), data update (morph between values) | Hover jitter, continuous animation |
| **spatial** | 600–1200ms | `cubic-bezier(.2,.8,.2,1)` | Boot cinematic, Atlas transitions, goal-reached spatial moment (opt-in only) | Anything else; spatial motion only in spatial scenes |
| **celebration** | 400–900ms | `cubic-bezier(.34,1.42,.64,1)` spring | Streak milestone (number pulse), goal reached (confetti), first habit of day (small sparkle) | Every checkbox, every task complete |

### Intensity levels
- **Default:** micro + interaction + layout + section + chart (enter only) + spatial (opt-in only) + celebration (milestones only).
- **Reduced motion** (`prefers-reduced-motion: reduce`): only micro (opacity only) + interaction (opacity only) are allowed. No translation, scale, rotation, spring particles, confetti, or boot cinematic. Spatial scenes default to static poster. Route changes are instant opacity swap (80ms).
- **Low-tier device** (`capability.tier === 'low'`): chart draw-in and section staggers disabled; static poster for spatial; no Parallax/Tilt/PointerLight ever.

### Timing budgets
- Interaction response: paint within 100ms of input.
- Page visible: above-the-fold interactive within 300ms on mobile 4G throttled.
- Total animation time on route change ≤ 420ms end-to-end.

### Forbidden animations
- Background loops, continuously spinning loaders, breathing elements.
- Parallax tied to mouse position (PointerLight is removed globally).
- Full-screen fade-to-black between routes.
- Animating `top`/`left`/`width`/`height` — only transform + opacity + filter.
- Animating layout on every keystroke in the Omni input.

---

## 15. RESPONSIVE / MOBILE-FIRST STRATEGY

Design starts at **390×844** (iPhone 14/15) and **430×932** (iPhone 15 Pro Max),
then scales to **1440×900** desktop. Mobile is not a shrunken desktop.

### Mobile (390–430px width)
**Above the fold (first screenful, ~780px before scroll):**
- Screen header (title + one contextual action).
- For Today: completion headline ("3 things left" / "All done" / big %), next-action card, 3–5 priority items visible without scrolling.
- For Work: summary strip (4 numbers) + first tab content starting.
- For Habits: first 4 habits visible.
- For Insights: primary metric + one summary sentence + first chart visible.

**Navigation:**
- Bottom nav (Today · Work · Habits · Insights), 56px tall, centered icons + labels.
- Omni trigger: a pill in the bottom center (between 2nd and 3rd tab) — one universal command button instead of per-screen FAB. Long-press = quick capture; tap = Omni.
- Sidebar is hidden; a "•••" in the top-right opens a sheet with Goals, Settings, and all secondary destinations.
- No FAB stack. The "+" action lives inside Omni (which opens pre-selected to "create") and as a subtle "+" inline where entities are listed (e.g., at the end of the habit list).

**Gesture behavior:**
- Pull-to-refresh: reserved for sync (already SYNCED state, so this is a manual "sync now" with haptic + small spinner); not used for UI state.
- Swipe left on row: primary action (complete habit / check task). Swipe right: secondary action (snooze / skip / edit).
- Sheet drag-down to dismiss: all sheets are dismissible this way.
- Edge swipe: no custom behavior (preserve OS back gesture).

**Charts on mobile:**
- Touch-tooltip (tap pins value).
- Time-series charts use `touch-action: pan-y` so vertical scroll is never blocked.
- Heatmap renders 52 weeks with cells sized 14–16px (touchable); day labels abbreviated.
- Side-by-side comparisons become vertical on narrow screens.

**Card density:**
- Comfortable rows: 56px tall; Compact: 44px tall.
- No side-by-side cards on mobile; everything stacks.
- Sheets open at 92% height on mobile (not 100% — leaves a peeking strip of background to reinforce modality).

**Overlay behavior:**
- Max one modal sheet visible at a time (no stack of 3 sheets). Opening a child sheet closes the parent or replaces it.
- Dialogs are center-aligned only for destructive confirmation (delete); everything else is a bottom sheet.

### Tablet / small desktop (768–1024px)
- Two-column layout: left nav (collapsed, icons only) + content.
- Today: headline + priorities in 2-column grid.
- Work: summary strip 4-across; lists full-width.
- Insights: charts in 2-column grid where they fit.

### Desktop (1440px)
- **Sidebar visible always**, 256px wide, top section: 4 primary + Goals + Settings; bottom: profile/sync status.
- Content max width 1200px, centered with 32px gutters.
- Omni triggered via ⌘K / Ctrl+K or a search box in the sidebar; no pill in nav.
- Hover states enabled (subtle background lift on rows).
- Charts default to full size with hover tooltips; side-by-side comparisons allowed.
- Keyboard navigation across lists (↑↓ to select, Enter to open); visible focus ring.

### Breakpoints
- `--bp-sm: 480px` (large phone / small tablet)
- `--bp-md: 768px` (tablet)
- `--bp-lg: 1024px` (small desktop, sidebar appears)
- `--bp-xl: 1280px` (large desktop, content hits max width)

---

## 16. REUSABLE COMPONENT STRATEGY

Primitives are built fresh; legacy components are not reused just because
they exist. Target primitive set:

### Layout primitives
- **`Surface`** — semantic container with variants: `flat` (default, no card), `raised` (sheet/card), `inset` (input/group), `accent` (primary-attention hero strip). Replaces SectionCard.
- **`Stack`** (VStack / HStack) — flex stack with consistent gap tokens (`space-2`/`space-3`/etc.).
- **`Cluster`** — inline wrapping cluster (chips, tags, toolbar).
- **`Grid`** — simple 2/3/4 column grid with responsive collapse.
- **`Screen`** — page container with consistent max-width, padding, scroll.
- **`ScreenHeader`** — title + eyebrow + actions slot.

### Content primitives
- **`Text`** (via semantic CSS classes): `title`, `h1`..`h3`, `body`, `small`, `eyebrow`, `mono` (for IDs/timestamps). Replaces bespoke classes.
- **`Metric`** — value + label + optional delta (with trend glyph). Used for all stats.
- **`Progress`** — linear track + fill; variant `segmented` for today; variant `pace` for actual vs expected.
- **`Ring`** — small circular progress (≤48px) for inline % indicators only; never a hero.
- **`Sparkline`** — tiny inline line chart.
- **`Icon`** — wrapper for icons, with size/color tokens.

### Entity primitives (these *are* universal)
- **`EntityRow`** — a single list row for a habit / project / assignment / goal / milestone. Handles: leading visual (status dot / small ring / category stripe), title, metadata line, trailing action(s), press state, selected state. The single most reused primitive.
- **`EntityCard`** — compact card variant of EntityRow, used in galleries, sheets, pickers.
- **`EntityField`** — label + value + action slot, used in detail sheets for every attribute (deadline, progress, priority, links).
- **`HealthBadge`** — on-pace/behind/ahead/reached/past with consistent color. (Rebuilt from existing `components/goals/health.js` semantics.)

### Chart primitives
- **`Chart`** container (title, description, slot for SVG, footer with summary).
- **`Line`, `Bars`, `StackedBars`, `Scatter`, `Heatmap`, `HorizontalBars`**, **`PaceLine`** (actual + expected).
- **`AxisX`, `AxisY`, `Grid`, `Tooltip`**, **`Legend`**.
- **`Sparkline`** (already listed).
- All charts accept real data arrays; they don't know about habits/goals. Domain logic stays in `lib/*`.

### Overlay primitives
- **`Dialog`** — modal center-dialog (destructive confirmations, small forms).
- **`Sheet`** — bottom/side sheet with draggable handle, scrim, dismiss, focus trap. Replaces ItemActionsSheet, HabitDetailSheet, WorkForms ad-hoc sheets.
- **`Popover`** — small floating menu (filter picker, overflow menu).
- **`Toaster`** — keep existing; tweak styling.
- **`CommandSurface`** — Omni panel: full-screen on mobile, centered 640×520px on desktop with list of results; supports modes (command/search/capture/coach).

### Form primitives
- **`Field`** — label + input/select/textarea + description + error.
- **`Button`** — primary / secondary / ghost / icon / fab variants, all from one component (no more `.btn.ghost.sm.floating` class soup).
- **`Segmented`** — mutually exclusive tabs (mode switches, range selectors).
- **`Chip`** — filter, dismissible tag, status pill.
- **`DateField`** — date picker (text input + native picker fallback), preserves the smart deadline parsing in `quickCapture.js`.
- **`Slider`** — used for assignment progress 0-100, capacity min.
- **`Toggle`/`Checkbox`/`Radio`** — consistent focus + press.

### Motion primitives
- **`Reveal`** — mount animation (opacity + 8px lift) for sections.
- **`NumberTween`** — animated number (replaces AnimatedNumber, adds tabular-nums).
- **`Confetti`** — kept, used only for milestone/goal completion.
- No Parallax, TiltCard, PointerLight, or Burst as global mounts. They can remain in the codebase but are imported inside Atlas/Boot only.

### Navigation primitives
- **`AppChrome`** — shell wrapper containing Sidebar (desktop), BottomNav (mobile), OmniFab.
- **`Sidebar`** / **`BottomNav`** / **`MoreSheet`** — consolidated into one chrome component.

---

## 17. FINAL PRODUCT MAP (APP STRUCTURE)

```
<App>
  <Providers>                                     Store, Sync, Auth, Toaster
    <AmbientLayer />                               flat canvas, no webgl, no glow
    <AppChrome>
      <Sidebar />                                  desktop: primary 4 + Goals/Settings
      <BottomNav />                                mobile: primary 4
      <OmniFab />                                  universal cmd button
      <MoreSheet />                                mobile: secondary nav
    </AppChrome>

    <Routes>
      <TodayScreen />                              DEFAULT · EXECUTE
        <TodayHeader />                            greeting + headline metric + sparkline
        <NextAction />                             single best-next card
        <TodayPriorities />                        3–5 EntityRows, one tap to complete
        <TodayScheduled />                         habit rows for today
        <RoutinesStrip />                          if any routines active
        <ContextualBlocks />                       at-risk streak, near-milestone (when real)
        <PlanPanel />                              triggered by Omni "Plan my day"
        <FocusMode />                              triggered by Omni / card
        <MoodPrompt />                             evening only
        <WeeklyReview />                           Sunday only
      </TodayScreen>

      <WorkScreen>                                 PLAN + EXECUTE
        <WorkHeader />                             title + "+ new"
        <WorkSummary />                            4 metric chips (at-risk, due-soon, active, capacity)
        <WorkTabs>                                 Overview | Deadlines | Projects | Workload
          <WorkOverview />                         next action, active work, attention, horizon, load
          <WorkDeadlines />                        chronological groups
          <WorkProjects />                         list of projects (gallery mode optional)
          <WorkWorkload />                         7-day capacity + contributors
        </WorkTabs>
      </WorkScreen>

      <HabitsScreen>                               EXECUTE + UNDERSTAND
        <HabitsHeader />                           title + "+ habit" + mode switch
        <HabitsModes>                              Active | Week | Calendar | Routines
          <HabitsActive />                         entity rows, category filter
          <HabitsWeek />                           7-day grid
          <HabitsCalendar />                       month grid, MiniMonth reborn simpler
          <Routines />                             builder
        </HabitsModes>
      </HabitsScreen>

      <InsightsScreen>                             UNDERSTAND + REVIEW
        <InsightsHeader />                         title + range switch + mode switch
        <InsightsModes>                            Overview | Trends | Mind | Achievements
          <InsightsOverview />                     primary metric, heatmap, patterns, week compare
          <InsightsTrends />                       multi-series charts, habit performance
          <InsightsMind />                         mood, mood×habit, reflections (Record)
          <Achievements />                         badges, unlocked timeline
        </InsightsModes>
        <AnalyticsLab />                           LAZY, behind a "Lab" entry
      </InsightsScreen>

      <GoalsScreen> / <GoalDetailScreen>           PLAN + REVIEW
        <GoalsHeader />                            title + "+ goal" + "Atlas" entry
        <GoalsList />                              entity rows w/ health badge
        <GoalDetail>                               sheet or full route
          <GoalHeader />                           title, area, health
          <GoalPace />                             actual vs expected chart
          <GoalNextMilestone />
          <GoalContributors />
          <GoalLinkedActions />                    today's actions for this goal
          <GoalForecast />
          <GoalMilestones />
        </GoalDetail>
      </GoalsScreen>

      <SettingsScreen>                             MANAGE
        sections: Profile · Appearance · Reminders
                  · Capacity & Focus · Data · Account
      </SettingsScreen>
    </Routes>

    <Sheets>                                       context-based, max one visible
      <HabitSheet /> / <ProjectSheet /> / <AssignmentSheet /> / <GoalSheet />
      <ItemActions />                              universal row-actions menu
      <Forms />                                    all entity create/edit forms
    </Sheets>

    <OmniPanel />                                  command + search + capture (modes)
    <BootCinema />                                 FIRST RUN ONLY
    <Atlas />                                      OPT-IN spatial scene (lazy)
    <UnlockToasts / Confetti />                    celebration only
    <MigrationDialog / AuthGate />                 kept as-is behaviorally
  </Providers>
</App>
```

Hierarchy recap:

```
APP SHELL
└─ PRIMARY DOMAINS  (Today · Work · Habits · Insights)
   └─ MODES         (tabs inside a domain: e.g., Work.Deadlines)
      └─ DETAILS    (entity sheets / sub-routes)
         └─ DEEP ANALYTICS  (Analytics Lab · Burn-up · Correlation)
            └─ SPATIAL EXPLORATION  (Atlas · Boot cinematic)
```

---

## 18. REBUILD ORDER (safest sequence)

The principle: build foundation → shell → one representative domain →
patterns → rest → polish.

### Phase 1 — Foundation (no visible change yet)
1. **Token restructure.** Rewrite `src/styles/tokens.css` into primitive/semantic/component tiers; keep palette values stable enough that the *existing* UI still works during the transition. Add semantic tokens (`--surface-1`, `--text-2`, etc.) alongside the old ones.
2. **Reset stylesheet graph.** Replace base/system/components CSS with minimal primitives (button, field, sheet, surface, text classes). Keep old style files loading temporarily so we can migrate screen-by-screen without breaking mid-work.
3. **Build primitives:** `Surface`, `Stack`, `Text`, `Button`, `Field`, `Chip`, `Segmented`, `Progress` (linear), `Ring` (small), `Metric`, `Icon`, `Sheet` (using existing logic), `Dialog`, `Popover`, `Toaster` (restyle).
4. **Build chart primitives** (Chart container, Line, Bars, Axis, Sparkline, Heatmap). No screen uses them yet; demo in Storyboard/preview route.
5. **Build EntityRow/EntityCard** — the universal row. Verify with fixtures that it can render a habit, a project, an assignment, a goal, a milestone, a task.
6. **Build motion primitives** (Reveal, NumberTween) and remove PointerLight/Parallax/Tilt/Burst from `App.jsx`.

### Phase 2 — App Shell
7. **Build AppChrome**: new Sidebar, BottomNav, MoreSheet, OmniFab. No FAB-stack branching per route.
8. **Build Omni** (command surface): commands list, search, capture, natural-language filter results — all backed by existing `commandActions.js`, `queryParser.js`, `quickCapture.js`. Replace CommandCenter/SearchPalette/QuickCapture with Omni.
9. **Update router canonical mappings** so legacy routes redirect. Keep the hash router (no dependency upgrade).
10. **Strip global ambient layers**: remove WorldLayer/PointerLight/BootSequence from default mount. WorldLayer stays lazy-injectable for Atlas/Boot.
11. **New Today header** on existing TodayScreen as first visual change; rest of the screen still uses old sections to keep the app usable.

### Phase 3 — Representative domain: TODAY (the flagship screen)
12. Rebuild `TodayScreen` composition using new primitives: header, headline metric, NextAction, TodayPriorities, TodayScheduled habits (EntityRows), RoutinesStrip, contextual blocks (only when real).
13. Replace `TodayHero`, `AdaptiveHome`, `AdaptiveCommandCenter`, old habit rows, old progress rings, old Week bars.
14. Hook in PlanPanel and FocusMode as triggered overlays (from Omni).
15. Keep using existing `lib/today.js`, `lib/adaptive.js`, `lib/planning.js`, `lib/stats.js` unchanged.
16. Celebratory burst/confetti wired only to milestones.

### Phase 4 — Reusable patterns proved
17. **Entity sheet pattern**: build one entity detail sheet (habit) using Surface/Stack/EntityField; verify reusability.
18. Confirm EntityRow, Sheet, Surface, Progress work for habits — they become the pattern for work/goals.

### Phase 5 — WORK domain
19. Rebuild `WorkScreen` (overview, deadlines, projects, workload) using new primitives. Replace WorkKit, WorkCards, WorkCapacitySeries, DeadlineLanes, PaceRibbon.
20. Build Project detail sheet and Assignment detail sheet.
21. Replace UniversalWorkRow with EntityRow variants.
22. Re-implement Project Gallery as an *opt-in* spatial view (lazy).

### Phase 6 — HABITS domain
23. Rebuild `HabitsScreen` (active list, week, calendar, routines) using new primitives.
24. Replace HabitList, HabitCard, HabitRow, HabitRing, RoutineStrip, Routines, CalendarScreen, WeekScreen.
25. Build Habit detail sheet.
26. MiniMonth rebuilt as a proper calendar primitive.

### Phase 7 — INSIGHTS domain
27. Rebuild `InsightsScreen` with new charts. Replace chartKit, workCharts, DayClock, MoodScatter, PulseRibbon.
28. Fold `MindScreen`, `RecordScreen`, `AchievementsScreen` into Insights modes.
29. Re-implement AnalyticsLab behind the new chart primitives (lazy-loaded).
30. Rewire all analytics to existing `lib/analytics.js`, `lib/advancedAnalytics.js`, `lib/habitPatterns.js`, `lib/goalAnalytics.js`.

### Phase 8 — GOALS domain
31. Rebuild `GoalsScreen` with EntityRow + HealthBadge. Default = list view.
32. Build Goal detail view (actual/expected pace line, contributors, next milestone, linked actions, forecast).
33. Move GoalAtlas to an opt-in "Atlas" button that lazy-loads the three.js scene; tier-gated.

### Phase 9 — Settings, Auth, Onboarding
34. Rebuild `SettingsScreen` with flat sections using Field primitives.
35. Rebuild `AuthScreen`, `ResetPasswordScreen`, `MigrationDialog` surface.
36. Rebuild `Onboarding` (cinematic but minimal, reduced-motion aware).
37. Reintroduce `BootSequence` as first-run-only (lazy).

### Phase 10 — Spatial, motion, polish
38. Wire Boot cinematic (only when no state exists, skippable, reduced-motion = static).
39. Wire Atlas as opt-in scene.
40. Fine-tune motion timings, reduced-motion fallbacks, low-tier fallbacks.
41. Re-balance themes (Aurora/Ember/Verdant/Daylight) against the new surface system.
42. Density mode (Comfortable/Compact).
43. Typography polish (tabular nums, metric optical sizing).
44. Focus ring audit; keyboard navigation; ARIA labels.

### Phase 11 — Tests & QA
45. Domain tests: kept running throughout, must stay green.
46. Rewrite UI tests against new UX contracts (new routes, new primitives, a11y behavior).
47. Write new tests for Omni, sheets, charts (accessible summary tables), responsive behavior.
48. Run QA scripts (existing qa/*.mjs) updated for new selectors.
49. Performance: LCP < 2.5s on 3G mobile, no long tasks > 50ms on interaction.
50. Visual QA at 390/430/1440; both themes; reduced-motion; low-tier mode.

### Phase 12 — Release
51. Build proof, schema check, deploy preview, verification via existing workflows.
52. Legacy route redirects verified.
53. Data migrations: zero (schema v4 is preserved; no store changes).

---

## 19. DEFINITION OF DONE FOR STEP 0

This blueprint satisfies Step 0. It contains:

1. ✅ Complete repository map (§1, with disposition for every file/folder).
2. ✅ Complete SQL/data capability map (§2, including capabilities currently unused by the UI).
3. ✅ Product capability map (§3, grouped by Execute/Manage/Plan/Understand/Review/Explore).
4. ✅ Pain-point map (§4, concrete and ruthless).
5. ✅ New information architecture (§5, primary/secondary/contextual/Omni-only).
6. ✅ Screen responsibilities (§6, every major surface).
7. ✅ Final art direction (§7, chosen direction, rationale, what to avoid).
8. ✅ Design-system specification (§9, typography/color/spacing/radius/surfaces/borders/depth/shadows/icons/charts/motion/focus/touch/responsive + three-tier token architecture).
9. ✅ Spatial/3D rules (§10, FLAT/DEPTH/SPATIAL classification).
10. ✅ Visualization strategy (§12, which chart answers which question).
11. ✅ Color strategy (§13, derived base/soft/muted/strong/contrast per entity).
12. ✅ Motion strategy (§14, seven motion categories with timing/easing/allowed/forbidden + reduced-motion behavior).
13. ✅ Responsive strategy (§15, mobile-first 390/430, desktop 1440, above-fold specs, nav/gesture/chart/overlay behavior).
14. ✅ Component strategy (§16, future primitives identified, what is genuinely universal).
15. ✅ Implementation order (§18, foundation → shell → today → patterns → work → habits → insights → goals → settings/onboarding → spatial/polish → tests/QA → release).

### Step 0 enforcement
- No production code has been changed in service of the redesign yet.
- No deploy, no migration, no new intelligence engine has been added.
- All domain/data/engine files are marked KEEP and will be imported as-is.
- Old UI tests will be rewritten *after* the new UX contract exists; they do not gate Phase 1+.

**Stop here. Implementation begins in Step 1 (tokens + primitives).**
