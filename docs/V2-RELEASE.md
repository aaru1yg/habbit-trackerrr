# V2 foundation — shipping audit

## What was recovered

The shipping session began at `e3901bdcf75284aea35024c7681c8abb8270de47` with a clean working tree. Fetching the full remote history found **five committed but unmerged V2 commits** on `arena/01a0762d-habbit-trackerrr`:

- `34bd6f4`: unified visual system and optimized art
- `debaaa3`: Habits/Details/Achievements routes and achievement rules
- `7c4a98e`: nested-route screenshot filenames
- `f7149cc`: Today priorities, goals, and timeline
- `afbb39a`: prior audit

There was no open PR for this work. `main` contained none of these five commits. GitHub Pages was configured for Actions from `main`; deployment `6291566696` and run `34025876604` recorded a successful deployment of **the old `e3901bd`**, not V2.

The five commits were fast-forwarded onto the shipping session's fixed branch, `arena/01a076ab-habbit-trackerrr`, preserving their history and design. No working-tree changes were discarded. An older divergent chart/touch-target branch was also inspected; its obsolete UI was not merged over V2.

## What was completed (release safety only)

- Scoped the habit-detail heatmap to the selected habit, rather than all habits.
- Fixed a consistency-score object being treated as a number (`NaN`); the corresponding achievement can now unlock.
- Removed the approximate sidebar badge rules; navigation and Achievements now share the real rules engine.
- Prevented a partial week from earning a full-week badge and used actual deadline times for on-time assignment achievements.
- Shared the work engine's deadline/pace semantics with Today, including overdue wording and date-only deadlines; omitted already-complete work from urgent priorities.
- Removed a reference to an artwork file that was never generated. Existing committed WebP art is preserved.
- Corrected remaining work-detail and narrow-screen touch targets without changing the visual direction, auth, cloud synchronization, or database schema.
- Updated E2E expectations for the intentional V2 theme names (including Aurora and legacy stored theme IDs) and the authoritative V2 content-width token. No tests were removed or disabled.
- Added 15 regression/safety tests, expanded the layout/contrast audits to new and detail routes, made audit failures exit nonzero, and enforced 44×44 targets (with subpixel rounding tolerance).

## Verification and deployment chain

The inherited baseline was reproduced: **171 unit/render tests**, **28 real-PostgreSQL/RLS checks**, and **209.26 KB gzip initial JS**. The inherited E2E suite did **not** pass unchanged: it still searched for the renamed “Ember” theme, then used a pre-V2 hardcoded content width. The old contrast tool omitted the new routes, and the old touch sweep accepted widths down to 24px; those limitations must not be represented as comprehensive AA/44×44 proof.

The release adds:

1. **CI**: unit tests → real database/RLS checks → build → existing E2E journeys → dedicated release UI checks → 18-route × 10-viewport layout audit → five-theme contrast audit.
2. **Pages**: unit/security gates before the production-configured build. Existing config-injection and build-identity guards are retained.
3. **`release.json`**: full commit SHA, build timestamp, and SHA-256 inventory of every shipped HTML/JS/CSS/font/art/service-worker file. The build scans for private Supabase keys, encoded service-role JWTs, private-key material and accidentally injected test credentials.
4. **Public verification**: after Pages finishes, the existing live-site workflow downloads that exact Pages artifact, runs real Supabase auth/persistence/RLS checks, repeats the migration journey, and visits the **public** URL in Chromium at **390×844 and 1440×900**. It compares every deployed byte with the artifact, checks all ten primary sections, creates habits/projects/assignments via reachable dialogs, checks below-fold content, and verifies cross-browser cloud persistence plus sign-out/re-login.
5. **Evidence**: `public-release-proof` Actions artifact contains screenshots and a JSON report. Credential-free screenshot previews and the release verdict are mirrored through Checks annotations because this sandbox cannot reach Pages or the artifact blob host directly. No screenshots or generated builds are committed.

`src/lib/cloud/**`, `src/components/auth/**`, and `supabase/**` remain unchanged. Test-account secrets are consumed only inside GitHub Actions. No service-role key is required.

A successful push or this document is **not** a claim that V2 is live. The release is only confirmed after the post-deployment public checks pass for the merged commit; the Actions run and `https://aaru1yg.github.io/habbit-trackerrr/release.json` provide that identity.

## Deliberately not expanded in this release

- Goals still use the existing project-based model; a separate goal entity is future work.
- The larger art-library plan remains partial. The eight category assets, two new empty-state assets, existing badges and other committed art are preserved. No new illustration campaign or redesign was started.
- `npm audit --omit=dev` reports **zero production dependency vulnerabilities**. The existing Vite/Vitest development toolchain has five advisories (including high/critical dev-server/UI advisories); a major tooling upgrade is deferred, and those development servers are not shipped to Pages.
- The unit harness emits existing jsdom canvas/scroll and React `act` warnings. Browser console/page/network errors are tested separately; a passing unit run is not used as a substitute for browser verification.
