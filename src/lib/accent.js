/* ============================================================
   ACCENT — tokenized color customization (V5).

   Users pick ONE base color per entity (habit / goal / project /
   chart series / theme accent). Everything else derives:

     BASE → SOFT (wash) → MUTED (surface blend) → STRONG (text
     blend) → INK (readable text on the accent fill)

   Derivations are color-mix() expressions, so they stay correct in
   every theme without per-theme tables. INK is computed in JS from
   real contrast math: a chosen accent must never make text
   unreadable. Invalid input degrades to {} so CSS falls back to
   the theme accent — never a broken value.
   ============================================================ */

/** Curated preset bases. Every preset's ink passes 4.5:1 (tested). */
export const ACCENT_PRESETS = [
  { id: 'violet', base: '#8b6bff' },
  { id: 'cyan', base: '#22d3ee' },
  { id: 'emerald', base: '#34d399' },
  { id: 'amber', base: '#fbbf24' },
  { id: 'pink', base: '#f472b6' },
  { id: 'blue', base: '#60a5fa' },
  { id: 'rose', base: '#fb7185' },
  { id: 'lime', base: '#a3e635' },
  { id: 'orange', base: '#fb923c' },
  { id: 'indigo', base: '#818cf8' },
]

export const isHex = (v) =>
  typeof v === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim())

/** #rgb / #rrggbb → { r, g, b } (0..255), or null when invalid. */
export function hexToRgb(hex) {
  if (!isHex(hex)) return null
  let h = hex.trim().slice(1)
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

/** WCAG relative luminance, 0..1. */
export function relLuminance({ r, g, b }) {
  const f = (v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/** WCAG contrast ratio of two hex colors (1..21), or null if unparseable. */
export function contrastRatio(a, b) {
  const ra = hexToRgb(a)
  const rb = hexToRgb(b)
  if (!ra || !rb) return null
  const la = relLuminance(ra)
  const lb = relLuminance(rb)
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

const INK_LIGHT = '#ffffff'
const INK_DARK = '#10131a'

/**
 * Readable text color ON an accent fill. Returns { ink, ratio, passes }.
 * Picks whichever ink contrasts more; `passes` reports the 4.5:1 floor.
 */
export function inkFor(base) {
  const light = contrastRatio(base, INK_LIGHT)
  const dark = contrastRatio(base, INK_DARK)
  if (light == null || dark == null) return { ink: INK_LIGHT, ratio: null, passes: false }
  const useLight = light >= dark
  const ratio = useLight ? light : dark
  return { ink: useLight ? INK_LIGHT : INK_DARK, ratio, passes: ratio >= 4.5 }
}

/**
 * Full derivation for a base color. Returns null when the base is invalid
 * (caller falls back to theme tokens).
 */
export function deriveAccent(base) {
  if (!isHex(base)) return null
  const b = base.trim()
  const { ink } = inkFor(b)
  return {
    base: b,
    soft: `color-mix(in srgb, ${b} 16%, transparent)`,
    muted: `color-mix(in srgb, ${b} 38%, var(--surface))`,
    strong: `color-mix(in srgb, ${b} 72%, var(--text))`,
    ink,
  }
}

/**
 * Inline custom-property map for an entity's accent scope, e.g.
 * <article style={accentVars(habit.accent)}>. Empty object when unset or
 * invalid → CSS falls back to the theme accent slots.
 */
export function accentVars(base) {
  const d = base == null || base === '' ? null : deriveAccent(base)
  if (!d) return {}
  return {
    '--ea-base': d.base,
    '--ea-soft': d.soft,
    '--ea-muted': d.muted,
    '--ea-strong': d.strong,
    '--ea-ink': d.ink,
  }
}
