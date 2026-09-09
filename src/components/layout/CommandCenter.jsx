/* ============================================================
   COMMAND CENTER — ⌘K / Ctrl+K.

   Four things live here and they are kept visibly separate (E12):
     1. Quick capture — the field at the top, the fast path in.
     2. Commands — things this app can DO.
     3. Search — things this app can FIND.
     4. Coach — deterministic answers from the local engines.

   Merging 2 and 3 into one undifferentiated list is exactly what
   makes a palette unusable, so they get their own tabs.

   Lazy-loaded from App.jsx: neither this file nor quickCapture.js
   enters the initial bundle until ⌘K is pressed.
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from 'react'
import Sheet from '../ui/Sheet.jsx'
import { useStore } from '../../store.jsx'
import { searchAll } from '../../lib/analytics.js'
import { quickActions } from '../../lib/personalization.js'
import { availableCommands, matchCommands, executeCommand, COMMAND_GROUPS } from '../../lib/commandActions.js'
import { matchQuery, runQuery, QUERY_FILTERS } from '../../lib/queryParser.js'
import { navigate } from '../../lib/router.jsx'
import { setIntent, INTENTS } from '../../lib/intents.js'
import { shortDate } from '../../lib/dates.js'
import { routeCoachQuestion, LOCAL_COACH_STATUS } from '../../lib/localCoach.js'
import { CaptureBody } from './QuickCapture.jsx'
import { useHabitUI } from '../habits/HabitUIProvider.jsx'
import {
  IconSearch, IconSparkle, IconPlus, IconTarget, IconProjects, IconAssignment,
  IconLayers, IconTrendUp, IconClock, IconWeek, IconAlert, IconWorkload,
  IconInsights, IconAward,
} from '../../lib/icons.jsx'

const ICONS = {
  IconSparkle, IconPlus, IconTarget, IconProjects, IconAssignment, IconLayers,
  IconTrendUp, IconClock, IconWeek, IconAlert, IconWorkload, IconInsights,
  IconAward, IconSearch,
}

const MODES = [
  { id: 'command', label: 'Commands' },
  { id: 'search', label: 'Search' },
  { id: 'coach', label: 'Coach' },
]

/* Example questions the deterministic local coach can actually answer. */
const COACH_EXAMPLES = [
  'What should I focus on?',
  'Am I at risk on anything?',
  'How is my workload?',
  'How was my week?',
]

const TYPE_META = {
  habit: 'Habit', project: 'Project', 'project-task': 'Project task', assignment: 'Assignment', subtask: 'Subtask',
  goal: 'Goal', milestone: 'Milestone', routine: 'Routine', note: 'Note', date: 'Date', achievement: 'Achievement',
}

export default function CommandCenter({ open, onClose, initialMode = 'command', route = 'today' }) {
  const { state } = useStore()
  const habitUI = useHabitUI()
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState('command')
  const [cursor, setCursor] = useState(0)
  const [nba, setNba] = useState(null)
  const [captureKey, setCaptureKey] = useState(0)
  const [preset, setPreset] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setCursor(0)
    setMode(initialMode === 'create' ? 'create' : initialMode === 'coach' ? 'coach' : initialMode === 'search' ? 'search' : 'command')
    setNba(null)
    setPreset(null)
    setCaptureKey((k) => k + 1)
    // Focus after the sheet's own focus pass so the field is reliably ready.
    const t = setTimeout(() => inputRef.current?.focus(), 30)
    return () => clearTimeout(t)
  }, [open, initialMode])

  /* ---- personalisation: real observations, or the default order ---- */
  const ranked = useMemo(() => quickActions(state, { limit: 4 }), [state])

  const filterMatch = useMemo(() => matchQuery(query), [query])
  const filterResult = useMemo(() => (filterMatch ? runQuery(state, filterMatch.id) : null), [state, filterMatch])

  const commands = useMemo(() => {
    const typed = query.trim() ? matchCommands(query) : []
    if (typed.length) return typed
    return query.trim() ? [] : availableCommands()
  }, [query])

  const candidateSearch = useMemo(() => searchAll(state, query, 30), [state, query])
  const likelyCapture = /\b(finish|complete|add|create|by|today|tomorrow|assignment|project|habit|goal|task|routine)\b/i.test(query)
  const autoSearch = query.trim().length >= 2 && commands.length === 0 && !filterMatch && !likelyCapture && candidateSearch.groups.length > 0
  /* Coach mode owns the query — typing a question must never flip to search. */
  const showSearch = mode !== 'coach' && (mode === 'search' || autoSearch)
  const search = useMemo(() => (showSearch ? candidateSearch : { groups: [], count: 0 }), [showSearch, candidateSearch])
  const coach = useMemo(() => {
    if (!query.trim() || !(/why is .*risk|how did .*week|how was .*week|what should i focus/i.test(query))) return null
    return routeCoachQuestion(query, state)
  }, [query, state])

  /* Coach mode answers the query directly — there is no walkable list. */
  const coachDirect = useMemo(
    () => (mode === 'coach' ? routeCoachQuestion(query, state) : null),
    [mode, query, state],
  )

  /* The flat list the keyboard walks. Commands and search results are
     never interleaved — the mode decides which one is live. */
  const flat = useMemo(() => {
    if (mode === 'coach') return []
    if (showSearch) {
      return search.groups.flatMap((g) => g.items.map((item) => ({ kind: 'result', item, group: g.label })))
    }
    return commands.map((c) => ({ kind: 'command', command: c }))
  }, [mode, showSearch, commands, search])

  useEffect(() => { setCursor(0) }, [query, mode])
  useEffect(() => { if (cursor >= flat.length) setCursor(0) }, [flat.length, cursor])

  /* ---- performing things ---- */

  const run = (commandId) => {
    const res = executeCommand(commandId, state)
    if (!res.ok) return
    const d = res.descriptor
    if (d.kind === 'result') { onClose(); setNba(res.result); return }
    if (d.kind === 'navigate') {
      onClose()
      navigate(d.route)
      if (d.view === 'lab') setIntent('insights-lab')
      return
    }
    if (d.kind === 'open') {
      if (d.target === 'capture') {
        /* "Add habit" is the one Create command with a dedicated, richer
           form (schedule, reminder, notes): open the same HabitForm the
           Habits header and the mobile FAB use, so every entry point edits
           one habit shape. Typed text like "Run every morning" still goes
           through the capture parser + confirm step below. */
        if (d.preset?.type === 'habit' && habitUI?.openAdd) {
          onClose()
          habitUI.openAdd()
          return
        }
        /* Capture is already the field at the top: focus it and carry any
           preset type, rather than stacking a second sheet on top. */
        setPreset(d.preset || null)
        setMode('create')
        inputRef.current?.focus()
        return
      }
      if (d.target === 'search') { setMode('search'); return }
      if (d.target === 'coach') { setQuery(''); setMode('coach'); inputRef.current?.focus(); return }
      if (d.target === 'focus') { onClose(); setIntent(INTENTS.START_FOCUS); navigate('today'); return }
      if (d.target === 'plan-day') { onClose(); setIntent(INTENTS.PLAN_DAY); navigate('today'); return }
      if (d.target === 'plan-week') { onClose(); setIntent(INTENTS.PLAN_WEEK); navigate('today'); return }
    }
  }

  const pickResult = (item) => {
    onClose()
    if (item.type === 'project') return navigate(`projects/${item.id}`)
    if (item.type === 'project-task') return navigate(`projects/${item.projectId}`)
    if (item.type === 'assignment') return navigate(`assignments/${item.id}`)
    if (item.type === 'subtask') return navigate(`assignments/${item.assignmentId}`)
    if (item.type === 'habit') return navigate(`habits/${item.id}`)
    if (item.type === 'goal') return navigate(`goals/${item.id}`)
    if (item.type === 'milestone') return navigate(`goals/${item.goalId}`)
    if (item.type === 'routine') return navigate('habits')
    if (item.type === 'achievement') return navigate('insights?view=achievements')
    if (item.date) return navigate('habits?view=calendar')
    return navigate('insights?view=record')
  }

  const activate = (row) => {
    if (!row) return
    if (row.kind === 'command') run(row.command.id)
    else pickResult(row.item)
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, flat.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
    else if (e.key === 'Enter' && flat[cursor]) { e.preventDefault(); activate(flat[cursor]) }
  }

  /* Roving tabindex: with no tab selected (create mode) the first tab stays reachable. */
  const tabbed = MODES.some((m) => m.id === mode) ? mode : 'command'
  const onTabKeyDown = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const ids = MODES.map((m) => m.id)
    const next = ids[(ids.indexOf(tabbed) + (e.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length]
    setMode(next)
    document.getElementById(`omni-tab-${next}`)?.focus()
  }

  let index = -1

  return (
      <Sheet open={open} onClose={onClose} title={initialMode === 'search' ? 'Search' : initialMode === 'create' ? 'Omni capture' : 'Command center'} labelledBy="command-title">
        <div className="stack command-center" style={{ gap: 14 }}>

          {/* ---- E1/E2: one field, and it is the capture field ---- */}
          <div className="capture-field">
            <label htmlFor="command-input" className="eyebrow">{initialMode === 'search' ? 'Search everything' : 'What do you need to do?'}</label>
            <input
              id="command-input"
              ref={inputRef}
              value={query}
              placeholder="Finish DSA Chapter 4 by Friday — or type a command"
              onChange={(e) => { setQuery(e.target.value); setCaptureKey((k) => k + 1) }}
              onKeyDown={onKeyDown}
              autoComplete="off"
              aria-describedby="command-hint"
            />
            <p id="command-hint" className="tiny muted">
              Type a task and I will show you what it would create before anything is saved.
              Press ↓ ↑ to move, Enter to run, Esc to close.
            </p>
          </div>

          {/* The capture read-out, the ambiguity question and the confirmation
              preview — the same component the standalone sheet uses.
              Hidden in coach mode, where the query is a question, not a draft. */}
          {!showSearch && mode !== 'coach' && <CaptureBody
            key={captureKey}
            bare
            text={query}
            setText={setQuery}
            preset={preset}
            onClose={onClose}
            resetKey={captureKey}
          />}

          {/* ---- natural-language filter answered inline (E13) ---- */}
          {filterMatch && filterResult && (
            <div className="cc-filter" role="status">
              <p className="eyebrow">{filterResult.label}</p>
              <p className="tiny muted">{filterResult.reason}</p>
              {filterResult.enough && (
                <ul className="plain-list">
                  {filterResult.items.slice(0, 8).map((i) => (
                    <li key={`${i.kind}-${i.id}`} className="plain-row">
                      <button type="button" className="linkish" onClick={() => { onClose(); navigate(i.href) }}>{i.name}</button>
                      <span className="muted">{i.sub}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* ---- E14: the next best action, from the existing engine ---- */}
          {nba && (
            <div className="cc-nba" role="status">
              <p className="eyebrow">Next best action</p>
              {nba.enough ? (
                <>
                  <p className="cc-nba-name">{nba.name}</p>
                  <p className="tiny muted">{nba.reason}</p>
                  <dl className="lab-evidence">
                    <div className="lab-ev"><dt>Risk</dt><dd>{nba.risk || '—'}</dd></div>
                    <div className="lab-ev"><dt>Estimated</dt><dd>{nba.estimatedMin == null ? 'Not enough data yet.' : `${nba.estimatedMin} min`}</dd></div>
                    <div className="lab-ev"><dt>Deadline</dt><dd>{nba.deadline ? shortDate(String(nba.deadline).slice(0, 10)) : 'None set'}</dd></div>
                  </dl>
                </>
              ) : <p className="tiny muted">{nba.reason}</p>}
              <button type="button" className="btn ghost sm" onClick={() => setNba(null)}>Dismiss</button>
            </div>
          )}

          {/* These are views of one Omni input, not separate systems. Typing
              still auto-switches to the most useful result type. */}
          <div className="seg seg-wide" role="tablist" aria-label="Omni view" onKeyDown={onTabKeyDown}>
            {MODES.map((m) => (
              <button key={m.id} type="button" role="tab" id={`omni-tab-${m.id}`} aria-selected={mode === m.id}
                aria-controls={`omni-panel-${m.id}`} tabIndex={tabbed === m.id ? 0 : -1}
                className={`seg-btn${mode === m.id ? ' active' : ''}`} onClick={() => setMode(m.id)}>
                {m.label}
              </button>
            ))}
          </div>

          {/* Search, capture and commands share this one input. The result
              sections adapt as the text becomes more specific. */}
          <p className="tiny muted" data-context={route} aria-live="polite">
            {showSearch ? 'Results' : mode === 'create' ? 'Create preview' : mode === 'coach' ? 'Coach' : 'Commands'} · Recent and suggested actions use only real activity.
          </p>

          {/* ---- Coach: the query is the question, answered deterministically ---- */}
          {mode === 'coach' && coachDirect && (
            <section className="cc-nba" role="tabpanel" id="omni-panel-coach" aria-labelledby="omni-tab-coach">
              <p className="eyebrow">Habit OS Coach · {coachDirect.source}</p>
              <p>{coachDirect.summary}</p>
              {coachDirect.evidence?.length > 0 && <ul>{coachDirect.evidence.map((e) => <li key={e}>{e}</li>)}</ul>}
              <p className="tiny muted">Deterministic answers from your Habit OS data · Provider: {LOCAL_COACH_STATUS.provider} · External AI: {LOCAL_COACH_STATUS.externalAI} · Cost: {LOCAL_COACH_STATUS.apiCost}</p>
            </section>
          )}

          {coach && mode !== 'coach' && (
            <section className="cc-nba" role="status" aria-label="Habit OS Coach">
              <p className="eyebrow">Habit OS Coach · {LOCAL_COACH_STATUS.provider}</p>
              <p>{coach.summary}</p>
              <p className="tiny muted">Provider: {LOCAL_COACH_STATUS.provider} · External AI: {LOCAL_COACH_STATUS.externalAI} · Cost: {LOCAL_COACH_STATUS.apiCost}</p>
              {coach.evidence?.length > 0 && <ul>{coach.evidence.map((e) => <li key={e}>{e}</li>)}</ul>}
            </section>
          )}

          {/* ---- Commands ---- */}
          {!showSearch && mode !== 'create' && mode !== 'coach' && (
            <div role="tabpanel" id="omni-panel-command" aria-labelledby="omni-tab-command">
            <div className="cc-list" role="listbox" aria-label="Commands">
              {!query.trim() && ranked.actions.length > 0 && (
                <div className="cc-suggested">
                  <p className="eyebrow">Suggested for you</p>
                  <p className="tiny muted">{ranked.reason}</p>
                  <div className="cap-choices">
                    {ranked.actions.filter((a) => a.id !== 'capture').map((a) => (
                      <button key={a.id} type="button" className="chip"
                        onClick={() => run(a.id === 'add-habit' ? 'add-habit' : a.id === 'start-focus' ? 'start-focus' : a.id === 'plan-day' ? 'plan-day' : a.id === 'review-workload' ? 'view-workload' : a.id === 'view-insights' ? 'view-insights' : a.id === 'add-project' ? 'create-project' : a.id === 'add-assignment' ? 'create-assignment' : 'capture')}>
                        {a.label}
                        {ranked.learned && a.observations > 0 ? <span className="chip-n">{a.observations}</span> : null}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {commands.length === 0 && query.trim() && !filterMatch && (
                <p className="empty-note">No command matches “{query}”. Switch to Search to look through your data.</p>
              )}

              {!query.trim()
                ? COMMAND_GROUPS.map((group) => {
                    const rows = commands.filter((c) => c.group === group)
                    if (!rows.length) return null
                    return (
                      <div key={group}>
                        <p className="search-group-label">{group}</p>
                        {rows.map((c) => {
                          index++
                          const active = index === cursor
                          const Icon = ICONS[c.icon] || IconSparkle
                          return (
                            <button key={c.id} type="button" role="option" aria-selected={active}
                              className="cc-row" data-active={active}
                              onMouseEnter={() => setCursor(index)} onClick={() => run(c.id)}>
                              <span className="cc-icon"><Icon size={16} /></span>
                              <span className="cc-label">{c.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    )
                  })
                : commands.map((c) => {
                    index++
                    const active = index === cursor
                    const Icon = ICONS[c.icon] || IconSparkle
                    return (
                      <button key={c.id} type="button" role="option" aria-selected={active}
                        className="cc-row" data-active={active}
                        onMouseEnter={() => setCursor(index)} onClick={() => run(c.id)}>
                        <span className="cc-icon"><Icon size={16} /></span>
                        <span className="cc-label">{c.label}</span>
                        <span className="tiny muted">{c.group}</span>
                      </button>
                    )
                  })}
            </div>
            </div>
          )}

          {/* ---- Search ---- */}
          {showSearch && (
            <div role="tabpanel" id="omni-panel-search" aria-labelledby="omni-tab-search">
            <div className="cc-list" role="listbox" aria-label="Search results">
              {query.trim().length < 2 && (
                <p className="tiny muted" style={{ lineHeight: 1.6 }}>
                  Search finds what already exists — habits, projects, assignments, notes, dates.
                  Type at least two characters.
                </p>
              )}
              {query.trim().length >= 2 && !search.groups.length && (
                <p className="empty-note">Nothing matches “{query}”.</p>
              )}
              {search.groups.map((group) => (
                <div key={group.id}>
                  <p className="search-group-label">{group.label}</p>
                  {group.items.map((item) => {
                    index++
                    const active = index === cursor
                    return (
                      <button key={`${group.id}-${item.id}`} type="button" role="option" aria-selected={active}
                        className="cc-row" data-active={active}
                        onMouseEnter={() => setCursor(index)} onClick={() => pickResult(item)}>
                        <span className="cc-icon"><IconSearch size={15} /></span>
                        <span className="cc-label">
                          {item.title}
                          {item.sub ? <span className="cc-sub">{item.sub}</span> : null}
                        </span>
                        <span className="tiny muted">{TYPE_META[item.type] || 'Result'}</span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
            </div>
          )}

          {/* ---- coach examples, discoverable ---- */}
          {mode === 'coach' && !query.trim() && (
            <div className="cc-filters">
              <p className="eyebrow">Try asking</p>
              <div className="cap-choices">
                {COACH_EXAMPLES.map((q) => (
                  <button key={q} type="button" className="chip" onClick={() => setQuery(q)}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ---- every supported filter, discoverable ---- */}
          {!query.trim() && mode !== 'coach' && (
            <div className="cc-filters">
              <p className="eyebrow">You can also ask</p>
              <div className="cap-choices">
                {QUERY_FILTERS.map((f) => (
                  <button key={f.id} type="button" className="chip" onClick={() => setQuery(f.hint.split('”')[0].replace('“', ''))}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Sheet>
  )
}
