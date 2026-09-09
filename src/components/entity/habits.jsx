/* ============================================================
   HABIT ENTITY — HabitRing / HabitCard (V5).

   The habit's visual DNA, shared by Today, Habits, Calendar, Detail
   and Insights: same accent scope, same ring, same status model
   (habitRowModel — never recomputed here), same meta language.
   Ring sizes: sm = rows, md = cards, hero = detail moments.
   ============================================================ */
import { useId } from 'react'
import { accentVars } from '../../lib/accent.js'
import { categoryOf } from '../../lib/schedule.js'
import { Badge, StatusPill } from '../ui/meta.jsx'
import { Dot } from '../ui/meta.jsx'
import { IconCheck, IconChevronRight, IconFlame } from '../../lib/icons.jsx'

const RING_GEOM = {
  sm: { size: 40, stroke: 5 },
  md: { size: 64, stroke: 7 },
  hero: { size: 120, stroke: 10 },
}

/**
 * HabitRing — accent-aware progress ring. pct null = no data (empty
 * track). The bar animates via CSS (transform-free); reduced motion
 * renders the final value with no transition.
 */
export function HabitRing({ pct, size = 'md', accent = null, label, children }) {
  const g = RING_GEOM[size] || RING_GEOM.md
  const gid = useId().replace(/:/g, '')
  const r = (g.size - g.stroke) / 2
  const c = 2 * Math.PI * r
  const has = pct != null
  const clamped = Math.max(0, Math.min(100, pct ?? 0))

  return (
    <span
      className="vring"
      data-size={size}
      style={{ width: g.size, height: g.size, ...accentVars(accent) }}
      role="img"
      aria-label={label || `${Math.round(clamped)} percent`}
    >
      <svg width={g.size} height={g.size} viewBox={`0 0 ${g.size} ${g.size}`} aria-hidden="true" focusable="false"
        style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={`hr-${gid}`} x1="0" y1="0" x2="1" y2="1">
            {accent
              ? (<><stop offset="0%" stopColor="var(--ea-base)" /><stop offset="100%" stopColor="var(--ea-strong)" /></>)
              : (<><stop offset="0%" stopColor="var(--accent-1)" /><stop offset="100%" stopColor="var(--accent-2)" /></>)}
          </linearGradient>
        </defs>
        <circle cx={g.size / 2} cy={g.size / 2} r={r} fill="none"
          stroke="var(--track)" strokeWidth={g.stroke} />
        {has && (
          <circle
            className="vring-bar"
            cx={g.size / 2} cy={g.size / 2} r={r} fill="none"
            stroke={`url(#hr-${gid})`} strokeWidth={g.stroke} strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - clamped / 100)}
          />
        )}
      </svg>
      <span className="vring-center">{children}</span>
    </span>
  )
}

/**
 * HabitCard — V5 habit composition: ring (7-day rate) → name →
 * status/streak/schedule → toggle action.
 *
 * row: describeHabit() model. weekRate: 0..100 | null (no history).
 * onToggle fires only when scheduled today; otherwise the ring opens detail.
 */
export function HabitCard({ row, weekRate = null, onToggle, onDetail }) {
  const { habit, status, scheduledToday, done, streak, schedule, miss, atRisk } = row
  const cat = categoryOf(habit.category)
  const ringLabel = weekRate == null
    ? `${habit.name}: no recent history`
    : `${habit.name}: ${Math.round(weekRate)} percent over the last 7 days`
  const toggleLabel = !scheduledToday
    ? `${habit.name} is not scheduled today. Open details.`
    : done ? `Mark ${habit.name} not done` : `Mark ${habit.name} complete`

  return (
    <article
      className="vhabit"
      data-status={status.id}
      data-done={done || undefined}
      style={accentVars(habit.accent)}
    >
      <button
        type="button"
        className="vhabit-toggle"
        onClick={scheduledToday ? onToggle : onDetail}
        aria-pressed={scheduledToday ? done : undefined}
        aria-label={toggleLabel}
      >
        <HabitRing pct={weekRate} size="md" accent={habit.accent} label={ringLabel}>
          {done ? (
            <IconCheck size={22} aria-hidden="true" />
          ) : streak >= 2 ? (
            <span className="vring-streak" aria-hidden="true">
              <IconFlame size={14} />{streak}
            </span>
          ) : null}
        </HabitRing>
      </button>

      <div className="vhabit-body">
        <button type="button" className="vhabit-name" onClick={onDetail}>
          {habit.name}
        </button>
        <div className="vhabit-meta">
          <StatusPill tone={status.tone}>{status.label}</StatusPill>
          <span className="vhabit-sched">{schedule}</span>
          {streak >= 2 && (
            <span className="vhabit-streak">
              <IconFlame size={13} aria-hidden="true" /> {streak}-day streak
            </span>
          )}
          <Badge tone="neutral" icon={<Dot color={`var(${cat.cssVar})`} />}>{cat.label}</Badge>
        </div>
        {(miss || atRisk) && (
          <div className="vhabit-flags">
            {miss && <StatusPill tone="warn">Missed {miss.label}</StatusPill>}
            {atRisk && <StatusPill tone="warn">Streak at risk</StatusPill>}
          </div>
        )}
      </div>

      <button type="button" className="vhabit-open" onClick={onDetail} aria-label={`Details for ${habit.name}`}>
        <IconChevronRight size={18} />
      </button>
    </article>
  )
}
