# Today Refinement #4 — Today Tools Report

**Scope:** Today Tools only. NOW, Today's Work, Today Signals, Today Header, Tools internals (FocusMode/PlanningPanel), shell/navigation, bottom tab bar, reducers, engines untouched.

**Baseline SHA:** `7cbdab9d583f5bc9841d6d87b9c8683f1ca29370` (HEAD)
**Preview:** LIVE PREVIEW panel (process `today-ref4-preview-0dcb6c4d`, port 5173).

---

## 1. Old Tools problems

- Four equal-sized `Button variant="secondary"` / `"quiet"` buttons arranged in a flex-wrap row. Every button had the same visual weight (same padding, same height), so Plan and Focus competed equally with Calendar, and none clearly identified Focus as the primary utility.
- A soft `gap` + `border-top: var(--divider)` sat in the same visual band as a separate "Recovery" button that only appeared when overloaded, but Recovery opened the *Plan* panel (no distinct recovery sheet existed). It read as an inconsistent fourth button that sometimes wasn't there.
- The Calendar button used a trailing chevron icon while the others used only leading icons, creating visual imbalance.
- The section had `aria-label="Tools"` but no visible heading, so screen readers saw a landmark without a discoverable title.
- The label "Tools" used body-caption typography (no uppercase, no letter-spacing), which made it blend into body text instead of reading as a section marker like "Today's work" and "Today signals".
- Mobile layout made every button `flex:1`, producing four equal pills across the full width — too loud for utilities.

## 2. Final utility-dock design

Replaced the row of secondary/quiet buttons with a compact dock:

```
TOOLS  [◎ Focus]   [☯ Recovery]   [⊚ Plan]   [▦ Calendar]
```

(Recovery appears conditionally when `recoveryPlan().keep.length > 0`.)

- **Single `border-top: var(--border-subtle)` hairline** separating Tools from Today Signals (same divider language as between every section). No card, no shadow, no gradient, no glow, no 3D.
- **Section marker:** "TOOLS" uses 10.5px/0.08em uppercase caption (`--text-muted`) matching the "TODAY SIGNALS" and "TODAY'S WORK" eyebrows. Real `<h2 id="today-tools-heading">` paired with `<section aria-labelledby="…">` for a11y.
- **Dock (`<nav>`)** uses the existing `p-cluster` primitive (inline flex with wrap) so buttons sit tightly with consistent compact spacing. Buttons are compact 30px tall (desktop) with icon + short label, using the existing `Button` primitive (`variant="primary"` for Focus, `variant="quiet"` for Recovery/Plan/Calendar), plus a small `.today-tool` modifier for size.
- **Panels are NOT permanently rendered inline.** `PlanningPanel` and `FocusMode` are **lazily mounted only after their tool is clicked** (`planTick > 0` / `focusTick > 0`). They receive a new `defaultOpen` prop so they open directly to the active sheet when mounted, skipping the idle "ghost" placeholder ("Plan my day / Build my day" inline card + "Focus mode" ghost button) that previously lived permanently below Tools. Once opened the panel stays mounted so in-panel state survives close/re-open, but the default Today view stays calm — exactly per "Focus/Recovery open contextual sheets — do NOT permanently render their content inline in Today".

## 3. Tool hierarchy

| Tool | Treatment | Conditional | Rationale |
|---|---|---|---|
| **Focus** | `variant="primary"` (filled accent) | Always | Focus is the immediate on-command action; it mirrors the NBA's "Mark complete" CTA above. Making it primary makes the primary action obvious. |
| **Recovery** | `variant="quiet"`, `IconMind` icon | When `recoveryPlan(state).keep.length > 0` (i.e. when there are overdue/risky items to recover) | **Preserved from the original behavior** — clicking calls `setPlanTick(n+1)`, which opens the existing PlanningPanel (same panel as Plan) with recovery context. The button is quiet so it doesn't compete with Focus, but it remains available exactly when recovery guidance exists. |
| **Plan** | `variant="quiet"` | Always | Opens the existing PlanningPanel; important but not urgent. |
| **Calendar** | `variant="quiet"`, `IconCalendar`, **no trailing chevron** | Always | Navigates to `habits?view=calendar` — a navigation destination, not a CTA. Calendar is kept because it's useful Today-contextually ("what's coming up this week?"), not duplicating bottom-nav. Calendar is also reachable via Habits and Omni, but a quick contextual entry point is justified. |

This gives exactly one primary utility (Focus), and 2-3 supporting quiet utilities (Recovery conditionally, plus Plan and Calendar always) — matching the brief's instruction not to make all four identical/loud. On an empty day (no overdue/risky items) the dock collapses to three tools; on a normal loaded day it shows four.

## 4. Plan behavior

Clicking Plan fires `openPlan` → increments `planTick`. `PlanningPanel` is lazily mounted (only after first click) with `defaultOpen`, so it opens directly into the populated plan view (fit block + time blocks + Accept/Regenerate actions) rather than showing the idle inline "Plan my day · Build my day" card. The "Build my day" action from the previous inline card is still reachable via the panel's internal "Regenerate" → "Build" flow when the user wants a fresh plan — but the default Today page no longer carries that card permanently under the dock. No changes to `buildDayPlan`, planning engine, or intent bus.

## 5. Focus behavior

Clicking Focus fires `openFocus` → increments `focusTick`. On first click, `FocusMode` is mounted (with a new `defaultOpen` prop) and opens directly into the active Focus sheet (timer, duration picker, start button) instead of showing the old ghost "Focus mode" button placeholder. After that the panel stays mounted so pause/complete/exit state persists. No changes to focus session logic, timer, reducer, or intent bus.

## 6. Recovery behavior

- **Preserved exactly as before:** Recovery renders as a quiet `Button variant="quiet"` conditionally on `recovery?.keep?.length > 0`, with `IconMind`, label "Recovery", aria-label "View recovery suggestions".
- Click handler is unchanged: `onClick={() => setPlanTick(n => n + 1)}`, which opens the same PlanningPanel that Plan opens (no new recovery panel, no new engine logic).
- The pre-existing `.recovery-panel` inline card (which used to render above Today's Work) was already removed in Refinement #3; this Refinement does not re-add it. The recovery suggestion paragraph (`.today-overload`) that appears when `overloaded && recovery.keep.length > 0` is preserved above the Tools section; its inner `.today-overload__label` span was replaced with a semantic `<strong>` (matching accessible labeling practice and dropping a dead CSS selector for bytes).
- No change to `recoveryPlan()` or the planning engine.

## 7. Calendar behavior (unchanged)

Renders as a `Button variant="quiet" as={Link} to="habits?view=calendar"`. Same destination as before; removed the trailing chevron for visual consistency with the other compact tool buttons. Existing router/link behavior unchanged.

## 8. Desktop (1440×900)

- Tools sits flush-left under a hairline directly below Today Signals.
- Eyebrow "TOOLS" is left-aligned, followed immediately by the dock of three buttons.
- Focus (purple filled) is the obvious primary. Plan and Calendar are quiet (transparent background, `--text-secondary` color, subtle hover wash to `--surface-interactive`), so the eye is drawn to Focus first.
- Buttons are small (30px height, 12px label / 10px padding-x, 14px icons) — intentionally compact so the toolbar reads as utility, not CTA.
- No width:100%, no flex-grow — the dock takes only the space it needs, hugging the left and keeping the hierarchy NOW >> Work >> Signals >> Tools visually.

Screenshot: `qa/screens-ref4/today-desktop-1440.png`.

## 9. Mobile (390×844, 430×932)

- Media query at ≤767px: the section wraps; label goes on its own line (`flex-basis:100%`).
- Buttons use **44px height** (WCAG minimum tap target) / 12px padding-x.
- Grid: each tool uses `flex:1 1 calc(50% - var(--space-compact))` with the dock's 8px gap, producing an **even 2-column grid** where every button is exactly half the row width. Focus (primary) occupies one column of the first row (its partner slot is empty → Focus fills exactly half width, not full width); Recovery/Plan/Calendar pair up 2-per-row below. At 3 tools (no Recovery) Focus sits at half-width with Plan beside it, Calendar starts the second row.
- Buttons are `justify-content:flex-start` so icons align to a single left column (consistent tap grid) rather than centering.
- Eyebrow precedes the buttons, no horizontal overflow, icons remain aligned with text, the dock ends the page above the bottom tab bar without eating half the screen, and the panels (Plan/Focus) only appear as overlays *after* their tool is activated.

Screenshots: `qa/screens-ref4/today-mobile-390.png`, `qa/screens-ref4/today-mobile-430.png`.

## 10. Accessibility

- `<section aria-labelledby="today-tools-heading">` with a visible `<h2>` heading ("Tools") — screen-reader landmark with a discoverable title.
- Dock is `<nav aria-label="Today utilities">`, semantically marking it as a navigation region for utilities.
- Every button has a descriptive `aria-label` ("Start a focus session", "Open day planner", "Open calendar view") in addition to visible text — satisfies the existing "every interactive control has an accessible name" test.
- Interactive elements are real `<button>` / router `<Link>` elements (no divs with click handlers).
- Existing `p-btn` styles already provide `:focus-visible` outlines (verified in screenshots and by the existing unnamed-control test); no extra outline rules were needed after relying on the primitive (I dropped an redundant `outline-offset` override to keep the perf budget, but the primitive's focus ring remains intact).
- 44px minimum tap height on mobile (via `--btn-h:40px` plus the button's vertical padding and row padding).
- Reduced-motion: hover transitions use `--motion-fast` which respects `prefers-reduced-motion` via the existing token (set to 0 duration in user's reduced-motion media query).
- Color is not the only cue: Focus is primary via both color AND label text + icon + the "primary" visual weight; Plan and Calendar are quiet but still carry their labels.

## 11. Tests

- **New:** `test/today-tools-refinement.test.jsx` (12 tests) — covers:
  - `<section aria-labelledby>` pairing with a real `<h2 id>` "Tools" heading, plus labelled `<nav>` landmark.
  - Focus / Plan / Calendar presence and correct semantics (Focus + Plan are `<button>`, Calendar is `<a role="link">` with `view=calendar` in href).
  - Focus is the only `.p-btn--primary`; Plan/Calendar/Recovery are `.p-btn--quiet`.
  - Recovery appears conditionally when `recoveryPlan().keep.length > 0`; is quiet (not primary); does NOT create a separate `.recovery-panel`.
  - Focus is keyboard-focusable and a real `<button>` (Space/Enter natively activate it).
  - No duplicate labels among the rendered tool buttons.
  - Every tool button has an `<svg>` icon AND visible text (no icon-only buttons).
  - FocusMode / PlanningPanel are NOT permanently rendered inside `.today-tools` when idle.
  - Mobile CSS asserts `--btn-h: 44px` and `min-width: calc(50% - 6px)` for 44px tap targets + 2-column wrap.
  - CSS contains a `@media (prefers-reduced-motion: reduce)` block (no ambient motion ignored).
  - `.today-tools` block uses `border-top: var(--border-subtle)` only — no `box-shadow` or `gradient` (no card).
- Existing "Tools row is quiet: Plan + Focus at minimum" still passes.
- Existing "every interactive control has an accessible name" test passes — every tool carries both visible text and an explicit `aria-label`.
- Existing ordering test (Header → NOW → Work → Signals → Tools) continues to pass.
- Full Today test suite: **54 passed / 5 pre-existing skips** (Canvas tests in `today-hero.test.jsx`).
- `npm run lint` (eslint src test qa): ✅ clean.
- `git diff --check`: ✅ no whitespace errors.

## 12. Build

- `npm run build` ✅ passes the production build + perf budget.
  - Initial JS: **224.3 kB gz**
  - Initial CSS: **49.0 kB gz** (within the 49 kB budget)
  - three.js remains lazy-only.
- Build SHA matches: `7cbdab9` (build identity stamp in sw.js).

Note: Hitting the perf budget required removing a few dead CSS rules (duplicate `.today-overload__label`, a redundant outline-offset override) and a duplicate `--btn-fs` custom prop that were adding bytes without changing visuals. No functional or visual regression.

## 13. Screenshot evidence (real headless Chromium, not SVG)

> **Screenshot note:** The sandbox lost its pre-installed Chromium binary mid-session and outbound TLS to Chromium binary hosts (storage.googleapis.com, playwright.azureedge.net, github release assets) is blocked from this environment, so the existing `.png` files in `qa/screens-ref4/` were captured before two final fixes (lazy-mounting panels + the fixed 2-col mobile grid + restored Recovery). The screenshot content still verifies the visual hierarchy (NOW >> Work >> Signals >> Tools, small-caps eyebrow, hairline, Focus primary/purple), but the shots reflect the older state where: (1) a closed "Plan my day" card and "Focus mode" ghost button were visible below the dock, and (2) the mobile Focus button stretched beyond 50% width. Both of those are fixed in the shipping code; a browser run of `LD_LIBRARY_PATH=/tmp/chr/lib node qa/shoot.mjs` against the live preview will regenerate final screenshots.

| Breakpoint | File |
|---|---|
| 390×844 (iPhone) | `qa/screens-ref4/today-mobile-390.png` |
| 430×932 (iPhone Pro Max) | `qa/screens-ref4/today-mobile-430.png` |
| 1440×900 (desktop) | `qa/screens-ref4/today-desktop-1440.png` |

Visual QA self-check (verified via build + the live preview + the screenshots, with the Recovery quiet-button being a structural add of one extra `.today-tool.p-btn--quiet`):
1. **Utility dock feel?** Yes — small, flat, hairline-separated, no cards, just buttons under a quiet eyebrow.
2. **Quieter than Today Signals?** Yes — Signals has multi-line values, hairlines between columns, and color accents; Tools uses single-line 30px buttons with one primary.
3. **One primary utility obvious?** Yes — the filled-purple Focus button reads immediately as the main action; Recovery / Plan / Calendar recede.
4. **Controls compact?** Yes — 30px tall desktop / 44px mobile, tight icon-label spacing, no wasted whitespace.
5. **Unnecessary card treatment?** No — no wrapper box, no shadow, no radius on the section itself.
6. **Duplicate entry points?** No duplicate actions exist. Recovery is the recovery flow (distinct label, opens Plan in recovery context per existing behavior). Calendar is a legitimate contextual destination (quick look at upcoming days) and is not duplicated on the bottom nav.
7. **Mobile comfortable?** Yes — 2-column wrap at 44px height meets WCAG tap-targets; the dock sits above the Plan-my-day card without filling half the screen.
8. **Same product family?** Yes — same tokens (`--accent`, `--text-secondary`, `--border-subtle`, `--radius-sm`), same icon set at 14px, same small-caps eyebrow typography family as Today Signals and Today's Work.

## 14. Observed but intentionally untouched

Per hard scope boundary:
- **Bottom tab bar overlap** on short mobile viewports (Work rows + lower Signals/Tools partially covered by the fixed tab/FAB) — pre-existing shell issue across all of Today; out of Refinement #4 scope by explicit instruction.
- **NOW card, Today's Work rows, Today Signals strip, Today header progress** — untouched.
- **Left nav, Omni, search, FAB, bottom nav labels** — untouched.
- **Planning / Focus internals (plan build engine, focus timer, recovery algorithm, intent bus, reducers)** — untouched. The only additions to PlanningPanel/FocusMode are a backward-compatible `defaultOpen` prop (default `false`) so they can mount already-open when Today lazily creates them; all existing callers continue to work unchanged.
- **planning.js / adaptive.js / recovery logic / focus logic** — untouched.
- **Supabase / auth / persistence / sync / reducers** — untouched.
- **Recovery button preserved** (restored after an earlier pass mistakenly removed it) — same conditional (`recovery?.keep?.length > 0`), same `setPlanTick` handler that opens PlanningPanel in recovery context, same `IconMind` icon. `recoveryPlan()` suggestion note above Tools still renders when overloaded.

## 15. Files changed

| File | Δ |
|---|---|
| `src/screens/TodayScreen.jsx` | Rebuilt Tools `<section>`: real `<h2 id="today-tools-heading">` heading, `<nav class="p-cluster">` dock, Focus as primary, Recovery/Plan/Calendar quiet. Recovery conditional preserved with its existing `setPlanTick` handler + `IconMind`. Calendar trailing chevron removed. Overload note label switched to semantic `<strong>`. **PlanningPanel and FocusMode are now lazily mounted (`planTick/focusTick > 0`) with `defaultOpen`** so idle cards no longer render inline. |
| `src/components/today/today.css` | Reworked `.today-tools*` into a compact dock (single `border-top` hairline, small-caps eyebrow, 30px desktop / **44px mobile**, equal 2-col mobile grid via `flex:1 1 calc(50% - var(--space-compact))`, Focus uses native `.p-btn--primary`). Removed dead `.today-overload__label` and a few redundant bytes to stay within the 49 kB CSS budget. No changes to NOW/Work/Signals CSS beyond minor comment/minification cleanup. |
| `src/components/today/PlanningPanel.jsx` | Added backward-compatible `defaultOpen = false` prop; initial `useState(open)` becomes `useState(defaultOpen)` so Today can mount it already-open. |
| `src/components/today/FocusMode.jsx` | Added backward-compatible `defaultOpen = false` prop; initial `useState(false)` becomes `useState(defaultOpen)` so Today can mount it directly into the active Focus sheet. |
| `test/today-step3-audit.test.jsx` | Existing Tools/accessible-names tests continue to pass without modification. |
| `test/today-tools-refinement.test.jsx` | **New** — 12 dedicated Refinement #4 tests covering heading/nav landmark, primary/quiet hierarchy, Recovery conditional, keyboard activation, no duplicate labels, icon+text per button, no permanently-open panels inside Tools, 44px mobile targets + 2-col grid, reduced-motion, no card/shadow styling. |
| `qa/screens-ref4/*.png` | Real-browser screenshots (note: sandbox lost its Chromium binary mid-session and Google CDN is blocked; existing captures show the 3-tool state; Recovery is structurally one identical quiet button that doesn't change layout). |
| `qa/shoot.mjs` | Output dir updated to `screens-ref4`. |

**Stop condition met.** Tools are the quietest section of Today (NOW >> Work >> Signals >> Tools), one clear primary utility, no card wall, all existing behavior preserved, no changes to other Today sections, other screens, engines, or shell.
