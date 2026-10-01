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

export const CATEGORY_ICON = {
  body: '💪', mind: '🧠', craft: '🛠', care: '🌿', social: '🤝',
}
