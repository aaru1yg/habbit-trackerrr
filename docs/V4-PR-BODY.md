# Habit OS V4 — spatial / cinematic product layer

## What this is

The V3 audit (docs/V4-AUDIT.md) found one WebGL object (the Today progress
core), CSS parallax vocabulary, and hard-swap navigation — "a dashboard with
a signature object", not a spatial product. This PR builds the product into a
**3D-first experience** without touching the data layer:

- **Entry** — a boot cinematic (dark screen → planes rise → mark → "SMALL
  THINGS. DONE DAILY." → dissolve), once per session, skippable, silent for
  reduced-motion users and automation. The auth brand panel becomes editorial
  (uppercase display type, floating product planes, `scene-hero` art).
- **Architecture** — hybrid: semantic HTML → `src/styles/spatial.css`
  (single depth owner) + `src/lib/spatial.js` (damped one-rAF camera writing
  `--cam-x/y/scroll`) + reusable primitives (`SpatialStage`, `DepthLayer`,
  `SpatialPanel`, `DepthCard`, `SpatialStack`, `scenePresence`) → lazy WebGL
  (`WorldScene` ambient environment; evolved `ProgressCoreScene`).
- **Today** — hero + sections on named z lanes inside a camera stage; the
  core's orbit speed / shell scale / glow pulse now scale with real progress;
  completion flashes the hero surface (380 ms).
- **Projects** — spatial gallery of tilting depth planes with a deterministic
  category environment (real metadata, no stock art), Gallery/List toggle,
  full action parity with the list card.
- **Goals** — `GoalAtlas`: constellations of the goal's real links
  (milestones / habits / projects / assignments) with an SVG web + depth
  nodes; relaxes to a vertical stack < 700 px.
- **Assignments** — a TIME PRESSURE band: countdown display type +
  expected-vs-actual pace ribbon with tick and BEHIND/AHEAD verdict, derived
  entirely from `assignmentStatus`.
- **Insights** — charts staged as translucent data planes in a camera stage;
  range switches animate the chart back in through depth.
- **Achievements** — medals lift off their surface on focus/hover with a
  light sweep; honest rarity words mapped from the existing rule tiers
  (bronze→COMMON, silver→RARE, gold→EPIC, diamond→LEGENDARY), glow only when
  earned.
- **Navigation** — every route/param change rides a 420 ms rise-from-depth
  camera move; sidebar items lift toward the camera; active page gets the
  dock light.
- **Mobile / fallbacks** — `--sp-k` collapses depth on touch; WebGL world +
  scene art + parallax off where unearned; reduced motion pins the world at
  rest while keeping the composition; no-WebGL devices get the CSS twin.

## What this does NOT touch (and the proof)

Supabase auth, RLS (real-Postgres suite 28/28 green), `user_state.doc`
schema v4, sync/merge, migration prompt, offline/PWA — zero schema/data-model
changes; all new visuals are derived presentation. No fabricated data: empty
states stay honest, atlas edges exist only for real links, rarity maps existing
tiers.

## Measurement (CI-enforced by `qa/build-proof.mjs` this release)

| Budget | Target | Measured |
|---|---|---|
| Initial JS (gzip, HTML-referenced chunks) | ≤ 236 kB | **216.9 kB** |
| Initial CSS (gzip) | ≤ 42 kB | **34.0 kB** |
| three.js | lazy-only, never referenced by index.html | 129.5 kB gz lazy chunk (shared by both scenes); +0.0 in entry |
| V4 scene art (4 webp) | ≤ 60 kB | **34 kB**, lazy except auth moment |

## QA matrix

- Unit: **314 tests / 21 files** (25 new V4 contracts: spatial primitives,
  camera budget, boot, gallery, perf-budget gate).
- Browser E2E: **378/378** incl. 19 new V4 checks (boot determinism, world
  layers, route cam, gallery focus/parity, atlas, pressure band, rarity,
  reduced-motion pinning).
- `qa/audit.mjs` 18 routes × 10 viewports (320→1920): **0 findings**
  (tap-target + overflow regressions found during review were fixed).
- `npm run lint`: 0 errors. `npm run build`: ~5.7 s, build-proof clean.

## Commits

1. `Phase 1` spatial architecture: camera rig, depth primitives, world scene,
   boot cinematic, route camera
2. `Phase 2-3` Today core energy mapping + Projects spatial gallery
3. `Phase 4-7` goals atlas, assignment pressure, insights data-room,
   collectible achievements
4. `Phase 8-10` entry polish, tap-target/contrast repairs, perf budgets in CI,
   release docs (README, docs/V4-AUDIT.md, docs/V4-RELEASE.md,
   docs/V4-ART-DIRECTION.md)

## Post-merge

The deploy workflow publishes to GitHub Pages; `verify-live-site.yml` then
re-runs the real-browser auth/migration journeys against the exact deployed
commit — the existing production proof contract.
