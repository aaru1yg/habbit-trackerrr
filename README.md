# Habit OS

A habit tracker that also holds the work and the goals those habits are *for*.

Local-first: it opens straight into today's habits and works fully offline with
no account. Signing in is optional, and adds encrypted-in-transit backup and
sync across your devices. [Live app](https://aaru1yg.github.io/habbit-trackerrr/)

---

## What it is

Most habit trackers make you check boxes and then leave you to guess what the
boxes were for. Habit OS keeps three things in one place and wires them
together:

| Noun | What it is | Example |
| --- | --- | --- |
| **Habit** | Something you repeat on a cadence | *Read 20 pages, daily* |
| **Work** | Something you finish once | *Dissertation ch. 3, due Friday* |
| **Goal** | The outcome the other two serve | *Submit the thesis* |

A goal's progress is computed from the habits and work linked to it, so the
number is earned rather than typed in. **Today** reads across all three and
ranks what to do next by deadline pressure and by which streaks are at risk.

## The five screens

- **Today**: the date, the day's completion as a figure and a cell per habit, a
  ranked "Next up" queue, today's habits, priority work, your week, and a
  one-tap mood log.
- **Habits**: split into due and not due today, with 30-day consistency scored
  only against the days a habit was actually scheduled.
- **Work**: projects and one-off tasks in one list, sorted by urgency, with
  pace tracking against the deadline.
- **Goals**: outcomes with their linked habits and work, and honest progress.
- **Insights**: a heatmap, weekday profile, streaks, mood correlation and
  milestones. Statistics refuse to appear until there is enough data to support
  them.

Plus **⌘K / Ctrl-K**, which searches everything and quick-adds with a prefix:
`h` habit, `w` work, `g` goal.

## Design

Light-first, editorial and typographic. Warm paper, ink, hairline rules, and
colour used only where it carries meaning.

- **One accent.** A deep pine-teal marks the active view, a completed check and
  a progress fill. Nothing else is tinted, so the accent always means
  something.
- **A status ramp, not a palette.** Brick, terracotta, ochre and the accent run
  overdue to urgent to at-risk to on-track, in that order, and appear nowhere
  else.
- **Serif for figures, sans for interface.** Source Serif 4 sets page titles,
  percentages and headline numbers; Inter does the work.
- **One icon system.** `src/ui/icons.jsx` holds every glyph, drawn on a 24-unit
  grid at a single stroke weight. There are no emoji anywhere in the product,
  and there is a test that fails if one reappears.
- **Charts state their ceiling.** A percentage series is plotted against 0–100
  with the top edge drawn, never auto-scaled to its own tallest bar. A flat
  week has to look flat.
- **Two themes**, light and dark, plus a transitions switch. The system
  `prefers-reduced-motion` setting overrides both.

What the interface deliberately does not do: gradients as decoration, glass,
perspective tilt, pointer-tracking effects, scroll-triggered animation, or
pill-shaped buttons applied by default. Nothing is invented for the user
either, so there are no scores, grades, levels or encouragement the data does
not support.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script | Does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Production build + artifact proof |
| `npm run preview` | Serve the built artifact |
| `npm test` | Vitest (engine + store + render) |
| `npm run lint` | ESLint |
| `npm run test:visual` | Headless screenshots into `qa/shots/` |

Node 22 (`.nvmrc`).

## Architecture

```
src/
  main.jsx App.jsx index.css
  core/      date.js  schema.js  compute.js  store.jsx
  design/    tokens · base · stage · ui · shell · features (.css)
  ui/        icons.jsx  index.jsx          every primitive, one file
  app/       router.jsx  nav.js  Shell.jsx  CommandPalette.jsx
  features/  today/ habits/ work/ goals/ insights/ settings/ legal/
```

Three rules this codebase holds to:

1. **`core/` computes, `features/` renders.** Every statistic in the UI comes
   from a pure function in `src/core/compute.js` that is unit-tested in
   isolation. No screen does its own arithmetic.
2. **One primitive library.** `src/ui/index.jsx` is the only place a `Button`,
   `Surface` or `Sheet` is defined.
3. **One source of truth per value.** A project's progress comes from its tasks
   *or* its manual dial, never both: adding a task clears the dial.

State is a `useReducer` in `src/core/store.jsx`, persisted to `localStorage`
under `aaru.os.v5` and validated on every read.

### Data and migration

The schema (`src/core/schema.js`) is version 5. Older saves are migrated on
load: projects and assignments fold into one **work** list, milestones flatten
into the task checklist, and `routines`, `signals` and `focusLog` (scaffolding
nothing ever read back) are dropped.

Settings has **Export** (a JSON file you own) and **Import**. Import accepts
v4 backups and migrates them. An account is a convenience, not a substitute for
a backup you hold yourself.

## Accounts and sync

Optional, and off until you sign in. The app is fully usable without one.

| | No account | Signed in |
| --- | --- | --- |
| Where data lives | This browser | This browser **and** your account |
| Works offline | Yes | Yes; changes sync on reconnect |
| Second device | Export and import a file | Automatic |
| Who can read it | You | You. Row level security scopes every row to one user id |

The whole surface is six files in `src/cloud/`:

| File | Responsibility |
| --- | --- |
| `config.js` | Reads the build-time config. The one honest answer to "can this build sync?" Imports nothing. |
| `client.js` | Dynamic-imports the SDK on first use, so it stays out of the first chunk. |
| `AuthProvider.jsx` | Sessions, sign-up, sign-in, recovery, account deletion. |
| `SyncProvider.jsx` | Pull on sign-in and on focus, debounced push, conflict retry. |
| `syncEngine.js` | The only code that touches `user_state`. Compare-and-swap writes. |
| `merge.js` | Reconciles two copies of the document. |

Three design decisions worth knowing:

**Writes are compare-and-swap, not last-write-wins.** Each write is conditional
on the `revision` it was based on. A write that lost the race matches zero rows,
and the client re-reads, merges and retries, so two devices editing at once
cannot silently drop one side's work.

**Deletions leave tombstones.** A merge unions by id, so without a record of
what was deleted, a device that still remembered a habit would resurrect it.
Deletions are recorded as `{ id: instant }` in the document and pruned after
180 days. An edit made *after* the deletion wins, because that is the later
deliberate act.

**The prompt only appears when there is a real choice.** If this device and the
account both hold data and the two documents differ, you are asked once whether
to combine, keep the device, or keep the account, with the real counts shown.
Any other case resolves itself silently, and the answer is remembered per
account per device.

`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are injected at build
time; both are public-safe. Without them the app builds into an honest
local-only mode that never renders a sign-in form. Setup, the SQL schema and
the RLS policies are in [`supabase/SETUP.md`](./supabase/SETUP.md).

## Testing

```
test/compute.test.js   38 tests — scheduling, streaks, pace, correlation
test/store.test.js     23 tests — reducer invariants, normalisation, v4 → v5
test/app.test.jsx      18 tests — first run, check-in, navigation, ⌘K, legal
                                  pages, design invariants, a11y
test/sync.test.js      37 tests — merge rules, tombstones, compare-and-swap
test/account.test.jsx  14 tests — both builds, and the promises each makes
```

Sync has two further layers of proof, because unit tests cannot establish
either one:

- `qa/verify-sync.mjs` drives the **real** Supabase SDK over real HTTP, in a
  real browser, against `qa/supabase-stub.mjs`. Two browser contexts act as two
  devices, so sign-up, adoption, concurrent edits and tombstone propagation are
  exercised end to end rather than asserted. Runs in CI on every pull request,
  with no credentials needed.
- `qa/verify-supabase.mjs` runs against the **real project** and is the only
  thing that can prove row level security is actually enforced, by attempting
  cross-user reads and writes that the database must refuse. Runs from
  `verify-supabase.yml`, which needs the repository secrets.
- `qa/live-smoke.mjs` checks the **deployed public site** in a real browser:
  that it is served, boots without console errors, is the commit that was just
  pushed, still offers the account system, and ships no `service_role` key. It
  never signs in, so it needs no credentials. It runs inside `deploy.yml`
  immediately after deployment, and weekly from `verify-live-site.yml`.

That last one exists for a specific reason. Building an artifact correctly and
serving it are different claims, and the gap between them is where this project
already lost its auth once. Checking that a build *contains* the credentials
cannot tell you the published site still offers a sign-in form.

```
SITE=https://aaru1yg.github.io/habbit-trackerrr/ node qa/live-smoke.mjs
EXPECT_ACCOUNTS=0   # for a deliberately local-only deployment
```

### Accessibility

`qa/audit-a11y.mjs` measures the built interface in a real browser rather than
trusting the token palette. Tokens are what we intended; this is what shipped.

| Check | Scope |
| --- | --- |
| Contrast | Every text node against its real rendered background, 11 routes x 2 themes, AA thresholds with the large-text rule |
| Focus | The actual tab order, asserting a visible indicator on anything matching `:focus-visible` |
| Touch targets | WCAG 2.2 AA 2.5.8 at 390px, applying the inline and spacing exceptions, plus a hit test for anything painted over |
| Overflow | Horizontal overflow at 320px and 390px, which is how an unbreakable string gets caught |

```
node qa/audit-a11y.mjs        # needs the dev server on :5173
```

Current result: 1018 text nodes, 44 tab stops, 96 interactive targets and 22
route/width combinations, with no failures. It runs in CI.

Two notes on reading it. The touch-target check implements 2.5.8's exceptions,
because a version that does not reports twenty findings where four are real and
then stops being read. And it scrolls each candidate into view before measuring:
without that, the fixed mobile dock appears to cover the footer links, which it
does not once the page is scrolled to the end.

The tests assert behaviour that is easy to get wrong and easy to regress: that
a streak doesn't break on an unfinished *today*, that consistency ignores days a
habit wasn't due, that deleting a habit also removes its check-ins and unlinks
it from goals, and that an empty app shows an invitation rather than a row of
confident zeroes.

`npm run test:visual` drives a headless browser over every route at desktop and
mobile widths plus a dark-theme pass, writes PNGs to `qa/shots/`, and fails on
any console error.

## Deploying

The default build targets GitHub Pages at a project path:

```bash
GH_PAGES=true npm run build     # base = /habbit-trackerrr/
```

### A custom domain

Set `SITE_DOMAIN` and the build configures itself for a root-hosted site:

```bash
SITE_DOMAIN=habits.example.com npm run build
```

That one variable does five things, so there is no second place to keep in
sync:

| It writes | Why |
| --- | --- |
| `dist/CNAME` | What GitHub Pages reads to serve the domain |
| `base = '/'` | Assets resolve from the root, not a project subpath |
| `<link rel="canonical">` and `og:url` | One canonical address instead of two |
| `dist/robots.txt` with a `Sitemap:` line | Crawlers find the sitemap |
| `dist/sitemap.xml` | Lists `/`, `/privacy` and `/terms` |

A scheme or a trailing slash in the value is stripped, so
`https://habits.example.com/` and `habits.example.com` behave identically.
`SITE_DOMAIN` overrides `GH_PAGES`. With neither set the build is root-relative
and still writes a `robots.txt`.

`public/CNAME` is deliberately **not** committed: a stale or placeholder CNAME
takes a live Pages site offline, so the domain has to be stated at build time
by whoever owns it.

## Privacy and terms

`/#/privacy` and `/#/terms` are real pages, reachable from the footer on every
screen and from Settings. The privacy policy describes what the app actually
does, down to the `localStorage` key and the individual fields stored under it.
If the app ever gains a network call, an account or an analytics script, that
page has to change in the same commit. It did, when sync landed: the policy now
covers both configurations, and reads `cloudConfigured` so a build published
without credentials does not describe an account system it does not have.
