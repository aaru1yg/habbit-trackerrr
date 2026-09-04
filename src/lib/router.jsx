/* Tiny hash router — back-button friendly, zero dependencies. */
import { useEffect, useState, useCallback } from 'react'

const parse = () => {
  const h = window.location.hash.replace(/^#\/?/, '').split('?')[0]
  return h || 'today'
}

/** '#/calendar/2026-03' → { route: 'calendar', param: '2026-03' } */
const parseFull = () => {
  const parts = parse().split('/')
  return { route: parts[0] || 'today', param: parts.slice(1).join('/') || null }
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

export const navigate = (to) => {
  window.location.hash = `#/${to}`
  // ensure scroll reset for the new screen
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
        // let the browser handle hash change; just scroll up
        window.scrollTo({ top: 0 })
      }}
      {...rest}
    >
      {children}
    </a>
  )
}
