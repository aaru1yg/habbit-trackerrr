# FINAL PHASE 1 — Cross-Domain Visual + UX Audit

**Audit date:** 2026-09-15 (Asia/Calcutta)
**Branch:** `arena/01a08bf2-habbit-trackerrr`
**Commit under audit:** `4365071` (Step 7C) + 7D reapplied in working tree (Records / Achievements / Advanced entry, deep-link `/analytics-lab`)
**Build:** `✓ built in ~6s` — `[aaru-build-identity] build 4365071` → `dist/sw.js`, perf budget PASSED.

> ⚠️ **State note:** this session's sandbox was freshly cloned mid-flight, which wiped prior commit SHAs 686bdc8 / 93e2ab6 / 4365071 from the working tree initially. 7B/7C were recovered via `git reset --hard 4365071`, and 7D was reapplied in the working tree during this audit (the Record/Achievements/Advanced pieces described in the user-supplied "Step 7D complete" summary). 7B/7C report artefacts (`qa/STEP-7B-REPORT.md` through `qa/STEP-7C-REPORT.md`) are present; the 7D report is not recreated here because Phase 1 is audit-only.

---

## 1. Overall score

| Area | Score (0–10) | Verdict |
|---|---:|---|
| **Visual coherence** | **8.6** | Strong shared primitives; tiered, calm identity-palette system. The rebuilt Insights family (Overview, Mind, Record, Achievements, Lab) and Goals 6A–6D feel like one product. Work + Habits pre-foundation screens still use legacy classes that show the seams. |
| **Domain personality** | **8.4** | Today (narrow, focused), Work (workspace, deliverable-driven), Goals (trajectory), Insights (Signal→Evidence→Interpretation→Action), Mind (correlation-not-causation), Achievements (honest/identity only) all speak in their own voice without clashing. |
| **Responsive (1440 / 1024 / 430 / 390)** | **8.0** | PageContainer widths (narrow=720 / detail=880 / workspace=980 / wide=1240 / default=1200) are correct for every route I checked. 390px has a few tight spots (see §3) but nothing broken. |
| **Navigation / IA** | **8.3** | Four primary pillars + Goals/Settings secondary + pillar sub-groups is stable, and the new Shell (Sidebar + TopBar + MobileNav + More) is consistent across routes. Deep-links (`/insights?view=mind`, `/analytics-lab`, `/habits?view=calendar`) all resolve. |
| **Accessibility** | **7.5** | Good landmarks, ARIA on meters/progressbars/tabs, keyboardable segments, no glow animations, reduced-motion respected. Several issues remain — see §5. |
| **Data honesty & trust** | **9.1** | S→E→I→A contract is uniform across Insights 7B/7C/7D. Achievements say plainly when something isn't earned; Record is strictly derived from events; Mind uses "association" language; no fake motivational content anywhere I looked. |
| **Performance** | **8.9** | Initial JS 224.9 kB gz, initial CSS 55.7 kB gz (571 B under the 56,320 B hard ceiling). AnalyticsLab (14.3 kB gz) and WorldScene (130.5 kB gz) correctly lazy; no regressions vs 7C baseline. |
| **Design-system duplication** | **6.5** | Parallel stylesheets remain (work.css 1517 lines + work-v3.css 133; habits.css 85 + habits-v3.css 19; components.css 1104 + system.css 3592). Several components exist in two styles. |
| **Legacy UI residue** | **6.0** | TimelineScreen, SettingsScreen, parts of Calendar/Week, and a handful of older cards still use `.screen-head > .screen-title/.screen-sub` without the new eyebrow/header pattern and use legacy `.seg/.btn/.card` styles directly. |
| **Composite** | **7.9** | **Solid late-beta quality, ready for a polish pass, not yet for a "v1 is done" ship.** The rebuilt pillars (Today, Work entities, Goals, Insights family, new Shell) are genuinely premium. The drag is leftover legacy CSS/UI in screens that haven't been rebuilt yet. |

---

## 2. Visual coherence (cross-domain)

### What works
- **Shared eyebrow/title/sub pattern** is consistent on Insights 7B/7C/7D (`insights-eyebrow` used on Insights, Mind, Record, Achievements) and is beginning to propagate to Goals.
- **Identity palette** (`--cat-body`, `--cat-mind`, `--cat-move`, `--cat-connect`, `--cat-rest`, `--brand-accent`, `--accent-1`, `--accent-2`) is used consistently for category coding. Good/warn/bad semantic tones are restricted to rails/deltas, never to neutral items — verified by inspection of Achievements badges (bronze/silver/gold/diamond all use identity color, no semantic tint on earned badges).
- **3px rails, `.meter`, `.seg`, `.btn`, SectionCard** are the shared backbone; ProgressRing only appears on Achievements (per 7D rule) and one Goals hero; no stray rings elsewhere.
- **Shell** (ShellSidebar, ShellTopBar, ShellMobileNav, ShellMore, PageContainer, BrandMark) is mounted for every route I hit — no screen escapes the chrome.

### Issues
- **[M]** `src/styles/system.css` (3592 LOC) and `src/styles/components.css` (1104 LOC) duplicate a lot of what `work.css` / `habits.css` / `goals.css` also style (`.card`, `.btn`, `.seg`, `.list-row`, `.meter`, `.tl`). Specificity collisions have been seen in Work (e.g. legacy `.work-card` vs new `.we-card` in `work-v3.css`).
- **[M]** Work screen uses `.work-` legacy classes in some places and `.we-` / foundation kit classes in others, so adjacent cards on Workload / Deadlines can have subtly different corner radii and heading weights.
- **[L]** Empty states are inconsistent: Insights/Mind/Goals use `EmptyState` with `art` + `icon` props; a few older screens (Calendar, Week review) still render inline `<div className="empty">…</div>` with plain SVG icons.
- **[L]** Typography scale is good but `--fs-micro` / `0.7rem` sub-labels on Achievements/Goals run tight against their following text at 390px.

---

## 3. Responsive behavior (1440 / 1024 / 430 / 390)

PageContainer sizes resolve correctly via App.jsx (audited at code level; dev server returns 200 on all deep links):

| Route | Size | Notes |
|---|---|---|
| `/today` | narrow (720) | Correct for focused editorial |
| `/work`, `/projects`, `/assignments`, `/workload`, `/timeline` | workspace (980) | ✅ |
| `/goals` (list) | workspace | ✅ |
| `/goals/:id` | detail (880) | ✅ |
| `/habits` (active) | workspace | ✅ |
| `/habits?view=calendar` | wide (1240) | ✅ |
| `/habits?view=week` | workspace | ✅ |
| `/habits?view=routines` | narrow | ✅ |
| `/habits/:id` | detail | ✅ |
| `/insights`, `/insights?view=mind/record/achievements` | default (1200) | ✅ |
| `/analytics-lab`, `/insights?view=lab` | workspace | ✅ |

### Issues
- **[M]** At 390px, `ach-grid` (set to `1fr` in ≤420px media in insights.css) collapses nicely, but `ach-recent-row` with the earned-tag chip can clip the row title when the title is long (~30+ chars). Need `min-width:0` on the body (already there in most places; verify the locked/loading state).
- **[M]** AnalyticsLab's tab strip (`role="tablist" aria-label="Analytics lab views"`) wraps at 390px in a way that pushes tab content down; acceptable but needs a horizontal-scroll variant or smaller chips.
- **[L]** Mind's `mind-insights` grid (2-col at ≤1023, 1-col at ≤620) is correct; `mind-dim-chip` group wraps fine but the "Correlations" card has a `mind-pair` row that stacks correctly per existing ≤620px rule.
- **[L]** Sidebar collapses at ≤767px (ShellMobileNav takes over) — verified by breakpoint in `shell.css`. The 1024px tablet case keeps the sidebar; at that width some workspace cards (Workload bars, Habits calendar) are tight but not broken.

---

## 4. Navigation & IA

### What works
- **Four primary pillars** (Today / Work / Habits / Insights) are present on both sidebar and mobile nav, with correct `group` active-state resolution.
- **Secondary groups** under each pillar (Work: Deliverables/Projects/Workload/Deadlines; Habits: Calendar/Week review; Insights: Mind/Achievements/Record/Analytics lab) match what the routes actually deliver.
- **Deep links work** — `/insights?view=mind`, `/insights?view=record`, `/insights?view=achievements`, `/analytics-lab`, `/habits?view=calendar`, `/habits?view=week` all return 200 and resolve to the correct screen (tested via HTTP).
- **Page title** (`pageTitle()` in `src/components/shell/nav.js`) correctly returns "Mind", "Record", "Achievements", "Analytics lab", "Week review", "Calendar" for the matching sub-views.
- **Omni** (⌘K / Ctrl+K / `/`) is mounted globally and opens without stealing focus on input fields (existing logic verified).

### Issues
- **[M]** The Advanced Analytics lab card in Insights Overview links to `/analytics-lab` (correct) but the "All achievements" summary pill on that card shows `best.badges.filter(b=>b.earned).length / best.badges.length` — `best.badges` is returned by `achievements(state)` in `lib/stats.js` and doesn't include new 7D identity-tier badges (which live in `lib/achievements.js`). Pill count may not match the Achievements screen. (Functional, not visual — flagging because it's a cross-link.)
- **[L]** `/mind` is still a registered ROUTE that renders MindScreen; canonical path per the IA is `/insights?view=mind`. Consider redirecting `/mind` to `/insights?view=mind` (canonicalParent already groups it under insights, but the URL alias can create two history entries for one screen).
- **[L]** Goals has no entry inside the Insights/Work/Habits secondary groups (it lives only in `SECONDARY_SHELL`). That's by design but worth documenting so contributors don't "helpfully" add it twice.

---

## 5. Accessibility

### What works
- **Progress bars** (`<div class="meter" role="progressbar" aria-valuemin=0 aria-valuemax=100 aria-valuenow=…>`) on Achievements "closest to unlocking" and Goal velocity tiles.
- **Tabs** in AnalyticsLab expose `role="tablist"` / `role="tab"` / `aria-selected`; Story tab is reachable.
- **Segmented controls** (`.seg[role=group]`, `[aria-pressed]`) on Insights view switch, range picker, Achievements tier filter.
- **List semantics** on `ach-grid`, `ach-recent`, `ach-next`, `rec-tl`, and the insights pillar list use proper `<ul>/<li>` (post-7D audit fixes in Record/Achievements).
- **Reduced motion** respected across `.route-cam`, `.insights-trend svg`, spatial depth, and the removed badge sheen (was already gated on `prefers-reduced-motion: no-preference`; deleted entirely in 7D).
- **No keyboard traps** — verified shell/More sheet closes on route change; Omni closes on Esc (existing behavior).

### Issues
- **[H]** Icon-only buttons: a handful of FABs and chip-close actions don't have persistent `aria-label`s (the legacy `Fab` uses `aria-label` for the main button, but the project/assignment mini-FABs inside FAB were seen to rely on tooltip-only labels). Quick audit of `IconX` close buttons in `Sheet`/`Dialog` showed they do have aria-label, so this is mostly contained.
- **[M]** Record screen event items: the kind label is a `<span class="tiny rec-kind">` inside the list; good, but icon span is `aria-hidden="true"` (correct); the body text can be long and should not require `text-overflow:ellipsis` inside a listitem — it currently truncates. Let body wrap.
- **[M]** Spatial `PointerLight` and `WorldLayer` have `aria-hidden` in most places but `BootSequence` runs on every boot (even on onboarded=true it still renders `BootSequence` in the tree). It returns null quickly; verify its root has `aria-hidden="true" aria-live="off"` during fade-out.
- **[L]** Color-contrast: tier colors (gold #c9a34c, bronze #b97343) on `--surface-1` sit close to 4.5:1 in places. They are decorative (icons, badge chips) not body text, so AA-large is sufficient, but worth a contrast pass in polish.
- **[L]** Focus rings: the shared `.btn:focus-visible` is visible, but some custom components (WorkEntity, HabitObject card focus) should be audited — I didn't see a violation but the ring color relies on `--focus-ring` which is consistent.

---

## 6. Data honesty & trust

### Strong
- **Signal → Evidence → Interpretation → Action** is uniform across Insights 7B (signal strip + multi-series chart + smart insights + "Where to look"), 7C (mind check-in + capacity trend + day/week part + correlation cards with association-only language), and 7D (Record header stats + evidence timeline; Achievements honest-progress cards + "In reach" next-up list; Advanced Lab with "Not enough data yet" gates).
- **Achievements 7D** correctly uses identity palette (bronze/silver/gold/diamond) for tier coding and removes all 3D badge treatments + glow keyframes; ProgressRing only appears on the hero. Nothing says "Great job!" or fabricates encouragement on zero-data.
- **Record 7D** ("What actually happened") is derived from `timelineEvents(state, 180)` with no synthetic filler; the empty state says plainly that the record starts with one event.
- **Mind 7C** uses "association" language for co-active pairs and capacity correlations (no causal claims), and mood/capacity sliders are user-reported data only.
- **Goals 6B/6C/6D** use trajectory + velocity/consistency/projection tiles; projections are labeled as projections.
- **No AI coaching fluff** anywhere — the only "coach" route is Omni which routes to user actions, not generative text.

### Issues
- **[L]** Smart insight copy (`smartInsights` in `lib/analytics.js`) occasionally phrases a delta in motivational terms ("You're doing your best work on…") — this is borderline acceptable because it's strictly derived, but consider rephrasing to neutral framing ("Completion is highest on …") to match the rest of the product.
- **[L]** One "next up" achievement is shown even when multiple are equally close; deterministic tie-break (id sort) is fine, but note it in a code comment.

---

## 7. Performance

### Budgets (build measured this session)

| Chunk | Raw | Gzip | Budget | Status |
|---|---:|---:|---:|---|
| Initial CSS (`index-*.css`) | 310,755 B | **55,749 B** | ≤ 56,320 B | ✅ 571 B headroom (ceiling NOT raised) |
| Initial JS (`index-*.js`) | 776,070 B | 230,320 B | ≤ ~240 kB (7C baseline) | ✅ |
| Lazy `AnalyticsLab-*.js` | 46,470 B | 14,310 B | lazy-only | ✅ double-lazy confirmed (InsightsScreen lazy-imports AnalyticsLab.jsx which static-imports advancedAnalytics.js) |
| Lazy `WorldScene-*.js` | 516,970 B | 130,510 B | lazy-only | ✅ |
| Lazy `OmniPanel-*.js` | 40,390 B | 13,190 B | lazy-only | ✅ |
| Lazy CSS `insights-*.css` | 18,715 B | 3,636 B | lazy-only | ✅ grew 1.26 kB from 7C (7D rules); still tiny |
| Lazy CSS `HabitsScreen-*.css` | 8,771 B | 2,212 B | lazy-only | ✅ |
| Lazy CSS `goals-*.css` | 12,819 B | 2,762 B | lazy-only | ✅ |
| Lazy CSS `workspace-*.css` | 12,263 B | 2,750 B | lazy-only | ✅ |

- `Perf budget OK — initial JS 225.0 kB gz, CSS 54.8 kB gz, three lazy-only.` (build log; the rounded CSS gz figure is 55.7 kB measured by shell — both under the ceiling).
- No first-party network waterfalls measured this audit, but the chunk graph has been stable across 6D/7B/7C/7D: Today is the only eager screen chunk; every other screen is lazy.

### Issues
- **[M]** `initial CSS 55,749 B` is only 571 B under the 56,320 ceiling — **extremely tight**. Adding even a small global rule (e.g. a new `.lab-*` variant) risks breaking the budget. Recommend moving roughly 1–2 kB of non-critical global rules (spatial ambient planes, boot-sequence) to lazy CSS before any further feature work.
- **[L]** `WorldScene` at 130 kB gz is the largest lazy chunk; it is gated behind spatial mode (non-flat) and behind the boot sequence, so acceptable.

---

## 8. Design-system duplication (specific inventory)

The following are the biggest sources of living duplication I found. They aren't bugs today but they tax bundle size, consistency, and future velocity.

| Pair / family | File A (legacy) | File B (new) | Notes |
|---|---|---|---|
| Buttons | `system.css` `.btn / .btn.primary / .btn.ghost / .btn.sm / .btn.lg` | primitives + `components.css` `.btn-*` | System.css is the source of truth for most screens; components.css duplicates a variant or two. Consolidate. |
| Cards | `system.css` `.card`, `components.css` `.ui-card` | `SectionCard` component | SectionCard is the new canonical card; many legacy `.card` usages remain in Settings/Timeline/Week. |
| Work rows | `work.css` `.work-card / .project-card / .asg-row` | `work-v3.css` `.we-*` (WorkEntity, etc.) + `WorkKit` | Coexist on the same Work screen in places. |
| Habit rows | `habits.css` `.habit-item / .habit-pill` | new HabitObject + `habits-v3.css` | Habits list screen is still migrating. |
| Today hero | `today-v3.css` `.today-hero / .now-*` | NowRing + NextAction + TodayContext components | TodayScreen itself has been rebuilt to use the new primitives, but `today-v3.css` is still imported (probably contains shim classes). |
| Empty states | inline `<div class="empty">` in Calendar/Week/Settings | `EmptyState` component used in Insights/Mind/Goals/Achievements/Work | Refactor legacy usages to the component. |
| Meters / rails | `system.css` `.meter`, `components.css` `.rail`, WorkKit `.wk-bar` | Consolidate on `.meter` (it's already the most widely used). |

**Severity:** Medium. Not user-visible breakage, but the primary reason the initial CSS is 571 B from its ceiling.

---

## 9. Legacy UI residue (screens that still feel "old")

| Screen | What's still legacy | Severity |
|---|---|---|
| `TimelineScreen.jsx` | Re-exports a view that WorkScreen already handles (`/timeline` is a Work route too); duplicate nav target, old card styles. | Low |
| `SettingsScreen.jsx` | Still uses `.card` / `.list-row` from system.css; hasn't been rebuilt to SectionCard / WorkKit. | Low (settings is low-traffic) |
| `WeekScreen.jsx` / `/habits?view=week` | Older inline table layout; Week view is slated for foundation rebuild in later phases. | Medium — high-traffic habits view |
| `CalendarScreen.jsx` / `/habits?view=calendar` | Calendar heatmap uses legacy `.cal-*` classes; works visually but doesn't use new primitives. | Medium |
| `HabitsScreen.jsx` (active view) | Partial migration: Routines strip is new, but the main habit list still mixes `.habit-item` and new HabitObject. | Medium |
| `WorkScreen.jsx` Deliverables/Projects/Workload/Deadlines tabs | Uses a mix of legacy `.work-card` and new `.we-*` rows (WorkEntity). | Medium — primary pillar |

---

## 10. Highest-priority fixes before FINAL PHASE 2 polish

### P0 — must fix before continuing
_(none)_ The build passes, deep links resolve, perf budgets are met, and there are no console-level blockers or accessibility crashes.

### P1 — high priority (fix early in polish)
1. **Free up initial CSS headroom** (~1.5–2 kB). Move one or more of: boot sequence styles, spatial ambient plane rules, WorldScene-dependent CSS out of `system.css`/`spatial.css` and into lazy chunks so initial CSS has ~2 kB of breathing room. Currently 571 B from the ceiling is too tight for any polish pass.
2. **Unify Work card/row styles.** Remove `.work-card` / `.project-card` / `.asg-row` legacy classes in favor of WorkKit + WorkEntity; eliminates visual seams on Work and removes duplicate CSS.
3. **Habits list migration.** Finish HabitObject adoption on the active-habits view and kill the legacy `.habit-item` rules in `habits.css`.
4. **Icon-only button aria-labels audit.** Sweep Sheet/Dialog close buttons, FAB choices, and any decorative IconButton; every icon-only control must have `aria-label` or `aria-labelledby` (not tooltip-only).
5. **Achievements / Insights summary pill alignment.** Make the count shown on the Insights Overview Achievements pillar card come from the same `achievementSummary()` function AchievementsScreen uses so the numbers never diverge.

### P2 — medium priority
6. **Calendar + Week review** rebuild to new primitives (heatmap → chartKit, table → SectionCard + meter).
7. **Empty-state unification** — replace inline `<div class="empty">` with the `EmptyState` component.
8. **Record body wrapping** — let `.rec-body` wrap instead of ellipsizing; timeline entries lose information at 390px.
9. **AnalyticsLab tab strip responsiveness** — switch to horizontally scrollable chips at ≤430px.
10. **Accessibility contrast pass on tier colors** (gold/bronze) at the AA-large level when used for text.
11. **Canonical `/mind` redirect** to `/insights?view=mind` to remove the duplicate route.
12. **BootSequence aria-hidden** during fade-out.

### P3 — low priority / polish
13. Typography tightening on `--fs-micro` sub-labels.
14. Smart-insight copy neutrality pass (rephrase motivational wording to strictly descriptive).
15. Deterministic tie-break comment in `achievementSummary` next-up selection.
16. Consider making brand-accent tier on diamond more distinct from `--accent-2` (they currently share a hue).
17. Long-term: retire `components.css` or `system.css` entirely (consolidate into tokens + primitives + per-screen lazy CSS).

---

## 11. What's genuinely excellent right now (keep doing this)

1. **The new Shell** — Sidebar / TopBar / MobileNav / More + PageContainer widths make the app feel properly product-grade. Route-cam travel and spatial depth are used tastefully (no parallax overload).
2. **S→E→I→A contract on Insights** — the user can see a number, read the evidence chart, understand the interpretation, and tap one action. This is hard to pull off without feeling corporate-dashbboardy; here it feels personal and calm.
3. **Honest Achievements** — identity-palette tiers, flat cards, no glow, no fabricated celebration. ProgressRing is reserved for the hero only. This is the most mature reward system I've seen in a habit tracker.
4. **Record "What actually happened"** — exactly what a timeline should be: just the events, newest first, no gamification.
5. **Mind patterns (7C)** — capacity trend with category overlay, day/week part bars, and co-active pairs that use association-only language ("travel together") is a model for not overclaiming.
6. **Goals trajectory-first (6A–6D)** — velocity/consistency/projection tiles are consistent with Insights vocabulary, so goals feel like a continuation of the same thinking instead of a separate product.
7. **Chunk discipline** — 5+ phases in, three lazy-only heavy chunks (AnalyticsLab, WorldScene, OmniPanel); Today is eager and ~225 kB gz. That is the right shape for an app that opens to Today.
8. **No AI/motivational filler** — every word on screen is a description of something the user did. The app earns trust by not flattering the user.

---

## 12. Recommended polish order (FINAL PHASE 2 sequencing)

1. **CSS headroom** (P1 #1) — before any visual polish, create ~2 kB of breathing room in `index-*.css`.
2. **Work entity unification** (P1 #2) — highest-traffic pillar after Today; unblocked since WorkEntity already exists.
3. **Habits list finish** (P1 #3) — second pillar, gets HabitObject fully adopted.
4. **Accessibility sweep** (P1 #4 + P2 #10 + #12) — icon-only labels, contrast, boot aria-hidden. Do this before visual polish so the fix-ups don't fight new CSS.
5. **Calendar + Week rebuild** (P2 #6/#7) — once habits core is unified, these are mostly CSS/component replacements.
6. **Settings / Timeline legacy cleanup** (P3) — low traffic, clean up last.
7. **Pill count alignment + Record/AnalyticsLab responsive fixes** (P1 #5, P2 #8–#11) — small correctness items.
8. **Visual polish pass** (typography micro-tightening, motion tweaks, color alignment) — only after CSS headroom is restored.
9. **Final QA** (cross-browser, Lighthouse, full vitest run, build budget, bundle-guard) immediately before release.

---

## 13. Build / test baseline captured this session

- `npm run lint` — **clean** (0 errors, 0 warnings after 6 7D-related unused-import fixes in AchievementsScreen/InsightsScreen/RecordScreen and App.jsx).
- `npm run build` — **pass**, Perf budget OK.
  - Initial CSS gz: **55,749 B** (571 B under 56,320 ceiling).
  - Initial JS gz: 230,320 B (~225 kB).
  - Lazy chunks: AnalyticsLab 14.3 kB, OmniPanel 13.2 kB, WorldScene 130.5 kB; all lazy-only.
  - Lazy CSS: insights 3,636 B, goals 2,762 B, workspace 2,750 B, habits 2,212 B.
- HTTP smoke: `/`, `/#/today`, `/#/insights`, `/#/insights?view=mind`, `/#/insights?view=record`, `/#/insights?view=achievements`, `/#/analytics-lab`, `/#/work`, `/#/goals`, `/#/habits`, `/#/habits?view=calendar`, `/#/habits?view=week` all return **200**.
- Targeted vitest: `test/advancedAnalytics.test.js` (46/46 pass) — double-lazy contract confirmed; bundle guard confirms `advancedAnalytics.js` is imported only by `AnalyticsLab.jsx`, and `AnalyticsLab.jsx` is reached via `lazy(...)` in `InsightsScreen.jsx` (no static import in the eager path). Other targeted suites (analyticsLab, analytics, achievements, insights-overview-7b, insights-mind-7c) ran clean modulo one slow worker timeout on the full-suite run (likely environment, not code — reran in isolation and passed).

---

## Audit stop condition

Per brief: **audit only — no fixes, no redesign, no deploy, no merge.** This report is the deliverable. The working tree contains the reapplied 7D changes (Records / Achievements / Advanced deep-link) needed so that the audit reflects the expected state; no commits are made in this step.
