# RELEASE GATE CLEARED

## STATUS — **CI GREEN at `27ffe3f`** (run 35050845804 · conclusion: success · head_sha 27ffe3f33bec92d357ebff8c4eec29b413e4bdf8)

- Release branch `arena/01a08bf2-habbit-trackerrr` @ `27ffe3f` passes the full
  CI gate: vitest ✓ · schema/RLS ✓ · build ✓ · qa/workspace-e2e.mjs ✓ ·
  qa/e2e.mjs ✓ · qa/release.mjs ✓ · qa/audit.mjs ✓ (0 findings) ·
  qa/contrast.mjs ✓ (5 themes).
- Zero release-tree test failures. **No deploy performed** — production
  release is a separate instruction.
- Prior CI run `35038994397` (at `c79b707`) failed **only** `qa/audit.mjs` —
  30 tap-target findings, all the same three buttons ("30D/60D/90D" range segs
  that CI's font metrics render a hair under 44 px wide; local fonts measure
  45 px). `27ffe3f` pins `min-width: 44px` on `.hd-range button` → audit 0 findings.
- A sandbox reset mid-session deleted the local branch state; recovery was a
  pure fast-forward to remote `c79b707` + re-commit of the one-line fix
  (`27ffe3f`, content identical to the lost `371bfae`). No history rewritten,
  no force-push; main `7cbdab9` untouched.

## Change summary

Release branch `arena/01a08bf2-habbit-trackerrr` (fast-forward only):

1. `13faf1b` — release-blocker-fix: zero test failures at the release tree (prior phase).
2. `c79b707` — Fix release blockers: retarget QA suites to the Shell 2.0
   contract and repair 44 px / contrast a11y regressions (20 files).
3. `27ffe3f` — Harden `hd-range` buttons to a 44 px minimum width.

## Per-family classification (A real product regression / B test outdated vs intentional contract / C obsolete legacy / D env-fixture / E unknown)

### qa/e2e.mjs — browser journeys → **351 ✓ / 0 ✗ locally; ✓ in CI run 35038994397**
- **B** — Tested contract intentionally changed by the redesign. Retargets
  (each in-code commented): workload SVG aria uses relative day labels
  (Today/Tomorrow/'N days'); trajectory = `.lab-trajectory` forecast card +
  `[role=group]` chart loop; pillars = `.ins-pillar .ins-pillar-label`;
  EMPTY_BY_ROUTE anchors per current screens; Omni trigger
  `[aria-label="Open Omni"]`; V4 today anchor `.route-cam #today-screen`;
  V4 rarity tiers include `diamond`; reduced-motion anchors `.sp-depth[data-z]`
  on insights; today-seeded tap audit counts only interactive controls
  (the lead-mark itself was the A item below).
- **A** — `.today-row__lead-mark` rendered 18×18 (8×8 when disabled) → reworked
  to a real 44×44 button with the dot painted by `::before` (no visual change).

### qa/release.mjs — release UI proof → **101/101 checks locally; ✓ in CI run 35038994397**
- **B** — Titles: every screen owns one `h1` (Calendar's heading is the live
  `.hc-title` → match `Calendar|\d{4}`; Achievements h1 is 'Earned, not
  awarded'). Navigation: `.bottom-nav`→`.app-mobile-nav`, `.sidebar`→
  `.app-sidebar`, `.workspace-tabs`→`.wo-tabs`, More button label
  'More sections and settings'; goals/settings live in the mobile More sheet.
  Add-habit on mobile goes through the Omni panel's 'Add habit' chip (FAB
  removed by design). Create-goal button moved into `.wo__head-actions`.
  Habit-detail history anchors → `.hd-heatmap` + Current/Best streak copy.
  Today command center → `.today-now` + `.today-section`.

### qa/workspace-e2e.mjs — Work journeys → **356 ✓ / 0 ✗ locally; ✓ in CI run 35038994397**
- **B** — `.workspace-tabs`→`.wo-tabs`; `.workspace-active`→`.wo__active`;
  summary pill copy is sentence-case ('need attention' / 'due soon' /
  'active work'); deadline group headings → `.dlv__section-head h3`; empty
  state guard now asserts absence of `.workspace-overload`/`.dlv__pulse`
  (the old `.workspace-capacity` analytics no longer exists).
- **B (documented contract change)** — The interactive 7-day button grid
  (`.workspace-days`) was intentionally replaced by the capacity-vs-committed
  SVG chart + stat pills; the scenario now asserts the chart renders all
  7 days in its aria-label and ≥4 `.dlv__pill` stats. Days are no longer taps.
- **B (documented)** — 'no clipped dialog' now evaluates **top-level**
  dialogs only: PlanningPanel declares its own `role=dialog` and is embedded
  inside the plan Sheet; the Sheet contract caps the panel to the viewport and
  scrolls `.sheet-body`, so nested panels may extend below the fold by design.
  Top-level modals must still fit the viewport exactly as before.

### qa/audit.mjs — layout / tap-target audit → **0 findings locally at 27ffe3f; ✗ at c79b707 in CI (30 findings → fixed by 27ffe3f)**
- **A** — Genuine sub-44 px tap-target regressions from the redesign, repaired
  with minimal per-selector CSS (visual size untouched; hit areas grow via
  padding/negative margin or transparent `::after`):
  - today: `.today-row__lead-mark` (44×44 button, dot as `::before`),
    `.today-row__go`, today tools dock buttons
  - habits: `.habit-tabs a` (44 also inside the mobile media block — the base
    fix was silently overridden), `.hw-filter` (both breakpoints; base was 32,
    mobile media 36), `.habit-obj__name-link`, `.wr-row__name a`,
    `.wr-attention__row a` + `__btn`, routines step-name links + move buttons
  - calendar: `.hc-day__name a`, `.hc-day__btn`, `.hc-daynum`, `.hc-aggr`,
    `.hc-cell`, `.hc-name__link`, `.hc-rate__name`
  - work: `.workspace-row-title`/`.workspace-parent` (had **no** stylesheet at
    all — UniversalWorkRow renders bare links), `.dlv__pill`, `.wo__group a`,
    `.wo__more`, `.wo__cap a`, `.wo__snap`, `.wo__view-all`, `a.dlv__eyebrow`
  - goals: `.dlv__back`, `.goal-row__link`
  - insights: `.ins-range button`, `.ins-insight-action`, `.mind-dim-chip`,
    `.mind-insight-action`, `.mind-foot-link`, `.level-btn`, `.mood-btn`
  - habit detail: `.hd-back`, `.hd-range button` (+ **min-width 44** in
    `27ffe3f` — CI renders '30D' 0.1 px narrower than local fonts), `.hd-manage`
  - shell: `.app-brand`, `.app-omni-trigger`, `.app-search`, `.app-topbar__omni`
- **A** — achievements grid overflowed at 320 px:
  `repeat(auto-fill, minmax(272px, 1fr))` → `minmax(min(272px, 100%), 1fr)`.
- `27ffe3f` re-verified locally: audit exit 0, TOTAL findings: 0.

### qa/contrast.mjs — theme contrast → **5/5 themes exit 0; ✓ in CI run 35038994397**
- **A** — daylight `--color-text-3` `#6a7282` measured 4.47:1 → darkened to
  `#626a7a` (≥4.5 on light surfaces; tokens only, no component change).
- **A** — `.app-mobile-nav` used the same translucent `color-mix(oklab …)`
  fill as the old topbar (1.38:1 heading failure class) → opaque
  `var(--color-bg-raise, var(--color-bg))`, matching the topbar fix.
- **A** — accent-as-text on dark surfaces (`--accent` #7B5CFF ≈ 3.7–4.4:1) →
  per-theme `--accent-1-lift` (the tokens' designated accent-text tint):
  `.hc-daynum.is-today/.is-selected`, `.hc-day__state[data-state=today]`,
  `.wr-habits__day.is-today`, `.dlv__pulse-label.is-today`,
  `.rt-step.is-current .rt-step__num`, `.rt-step__btn.p-btn.is-current`.
- **A** — `.btn.primary` used the raw `--accent-1` (#7048f5) with the dark
  `--accent-ink` (#000) = 3.93:1; unified on the semantic pair
  `background-color: var(--accent)` + `color: var(--text-on-accent)`
  (#7B5CFF vs #000 = 4.82 ✓; daylight keeps white-on-#5B3DF0 ✓).
- **A** — `.hw-summary__sep` '·' was `var(--border-2)` (1.4:1) → `--text-2`.
- (Earlier commit, already in 13faf1b) dark `--accent-ink` #000000 ×4 themes,
  `--c-control-height-sm` 44.

### Unit gate (vitest) → **1187 passed / 35 skipped locally; ✓ in CI run 35038994397**
- Already green at 13faf1b; no test weakened, deleted, or skipped.

### D (env/fixture) / E (unknown)
- **D** — sandbox-only env notes (no CI impact): after the reset, the QA
  browser libs come from `node_modules/@sparticuz/chromium/bin/al2023.tar.br`
  extracted to `/tmp/al2023` (run with `QA_LIBRARY_PATH=/tmp/al2023/lib`);
  the bundled chromium extracts itself to `/tmp/chromium` on first launch.
- **E** — none remaining; every failure family is classified and closed.

## Constraint compliance
- No deploy performed; no `continue-on-error`; deploy gate untouched; main
  untouched; no history rewrite (fast-forward pushes only; sandbox-reset
  recovery was `git stash` → `git merge --ff-only c79b707` → re-commit).
- UI untouched structurally: only token values, hit-area/contrast CSS, one
  inline-style removal (`GoalDetailScreen` Link button `minHeight: 28`),
  and QA retargets where the tested contract intentionally changed.

## Verification matrix (local, at 27ffe3f)
| Gate | Result |
|---|---|
| vitest | 1187 passed / 35 skipped |
| qa/e2e.mjs | 351 ✓ / 0 ✗ |
| qa/workspace-e2e.mjs | 356 ✓ / 0 ✗ (3 viewports) |
| qa/release.mjs | 101/101 checks, 104 assets byte-match |
| qa/audit.mjs | 0 findings (exit 0) — re-run at 27ffe3f post-reset |
| qa/contrast.mjs | 5/5 themes exit 0 |
| eslint | clean (max-warnings 40) |
| git diff --check | clean |
| Build | initial JS 225.0 kB gz, **CSS 48.0 kB gz** (budget 56,320 B), three lazy-only chunks, lazy boundaries intact |

(vitest/e2e/workspace/release/contrast/lint were verified on the identical
tree content pre-reset at `371bfae` = `c79b707` + this one CSS line; audit,
build, and the full toolchain were re-verified after the reset at `27ffe3f`.)

## Branch / SHA / CI
- Working branch: `arena/01a0a67c-habbit-trackerrr` @ `27ffe3f`
- Release branch: `arena/01a08bf2-habbit-trackerrr` — fast-forwarded to `27ffe3f` (pushed ✓)
- main: `7cbdab9` (untouched)
- **CI: run `35050845804` @ `27ffe3f` — SUCCESS** (jobs + steps all ✓, including
  "Browser journeys and release UI checks" and "no console/page/network errors"
  for all three viewports).

## Resolution
**RELEASE GATE CLEARED.** Zero release-tree test failures; all gates green
locally and on GitHub CI at `27ffe3f`. Awaiting the separate
production-release instruction — no deploy was performed.
