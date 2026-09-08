/* ============================================================
   PHASE H — accessibility.

   Requirement #31: keyboard navigation, visible focus, screen reader,
   reduced motion, 44px targets, accessible charts and dialogs.

   What can be asserted in jsdom is asserted here. What genuinely needs
   a real browser — computed contrast, real focus painting, viewport
   overflow at 390×844 — is left to qa/audit.mjs and qa/contrast.mjs,
   which cannot run in this sandbox (puppeteer's Chromium needs
   libnss3/libnspr4, and neither is installed).
   ============================================================ */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { StoreProvider, STORAGE_KEY } from '../src/store.jsx'
import App from '../src/App.jsx'
import { Heatmap, HabitMatrix } from '../src/components/charts/chartKit.jsx'
import { heatmapSeries } from '../src/lib/stats.js'
import { consistencyMatrix } from '../src/lib/advancedAnalytics.js'
import { DATASETS } from './datasets.js'
import { isSheetOpen } from '../src/components/ui/Sheet.jsx'

const DAY = 86400000
const iso = (offsetDays, hhmm = '17:00') =>
  new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10) + 'T' + hhmm

function longRunningLog() {
  return [1, 2, 3, 4].map((n) => ({
    id: `f${n}`, kind: 'assignment', itemId: 'a1', name: 'Physics set',
    startedAt: iso(-n, '09:00'), endedAt: iso(-n, '09:45'),
    plannedMin: 30, actualMin: 45, completed: true, interrupted: false,
  }))
}

function seedState(over = {}) {
  return {
    version: 4,
    profile: { name: 'Aaru', onboarded: true, theme: 'midnight', workReminders: false },
    habits: [{ id: 'h1', name: 'Write daily', category: 'learning', schedule: { type: 'daily' }, archived: false, order: 0 }],
    checkins: { h1: {} },
    routines: [], projects: [],
    assignments: [{
      id: 'a1', name: 'Physics set', deadline: iso(2, '18:00'), estimateMin: 120,
      priority: 'high', archived: false, subtasks: [],
    }],
    goals: [], moods: {}, notes: [], achievements: [],
    preferences: { focusStartHour: null, focusEndHour: null, planningTime: null, breakStyle: null, dailyCapacityMin: 120, planningBufferPct: 15, weekStartsOn: 1, reminderWindow: null },
    signals: [], focusLog: [],
    ...over,
  }
}

function mountToday(seed = seedState()) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))
  sessionStorage.clear()
  window.location.hash = '#/today'
  return render(<StoreProvider><App /></StoreProvider>)
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('charts expose their data to a screen reader — #31', () => {
  /* role="img" flattens the subtree, so the per-day titles are decorative.
     Before this was fixed a screen reader heard only the label. */
  it('the heatmap has a text alternative outside its img subtree', () => {
    const state = DATASETS.find((d) => d.key === 'E').build()
    render(<Heatmap weeks={heatmapSeries(state, 8)} ariaLabel="Write daily consistency heatmap" />)

    const img = screen.getByRole('img')
    expect(img.getAttribute('aria-label')).toBe('Write daily consistency heatmap')

    const id = img.getAttribute('aria-describedby')
    expect(id).toBeTruthy()
    const desc = document.getElementById(id)
    expect(desc).toBeTruthy()
    /* It must be hidden visually but present for assistive tech. */
    expect(desc.className).toContain('sr-only')
    /* And it must describe real figures, not a placeholder. */
    expect(desc.textContent).toMatch(/\d+ days with data/)
    expect(desc.textContent).toMatch(/averaging \d+% complete/)
  })

  it('the heatmap says so when there is no data', () => {
    const state = DATASETS.find((d) => d.key === 'H').build()
    render(<Heatmap weeks={heatmapSeries(state, 4)} />)
    const desc = document.getElementById(screen.getByRole('img').getAttribute('aria-describedby'))
    expect(desc.textContent).toBe('No days with recorded activity in this range yet.')
  })

  it('the habit matrix cells are real buttons with names when tappable', () => {
    const state = DATASETS.find((d) => d.key === 'E').build()
    const m = consistencyMatrix(state, { days: 7, now: new Date() })
    render(
      <HabitMatrix
        rows={m.rows.map((r) => ({ habit: r.habit, cells: r.cells }))}
        days={m.dates}
        weekLabels={['W1']}
        onCellTap={() => {}}
      />,
    )
    const cells = screen.getAllByRole('button')
    expect(cells.length).toBeGreaterThan(0)
    /* Every cell must be named, so a keyboard user knows what they are on. */
    for (const c of cells) {
      expect(c.getAttribute('aria-label'), 'matrix cell without a name').toBeTruthy()
    }
  })

  it('a non-interactive matrix is an image, not a table of unnamed buttons', () => {
    const state = DATASETS.find((d) => d.key === 'E').build()
    const m = consistencyMatrix(state, { days: 7, now: new Date() })
    render(<HabitMatrix rows={m.rows.map((r) => ({ habit: r.habit, cells: r.cells }))} days={m.dates} weekLabels={['W1']} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Habit by day matrix')
  })
})

describe('the command palette is keyboard-first — #20', () => {
  it('opens on Cmd+K and closes on Escape', async () => {
    mountToday()
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    const dialog = await screen.findByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')

    /* Escape is handled on document, and the sheet's open flag is the
       real contract. The node itself lingers because framer-motion's exit
       animation never completes under jsdom — that is a test artefact,
       not a stuck dialog. */
    expect(isSheetOpen()).toBe(true)
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(isSheetOpen()).toBe(false))
  })

  it('opens on Ctrl+K for non-Apple keyboards', async () => {
    mountToday()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(await screen.findByRole('dialog')).toBeTruthy()
  })

  it('moves focus into the dialog so keyboard users land somewhere', async () => {
    mountToday()
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    const dialog = await screen.findByRole('dialog')
    await screen.findByLabelText('What do you need to do?')
    /* Focus must be inside the dialog, not left on the page behind it. */
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('the single field is labelled, so it is announced', async () => {
    mountToday()
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    const field = await screen.findByLabelText('What do you need to do?')
    expect(field.tagName).toBe('INPUT')
  })
})

describe('the universal action sheet is operable — #22', () => {
  it('opens from a named trigger and closes on Escape', async () => {
    mountToday()
    await screen.findByText("Today's priorities")
    const trigger = document.querySelector('.priority-actions')
    expect(trigger.getAttribute('aria-label')).toMatch(/^Actions for .+/u)

    fireEvent.click(trigger)
    const dialog = await screen.findByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')

    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(isSheetOpen()).toBe(false))
  })

  it('every action button is named', async () => {
    mountToday()
    await screen.findByText("Today's priorities")
    fireEvent.click(document.querySelector('.priority-actions'))
    const dialog = await screen.findByRole('dialog')
    const actions = Array.from(dialog.querySelectorAll('.item-action'))
    expect(actions.length).toBeGreaterThan(0)
    for (const a of actions) {
      expect(a.textContent.trim().length, 'action button with no text').toBeGreaterThan(0)
    }
  })

  it('the destructive action asks before it acts', async () => {
    mountToday()
    await screen.findByText("Today's priorities")
    fireEvent.click(document.querySelector('.priority-actions'))
    const dialog = await screen.findByRole('dialog')

    const danger = Array.from(dialog.querySelectorAll('.item-action.danger'))
    if (danger.length) {
      fireEvent.click(danger[0])
      /* Confirm, then the warning about no undo. */
      expect(within(dialog).getByText(/cannot be undone from here/)).toBeTruthy()
    }
  })
})

describe('proactive surfaces are dismissible, never traps — #27', () => {
  it('the nudge has a real button, not a click handler on a div', async () => {
    mountToday(seedState({ focusLog: longRunningLog() }))
    const nudge = await screen.findByLabelText('Suggestion')
    const dismiss = within(nudge).getByRole('button', { name: 'Dismiss' })
    expect(dismiss).toBeTruthy()
    fireEvent.click(dismiss)
    expect(document.querySelector('.nudge')).toBeNull()
  })

  it('the weekly accept path is a named button', async () => {
    mountToday(seedState({ focusLog: longRunningLog() }))
    const panel = await screen.findByLabelText('Weekly adaptation')
    const accept = within(panel).getByRole('button', { name: /Plan .* instead/ })
    expect(accept.textContent).toMatch(/\d/)
  })
})

describe('no interactive element is an unnamed non-button', () => {
  it('every button in the rendered Today screen has an accessible name', async () => {
    mountToday(seedState({ focusLog: longRunningLog() }))
    await screen.findByText("Today's priorities")

    const unnamed = []
    for (const b of Array.from(document.querySelectorAll('button'))) {
      const name = (b.getAttribute('aria-label') || b.textContent || '').trim()
      if (!name) unnamed.push(b.className)
    }
    expect(unnamed, `unnamed buttons: ${unnamed.join(', ')}`).toHaveLength(0)
  })

  it('icon-only controls carry aria-label rather than relying on the icon', async () => {
    mountToday()
    await screen.findByText("Today's priorities")
    /* The per-row action trigger holds only an SVG. */
    const trigger = document.querySelector('.priority-actions')
    expect(trigger.textContent.trim()).toBe('')
    expect(trigger.getAttribute('aria-label')).toBeTruthy()
  })
})
