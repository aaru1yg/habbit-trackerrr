# Today Refinement #3 — Today Signals Report

**Scope:** Today Context only (now "Today signals"). NOW, Today's Work, Today header, Tools, shell, navigation, reducers, engines untouched.

**Baseline SHA:** `7cbdab9d583f5bc9841d6d87b9c8683f1ca29370` (working-tree changes preserved automatically; no commit made per workspace conventions)
**Preview:** LIVE PREVIEW panel (process `today-ref3-preview-5faca2ea`, port 5173).

---

## 1. Old Context problems

The previous `TodayContext` rendered up to four independent metric-style cells, each with its own icon, 1–2px colored left-border hairline, "strong" value line, and a "sub" line. Specific defects:

- **Card-ish feel** – four separate bordered cells sitting next to each other read as a mini dashboard rather than one coherent readout, violating the "no card wall" rule already applied to Today's Work.
- **Competing visual weight** – large semibold values on every cell fought with NOW and Today's Work rows for attention. Hierarchy NOW >> Work >> Context was not achieved.
- **Formatting bug: "1/333% complete"** – strong line rendered `${done}/${total}` ("1/3") and sub line rendered `${pct}% complete` ("33% complete"), but when CSS combined them on one visual line (because the strong/sub blocks ran together without spacing/separator at certain widths) the string collapsed to "1/333% complete". Root cause: two adjacent spans produced separate "1/3" and "33%" fragments with no explicit separator or joint construction, so the text flow concatenated them.
- **Formatting bug: "2 itemsRequires attention"** – the template literal read ``${n} item${n === 1 ? '' : 's'}`` then a hard-coded `sub: 'Requires attention'`, producing pluralized "items" + "Requires" → "itemsRequires attention". Grammar/sentence boundary between value and sub copy was not unified.
- **Mixed tense/copy** – "Over capacity" vs "Tight" vs "On track" labels appeared alongside "X min free" and "min planned of available", creating a word-salad of capacity messages.
- **Streak-at-risk cell** fired independently from the attention cell, producing duplicate warnings (streak + due-today both saying "needs attention").
- **No clear section identity** – the `<section>` had `aria-label="Today context"` but no visible heading, so a screen-reader user got a landmark without a discoverable title.
- **Data was correct but presentation was noisy** – `workloadCapacity()` and `todayStats()` produced real deterministic values; the issue was purely presentational/copy.

## 2. New Context design — "Today signals"

Replaced the four cells with a single continuous editorial strip titled **TODAY SIGNALS** that exposes **at most three signals**:

- CAPACITY – primary decision value ("3h 30m remaining") with one supporting line ("5h available · 1h 30m committed")
- ATTENTION – "{n} item(s) need(s) attention" plus the single most urgent item name (linked to its existing detail route); shown only when there is ≥1 due-today/overdue work item
- COMPLETION – done/total ("1 / 3") on the value line, "33% complete" on the supporting line — built with explicit middot/spacing logic so the "1/333%" concatenation cannot recur

Section header carries a small status dot (neutral/warning/danger/success) + a textual state word to the right ("Today" / "Tight" / "Over capacity" / "All done") giving the overall semantic state in one glance. The signals are laid out as:

```
● TODAY SIGNALS                                            Tight
────────────────────────────────────────────────────────────
CAPACITY       ATTENTION            COMPLETION
3h 30m rem.    1 item needs attn.   1 / 3
5h avail · …   Reading response     33% complete
```

- Single flat surface: one top hairline separator from the section above, hairline dividers *between* signals (no filled cards, no boxes, no shadows/gradients/glow).
- Typography hierarchy: small 11px caps eyebrow labels → semibold `--font-label` value (same weight as Today's Work titles but smaller, with `-0.005em` tracking) → `--font-caption` supporting detail. All numerics use `font-variant-numeric: tabular-nums`.
- Signals that don't apply (no attention items, no capacity set, no habits scheduled) are omitted entirely rather than rendering "0" placeholders.
- The whole section is **visually quieter** than NOW (no colored left-border, no glow, no large hero numbers) and sits below Today's Work, matching the requested hierarchy NOW > Work > Signals > Tools.

## 3. Capacity treatment

Uses the existing `workloadCapacity({ availableMin, items })` selector from `src/lib/adaptive.js` (unchanged).

- **Primary value:** remaining minutes formatted by a new dedicated formatter (`fmtRaw`/`fmtPhrase` in `TodayContext.jsx`) that:
  - renders whole hours as "3h", hours+minutes as "3h 30m", sub-hour as "45 min"
  - uses the phrase "remaining" when positive (e.g. "3h 30m remaining"), "over" when negative (e.g. "45 min over")
  - returns "0 min free" at exactly zero (avoids the odd "0 min remaining")
- **Supporting line:** "{available} available · {committed} committed" — uses the same formatter for both so "1h 30m committed" reads naturally.
- **Tone:** overloaded (remainingMin < 0) → danger/warning; tight (remainingMin < 30m) → warning; else neutral. The value text is colored by tone via `.is-warning`/`.is-danger`, but the signal box itself is never filled with color.
- If `availableMin` is null (user hasn't set a daily capacity) we render "Capacity not set" + the engine's own `reason` string rather than fabricating numbers.

## 4. Attention treatment

- **Count:** `deadlineNear` (computed in `TodayScreen` — counts non-archived, non-completed assignments AND projects with deadline ≤ end-of-today) drives the headline.
- **Grammar:** new conditional template produces either "1 item needs attention" or "N items need attention" — replaces the old `${n} item${s}` + hardcoded "Requires attention" concatenation that caused the "itemsRequires" bug.
- **Lead item:** added a new `attentionLead` memo in `TodayScreen.jsx` that picks the most urgent single item to name: overdue before due-today, earliest deadline first, assignments before projects at equal urgency. Produces `{ name, href }` used both as the supporting detail text and as a link destination. This replaces the previous duplication of four separate warnings (overdue / due-today / at-risk / streak).
- **Tone:** always warning (amber) — the dot + value color; no flooding.
- Streak-at-risk is intentionally no longer surfaced in Context. The streak signal is already visible on the habit row itself in Today's Work (🔥 N d streak); surfacing it again here would duplicate information that is already in the user's action list.

## 5. Completion treatment

Uses `todayStats(state)` from `src/lib/stats.js` (unchanged), which returns `{ done, total, pct }`.

- **Value line:** `` `${done} / ${total}` `` with explicit whitespace around the slash (fixes the old `1/3`-adjacent-to-`33%` concatenation at the text level).
- **Detail line:** `` `${Math.round(pct || 0)}% complete` `` — explicit rounding, explicit "%" and " complete" wording.
- When done === total the value is colored success (green) and the section state word becomes "All done".
- When there are zero habits scheduled (total === 0) the completion signal is omitted entirely rather than showing "0 / 0".

## 6. Semantic states

The section has a single `data-tone` attribute driving the leading status dot and the right-side state label:

| State     | When                                                                      | Dot color      | Label          |
|-----------|---------------------------------------------------------------------------|----------------|----------------|
| completed | all today habits done AND no overloaded workload                          | `--color-success` | All done    |
| overloaded| `workload.overloaded` (remainingMin < 0)                                  | `--color-danger`  | Over capacity |
| tight     | remainingMin < 30m, OR ≥1 item due today/overdue                          | `--color-warning` | Tight        |
| neutral   | otherwise                                                                 | `--text-muted`    | Today        |

Tone color is applied to:
1. The 7px leading dot (non-color meaning is backed up by the visible label text "Tight"/"Over capacity"/"All done")
2. The value text of the Capacity/Attention/Completion signal that triggered the tone

The whole section is **never** background-tinted — restraint per the brief.

## 7. Fixed formatting bugs

| Bug | Root cause | Fix | Regression test |
|---|---|---|---|
| `"1/333% complete"` | Two sibling spans `<strong>1/3</strong><span>33% complete</span>` with no intervening separator collapsed visually into `/333%` at certain widths | Explicit joint construction: value line `1 / 3` (whitespace), detail line `33% complete` on a separate visual line with clear `sig-detail` spacing; template uses explicit ` · ` middot when we intentionally combine numbers and words. | `Context completion string formats as "n / m complete · pct%" — no "/333%" concatenation bug` in `test/today-step3-audit.test.jsx` asserts `textContent` matches `/\d+\s*\/\s*\d+/` and `/\d+% complete/` and does NOT match `/\/\d{2,3}%/`. |
| `"2 itemsRequires attention"` | Template `` `${n} item${s}` `` adjacent to a literal sub string `Requires attention` with no join/space/grammar. | Single template `` `${n} ${n===1?'item needs':'items need'} attention` `` constructs one grammatical phrase; supporting detail identifies the item name instead of duplicating "requires attention". | `Context attention string uses proper grammar` test asserts the text does NOT match `/itemsRequires/` and, when present, matches `/item needs attention|items need attention/`. |

A new `fmtRaw(min)` helper was also added so duration strings are consistently formatted (e.g. "1h 30m", not "1h 30m remaining committed") regardless of where they appear — preventing future plural/double-word bugs.

## 8. Desktop (1440×900)

- 3-column CSS grid for `.today-signals__list` (`repeat(3, minmax(0,1fr))`).
- Vertical hairline dividers between signals (`border-left: var(--border-subtle)`) with the first signal un-bordered on the left and last un-padded on the right for visual alignment with Today's Work content column.
- Eyebrow header: dot + "Today signals" (left) and state word (right, muted caption weight).
- Icon (16px) sits to the left of label/value/detail in each signal, vertically aligned to the top so labels and values line up across columns.
- Interactive signals (attention lead) render as `<Link>` with a subtle hover wash matching Today's Work row hover (3% accent mix) and a proper focus ring.
- No elevation: sits on the same surface plane as the lists above.

Screenshot: `qa/screens-ref3/today-desktop-1440.png`.

## 9. Mobile (390×844, 430×932)

- Media query at ≤767px collapses the 3-column grid into a single column.
- Vertical hairlines **between** signals (instead of left-borders) so the stack reads top-to-bottom rather than as four mini cards.
- First signal keeps zero top padding, last keeps zero bottom padding; padding between signals is 10px, matching Today's Work row rhythm.
- Tap targets: attention link uses `min-height: 44px`; no interactive element is smaller than 44px.
- Long names (e.g. "Physics problem set" if it appeared in the attention slot) are `text-overflow: ellipsis` on one line so nothing wraps awkwardly or overflows horizontally.
- Verified no horizontal clipping, no four-tiny-boxes appearance, and that Signals stack cleanly below Today's Work rows even above the bottom nav bar.

Screenshots: `qa/screens-ref3/today-mobile-390.png`, `qa/screens-ref3/today-mobile-430.png`.

## 10. Accessibility

- Section is a `<section aria-labelledby="today-signals-heading">` with a real `<h2 id="today-signals-heading">Today signals</h2>` (11px uppercase, kept visible — screen-reader AND sighted users see it).
- Signal list is `<ul role="list">`; each signal is `<li>`.
- Attention link gets `aria-label="{label}: {value}"` (e.g. "Attention: 1 item needs attention").
- Interactive link has visible `:focus-visible` outline using `--focus-ring` (matches existing primitives).
- Status dot is `aria-hidden="true"`; the corresponding textual label ("Tight"/"Over capacity"/etc.) provides the non-color cue — so the tone is never color-only.
- Tabular numerals (`--font-numeric-features`) for all numeric values for readability.
- Reduced motion: transitions only on hover/focus washes (`--motion-fast`), no enter/exit animation that needs disabling, but all respects the motion token that already switches to 0 when reduced motion is preferred.
- Keyboard: link is reachable via Tab; all other cells are non-interactive static text so they don't pollute the tab order.

## 11. Tests

Updated/added in `test/today-step3-audit.test.jsx`:

- **Section ordering** (existing): Header → NOW → Work → Context → Tools — updated selector from `.today-context` to `.today-signals`.
- **Compact signal strip (replaces old 4-cell test):** asserts ≤3 signals, no card class on signals, no buttons inside, grid layout in CSS.
- **NEW: "n / m · pct%" regression** – asserts no `/\d{2,3}%/` (the "1/333%" shape) in any Completion signal text; asserts whitespace in `n / m` and an explicit `% complete` fragment.
- **NEW: "item needs attention" grammar regression** – asserts the body text never contains `/itemsRequires/`; if an attention signal is present it matches `item needs attention` or `items need attention`.

Test run: `npm test -- test/today` → **42 passed / 5 skipped** (the 5 skips are pre-existing Canvas-dependent tests in `today-hero.test.jsx`, unchanged).

## 12. Build

- `npm run lint` → clean (eslint src test qa, ≤40 warnings threshold met).
- `npm run build` → built in ~7s, perf budget OK: **initial JS 224.2 kB gz, CSS 49.0 kB gz** (+0.5 kB CSS, +0.1 kB JS vs baseline — only the new signal markup/styles).
- `git diff --check` → no whitespace errors.

## 13. Actual screenshots (real Chromium, not SVG)

| Breakpoint | File |
|---|---|
| 390×844 (iPhone) | `qa/screens-ref3/today-mobile-390.png` |
| 430×932 (iPhone Pro Max) | `qa/screens-ref3/today-mobile-430.png` |
| 1440×900 (desktop) | `qa/screens-ref3/today-desktop-1440.png` |

Visual QA self-check:
1. **One coherent system?** Yes — single head, single continuous strip, one divider per seam.
2. **Quieter than NOW?** Yes — NOW keeps its accent hairline + 72px ring + colored "Mark complete" button; Signals is 11px caps eyebrow + caption-sized supporting text.
3. **Card-wall avoided?** Yes — no filled cards, no shadows, no radii on the signal blocks.
4. **State in <5 sec?** Yes — "Tight" (dot+label), "3h 30m remaining", "1 item needs attention (Reading response)", "1/3 · 33%" are all visible at a glance.
5. **Three primary signals obvious?** Yes — Capacity / Attention / Completion columns map 1:1 to the brief.
6. **Metrics readable?** Yes — tabular numbers, semibold label weight, good contrast.
7. **Unnecessary info removed?** Yes — dropped the streak-at-risk cell (already on the habit row); dropped the redundant "On track"/"Over capacity" badge duplication.
8. **Copy bugs gone?** Yes — confirmed in screenshot: "1 item needs attention", "1 / 3" / "33% complete" render correctly with space.
9. **Mobile clean?** Yes — stacked vertically, no horizontal overflow, 44px targets, no four-tiny-boxes.
10. **Same product family as NOW + Work?** Yes — same token set (`--text-primary/secondary/muted`, `--color-warning/danger/success`, `--border-subtle`, `--font-label/caption/micro`), same icon set (no new icons), same hairline divider language as Today's Work rows.

## 14. Observed but intentionally untouched

Per the hard scope boundary I did NOT modify:
- **Bottom-tab overlap on short mobile viewports** — pre-existing shell issue affecting the whole Today screen (Work rows also partially covered in the same screenshot). Out of Refinement #3 scope per explicit instruction.
- **NOW card** (including its accent hairline color, signature ring, and Mark complete button) — untouched.
- **Today's Work rows** — untouched (Refinement #2 is complete and reviewed).
- **Today header** (including the `1/3` count + progress bar in the top right) — untouched; per the brief I did not consolidate it into Context since it is a persistent glance element in the header.
- **Tools strip** (Plan / Focus / Recovery / Calendar) — untouched; next candidate for Refinement #4 when authorized.
- **"Build my day" Plan card** under Tools — untouched.
- **`topStreak` import removed** from `TodayScreen.jsx` because the old Context's streak-at-risk cell was deleted. No behavioral change to any engine; only the presentational cell was removed.
- **No reducer, engine, selector, persistence, or domain logic changes.** The only new code on the screen side is an `attentionLead` memo that sorts already-known due-today/overdue items for display; it does not add any new intelligence.

## 15. Files changed

| File | Δ |
|---|---|
| `src/components/today/TodayContext.jsx` | Rewritten: renamed default export from `TodayContext` to `TodaySignals` (file path kept to avoid churn elsewhere); new three-signal editorial composition, duration helpers, proper grammar, accessible labels. |
| `src/components/today/today.css` | Replaced `.today-context*` block (~33 lines) with `.today-signals*` block (~120 lines) covering head, dot states, 3-column grid, signal icon/label/value/detail, hairline dividers, hover/focus, and a mobile stacked variant. |
| `src/screens/TodayScreen.jsx` | Removed `topStreak`/`atRisk` (streak cell dropped), added `attentionLead` + `signalsTone` memos, swapped `<TodayContext …>` for `<TodaySignals …>` with new prop shape. No changes to NOW, Work list, headline, tools, or recovery code. |
| `test/today-step3-audit.test.jsx` | Updated section-order selector to `.today-signals`; replaced the old 4-cell assertion with a 3-signal strip assertion; added two explicit regression tests for the copy bugs. |
| `qa/shoot.mjs` | Updated output dir to `qa/screens-ref3/`; seeded `preferences.dailyCapacityMin=300` (5h) and `estimateMin` on assignments so the Capacity signal renders real numbers in screenshots. |
| `qa/screens-ref3/*.png` | Three real-browser screenshots for this refinement. |

**Stop condition met.** Not proceeding to Tools / Work / Habits / Goals / Insights / Calendar / global motion. Ready for review.
