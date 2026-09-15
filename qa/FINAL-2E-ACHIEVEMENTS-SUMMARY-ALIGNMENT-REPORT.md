# FINAL 2E — Achievements / Insights Summary Pill Alignment — Report

**Branch:** `arena/01a08bf2-habbit-trackerrr`
**Parent:** `94fc5d7` (FINAL 2D icon-only a11y sweep)
**Date:** 2026-09-15

## Summary

Addressed **P1 #5** from the cross-domain audit: the "X/Y earned · next: …" pill on the Insights Overview Achievements pillar was using the legacy `achievements(state)` from `src/lib/stats.js` (a hardcoded `BADGES` array of ~7 badges that pre-dates the 7D identity-tier achievement system), while the actual Achievements screen uses `achievementSummary(state)` from `src/lib/achievements.js` (17 badges across bronze/silver/gold/diamond tiers). The two sources could (and did) diverge, causing the Insights pillar to understate total badges and the "next:" label to reference an obsolete badge id.

Fix: switch the Insights pillar to use `achievementSummary(state)` (the same source AchievementsScreen uses). Also added a deterministic id-based tie-break to `achievementSummary.nextUp` sort so the "next:" pill and the "In reach" card list on Achievements always agree (P2 #15).

## Files changed

| File | Δ | Purpose |
|---|---|---|
| `src/screens/InsightsScreen.jsx` | +4 / −1 | Import `achievementSummary`; compute `ach = useMemo(() => achievementSummary(state))`; replace `best.badges.filter(b=>b.earned).length / best.badges.length` and `best.next?.label` with `ach.unlocked / ach.total` and `ach.nextUp?.[0]?.title`. |
| `src/lib/achievements.js` | +4 / −1 | Add deterministic id tie-break to `nextUp` sort when progress values tie, so Insights "next:" and Achievements "In reach" list always match. Added an explanatory comment. |
| `test/achievements-summary-2e.test.jsx` | new (82 lines) | 3 tests — pillar numbers match `achievementSummary()`, pillar differs from legacy `achievements()` counts (sanity that the swap actually happened), deterministic tie-break, Achievements screen smoke. |

## Behaviour

- Pill now correctly shows `{unlocked}/{total}` from the 7D achievement system (17 total badges at time of writing, vs the 7 from the legacy BADGES list).
- "next:" now surfaces `nextUp[0].title` (from `achievementSummary`) — matches the top card in Achievements' "In reach" section.
- `best = achievements(state)` is KEPT for the `best.best` (all-time best streak) signal strip; that return field is still valid and unrelated to the achievements catalogue. We did not touch it to avoid risk.

## Tests

- **New:** `test/achievements-summary-2e.test.jsx` — 3 tests, all passing.
- **Existing:** full smoke; the pre-existing insights habit-patterns rate failure is unrelated (documented in 2B/2C/2D reports).

```
✓ test/achievements-summary-2e.test.jsx (3 tests)
```

## Lint / diff check / build

- `npm run lint` ✅ clean
- `git diff --check` ✅ clean
- `npm run build` ✅ passes — `Perf budget OK — initial JS 225.0 kB gz, CSS 47.9 kB gz, three lazy-only.`

## CSS before/after

| Build | Initial CSS (gz) | Δ |
|---|---|---|
| 2D baseline | 48,633 B | — |
| **2E final** | **48,633 B** | **0 B** (no CSS touched) |

Headroom remains **7,687 B** vs 56,320 B ceiling.

## Responsive QA / visual QA

- No visual/visual-style changes. The pill renders the same DOM with updated numbers (e.g. "3/17 earned" instead of "3/7 earned").
- No layout shift possible (same element, same class, same layout).

## Accessibility

- No new interactive elements introduced; the existing `<Link>` to Achievements has visible text ("Achievements" label + sub-pill description), so it is not icon-only and remains keyboard accessible. The 2D icon-only sweep still applies.

## STOP after 2E

Per scope, halting here. NOT starting 2F (Calendar/Week polish), 2G (P2 cleanup), or deploying. Unrelated unstaged files from prior phases (App.jsx, nav.js, AchievementsScreen, InsightsScreen unrelated hunks, RecordScreen, insights.css, spatial.css) intentionally NOT staged.
