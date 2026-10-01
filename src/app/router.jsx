/* ============================================================
   ROUTER — hash routing in 70 lines.

   Hash routing because the app ships to GitHub Pages as static
   files: no server rewrite rules needed, deep links just work.
   Route shape: #/work/abc123?tab=log
   ============================================================ */
import { createContext, useContext, useEffect, useMemo, useState, useCallback, forwardRef } from 'react'

const RouterCtx = createContext(null)

function read() {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const [path, query] = raw.split('?')
  const parts = path.split('/').filter(Boolean)
  return {
    name: parts[0] || 'today',
    id: parts[1] || null,
    params: new URLSearchParams(query || ''),
  }
}

export function RouterProvider({ children }) {
  const [route, setRoute] = useState(read)

  useEffect(() => {
    const onHash = () => {
      setRoute(read())
      // A route change is a new page: start at the top, unless the
      // user asked for reduced motion (then don't animate at all).
      const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' })
    }
    window.addEventListener('hashchange', onHash)
    if (!window.location.hash) window.location.replace('#/today')
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = useCallback((to, { replace = false } = {}) => {
    const next = `#/${String(to).replace(/^#?\/?/, '')}`
    if (next === window.location.hash) return
    if (replace) window.location.replace(next)
    else window.location.hash = next
  }, [])

  const back = useCallback((fallback = 'today') => {
    if (window.history.length > 1) window.history.back()
    else go(fallback)
  }, [go])

  const value = useMemo(() => ({ ...route, go, back, key: `${route.name}/${route.id || ''}` }), [route, go, back])
  return <RouterCtx.Provider value={value}>{children}</RouterCtx.Provider>
}

export function useRoute() {
  const r = useContext(RouterCtx)
  if (!r) throw new Error('useRoute must be used inside <RouterProvider>')
  return r
}

/** Anchor that keeps hash routing honest: a real href, so
 *  middle-click, cmd-click and "copy link" all behave.
 *  forwardRef so it can be used as a <Surface as={Link}>. */
export const Link = forwardRef(function Link({ to, children, ...rest }, ref) {
  return (
    <a ref={ref} href={`#/${String(to).replace(/^#?\/?/, '')}`} {...rest}>
      {children}
    </a>
  )
})
