/* Tiny hash router — back-button friendly, zero dependencies. */
import { useEffect, useState, useCallback } from 'react'

/** Parse the hash without losing query state. */
const parseFull = () => {
  const raw = window.location.hash.replace(/^#\/?/, '') || 'today'
  const [path, queryString = ''] = raw.split('?')
  const parts = path.split('/').filter(Boolean)
  const params = new URLSearchParams(queryString)
  return {
    route: parts[0] || 'today',
    param: parts.slice(1).join('/') || null,
    query: Object.fromEntries(params.entries()),
  }
}

export function useRoute() {
  const [full, setFull] = useState(parseFull)
  useEffect(() => {
    const on = () => setFull(parseFull())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return full
}

/** Navigate while preserving the app's single hash-router contract. */
export const navigate = (to) => {
  window.location.hash = `#/${to}`
  window.scrollTo({ top: 0 })
}

export function useNavigate() {
  return useCallback((to) => navigate(to), [])
}

export function Link({ to, children, className, onClick, ...rest }) {
  return (
    <a
      href={`#/${to}`}
      className={className}
      onClick={(e) => {
        onClick?.(e)
        window.scrollTo({ top: 0 })
      }}
      {...rest}
    >
      {children}
    </a>
  )
}

/** Canonical IA parent for active-state and coverage checks. */
export const canonicalParent = (route) => {
  if (['projects', 'assignments', 'workload', 'timeline', 'work'].includes(route)) return 'work'
  if (['library', 'calendar', 'week', 'habits'].includes(route)) return 'habits'
  if (['mind', 'record', 'achievements', 'insights'].includes(route)) return 'insights'
  return route
}

/** Legacy routes intentionally remain valid; these are their canonical destinations. */
export const legacyRoute = (route) => ({
  library: 'habits',
  timeline: 'work?view=deadlines',
  week: 'habits?view=week',
  mind: 'insights?view=mind',
  record: 'insights?view=record',
  achievements: 'insights?view=achievements',
}[route] || null)
