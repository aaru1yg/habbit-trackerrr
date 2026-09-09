/* ============================================================
   FEEDBACK — Skeleton / LoadingBlock / ErrorNote / InlineEmpty (V5).

   Loading reserves layout space (no jumps), errors are specific +
   recoverable, small empties carry one action. Big art moments keep
   using EmptyState.
   ============================================================ */

/** Skeleton shape. aria-hidden: parents label the loading region. */
export function Skeleton({ variant = 'block', width, height, lines = 3, style }) {
  if (variant === 'text') {
    return (
      <span className="vskel-text" aria-hidden="true" style={style}>
        {Array.from({ length: lines }, (_, i) => (
          <span key={i} className="vskel" style={{ width: i === lines - 1 ? '62%' : width || '100%' }} />
        ))}
      </span>
    )
  }
  return (
    <span
      className={`vskel${variant === 'circle' ? ' is-circle' : ''}`}
      aria-hidden="true"
      style={{ width, height, ...style }}
    />
  )
}

/** Reserved-space loading region with an accessible label. */
export function LoadingBlock({ label = 'Loading', children }) {
  return (
    <div className="vloading" role="status" aria-label={label}>
      {children || (
        <>
          <Skeleton height={18} width="42%" />
          <Skeleton variant="text" lines={3} />
        </>
      )}
    </div>
  )
}

/** Specific, recoverable, visible, announced error. */
export function ErrorNote({ title, message = null, onRetry = null, retryLabel = 'Retry' }) {
  return (
    <div className="verror" role="alert">
      <div className="verror-body">
        <strong className="verror-title">{title}</strong>
        {message && <p className="verror-msg">{message}</p>}
      </div>
      {onRetry && (
        <button type="button" className="vbtn" data-variant="subtle" data-size="sm" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  )
}

/** Small empty state with one primary action (no dead dashboards). */
export function InlineEmpty({ icon = null, title, children, action = null }) {
  return (
    <div className="vempty-inline">
      {icon && <span className="vempty-icon" aria-hidden="true">{icon}</span>}
      <p className="vempty-title">{title}</p>
      {children && <p className="vempty-sub">{children}</p>}
      {action}
    </div>
  )
}
