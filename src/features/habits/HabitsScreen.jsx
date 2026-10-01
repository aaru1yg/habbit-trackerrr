/* ============================================================
   HABITS — the list, the month grid and the week review, as
   three tabs of one screen instead of three routes that each
   re-derived their own numbers.
   ============================================================ */
import { useMemo, useState } from 'react'
import { useStore } from '../../core/store.jsx'
import {
  scheduled, progressOn, streak, consistency, dayScore,
} from '../../core/compute.js'
import {
  today, monthOf, fmtMonth, shift, weekOf, fmtInitial, fmtShort, isFuture, 
} from '../../core/date.js'
import {
  Surface, Panel, Button, Segmented, Empty, SectionHead, Bar, Columns, IconButton,
} from '../../ui/index.jsx'
import { IconPlus, IconHabits, IconChevron, IconBack, IconFlame, HabitGlyph } from '../../ui/icons.jsx'
import HabitRow from './HabitRow.jsx'
import HabitForm from './HabitForm.jsx'

const TABS = [
  { value: 'list', label: 'List' },
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
]

export default function HabitsScreen() {
  const { habits, checkins } = useStore()
  const [tab, setTab] = useState('list')
  const [adding, setAdding] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const active = habits.filter((h) => !h.archivedAt)
  const archived = habits.filter((h) => h.archivedAt)

  if (!habits.length) {
    return (
      <>
        <Surface variant="flat" className="d1">
          <Empty
            icon={<IconHabits size={24} />}
            title="No habits yet"
            body="A habit is anything you want to repeat. Start with one; you can add more once it sticks."
            action={<Button variant="primary" icon={<IconPlus size={16} />} onClick={() => setAdding(true)}>Add a habit</Button>}
          />
        </Surface>
        <HabitForm open={adding} onClose={() => setAdding(false)} />
      </>
    )
  }

  return (
    <div className="stack stack--loose">
      <SectionHead
        eyebrow="Repeat"
        title="Habits"
        sub={`${active.length} active${archived.length ? ` · ${archived.length} archived` : ''}`}
        action={
          <div className="row">
            <Segmented options={TABS} value={tab} onChange={setTab} label="Habit view" />
            <Button variant="primary" size="sm" icon={<IconPlus size={15} />} onClick={() => setAdding(true)}>New</Button>
          </div>
        }
      />

      {tab === 'list' && (
        <ListView
          habits={active}
          archived={archived}
          checkins={checkins}
          showArchived={showArchived}
          onToggleArchived={() => setShowArchived((v) => !v)}
        />
      )}
      {tab === 'month' && <MonthView habits={active} checkins={checkins} />}
      {tab === 'week' && <WeekView habits={active} checkins={checkins} />}

      <HabitForm open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

/* ============================================================
   LIST — grouped by what is due today, with consistency.
   ============================================================ */
function ListView({ habits, archived, checkins, showArchived, onToggleArchived }) {
  const d = today()
  const due = habits.filter((h) => scheduled(h, d))
  const rest = habits.filter((h) => !scheduled(h, d))

  return (
    <div className="stack">
      <section className="rise" style={{ '--i': 0 }}>
        <SectionHead title="Due today" sub={`${due.filter((h) => progressOn(h, checkins, d).done).length} of ${due.length} done`} />
        {due.length ? (
          <Surface variant="flat" className="d1">
            {due.map((h) => <HabitRow key={h.id} habit={h} checkins={checkins} day={d} />)}
          </Surface>
        ) : (
          <Surface variant="flat" className="d1"><Empty title="Nothing due today" body="Your cadences give you the day off." /></Surface>
        )}
      </section>

      {rest.length > 0 && (
        <section className="rise" style={{ '--i': 1 }}>
          <SectionHead title="Not due today" sub="You can still log them" />
          <Surface variant="flat" className="d1">
            {rest.map((h) => <HabitRow key={h.id} habit={h} checkins={checkins} day={d} />)}
          </Surface>
        </section>
      )}

      <section className="rise" style={{ '--i': 2 }}>
        <SectionHead title="30-day consistency" sub="Only days the habit was actually due are counted" />
        <Surface variant="flat" className="d1" style={{ padding: 'var(--s4)' }}>
          <div className="stack stack--tight">
            {habits.map((h) => {
              const c = consistency(h, checkins, 30)
              const st = streak(h, checkins)
              return (
                <div key={h.id} className="row" style={{ gap: 'var(--s4)' }}>
                  <HabitGlyph icon={h.icon} category={h.category} size={15} />
                  <span className="small clamp1" style={{ flex: '0 0 30%', minWidth: 0 }}>{h.name}</span>
                  <Bar value={c.rate * 100} thin className="spacer" />
                  <span className="tiny num dim" style={{ width: 92, textAlign: 'right' }}>
                    {Math.round(c.rate * 100)}% · {c.hit}/{c.due}
                  </span>
                  <span
                    className="tiny num row"
                    style={{ width: 46, gap: 3, justifyContent: 'flex-end', color: st.current ? 'var(--urgent)' : 'var(--faint)' }}
                    title={`${st.current} ${st.unit === 'week' ? 'week' : 'day'} streak`}
                  >
                    <IconFlame size={11} />{st.current}
                  </span>
                </div>
              )
            })}
          </div>
        </Surface>
      </section>

      {archived.length > 0 && (
        <section className="rise" style={{ '--i': 3 }}>
          <Button variant="ghost" size="sm" onClick={onToggleArchived}>
            {showArchived ? 'Hide' : 'Show'} {archived.length} archived
          </Button>
          {showArchived && (
            <Surface variant="flat" className="d1" style={{ marginTop: 'var(--s3)' }}>
              {archived.map((h) => <HabitRow key={h.id} habit={h} checkins={checkins} day={d} showStreak={false} />)}
            </Surface>
          )}
        </section>
      )}
    </div>
  )
}

/* ============================================================
   MONTH — the auto-building grid. One cell per day, filled by
   that day’s completion. Future days are locked.
   ============================================================ */
function MonthView({ habits, checkins }) {
  const now = new Date()
  const [y, setY] = useState(now.getFullYear())
  const [m, setM] = useState(now.getMonth())
  const [sel, setSel] = useState(today())

  const days = useMemo(() => monthOf(y, m), [y, m])
  const scores = useMemo(
    () => Object.fromEntries(days.map((x) => [x.date, dayScore(habits, checkins, x.date)])),
    [days, habits, checkins]
  )

  const step = (by) => {
    const dt = new Date(y, m + by, 1)
    setY(dt.getFullYear()); setM(dt.getMonth())
  }

  const lead = days.length ? (days[0].weekday + 6) % 7 : 0 // Monday-first
  const summary = days.reduce(
    (acc, x) => {
      const s = scores[x.date]
      if (s.due) { acc.due += s.due; acc.done += s.done; acc.tracked++ }
      return acc
    },
    { due: 0, done: 0, tracked: 0 }
  )
  const selDue = habits.filter((h) => scheduled(h, sel))

  return (
    <div className="stack">
      <Panel
        title={fmtMonth(y, m)}
        sub={summary.due ? `${Math.round((summary.done / summary.due) * 100)}% across ${summary.tracked} tracked days` : 'Nothing logged this month'}
        action={
          <div className="row" style={{ gap: 4 }}>
            <IconButton label="Previous month" icon={<IconBack size={16} />} onClick={() => step(-1)} />
            <IconButton label="Next month" icon={<IconChevron size={16} />} onClick={() => step(1)} />
          </div>
        }
      >
        <div className="cal">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i} className="cal__dow">{d}</div>)}
          {Array.from({ length: lead }, (_, i) => <div key={`p${i}`} />)}
          {days.map((x) => {
            const s = scores[x.date]
            const future = isFuture(x.date)
            const pct = s.due ? s.ratio : 0
            return (
              <button
                key={x.date}
                type="button"
                className="cal__day"
                disabled={future}
                data-today={x.date === today()}
                data-sel={x.date === sel}
                onClick={() => setSel(x.date)}
                aria-label={`${x.date}: ${s.done} of ${s.due} habits`}
              >
                <span className="cal__fill" style={{ transform: `scaleY(${pct})` }} aria-hidden="true" />
                <span className="cal__n num">{x.n}</span>
                {s.due > 0 && !future && <span className="cal__n tiny faint num">{s.done}/{s.due}</span>}
              </button>
            )
          })}
        </div>
      </Panel>

      <Panel title={fmtShort(sel)} sub={selDue.length ? `${selDue.length} habits due` : 'Nothing was due'}>
        {selDue.length ? (
          selDue.map((h) => <HabitRow key={h.id} habit={h} checkins={checkins} day={sel} showStreak={false} />)
        ) : (
          <p className="small dim">No habits were scheduled on this day.</p>
        )}
      </Panel>
    </div>
  )
}

/* ============================================================
   WEEK — the review: per-day completion and per-habit hits.
   ============================================================ */
function WeekView({ habits, checkins }) {
  const [anchor, setAnchor] = useState(today())
  const days = useMemo(() => weekOf(anchor), [anchor])
  const scores = useMemo(() => days.map((d) => dayScore(habits, checkins, d)), [days, habits, checkins])

  const totals = scores.reduce((a, s) => ({ done: a.done + s.done, due: a.due + s.due }), { done: 0, due: 0 })

  return (
    <div className="stack">
      <Panel
        title={`${fmtShort(days[0])} – ${fmtShort(days[6])}`}
        sub={totals.due ? `${totals.done} of ${totals.due} check-ins · ${Math.round((totals.done / totals.due) * 100)}%` : 'Nothing due this week'}
        action={
          <div className="row" style={{ gap: 4 }}>
            <IconButton label="Previous week" icon={<IconBack size={16} />} onClick={() => setAnchor(shift(days[0], -1))} />
            <IconButton label="Next week" icon={<IconChevron size={16} />} onClick={() => setAnchor(shift(days[6], 1))} />
          </div>
        }
      >
        <Columns
          data={scores.map((s, i) => ({ value: Math.round(s.ratio * 100), title: `${days[i]}: ${s.done}/${s.due}` }))}
          labels={days.map(fmtInitial)}
          height={100}
          max={100}
          ceiling
        />
      </Panel>

      <Panel title="Per habit" sub="A dot for every day it was due">
        <div className="stack stack--tight">
          {habits.map((h) => (
            <div key={h.id} className="row" style={{ gap: 'var(--s3)' }}>
              <HabitGlyph icon={h.icon} category={h.category} size={15} />
              <span className="small clamp1" style={{ flex: 1, minWidth: 0 }}>{h.name}</span>
              <div className="row" style={{ gap: 4 }}>
                {days.map((d) => {
                  const due = scheduled(h, d)
                  const p = progressOn(h, checkins, d)
                  return (
                    <span
                      key={d}
                      title={`${d}${due ? '' : ' (not due)'}`}
                      style={{
                        width: 15, height: 15, borderRadius: 'var(--r-xs)', boxSizing: 'border-box',
                        background: p.done ? 'var(--accent)' : p.started ? 'rgb(var(--accent-rgb)/.4)' : due ? 'var(--sunken)' : 'transparent',
                        border: p.done ? '1px solid var(--accent)' : due ? '1px solid var(--rule)' : '1px dashed var(--rule)',
                      }}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}
