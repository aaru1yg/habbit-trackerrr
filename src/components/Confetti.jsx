import { AnimatePresence, motion } from 'framer-motion'

const COLORS = ['#ff5d8f', '#ffb703', '#4ade80', '#38bdf8', '#a78bfa', '#22d3ee', '#e879f9', '#f97316']

// Lightweight emoji-free confetti burst. Rendered on each "fire" increment.
export default function Confetti({ fire }) {
  const pieces = Array.from({ length: 44 })
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 2000 }}>
      <AnimatePresence>
        {fire > 0 && (
          <motion.div key={fire} style={{ position: 'absolute', inset: 0 }}>
            {pieces.map((_, i) => {
              const angle = (i / pieces.length) * Math.PI * 2 + (i % 3) * 0.4
              const dist = 120 + (i % 7) * 60
              const x = Math.cos(angle) * dist
              const y = Math.sin(angle) * dist
              const color = COLORS[i % COLORS.length]
              const size = 6 + (i % 5) * 3
              return (
                <motion.div
                  key={i}
                  style={{
                    position: 'absolute',
                    top: '38%',
                    left: '50%',
                    width: size,
                    height: size * (0.5 + (i % 3) * 0.4),
                    borderRadius: i % 3 === 0 ? '50%' : 2,
                    background: color,
                    boxShadow: `0 0 10px ${color}`,
                  }}
                  initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
                  animate={{ x, y: y - 90, opacity: [1, 1, 0], rotate: (i % 2 ? 1 : -1) * (240 + i * 6) }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.5 + (i % 5) * 0.18, ease: [0.16, 1, 0.3, 1] }}
                />
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
