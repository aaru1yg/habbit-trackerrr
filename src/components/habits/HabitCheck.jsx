import { motion, useReducedMotion } from 'framer-motion'
import { IconCheck } from '../../lib/icons.jsx'

/* Completion checkbox — 44px target, spring-pop, subtle glow. */
export default function HabitCheck({ done, label }) {
  const reduced = useReducedMotion()
  return (
    <motion.span
      className="check-btn"
      role="img"
      aria-hidden="true"
      variants={{
        idle: { scale: 1 },
        done: reduced ? { scale: 1 } : { scale: [1, 1.22, 1] },
      }}
      initial={false}
      animate={done ? 'done' : 'idle'}
      transition={{ duration: 0.34, ease: [0.34, 1.56, 0.64, 1] }}
      style={
        done
          ? {
              background: 'linear-gradient(135deg, var(--accent-1), var(--accent-2))',
              borderColor: 'transparent',
              color: 'var(--accent-ink)',
              boxShadow: '0 4px 16px var(--accent-soft)',
            }
          : undefined
      }
    >
      <motion.span
        initial={false}
        animate={{ opacity: done ? 1 : 0, scale: done ? 1 : 0.4 }}
        transition={reduced ? { duration: 0 } : { duration: 0.18 }}
        style={{ display: 'grid', placeItems: 'center' }}
      >
        <IconCheck size={22} />
      </motion.span>
      <span className="sr-only">{label}</span>
    </motion.span>
  )
}
