/* ============================================================
   COMMAND CENTER — ⌘K / Ctrl+K.

   Three things live here and they are kept visibly separate (E12):
     1. Quick capture — the field at the top, the fast path in.
     2. Commands — things this app can DO.
     3. Search — things this app can FIND.

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
import { CaptureBody } from './QuickCapture.jsx'
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
]

const TYPE_META = {
  habit: 'Habit', project: 'Project', assignment: 'Assignment', routine: 'Routine',
  note: 'Note', date: 'Date', achievement: 'Achievement',
}

export default function CommandCenter({ open, onClose }) {
  const { state } = useStore()
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
    setMode('command')
    setNba(null)
    setPreset(null)
    setCaptureKey((k) => k + 1)
    // Focus after the sheet's own focus pass so the field is reliably ready.
    const t = setTimeout(() => inputRef.current?.focus(), 30)
    return () => clearTimeout(t)
  }, [open])

  /* ---- personalisation: real observations, or the default order ---- */
  const ranked = useMemo(() => quickActions(state, { limit: 4 }), [state])

  const filterMatch = useMemo(() => matchQuery(query), [query])
  const filterResult = useMemo(() => (filterMatch ? runQuery(state, filterMatch.id) : null), [state, filterMatch])

  const commands = useMemo(() => {
    const typed = query.trim() ? matchCommands(query) : []
    if (typed.length) return typed
    return query.trim() ? [] : availableCommands()
  }, [query])

  const search = useMemo(() => (mode === 'search' ? searchAll(state, query, 30) : { groups: [], count: 0 }), [state, query, mode])

  /* The flat list the keyboard walks. Commands and search results are
     never interleaved — the mode decides which one is live. */
  const flat = useMemo(() => {
    if (mode === 'search') {
      return search.groups.flatMap((g) => g.items.map((item) => ({ kind: 'result', item, group: g.label })))
    }
    return commands.map((c) => ({ kind: 'command', command: c }))
  }, [mode, commands, search])

  useEffect(() => { setCursor(0) }, [query, mode])
  useEffect(() => { if (cursor >= flat.length) setCursor(0) }, [flat.length, cursor])

  /* ---- performing things ---- */

  const run = (commandId) => {
    const res = executeCommand(commandId, state)
    if (!res.ok) return
    const d = res.descriptor
    onClose()
    if (d.kind === 'navigate') {
      navigate(d.route)
      if (d.view === 'lab') setIntent('insights-lab')
      return
    }
    if (d.kind === 'result') { setNba(res.result); return }
    if (d.kind === 'open') {
      if (d.target === 'capture') {
        /* Capture is already the field at the top: focus it and carry any
           preset type, rather than stacking a second sheet on top. */
        setPreset(d.preset || null)
        setMode('command')
        inputRef.current?.focus()
        return
      }
      if (d.target === 'search') { setMode('search'); return }
      if (d.target === 'focus') { setIntent(INTENTS.START_FOCUS); navigate('today'); return }
      if (d.target === 'plan-day') { setIntent(INTENTS.PLAN_DAY); navigate('today'); return }
      if (d.target === 'plan-week') { setIntent(INTENTS.PLAN_WEEK); navigate('today'); return }
    }
  }

  const pickResult = (item) => {
    onClose()
    if (item.type === 'project') return navigate(`projects/${item.id}`)
    if (item.type === 'assignment') return navigate(`assignments/${item.id}`)
    if (item.type === 'habit') return navigate('library')
    if (item.type === 'achievement') return navigate('insights')
    if (item.date) return navigate(`calendar/${String(item.date).slice(0, 7)}`)
    return navigate('record')
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

  let index = -1

  return (
      <Sheet open={open} onClose={onClose} title="Command center" labelledBy="command-title">
        <div className="stack command-center" style={{ gap: 14 }}>

          {/* ---- E1/E2: one field, and it is the capture field ---- */}
          <div className="capture-field">
            <label htmlFor="command-input" className="eyebrow">What do you need to do?</label>
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
              preview — the same component the standalone sheet uses. */}
          <CaptureBody
            key={captureKey}
            bare
            text={query}
            setText={setQuery}
            preset={preset}
            onClose={onClose}
            resetKey={captureKey}
          />

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

          {/* ---- E12: command and search are separate, on purpose ---- */}
          <div className="seg seg-wide" role="tablist" aria-label="Command center mode">
            {MODES.map((m) => (
              <button key={m.id} type="button" role="tab" aria-selected={mode === m.id}
                className={`seg-btn${mode === m.id ? ' active' : ''}`} onClick={() => setMode(m.id)}>
                {m.label}
              </button>
            ))}
          </div>

          {/* ---- Commands ---- */}
          {mode === 'command' && (
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
          )}

          {/* ---- Search ---- */}
          {mode === 'search' && (
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
          )}

          {/* ---- every supported filter, discoverable ---- */}
          {!query.trim() && (
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
