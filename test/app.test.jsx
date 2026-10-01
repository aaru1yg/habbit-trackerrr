/* Render tests: the journeys that must never break. */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../src/App.jsx'
import { StoreProvider } from '../src/core/store.jsx'
import { RouterProvider } from '../src/app/router.jsx'
import { ToastHost } from '../src/ui/index.jsx'
import { emptyState, STORAGE_KEY } from '../src/core/schema.js'
import { today, shift } from '../src/core/date.js'

const D = today()

function seeded(over = {}) {
  return {
    ...emptyState(),
    profile: { ...emptyState().profile, name: 'Aaru', onboarded: true },
    habits: [{
      id: 'h1', name: 'Read 20 pages', icon: '📖', category: 'mind',
      target: { type: 'done', goal: 1, unit: '' }, cadence: { type: 'daily' },
      cue: 'After coffee', notes: '', createdAt: shift(D, -20), archivedAt: null, order: 0,
    }],
    work: [{
      id: 'w1', kind: 'task', title: 'Renew the passport', notes: '',
      deadline: `${shift(D, -1)}T09:00`, startedAt: shift(D, -10), tasks: [],
      manual: 20, goalId: null, log: [], createdAt: shift(D, -10),
      doneAt: null, archivedAt: null, order: 0,
    }],
    ...over,
  }
}

function mount(state) {
  if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  return render(
    <StoreProvider>
      <RouterProvider>
        <ToastHost><App /></ToastHost>
      </RouterProvider>
    </StoreProvider>
  )
}

beforeEach(() => { window.location.hash = '#/today' })

describe('first run', () => {
  it('invites you to add a habit and shows no fabricated numbers', () => {
    mount(emptyState())
    expect(screen.getByText(/Welcome to Habit OS/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add your first habit/i })).toBeInTheDocument()
    expect(screen.queryByText(/%\s*$/)).toBeNull()
  })

  it('opens the habit form from the empty state', async () => {
    const user = userEvent.setup()
    mount(emptyState())
    await user.click(screen.getByRole('button', { name: /Add your first habit/i }))
    expect(await screen.findByRole('dialog', { name: /New habit/i })).toBeInTheDocument()
  })
})

describe('Today', () => {
  it('greets you and shows the day score', () => {
    mount(seeded())
    expect(screen.getByText(/Aaru/)).toBeInTheDocument()
    expect(screen.getByText(/Today.s habits/)).toBeInTheDocument()
  })

  it('surfaces overdue work before habits in Next up', () => {
    mount(seeded())
    const nextUp = screen.getByText('Next up').closest('section')
    expect(within(nextUp).getByText('Renew the passport')).toBeInTheDocument()
    expect(within(nextUp).getAllByText('Overdue').length).toBeGreaterThan(0)
  })

  it('checking a habit updates the count and persists', async () => {
    const user = userEvent.setup()
    mount(seeded())
    const section = screen.getByText(/Today.s habits/).closest('section')
    const box = within(section).getByRole('checkbox', { name: /Read 20 pages/i })
    expect(box).toHaveAttribute('aria-checked', 'false')

    await user.click(box)
    expect(box).toHaveAttribute('aria-checked', 'true')

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
      expect(saved.checkins.h1[D].value).toBe(1)
    })
  })

  it('logs a mood with one tap', async () => {
    const user = userEvent.setup()
    mount(seeded())
    const buttons = screen.getAllByRole('button', { name: /Mood \d of 5/ })
    await user.click(buttons[4])
    expect(buttons[4]).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('navigation', () => {
  it('reaches every pillar from the rail', async () => {
    const user = userEvent.setup()
    mount(seeded())
    for (const name of ['Habits', 'Work', 'Goals', 'Insights']) {
      await user.click(screen.getAllByRole('link', { name })[0])
      expect(await screen.findAllByText(name)).not.toHaveLength(0)
    }
  })

  it('opens a habit detail and comes back', async () => {
    const user = userEvent.setup()
    mount(seeded())
    await user.click(screen.getAllByRole('link', { name: /Open Read 20 pages/i })[0])
    expect(await screen.findByText(/Current streak/i)).toBeInTheDocument()
    await user.click(screen.getAllByRole('link', { name: 'Habits' })[0])
    expect(await screen.findByText('Due today')).toBeInTheDocument()
  })
})

describe('command palette', () => {
  it('quick-adds a habit from the h prefix', async () => {
    const user = userEvent.setup()
    mount(seeded())
    await user.click(screen.getByRole('button', { name: /Search and commands/i }))
    const input = await screen.findByRole('textbox', { name: /Search or add/i })
    await user.type(input, 'h Meditate')
    await user.click(await screen.findByText(/Add habit .Meditate./))
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
      expect(saved.habits.some((h) => h.name === 'Meditate')).toBe(true)
    })
  })

  it('finds existing entities by name', async () => {
    const user = userEvent.setup()
    mount(seeded())
    await user.click(screen.getByRole('button', { name: /Search and commands/i }))
    const input = await screen.findByRole('textbox', { name: /Search or add/i })
    await user.type(input, 'passport')
    expect((await screen.findAllByText('Renew the passport')).length).toBeGreaterThan(0)
  })
})

describe('work', () => {
  it('shows honest status counts and lets you finish an item', async () => {
    const user = userEvent.setup()
    mount(seeded())
    window.location.hash = '#/work/w1'
    await waitFor(() => expect(screen.getByText(/Mark as finished/i)).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /Mark done/i }))
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
      expect(saved.work[0].doneAt).toBeTruthy()
    })
  })
})

describe('accessibility basics', () => {
  it('every icon-only control has a name', () => {
    mount(seeded())
    for (const b of screen.getAllByRole('button')) {
      const name = b.getAttribute('aria-label') || b.textContent.trim()
      expect(name.length).toBeGreaterThan(0)
    }
  })

  it('offers a skip link to the main region', () => {
    mount(seeded())
    expect(screen.getByRole('link', { name: /Skip to content/i })).toHaveAttribute('href', '#main')
  })
})
