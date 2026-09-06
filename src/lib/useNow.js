/* ============================================================
   USE NOW — one shared clock for render-time date maths.

   Screens used to build `new Date()` on every render and then
   deliberately omit it from memo deps (identity changed each
   render). That froze derived labels at mount and fought the
   hooks lint. useNow returns a stable Date that advances on a
   slow interval and when the tab becomes visible again, so memos
   can depend on it honestly and countdowns never go stale while
   the app sits open.
   ============================================================ */
import { useEffect, useState } from 'react'

export default function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs)
    const onVis = () => { if (!document.hidden) setNow(new Date()) }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [intervalMs])
  return now
}
