/* ============================================================
   ROUTINE STRIP — habit stacking on Today (§21).
   Compact: routine-level completion first, then the stack.
   ============================================================ */
import { useStore } from '../../store.jsx'
import { Meter } from '../work/WorkKit.jsx'
import { routineStats, activeRoutines, isDone } from '../../lib/stats.js'
import { todayStr } from '../../lib/dates.js'
import { IconCheck, IconStack } from '../../lib/icons.jsx'

export default function RoutineStrip({ date = todayStr(), limit = 3 }) {
  const { state, dispatch } = useStore()
  const routines = activeRoutines(state)
    .map((r) => ({ routine: r, stats: routineStats(state, r, date) }))
    .filter((r) => r.stats.total > 0)
    .slice(0, limit)

  if (!routines.length) return null

  return (
    <div className="stack" style={{ gap: 10 }}>
      {routines.map(({ routine, stats }) => (
        <div key={routine.id} className="routine-card">
          <div className="routine-head" style={{ background: 'transparent', borderBottom: 'none', paddingBottom: 0 }}>
            <span style={{ color: 'var(--accent-2)', flex: 'none', display: 'grid', placeItems: 'center' }}>
              <IconStack size={17} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: 'var(--fs-sm)' }} className="ellipsis">{routine.name}</p>
              <p className="tiny muted tnum">{stats.done} of {stats.total} complete</p>
            </div>
            <span className="meter-pct">{stats.pct == null ? '—' : `${stats.pct}%`}</span>
          </div>
          <div style={{ padding: '10px 14px 12px' }}>
            <Meter pct={stats.pct ?? 0} tone={stats.pct === 100 ? 'good' : undefined} thin
              label={`${routine.name} ${stats.pct ?? 0}% complete`} />
            <div className="wrap-gap" style={{ gap: 6, marginTop: 10 }}>
              {stats.habits.map((h) => {
                const done = isDone(state, h.id, date)
                return (
                  <button
                    key={h.id}
                    type="button"
                    className="btn sm"
                    aria-pressed={done}
                    onClick={() => dispatch({ type: 'TOGGLE_CHECKIN', habitId: h.id, date })}
                    style={{
                      borderRadius: 999,
                      borderColor: done ? 'transparent' : undefined,
                      background: done ? 'var(--good-soft)' : undefined,
                      color: done ? 'var(--good)' : 'var(--text-2)',
                      maxWidth: '100%',
                    }}
                  >
                    {done && <IconCheck size={13} />}
                    <span className="ellipsis" style={{ maxWidth: 160 }}>{h.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
