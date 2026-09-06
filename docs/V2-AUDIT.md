# Habit OS — V2 audit and plan

Audited at commit `e3901bd` (the `main` tip the branch was cut from).
Everything below was read from the code, measured in a real headless
Chromium, or produced by the existing test suite — nothing here is
assumed.

---

## 1 · Current architecture

**Stack.** React 18.3 + Vite 5.4. No router library, no chart library,
no UI kit, no CSS framework. State is one `useReducer` + Context store.
Fonts (Inter and Manrope, variable) are self-hosted via `@fontsource`.
Supabase is the only backend; the app is otherwise offline-first.

```
src/main.jsx
  AuthProvider → StoreProvider → SyncProvider → AuthGate → App
  (sets data-theme; registers the service worker in production only)
```

| Layer | File(s) | What it owns |
|---|---|---|
| Routing | `lib/router.jsx` | ~40-line hash router. `useRoute() → { route, param }`. `#/projects/<id>` style params. |
| State | `store.jsx` | `STORAGE_KEY='aaru.habits.v4'`, legacy `v3`/`v2` migration, `normalizeImport()`, per-entity base factories, project/assignment settle logic. 598 LOC. |
| Persistence | automatic | Every reducer action persists to `localStorage` on change. |
| Cloud | `lib/cloud/` | `supabase.js` (PKCE client, `cloudConfigured` flag), `syncEngine.js` (pull/push/clear on `user_state`), `SyncProvider.jsx` (status machine), `merge.js`, `migrationState.js`, `errors.js`. |
| Domain logic | `lib/stats.js`, `lib/analytics.js`, `lib/work.js`, `lib/schedule.js`, `lib/dates.js`, `lib/reminders.js`, `lib/importExport.js` | Pure functions. `stats.js` is the single source for every number the UI shows (streaks, rates, eligibility). |
| Charts | `components/charts/chartKit.jsx`, `workCharts.jsx` | 14 hand-rolled SVG/HTML primitives, all dependency-free, all `role="img"` with per-point text. |
| Styles | `styles/*.css` | see §5 — this is the problem area. |

**Data model.** One JSON document per user. `profiles` + `user_state`
(one `jsonb` `doc` row per user, `revision`, `schema_version 4`).
Relational per-entity tables are deliberately *not* used — the schema
comments say so explicitly. RLS is enabled and forced on both tables,
four `auth.uid()`-scoped policies each, `anon` fully revoked, a
`handle_new_user()` trigger, and a `delete_own_account()` SECURITY
DEFINER function limited to `auth.uid()`.

**Sync truthfulness.** Verified in `SyncProvider.jsx`: status is
`SYNCED` only after a real pull/push resolves; `lastSyncedAt` is the
server's `updated_at`; a `serverCanonical` ref skips pushes when local
equals server; sign-out resets everything to `LOCAL`; the migration
prompt appears only when both sides hold data *and* the documents
differ, and honours a remembered per-account/device choice. This is
correct and must not be touched.

**CI/CD.** `.github/workflows/ci.yml` runs `npm ci → npm test →
npm run test:schema` (executes `supabase/schema.sql` against a real
PostgreSQL and asserts RLS denies cross-user access) `→ npm run build`.
Deploy is GitHub Pages, injecting the Supabase URL and publishable key
as build-time env, failing loudly if the secrets are unset, then
verifying the *actual injected values* appear in `dist/assets/*.js`
(the workflow comments warn, correctly, not to grep for `supabase.co`
because supabase-js hardcodes it — that would be a false pass).

---

## 2 · Current screens (16 + 2 auth)

| Screen | LOC | Notes |
|---|---|---|
| Today | 323 | Greeting, progress ring, habit rows, priority work, one insight, missed-yesterday block. |
| Calendar | 443 | Habit × day matrix with month bands, legend, year of mini-months. |
| Week | 233 | Week grid. |
| Insights | 398 | Hero stats, trend, week-vs-week, heatmap, habit matrix, year overview, achievements, mood link, deep-dive link. |
| InsightsDeepDive | 328 | Weekday patterns, consistency, distribution, correlations, time-of-day. |
| Mind | 341 | Mood check-in, energy/focus/sleep sliders, reflection, correlations. |
| Goals | 262 | Links projects ↔ habits; stat cells; no goal entity of its own yet. |
| Library | 442 | Habits tab, routines tab (habit stacks), archive. |
| Record | 119 | Event timeline. |
| Settings | 340 | Profile, theme, reminders, import/export, account. |
| Projects / ProjectDetail | 426 / 677 | Milestones → tasks, progress, deadline hero, facts strip, time-vs-work. |
| Assignments / AssignmentDetail | 329 / 358 | Subtasks, expected-vs-actual pace, risk. |
| Workload | 198 | Load by day, overdue strip, week/14/30 windows. |
| Timeline | 79 | Deadlines in order. |

Plus `Onboarding` and `Auth`. Mobile navigation is a 4-tab bottom bar
plus a **More** sheet; desktop is a grouped sidebar.

---

## 3 · Current functionality

- **Habits** — daily / specific weekdays / every-N-days / times-per-week
  schedules, pause windows, per-day skips, per-check-in notes,
  reminders, archive, reorder, categories (fitness, health, mind,
  learning, creative, social), routines as habit stacks.
- **Tracking** — check-ins with timestamps, streak and best-streak,
  completion rates, consistency score, per-weekday performance,
  time-of-day splits, 30/60/90 windows, heatmap, year overview,
  habit × habit matrix.
- **Work** — projects with milestones → tasks, assignments with
  subtasks, both with deadlines, expected-vs-actual pace, risk
  status, workload by day, overdue detection, deadline reminders.
- **Mind** — mood (1–5), energy/focus/sleep (1–5), notes, reflections,
  correlations with habit completion.
- **Insights** — trend series, week comparison, distribution buckets,
  correlations, completion by time of day, and **MIN_SAMPLES guards**
  so a stat is not drawn from one or two data points.
- **Data** — JSON import/export, `normalizeImport()` on the way in,
  Supabase sync with merge and migration prompts, account deletion.
- **PWA** — manifest, service worker, installable, GitHub Pages.

**What is genuinely good and must be preserved:** the auth/sync/RLS
layer, the `MIN_SAMPLES` discipline in the analytics, the
`normalizeImport` hardening, the schema-level RLS tests, and the fact
that no chart library is used (bundle is 208 kB gzip against a 450 kB
budget).

---

## 4 · Existing tests

**146 tests, 7 files, all passing** before this work began.

| File | Tests | Covers |
|---|---|---|
| `test/app.test.jsx` | ~40 | Full user flows through the real app: onboarding, add habit, check off, calendar toggling, navigation (desktop sidebar + mobile tabs + More sheet), search palette, theme persistence, export/import round-trip, reminder windows, unknown-hash fallback. |
| `test/work.test.js` | ~40 | Project/assignment progress, status, pace, workload series, deadlines. |
| `test/stats.test.js` | 27 | Streaks, rates, eligibility, heatmap, matrix. |
| `test/analytics.test.js` | 18 | Consistency, distribution, correlations, habit detail, milestones. |
| `test/migration.test.jsx` | ~10 | Sign-out/sign-in stability, migration prompt, cloud merge. |
| `test/importExport.test.js` | 4 | Round-trip integrity. |
| `test/merge.test.js` | 15 | Cloud merge semantics. |

Plus CI-only: `npm run test:schema` executes the real SQL schema
against PostgreSQL and asserts cross-user access is denied.

**Gaps found:** no test covered the achievement rules (there were none
to test), no test covered the Today plan logic (it did not exist as
such), and there was **no automated visual/responsive/contrast
verification at all** — everything was eyeballed.

---

## 5 · Current visual weaknesses (measured)

I cannot see images, so every claim below is a measurement, not an
opinion. Two new tools were written for this: `qa/audit.mjs` (layout,
overflow, console errors, touch targets across 10 viewports × every
route) and `qa/contrast.mjs` (WCAG contrast on every visible text
node, per theme).

**a) Three competing CSS layers fighting over the same tokens.**
`tokens.css` defines the palette, then `visual.css` redefines every
colour (a "restrained editorial" palette), then `energy.css` redefines
them *again* (a vivid violet/cyan palette). Import order decided the
look. This is the single biggest problem: no one can safely change a
colour, and the two dead layers are ~1,800 lines.

**b) Glow and hardcoded hex.** The winning layer (`energy.css`)
contained ~150 hardcoded hex values, `drop-shadow()` glow filters on
the progress ring and the chart trend line, `text-shadow` on six
different stat values, a shimmer sweep on completed habit rows, and
category-coloured glow borders. That is exactly the "neon gaming
dashboard" register the brief rejects.

**c) `!important` size hacks.** The Today progress ring was pinned with
`width:112px!important` / `width:100px!important` at two breakpoints,
fighting the component that owns it.

**d) Dead-end tokens.** `--aurora-a/b/c` were set to transparent by
one layer and to real colours by another; four `--v3-*` colours were
referenced from JSX but only defined in one layer, so every one of
them silently fell back to `var(..., fallback)`.

**e) 224 sub-44px touch targets** at baseline — mood buttons at 40px,
toggle switches at 48×28, filter chips at 36px, sort selects at 30px,
workload day numbers at 28×17, and card title links at 22–26px.

**f) The spacing scale was 4px-based while the code read as if it were
8px-based.** `--sp-4` was 16px. (I briefly broke this myself by
renormalising the scale; it is now frozen, see §7.)

**g) Theme set did not match the brief.** Themes were midnight / ember /
verdant / daylight. The brief specifies Midnight, Aurora, Warm, Light.

**h) Typography was underpowered.** Screen titles at 1.55rem, no
display/body distinction in tracking, no fluid scale, and small text
at 9–10px in several places.

**i) Broken editorial accents.** Insight card titles got a glowing
`::before` dot; every second insight card got a 3px left border in an
alternating violet/cyan pattern; the calendar month label was a
violet→cyan gradient bar. Decoration with no information in it.

**j) No art library for the new surfaces.** `public/art/` had six
category illustrations, four badge tiers and an OG image. There was no
artwork for goals, projects, assignments, habits, insights, workload
or empty achievements — every empty state fell back to a bare icon.

**k) No automated responsive verification.** The brief asks for
verification at 10 widths. Before this work, nothing checked it.

---

## 6 · Proposed V2 plan

Eight phases. Each ends with `npm test`, `npm run build`, a full
`qa/audit.mjs` sweep, a contrast sweep in every theme, screenshots, and
a review before the next begins.

| # | Phase | Scope | Status |
|---|---|---|---|
| 1 | **Design system + visual foundation** | One authoritative token layer, five themes, elevation/motion/type/chart scales, the art pipeline, and a new product layer that replaces the two dead CSS layers. Strip glow. | **Done** |
| 2 | **Navigation + Today + Habits** | Regroup the sidebar into Today/Build/Plan/Understand; promote Habits and Achievements. Today becomes a command center (priorities, goals, day timeline). Habit detail page. Achievement engine + screen. | **Done** |
| 3 | **Goals + Projects + Assignments** | Goals as a first-class entity with milestones → habits → projects → daily actions. Project health and urgency. Assignment expected-vs-actual pacing and risk. | Next |
| 4 | **Calendar + Workload** | Month/week/day views with no horizontal overflow at 320px. Workload overload detection and rebalancing suggestions. | |
| 5 | **Insights** | 15 named charts, 7D/30D/90D/6M/1Y/ALL ranges, and a plain-language sentence under every chart. | |
| 6 | **Achievements + polish + imagery** | Finish the art library (goal, project, assignment, habit, streak, onboarding, app icons), empty states everywhere, premium profile/account. | |
| 7 | **Cloud / multi-device verification** | Real two-device sync, conflict and merge behaviour, honest sync status at every step. | |
| 8 | **Full QA + production deployment** | `npm test`, `npm run build`, `GH_PAGES=true npm run build`, CI green, PR, merge, GitHub Pages, verify the real public URL in a real browser with real user flows. | |

### Non-negotiables carried into every phase

- No destructive schema change; every migration backwards-compatible.
- No fabricated statistics. Insights derive from stored data and show
  "Not enough data yet" when there is not enough.
- No "Synced" without a real round-trip.
- 44 px touch targets, zero horizontal overflow at 320–1920, WCAG AA
  contrast in every theme, `prefers-reduced-motion` respected.
- Bundle stays under 450 kB gzip initial JS (currently 209 kB).

---

## 7 · What changed in phases 1 and 2

**Design system (`src/styles/tokens.css`, `src/styles/system.css`).**
`visual.css` and `energy.css` are deleted. One token file now owns
typography (fluid scale, display vs body tracking), spacing, radii,
borders, motion easings, four elevation levels, categorical and
sequential chart palettes, and semantic state colours. Five themes:
**Midnight** (deep ink navy, warm white type, restrained violet → cyan),
**Aurora**, **Verdant**, **Warm**, **Light**. Legacy `--sp-*` values
are frozen so no existing layout shifted; new code uses a canonical
8px `--space-*` scale.

Depth now comes from borders and controlled shadows. The glow filters,
shimmer sweep, text-shadows and alternating coloured borders are gone.
Category colour is carried by a single 3px rail.

**Measured result of the sweep** (16 routes × 10 viewports, 320 → 1920):

| Check | Before | After |
|---|---|---|
| Horizontal overflow | 0 | **0** |
| Console / page errors | 0 | **0** |
| Sub-44px touch targets | **224** | **0** |
| WCAG AA contrast failures (5 themes) | not measured | **0** |
| Tests | 146 | **171** |
| Main bundle gzip | 208.17 kB | **209.24 kB** |

**New capabilities.** `lib/achievements.js` (17 rule-based achievements
with real progress and real earned dates, 14 tests), the Achievements
screen, `lib/today.js` (ranked priorities, goals-vs-pace, day timeline
built only from real times, 11 tests), the `/habits/:id` detail page,
and `scripts/optimize-art.mjs` + `qa/audit.mjs` + `qa/contrast.mjs`.

---

## 8 · Known open items

- **GitHub authentication has expired in this workspace.** Commits are
  saved locally on `arena/01a0762d-habbit-trackerrr` but cannot be
  pushed, so no PR or GitHub Pages deploy yet. Reconnect GitHub in
  Arena and this can go out.
- The art library is partially generated (8 category illustrations, 2
  empty-state pieces). Goal, project, assignment, habit, insights,
  workload, achievements, streak and onboarding artwork, plus the app
  icons and OG image, are still to be produced. The image generator
  caps at 10 images per turn, so this continues in the next turn.
- Goals are still expressed as projects. Phase 3 makes them a real
  entity.
- `public/art/gen/` holds ~2 MB raw PNG sources and is gitignored;
  only the optimised WebP (~4–13 KB each) is committed.
