/* ============================================================
   COMMAND PALETTE — search, navigation and quick-add in one.

   v4 had four of these (SearchPalette, CommandCenter, OmniPanel,
   QuickCapture) that each knew about different entities. This is
   the only one, and it is the only place that needs to learn
   about a new entity type.

   Quick-add grammar, deliberately tiny and discoverable:
     h  Read 20 pages        → habit
     t  Email the landlord   → task
     p  Dissertation         → project
     g  Run a half marathon  → goal
   Anything else searches.
   ============================================================ */
import { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRoute } from './router.jsx'
import { NAV } from './nav.js'
import { useStore, useActions } from '../core/store.jsx'
import { workProgress } from '../core/compute.js'
import { Surface, useToast } from '../ui/index.jsx'
import {
  IconSearch, IconPlus, IconHabits, IconWork, IconGoals, IconLayers, IconChevron,
} from '../ui/icons.jsx'

const PREFIX = {
  h: { kind: 'habit',   label: 'habit',   Icon: IconHabits },
  t: { kind: 'task',    label: 'task',    Icon: IconWork },
  p: { kind: 'project', label: 'project', Icon: IconLayers },
  g: { kind: 'goal',    label: 'goal',    Icon: IconGoals },
}

export default function CommandPalette({ open, onClose }) {
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const { go } = useRoute()
  const state = useStore()
  const actions = useActions()
  const toast = useToast()
  const listRef = useRef(null)

  useEffect(() => { if (open) { setQ(''); setCursor(0) } }, [open])

  const results = useMemo(() => buildResults(q, state), [q, state])

  useEffect(() => { setCursor(0) }, [q])
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  if (!open) return null

  const run = (item) => {
    if (!item) return
    if (item.run === 'go') go(item.to)
    if (item.run === 'add') {
      const title = item.title
      if (item.kind === 'habit') { actions.addHabit({ name: title }); toast(`Habit “${title}” added`, 'good') }
      if (item.kind === 'task') { actions.addWork({ kind: 'task', title }); toast(`Task “${title}” added`, 'good') }
      if (item.kind === 'project') { actions.addWork({ kind: 'project', title }); toast(`Project “${title}” added`, 'good') }
      if (item.kind === 'goal') { actions.addGoal({ title }); toast(`Goal “${title}” added`, 'good') }
      go(item.kind === 'habit' ? 'habits' : item.kind === 'goal' ? 'goals' : 'work')
    }
    onClose()
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(results.length - 1, c + 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)) }
    if (e.key === 'Enter') { e.preventDefault(); run(results[cursor]) }
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  let lastGroup = null

  return createPortal(
    <div className="scrim" style={{ alignItems: 'flex-start', paddingTop: '12vh' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <Surface variant="float" className="sheet cmd" role="dialog" aria-modal="true" aria-label="Search and commands">
        <input
          className="cmd__input"
          placeholder="Search — or type  h / t / p / g  then a name to add"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          autoFocus
          aria-label="Search or add"
        />
        <div className="cmd__list" ref={listRef} role="listbox">
          {results.length === 0 && (
            <div className="cmd__group small dim" style={{ padding: 'var(--s5)', textAlign: 'center' }}>
              Nothing matches “{q}”.
            </div>
          )}
          {results.map((r, i) => {
            const header = r.group !== lastGroup ? ((lastGroup = r.group), r.group) : null
            return (
              <div key={r.key}>
                {header && <div className="cmd__group eyebrow">{header}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === cursor}
                  data-active={i === cursor}
                  className="cmd__item"
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => run(r)}
                >
                  <span className="cmd__ico">{r.icon}</span>
                  <span style={{ minWidth: 0 }}>
                    <span className="clamp1">{r.label}</span>
                    {r.sub && <span className="tiny faint clamp1">{r.sub}</span>}
                  </span>
                  <span className="cmd__meta">{r.meta}</span>
                </button>
              </div>
            )
          })}
        </div>
      </Surface>
    </div>,
    document.body
  )
}

function buildResults(q, state) {
  const query = q.trim()
  const out = []

  /* ---- Quick add ---- */
  const m = query.match(/^([htpg])\s+(.{1,120})$/i)
  if (m) {
    const spec = PREFIX[m[1].toLowerCase()]
    const title = m[2].trim()
    out.push({
      key: 'add', group: 'Create', run: 'add', kind: spec.kind, title,
      icon: <IconPlus size={16} />,
      label: `Add ${spec.label} “${title}”`,
      meta: 'Enter',
    })
    return out
  }

  const needle = query.toLowerCase()
  const match = (s) => !needle || String(s || '').toLowerCase().includes(needle)

  /* ---- Entities ---- */
  const habits = state.habits.filter((h) => !h.archivedAt && match(h.name)).slice(0, 6)
  for (const h of habits) {
    out.push({
      key: `h${h.id}`, group: 'Habits', run: 'go', to: `habit/${h.id}`,
      icon: <span style={{ fontSize: 14 }}>{h.icon}</span>,
      label: h.name, sub: h.cue || null, meta: h.category,
    })
  }

  const work = state.work.filter((w) => !w.archivedAt && match(w.title)).slice(0, 6)
  for (const w of work) {
    out.push({
      key: `w${w.id}`, group: 'Work', run: 'go', to: `work/${w.id}`,
      icon: w.kind === 'project' ? <IconLayers size={16} /> : <IconWork size={16} />,
      label: w.title, sub: w.kind === 'project' ? `${w.tasks.length} tasks` : null,
      meta: w.doneAt ? 'done' : `${workProgress(w)}%`,
    })
  }

  const goals = state.goals.filter((g) => match(g.title)).slice(0, 4)
  for (const g of goals) {
    out.push({
      key: `g${g.id}`, group: 'Goals', run: 'go', to: `goal/${g.id}`,
      icon: <IconGoals size={16} />, label: g.title, meta: g.doneAt ? 'reached' : '',
    })
  }

  /* ---- Navigation ---- */
  for (const n of NAV) {
    if (!match(n.label) && !match(n.hint)) continue
    out.push({
      key: `n${n.id}`, group: 'Go to', run: 'go', to: n.id,
      icon: <n.Icon size={16} />, label: n.label, sub: n.hint, meta: <IconChevron size={13} />,
    })
  }

  /* ---- Hint when empty ---- */
  if (!query) {
    out.unshift({
      key: 'hint', group: 'Create', run: 'noop',
      icon: <IconSearch size={16} />,
      label: 'Type  h  t  p  g  followed by a name',
      sub: 'habit · task · project · goal',
      meta: '',
    })
  }

  return out.filter((r) => r.run !== 'noop' || !query)
}
