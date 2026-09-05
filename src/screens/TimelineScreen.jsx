/* ============================================================
   DEADLINES — the chronological timeline across both systems (§72)
   ============================================================ */
import { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { WorkTabs } from '../components/layout/Navigation.jsx'
import { FilterBar, WorkEmpty, FadeIn } from '../components/work/WorkKit.jsx'
import { WorkRow } from '../components/work/WorkCards.jsx'
import SectionCard from '../components/ui/SectionCard.jsx'
import { deadlineTimeline, TIMELINE_FILTERS } from '../lib/work.js'
import { prettyDate, todayStr } from '../lib/dates.js'
import { IconTimeline } from '../lib/icons.jsx'

export default function TimelineScreen({ route = 'timeline' }) {
  const { state } = useStore()
  const now = new Date()
  const [filter, setFilter] = useState('all')

  const timeline = useMemo(() => deadlineTimeline(state, { filter, now }), [state, filter, now])
  const counts = useMemo(() => {
    const c = {}
    for (const f of TIMELINE_FILTERS) c[f.id] = deadlineTimeline(state, { filter: f.id, now }).count
    return c
  }, [state, now])

  return (
    <div className="screen" id="timeline-screen">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Deadlines</h1>
          <p className="screen-sub">Every project and assignment in chronological order.</p>
        </div>
      </header>

      <div className="stack">
        <WorkTabs route={route} />
        <FilterBar filters={TIMELINE_FILTERS} value={filter} onChange={setFilter} counts={counts} ariaLabel="Filter deadlines" />

        {timeline.count === 0 ? (
          <SectionCard>
            <WorkEmpty icon={<IconTimeline size={40} />} title="No deadlines in this view">
              {filter === 'all'
                ? 'Give a project or assignment a deadline and it lands here in date order.'
                : 'Nothing matches this filter right now.'}
            </WorkEmpty>
          </SectionCard>
        ) : (
          <div className="tl">
            {timeline.groups.map((group, gi) => {
              const tone = group.entries.some((e) => e.status.passed && !e.status.complete)
                ? 'bad'
                : group.entries.some((e) => e.status.id === 'urgent' || e.status.id === 'atRisk')
                  ? 'warn'
                  : undefined
              return (
                <FadeIn key={group.day} delay={Math.min(gi * 0.04, 0.3)}>
                  <div className="tl-group">
                    <p className={`tl-day${group.day === todayStr() ? ' is-today' : ''}`} data-tone={tone}>
                      {group.label} · {prettyDate(group.day)}
                    </p>
                    {group.entries.map((e) => (
                      <WorkRow
                        key={`${e.kind}-${e.item.id}`}
                        kind={e.kind}
                        item={e.item}
                        status={e.status}
                        progressPct={e.status.pct}
                        right={e.kind === 'project' && e.status.hasDeadline ? undefined : undefined}
                      />
                    ))}
                  </div>
                </FadeIn>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
