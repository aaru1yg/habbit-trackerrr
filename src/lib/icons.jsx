/* Hand-drawn stroke icon set (24×24, 1.8 stroke) — no emoji UI. */
const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

const wrap = (children, size) => (
  <svg width={size || 20} height={size || 20} viewBox="0 0 24 24" {...base}>
    {children}
  </svg>
)

export const IconToday = ({ size }) => wrap(<>
  <circle cx="12" cy="12" r="4" />
  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
</>, size)

export const IconCalendar = ({ size }) => wrap(<>
  <rect x="3" y="4" width="18" height="18" rx="3" />
  <path d="M16 2v4M8 2v4M3 10h18" />
</>, size)

export const IconWeek = ({ size }) => wrap(<>
  <rect x="3" y="4" width="18" height="17" rx="3" />
  <path d="M3 9h18M9 9v12M15 9v12" />
</>, size)

export const IconInsights = ({ size }) => wrap(<>
  <path d="M3 21h18" />
  <path d="M6 17v-5M11 17V7M16 17v-8M21 17V4" />
</>, size)

export const IconMind = ({ size }) => wrap(<>
  <path d="M12 3a4 4 0 0 0-4 4 3.5 3.5 0 0 0-1.5 6.7A3 3 0 0 0 9 20h1" />
  <path d="M12 3a4 4 0 0 1 4 4 3.5 3.5 0 0 1 1.5 6.7A3 3 0 0 1 15 20h-1" />
  <path d="M12 3v17" />
</>, size)

export const IconGoals = ({ size }) => wrap(<>
  <circle cx="12" cy="12" r="9" />
  <circle cx="12" cy="12" r="5" />
  <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
</>, size)

export const IconSettings = ({ size }) => wrap(<>
  <circle cx="12" cy="12" r="3" />
  <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h.09a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" />
</>, size)

export const IconPlus = ({ size }) => wrap(<path d="M12 5v14M5 12h14" />, size)

export const IconCheck = ({ size }) => wrap(<path d="M4.5 12.5l5 5L19.5 7" />, size)

export const IconChevronLeft = ({ size }) => wrap(<path d="M15 5l-7 7 7 7" />, size)
export const IconChevronRight = ({ size }) => wrap(<path d="M9 5l7 7-7 7" />, size)
export const IconChevronDown = ({ size }) => wrap(<path d="M5 9l7 7 7-7" />, size)

export const IconFlame = ({ size }) => wrap(<>
  <path d="M12 2c1 4-4 5.5-4 10a4 4 0 0 0 8 0c0-1.5-.5-2.5-1-3.5-1.5 1-2 1.5-2.5 1-.6-.6.5-3.5-.5-7.5Z" />
  <path d="M12 22a7.5 7.5 0 0 0 7.5-7.5c0-4.5-3-8-5-9.5.5 3-1 4.5-2.5 6" opacity="0" />
</>, size)

export const IconX = ({ size }) => wrap(<path d="M6 6l12 12M18 6L6 18" />, size)

export const IconPencil = ({ size }) => wrap(<>
  <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z" />
</>, size)

export const IconArchive = ({ size }) => wrap(<>
  <rect x="2" y="4" width="20" height="5" rx="1.5" />
  <path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9M10 13h4" />
</>, size)

export const IconTrash = ({ size }) => wrap(<>
  <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
</>, size)

export const IconGrip = ({ size }) => wrap(<>
  <circle cx="9" cy="6" r="1.3" fill="currentColor" stroke="none" />
  <circle cx="15" cy="6" r="1.3" fill="currentColor" stroke="none" />
  <circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none" />
  <circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none" />
  <circle cx="9" cy="18" r="1.3" fill="currentColor" stroke="none" />
  <circle cx="15" cy="18" r="1.3" fill="currentColor" stroke="none" />
</>, size)

export const IconBell = ({ size }) => wrap(<>
  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
  <path d="M10.3 20a2 2 0 0 0 3.4 0" />
</>, size)

export const IconBellOff = ({ size }) => wrap(<>
  <path d="M6 8a6 6 0 0 1 9.3-5M18 8.5c.3 4.5 3 7.5 3 7.5H3M3 3l18 18" />
  <path d="M10.3 20a2 2 0 0 0 3.4 0" />
</>, size)

export const IconDownload = ({ size }) => wrap(<>
  <path d="M12 3v12M7 10l5 5 5-5" />
  <path d="M4 19.5V21h16v-1.5" />
</>, size)

export const IconUpload = ({ size }) => wrap(<>
  <path d="M12 15V3M7 8l5-5 5 5" />
  <path d="M4 19.5V21h16v-1.5" />
</>, size)

export const IconNote = ({ size }) => wrap(<>
  <path d="M4 4h16v12l-4 4H4V4Z" />
  <path d="M16 20v-4h4M8 9h8M8 13h5" />
</>, size)

export const IconTrendUp = ({ size }) => wrap(<path d="M3 17l6-6 4 4 8-8M15 7h6v6" />, size)
export const IconTrendDown = ({ size }) => wrap(<path d="M3 7l6 6 4-4 8 8M15 17h6v-6" />, size)

export const IconPalette = ({ size }) => wrap(<>
  <path d="M12 21a9 9 0 1 1 9-9c0 2.5-2 3-3.5 3H16a2 2 0 0 0-1.4 3.4c.5.6.2 2.6-2.6 2.6Z" />
  <circle cx="7.5" cy="11.5" r="1.2" fill="currentColor" stroke="none" />
  <circle cx="10.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
  <circle cx="15" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
</>, size)

export const IconUndo = ({ size }) => wrap(<>
  <path d="M4 9h10a5 5 0 0 1 0 10h-3" />
  <path d="M8 5L4 9l4 4" />
</>, size)

export const IconSparkle = ({ size }) => wrap(<>
  <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />
  <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" />
</>, size)

export const IconOffline = ({ size }) => wrap(<>
  <path d="M2 2l20 20" />
  <path d="M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 3-2M19 13a10 10 0 0 0-8.5-2.7M2 9a15 15 0 0 1 5-3.3M22 9a15 15 0 0 0-9.6-3.2M12 20h.01" />
</>, size)

export const IconUser = ({ size }) => wrap(<>
  <circle cx="12" cy="8" r="4" />
  <path d="M4 21c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" />
</>, size)

export const IconAward = ({ size }) => wrap(<>
  <circle cx="12" cy="9" r="6" />
  <path d="M8.5 14L7 22l5-3 5 3-1.5-8" />
</>, size)

export const IconClock = ({ size }) => wrap(<>
  <circle cx="12" cy="12" r="9" />
  <path d="M12 7v5l3.5 2" />
</>, size)
