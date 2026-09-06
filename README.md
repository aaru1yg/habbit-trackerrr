# 🔥 Aaru · Next-Level Habit Tracker

> **V2 foundation release:** the unified Midnight/Aurora/Warm/Verdant/Light system, Today command center, Habits detail and Achievements work is preserved. See [the shipping audit](docs/V2-RELEASE.md) for recovered commits, validation, known scope limits and the public-build proof contract. The live build identifies itself at [`release.json`](https://aaru1yg.github.io/habbit-trackerrr/release.json).

Aaru's personal, next-level habit tracker. Dark, glassy, heavily animated, and packed with more graphs and features than any ordinary habit app. Your data lives entirely in your browser (localStorage) — no account, no server, just *you* and your streak.

## ✨ The vibe

- Quiet glass cards over a slowly drifting aurora + noise background
- Springy framer-motion animations with one unified motion language (cards, toggles, gauges)
- Animated counters, animated circular gauges, animated dash-offset donuts
- Celebrations reserved for moments that matter — a project reaching 100%, a streak
  milestone — never confetti per checkbox

## 🆕 What's new (v2)

- **Zero fake data.** The app starts completely empty — no seeded habits, no invented check-ins. Every number on screen is yours. (Storage key bumped to `v2`; the old demo data is simply ignored.)
- **Auto monthly calendar** 🗓️ — a Google-Sheets-style grid that builds itself for any month: colour-coded **Week 1…Week 5** bands, weekday + date headers, one glowing checkbox per habit per day, a per-day **Progress / Done / Not Done** roll-up, an animated completion sparkline and an **Analysis** panel with per-habit consistency bars (e.g. `56.67%`). Future days are locked; use the arrows to browse months.
- **Weekly Task Tracker board** — *Week Start Date* pill, a bar chart of done-per-day, a big overall donut (`7 / 44 Completed`) and one card per weekday with its own animated donut + task list you can tick straight from the board.
- **Mental State** 🧠 — log **Mood** and **Motivation** (1–10) daily → animated dual-line graph for the month + weekly **Mindset Score** bars.
- **Adding stuff is now obvious**: a Quick-Add bar at the top (type a name → Enter), one-tap preset chips (Wake up at 05:00, Gym, Cold Shower, …), **📅 New habit / 🚀 New project** buttons, and a floating **＋** button that follows you down the page.

## 📈 Graphs & visualizations

| Panel | What it shows |
|---|---|
| **Auto monthly calendar** | Self-building habit grid with weekly colour bands, per-day roll-ups, sparkline & per-habit analysis bars |
| **Task Tracker (week board)** | Weekly overview: bar chart, overall donut, one donut + checklist per weekday |
| **Mental State** | Mood vs Motivation line graph + weekly mindset score bars |
| **Today's completion** | Animated circular gauge + count of habits done |
| **Last 7 days** | Animated completion bar chart |
| **Consistency heatmap** | GitHub-style week grid (starts on Sunday), hover for details, 12/16/24-week toggle |
| **Master graph** | Every habit over time (per-habit lines or overall area), auto date-range select (7/14/30/90d), **auto date select** |
| **Master project pie** | Donut of all projects + big center average; click a slice for detail |
| **Custom project tracker** | Each project card has 10→20→30→…→100% step buttons, **plus its own graph and its own pie** |
| **Life balance radar** | Radar chart bucketing your habits into fitness/mind/learning/health/creative/social |
| **Habit types ring** | Pie of forever vs one-day vs short-term |

## 🎯 Added features

- **Daily habit OR project/activity** — choose at creation time.
- **Duration mode for every habit**: `♾️ forever`, `📍 one-day`, `📆 short-term` (with start & end dates).
- **One-day mode** for a single event (exam, deadline, one-off thing) — done/not-done on that day only.
- **Short-term project** with a deadline and a 0→100% progress slider in steps of 10.
- **Multi-value habits** (e.g. 8 glasses of water / 60 min of code) with −/＋ steppers and progress bars.
- **Streaks & best streaks 🔥** with achievement badges (3-day, 7-day, 30-day, perfect day, etc.).
- **Habit library** — manage, edit, delete, and inspect every tracker; per-habit sparkline chart + metrics.
- **Search / filter** daily vs projects in the library tab.
- **Export / Import** your data as JSON, and **🔄 reset** wipes everything for a fresh start (no demo data).
- Everything persists automatically to `localStorage`.

## 🏗️ The work layer — Projects & Assignments

Habits are what you repeat. **Projects and Assignments are what you finish** — two separate,
first-class systems with their own nav entries, dashboards, detail screens and analytics.

- **Projects** — milestones on a stepper, tasks (TODO / IN PROGRESS / BLOCKED / DONE),
  progress in honest steps (4 of 10 tasks = 40%), optional deadline with a pace line
  ("behind the pace by 17 points"), burndown + velocity + time-vs-work charts, and linked habits
  whose 30-day consistency is shown next to project progress (*correlation, not cause*).
- **Assignments** — deadline-first cards with a live countdown and a computed status engine:
  ON TRACK / AT RISK / URGENT / OVERDUE / COMPLETED, derived from real progress vs. time left.
  An assignment can optionally belong to a project.
- **Workload** — due-by-day bars so tomorrow's pile is visible today.
- **Deadlines** — one timeline of every project and assignment, soonest first.
- **Record** — log progress % and time spent on any project or assignment; every entry feeds the
  charts. No invented numbers anywhere: empty states until you log something real.
- **Celebrations** — a full-screen moment when a project hits 100%, a light toast for assignments.
  Never per checkbox.
- Today surfaces a small **Priority work** card (most urgent first) under your habits — work never
  takes over the habit screen.

## 🛠️ Tech

- React 18 + Vite 5
- Framer Motion (animations)
- Hand-rolled SVG charts (no chart library) — every pixel is real data
- date-fns (dates)
- Inter + Manrope (variable, self-hosted)
- vitest + Testing Library (unit/render suite) and a puppeteer-driven real-browser QA pass

## 🚀 Run it

```bash
npm install
npm run dev      # start the dev server
npm run build    # production build
npm run preview  # preview the production build
npm run test     # run the smoke tests
```

Made for Aaru 💜 — now go keep the streak alive. 🔥

## 📲 Install it like a real app (PWA)

Aaru's tracker is a full **Progressive Web App**. On your phone (or any device):

- Open the site in Chrome/Safari/Edge.
- Use **"Add to Home screen"** (or tap **📲 Install app** in the header on the web).
- It launches full-screen, works **offline**, and saves all your data **on the device** (localStorage).
- Use **📤 Export / 📥 Import** to back up or move your data between devices.

## 🚀 Host it for free (GitHub Pages)

A ready-made **GitHub Actions** deploy workflow (`.github/workflows/deploy.yml`) builds the site with the correct base path and publishes it to `https://aaru1yg.github.io/habbit-trackerrr/`.

**To go live (one-time, ~30 seconds):**

1. Open the repo → **Settings → Pages**.
2. Under **Build and deployment → Source**, pick **GitHub Actions**.
3. That's it — the site deploys automatically (or push any change / run the "Deploy to GitHub Pages" workflow manually).

Because the repo is **public**, the site is free and live over the internet with no hosting bill.

> ⚠️ If your GitHub account ever changes, just enable Pages the same way — the workflow handles the rest.

### Alternative (no GitHub)

Build once with `GH_PAGES=true npm run build`, then drag the `dist/` folder into **Netlify Drop** or **Cloudflare Pages** for an instant free URL.

## 🎨 Design system

- Deep-space dark base (`#0B0F1A`) with a slow aurora drift + fine noise grain — the only
  background ornament; content sits on quiet glass cards
- Inter for UI, Manrope for display numbers; `tabular-nums` everywhere digits align
- 8pt spacing scale, 16/20/24px radii, one unified motion language (respects
  `prefers-reduced-motion`)
- Five themes: **Aurora** (default), **Midnight**, **Ember**, **Verdant** and a WCAG-AA
  **Daylight** mode
- Mobile-first: bottom tab bar, swipe actions on habit rows, and a floating **+ Add habit**
  button that stays reachable at every width from 320px up (P0, regression-tested)
- Offline/online indicator + install button (PWA)

## 🧪 Tests & browser QA

```bash
npm run test                 # vitest unit + render suite (store, analytics, work engine, import/export)
node qa/e2e.mjs [base-url]   # real headless-Chromium pass: 300+ checks + screenshots into qa/shots/
```

The QA pass covers the full spec matrix: onboarding, habit recording, schedule-aware streaks,
reminders, mood, insights, the projects/assignments/workload/deadlines/record screens,
celebrations, export/import round-trips, persistence across reloads, navigation, horizontal
overflow at 320–414px, tap-target sizes and text contrast.

### ☁️ Cloud sync — the migration prompt contract

On first sign-in, if **both** this device and the account hold data, the app asks once how to
combine them (`src/components/auth/MigrationDialog.jsx`). The contract, enforced by
`test/migration.test.jsx` and `qa/live-migration.mjs`:

- the prompt only appears when a **genuine choice** is needed — both documents hold data *and
  actually differ* — and this device has never resolved that choice for this account;
- a resolved choice is **remembered per account, per device** (`aaru.habits.migration.v1`), so
  refreshes, reloads and sign-out/sign-in cycles never re-ask;
- identical documents (already reconciled) never prompt and never trigger a redundant write;
- if the two sides diverge again later (offline edits vs another device), the remembered choice
  is honoured silently — merge keeps both, "keep local"/"use cloud" keep winning as chosen;
- two accounts on one browser stay independent: each remembers its own decision.

```bash
node qa/live-migration.mjs            # real browser vs the PUBLIC site (see .github/workflows/verify-live-site.yml)
```

`verify-live-site.yml` runs a real-browser production health check on every PR
that touches sync code, and a full pinned verification after each deploy of
`main` (waits until Pages serves that exact commit, then checks: prompt at most
once, silent across 10 reloads and a re-login, user B independently scoped),
reporting the exact live build ID it verified against. Before the fix shipped,
the same journey in `reproduce` mode failed loudly on build `b9640e6`
(dialog on 10/10 reloads and on re-login) — the control that proved the test
can detect the bug.
