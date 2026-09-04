import { motion } from 'framer-motion'

// Animated circular gauge with gradient stroke and a glowing core.
export default function CircularProgress({ size = 130, stroke = 11, value = 0, color = '#7c5cff', color2 = '#22d3ee', label, sublabel, children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, value))
  const off = c * (1 - pct)
  const gid = `g-${color.replace('#', '')}`

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'grid', placeItems: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color2} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={`url(#${gid})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: off }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        {children}
        {label && <div style={{ fontSize: size * 0.26, fontWeight: 800, fontFamily: 'Space Grotesk' }}>{label}</div>}
        {sublabel && <div style={{ fontSize: size * 0.11, color: 'var(--muted)', marginTop: 2 }}>{sublabel}</div>}
      </div>
    </div>
  )
}
