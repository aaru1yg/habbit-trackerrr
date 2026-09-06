# V4 — pre-flight audit and spatial architecture plan

Performed before any V4 change, on commit `19ffb26` (V3 merged to `main`,
deployed to Pages — `Deploy to GitHub Pages` and `Verify live site` runs
green against exactly this SHA; `release.json` and `<meta name="build-id">`
are the on-site proofs).

> Reference input note: the brief references `habit_os_3d_reference_board.jpg`
> as a visual-quality reference. The file is **not present in the workspace**
> (only the written description arrived). The plan below therefore follows the
> written reference language — dark immersive canvas, floating panels at real
> Z, camera-like movement, editorial type — without copying any specific
> layout, branding or asset. This is noted honestly rather than guessed at.

## 1 · What V3 actually is (as found, measured here)

| Layer | State at `19ffb26` | V4 verdict |
|---|---|---|
| Tests | `npm test` → **290 passed / 19 files** | keep as regression floor; add spatial contracts |
| E2E | `qa/e2e.mjs` 359 headless checks incl. 320–414px sweep, reduced-motion, offline | extend, never weaken |
| Entry JS | `index.js` 732.6 kB raw / **219.3 kB gzip** | budget: ≤ 236 kB gzip (+16 kB for the spatial layer) |
| CSS | `index.css` 154.5 kB raw / **29.9 kB gzip** | budget: ≤ 42 kB gzip |
| WebGL | one lazy scene — `ProgressCoreScene` (520.9 kB / **131.7 kB gzip**, three.js in-chunk, fetched only on `tier==='high'` + non-touch + full-motion via `SceneLayer`) | evolve into a scene *system*; same lazy discipline |
| Motion layer | `Reveal`, `Parallax`, `TiltCard`, `Burst`, `AnimateOnView`, `useScrollProgress`; all transform/opacity only; reduced-motion collapses to static | promote into reusable spatial primitives (§18) |
| Capability | `src/lib/capability.js` — webgl probe, tier (high/balanced/low), touch, particle budget, `aaru.cap` QA override | extend with scene quality + spatial tier; keep API |
| Design system | tokens.css single authority; 5 themes; motion.css owns all animation | add `spatial.css` as the depth owner |
| Screens | 18 routes, all `lazy()` except Today; hash router, zero deps | untouched routing; add camera transitions |
| Cloud | Supabase auth/RLS/sync/migration; document model v4; `user_state.doc` | **frozen contract** — presentation only above this line |
| Art | 27 webp, consistent deep-ink/violet-cyan universe via `scripts/optimize-art.mjs` | extend with V4 scene art, same pipeline |

## 2 · V3's 3D evaluation (honest)

V3 ships **one** WebGL object (energy field behind the Today Progress Core)
plus CSS perspective/parallax vocabulary. It is correct, gated and cheap —
but it is "a dashboard with a signature object", not a spatial product.
V4's gap is *architecture*: there is no camera, no scene graph, no shared
depth primitives, no environment beyond the aurora backdrop, and navigation
is a hard swap.

## 3 · What V4 must not touch

- Supabase auth, RLS, `user_state.doc`, merge semantics, migration prompt,
  offline/PWA behaviour, storage schema v4.
- The no-fake-data contract: every spatial surface renders real data or an
  honest empty state. Rarity, progress, pace, streaks — derived, never
  invented.
- The 44px tap-target floor, contrast sampling, keyboard path (`/`, Enter,
  Escape), `role="img"` chart labels, reduced-motion static states.
- All 290 existing tests + 359 e2e checks stay green.

## 4 · V4 spatial architecture (hybrid, per spec §3)

```
L1  semantic HTML            existing screens/store/cloud — untouched data flow
L2  CSS 3D  ───────────────  src/styles/spatial.css  (the depth owner)
    src/components/spatial/  SpatialStage · DepthLayer · SpatialPanel
                             DepthCard · SpatialStack · ScenePresence
    src/lib/spatial.js       camera model (spring, damped, velocity-aware),
                             scroll→camera mapping, spatial capability
L3  WebGL ─────────────────  src/components/three/*  lazy chunks only
                             WorldScene  — ambient environment (particles,
                                           distant planes, volumetric glows)
                             ProgressCoreScene — signature object (evolved:
                                           pct drives light, density, orbit,
                                           surface energy)
    Gate: SceneLayer-style — capability tier + reduced-motion + idle mount
    + IntersectionObserver pause + visibility pause + full dispose
```

Rules enforced by review and by `test/spatial.test.jsx`:

1. `three` is imported **only** inside `src/components/three/*`; every scene
   arrives via `lazy(() => import(...))`. The entry chunk gains no three code.
2. Every L2/L3 effect has a static composition for reduced motion and a
   2D fallback when WebGL is absent (spec §3, §24, §25).
3. Camera choreography is 300–900 ms, transform/opacity/filter only, one
   rAF loop per stage, never blocks input.
4. Mobile (`≤860px` or coarse pointer): reduced depth budget, no pointer
   tilt, no WebGL world layer, vertical spatial stacks (spec §23).

## 5 · Camera model

`spatial.js` writes **CSS custom properties** — not React state — from a
single damped rAF loop per `SpatialStage`:

- `--cam-x/--cam-y` — pointer parallax (fine pointers, high tier)
- `--cam-scroll` — page progress 0..1 mapped by the screen
- children consume `--z` depth tokens; stage consumes camera vars.

Springs are named (`CAM.glide`, `CAM.travel`) mirroring `lib/motion.js`
so checkbox, sheet and camera share one physics language. Route changes
fire a `.cam-in` entrance (≈420 ms) — old content recedes with an opacity
fall, new content rises from depth. No exit animations that make the user
wait (spec §8).

## 6 · Phase map and acceptance

| Ph | Scope | Acceptance |
|---|---|---|
| 1 | spatial.css + primitives + camera + WorldScene + boot/entry + auth editorial | new unit contracts; entry JS + ≤16 kB gzip; no route change semantics |
| 2 | Today spatial composition; core energy mapping | hero readable at all tiers; pulse→core response ≤500 ms |
| 3 | Projects spatial gallery (depth stack, hover, artwork) | keyboard order unchanged; 320px safe |
| 4 | Goals atlas — constellation of real links | data-only edges; SVG a11y labelled |
| 5 | Assignments pressure language (N DAYS LEFT + expected-vs-actual ribbon) | reuse `assignmentStatus`; honest empty |
| 6 | Insights data-room depth (planes, staged reveal, range transitions) | chart aria labels intact |
| 7 | Achievements collectible depth + honest rarity mapping (bronze→COMMON … diamond→LEGENDARY of *existing* rule tiers) | no fabricated unlocks |
| 8 | Navigation camera transitions polish + sidebar dock | 420 ms, skips on reduced motion |
| 9 | mobile simplification audit | e2e viewport sweep green; overflow 0 |
| 10 | perf/a11y/QA hardening, budget gates, PR → CI → merge → live verify | budgets in build-proof |

## 7 · Performance budgets (measured on built bundle, CI-enforced)

| Budget | Target |
|---|---|
| Entry JS gzip | ≤ 236 kB |
| Entry CSS gzip | ≤ 42 kB |
| Lazy 3D chunks | never fetched pre-first-paint; ≤ 160 kB gzip shared three chunk |
| Art additions | ≤ 60 kB webp total, all lazy except boot poster |

## 8 · Risks

- **Bundle drift** — camera/boot/canvas CSS is ~4 kB gzip; scenes stay lazy.
- **jsdom has no layout** — spatial primitives must render static states
  without IO/rAF (the V3 pattern, extended).
- **E2E determinism** — boot overlay is session-scoped + skippable and
  `qa` seeds use `addInitScript` where needed; the overlay never blocks
  auth forms or inputs behind it (pointer-events only on itself).
- **GPU loss at runtime** — scene creation wrapped in try/catch; a failed
  WebGL context renders nothing; SVG/CSS core carries on (V3 pattern).
