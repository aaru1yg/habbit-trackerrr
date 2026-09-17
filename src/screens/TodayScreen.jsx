import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { useHabitUI } from '../components/habits/HabitUIProvider.jsx'
import NextAction from '../components/today/NextAction.jsx'
import TodayWorkList from '../components/today/TodayWorkList.jsx'
import TodaySignals from '../components/today/TodayContext.jsx'
import PlanningPanel from '../components/today/PlanningPanel.jsx'
import FocusMode from '../components/today/FocusMode.jsx'
import { Button, Progress } from '../components/primitives/index.js'
import { takeIntent, onIntent, INTENTS } from '../lib/intents.js'
import { todayStr, prettyDate, dayStr } from '../lib/dates.js'
import { activeHabits, todayStats, isDone, eligibleOn, dayStats, habitStreak } from '../lib/stats.js'
import { todayHeadline, todayPriorities } from '../lib/today.js'
import { getTodayPriorities, workloadCapacity } from '../lib/adaptive.js'
import { recoveryPlan } from '../lib/planning.js'
import { isScheduled } from '../lib/schedule.js'
import { preferencesOf } from '../lib/personalization.js'
import { assignmentProgress, projectProgress } from '../lib/work.js'
import { Link } from '../lib/router.jsx'
import {
  IconPlus, IconTarget, IconClock, IconCalendar, IconMind, IconChevronRight, IconFlame,
} from '../lib/icons.jsx'

export default function TodayScreen({ onFire: _onFire, onCapture: _onCapture, onSearch: _onSearch }) {
  const { state, dispatch } = useStore()
  const habitUI = useHabitUI()
  // Reference composition state: list filter chips (All / Habits / Work).
  const [listFilter, setListFilter] = useState('all')
  const today = todayStr()
  const now = useMemo(() => new Date(), [])
  const prefs = preferencesOf(state)
  const capacityMin = prefs.dailyCapacityMin

  const stats = useMemo(() => todayStats(state), [state])
  const habitsToday = useMemo(
    () => activeHabits(state).filter((h) => isScheduled(h, today) && eligibleOn(h, today)),
    [state, today]
  )

  /* Adaptive intelligence — real deterministic selectors, unchanged. For the
     Today screen we filter candidates to items actually relevant to today
     (scheduled habits, work with deadlines, overdue, or high-priority open
     items) so that a habit scheduled only on Mon/Wed/Fri doesn't show up as
     "now" on Thursday. */
  const todayRelevant = useMemo(() => {
    const isHabitScheduledToday = (h) => isScheduled(h, today) && eligibleOn(h, today)
    const isWorkRelevant = (it) => {
      // assignments/projects with deadlines (overdue, due soon, or high priority)
      if (it.deadline) {
        const dl = new Date(it.deadline)
        const weekEnd = new Date(today + 'T23:59:59'); weekEnd.setDate(weekEnd.getDate() + 7)
        if (dl <= weekEnd) return true
      }
      if (it.priority === 'high') return true
      return false
    }
    const isTaskOrMilestoneRelevant = (it) => {
      if (it.due && it.due <= today) return true
      return false
    }
    return { isHabitScheduledToday, isWorkRelevant, isTaskOrMilestoneRelevant }
  }, [today])

  const adaptive = useMemo(() => {
    const todayFilter = (item) => {
      if (item.kind === 'habit') return todayRelevant.isHabitScheduledToday(item)
      if (item.kind === 'assignment' || item.kind === 'project') return todayRelevant.isWorkRelevant(item)
      if (item.kind === 'project-task' || item.kind === 'goal-milestone') return todayRelevant.isTaskOrMilestoneRelevant(item)
      return true
    }
    const allPriorities = getTodayPriorities(state, { now, limit: 20, capacityMin })
    const priorities = allPriorities.filter((p) => todayFilter(p.item)).slice(0, 6)
    // Build NBA from filtered candidates
    const next = (() => {
      // Re-use the ranked list but only from today-relevant items
      const ranked = priorities
      if (!ranked.length) return null
      const best = ranked[0]
      return {
        item: best.item,
        reason: humanWhy(best),
        urgency: best.risk.id,
        estimatedMin: best.remainingMin,
        deadline: best.item.deadline || null,
        signals: best.signals,
      }
    })()
    const workload = workloadCapacity({ availableMin: capacityMin, items: priorities.map((p) => p.item) })
    return { priorities, next, workload }
  }, [state, capacityMin, now, todayRelevant])

  /* Work that is due today / overdue for the attention signal */
  const deadlineNear = useMemo(() => {
    let n = 0
    const isDueSoon = (deadline) => {
      if (!deadline) return false
      const d = new Date(deadline)
      const todayEnd = new Date(today + 'T23:59:59')
      return d <= todayEnd
    }
    for (const a of state.assignments || []) {
      if (a.archived || a.completedAt) continue
      if (isDueSoon(a.deadline)) n++
    }
    for (const p of state.projects || []) {
      if (p.archived || p.completedAt) continue
      if (isDueSoon(p.deadline)) n++
    }
    return n
  }, [state, today])

  /* Top attention item — first overdue/due-today item for the attention signal.
     Priority: overdue assignments > overdue projects > due-today assignments > due-today projects. */
  const attentionLead = useMemo(() => {
    const todayStart = new Date(today + 'T00:00:00')
    const todayEnd = new Date(today + 'T23:59:59')
    const order = []
    for (const a of state.assignments || []) {
      if (a.archived || a.completedAt || !a.deadline) continue
      const d = new Date(a.deadline)
      if (d > todayEnd) continue
      order.push({ name: a.name || a.title, href: `assignments/${a.id}`, overdue: d < todayStart, ts: d.getTime() })
    }
    for (const p of state.projects || []) {
      if (p.archived || p.completedAt || !p.deadline) continue
      const d = new Date(p.deadline)
      if (d > todayEnd) continue
      order.push({ name: p.name, href: `projects/${p.id}`, overdue: d < todayStart, ts: d.getTime() })
    }
    order.sort((a, b) => (b.overdue - a.overdue) || (a.ts - b.ts))
    return order[0] || null
  }, [state, today])

  /* Semantic tone for Today signals */
  const signalsTone = useMemo(() => {
    if (stats.total > 0 && stats.done === stats.total) return 'completed'
    if (adaptive.workload?.overloaded) return 'overloaded'
    if (adaptive.workload?.remainingMin != null && adaptive.workload.remainingMin < 30) return 'tight'
    if (deadlineNear > 0) return 'tight'
    return 'neutral'
  }, [stats, adaptive.workload, deadlineNear])

  /* Recovery plan (quiet, behind tools). */
  const recovery = useMemo(() => recoveryPlan(state, { now }), [state, now])

  /* Plan/Focus open-tick plumbing — consumed from the existing intent bus. */
  const [focusTick, setFocusTick] = useState(0)
  const [planTick, setPlanTick] = useState(0)
  useEffect(() => {
    const consume = (intent) => {
      if (!intent) return
      takeIntent()
      if (intent === INTENTS.PLAN_DAY || intent === INTENTS.PLAN_WEEK) setPlanTick((n) => n + 1)
      else if (intent === INTENTS.START_FOCUS) setFocusTick((n) => n + 1)
    }
    consume(takeIntent())
    return onIntent(consume)
  }, [])

  /* Unified Today's Work list — habits + priorities deduplicated.
     Order: overdue → due today → undone habits (by priority then order)
     → remaining open assignments/projects → milestones/tasks (light touch). */
  const workItems = useMemo(() => buildWorkList(state, today, now, adaptive), [state, today, now, adaptive])

  /* Determine which Now variant we are in. The NBA from adaptive includes
     non-scheduled habits (habit library items), so we filter "next" to items
     actually relevant today for the empty-state decision. */
  const allHabitsDone = habitsToday.length > 0 && habitsToday.every((h) => isDone(state, h.id, today))
  const nextIsTodayRelevant = adaptive.next && (
    adaptive.next.item.kind !== 'habit'
    || habitsToday.some((h) => h.id === adaptive.next.item.id)
  )
  const nothingScheduled = habitsToday.length === 0 && !nextIsTodayRelevant
    && adaptive.priorities.filter((p) => p.item.kind !== 'habit' || habitsToday.some((h) => h.id === p.item.id)).length === 0
  const overloaded = adaptive.workload.overloaded && nextIsTodayRelevant

  const headline = useMemo(() => todayHeadline(state, { now }), [state, now])
  // Reference "Today at a glance" numbers + week strip + streaks card.
  const overdueCount = useMemo(
    () => todayPriorities(state, { now, limit: 99 }).filter((pr) => pr.tone === 'bad').length,
    [state, now],
  )
  const completedCount = useMemo(() => workItems.reduce((n, row) => {
    if (row.kind === 'habit') return n + (isDone(state, row.item.id, today) ? 1 : 0)
    return n + ((row.progress ?? 0) >= 100 ? 1 : 0)
  }, 0), [workItems, state, today])
  const weekStrip = useMemo(() => {
    const base = new Date(now)
    base.setDate(base.getDate() - ((base.getDay() + 6) % 7)) // Monday
    return [...Array(7)].map((_, i) => {
      const d = new Date(base)
      d.setDate(base.getDate() + i)
      return dayStats(state, dayStr(d))
    })
  }, [state, now])
  const topStreaks = useMemo(
    () => activeHabits(state)
      .map((h) => ({ h, days: habitStreak(state, h) }))
      .filter((x) => x.days > 0)
      .sort((a, b) => b.days - a.days)
      .slice(0, 4),
    [state],
  )
  const kindCounts = useMemo(() => ({
    habit: workItems.filter((r) => r.kind === 'habit').length,
    work: workItems.filter((r) => r.kind !== 'habit').length,
  }), [workItems])

  const completeNext = (entry) => {
    const item = entry?.item
    if (!item) return
    const kind = entry.kind
    if (kind === 'habit') dispatch({ type: 'TOGGLE_CHECKIN', habitId: item.id, date: today })
    else if (kind === 'assignment') dispatch({ type: 'SET_ASSIGNMENT_PROGRESS', id: item.id, pct: 100 })
    else if (kind === 'project-task') dispatch({ type: 'TOGGLE_TASK', projectId: item.projectId, milestoneId: item.milestoneId, taskId: item.id })
    else if (kind === 'goal-milestone') dispatch({ type: 'TOGGLE_GOAL_MILESTONE', id: item.goalId, milestoneId: item.id })
  }

  const openFocus = () => setFocusTick((n) => n + 1)
  const openPlan = () => setPlanTick((n) => n + 1)

  /* Determine which Now variant we are in. Priority:
     1. empty   — nothing scheduled AND no NBA
     2. done    — all habits done AND no NBA and not overloaded
     3. overloaded — workload exceeds capacity AND there IS something to act on
                     (we show this even with undone habits so the user sees it
                     *before* grinding through a list they can't finish)
     4. next    — default: show the next best action */
  const nowMode = nothingScheduled && !adaptive.next
    ? 'empty'
    : overloaded
      ? 'overloaded'
      : allHabitsDone && !adaptive.next
        ? 'done'
        : 'next'



  return (
    <div className="screen today" id="today-screen">
      {/* 1. PAGE HEADER — compact, not a hero. */}
      <header className="today__header" aria-label="Today">
        <div>
          <h1>Today</h1>
          <p className="today__date">{prettyDate(today)}{headline?.text ? ` · ${headline.text}` : ''}</p>
        </div>
        {stats.total > 0 && (
          <div className="today__header-meta" aria-label="Today's progress">
            <span className="today__header-count">
              <span className="tdy-countline">
                {stats.done} of {stats.total} <strong>completed</strong>
              </span>
              <strong className="tdy-headpct">{stats.pct || 0}%</strong>
            </span>
            <span className="today-progress__bar tdy-bar"><Progress value={stats.pct || 0} /></span>
          </div>
        )}
      </header>

      {/* Reference layout (designer sheet): row 1 = Next up + Today at a
          glance; row 2 = Today's work + quick actions/art; lower band =
          Daily progress + Current streaks + Today's insights; full-width
          quote bar closes the page. */}
      <div className="tdy-body">
      {/* 2. NEXT UP — compact priority card (kept .today-now contract). */}
      <NextAction
        mode={nowMode}
        entry={adaptive.next ? { ...adaptive.next, kind: adaptive.next.item.kind } : null}
        stats={stats}
        workload={adaptive.workload}
        today={today}
        state={state}
        onComplete={completeNext}
        onFocus={openFocus}
        onStart={openPlan}
      />

      {/* 2b. TODAY AT A GLANCE — four compact stats (reference top-right). */}
      <section className="tdy-card tdy-glance" aria-labelledby="tdy-glance-heading">
        <h2 id="tdy-glance-heading" className="tdy-card__title">Today at a glance</h2>
        <ul className="tdy-glance__list">
          <li><span className="tdy-glance__ico" data-tone="total" aria-hidden="true"><IconTarget size={14} /></span><span className="tdy-glance__num">{workItems.length}</span><span className="tdy-glance__label">Total</span></li>
          <li><span className="tdy-glance__ico" data-tone="done" aria-hidden="true">✓</span><span className="tdy-glance__num">{completedCount}</span><span className="tdy-glance__label">Completed</span></li>
          <li><span className="tdy-glance__ico" data-tone="overdue" aria-hidden="true">!</span><span className="tdy-glance__num">{overdueCount}</span><span className="tdy-glance__label">Overdue</span></li>
          <li><span className="tdy-glance__ico" data-tone="remaining" aria-hidden="true">◦</span><span className="tdy-glance__num">{Math.max(0, workItems.length - completedCount)}</span><span className="tdy-glance__label">Remaining</span></li>
        </ul>
      </section>

      {/* 3. TODAY'S WORK — the primary surface, with kind filter chips. */}
      <section className="today-section" aria-labelledby="todays-work-heading" data-filter={listFilter}>
        <div className="today-section__head">
          <div>
            <h2 id="todays-work-heading" className="today-section__title">Today's work</h2>
            <p className="today-section__sub">Habits, assignments, and tasks in priority order.</p>
          </div>
          <div className="today-section__head-actions">
            <span className="today-section__count">{remainingCount(workItems, state, today)} remaining</span>
            <Button variant="quiet" size="sm" icon={<IconPlus size={14} />} onClick={habitUI.openAdd}>Add habit</Button>
          </div>
        </div>
        {workItems.length > 0 && (
          <div className="tdy-chiprow" role="group" aria-label="Filter today's list">
            <button type="button" className={`tdy-chipbtn${listFilter === 'all' ? ' is-active' : ''}`} aria-pressed={listFilter === 'all'} onClick={() => setListFilter('all')}>All ({workItems.length})</button>
            <button type="button" className={`tdy-chipbtn${listFilter === 'habit' ? ' is-active' : ''}`} aria-pressed={listFilter === 'habit'} onClick={() => setListFilter('habit')}>Habits ({kindCounts.habit})</button>
            <button type="button" className={`tdy-chipbtn${listFilter === 'work' ? ' is-active' : ''}`} aria-pressed={listFilter === 'work'} onClick={() => setListFilter('work')}>Work ({kindCounts.work})</button>
          </div>
        )}
        {workItems.length === 0 ? (
          <p className="today-list__empty">
            {nothingScheduled
              ? 'No habits scheduled. Add one to start building a routine.'
              : 'Everything on your list is done.'}
          </p>
        ) : (
          <TodayWorkList items={workItems} today={today} />
        )}
      </section>

      {/* Recovery note (overloaded, when recoveryPlan has suggestions). */}
      {overloaded && recovery.keep.length > 0 && (
        <p className="today-overload" role="note">
          <strong>Suggestion:</strong> {recovery.explanation}
        </p>
      )}

      {/* 4. SIDE — quick actions + art (reference right column). */}
      <div className="tdy-side">

        <section className="tdy-card tdy-quick" aria-labelledby="tdy-quick-heading">
          <h2 id="tdy-quick-heading" className="tdy-card__title">Quick actions</h2>
          <nav className="tdy-quick__list" aria-label="Today utilities">
            <button type="button" className="tdy-quick__row" onClick={openFocus} aria-label="Open focus mode">
              <span className="tdy-quick__ico" data-tone="accent" aria-hidden="true"><IconClock size={16} /></span>
              <span className="tdy-quick__body"><span className="tdy-quick__title">Start focus</span><span className="tdy-quick__sub">25 min Pomodoro</span></span>
              <IconChevronRight size={14} aria-hidden="true" />
            </button>
            <button type="button" className="tdy-quick__row" onClick={openPlan} aria-label="Open day planner">
              <span className="tdy-quick__ico" data-tone="plan" aria-hidden="true"><IconTarget size={16} /></span>
              <span className="tdy-quick__body"><span className="tdy-quick__title">Plan my day</span><span className="tdy-quick__sub">Time block</span></span>
              <IconChevronRight size={14} aria-hidden="true" />
            </button>
            {recovery?.keep?.length > 0 && (
              <button type="button" className="tdy-quick__row" onClick={() => setPlanTick((n) => n + 1)} aria-label="View recovery suggestions">
                <span className="tdy-quick__ico" data-tone="recover" aria-hidden="true"><IconMind size={16} /></span>
                <span className="tdy-quick__body"><span className="tdy-quick__title">Recovery</span><span className="tdy-quick__sub">Get unstuck</span></span>
                <IconChevronRight size={14} aria-hidden="true" />
              </button>
            )}
            <Link className="tdy-quick__row" to="habits?view=calendar" aria-label="Open calendar view">
              <span className="tdy-quick__ico" data-tone="calendar" aria-hidden="true"><IconCalendar size={16} /></span>
              <span className="tdy-quick__body"><span className="tdy-quick__title">Open calendar</span><span className="tdy-quick__sub">View month</span></span>
              <IconChevronRight size={14} aria-hidden="true" />
            </Link>
          </nav>
        </section>


        <div className="tdy-art" aria-hidden="true">
          <img src="art/scene-hero.webp" alt="" loading="lazy" />
          <p>Small steps every day lead to big changes.</p>
        </div>

      </div>

      {/* 5. LOWER BAND — daily progress, current streaks, today's insights. */}
      <div className="tdy-lower">
      {/* 4. DAILY PROGRESS — week strip answers "how consistent am I?". */}
      <section className="tdy-card tdy-progress" aria-labelledby="tdy-progress-heading">
        <div className="tdy-progress__head">
          <div>
            <h2 id="tdy-progress-heading" className="tdy-card__title">Daily progress</h2>
            <p className="tdy-progress__sub">{stats.total ? 'Your consistency this week.' : 'Nothing scheduled for today yet.'}</p>
          </div>
          {stats.total > 0 && <span className="tdy-progress__pct">{stats.pct || 0}%</span>}
        </div>
        {stats.total > 0 && <span className="today-progress__bar tdy-bar tdy-bar--lg"><Progress value={stats.pct || 0} /></span>}
        <div className="tdy-week" role="list" aria-label="This week's completion">
          {weekStrip.map((d, i) => (
            <div key={d.date} role="listitem" className={`tdy-day${d.date === today ? ' is-today' : ''}${d.date > today ? ' is-future' : ''}${d.total ? '' : ' is-off'}`}>
              <span className="tdy-day__mark" aria-hidden="true">
                <svg className="tdy-day__ring" viewBox="0 0 24 24" data-state={d.date > today ? 'future' : d.total ? (d.done >= d.total ? 'done' : 'partial') : 'off'} focusable="false">
                  <circle className="tdy-day__ring-track" cx="12" cy="12" r="10" fill="none" strokeWidth="3.5" />
                  {d.date <= today && d.total > 0 && (
                    <circle
                      className="tdy-day__ring-arc"
                      cx="12" cy="12" r="10" fill="none" strokeWidth="3.5" strokeLinecap="round"
                      strokeDasharray={`${Math.max(2, Math.round((100 * d.done / d.total) * 0.6283))} 62.83`}
                      transform="rotate(-90 12 12)"
                    />
                  )}
                </svg>
              </span>
              <span className="tdy-day__label">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}</span>
              <span className="tdy-day__num">{d.date > today ? '' : d.total ? `${d.done}/${d.total}` : '–'}</span>
            </div>
          ))}
        </div>
      </section>

        <section className="tdy-card tdy-streaks" aria-labelledby="tdy-streaks-heading">
          <div className="tdy-streaks__head">
            <h2 id="tdy-streaks-heading" className="tdy-card__title">Current streaks</h2>
            <Link className="tdy-streaks__more" to="habits?view=calendar">View calendar →</Link>
          </div>
          {topStreaks.length === 0 ? (
            <p className="tdy-streaks__empty">Complete a habit today to start a streak.</p>
          ) : (
            <ul className="tdy-streaks__list">
              {topStreaks.map(({ h, days }) => (
                <li key={h.id}>
                  <Link to={`habits/${h.id}`} className="tdy-streaks__row">
                    <span className="tdy-streaks__dot" style={{ background: `var(${h.category ? `--cat-${h.category}` : '--accent'})` }} aria-hidden="true" />
                    <span className="tdy-streaks__name">{h.name}</span>
                    <span className="tdy-streaks__days"><IconFlame size={12} aria-hidden="true" /> {days} days</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

      <TodaySignals
        stats={stats}
        workload={adaptive.workload}
        attentionCount={deadlineNear}
        attentionLead={attentionLead}
        sectionTone={signalsTone}
      />
      </div>

      <p className="tdy-quotebar" role="note">
        <span className="tdy-quotebar__main">"Progress, not perfection."</span>
        <span className="tdy-quotebar__sub">You've got this! <span className="tdy-quotebar__heart" aria-hidden="true">♥</span></span>
      </p>
      </div>

      {/* Panels mount on first open and unmount on dismiss so the closed
         "Plan my day" card and ghost "Focus mode" button never live inline
         under Today. Each panel receives an onClose that resets its tick;
         the tick going to 0 (or the panel never having been opened) removes
         it from the DOM entirely. */}
      {planTick > 0 && <PlanningPanel state={state} now={now} openTick={planTick} defaultOpen onClose={() => setPlanTick(0)} />}
      {focusTick > 0 && <FocusMode state={state} dispatch={dispatch} now={now} openTick={focusTick} defaultOpen onClose={() => setFocusTick(0)} />}
    </div>
  )
}

/** Build a unified, deduplicated Today's Work list. */
function buildWorkList(state, today, now, adaptive) {
  const seen = new Set()
  const rows = []
  const add = (key, row) => { if (seen.has(key)) return; seen.add(key); rows.push({ key, ...row }) }

  // 1. Habits scheduled today (in user-defined order) — the backbone
  for (const h of activeHabits(state)) {
    if (!isScheduled(h, today) || !eligibleOn(h, today)) continue
    add(`habit:${h.id}`, {
      kind: 'habit',
      item: h,
      name: h.name,
      href: `habits/${h.id}`,
      deadline: h.reminder ? `${today}T${h.reminder}` : null,
      estimateMin: h.estimateMin ?? null,
      reason: null,
    })
  }

  // 2. Overdue assignments
  for (const a of state.assignments || []) {
    if (a.archived || a.completedAt) continue
    const p = assignmentProgress(a).pct
    if (p >= 100) continue
    if (a.deadline && new Date(a.deadline) < new Date(today + 'T00:00:00')) {
      add(`assignment:${a.id}`, {
        kind: 'assignment', item: a, name: a.name, href: `assignments/${a.id}`,
        progress: p, deadline: a.deadline, estimateMin: a.estimateMin ?? null,
        reason: 'Overdue',
      })
    }
  }

  // 3. Due-today assignments
  for (const a of state.assignments || []) {
    if (a.archived || a.completedAt) continue
    const p = assignmentProgress(a).pct
    if (p >= 100) continue
    const dl = a.deadline ? new Date(a.deadline) : null
    const todayEnd = new Date(today + 'T23:59:59')
    if (dl && dl >= new Date(today + 'T00:00:00') && dl <= todayEnd) {
      add(`assignment:${a.id}`, {
        kind: 'assignment', item: a, name: a.name, href: `assignments/${a.id}`,
        progress: p, deadline: a.deadline, estimateMin: a.estimateMin ?? null,
        reason: 'Due today',
      })
    }
  }

  // 4. Due-today projects + tasks within projects
  for (const p of state.projects || []) {
    if (p.archived || p.completedAt) continue
    const pr = projectProgress(p).pct
    if (pr >= 100) continue
    const dl = p.deadline ? new Date(p.deadline) : null
    const todayEnd = new Date(today + 'T23:59:59')
    if (dl && dl <= todayEnd) {
      add(`project:${p.id}`, {
        kind: 'project', item: p, name: p.name, href: `projects/${p.id}`,
        progress: pr, deadline: p.deadline, estimateMin: p.estimateMin ?? null,
        reason: dl < new Date(today + 'T00:00:00') ? 'Overdue' : 'Due today',
      })
    }
    for (const m of p.milestones || []) {
      for (const t of m.tasks || []) {
        if (t.done) continue
        if (t.due === today) {
          add(`task:${p.id}:${m.id}:${t.id}`, {
            kind: 'project-task', item: { ...t, projectId: p.id, milestoneId: m.id },
            name: t.name, href: `projects/${p.id}`,
            deadline: t.due || m.due || p.deadline,
            estimateMin: t.estimateMin ?? null,
            reason: `Task in ${p.name} · due today`,
          })
        }
      }
    }
  }

  // 5. Remaining high-priority open work from adaptive (if not already added)
  for (const entry of adaptive.priorities.slice(0, 4)) {
    const it = entry.item
    if (it.kind === 'habit') continue // already added
    if (it.kind === 'assignment') {
      add(`assignment:${it.id}`, {
        kind: 'assignment', item: it, name: it.name, href: `assignments/${it.id}`,
        progress: assignmentProgress(it).pct, deadline: it.deadline, estimateMin: it.estimateMin ?? null,
        reason: entry.reasons?.[0] || null,
      })
    } else if (it.kind === 'project') {
      add(`project:${it.id}`, {
        kind: 'project', item: it, name: it.name, href: `projects/${it.id}`,
        progress: projectProgress(it).pct, deadline: it.deadline, estimateMin: it.estimateMin ?? null,
        reason: entry.reasons?.[0] || null,
      })
    }
  }

  return rows
}

function remainingCount(items, state, today) {
  let n = 0
  for (const r of items) {
    if (r.kind === 'habit') {
      if (!state.checkins?.[r.item.id]?.[today]?.done) n++
    } else if (r.kind === 'assignment' || r.kind === 'project') {
      if ((r.progress ?? 0) < 100) n++
    } else if (r.kind === 'project-task' || r.kind === 'goal-milestone') {
      if (!r.item?.done) n++
    } else n++
  }
  return n
}

/** Produce a short, human "why" sentence for the next best action.
 * Avoids the robotic "because it is X and Y and Z" engine phrasing; picks
 * the single most useful signal for the user right now. */
function humanWhy(best) {
  const { item, reasons = [], risk } = best
  const kind = item.kind
  const dl = item.deadline ? new Date(item.deadline) : null
  const todayStart = new Date(todayStr() + 'T00:00:00')
  const todayEnd = new Date(todayStr() + 'T23:59:59')
  const isOverdue = dl && dl < todayStart
  const isDueToday = dl && dl >= todayStart && dl <= todayEnd
  let pct = null
  if (kind === 'assignment') pct = assignmentProgress(item).pct
  else if (kind === 'project') pct = projectProgress(item).pct
  const hasStreak = reasons.some(r => /streak|momentum/i.test(r))
  const behind = reasons.some(r => /behind|pace|progress/i.test(r))

  if (isOverdue) {
    return `This was due ${dl.toLocaleDateString(undefined,{month:'short',day:'numeric'})}. Clearing it first keeps today from compounding.`
  }
  if (isDueToday) {
    const t = dl.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})
    return `Due today at ${t}.${pct != null && pct > 0 && pct < 100 ? ` You're ${Math.round(pct)}% through.` : ' Knock it out before the day fills up.'}`
  }
  if (risk.id === 'CRITICAL' || risk.id === 'OVERDUE') {
    return `This is the tightest thing on your plate right now.`
  }
  if (behind && pct != null && pct > 0 && pct < 100) {
    return `You're partway through and momentum helps — one more push.`
  }
  if (hasStreak) {
    return `Small, steady — a quick win that keeps your streak alive.`
  }
  if (kind === 'habit') {
    return `A short habit that sets the tone for the rest of the day.`
  }
  if (kind === 'project' || kind === 'assignment') {
    return `Most time-sensitive open work on your list.`
  }
  return `A clean next step. Once it's moving, the rest of the day opens up.`
}
