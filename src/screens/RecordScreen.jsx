/* ============================================================
   RECORD — the behavioural timeline (§29).
   Derived entirely from stored events: habit starts, notes,
   streak records, project and assignment milestones, reflections
   and badges. Nothing here is invented.
   ============================================================ */
import { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import SectionCard from '../components/ui/SectionCard.jsx'
import { FilterBar, WorkEmpty, FadeIn } from '../components/work/WorkKit.jsx'
import { timelineEvents } from '../lib/analytics.js'
import { prettyDate, shortDate } from '../lib/dates.js'
import { IconTimeline, IconFlame, IconNote, IconProjects, IconAssignment, IconAward, IconMind, IconPlus } from '../lib/icons.jsx'

const FILTERS = [
  { id: 'all', label: 'Everything' },
  { id: 'habit', label: 'Habits' },
  { id: 'work', label: 'Projects & assignments' },
  { id: 'reflection', label: 'Reflections' },
  { id: 'achievement', label: 'Achievements' },
]

const KIND_META = {
  'habit-created': { Icon: IconPlus, group: 'habit', label: 'Habit started' },
  note: { Icon: IconNote, group: 'habit', label: 'Note' },
  streak: { Icon: IconFlame, group: 'habit', label: 'Streak' },
  'project-start': { Icon: IconProjects, group: 'work', label: 'Project started' },
  'project-progress': { Icon: IconProjects, group: 'work', label: 'Project progress' },
  'project-complete': { Icon: IconProjects, group: 'work', label: 'Project complete' },
  'assignment-progress': { Icon: IconAssignment, group: 'work', label: 'Assignment progress' },
  'assignment-complete': { Icon: IconAssignment, group: 'work', label: 'Assignment complete' },
  reflection: { Icon: IconMind, group: 'reflection', label: 'Reflection' },
  achievement: { Icon: IconAward, group: 'achievement', label: 'Achievement' },
}

export default function RecordScreen() {
  const { state } = useStore()
  const [filter, setFilter] = useState('all')

  const events = useMemo(() => timelineEvents(state, 120), [state])
  const filtered = useMemo(() => {
    if (filter === 'all') return events
    const group = filter
    return events.filter((e) => (KIND_META[e.kind]?.group || 'habit') === group)
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
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Record</h1>
          <p className="screen-sub">Your behavioural history, newest first.</p>
        </div>
      </header>

      <div className="stack">
        <FilterBar filters={FILTERS} value={filter} onChange={setFilter} counts={counts} ariaLabel="Filter record" />

        {groups.length === 0 ? (
          <SectionCard>
            <WorkEmpty icon={<IconTimeline size={40} />} title="Nothing recorded yet">
              Check off a habit, log a note, or finish a project — your record builds itself from what actually happened.
            </WorkEmpty>
          </SectionCard>
        ) : (
          <div className="tl">
            {groups.map((group, gi) => (
              <FadeIn key={group.day} delay={Math.min(gi * 0.03, 0.3)}>
                <div className="tl-group">
                  <p className="tl-day">{prettyDate(group.day)}</p>
                  {group.events.map((e, i) => {
                    const meta = KIND_META[e.kind] || { Icon: IconTimeline, label: 'Event' }
                    const Icon = meta.Icon
                    return (
                      <div className="tl-item" key={`${e.day}-${e.title}-${i}`} style={{ cursor: 'default' }}>
                        <span style={{ color: e.tone === 'good' ? 'var(--good)' : 'var(--text-3)', flex: 'none', display: 'grid', placeItems: 'center', width: 28 }}>
                          <Icon size={17} />
                        </span>
                        <span className="tl-main">
                          <span className="tl-name">{e.title}</span>
                          <span className="tl-meta">
                            <span className="tiny muted">{meta.label}</span>
                            {e.body && <span className="tiny soft" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{e.body}</span>}
                          </span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              </FadeIn>
            ))}
          </div>
        )}

        {events.length > 0 && (
          <p className="tiny muted" style={{ textAlign: 'center' }}>
            {events.length} recorded event{events.length === 1 ? '' : 's'} · earliest {shortDate(events[events.length - 1].day)}
          </p>
        )}
      </div>
    </div>
  )
}
