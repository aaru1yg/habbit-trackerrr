/* ============================================================
   CHART PALETTE — deterministic multi-series identity (V5).

   Every series gets hue + dash + point shape, so series are never
   distinguished by hue alone (skill: chart domain). Custom entity
   accents are honored when they stay distinguishable; near-duplicate
   hues are replaced by the next free palette slot. Canonical hues
   below mirror the midnight --c1..c8 order; each theme's --series-*
   preserves distinguishability by design.
   ============================================================ */
import { hexToRgb } from './accent.js'

export const SERIES_COUNT = 8

/** Canonical palette hues (hex), midnight --c1..c8 order. */
export const SERIES_HEX = [
  '#8b6bff', // 1 violet
  '#22d3ee', // 2 cyan
  '#34d399', // 3 emerald
  '#fbbf24', // 4 amber
  '#f472b6', // 5 pink
  '#60a5fa', // 6 blue
  '#fb7185', // 7 rose
  '#a78bfa', // 8 lavender
]

/** Line styles cycle: solid first, then distinct dashes. */
export const SERIES_DASHES = [
  null, '7 4', '2.5 3', '10 4 2.5 4',
  null, '7 4', '2.5 3', '10 4 2.5 4',
]

/** Point shapes cycle with the dashes. */
export const SERIES_SHAPES = [
  'circle', 'square', 'triangle', 'diamond',
  'circle', 'square', 'triangle', 'diamond',
]

/** Minimum hue separation (degrees) between two live series. */
export const MIN_HUE_GAP = 28

/** #rrggbb → hue 0..360 (achromatic → null), or null when invalid. */
export function hexToHue(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const r = rgb.r / 255
  const g = rgb.g / 255
  const b = rgb.b / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return null
  const d = max - min
  let h
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return h * 360
}

const hueGap = (a, b) => {
  if (a == null || b == null) return 0
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/**
 * Deterministic style for the i-th series (0-based, cycles every 8).
 * { color: 'var(--series-n)', dash, shape }
 */
export function seriesStyle(index) {
  const i = ((index % SERIES_COUNT) + SERIES_COUNT) % SERIES_COUNT
  return {
    color: `var(--series-${i + 1})`,
    dash: SERIES_DASHES[i],
    shape: SERIES_SHAPES[i],
  }
}

/**
 * Assign styles for N series with optional custom accent per series.
 * wants: array of hex-or-falsy, one per series.
 * A custom is kept when valid AND hue-distant from every assigned hue;
 * otherwise the next free palette slot (max min-distance) is used.
 * Always returns exactly wants.length styles. Pure + deterministic.
 */
export function assignSeriesColors(wants = []) {
  const out = []
  const usedHues = []
  const usedSlots = new Set()
  const slotHues = SERIES_HEX.map(hexToHue)

  wants.forEach((want, k) => {
    const fallback = seriesStyle(k)
    const hue = typeof want === 'string' && want ? hexToHue(want) : null
    const distant = hue != null && usedHues.every((u) => hueGap(hue, u) >= MIN_HUE_GAP)
    if (distant) {
      usedHues.push(hue)
      out.push({ color: want.trim(), dash: SERIES_DASHES[k % SERIES_COUNT], shape: SERIES_SHAPES[k % SERIES_COUNT] })
      return
    }
    // Next free palette slot with the largest distance to assigned hues.
    let best = -1
    let bestScore = -1
    for (let s = 0; s < SERIES_COUNT; s++) {
      if (usedSlots.has(s)) continue
      const minGap = usedHues.length
        ? Math.min(...usedHues.map((u) => hueGap(slotHues[s], u)))
        : 360 - s // prefer early slots when nothing is assigned yet
      const score = minGap * 1000 - s
      if (score > bestScore) { bestScore = score; best = s }
    }
    if (best === -1) {
      out.push(fallback) // >8 series: cycle (charts cap at 6 anyway)
    } else {
      usedSlots.add(best)
      if (slotHues[best] != null) usedHues.push(slotHues[best])
      out.push({ color: `var(--series-${best + 1})`, dash: SERIES_DASHES[best], shape: SERIES_SHAPES[best] })
    }
  })
  return out
}
