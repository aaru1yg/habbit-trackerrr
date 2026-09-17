import { IconClock, IconCalendar, IconCheck } from '../../lib/icons.jsx'
import { Link } from '../../lib/router.jsx'

/**
 * Duration formatting helper (no plural bugs, no "0 min").
 * Returns the raw duration string WITHOUT any qualifier (remaining/free/over).
 */
function fmtRaw(min) {
  if (min == null || !Number.isFinite(min)) return null
  const abs = Math.abs(Math.round(min))
  if (abs === 0) return '0 min'
  const h = Math.floor(abs / 60), m = abs % 60
  if (h >= 1 && m === 0) return `${h}h`
  if (h >= 1) return `${h}h ${m}m`
  return `${m} min`
}

/** Formats a duration as an Xh Ym "remaining" / "over" phrase. */
function fmtPhrase(min, { suffix = 'remaining' } = {}) {
  if (min == null || !Number.isFinite(min)) return null
  const abs = fmtRaw(min)
  if (min < 0) return `${abs} over`
  if (Math.round(min) === 0) return `0 min ${suffix === 'remaining' ? 'free' : suffix}`
  return `${abs} ${suffix}`
}

/**
 * TodaySignals — compact, calm Today context.
 *
 * Three conceptual signals, rendered as ONE continuous editorial strip:
 *   CAPACITY     primary "3h remaining" + supporting "5h available · 2h committed"
 *   ATTENTION    "{n} need{s} attention" — only when n>0; names top item if there is one
 *   COMPLETION   "done / total complete · pct%" (bug-fixed formatting)
 *
 * Semantic tone (NORMAL/TIGHT/OVERLOADED/COMPLETED) is expressed via a small
 * Status dot on the section label — never whole-section coloring.
 */
export default function TodaySignals({
  stats,
  workload,
  attentionCount = 0,
  attentionLead = null, // { name, href } | null — most urgent item
  sectionTone = 'neutral',
}) {
  // ---- CAPACITY ----
  const remainingMin = workload?.remainingMin
  const availableMin = workload?.availableMin
  const committedMin = workload?.committedMin

  let capacityValue = null, capacityDetail = null
  if (Number.isFinite(remainingMin)) {
    capacityValue = fmtPhrase(remainingMin)
    if (Number.isFinite(availableMin) && Number.isFinite(committedMin)) {
      capacityDetail = `${fmtRaw(availableMin)} available · ${fmtRaw(committedMin)} committed`
    }
  } else if (workload?.reason) {
    capacityValue = 'Capacity not set'
    capacityDetail = workload.reason
  }

  // ---- ATTENTION ----
  let attentionValue = null, attentionDetail = null, attentionHref = null
  if (attentionCount > 0) {
    attentionValue = `${attentionCount} ${attentionCount === 1 ? 'item needs' : 'items need'} attention`
    if (attentionLead?.name) {
      attentionDetail = attentionLead.name
      attentionHref = attentionLead.href || null
    }
  }

  // ---- COMPLETION (real today stats) ----
  let completionValue = null, completionDetail = null
  if (stats && stats.total > 0) {
    const { done, total, pct } = stats
    // Fix: previously rendered `${done}/${stats.total}` then `${stats.pct}% complete`
    // right next to each other with no separator → "1/333%". Use explicit joins.
    completionValue = `${done} / ${total}`
    completionDetail = `${Math.round(pct || 0)}% complete`
  }

  const signals = [
    capacityValue ? {
      key: 'capacity',
      icon: <IconClock size={14} aria-hidden="true" />,
      label: 'Capacity',
      value: capacityValue,
      detail: capacityDetail,
      tone: remainingMin != null && remainingMin < 0 ? 'danger'
        : remainingMin != null && remainingMin < 30 ? 'warning'
        : 'neutral',
    } : null,
    attentionValue ? {
      key: 'attention',
      icon: <IconCalendar size={14} aria-hidden="true" />,
      label: 'Attention',
      value: attentionValue,
      detail: attentionDetail,
      href: attentionHref,
      tone: 'warning',
    } : null,
    completionValue ? {
      key: 'completion',
      icon: <IconCheck size={14} aria-hidden="true" />,
      label: 'Completion',
      value: completionValue,
      detail: completionDetail,
      tone: stats.done === stats.total ? 'success' : 'neutral',
    } : null,
  ].filter(Boolean)

  if (signals.length === 0) return null

  const toneLabel = {
    neutral: 'Today',
    tight: 'Tight',
    overloaded: 'Over capacity',
    completed: 'All done',
    warning: 'Needs attention',
  }[sectionTone] || 'Today'

  return (
    <section aria-labelledby="today-signals-heading" className="today-signals" data-tone={sectionTone}>
      <header className="today-signals__head">
        <span className="today-signals__eyebrow">
          <span className={`today-signals__dot today-signals__dot--${sectionTone}`} aria-hidden="true" />
          <h2 id="today-signals-heading" className="today-signals__title">Today&apos;s insights</h2>
        </span>
        <span className="today-signals__state">{toneLabel}</span>
      </header>

      <ul className="today-signals__list" role="list">
        {signals.map((s) => {
          const Inner = (
            <>
              <span className="today-signals__sig-icon">{s.icon}</span>
              <span className="today-signals__sig-body">
                <span className="today-signals__sig-label">{s.label}</span>
                <span className={`today-signals__sig-value${s.tone !== 'neutral' ? ` is-${s.tone}` : ''}`}>{s.value}</span>
                {s.detail ? <span className="today-signals__sig-detail">{s.detail}</span> : null}
              </span>
            </>
          )
          return (
            <li key={s.key} className="today-signals__sig">
              {s.href ? (
                <Link to={s.href} className="today-signals__sig-link" aria-label={`${s.label}: ${s.value}`}>{Inner}</Link>
              ) : (
                <div className="today-signals__sig-static">{Inner}</div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
