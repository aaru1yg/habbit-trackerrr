# Habit OS — V4 release notes (spatial / cinematic layer)

V4 did not rewrite the product. Store, schema v4, Supabase auth/RLS/sync,
migration prompts and every data engine are byte-identical to V3 — the
entire release lives above the data layer, in presentation.

## What changed, phase by phase

| Ph | Scope | Landed as |
|----|-------|-----------|
| 1 | 3D architecture + design system | `lib/spatial.js` camera rig (damped rAF, CSS-var only), `components/spatial/Depth.jsx` primitives (`SpatialStage · DepthLayer · SpatialPanel · DepthCard · SpatialStack`), `styles/spatial.css` as the single depth owner, lazy WebGL `WorldScene` + gated `WorldLayer`, `BootSequence` entry cinematic, 420 ms `route-cam` |
| 2 | Today cinematic | hero + sections on named z lanes inside the stage; ProgressCoreScene energy (orbit speed, shell scale, glow pulse) scales with real progress; completion flashes the hero surface (`core-hit`, 380 ms) |
| 3 | Projects spatial gallery | `ProjectGallery` floating planes (tilt + depth + deterministic category environment art), Gallery/List toggle, full card-action parity |
| 4 | Goals spatial system | `GoalAtlas` constellations: goal anchor + real milestones/habits/projects/assignments as depth-linked nodes; relaxes to a vertical stack <700 px |
| 5 | Assignments deadline language | `PaceRibbon` + TIME-PRESSURE band: `N DAYS LEFT` display type, expected-vs-actual track with pace tick, BEHIND/AHEAD verdicts — all derived from `assignmentStatus` |
| 6 | Insights data room | charts staged on depth planes inside a camera stage; range switches animate the chart back in through depth |
| 7 | Achievements collectibles | medal lifts off the surface on focus/hover, light sweep, honest rarity words (bronze→COMMON … diamond→LEGENDARY) taken from the existing rule tiers — earned glow only when earned |
| 8 | Navigation camera transitions | route-cam on every route/param change; sidebar items lift toward the camera; active page carries a violet dock light |
| 9 | Mobile simplification | `--sp-k` depth multiplier shrinks (0.45 → 0.28), pointer tilt/WebGL world/stage scenes off on touch, boot planes reduced, atlas reflows to stack; functionality identical |
| 10 | Perf / a11y / QA | `assertPerformanceBudget` in `qa/build-proof.mjs` (CI-enforced), 15+5 V4 unit contracts, 19 new E2E checks, `qa/v4-shots.mjs` visual pass |

## Measured (this branch, `npm run build` + gate output)

| Budget | Target | Measured |
|---|---|---|
| Initial JS (gzip, all HTML-referenced chunks) | ≤ 236 kB | **216.9 kB** |
| Initial CSS (gzip) | ≤ 42 kB | **34.0 kB** |
| three.js | lazy-only, never in entry | `three.module` 129.5 kB gz in lazy chunks; entry delta **+2.4 kB** (222.0 vs 219.3 kB pre-V4… net 216.9 after tree-shake pass, gate counts HTML refs) |
| V4 scene art (4 webp) | ≤ 60 kB | **34 kB**, lazy except the auth moment |
| Build time | ≤ 10 s | ~5.7 s |

## Fallback + accessibility contract (kept, extended)

- No WebGL, low-power, reduced motion, mobile: every composition renders
  statically — `data-spatial` (full/reduced/flat) is the one switch CSS
  obeys, and the boot/world/parallax all pin at rest.
- Reduced motion: camera choreography, particles, parallax, scene art float
  and route transitions are off; depth hierarchy remains as a static
  composition (spec §24).
- All meaningful content remains semantic HTML; scenes carry `aria-hidden`,
  charts keep `role="img"` labels; the pace ribbon states its numbers in
  its aria-label; every gallery/atlas/plane action is keyboard-reachable
  (e2e verifies focus on gallery links and 44px targets incl. atlas nodes).
- Boot sequence never blocks: once per session, skippable (click / Esc /
  Enter / Space — it also swallows `/` while visible so the palette can't
  open behind it), automation-safe, and unmounts fully.

## E2E / QA matrix (this release)

- Unit: **314 tests / 21 files** green (15 spatial + 5 gallery + 4 budget
  contracts added).
- Browser E2E: **378 / 378** green incl. new V4 boot/world/gallery/atlas/
  pressure/rarity/reduced-motion checks.
- `qa/audit.mjs` 18 routes × 10 viewports: **0 findings** (tap-target
  overflow regressions found during the pass were fixed, not waived).
- Real-Postgres RLS: 28/28 (`npm run test:schema`).
- CI additionally runs `Verify Supabase (live)` and the post-merge
  `Verify live site` real-browser journeys against the deployed Pages build.
