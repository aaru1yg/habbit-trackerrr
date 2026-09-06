/* ============================================================
   DEADLINE PRESSURE — urgency you can feel without alarm
   (spec §11).

   Ten segments = the assignment's window. Lit segments are the
   time that is STILL left, so the bar drains as the deadline
   approaches:

     ██████████  the whole window ahead
     █████░░░░░  half gone
     █░░░░░░░░░  nearly due
     ░░░░░░░░░░  the window closed

   Colour follows the existing status tones (good/warn/bad) —
   never a flashing red. The drain animates once on entry and
   sits perfectly still afterwards; reduced motion shows the
   final state.
   ============================================================ */
import AnimateOnView from '../motion/AnimateOnView.jsx'

export default function DeadlinePressure({ pressure, size = 'md', showDetail = true }) {
  if (!pressure) return null
  const { tone, segments, label, detail } = pressure
  const noWindow = segments == null

  return (
    <div className={`pressure pressure-${size}`} data-tone={tone} data-empty={noWindow ? 'true' : undefined}>
      <AnimateOnView
        effect="pressure-fill"
        className="pressure-bar"
        role="img"
        aria-label={noWindow
          ? `No deadline set`
          : `Deadline pressure: ${segments} of 10 segments of time remaining — ${label}`}
      >
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} className="pressure-seg" style={{ '--i': i }} data-lit={i < (segments ?? 0) ? 'true' : undefined} />
        ))}
      </AnimateOnView>
      <span className="pressure-label">{label}</span>
      {showDetail && detail && <span className="pressure-detail">{detail}</span>}
    </div>
  )
}
