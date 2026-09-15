/* ============================================================
   RECORD (§29) — the behavioural timeline.
   What actually happened. Derived entirely from stored events.
   Nothing invented, no empty-state heroics.
   ============================================================ */
import { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import SectionCard, { CardHead } from '../components/ui/SectionCard.jsx'
import { FilterBar, FadeIn } from '../components/work/WorkKit.jsx'
import { timelineEvents } from '../lib/analytics.js'
import { prettyDate, shortDate } from '../lib/dates.js'
import {
  IconTimeline, IconFlame, IconNote, IconProjects,
  IconAssignment, IconAward, IconMind, IconPlus,
} from '../lib/icons.jsx'

const FILTERS = [
  { id: 'all', label: 'Everything' },
  { id: 'habit', label: 'Habits' },
  { id: 'work', label: 'Projects & assignments' },
  { id: 'reflection', label: 'Reflections' },
  { id: 'achievement', label: 'Achievements' },
]

const KIND_META = {
  'habit-created':     { Icon: IconPlus,       group: 'habit',       label: 'Habit started' },
  note:                { Icon: IconNote,       group: 'habit',       label: 'Note' },
  streak:              { Icon: IconFlame,      group: 'habit',       label: 'Streak' },
  'project-start':     { Icon: IconProjects,   group: 'work',        label: 'Project started' },
  'project-progress':  { Icon: IconProjects,   group: 'work',        label: 'Project progress' },
  'project-complete':  { Icon: IconProjects,   group: 'work',        label: 'Project complete' },
  'assignment-progress': { Icon: IconAssignment, group: 'work',      label: 'Assignment progress' },
  'assignment-complete': { Icon: IconAssignment, group: 'work',      label: 'Assignment complete' },
  reflection:          { Icon: IconMind,       group: 'reflection',  label: 'Reflection' },
  achievement:         { Icon: IconAward,      group: 'achievement', label: 'Achievement' },
}

/* ---------- Signal header: what you see at a glance ---------- */
function RecordHeader({ events }) {
  const total = events.length
  const firstDay = total ? events[events.length - 1].day : null
  const habits = events.filter((e) => KIND_META[e.kind]?.group === 'habit').length
  const work = events.filter((e) => KIND_META[e.kind]?.group === 'work').length
  const reflections = events.filter((e) => (KIND_META[e.kind]?.group) === 'reflection').length
  return (
    <div className="rec-head">
      <p className="insights-eyebrow">Record</p>
      <h1 className="screen-title">What actually happened</h1>
      <p className="screen-sub rec-sub">
        Every check-in, note, streak milestone and completed task, newest first.
      </p>
      <div className="rec-stats" role="list" aria-label="Record summary">
        <div className="rec-stat" role="listitem">
          <span className="rec-stat-num">{total}</span>
          <span className="rec-stat-lbl">recorded events</span>
        </div>
        <div className="rec-stat" role="listitem">
          <span className="rec-stat-num">{habits}</span>
          <span className="rec-stat-lbl">habit events</span>
        </div>
        <div className="rec-stat" role="listitem">
          <span className="rec-stat-num">{work}</span>
          <span className="rec-stat-lbl">work events</span>
        </div>
        <div className="rec-stat" role="listitem">
          <span className="rec-stat-num">{reflections}</span>
          <span className="rec-stat-lbl">reflections</span>
        </div>
        {firstDay && (
          <div className="rec-stat" role="listitem">
            <span className="rec-stat-num">{shortDate(firstDay)}</span>
            <span className="rec-stat-lbl">earliest entry</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function RecordScreen() {
  const { state } = useStore()
  const [filter, setFilter] = useState('all')

  const events = useMemo(() => timelineEvents(state, 180), [state])
  const filtered = useMemo(() => {
    if (filter === 'all') return events
    return events.filter((e) => (KIND_META[e.kind]?.group || 'habit') === filter)
  }, [events, filter])

  const counts = useMemo(() => {
    const c = { all: events.length }
    for (const f of FILTERS.slice(1)) c[f.id] = events.filter((e) => (KIND_META[e.kind]?.group || 'habit') === f.id).length
    return c
  }, [events])

  const groups = useMemo(() => {
    const out = []
    for (const e of filtered) {
      const last = out[out.length - 1]
      if (last && last.day === e.day) last.events.push(e)
      else out.push({ day: e.day, events: [e] })
    }
    return out
  }, [filtered])

  return (
    <div className="screen" id="record-screen">
      <RecordHeader events={events} />

      <div className="stack">
        <FilterBar filters={FILTERS} value={filter} onChange={setFilter} counts={counts} ariaLabel="Filter record" />

        {groups.length === 0 ? (
          <SectionCard>
            <CardHead
              eyebrow="Nothing yet"
              title="Your record starts with one event"
              sub="Check off a habit, log a note, or finish a project. Your record builds itself from what you do."
            />
          </SectionCard>
        ) : (
          <ol className="tl rec-tl" aria-label="Record timeline">
            {groups.map((group, gi) => (
              <FadeIn key={group.day} delay={Math.min(gi * 0.025, 0.3)}>
                <li className="tl-group">
                  <p className="tl-day">{prettyDate(group.day)}</p>
                  <ol className="tl-group-items">
                    {group.events.map((e, i) => {
                      const meta = KIND_META[e.kind] || { Icon: IconTimeline, label: 'Event' }
                      const Icon = meta.Icon
                      return (
                        <li className="tl-item rec-item" key={`${e.day}-${e.title}-${i}`}>
                          <span className="rec-icon" aria-hidden="true">
                            <Icon size={16} />
                          </span>
                          <span className="tl-main">
                            <span className="tl-name">{e.title}</span>
                            <span className="tl-meta">
                              <span className="tiny rec-kind">{meta.label}</span>
                              {e.body && (
                                <span className="tiny soft rec-body">
                                  {e.body}
                                </span>
                              )}
                            </span>
                          </span>
                        </li>
                      )
                    })}
                  </ol>
                </li>
              </FadeIn>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
