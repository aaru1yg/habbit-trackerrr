/* ============================================================
   ICONS — one stroked 24-grid set. No icon font, no dependency.
   ============================================================ */

const S = ({ children, size = 20, ...rest }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false" {...rest}
  >
    {children}
  </svg>
)

export const IconToday    = (p) => <S {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.2 2" /></S>
export const IconHabits   = (p) => <S {...p}><path d="M4.5 12.5 9 17l10.5-10.5" /><path d="M4.5 6.5 7 9" /></S>
export const IconWork     = (p) => <S {...p}><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7" /><path d="M3 12h18" /></S>
export const IconGoals    = (p) => <S {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r=".9" fill="currentColor" /></S>
export const IconInsights = (p) => <S {...p}><path d="M4 19V9" /><path d="M10 19V5" /><path d="M16 19v-7" /><path d="M21 19H3" /></S>
export const IconSettings = (p) => <S {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 14.5a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-1 1.46V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1.05-1.46 1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.46-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.46-1.05 1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.6 1.6 0 0 0 1.77.32H9a1.6 1.6 0 0 0 1-1.46V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.46 1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.6 1.6 0 0 0-.32 1.77V9a1.6 1.6 0 0 0 1.46 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.46 1z" /></S>

export const IconPlus     = (p) => <S {...p}><path d="M12 5v14M5 12h14" /></S>
export const IconMinus    = (p) => <S {...p}><path d="M5 12h14" /></S>
export const IconCheck    = (p) => <S {...p} strokeWidth="2.4"><path d="M4.5 12.5 9.5 17.5 19.5 6.5" /></S>
export const IconX        = (p) => <S {...p}><path d="M6 6l12 12M18 6 6 18" /></S>
export const IconSearch   = (p) => <S {...p}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></S>
export const IconChevron  = (p) => <S {...p}><path d="m9 5 7 7-7 7" /></S>
export const IconBack     = (p) => <S {...p}><path d="M19 12H5" /><path d="m11 6-6 6 6 6" /></S>
export const IconMore     = (p) => <S {...p}><circle cx="12" cy="5.5" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="12" cy="18.5" r="1.4" fill="currentColor" stroke="none" /></S>
export const IconEdit     = (p) => <S {...p}><path d="M4 20h4L19 9a2.4 2.4 0 0 0-3.4-3.4L4.5 16.7z" /><path d="m14.5 7 2.5 2.5" /></S>
export const IconTrash    = (p) => <S {...p}><path d="M4 7h16" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" /><path d="M6.5 7 7.5 20h9L17.5 7" /><path d="M10.5 11v5M13.5 11v5" /></S>
export const IconArchive  = (p) => <S {...p}><rect x="3" y="4" width="18" height="4.5" rx="1.4" /><path d="M5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.5" /><path d="M10 12.5h4" /></S>
export const IconFlame    = (p) => <S {...p}><path d="M12 3s5 4.2 5 9a5 5 0 0 1-10 0c0-1.7.7-3 1.6-4 .2 1.3 1 2.1 1.9 2.1 1 0 1.6-.9 1.5-2.3C11.9 6.3 12 4.6 12 3Z" /></S>
export const IconClock    = (p) => <S {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5l3 1.8" /></S>
export const IconCalendar = (p) => <S {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="2.4" /><path d="M3.5 10h17M8.5 3v4M15.5 3v4" /></S>
export const IconSpark    = (p) => <S {...p}><path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9z" /><path d="M18.5 4.5v3M20 6h-3" /></S>
export const IconTrophy   = (p) => <S {...p}><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 5.5H5.5A2.5 2.5 0 0 0 8 10M16 5.5h2.5A2.5 2.5 0 0 1 16 10" /><path d="M12 13v3.5M9 20h6M10 16.5h4l.6 3.5h-5.2z" /></S>
export const IconMood     = (p) => <S {...p}><circle cx="12" cy="12" r="8.5" /><path d="M8.6 14.2a4.2 4.2 0 0 0 6.8 0" /><circle cx="9.3" cy="9.8" r=".9" fill="currentColor" stroke="none" /><circle cx="14.7" cy="9.8" r=".9" fill="currentColor" stroke="none" /></S>
export const IconLink     = (p) => <S {...p}><path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 1 0-5-5l-1.2 1.2" /><path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 1 0 5 5l1.2-1.2" /></S>
export const IconDownload = (p) => <S {...p}><path d="M12 4v10" /><path d="m8 10.5 4 4 4-4" /><path d="M4.5 18.5h15" /></S>
export const IconUpload   = (p) => <S {...p}><path d="M12 15V5" /><path d="m8 8.5 4-4 4 4" /><path d="M4.5 18.5h15" /></S>
export const IconMenu     = (p) => <S {...p}><path d="M4 7h16M4 12h16M4 17h10" /></S>
export const IconRocket   = (p) => <S {...p}><path d="M13.5 4.5c3.3-1.3 6 1.4 4.7 4.7-.9 2.3-3.3 5-6.2 6.3L9 17l-2-2 1.5-3c1.3-2.9 3.9-5.3 6.2-6.2z" /><path d="M8.5 15.5 6 18M9.5 18.5 7 21M5.5 14.5 3 17" /><circle cx="14.5" cy="9.5" r="1.4" /></S>
/* ---- account and sync ---- */
export const IconCloud    = (p) => <S {...p}><path d="M7.2 19h9.6a4.2 4.2 0 0 0 .5-8.37 6 6 0 0 0-11.63 1.2A3.9 3.9 0 0 0 7.2 19Z" /></S>
export const IconCloudOff = (p) => <S {...p}><path d="M6.6 10.1A3.9 3.9 0 0 0 7.2 19h8.3" /><path d="M9.3 6.6a6 6 0 0 1 8.1 4.1 4.2 4.2 0 0 1 2.1 7.1" /><path d="M3.5 3.5l17 17" /></S>
export const IconCloudUp  = (p) => <S {...p}><path d="M7.2 18h9.6a4.2 4.2 0 0 0 .5-8.37 6 6 0 0 0-11.63 1.2A3.9 3.9 0 0 0 7.2 18Z" /><path d="M12 20.5v-6" /><path d="m9.7 16.4 2.3-2.3 2.3 2.3" /></S>
export const IconRefresh  = (p) => <S {...p}><path d="M20 12a8 8 0 1 1-2.4-5.7" /><path d="M20.5 4v4.5H16" /></S>
export const IconLock     = (p) => <S {...p}><rect x="4.5" y="10.5" width="15" height="9.5" rx="2.2" /><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" /><circle cx="12" cy="15.2" r="1.2" fill="currentColor" stroke="none" /></S>
export const IconMail     = (p) => <S {...p}><rect x="3" y="5.5" width="18" height="13" rx="2.2" /><path d="m3.6 7 7.3 5.3a2 2 0 0 0 2.2 0L20.4 7" /></S>
export const IconSignOut  = (p) => <S {...p}><path d="M14.5 4.5h3A2 2 0 0 1 19.5 6.5v11a2 2 0 0 1-2 2h-3" /><path d="M11 16.5 15 12l-4-4.5" /><path d="M15 12H4.5" /></S>
export const IconUser     = (p) => <S {...p}><circle cx="12" cy="8.5" r="3.8" /><path d="M4.8 20a7.4 7.4 0 0 1 14.4 0" /></S>
export const IconMerge    = (p) => <S {...p}><path d="M7 20.5V13l5-4.5V3.5" /><path d="M17 20.5V13l-5-4.5" /><path d="m8.6 5.2 3.4-3 3.4 3" /></S>
export const IconAlert    = (p) => <S {...p}><path d="M12 4.5 21 19.5H3z" /><path d="M12 10v4" /><circle cx="12" cy="16.8" r="1" fill="currentColor" stroke="none" /></S>

export const IconLayers   = (p) => <S {...p}><path d="m12 3.5 8.5 4.5L12 12.5 3.5 8z" /><path d="m3.5 12.5 8.5 4.5 8.5-4.5" /><path d="m3.5 16.5 8.5 4.5 8.5-4.5" /></S>
export const IconMoon     = (p) => <S {...p}><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5" /></S>
export const IconSun      = (p) => <S {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" /></S>

/* The five mood faces, drawn rather than typed. Emoji render at the
   mercy of the platform font — these stay identical everywhere and
   inherit currentColor, so the selected face can be tinted. */
const MOUTHS = [
  'M8.6 15.6a4.2 4.2 0 0 1 6.8 0',      // 1 — down
  'M8.8 14.8a4 4 0 0 1 6.4 0',           // 2 — slight down
  'M8.8 14.4h6.4',                       // 3 — flat
  'M8.8 13.8a4 4 0 0 0 6.4 0',           // 4 — slight up
  'M8.2 13.2a4.6 4.6 0 0 0 7.6 0',       // 5 — up
]
export const IconFace = ({ level = 3, ...p }) => (
  <S {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d={MOUTHS[Math.min(4, Math.max(0, level - 1))]} />
    <circle cx="9.3" cy="9.7" r=".95" fill="currentColor" stroke="none" />
    <circle cx="14.7" cy="9.7" r=".95" fill="currentColor" stroke="none" />
  </S>
)

/* ============================================================
   Brand mark

   Four cells, three filled: a week being marked off. It reads at
   16px in a favicon and at 96px on the empty state, and it says
   what the product does without a letterform.
   ============================================================ */
export const Wordmark = ({ size = 24, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...rest}>
    <rect x="1.5" y="1.5" width="9" height="9" rx="2.2" fill="currentColor" />
    <rect x="13.5" y="1.5" width="9" height="9" rx="2.2" fill="currentColor" opacity=".38" />
    <rect x="1.5" y="13.5" width="9" height="9" rx="2.2" fill="currentColor" opacity=".38" />
    <rect x="13.5" y="13.5" width="9" height="9" rx="2.2" fill="currentColor" />
  </svg>
)

/* ============================================================
   Habit glyphs

   A fixed, drawn set. Habits used to store an emoji, which meant
   the icon changed shape between a Mac, an Android and a Windows
   box, and rendered as a blank box wherever the font was missing.
   A habit now stores one of these keys instead.
   ============================================================ */
export const HABIT_ICONS = {
  check:    (p) => <S {...p}><path d="m5 12.5 4.5 4.5L19 7" /></S>,
  book:     (p) => <S {...p}><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 15.5z" /><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h4.5a1.5 1.5 0 0 0 1.5-1.5z" /></S>,
  water:    (p) => <S {...p}><path d="M12 3.5c3.4 3.6 5.5 6.3 5.5 9a5.5 5.5 0 0 1-11 0c0-2.7 2.1-5.4 5.5-9z" /></S>,
  run:      (p) => <S {...p}><circle cx="14.5" cy="4.8" r="1.8" /><path d="m7 20 2.6-4.4 3-1.8-1.2-4.3-3.4 2-1.5 2.8" /><path d="m12.4 9.5 3.3 2.2.9 3.6 2.9 1.4" /></S>,
  gym:      (p) => <S {...p}><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" /></S>,
  mind:     (p) => <S {...p}><path d="M12 4.5a3.4 3.4 0 0 0-3.3 2.6A3 3 0 0 0 6.5 13a3.2 3.2 0 0 0 1.6 3.5 3 3 0 0 0 3.9 2.8V4.5z" /><path d="M12 4.5a3.4 3.4 0 0 1 3.3 2.6A3 3 0 0 1 17.5 13a3.2 3.2 0 0 1-1.6 3.5 3 3 0 0 1-3.9 2.8" /></S>,
  write:    (p) => <S {...p}><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" /><path d="m15 7 2 2" /></S>,
  code:     (p) => <S {...p}><path d="m8.5 8.5-4 3.5 4 3.5M15.5 8.5l4 3.5-4 3.5M13.5 5l-3 14" /></S>,
  sleep:    (p) => <S {...p}><path d="M19.5 14.2A8 8 0 0 1 9.8 4.5a8 8 0 1 0 9.7 9.7z" /></S>,
  leaf:     (p) => <S {...p}><path d="M5 19c0-7 4.5-11.5 14-12-.5 9.5-5 14-12 14H5z" /><path d="M5 19c3-3.5 6-6 10-8" /></S>,
  heart:    (p) => <S {...p}><path d="M12 19.5S4.5 15 4.5 9.8A3.8 3.8 0 0 1 12 7.8a3.8 3.8 0 0 1 7.5 2c0 5.2-7.5 9.7-7.5 9.7z" /></S>,
  music:    (p) => <S {...p}><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></S>,
  camera:   (p) => <S {...p}><path d="M3.5 8.5h3L8 6h8l1.5 2.5h3v10h-17z" /><circle cx="12" cy="13" r="3.2" /></S>,
  cook:     (p) => <S {...p}><path d="M5 10.5h14M6.5 10.5v7A2.5 2.5 0 0 0 9 20h6a2.5 2.5 0 0 0 2.5-2.5v-7" /><path d="M9 7.5V4M12 7.5V4M15 7.5V4" /></S>,
  money:    (p) => <S {...p}><circle cx="12" cy="12" r="8.5" /><path d="M14.5 9.3A3 3 0 0 0 12 8c-1.6 0-2.6.8-2.6 1.9 0 2.7 5.4 1.3 5.4 4.1 0 1.2-1.1 2-2.8 2a3.1 3.1 0 0 1-2.6-1.3M12 6.3v11.4" /></S>,
  people:   (p) => <S {...p}><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" /><path d="M16 6.1a3 3 0 0 1 0 5.8M17.5 15.2a5.5 5.5 0 0 1 3 4.3" /></S>,
}

export const HABIT_ICON_KEYS = Object.keys(HABIT_ICONS)

/** Render a habit's glyph. Unknown or legacy values fall back to
 *  the category glyph rather than rendering nothing. */
export const HabitGlyph = ({ icon, category = 'mind', ...rest }) => {
  const Glyph = HABIT_ICONS[icon] || HABIT_ICONS[CATEGORY_ICON[category]] || HABIT_ICONS.check
  return <Glyph {...rest} />
}

/* Each category has a representative glyph from the same set, so
   a habit with no icon still looks deliberate. */
export const CATEGORY_ICON = {
  body: 'gym', mind: 'mind', craft: 'write', care: 'leaf', social: 'people',
}

/* ------------------------------------------------------------------
   Milestone marks. compute.js stores a key so state stays
   serialisable; the drawing lives here with every other glyph.
   ------------------------------------------------------------------ */

export const MILESTONE_ICONS = {
  seed:   'M12 21v-7m0 0c0-3.3-2.7-6-6-6H4v2c0 2.8 2.2 5 5 5h3Zm0 0c0-3.9 3.1-7 7-7h1v1a6 6 0 0 1-6 6h-2Z',
  flame:  'M12 3c3 3.2 5.5 5.7 5.5 9a5.5 5.5 0 1 1-11 0c0-1.7.7-3.1 1.8-4.5.3 1.2 1 2 2 2.3C10.6 8.1 11 5.6 12 3Z',
  bolt:   'M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z',
  grid:   'M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  medal:  'M8 3 5 9m11-6 3 6M12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0-8.5 1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6L8.2 15l2.6-.4L12 12.5Z',
  ship:   'M12 2c2.8 2.4 4.5 5.6 4.5 9.3V15l2.5 2.5V20l-4-1.5h-6L5 20v-2.5L7.5 15v-3.7C7.5 7.6 9.2 4.4 12 2Zm0 6.5a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Z',
  layers: 'M12 3 3 8l9 5 9-5-9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5',
  trophy: 'M7 4h10v5a5 5 0 0 1-10 0V4Zm0 1H4v2a3 3 0 0 0 3 3m10-5h3v2a3 3 0 0 1-3 3m-5 5v4m-3 0h6',
}

export function MilestoneGlyph({ icon, size = 18 }) {
  const d = MILESTONE_ICONS[icon] || MILESTONE_ICONS.target
  return <S size={size}>{d.split('M').filter(Boolean).map((seg, i) => <path key={i} d={'M' + seg} />)}</S>
}
