/**
 * NOW Refinement #1 — focused tests for the signature NextAction object.
 *
 * NextAction receives a `state` prop that selectors (habitStreak,
 * assignmentProgress, etc.) read from. We construct a minimal state
 * object with the shape those selectors expect so we can unit-test
 * the component in isolation without mounting the entire App.
 */
import { describe, it, expect, vi } from 'vitest'
/**
 * @vitest-environment jsdom
 */
import { render } from '@testing-library/react'
import NextAction from '../src/components/today/NextAction.jsx'

// Stub router Link so we don't pull react-router into this unit test.
vi.mock('../src/lib/router.jsx', () => ({
  Link: ({ children, to, ...rest }) => <a href={to} {...rest}>{children}</a>,
}))

const MIN_STATE = {
  checkins: {},
  habits: [],
  assignments: [],
  projects: [],
}

function mount(ui) {
  return render(ui)
}

describe('NOW refinement — NextAction signature object', () => {
  it('next-state renders a NowRing progress object with role=progressbar', () => {
    const { container } = renderNext({ pct: 25 })
    const ring = container.querySelector('.now-ring')
    expect(ring).toBeTruthy()
    expect(ring.getAttribute('role')).toBe('progressbar')
    expect(ring.getAttribute('aria-valuemin')).toBe('0')
    expect(ring.getAttribute('aria-valuemax')).toBe('100')
    expect(ring.getAttribute('aria-valuenow')).toBe('25')
  })

  it('completed state renders a ring at 100% with check mark and success tone', () => {
    const { container } = mount(
      <NextAction
        mode="done"
        stats={{ done: 3, total: 3, pct: 100 }}
        today={new Date().toISOString().slice(0, 10)}
        state={MIN_STATE}
      />
    )
    const ring = container.querySelector('.now-ring')
    expect(ring).toBeTruthy()
    expect(ring.getAttribute('aria-valuenow')).toBe('100')
    expect(ring.querySelector('.now-ring__check')).toBeTruthy()
    expect(container.querySelector('.today-now--done')).toBeTruthy()
    expect(container.querySelector('.today-now__surface')).toBeTruthy()
  })

  it('empty state does NOT fabricate a ring; shows one clear CTA', () => {
    const { container } = mount(
      <NextAction mode="empty" onStart={() => {}} state={MIN_STATE} />
    )
    expect(container.querySelector('.now-ring')).toBeNull()
    expect(container.querySelector('.today-now__surface')).toBeNull()
    const primary = container.querySelector('.p-btn--primary')
    expect(primary.textContent).toMatch(/Plan my day/)
  })

  it('overloaded state does NOT render a ring; amber guidance, no red', () => {
    const { container } = mount(
      <NextAction
        mode="overloaded"
        workload={{ overloaded: true, reason: '60 min over' }}
        onStart={() => {}}
        state={MIN_STATE}
      />
    )
    expect(container.querySelector('.now-ring')).toBeNull()
    expect(container.querySelector('.today-now--overloaded')).toBeTruthy()
    expect(container.querySelector('.today-now').className).not.toMatch(/danger/)
  })

  it('real progress value (50%) flows into aria-valuenow', () => {
    const { container } = renderNext({ pct: 50 })
    expect(container.querySelector('.now-ring').getAttribute('aria-valuenow')).toBe('50')
  })

  it('entity color surfaces as --now-ring-color (no hardcoded palette)', () => {
    const { container } = mount(
      <NextAction
        mode="next"
        entry={{
          kind: 'habit',
          item: { id: 'h1', label: 'Meditate', color: '#22d3ee' },
          reason: '.', urgency: 'ON TRACK', estimatedMin: 10,
        }}
        state={MIN_STATE}
      />
    )
    expect(container.querySelector('.now-ring').style.getPropertyValue('--now-ring-color').trim())
      .toBe('#22d3ee')
  })

  it('progress is ALSO present as text in meta (never ring-only)', () => {
    const { container } = renderNext({ pct: 50 })
    const meta = container.querySelector('.today-now__meta')
    expect(meta).toBeTruthy()
    expect(meta.textContent).toMatch(/50\s*%/)
  })

  it('primary CTA is Start focus (non-completable); secondary View present; no invented verbs', () => {
    const { container } = mount(
      <NextAction
        mode="next"
        entry={{
          kind: 'project',
          item: { id: 'p1', label: 'Ship v1' },
          reason: '.', urgency: 'ON TRACK',
        }}
        onFocus={() => {}}
        state={MIN_STATE}
      />
    )
    const primary = container.querySelector('.p-btn--primary')
    expect(primary.textContent).toMatch(/Start focus/)
    const labels = Array.from(container.querySelectorAll('.today-now__actions .p-btn'))
      .map(b => b.textContent.trim())
    expect(labels.join(' ')).toMatch(/View/)
    expect(labels.join(' ')).not.toMatch(/Snooze|Defer|Skip|Reschedule/)
  })

  it('completable habit renders Complete CTA with accessible name', () => {
    const { container } = mount(
      <NextAction
        mode="next"
        entry={{ kind: 'habit', item: { id: 'h1', label: 'Read' }, reason: '.', urgency: 'ON TRACK' }}
        onComplete={() => {}}
        state={MIN_STATE}
      />
    )
    const primary = container.querySelector('.p-btn--primary')
    expect(primary.textContent).toMatch(/Complete/)
    expect(primary.getAttribute('aria-label')).toMatch(/Read/)
  })

  it('mobile primary CTA has min-height:44px (touch-target contract)', () => {
    const css = require('fs').readFileSync('src/components/today/today.css', 'utf8')
    const mq = css.match(/@media \(max-width: 767px\) \{([\s\S]*?)\n\}/)?.[1] || ''
    expect(mq).toMatch(/\.today-now__actions \.p-btn[\s\S]*min-height:\s*44px/)
  })

  it('NowRing progress stroke is a single solid color — no glow/gradient/shadow', () => {
    const css = require('fs').readFileSync('src/components/today/today.css', 'utf8')
    const block = css.match(/\.now-ring__progress\s*\{([\s\S]*?)\}/)?.[1] || ''
    expect(block).not.toMatch(/filter:|drop-shadow|url\(|linear-gradient|box-shadow/)
  })

  it('depth uses ONE technique — surface has at most one box-shadow (hairline highlight), no gradient bg', () => {
    const css = require('fs').readFileSync('src/components/today/today.css', 'utf8')
    const surface = css.match(/\.today-now__surface\s*\{([\s\S]*?)\}/)?.[1] || ''
    const shadows = (surface.match(/box-shadow/g) || []).length
    expect(shadows).toBeLessThanOrEqual(1)
    expect(surface).not.toMatch(/linear-gradient|radial-gradient/)
  })
})

// Helper: mount NextAction with a predictable assignment that yields `pct`% progress.
// assignmentProgress reads assignment.progress (explicit 0–100) when there are no subtasks.
function renderNext({ pct = 0, urgency = 'ON TRACK' }) {
  return mount(
    <NextAction
      mode="next"
      entry={{
        kind: 'assignment',
        item: { id: 'a1', label: 'Finish DSA chapter 4', progress: pct, estimateMin: 100 },
        reason: "You're making progress.",
        urgency,
        estimatedMin: Math.max(0, 100 - pct),
      }}
      onFocus={() => {}}
      state={MIN_STATE}
    />
  )
}
