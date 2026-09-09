# V5 — Final UI Architecture: audit + locked decisions

> The "Final V3 UI Rebuild" brief lands as **V5**: V3 (screen evolution) and
> V4 (spatial) already shipped and are documented in-repo. This audit was
> performed on `88fb857` before any V5 change. Baseline: **881 tests green
> (46 files)**, build green, entry JS 235.65 kB gzip (budget ≤236 — AT the
> edge), CSS 38.3 kB gzip (budget ≤42), three.js lazy-only.

## 1 · What exists (measured, not assumed)

| Layer | State | Verdict |
|---|---|---|
| Store | v4 doc: habits/checkins/routines/projects/assignments/goals/moods/preferences/signals/focusLog; migrations v2→v4; localStorage persisted | FROZEN. Accent = plain field, no reducer change needed |
| Engines (`src/lib`) | stats, analytics, advancedAnalytics, adaptive, planning, habitPatterns, goalAnalytics, goals, work, today, execution, learning, localCoach, personalization, queryParser, quickCapture, reminders, schedule | FROZEN. UI consumes selectors only |
| Router | hash router, 5 canonical pillars (today/work/habits/goals/insights), legacy routes preserved | FROZEN. No route changes |
| Screens (21) | Today eager + lazy pillars; Habits/Work are workspace shells with embedded views | RESTRUCTURE composition, keep engines |
| Dead screens (4) | `AssignmentsScreen` `ProjectsScreen` `TimelineScreen` `WorkloadScreen` — zero imports in src/test/qa | DELETE (~1,080 lines) |
| Dead components (2) | `SearchPalette` (unused alias), `AiCoach` (unwired coach UI) | DELETE SearchPalette; WIRE AiCoach as Omni Coach tab |
| Omni | CommandCenter: command/search/create + regex-inline coach, keyboard-first | ADD Coach tab, unify visually |
| Charts | `LineSeries` already 1..n series + shared tooltip; TrendChart/WeekBars/Heatmap/HabitMatrix; Burndown/Load/HBar/Spark/Donut/Pace/DayClock/MoodScatter/PulseRibbon | EVOLVE into chart system (legend/toggle/focus/palette), don't rewrite |
| 3D/spatial | WorldScene (gated, lazy, disposable), BootSequence, Depth primitives, GoalAtlas (pure CSS/SVG) | KEEP. Selective use only (L1/L2/L3 rule) |
| Tokens | 5 themes, fluid type, 8px space, radius, motion, elevation, `--c1..c8` palette | EXTEND additively (component layer, accents, series, glow, z) |
| CSS (10.4k lines) | system.css 3.8k lines/644 selectors (incl. duplicated ACHIEVEMENTS sections); layer order tokens→…→adaptive | FREEZE system.css; new `primitives.css` + `charts.css`; prune dead at end |
| Tests | 881 unit/render; e2e 1566 lines + habits/goals/workspace journeys; contrast/overflow/tap-target audit; schema-check on real PG | KEEP all; update contracts; add design-system + chart tests |
| SQL | `user_state.doc` jsonb single-doc + profiles; RLS enabled+FORCED; no per-entity tables | NO SQL/UI coupling beyond doc selectors. No schema change |

DATA→SELECTOR→UI holds everywhere: no SQL-backed per-entity queries exist,
so every screen reads `state` through lib selectors. Accent customization is
a pure client field (`habit.accent` etc.) synced inside the existing doc.

## 2 · UI/UX Pro Max synthesis (verified, not pasted)

| Skill output | Decision |
|---|---|
| Dark Mode (OLED) discipline: deep surfaces, minimal glow, visible focus | ACCEPT — restrain glow, deepen blacks, focus rigor |
| Claymorphism/playful + amber light palette (query 1) | REJECT — contradicts shipped dark-first identity + brief |
| Font swaps (Fira/JetBrains/Poppins) | REJECT — offline PWA ships self-hosted Inter/Manrope; add system-mono data token instead |
| Line for trends, SVG <1000pts, ≤6 series, never hue-alone | ACCEPT into chart rules |
| Bullet charts for KPI grids; <4 points → stat card | ACCEPT for Insights HOME |
| No color-only meaning; sequential headings | ACCEPT as architecture rules |
| memo components, narrow deps, derived booleans | ACCEPT as perf rules |
| Pre-delivery checklist | ACCEPT wholesale |

## 3 · LOCKED design system (Habit OS Final)

**Personality:** cinematic · premium · intelligent · calm · spatial ·
data-rich · usable. "Modern productivity OS", not SaaS dashboard, not game.

- **Pattern:** command-core OS — persistent shell (sidebar/bottom-nav) +
  pillar workspaces + universal Omni (search/create/command/coach) + sheet
  dialogs. One primary action per screen, max 1–2 dominant animated elements.
- **Style:** deep-ink dark-first (midnight flagship), OLED discipline:
  glow only on primary progress/CTA moments, never ambient everywhere.
  5 existing themes kept, refactored to token refs (no per-screen patching).
- **Typography:** Inter (UI) / Manrope (display/numbers, tabular-nums) /
  system mono (data labels). Fluid display scale kept; sequential h1→h3.
- **Color:** existing theme contract kept; ADDED tokenized accent system:
  `accent → soft/muted/strong/ink` via `color-mix`, contrast-guarded
  (accent text must pass 4.5:1 — auto-derive readable `ink`).
- **Surfaces:** base / raised / elevated / overlay / inset + tone surfaces
  (good/warn/bad/info). Elevation = shadow + hairline, glow is a separate
  opt-in token.
- **Spacing:** 8px `--space-*` canonical; `--sp-*` frozen legacy.
- **Radius:** 8/12/16/22/28/32/pill. **Borders:** 1px hairline, 1.5px focus.
- **Icons:** existing SVG set (Phosphor-style, stroke-consistent). NO emoji
  as structural icons. Icon sizes tokenized (16/18/21/24).
- **Motion:** DUR/SPRING tokens kept; tiers micro < enter < section <
  cinematic < celebration; transform/opacity only; reduced-motion = same
  information, zero movement. Scroll: max 1–2 responding elements.
- **Spatial (L1/L2/L3):** L1 flat for dense data; L2 depth for selected/
  progress surfaces; L3 cinematic ONLY for Today hero core, Goal Atlas,
  boot, route camera. No tilt on dense lists. No WebGL in entry chunk.
- **Responsive:** 390×844, 430×932, 768 tablet, 1440×900, 1920+ first-class;
  1-col mobile → 2–3 col desktop; charts full-width desktop, stacked mobile;
  zero page-level horizontal overflow (CI-audited).
- **A11y:** WCAG-conscious: keyboard (⌘K, /, arrows, Enter, Esc), visible
  focus, dialog traps, chart text summaries, 44px targets, no color-only
  meaning, reduced-motion parity.

## 4 · LOCKED component architecture

```
src/components/ui/          ← EXTEND (Button, IconButton, SegControl, Tabs,
  primitives/                 Badge, StatusPill, Metric, Field/*, SearchField,
                              ColorField, Skeleton, Tooltip, Popover, Legend)
src/components/entity/      ← NEW (HabitCard/Row/Ring, GoalCard/Health,
                              WorkItem, ProjectCard, AssignmentCard,
                              MilestoneRow — shared primitives, own semantics)
src/components/charts/      ← EVOLVE (ChartCard, MultiSeriesChart from
                              LineSeries, GroupedBars, BulletRow, Heatmap+,
                              shared useChartSeries: toggle/focus/palette)
src/lib/accent.js           ← NEW (base→tints/shades/ink, contrast guard)
src/lib/chartPalette.js     ← NEW (deterministic series color+dash+shape)
src/styles/tokens.css       ← EXTEND (additive: component/accent/series/
                              glow/z/skeleton tokens)
src/styles/primitives.css   ← NEW (all V5 component styles)
src/styles/charts.css       ← NEW (chart system styles)
src/styles/system.css       ← FROZEN (prune dead selectors at end only)
```

Universal detail pattern: IDENTITY → STATE → PRIMARY ACTION → KEY DATA →
HISTORY/ANALYTICS → RELATIONSHIPS → MANAGEMENT. One form system: every
entity form uses Field/* + shared footer (save/cancel/destructive).

Chart rules (locked): one question per chart · ≤6 series · hue + dash +
label (never hue alone) · legend toggles focus (never deletes) · hover/tap
tooltip · text summary for AT · <4 points = stat card · empty/insufficient
states honest ("Not enough data yet").

## 5 · LOCKED screen compositions

- **TODAY** ("What now?"): HEADER → NOW (one Next Best Action) →
  TODAY'S WORK (habits + deliverables + milestones) → CONTEXT (workload,
  deadlines, risk, recovery) → TOOLS (Plan/Focus/Review). Kills the card wall.
- **WORK**: keep Phase-4 Overview/Deliverables/Projects/Workload/Deadlines;
  visual unification only.
- **HABITS**: Active (calm, completion-first, ring cards sm/md) / Routines /
  Calendar / Week. Ring secondary to name+action.
- **GOALS**: list-first (WHAT→PROGRESS→HEALTH→NEXT MILESTONE); Atlas
  subordinate, impressive.
- **INSIGHTS**: HOME (highlights, patterns, trends, changes) → DEEP DIVE
  (habit/workload/goal analytics, history) → LAB (advanced, existing) →
  secondary Mind/Achievements/Record.
- **Details**: universal pattern for Habit/Goal/Project/Assignment.
- **Omni**: SEARCH / CREATE / COMMAND / COACH tabs, one input, same system.

## 6 · Locked QA + budgets

Keep: vitest (881), e2e + journeys, contrast/overflow/tap audit, release,
schema-check, verify-supabase, lint, build-proof. Add: token/theme/contrast
tests, primitive state tests, chart interaction tests (toggle/focus/empty),
responsive checks at 390/430/1440. Budgets: entry ≤236kB gzip (currently
235.65 — new entry code must be offset by deletions/laziness), CSS ≤42kB,
three lazy-only, zero console errors, zero overflow.

## 7 · Do-not-break list (frozen)

Auth · Supabase/RLS · sync/merge/migration · offline/PWA · storage v4 ·
all reducers (accent needs none) · all engines · Omni behaviors · Local
Coach (local, $0) · legacy routes · onboarding · reminders.
```

---

**Audit complete. Architecture locked.** Now executing the internal
implementation order without stopping. Foundation first: tokens → accent
system → primitives.
