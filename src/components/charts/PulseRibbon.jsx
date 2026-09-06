/* ============================================================
   PULSE RIBBON — the year as one continuous strip.

   Twelve cells, one per month. Cell intensity is the share of
   scheduled checks completed that month; months with no scheduled
   days stay hollow and future months stay outlined, so the ribbon
   never pretends to know what hasn't happened.

   Motion: cells fill left→right on first view (staggered), like
   the year accumulating. Hover/focus a cell for its exact number;
   the same numbers are always in the accessible summary.
   ============================================================ */
import { useState } from 'react'
import AnimateOnView from '../motion/AnimateOnView.jsx'

export default function PulseRibbon({ months, year }) {
  const [sel, setSel] = useState(null)
  const list = months || []
  const summary = list
    .map((m) => `${m.label} ${m.future ? 'ahead' : m.pct == null ? 'no scheduled days' : `${m.pct}%`}`)
    .join(', ')
  const selMonth = sel != null ? list[sel] : null

  return (
    <div className="ribbon">
      <AnimateOnView effect="ribbon-in" className="ribbon-strip" role="img" aria-label={`${year} completion ribbon. ${summary}`}>
        {list.map((m, i) => (
          <span
            key={m.month}
            className={`ribbon-cell${m.future ? ' is-future' : ''}${m.pct == null && !m.future ? ' is-empty' : ''}${sel === i ? ' is-sel' : ''}`}
            style={{ '--i': i, '--v': m.pct == null ? 0 : m.pct / 100 }}
            onPointerEnter={() => setSel(i)}
            onPointerLeave={() => setSel(null)}
          >
            <i className="ribbon-fill" />
          </span>
        ))}
      </AnimateOnView>
      <div className="ribbon-months" aria-hidden="true">
        {list.map((m) => <span key={m.month}>{m.label[0]}</span>)}
      </div>
      <p className="ribbon-detail" role="status">
        {selMonth
          ? selMonth.future
            ? `${selMonth.label} is still ahead — nothing to measure yet.`
            : selMonth.pct == null
              ? `${selMonth.label}: no scheduled days logged.`
              : `${selMonth.label}: ${selMonth.pct}% of scheduled checks completed.`
          : 'Hover the ribbon for a month’s exact share.'}
      </p>
    </div>
  )
}
