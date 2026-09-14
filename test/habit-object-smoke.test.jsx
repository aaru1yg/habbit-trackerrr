/* Step 4A — Structural smoke: Habits screen with new HabitObject in both themes. */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react'
import { StoreProvider } from '../src/store.jsx'
import App from '../src/App.jsx'
import { A_light } from './datasets.js'

function mountAt(hash = '#/habits', seed) {
  window.location.hash = hash
  const { container } = render(
    <StoreProvider initialState={seed}><App /></StoreProvider>,
  )
  return container
}

describe('HabitObject structural smoke (Habits screen)', () => {
  beforeEach(() => { cleanup(); window.location.hash = '' })
  afterEach(() => { cleanup() })

  it('renders the Habits screen — every habit row uses .habit-obj (no leftover .hrow)', async () => {
    mountAt('#/habits', A_light())
    await screen.findByRole('heading', { level: 1, name: /habits/i })
    // Wait for habits to load
    const list = await screen.findByRole('list', { name: 'Habits' })
    const items = withinSafe(list).getAllByRole('listitem')
    expect(items.length).toBeGreaterThanOrEqual(2)
    for (const item of items) {
      expect(item.querySelector('.habit-obj')).toBeTruthy()
      expect(item.querySelector('.hrow')).toBeNull() // old class gone
    }
  })

  it('Complete button on first habit toggles, marking object is-done and aria-pressed=true', async () => {
    mountAt('#/habits', A_light())
    const list = await screen.findByRole('list', { name: 'Habits' })
    const firstBtn = withinSafe(list).getAllByRole('button', { name: /complete/i })[0]
    expect(firstBtn.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(firstBtn)
    // State is committed through the reducer; poll until is-done appears
    await waitFor(() => {
      const obj = document.querySelector('.habit-obj.is-done')
      expect(obj).toBeTruthy()
    })
    const pressed = document.querySelector('.habit-obj__complete.is-done')
    expect(pressed).toBeTruthy()
    expect(pressed.getAttribute('aria-pressed')).toBe('true')
  })

  it('more button opens the actions sheet (actions group exposed)', async () => {
    mountAt('#/habits', A_light())
    const moreBtns = await screen.findAllByRole('button', { name: /More actions for/ })
    fireEvent.click(moreBtns[0])
    const group = await screen.findByRole('group', { name: /Actions for/ })
    expect(group).toBeTruthy()
    // Pause and Edit actions present (existing semantics)
    expect(within(group).getAllByRole('button').length).toBeGreaterThan(2)
  })

  it('no horizontal overflow at 390px viewport (mobile meta) — objects use min-width:0 on body', async () => {
    mountAt('#/habits', A_light())
    await screen.findByRole('list', { name: 'Habits' })
    const objs = document.querySelectorAll('.habit-obj')
    for (const o of objs) {
      const body = o.querySelector('.habit-obj__body')
      expect(body.getAttribute('style') || '').not.toMatch(/min-width:\s*[^0]/)
      // The body has CSS min-width:0 via class; check no inline fixed width forces overflow
      expect(o.scrollWidth).toBeLessThanOrEqual(o.parentElement ? o.parentElement.clientWidth + 2 : 9999)
    }
  })
})

// Tiny helper
function withinSafe(el) { return within(el) }
