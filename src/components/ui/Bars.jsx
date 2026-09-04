import { motion, useReducedMotion } from 'framer-motion'

/**
 * Hand-rolled mini bar chart (no chart lib) for tiny inline trends.
 * data: [{ label, value: 0..1 | null }] — null renders a faded stub.
 */
export default function MiniBars({ data, height = 72, highlightLast = true }) {
  const reduced = useReducedMotion()
  return (
    <div role="img" aria-label={data.map((d) => `${d.label}: ${d.value == null ? 'no data' : Math.round(d.value * 100) + '%'}`).join(', ')}
      style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height }}>
      {data.map((d, i) => {
        const v = d.value == null ? 0 : Math.max(0.02, d.value)
        const isLast = highlightLast && i === data.length - 1
        return (
          <div key={d.label + i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%' }}>
            <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', borderRadius: 6, background: 'var(--track)' }}>
              <motion.div
                style={{
                  width: '100%',
                  borderRadius: 6,
                  background: d.value == null
                    ? 'var(--track)'
                    : isLast
                      ? 'linear-gradient(180deg, var(--accent-2), var(--accent-1))'
                      : 'var(--accent-1)',
                  opacity: d.value == null ? 0.4 : 1,
                  boxShadow: isLast && d.value != null ? '0 0 12px var(--accent-soft)' : 'none',
                }}
                initial={false}
                animate={{ height: `${(v) * 100}%` }}
                transition={reduced ? { duration: 0 } : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <span style={{ fontSize: '0.625rem', color: 'var(--text-3)', fontWeight: 600 }}>{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}
