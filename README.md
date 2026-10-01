# Habit OS

A habit tracker that also holds the work and the goals those habits are *for*.

Everything lives in your browser. No account, no server, no sync — open it and
start. [Live app →](https://aaru1yg.github.io/habbit-trackerrr/)

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

- **Today** — a 3D core whose charge *is* your day's completion, a ranked
  "Next up" queue, today's habits, priority work, your week, and a one-tap mood
  log.
- **Habits** — split into due / not due today, with 30-day consistency scored
  only against the days a habit was actually scheduled.
- **Work** — projects and one-off tasks in one list, sorted by urgency, with
  pace tracking against the deadline.
- **Goals** — outcomes with their linked habits and work, and honest progress.
- **Insights** — a heatmap, weekday profile, streaks, mood correlation and
  milestones. Statistics refuse to appear until there is enough data to support
  them.

Plus **⌘K / Ctrl-K**, which searches everything and quick-adds with a prefix:
`h` habit, `w` work, `g` goal.

## Design

The interface is built on real depth rather than a flat page with shadows
painted on: a shared `--perspective`, a four-step elevation scale, and surfaces
that tilt and catch light as the pointer moves.

The centrepiece on Today is an actual **three.js** object — a layered core that
charges as the day fills. It is lazily loaded in its own chunk and never ships
to a device that can't use it well: `src/three/capability.js` returns `false`
for `prefers-reduced-motion` and for viewports under 480px, and those sessions
get a pure-CSS fallback that costs nothing. If the WebGL import fails for any
reason the component renders `null` and the layout is unaffected.

Two themes (midnight / daylight) and a **calm motion** setting that disables
every transform.

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
  ui/        icons.jsx  index.jsx          — every primitive, one file
  three/     Core.jsx (lazy)  capability.js
  app/       router.jsx  nav.js  Shell.jsx  CommandPalette.jsx
  features/  today/ habits/ work/ goals/ insights/ settings/
```

Three rules this codebase holds to:

1. **`core/` computes, `features/` renders.** Every statistic in the UI comes
   from a pure function in `src/core/compute.js` that is unit-tested in
   isolation. No screen does its own arithmetic.
2. **One primitive library.** `src/ui/index.jsx` is the only place a `Button`,
   `Surface` or `Sheet` is defined.
3. **One source of truth per value.** A project's progress comes from its tasks
   *or* its manual dial, never both — adding a task clears the dial.

State is a `useReducer` in `src/core/store.jsx`, persisted to `localStorage`
under `aaru.os.v5` and validated on every read.

### Data and migration

The schema (`src/core/schema.js`) is version 5. Older saves are migrated on
load: projects and assignments fold into one **work** list, milestones flatten
into the task checklist, and `routines`, `signals` and `focusLog` — scaffolding
nothing ever read back — are dropped.

Settings has **Export** (a JSON file you own) and **Import**. Import accepts
v4 backups and migrates them.

> **Note on cloud sync.** Earlier versions shipped a Supabase client, but it
> only ever activated with build-time credentials that were never set, so the
> deployed app was always local-only. Rather than keep dead auth UI, v5 states
> the truth plainly: this is browser storage, and Export is your backup. The
> previous SQL schema and RLS policies remain in git history if sync is ever
> wanted for real.

## Testing

```
test/compute.test.js   38 tests — scheduling, streaks, pace, correlation
test/store.test.js     23 tests — reducer invariants, normalisation, v4 → v5
test/app.test.jsx      13 tests — first run, check-in, navigation, ⌘K, a11y
```

The tests assert behaviour that is easy to get wrong and easy to regress: that
a streak doesn't break on an unfinished *today*, that consistency ignores days a
habit wasn't due, that deleting a habit also removes its check-ins and unlinks
it from goals, and that an empty app shows an invitation rather than a row of
confident zeroes.

`npm run test:visual` drives a headless browser over every route at desktop and
mobile widths, writes PNGs to `qa/shots/`, and fails on any console error.
