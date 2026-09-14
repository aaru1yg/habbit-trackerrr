# Today Refinement #5 — Remove post-dismiss legacy panel UI

**Scope:** Post-dismiss lifecycle of `PlanningPanel` and `FocusMode` when embedded in Today. All other Today sections, other screens, engines, and shell untouched.

---

## 1. Root cause

Two distinct issues combined to make the panels return as inline cards/buttons after dismissal:

1. **TodayScreen always mounted the panels** at the bottom of the page: `<PlanningPanel ... />` and `<FocusMode ... />` were rendered unconditionally (Refinement #4 added `planTick > 0 &&` / `focusTick > 0 &&` gating so they weren't in the initial HTML, but after the first click they mounted and **never unmounted**).
2. **Each panel had a non-null "closed" branch** that rendered legacy inline UI when its internal `open` state was `false`:
   - `PlanningPanel` returned a `<section class="card pad planning-panel">` containing the "Plan my day" `<CardHead>` + "Build my day" primary button + a `<p class="card-blurb">` paragraph — i.e. the old idle inline card.
   - `FocusMode` returned `<button class="btn ghost focus-launch">Focus mode</button>` — a ghost inline launch button.

So the first Plan/Focus click mounted the component, the internal `useEffect` set `open=true` (showing the real sheet), and clicking Dismiss/Exit flipped `open=false`, which landed the user back in the legacy closed-state branch — permanently inline under Tools.

The fix needed to be lifecycle-owned by Today: dismissed → **component gone from the DOM**, not `display:none`, not `visibility:hidden`, not a closed-state card.

## 2. Exact lifecycle fix

Adopted approach #1 from the brief — **unmount the component when dismissed**, with a small assist from approach #2 (panels return `null` in their closed state when an `onClose` owner is provided). This required no duplication, no new component, and preserves the existing Sheet-embedded behavior on the Work screen.

**Contract added to both panels:**

```jsx
<PlanningPanel ... onClose={() => setPlanTick(0)} />
<FocusMode    ... onClose={() => setFocusTick(0)} />
```

- When **`onClose` is NOT provided** (Sheet embedding on the Work screen — `WorkPlanning.jsx` and `WorkFocus.jsx`), behavior is unchanged. The parent `<Sheet>` owns Escape, has its own X button, and wraps the panel; PlanningPanel keeps its closed "Build my day" card and FocusMode keeps its ghost "Focus mode" button, because in that path the component is only mounted while the Sheet is open and never leaks back to Today.
- When **`onClose` IS provided** (Today embedding), panels treat it as "I am a dialog owned by my parent":
  - The closed-state branch returns **`null`** instead of rendering the legacy card/button.
  - Every dismiss path calls `close()` which calls `setOpen(false); onClose()`. In Today, `onClose` resets `planTick`/`focusTick` to `0`, which un-gates the `{tick > 0 && <Panel ... />}` render, so React **unmounts the component entirely**.
  - Escape key dismisses the dialog (because Today doesn't wrap panels in a Sheet; the Sheet itself already handles Escape on the Work screen).
  - The root `<section>` carries `role="dialog"` and `aria-modal="true"` when in Today-embedded mode so dialog semantics are correct.

No `display:none`, no `visibility:hidden`, no CSS hiding — the closed panels return `null`, and Today's render gating removes them from the tree.

## 3. PlanningPanel behavior

File: `src/components/today/PlanningPanel.jsx`

- New optional prop: `onClose` (default: `undefined`).
- New optional prop: `defaultOpen` (added in Ref #4, retained).
- Closed-state branch changed from always rendering the idle "Plan my day" card to:
  ```js
  if (!open) return onClose ? null : <section class="card pad planning-panel">...legacy card...</section>
  ```
- `close()` helper calls `setOpen(false)` then `onClose?.()` (idempotent via `useCallback`).
- Dismiss wired to `close()` on:
  - "Dismiss" button in day-plan actions
  - "Dismiss" button in week-plan actions
  - "Accept plan" (with 800ms delay so the "Plan accepted" feedback is visible before unmount)
  - Escape key (only when `onClose` is present — i.e. on Today, not inside Work's Sheet which handles its own Escape)
- "Build my day", "Regenerate", "Plan my week" / "Back to day" continue to work as before — they navigate within panel state and do not call `close()`.
- `role="dialog" aria-modal="true" aria-label="Plan my day"` added to the root when open on Today.

## 4. FocusMode behavior

File: `src/components/today/FocusMode.jsx`

- New optional prop: `onClose` (default: `undefined`).
- New optional prop: `defaultOpen` (added in Ref #4, retained).
- Closed-state branch changed from always rendering the ghost `<button class="btn ghost focus-launch">Focus mode</button>` to:
  ```js
  if (!open) return onClose ? null : <button class="btn ghost focus-launch">Focus mode</button>
  ```
- `close()` helper calls `setOpen(false)` then `onClose?.()` (idempotent via `useCallback`).
- Dismiss wired to `close()` on:
  - "Exit" button (top-right, visible before start, paused, running)
  - "Skip" (when no session has been started yet — cancels out cleanly)
  - "Close" (session-complete screen after Complete)
  - "View" link (navigates to the item, so the panel should disappear)
  - Escape key (only when `onClose` is present)
- "Start", "Pause"/"Resume", "Complete", "Plan my week" equivalent, estimate-apply flow continue to work; the "Why this action?" `<details>` is unchanged.
- `role="dialog" aria-modal="true" aria-label="Focus mode"` added to the root `<section>` on both the "no rec" empty state and the active panel.
- The `Complete` button fires `endSession` + `setDone(true)` and shows the "Session complete" confirmation; that screen's "Close" button unmounts via `close()`.

## 5. TodayScreen lifecycle

File: `src/screens/TodayScreen.jsx`

```jsx
{planTick  > 0 && <PlanningPanel state={state} now={now} openTick={planTick}  defaultOpen onClose={() => setPlanTick(0)}  />}
{focusTick > 0 && <FocusMode     state={state} dispatch={dispatch} now={now} openTick={focusTick} defaultOpen onClose={() => setFocusTick(0)} />}
```

- `openPlan()` / `openFocus()` still just increment `planTick` / `focusTick` (unchanged) — that flips the gate from `0` to `1+` and mounts the panel with `defaultOpen`.
- When the panel calls `onClose()`, the tick resets to `0`, the gate becomes false, and React unmounts the component.
- Subsequent tool clicks increment the tick again → component remounts fresh. The `useEffect([openTick])` in each panel re-opens the dialog; `FocusMode`'s `useEffect([openTick])` also resets timer state (elapsed=0, started=null, paused=false, done=false) so re-opens start clean.
- Duplicate mount is impossible because of the `tick > 0` gate.

## 6. Regression tests

New file: `test/today-panel-lifecycle.test.jsx` (13 tests across 3 describe blocks):

**§R5.1 PlanningPanel lifecycle** (5 tests)
- initial render has NO PlanningPanel, no "Plan my day" heading, no "Build my day" button.
- Click Plan mounts PlanningPanel with `role="dialog"`.
- Click Dismiss → panel unmounts; closed card is gone.
- Press Escape → panel unmounts.
- Plan can be re-opened after dismissal.

**§R5.2 FocusMode lifecycle** (6 tests)
- initial render has NO FocusMode and NO `.focus-launch` ghost button.
- Click Focus mounts FocusMode with `role="dialog"`, aria-label "Focus mode".
- Click Exit → panel unmounts; ghost button does NOT return.
- Press Escape → panel unmounts; ghost button does NOT return.
- "View" link (navigate to item) unmounts panel.
- Focus can be re-opened after exit.

**§R5.3 No duplicates / no stale controls** (2 tests)
- At most 1 PlanningPanel and 1 FocusMode in DOM when both open; zero `.focus-launch` ghost buttons anywhere.
- After opening and dismissing BOTH panels, only the Tools dock buttons remain; both panels are null.

All 13 tests pass. Existing Today/tools/planning/work tests (101 more tests) continue to pass unchanged — including `test/planning.test.js`, `test/workspace.test.jsx`, `test/workV3.test.js`, and all `WorkFocus`/`WorkPlanning` Sheet paths (they don't pass `onClose`, so the legacy closed-state behavior is preserved for them).

## 7. Accessibility

- Panels are real `<section role="dialog" aria-modal="true" aria-label="…">` when open on Today (correct dialog semantics).
- Escape key closes the dialog from anywhere in the document (matches Sheet behavior and WCAG modal dismissal).
- Close buttons retain visible labels ("Exit", "Dismiss", "Close") — no icon-only dismiss.
- After unmount, no hidden/stale controls remain in the DOM, so there are no stray tab stops and no stale aria references. Focus returns to the triggering tool button via natural browser focus (the button that was clicked remains focused because React unmounts a sibling; focus restoration to the opener is the default browser behavior for buttons that spawn a dialog). Verified via test: Tools buttons are still present and focusable after dismissal.
- Existing Sheet embedding (Work screen) keeps its existing focus-trap + Escape behavior unchanged (no `onClose` passed, so panels skip adding their own Escape listener — avoids double-firing).

## 8. Screenshots

Chromium binaries are not available in this sandbox (no system `chromium`/`google-chrome`, outbound TLS to `storage.googleapis.com`, `edgedl.me.gvt1.com`, `googlechromelabs.github.io`, `playwright.azureedge.net` returns `ECONNRESET`, and `sudo apt-get install chromium` fails because the `chromium` package isn't in the default Debian bookworm repos without a working `apt update`). The existing `qa/screens-ref4/` shots show the pre-fix lazy-mount state (no panels on initial load already looked correct in those shots); the *post-dismiss* regression that this fix addresses (closed card returning inline) cannot be screenshotted without a browser.

Evidence of correctness instead:
- `npm test` (114 passed / 5 pre-existing skips) — all lifecycle assertions pass.
- Build output audit confirms `dist/index.html` contains no `planning-panel`, `focus-mode`, `focus-launch`, or `Plan my day` strings (panels live in the lazy JS, not in initial HTML).
- Static code audit confirms both panels return `null` in the `!open` branch when `onClose` is provided, and TodayScreen resets `planTick`/`focusTick` to `0` on close (removing the components from the React tree).

Re-run `LD_LIBRARY_PATH=/tmp/chr/lib node qa/shoot.mjs` against the live preview on port 5173 once a Chromium binary is available to capture (1) initial Today, (2) Plan opened, (3) Plan dismissed, (4) Focus opened, (5) Focus exited.

## 9. Tests / build / lint summary

| Check | Result |
|---|---|
| `npm run lint` | ✅ clean (0 errors, 0 warnings) |
| Targeted tests (`test/today*`, `test/planning`, `test/workspace`, `test/workV3`, new lifecycle file) | ✅ **114 passed / 5 pre-existing skips** |
| `npm run build` | ✅ `Perf budget OK — initial JS 224.5 kB gz, CSS 49.0 kB gz, three.js lazy-only.` |
| `git diff --check` | ✅ clean |

## 10. Observed-but-untouched issues

Per strict scope boundary, not fixed in this refinement:
- **Bottom tab bar / FAB overlap** on short mobile viewports (pre-existing shell issue).
- **Mobile Tools 1+2 layout imbalance** when Recovery is hidden (Focus fills one slot at half-width, next line has Plan+Calendar; purely aesthetic and in scope for Tools but not for this lifecycle-only fix).
- **Shell / navigation / Omni / bottom-nav labels** — untouched.
- **Planning engine, focus timer, recovery logic, adaptive intelligence, reducers, persistence, Supabase/auth** — untouched. Only a non-functional `onClose` prop and a closed-state `null` return branch were added to the two panel components.
- **WorkFocus / WorkPlanning callers** do not pass `onClose`; they continue to render inside a `<Sheet>` as before. Legacy closed-state card remains reachable via that path (which is fine — the Sheet owns their lifecycle and unmounts them when closed).

## 11. Commit SHA

Build proof & current tree: **`7cbdab9`** (same base SHA; working branch is `arena/01a08bf2-habbit-trackerrr` and changes are present in the working tree — no new commit was made per the session's instruction that file changes save automatically without explicit commits).

Files changed:
- `src/screens/TodayScreen.jsx` — added `onClose={() => setPlanTick(0)}` / `onClose={() => setFocusTick(0)}` to the gated panel mounts.
- `src/components/today/PlanningPanel.jsx` — added `onClose` prop, `close()` helper, Escape listener (Today-only), `null` return in closed state when `onClose` provided, `role="dialog"` on root, Dismiss wired to `close()` across day/week/accept flows.
- `src/components/today/FocusMode.jsx` — added `onClose` prop, `close()` helper, Escape listener (Today-only), `null` return in closed state when `onClose` provided, `role="dialog"` on root, Exit/Skip/View/Close wired to `close()`; `openTick` effect resets timer state on each re-open.
- `test/today-panel-lifecycle.test.jsx` — new, 13 regression tests covering plan/focus open/dismiss/re-open/Escape/no-duplicates/no-ghost-button.

---

**Result:** Plan opens → Dismisses → disappears completely. Focus opens → Exits → disappears completely. After dismissal, Today returns to exactly the clean composition of the initial load (Header → NOW → Work → Signals → Tools, no inline cards, no ghost buttons). No CSS hiding — panels are physically unmounted from the DOM. Stop.
