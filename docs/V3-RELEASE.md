# Habit OS — V3 release notes

V3 evolved V2 screen-by-screen on the same store, schema and sync contract.
Nothing was rewritten; every phase landed behind the full QA matrix
(unit + e2e + build + lint + browser QA) and merged only green.

## Phases

| # | Scope | Commit |
|---|-------|--------|
| 1 | Motion + depth foundation (tokens, Reveal, AnimateOnView, capability tiers, feedback channel) | `4ad8d5c` |
| 2 | Today immersive command center (hero core scene, honest day shape) | `061230b` |
| 3 | Goals 2.0 (living goal analytics, expected-vs-actual pace from real logs) | `7232eff` |
| 4 | Projects & Assignments 2.0 (interactive track, life states, deadline pressure) | `bccb397` |
| 5 | Insights viz 2.0 (day clock, pulse ribbon, gated mood scatter) | `42b2cdf` |
| 6 | Achievements 2.0 (the unlock moment: watcher + toast + medal sheen) | `c4a7fc2` |
| 7 | Calendar + Workload 2.0 (completion density row, deadline lanes) | `30fa6fd` |
| 8 | Onboarding + empty states 2.0 (generated art moments, category chips) | `c5b6867` |
| 9 | Perf / a11y / QA hardening (lint gate, useNow clock, keyboard journey) | see git log |

## Honesty contracts kept

- No fabricated data: every viz draws only logged evidence; gaps render as
  gaps (null days break lines, unscheduled days are hollow, future months
  stay outlined, scatter trend lines need |r| ≥ 0.3 and say "association,
  not causation").
- Correlations gate on sample size; empty states say plainly what is missing.
- Supabase auth/RLS/sync/migration untouched; schema unchanged in V3.
- Sound: architecture only (feedback channel), no audio shipped.

## Performance budgets (measured on the built bundle)

| Budget | Target | Measured |
|---|---|---|
| Entry JS (gzip) | ≤ 230 KB | 213 KB |
| 3D scene chunk (gzip) | loads only on capable devices, never on first paint | 128 KB, lazy; **0 KB** on non-WebGL devices (verified headless) |
| CSS (gzip) | ≤ 40 KB | 28 KB |
| Art (27 webp, lazy) | ≤ 300 KB total | 265 KB, all `loading="lazy"` except the onboarding moment |
| Screen chunks | code-split per route | 27 chunks; insights route pulls 5 JS files total |
| Build time | ≤ 10 s | ~5.1 s |

Headless probe (mobile viewport, seeded): `insights` loads 763 KB raw JS
across 5 chunks with **no** three/scene chunk; `today` on a no-WebGL client
loads only the 716 KB raw entry — the scene chunk is requested solely when
the capability tier allows it and the hero mounts.

## Accessibility

- Keyboard-only path verified end-to-end: Tab reaches habit completion,
  Enter toggles, focus rings visible, `/` opens search and Escape closes it.
- Tap targets ≥ 44 px enforced by e2e on every interactive surface
  (lanes included).
- Contrast sampled per screen in e2e (today, insights, deep dive,
  achievements, workload…).
- Every animation has a static final state under `prefers-reduced-motion`;
  onboarding step transitions collapse to opacity-only.
- All charts carry `role="img"` + descriptive `aria-label` with the real
  numbers; screen readers never depend on hover or motion.

## QA matrix (this release)

- Unit: 290 tests / 19 files (vitest, jsdom).
- E2E + visual: 359 checks (puppeteer, mobile + desktop + viewport sweep
  320–414 px, reduced-motion, offline, empty states, keyboard).
- Lint: `npm run lint` — eslint flat config, hook rules + correctness gate,
  0 errors.
- Build: `npm run build` ~5.1 s; release proof rejects private credentials
  in the bundle (`test/build-proof.test.js`).
