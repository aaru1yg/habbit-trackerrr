/* ============================================================
   HABIT IDENTITY — color + priority for every habit.

   ONE habit = ONE visual identity. A habit stores two optional
   fields:
     color    — a curated palette id ('violet'…) or a custom hex
                ('#a1c4fd'). Habits created before colour existed
                fall back to their category colour so nothing is
                ever unlabelled and nothing is ever fabricated.
     priority — 1 Low … 5 Critical (default 2 Normal).

   Colour is stored on the habit, so the master graph, detail
   page, rings, calendar, rows and analytics all resolve through
   the same helper and can never disagree.
   ============================================================ */

/* Curated palette — fixed hex values, theme independent, tuned for
   dark ink surfaces (AA-ish on #0b0f1a, used as strokes + accents). */
export const HABIT_COLOR_PALETTE = [
  { id: 'violet', hex: '#8b6bff', label: 'Violet' },
  { id: 'blue', hex: '#60a5fa', label: 'Blue' },
  { id: 'cyan', hex: '#22d3ee', label: 'Cyan' },
  { id: 'green', hex: '#34d399', label: 'Green' },
  { id: 'yellow', hex: '#fbbf24', label: 'Yellow' },
  { id: 'orange', hex: '#fb923c', label: 'Orange' },
  { id: 'pink', hex: '#f472b6', label: 'Pink' },
  { id: 'rose', hex: '#fb7185', label: 'Rose' },
]

const PALETTE_BY_ID = Object.fromEntries(HABIT_COLOR_PALETTE.map((c) => [c.id, c.hex]))

/* Category defaults — assigned at creation (and as the fallback for
   older habits) so a fresh habit always has a coherent identity. */
export const CATEGORY_COLORS = {
  fitness: '#34d399',
  health: '#22d3ee',
  mind: '#8b6bff',
  learning: '#60a5fa',
  creative: '#f472b6',
  social: '#fbbf24',
  finance: '#fbbf24',
  productivity: '#60a5fa',
}

export const DEFAULT_HABIT_COLOR = '#8b6bff'

/** True when the stored value is a custom hex like '#a1c4fd'. */
export const isCustomHex = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)

/** True when the stored value names a curated palette swatch. */
export const isPaletteColor = (v) => typeof v === 'string' && v in PALETTE_BY_ID

/**
 * The one colour resolver. Everything visual reads a habit's colour
 * through here: stored palette id → hex, custom hex → hex, none →
 * category default. Always returns a '#rrggbb' string.
 */
export function habitColorHex(habit) {
  if (!habit) return DEFAULT_HABIT_COLOR
  const c = habit.color
  if (isPaletteColor(c)) return PALETTE_BY_ID[c]
  if (isCustomHex(c)) return c
  return CATEGORY_COLORS[habit.category] || DEFAULT_HABIT_COLOR
}

/** Colour used when editing: raw stored value or resolved hex. */
export function habitColorInputValue(habit) {
  if (!habit) return DEFAULT_HABIT_COLOR
  if (isPaletteColor(habit.color) || isCustomHex(habit.color)) return habit.color
  return habitColorHex(habit)
}

/* ---------------- Priority ---------------- */

export const HABIT_PRIORITIES = [
  { value: 1, label: 'Low', short: 'L1' },
  { value: 2, label: 'Normal', short: 'N2' },
  { value: 3, label: 'Medium', short: 'M3' },
  { value: 4, label: 'High', short: 'H4' },
  { value: 5, label: 'Critical', short: 'C5' },
]

export const priorityMeta = (value) =>
  HABIT_PRIORITIES.find((p) => p.value === value) || HABIT_PRIORITIES[1]

/** Numeric priority 1..5, defaulting old habits to Normal (2). */
export const habitPriority = (habit) => {
  const v = Number(habit?.priority)
  if (Number.isFinite(v) && v >= 1 && v <= 5) return Math.round(v)
  return 2
}

/** Sort weight for "what matters first" lists: lower = sooner. */
export const habitPriorityWeight = (habit) => 5 - habitPriority(habit)
