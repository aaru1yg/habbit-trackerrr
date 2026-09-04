import { motion, useReducedMotion } from 'framer-motion'

/* Card with optional whileInView entrance (staggered by index). */
export default function SectionCard({ children, className = '', delay = 0, style, as: Tag = 'section' }) {
  const reduced = useReducedMotion()
  const MotionTag = motion[Tag] || motion.section
  return (
    <MotionTag
      className={`card ${className}`}
      style={style}
      initial={reduced ? false : { opacity: 0, y: 14 }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </MotionTag>
  )
}

export function CardHead({ title, children }) {
  return (
    <div className="card-head">
      <h2 className="card-title">{title}</h2>
      {children}
    </div>
  )
}
