# RELEASE BLOCKED

**Date:** 2026-09-15 (UTC) · **Task:** Final production release of the verified release candidate
**Verdict:** The release candidate itself verifies clean, but **production promotion was halted** because the deployment workflow's own test gate provably fails at the release tree. `main` was **not** modified. No force-push, no reset, no history rewrite, no source changes.

---

## 1. Release commit

| Item | Value |
|---|---|
| Verified release commit | `0d7bede4c69f4c450847b6e89c6237a55453c87e` (`0d7bede` — "FINAL PHASE 2 complete: land orphaned 7D Achievements/Record/Nav/Spatial work") |
| Where it lives | Tip of `origin/arena/01a08bf2-habbit-trackerrr` — **intact** |
| Feature branch synced? | Yes — remote tip == expected release SHA (verified via `git ls-remote`) |
| Working tree at candidate | Clean; `git diff --check` clean |

## 2. Repository / branch state at decision time

| Ref | SHA | Note |
|---|---|---|
| Local HEAD (session branch `arena/01a0a67c-habbit-trackerrr`) | `7cbdab9` | = `main`, clean |
| `main` / `origin/main` | `7cbdab9d583f5bc9841d6d87b9c8683f1ca29370` | **Untouched** — still the pre-release commit (PR #34 merge) |
| `origin/arena/01a08bf2-habbit-trackerrr` | `0d7bede` | Release candidate |
| Fast-forward feasibility | ✅ possible | `merge-base(main, 0d7bede) = 7cbdab9`; 17 commits `main..0d7bede`, 0 commits `0d7bede..main`. No divergence. |

Note: another newer session branch `arena/01a0a0dc-habbit-trackerrr` (`df51151`, "Step 7C Mind…") exists but does **not** contain `0d7bede` and was not part of this release (per instructions, the verified release commit is the only promotion candidate).

## 3. Release-candidate verification (all performed at `0d7bede`, detached worktree)

| Gate | Result |
|---|---|
| `npm run build` | ✅ pass — "Perf budget OK", build proof stamped `0d7bede4c69f…` (104 SHA-256 checksums) |
| Initial JS | **225.0 kB gz** raw 776.37 kB (`index-*.js`) — matches audit ≈225 kB |
| Initial CSS | **47.9 kB gz** build-proof measurement (49.06 kB gz by Vite's estimator ≈ audit's 48,673 B) — under the 56,320 B ceiling ✅ |
| Lazy chunks | ✅ preserved — `AnalyticsLab` 14.31 kB gz (double-lazy), `WorldScene` 130.52 kB gz (three, lazy-only), `OmniPanel` 13.20 kB gz, ~30 further route chunks incl. `GoalsScreen`, `InsightsScreen`, `MindScreen`, `HabitDetailScreen`, `WorkScreen` |
| `npm run lint` | ✅ 0 problems (exit 0) |
| `git diff --check` | ✅ clean |
| Route smoke (local `vite preview` of release build) | ✅ 25/25 URLs → 200 + valid SPA shell, incl. `#/`, `#/today`, `#/habits`, `#/work` (+ 4 views), `#/goals`, `#/insights` (+ mind/advanced), `#/analytics-lab`, detail routes |
| Asset smoke | ✅ `index-*.js`, `index-*.css`, `sw.js` all 200 |
| Secret exposure | ✅ no `service_role` anywhere in `dist/`; no `.env`; client builds only from `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` (`src/lib/cloud/supabase.js`) |
| Build identity | ✅ `sw.js` = `aaru-habits-v7-0d7bede`, `<meta name="build-id" content="0d7bede">` |

## 4. Test baseline — and why promotion stopped

Two independent full `vitest run` executions at `0d7bede` produced the **identical, deterministic** result:

> **Test Files: 8 failed / 69 passed / 1 skipped · Tests: 67 failed / 1119 passed / 35 skipped**

Failing files (deterministic in sandbox, twice):

| File | Failures |
|---|---|
| `test/learningUI.test.jsx` | 17 |
| `test/executionUI.test.jsx` | 17 |
| `test/analyticsLab.test.jsx` | 17 |
| `test/app.test.jsx` | 8 |
| `test/adaptiveHome.test.jsx` | 5 |
| `test/work-entity.test.jsx` | 1 |
| `test/insights-overview-7b.test.jsx` | 1 |
| `test/habits.test.jsx` (habit-pattern) | 1 |

This matches the documented baseline families (app / adaptiveHome / habit-pattern / legacy analytics clones / "other documented"). Control experiment: the six files that exist on both commits were run at `main` (`7cbdab9`) in the identical sandbox → **141/141 pass, exit 0**; `work-entity` and `insights-overview-7b` do not exist at `main`. So the failure set is specific to the release tree and stable.

### The blocker — deployment gate

`Deploy to GitHub Pages` (`.github/workflows/deploy.yml`, **identical** on `main` and on the release branch — no diff) gates publication on a hard `npm test` step on the GitHub runner. It was **not safe to assume** CI would tolerate the 67 baseline failures, so the exact release tree was CI-verified first via PR #35 (`arena/01a08bf2-habbit-trackerrr` → `main`; merge-commit tree byte-identical to `0d7bede` because it is a fast-forward):

| Evidence | Value |
|---|---|
| CI run at release tree | **35015466013** — ❌ FAILURE (5m48s) |
| Failed step | **"Unit tests (vitest): failure"** → schema/build/e2e/deploy steps skipped |
| Sample failure annotation | `TestingLibraryElementError: Unable to find role="button" and name /^Lab$/` (same deterministic failure family reproduced locally) |
| Reference (green) | CI at `main` `7cbdab9`: run 34479999186 ✅ (Unit tests success); last successful Pages deploy run 34479999149 ✅ |

**Consequence:** pushing `main` to `0d7bede` now would trigger `deploy.yml`, which would fail at the unit-test gate — a red production deployment run with **no site update**. Per the task rules ("If new failures appear: STOP", "If deployment fails: STOP", "do not randomly edit application code"), promotion was **not** attempted.

## 5. Deployment / production state

| Item | Value |
|---|---|
| Deployment this run | **Not executed** (blocked by gate evidence above) |
| Production URL | https://aaru1yg.github.io/habbit-trackerrr/ — live and healthy, serving the **`7cbdab9`** (pre-release) build (login shell renders) |
| Deployed commit SHA (live) | `7cbdab9` (deploy run 34479999149, 5 days ago) |
| Auth/Supabase config at candidate | ✅ publishable-only client, injected at build time from repo secrets; release diff touches **no** files in `src/lib/cloud/`, `supabase/`, or `qa/live-migration.mjs`, so live auth/cloud behavior is unchanged from what production already runs |
| Post-deploy smoke | N/A — nothing was deployed |

## 6. Infrastructure issue (single, precise)

**`deploy.yml`'s zero-failure `npm test` gate is incompatible with the release's documented test baseline.** The release audit's own acceptance criterion was "no **new** test failures" (baseline failures tolerated), but the deployment workflow enforces "**zero** test failures". The audit's "READY TO DEPLOY" verdict therefore cannot survive the existing pipeline as-is: the gate fails deterministically at `0d7bede` on GitHub's runner (proven by CI run 35015466013).

## 7. Paths to unblock (no action taken — awaiting explicit approval)

1. **Make the deploy gate baseline-aware** (workflow-only change; matches the audit's "no new failures" criterion): run `npm test`, allowlist exactly the 67 documented baseline failures (or compare against a committed baseline file), fail on anything outside it. Nothing in `src/` changes; `main` would then fast-forward to a commit = `0d7bede` + this workflow change.
2. **Fix the genuinely new-looking failures** (e.g., the Insights "Lab" control / `work-entity` Overdue tone / `insights-overview-7b` deep link) so `npm test` is green — largest scope, touches release code, contradicts "do not modify" instruction without approval.
3. **Decision that baseline failures are acceptable to gate-skip** via `continue-on-error` on the test step only (weakest option — weakens the gate for future regressions too; not recommended).

## 8. Artifacts left behind

- PR **#35** (open, unmerged): CI evidence at the release tree; reusable as the gate for whichever unblock path is chosen.
- Preview server: release build (`0d7bede`) serving at port 4173 for manual inspection.
- Verification worktrees: `/home/user/verify-release` (`0d7bede`), `/home/user/baseline-main` (`7cbdab9`) with full vitest logs (`/home/user/vitest-full.log`, `/home/user/vitest-baseline.log`).

## 9. Final verdict

**RELEASE BLOCKED** — release candidate `0d7bede` builds, lints, and serves correctly with sizes matching the audit, but the existing deployment pipeline provably fails its own unit-test gate at that tree. `main` remains at `7cbdab9` (untouched, fast-forward still available). Blocked on one decision from the release owner: choose path 7.1 (recommended), 7.2, or 7.3.
