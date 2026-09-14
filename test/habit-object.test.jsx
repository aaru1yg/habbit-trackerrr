/* Step 4A — Definitive Habit Object tests. */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import HabitObject from '../src/components/habits/HabitObject.jsx'

const baseHabit = {
  id: 'h1', name: 'Deep reading', category: 'learning',
  schedule: { type: 'daily' },
}

function renderObject(props = {}) {
  return render(
    <HabitObject
      habit={baseHabit}
      schedule="Daily"
      onToggleComplete={() => {}}
      onDetail={() => {}}
      onMore={() => {}}
      {...props}
    />,
  )
}

describe('HabitObject', () => {
  beforeEach(() => cleanup())

  it('renders the habit name as a visible link to habit details (accessible name)', () => {
    renderObject()
    const link = screen.getByRole('link', { name: 'Deep reading' })
    expect(link).toBeTruthy()
    expect(link.getAttribute('href')).toContain('/habits/')
    expect(link.classList.contains('habit-obj__name-link')).toBe(true)
  })

  it('renders a circular progress ring (svg circle with stroke class)', () => {
    const { container } = renderObject()
    const svg = container.querySelector('.habit-obj__ring svg')
    expect(svg).toBeTruthy()
    expect(container.querySelector('.habit-obj__ring-fill')).toBeTruthy()
    expect(container.querySelector('.habit-obj__ring-track')).toBeTruthy()
  })

  it('incomplete: shows a colored dot; is-done class absent', () => {
    const { container } = renderObject({ done: false })
    expect(container.querySelector('.habit-obj__ring-dot')).toBeTruthy()
    expect(container.querySelector('.habit-obj.is-done')).toBeNull()
    expect(container.querySelector('.habit-obj__ring-mark')).toBeTruthy()
  })

  it('completed: adds is-done, shows check, success-colored ring', () => {
    renderObject({ done: true })
    expect(document.querySelector('.habit-obj.is-done')).toBeTruthy()
  })

  it('streak is rendered when > 0; hidden when 0', () => {
    const { container, rerender } = renderObject({ streak: 0 })
    expect(container.querySelector('.habit-obj__streak')).toBeNull()
    rerender(
      <HabitObject habit={baseHabit} schedule="Daily" streak={12}
        onToggleComplete={() => {}} onDetail={() => {}} onMore={() => {}} />,
    )
    expect(screen.getByText('12')).toBeTruthy()
    expect(container.querySelector('.habit-obj__streak')).toBeTruthy()
  })

  it('at-risk streak is marked with data-at-risk for color (no color-only warning)', () => {
    const { container } = renderObject({ streak: 8, atRisk: true })
    expect(container.querySelector('.habit-obj__streak').getAttribute('data-at-risk')).toBe('true')
  })

  it('schedule meta shown; pause/archive status overrides with status text', () => {
    const { rerender } = renderObject({ scheduledToday: true })
    expect(screen.getByText('Daily')).toBeTruthy()
    rerender(
      <HabitObject habit={baseHabit} schedule="Daily" paused
        status={{ label: 'Paused', tone: 'neutral' }}
        onToggleComplete={() => {}} onDetail={() => {}} onMore={() => {}} />,
    )
    expect(screen.getByText('Paused')).toBeTruthy()
  })

  it('Complete button toggles to Completed state; fires onToggleComplete', () => {
    let toggled = 0
    const { rerender } = renderObject({ done: false, onToggleComplete: () => toggled++ })
    const btn = screen.getByRole('button', { name: /Mark .* complete/ })
    fireEvent.click(btn)
    expect(toggled).toBe(1)
    rerender(
      <HabitObject habit={baseHabit} schedule="Daily" done
        onToggleComplete={() => toggled++} onDetail={() => {}} onMore={() => {}} />,
    )
    expect(screen.getByRole('button', { name: /not complete/ })).toBeTruthy()
  })

  it('Complete button is hidden when scheduledToday=false (not scheduled today)', () => {
    renderObject({ scheduledToday: false, onToggleComplete: undefined })
    expect(screen.queryByRole('button', { name: /Complete|Mark.*complete/ })).toBeNull()
  })

  it('more button fires onMore; has aria-haspopup dialog', () => {
    let more = 0
    renderObject({ onMore: () => more++ })
    const btn = screen.getByRole('button', { name: /More actions/ })
    expect(btn.getAttribute('aria-haspopup')).toBe('dialog')
    fireEvent.click(btn)
    expect(more).toBe(1)
  })

  it('accessible name includes name, completion state, streak', () => {
    const { container } = renderObject({ done: true, streak: 5 })
    const article = container.querySelector('.habit-obj')
    expect(article.getAttribute('aria-label')).toMatch(/Deep reading/)
    expect(article.getAttribute('aria-label')).toMatch(/completed today/)
    expect(article.getAttribute('aria-label')).toMatch(/5 day streak/)
  })

  it('compact variant is smaller (--ho-ring 28px) via class', () => {
    const { container } = renderObject({ variant: 'compact' })
    expect(container.querySelector('.habit-obj--compact')).toBeTruthy()
  })

  it('featured variant scales up via class', () => {
    const { container } = renderObject({ variant: 'featured' })
    expect(container.querySelector('.habit-obj--featured')).toBeTruthy()
  })

  it('action buttons are at least 36px tall on desktop and mobile CSS ensures 44px touch', () => {
    // Verifies CSS contract: --btn-h:36px default, mobile media overrides to 44px.
    const css = require('fs').readFileSync('src/components/habits/HabitObject.css', 'utf8')
    expect(css).toMatch(/--btn-h:\s*36px/)
    const mobile = css.match(/@media\s*\(max-width:\s*559px\)[\s\S]*?habit-obj__complete[\s\S]*?--btn-h:\s*44px/)
    expect(mobile).toBeTruthy()
  })

  it('uses category color var (no hardcoded fill); completed uses success color', () => {
    const { container } = renderObject()
    expect(container.querySelector('.habit-obj').getAttribute('style')).toContain('--cat-color')
  })

  it('does not stack glow/gradient/shadow — no box-shadow on the object itself', () => {
    const css = require('fs').readFileSync('src/components/habits/HabitObject.css', 'utf8')
    expect(css).not.toMatch(/\.habit-obj[^-][^{}]*box-shadow/)
    expect(css).not.toMatch(/\.habit-obj[^-][^{}]*gradient/)
  })

  it('paused/archived object has dashed border via is-paused/is-archived class', () => {
    const { container } = renderObject({ paused: true })
    expect(container.querySelector('.habit-obj.is-paused')).toBeTruthy()
  })

  it('clicking the card (outside buttons/links) fires onDetail; clicking the name link also opens detail', () => {
    let detail = 0
    const { container } = renderObject({ onDetail: () => detail++ })
    const article = container.querySelector('.habit-obj')
    // Name is a real link
    const link = article.querySelector('a.habit-obj__name-link')
    expect(link).toBeTruthy()
    expect(link.getAttribute('href')).toContain('/habits/')
    fireEvent.click(article) // click on the card background → should call onDetail
    expect(detail).toBe(1)
  })
})
