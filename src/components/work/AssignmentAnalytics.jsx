import { useState } from 'react'
import { SegControl } from '../ui/controls.jsx'
import SectionCard, { CardHead } from '../ui/SectionCard.jsx'
import { LineSeries, BucketColumns, TimeVsWorkBars } from '../charts/workCharts.jsx'
import { progressSeries, entityVelocity, timeVsWork } from '../../lib/work.js'
import { dayStr, subDaysStr } from '../../lib/dates.js'
export default function AssignmentAnalytics({ assignment, now }) {
  const [range, setRange] = useState(14)
  const today = dayStr(now)
  const series = progressSeries(assignment, subDaysStr(today, range - 1), today)
  const velocity = entityVelocity(assignment, Math.min(range, 30), now)
  const tvw = timeVsWork(assignment, 'assignment', now)
  return <>            {/* Analytics */}
            <SectionCard className="pad">
              <CardHead title="Daily progress">
                <SegControl label="Range" value={range} onChange={setRange} options={[7, 14, 30].map((d) => ({ id: d, label: `${d}D` }))} />
              </CardHead>
              {(assignment.progressLog || []).length ? (
                <LineSeries
                  series={[{ id: 'pct', label: 'Progress', color: 'var(--accent-2)', points: series.map((r) => ({ date: r.date, value: r.pct })) }]}
                  height={180}
                  ariaLabel="Assignment progress over time"
                />
              ) : (
                <p className="empty-note">Every progress change is logged with a timestamp — this line starts with your first update.</p>
              )}
            </SectionCard>

            <div className="split">
              <SectionCard className="pad">
                <CardHead title="Time vs work" />
                {tvw ? (
                  <TimeVsWorkBars elapsedPct={tvw.elapsedPct} workPct={tvw.workPct} behind={tvw.behind} ahead={tvw.ahead} />
                ) : (
                  <p className="empty-note">Needs both an assigned date and a deadline.</p>
                )}
              </SectionCard>

              <SectionCard className="pad">
                <CardHead title="Work velocity" />
                {velocity.some((v) => v.count) ? (
                  <BucketColumns rows={velocity.map((v) => ({ label: v.date.slice(5).replace('-', '/'), value: v.count, color: 'var(--accent-1)' }))} height={104} />
                ) : (
                  <p className="empty-note">Complete subtasks to see how fast the work is moving.</p>
                )}
              </SectionCard>
            </div>

</>
}
