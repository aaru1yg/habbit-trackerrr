/* Renders public/art/og-image.png (1200×630) with the same brand system as
   the app: midnight palette, aurora glows, brand mark, and a Today-card mock.
   Run: node qa/og.mjs   (requires the built app's chromium from qa/helpers) */
import { launch } from './helpers.mjs'
import { writeFileSync, statSync } from 'fs'

const W = 1200, H = 630

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
  body {
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    background: #0b0f1a;
    position: relative;
  }
  .aurora { position: absolute; inset: 0; overflow: hidden; }
  .glow1 { position: absolute; width: 900px; height: 700px; left: -260px; top: -320px;
    background: radial-gradient(closest-side, rgba(109,74,255,0.34), transparent 70%); }
  .glow2 { position: absolute; width: 800px; height: 800px; right: -180px; bottom: -420px;
    background: radial-gradient(closest-side, rgba(34,211,238,0.16), transparent 70%); }
  .grid { position: absolute; inset: 0; opacity: 0.5;
    background-image: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px);
    background-size: 28px 28px; }
  .wrap { position: absolute; inset: 0; display: flex; align-items: center; padding: 0 72px; gap: 56px; }
  .left { flex: 1 1 auto; }
  .brandrow { display: flex; align-items: center; gap: 18px; margin-bottom: 40px; }
  .wordmark { font-size: 40px; font-weight: 800; letter-spacing: -0.02em; color: #f3f1ec; }
  h1 { font-size: 62px; font-weight: 800; letter-spacing: -0.02em; color: #f3f1ec; line-height: 1.08; margin-bottom: 24px; }
  h1 .grad { background: linear-gradient(92deg, #8b7bff, #22d3ee); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .tagline { font-size: 27px; line-height: 1.5; color: #a8b3c9; max-width: 560px; font-weight: 400; }
  .chips { display: flex; gap: 12px; margin-top: 36px; }
  .chip { font-size: 19px; font-weight: 600; color: #c9d2e3; padding: 10px 18px; border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.05); }
  .card { flex: 0 0 400px; background: #151b2c; border: 1px solid rgba(255,255,255,0.09);
    border-radius: 26px; padding: 26px 26px 20px; box-shadow: 0 30px 70px rgba(0,0,0,0.5); }
  .card-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 18px; }
  .card-title { font-size: 21px; font-weight: 700; color: #f3f1ec; }
  .card-sub { font-size: 15px; color: #7d879e; font-weight: 600; }
  .row { display: flex; align-items: center; gap: 14px; padding: 13px 12px; border-radius: 14px; margin-bottom: 6px; }
  .row.done { background: rgba(109,74,255,0.13); }
  .dot { width: 30px; height: 30px; border-radius: 999px; display: grid; place-items: center; flex: 0 0 30px; }
  .dot.on { background: linear-gradient(135deg, #6d4aff, #22d3ee); }
  .dot.off { border: 2px solid rgba(255,255,255,0.22); }
  .name { font-size: 18px; font-weight: 600; color: #e7e3dc; flex: 1; }
  .row:not(.done) .name { color: #b9c2d4; }
  .streak { font-size: 14px; font-weight: 700; color: #8b7bff; }
  .bar { height: 8px; border-radius: 99px; background: rgba(255,255,255,0.08); margin: 14px 12px 4px; overflow: hidden; }
  .bar > div { height: 100%; width: 67%; border-radius: 99px; background: linear-gradient(90deg, #6d4aff, #22d3ee); }
  .bar-label { font-size: 13px; color: #7d879e; font-weight: 600; margin: 6px 12px 0; }
</style>
</head>
<body>
  <div class="aurora"><div class="glow1"></div><div class="glow2"></div><div class="grid"></div></div>
  <div class="wrap">
    <div class="left">
      <div class="brandrow">
        <svg width="64" height="64" viewBox="0 0 48 48" aria-hidden="true">
          <defs><linearGradient id="bm-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#6d4aff"/><stop offset="100%" stop-color="#22d3ee"/>
          </linearGradient></defs>
          <rect x="3" y="3" width="42" height="42" rx="13" fill="url(#bm-g)"/>
          <path d="M15 24.5l6 6L34 17" stroke="#0b0f1a" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
        <div class="wordmark">Aaru Habits</div>
      </div>
      <h1>Small habits,<br><span class="grad">honestly kept.</span></h1>
      <p class="tagline">A calm, private habit tracker. Streaks, insights, and a year at a glance — all on your device.</p>
      <div class="chips"><span class="chip">Works offline</span><span class="chip">Private by design</span><span class="chip">Free</span></div>
    </div>
    <div class="card">
      <div class="card-head"><div class="card-title">Today</div><div class="card-sub">4 of 6 done</div></div>
      <div class="row done"><div class="dot on"><svg width="15" height="15" viewBox="0 0 48 48"><path d="M15 24.5l6 6L34 17" stroke="#0b0f1a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></div><div class="name">Morning run</div><div class="streak">12-day streak</div></div>
      <div class="row done"><div class="dot on"><svg width="15" height="15" viewBox="0 0 48 48"><path d="M15 24.5l6 6L34 17" stroke="#0b0f1a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></div><div class="name">Read 10 pages</div><div class="streak">31-day streak</div></div>
      <div class="row"><div class="dot off"></div><div class="name">Meditate</div></div>
      <div class="row"><div class="dot off"></div><div class="name">Practice guitar</div></div>
      <div class="bar"><div></div></div>
      <div class="bar-label">67% today · 84% this month</div>
    </div>
  </div>
</body>
</html>`

const browser = await launch()
const page = await browser.newPage()
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 })
await page.setContent(html, { waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 300))

// sanity: layout must have rendered at expected sizes (wordmark, card, rows)
const sanity = await page.evaluate(() => {
  const r = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const b = el.getBoundingClientRect()
    return { w: Math.round(b.width), h: Math.round(b.height), text: (el.textContent || '').trim().slice(0, 24) }
  }
  return {
    wordmark: r('.wordmark'), h1: r('h1'), tagline: r('.tagline'),
    card: r('.card'), rows: document.querySelectorAll('.row').length,
    chips: document.querySelectorAll('.chip').length,
    bodyW: document.body.scrollWidth, bodyH: document.body.scrollHeight,
  }
})
const ok = sanity.wordmark && sanity.wordmark.w > 200 && sanity.wordmark.h < 60 && sanity.card && sanity.card.w >= 395
  && sanity.rows === 4 && sanity.chips === 3 && sanity.bodyW <= 1200 && sanity.bodyH <= 630
if (!ok) {
  console.error('OG render sanity check failed:', sanity)
  process.exit(1)
}

const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H } })
writeFileSync('public/art/og-image.png', buf)
await browser.close()
console.log(`public/art/og-image.png written — ${W}×${H}, ${(statSync('public/art/og-image.png').size / 1024).toFixed(0)} KB, content check`, sanity)
