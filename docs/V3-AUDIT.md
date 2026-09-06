# V3 — pre-flight audit of the V2 foundation

Performed before any V3 change, on commit `9359c53` (branch
`arena/01a0778e-habbit-trackerrr`). Purpose: never guess what exists; every V3
layer is added on top of a system that was read first.

## 1 · Architecture as found

| Layer | Implementation | Notes |
|---|---|---|
| App shell | `src/App.jsx` | Hash router (`src/lib/router.jsx`, zero deps). Screens code-split with `lazy()`; **Today is eager** by design. |
| State | `src/store.jsx` | Single reducer + Context, `localStorage` key `aaru.habits.v4`, honest v2/v3 migrations, schema `version: 4`. |
| Collections | habits, checkins, routines, projects, assignments, **goals**, moods | Document-style state. Goals already own milestones + links to habits/projects/assignments (`src/lib/goals.js`). |
| Cloud | `src/lib/cloud/*` | Supabase auth (`AuthProvider`), document sync (`SyncProvider`/`syncEngine`), deterministic `mergeDocs`, per-account remembered migration choice. `user_state.doc` is one owned jsonb row; RLS enforced in `supabase/schema.sql` (tested against real Postgres by `npm run test:schema`). |
| Work engine | `src/lib/work.js` | Progress, status, pace, burndown, velocity, workload, deadline timeline — all derived from real logs. |
| Analytics | `src/lib/analytics.js`, `src/lib/stats.js`, `src/lib/today.js`, `src/lib/achievements.js` | Weekday/weekend split, consistency score, streak history, distribution, time-of-day, correlations (gated on data volume), monthly pulse, personal bests, smart insights, achievement rules. |
| Charts | `src/components/charts/chartKit.jsx`, `workCharts.jsx` | Hand-rolled SVG. No chart library. |
| Design system | `src/styles/tokens.css` (single authority) + base/components/work/system/auth | Five themes: midnight (default), aurora, ember, verdant, daylight. Category colours shared. |
| Motion (V2) | framer-motion per component | `SectionCard` whileInView entrances, spring checkbox, animated ring/counters, canvas confetti reserved for real milestones. |
| Artwork | `public/art/*.webp` | Deep-ink, violet/cyan, translucent-glass universe; optimized by `scripts/optimize-art.mjs` from `public/art/gen/`. |
| QA | `test/*` (vitest, 216 tests), `qa/e2e.mjs` (308 browser checks), `qa/audit.mjs` (layout/overflow/tap across 18 routes × viewports), `qa/contrast.mjs` (5 themes), `qa/schema-check.mjs` (real Postgres RLS), `qa/release.mjs` + `qa/build-proof.mjs` (release.json inventory). | CI runs all of it on every PR and on main. |

Baseline measurements (this sandbox, commit `9359c53`):

- unit/render tests: **216 passed**
- real-browser E2E + visual QA: **308 passed, 0 failed**
- production build: initial JS chunk `716.6 kB` / **214.4 kB gzip**, CSS `125.8 kB` / **24.7 kB gzip**
- build time ≈ 3.6 s; preview served on 4173.

## 2 · What V3 must not touch (contract)

- Auth, RLS, `user_state` document model, migration prompts, offline behaviour.
- Storage schema version (v4) unless a migration is written and tested.
- The "no fake data" rule: every chart, badge and percentage derives from
  habits/checkins/goals/projects/assignments/moods, or shows an honest empty
  state.
- The 5-theme token contract; new visual properties become tokens, not
  hard-coded values.
- Existing tests stay green; new work adds tests rather than weakening them.

## 3 · Gaps V3 fills

1. **No motion layer file.** `index.css` documents a `motion` layer that does
   not exist; entrances are ad-hoc per component. → Phase 1 adds
   `src/styles/motion.css` as that missing single owner of scroll/reveal/chart
   animation.
2. **No device capability model.** Nothing detects WebGL support or weak
   devices. → `src/lib/capability.js`.
3. **No reusable depth/3D primitives.** Cards are flat-elevated; no tilt,
   parallax, scroll-linked transforms. → `src/components/motion/*`.
4. **No WebGL layer at all.** The signature "Progress Core" does not exist.
   → lazy `three` scene + CSS/SVG fallback that is good enough to stand alone.
5. **Charts appear instantly.** No draw-on-enter, no progressive heatmap
   reveal, no number count on entry. → chart-motion primitives in
   `src/components/charts/*`.
6. **Goals lack analytics depth.** Progress/pace/health exist; completion
   velocity, consistency, projected completion and expected-vs-actual series
   do not. → `src/lib/goalAnalytics.js` + goal detail screen.
7. **Onboarding is a single form-ish flow** (`src/components/Onboarding.jsx`),
   not the 4-scene cinematic sequence the product deserves.
8. **Art library lacks V3 scene art** for today/goal/project/assignment/
   achievement/insights/workload/calendar/success moments.

## 4 · Dependency evaluation (spec §1)

| Candidate | Verdict | Reason |
|---|---|---|
| `three` | **adopted, lazy-only** | Only WebGL layer needed. Imported exclusively inside `src/components/three/*`, reached via dynamic import, so it never enters the initial chunk. Gated by capability + reduced-motion. |
| `@react-three/fiber` + `drei` | rejected | Adds a React reconciler + large helper surface for ~4 scenes; raw `three` with a thin wrapper keeps the lazy chunk smaller and the render lifecycle explicit (pause offscreen, dispose on unmount). |
| GSAP / scroll libraries | rejected | framer-motion + IntersectionObserver + rAF already cover scroll choreography with GPU-only transforms; a second animation runtime would fight the existing one. |
| Chart library | rejected | Hand-rolled SVG is the house style and keeps charts testable; motion is added inside the existing components. |
| Video assets | not available | No video generation capability in this environment; ambient motion is done with WebGL/CSS instead. The report states this plainly rather than shipping fake "video" claims. |

## 5 · Risk register for the V3 work

- **Performance**: three chunk is lazy + capability-gated; hero shows the CSS/SVG
  Progress Core immediately and WebGL layers in only when capable. Budget:
  initial JS gzip must stay within +12 kB of baseline; three chunk ≤ 160 kB gzip,
  fetched only after first paint on capable devices.
- **Readability**: 3D never replaces a chart that must be read; where 3D would
  reduce comprehension the 2D chart wins (spec §14).
- **Reduced motion**: every new primitive has a static path; QA exercises
  `prefers-reduced-motion`.
- **Cloud/schema**: no schema change is required for any V3 feature; goals,
  milestones and links already exist in the document. New derived values are
  computed, never stored, so sync/merge semantics are untouched.
