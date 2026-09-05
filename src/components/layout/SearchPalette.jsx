/* ============================================================
   SEARCH (§30) — habits, projects, assignments, routines, notes,
   dates and achievements. Useful after months of data.
   Opens with '/' or the sidebar search button.
   ============================================================ */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../../store.jsx'
import { useHabitUI } from '../habits/HabitUIProvider.jsx'
import Sheet from '../ui/Sheet.jsx'
import { searchAll } from '../../lib/analytics.js'
import { navigate } from '../../lib/router.jsx'
import { shortDate, todayStr } from '../../lib/dates.js'
import { IconSearch, IconFlame, IconProjects, IconAssignment, IconStack, IconNote, IconCalendar, IconAward } from '../../lib/icons.jsx'

const TYPE_META = {
  habit: { Icon: IconFlame, label: 'Habit' },
  project: { Icon: IconProjects, label: 'Project' },
  assignment: { Icon: IconAssignment, label: 'Assignment' },
  routine: { Icon: IconStack, label: 'Routine' },
  note: { Icon: IconNote, label: 'Note' },
  date: { Icon: IconCalendar, label: 'Date' },
  achievement: { Icon: IconAward, label: 'Achievement' },
}

export default function SearchPalette({ open, onClose }) {
  const { state } = useStore()
  const habitUI = useHabitUI()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => { if (open) { setQuery(''); setCursor(0) } }, [open])

  const results = useMemo(() => searchAll(state, query, 30), [state, query])
  const flat = useMemo(() => results.groups.flatMap((g) => g.items.map((item) => ({ ...item, group: g.label }))), [results])

  useEffect(() => { if (cursor >= flat.length) setCursor(0) }, [flat.length, cursor])

  const pick = (item) => {
    onClose()
    if (item.type === 'habit' && item.entity) {
      navigate('library')
      // let the screen mount before opening the detail sheet
      setTimeout(() => habitUI.openDetail(item.entity), 60)
      return
    }
    if (item.type === 'project') return navigate(`projects/${item.id}`)
    if (item.type === 'assignment') return navigate(`assignments/${item.id}`)
    if (item.type === 'routine') return navigate('library')
    if (item.type === 'achievement') return navigate('insights')
    if (item.date) return navigate(`calendar/${String(item.date).slice(0, 7)}`)
    navigate('record')
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, flat.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)) }
    else if (e.key === 'Enter' && flat[cursor]) { e.preventDefault(); pick(flat[cursor]) }
  }

  let index = -1

  return (
    <Sheet open={open} onClose={onClose} title="Search" labelledBy="search-title">
      <div className="stack" style={{ gap: 14 }}>
        <div className="search-field">
          <IconSearch size={17} />
          <label className="sr-only" htmlFor="global-search">Search everything</label>
          <input
            id="global-search"
            ref={inputRef}
            autoFocus
            value={query}
            placeholder="Habits, projects, assignments, notes, dates…"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          {query && <span className="tiny muted tnum">{results.count}</span>}
        </div>

        {!query.trim() && (
          <p className="tiny muted" style={{ lineHeight: 1.6 }}>
            Search across everything on this device. Try a habit name, a subject like “Data Structures”, a note you wrote,
            or a date such as {shortDate(todayStr())}.
          </p>
        )}

        {query.trim().length >= 2 && flat.length === 0 && (
          <p className="empty-note">Nothing matches “{query}”.</p>
        )}

        <div className="search-results">
          {results.groups.map((group) => (
            <div key={group.id}>
              <p className="search-group-label">{group.label}</p>
              {group.items.map((item) => {
                index++
                const active = index === cursor
                const meta = TYPE_META[item.type] || TYPE_META.note
                const Icon = meta.Icon
                return (
                  <button
                    key={`${group.id}-${item.id}`}
                    className="search-result"
                    data-active={active}
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => pick(item)}
                  >
                    <span style={{ color: 'var(--text-3)', flex: 'none', display: 'grid', placeItems: 'center', width: 26 }}>
                      <Icon size={16} />
                    </span>
                    <span className="sr-main">
                      <span className="sr-title">{item.title}</span>
                      {item.sub && <span className="sr-sub">{item.sub}</span>}
                    </span>
                    <span className="tiny muted">{meta.label}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  )
}
