import { motion } from 'framer-motion'

/* Empty state with generated hero art (progressively enhanced: if the
   image fails to load, a quiet icon + copy still works). */
export default function EmptyState({ art, icon, title, children, action }) {
  return (
    <motion.div
      className="empty"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {art ? (
        <img src={art} alt="" width={240} height={240} loading="lazy" decoding="async"
          onError={(e) => { e.currentTarget.style.display = 'none' }} />
      ) : (
        <div style={{ color: 'var(--text-3)', display: 'grid', placeItems: 'center', height: 88 }}>{icon}</div>
      )}
      <div className="empty-title">{title}</div>
      {children && <p className="empty-sub">{children}</p>}
      {action}
    </motion.div>
  )
}
