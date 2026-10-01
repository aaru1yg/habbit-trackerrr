/* ============================================================
   HABIT DETAIL — everything about one habit, nothing about
   anything else.
   ============================================================ */
import { useMemo, useState } from 'react'
import { useRoute, Link } from '../../app/router.jsx'
import { useStore, useActions } from '../../core/store.jsx'
import {
  streak, consistency, progressOn, scheduled, weekdayProfile,
} from '../../core/compute.js'
import { today, lastDays, shift } from '../../core/date.js'
import { CATEGORIES } from '../../core/schema.js'
import {
  Surface, Panel, Button, Badge, Heatmap, Columns, Empty, Confirm, IconButton, Num, Check, Bar,
} from '../../ui/index.jsx'
import { IconBack, IconEdit, IconArchive, IconTrash, IconFlame, IconGoals, IconClock, HabitGlyph } from '../../ui/icons.jsx'
import HabitForm from './HabitForm.jsx'

export default function HabitDetail() {
  const { id, go, back } = useRoute()
  const { habits, checkins, goals } = useStore()
  const actions = useActions()
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const habit = habits.find((h) => h.id === id)

  const data = useMemo(() => {
    if (!habit) return null
    const d = today()
    return {
      st: streak(habit, checkins, d),
      c30: consistency(habit, checkins, 30, d),
      c90: consistency(habit, checkins, 90, d),
      today: progressOn(habit, checkins, d),
      wd: weekdayProfile(habit, checkins, 84, d),
      heat: buildHeat(habit, checkins, 182, d),
      trend: buildTrend(habit, checkins, 12, d),
    }
  }, [habit, checkins])

  if (!habit) {
    return (
      <Surface variant="flat" className="d1">
        <Empty title="Habit not found" body="It may have been deleted." action={<Button onClick={() => go('habits')}>Back to habits</Button>} />
      </Surface>
    )
  }

  const cat = CATEGORIES.find((c) => c.id === habit.category)
  const linked = goals.filter((g) => g.habitIds.includes(habit.id))
  const d = today()
  const due = scheduled(habit, d)

  return (
    <div className="stack stack--loose">
      <div className="row">
        <Button variant="ghost" size="sm" icon={<IconBack size={16} />} onClick={() => back('habits')}>Habits</Button>
      </div>

      {/* ---------- Head ---------- */}
      <Surface variant="lit" className="detail__head rise d2" style={{ '--i': 0 }}>
        <span className="detail__mark">
          <HabitGlyph icon={habit.icon} category={habit.category} size={24} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="detail__title">{habit.name}</div>
          <div className="row row--wrap" style={{ marginTop: 'var(--s2)' }}>
            <Badge tone="neutral">{cat?.label}</Badge>
            <Badge tone="neutral">{cadenceLabel(habit)}</Badge>
            <Badge tone="neutral">{targetLabel(habit)}</Badge>
            {habit.archivedAt && <Badge tone="warn">Archived</Badge>}
          </div>
          {habit.cue && (
            <p className="small muted row" style={{ marginTop: 'var(--s3)', gap: 6 }}>
              <IconClock size={14} /> {habit.cue}
            </p>
          )}
          {habit.notes && <p className="small dim" style={{ marginTop: 'var(--s2)' }}>{habit.notes}</p>}
        </div>
        <div className="row" style={{ gap: 4, flex: 'none' }}>
          <IconButton label="Edit" icon={<IconEdit size={17} />} onClick={() => setEditing(true)} />
          <IconButton label={habit.archivedAt ? 'Unarchive' : 'Archive'} icon={<IconArchive size={17} />} onClick={() => actions.archiveHabit(habit.id)} />
          <IconButton label="Delete" icon={<IconTrash size={17} />} onClick={() => setConfirming(true)} />
        </div>
      </Surface>

      {/* ---------- Today ---------- */}
      <Panel
        title={due ? 'Due today' : 'Not due today'}
        sub={due ? 'Log it right here' : 'You can still log it if you did it'}
        className="rise"
        style={{ '--i': 1 }}
        action={
          habit.target.type === 'done' ? (
            <Check
              checked={data.today.done}
              label={`Mark ${habit.name} done`}
              onChange={(on) => actions.setCheckin(habit.id, d, on ? 1 : 0)}
            />
          ) : null
        }
      >
        {habit.target.type !== 'done' && (
          <div className="stack stack--tight">
            <div className="row row--between">
              <span className="small num">{data.today.value} / {data.today.goal} {habit.target.unit}</span>
              <div className="row" style={{ gap: 6 }}>
                {[1, 5, 10].map((n) => (
                  <Button key={n} size="sm" onClick={() => actions.setCheckin(habit.id, d, data.today.value + n)}>+{n}</Button>
                ))}
                <Button size="sm" variant="primary" onClick={() => actions.setCheckin(habit.id, d, data.today.goal)}>Done</Button>
                {data.today.value > 0 && <Button size="sm" variant="ghost" onClick={() => actions.setCheckin(habit.id, d, 0)}>Clear</Button>}
              </div>
            </div>
            <Bar value={data.today.ratio * 100} />
          </div>
        )}
      </Panel>

      {/* ---------- Numbers ---------- */}
      <div className="grid grid--4 rise" style={{ '--i': 2 }}>
        <Surface variant="flat" lift sheen depth={1} className="tile">
          <div className="stat stat--sm">
            <span className="stat__v row num" style={{ gap: 5, color: data.st.current ? 'var(--urgent)' : undefined }}>
              <IconFlame size={18} /><Num value={data.st.current} />
            </span>
            <span className="stat__k">Current streak</span>
            <span className="stat__sub">{data.st.unit === 'week' ? 'weeks' : 'days'} in a row</span>
          </div>
        </Surface>
        <Surface variant="flat" lift sheen depth={1} className="tile">
          <div className="stat stat--sm">
            <span className="stat__v num"><Num value={data.st.best} /></span>
            <span className="stat__k">Best streak</span>
          </div>
        </Surface>
        <Surface variant="flat" lift sheen depth={1} className="tile">
          <div className="stat stat--sm">
            <span className="stat__v num"><Num value={Math.round(data.c30.rate * 100)} />%</span>
            <span className="stat__k">Last 30 days</span>
            <span className="stat__sub">{data.c30.hit} of {data.c30.due} due days</span>
          </div>
        </Surface>
        <Surface variant="flat" lift sheen depth={1} className="tile">
          <div className="stat stat--sm">
            <span className="stat__v num"><Num value={Math.round(data.c90.rate * 100)} />%</span>
            <span className="stat__k">Last 90 days</span>
            <span className="stat__sub">{data.c90.hit} of {data.c90.due} due days</span>
          </div>
        </Surface>
      </div>

      {/* ---------- Charts ---------- */}
      <div className="grid grid--2 rise" style={{ '--i': 3 }}>
        <Panel title="Six months" sub="One square per day, darker is closer to target">
          <Heatmap cells={data.heat} today={d} />
        </Panel>
        <Panel title="Weekly trend" sub="Completion rate over the last 12 weeks">
          {data.trend.some((v) => v > 0) ? (
            <Columns
              data={data.trend.map((v, i) => ({ value: v, title: `${data.trend.length - i} weeks ago: ${v}%` }))}
              labels={data.trend.map((_, i, a) => (i === 0 ? '12w' : i === a.length - 1 ? 'Now' : ''))}
              height={110}
              max={100}
              ceiling
            />
          ) : (
            <Empty title="Not enough history" body="Come back after a couple of weeks of check-ins." />
          )}
        </Panel>
      </div>

      {/* ---------- Pattern ---------- */}
      <Panel title="Day-of-week pattern" sub="Needs at least three due days per weekday to say anything" className="rise" style={{ '--i': 4 }}>
        {data.wd.best ? (
          <>
            <p className="small muted" style={{ marginBottom: 'var(--s4)' }}>
              Strongest on <strong>{dayName(data.wd.best.dow)}</strong> ({Math.round(data.wd.best.rate * 100)}%),
              weakest on <strong>{dayName(data.wd.worst.dow)}</strong> ({Math.round(data.wd.worst.rate * 100)}%).
            </p>
            <div className="stack stack--tight">
              {[1, 2, 3, 4, 5, 6, 0].map((i) => {
                const b = data.wd.buckets[i]
                return (
                  <div key={i} className="row" style={{ gap: 'var(--s3)' }}>
                    <span className="tiny dim" style={{ width: 34 }}>{dayName(i)}</span>
                    <Bar value={(b.rate ?? 0) * 100} thin className="spacer" />
                    <span className="tiny num faint" style={{ width: 62, textAlign: 'right' }}>
                      {b.due ? `${Math.round((b.rate ?? 0) * 100)}% · ${b.due}d` : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <Empty title="Not enough data yet" body="Once each weekday has three due days of history, the pattern appears here." />
        )}
      </Panel>

      {/* ---------- Goals ---------- */}
      {linked.length > 0 && (
        <Panel title="Feeds into" className="rise" style={{ '--i': 5 }}>
          <div className="pill-row">
            {linked.map((g) => (
              <Link key={g.id} to={`goal/${g.id}`} className="chip"><IconGoals size={13} /> {g.title}</Link>
            ))}
          </div>
        </Panel>
      )}

      <HabitForm open={editing} onClose={() => setEditing(false)} habit={habit} />
      <Confirm
        open={confirming}
        title={`Delete “${habit.name}”?`}
        body="This removes the habit and every check-in it has. There is no undo. Export a backup from Settings first if you might want it back."
        onConfirm={() => { actions.removeHabit(habit.id); go('habits') }}
        onClose={() => setConfirming(false)}
      />
    </div>
  )
}

/* ---------------- helpers --------------------------------- */

function buildHeat(habit, checkins, window, ref) {
  const goal = Math.max(1, habit.target.goal || 1)
  // Pad to a whole week so the 7-row grid reads as real weeks.
  const days = lastDays(window, ref)
  const lead = (new Date(days[0]).getDay() + 6) % 7
  const padded = [...Array.from({ length: lead }, (_, i) => shift(days[0], -(lead - i))), ...days]
  return padded.map((day) => {
    const v = checkins?.[habit.id]?.[day]?.value ?? 0
    const ratio = v / goal
    const level = !scheduled(habit, day) && v === 0 ? 0
      : ratio >= 1 ? 4 : ratio >= 0.66 ? 3 : ratio >= 0.33 ? 2 : ratio > 0 ? 1 : 0
    return { day, level, title: v ? `${v}/${goal}` : scheduled(habit, day) ? 'missed' : 'not due' }
  })
}

function buildTrend(habit, checkins, weeks, ref) {
  const goal = Math.max(1, habit.target.goal || 1)
  const out = []
  for (let w = weeks - 1; w >= 0; w--) {
    const end = shift(ref, -w * 7)
    let due = 0
    let hit = 0
    for (let i = 0; i < 7; i++) {
      const day = shift(end, -i)
      if (!scheduled(habit, day)) continue
      due++
      if ((checkins?.[habit.id]?.[day]?.value ?? 0) >= goal) hit++
    }
    out.push(due ? Math.round((hit / due) * 100) : 0)
  }
  return out
}

const dayName = (i) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]

function cadenceLabel(h) {
  if (h.cadence.type === 'daily') return 'Every day'
  if (h.cadence.type === 'weekly') return `${h.cadence.perWeek}× a week`
  return h.cadence.days.map(dayName).join(' · ')
}

function targetLabel(h) {
  if (h.target.type === 'done') return 'Done / not done'
  if (h.target.type === 'minutes') return `${h.target.goal} min a day`
  return `${h.target.goal} ${h.target.unit} a day`
}
