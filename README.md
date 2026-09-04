# 🔥 Aaru · Next-Level Habit Tracker

Aaru's personal, next-level habit tracker. Dark, glassy, heavily animated, and packed with more graphs and features than any ordinary habit app. Your data lives entirely in your browser (localStorage) — no account, no server, just *you* and your streak.

## ✨ The vibe

- Glassmorphism cards over a slowly drifting aurora background
- Springy framer-motion animations everywhere (cards, toggles, gauges, confetti on completion)
- Animated counters, animated circular gauges, animated dash-offset donuts
- Confetti + toast feedback whenever you smash a habit

## 📈 Graphs & visualizations

| Panel | What it shows |
|---|---|
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
- **Export / Import** your data as JSON, and **reset** to fresh demo data.
- Everything persists automatically to `localStorage`.

## 🛠️ Tech

- React 18 + Vite 5
- Framer Motion (animations)
- Recharts (all the charts)
- date-fns (dates)
- vitest + jsdom (a render smoke test suite)

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

## 🎨 Futuristic extras

- Animated **starfield** canvas + drifting aurora + glowing **neon gradient card borders**
- **Sci-fi numbers** (Orbitron font) and a **XP / Level** system in the Insights panel
- **Accent theme switcher**: Aurora 🔮 / Cyber 🌸 / Emerald 🌿 / Violet 💜 / Azure 💙
- Daily **trend**, **best day of week**, **active days**, **top vs weakest habit**
- Offline/online device indicator + **install button**

## 🛠️ Tech
