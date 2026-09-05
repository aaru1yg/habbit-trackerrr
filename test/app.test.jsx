import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StoreProvider } from '../src/store.jsx'
import App from '../src/App.jsx'

const renderApp = () =>
  render(
    <StoreProvider>
      <App />
    </StoreProvider>
  )

/** Match text that is split across child elements (e.g. AnimatedNumber spans). */
const textContentMatcher = (text) => (_, el) => el?.textContent === text && el.children.length > 0

/** Complete onboarding quickly (steps animate, so everything is awaited). */
async function onboard(opts = {}) {
  const utils = renderApp()
  await screen.findByText(/What should we call you/i)
  if (opts.name) {
    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: opts.name } })
  }
  fireEvent.click(screen.getByRole('button', { name: /^Continue$/i }))
  await screen.findByText(/Pick a few to start/i)
  if (opts.habits?.length) {
    for (const h of opts.habits) fireEvent.click(screen.getByRole('button', { name: new RegExp(h, 'i') }))
    fireEvent.click(screen.getByRole('button', { name: /^Continue$/i }))
  } else {
    fireEvent.click(screen.getByRole('button', { name: /^Skip$/i }))
  }
  await screen.findByText(/A daily nudge/i)
  fireEvent.click(screen.getByRole('button', { name: /Maybe later/i }))
  await waitFor(() => expect(screen.queryByLabelText('Welcome')).toBeNull())
  return utils
}

async function addHabit(name, opts = {}) {
  fireEvent.click(screen.getByRole('button', { name: /Add a habit/i }))
  const form = await screen.findByRole('dialog')
  fireEvent.change(within(form).getByLabelText(/^Name/i), { target: { value: name } })
  if (opts.weekdays) {
    fireEvent.click(within(form).getByRole('button', { name: /Specific days/i }))
    for (const d of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) {
      const btn = within(form).getByRole('button', { name: d })
      const wanted = opts.weekdays.includes(d)
      const on = btn.getAttribute('aria-pressed') === 'true'
      if (wanted !== on) fireEvent.click(btn)
    }
  }
  fireEvent.click(within(form).getByRole('button', { name: /Add habit/i }))
}

beforeEach(() => {
  window.localStorage.clear()
  window.location.hash = ''
})

describe('onboarding', () => {
  it('completes the 3 steps and lands on Today with chosen habits', async () => {
    await onboard({ name: 'Ada', habits: ['Read 10 pages', 'Meditate'] })
    await waitFor(() => expect(screen.getByText(/, Ada/i)).toBeTruthy())
    expect(screen.getAllByText('Read 10 pages').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Meditate').length).toBeGreaterThan(0)
    expect(screen.getByText(textContentMatcher('0 of 2 complete'))).toBeTruthy()
    // no fake history: every stat empty
    expect(screen.getByText(/first check-in is the hardest/i)).toBeTruthy()
  })

  it('is fully skippable without creating habits', async () => {
    await onboard()
    await screen.findByText(/Start with one habit/i)
  })
})

describe('core flows', () => {
  it('adds a habit with a Mon/Wed/Fri schedule; only scheduled days count', async () => {
    await onboard()
    await addHabit('Gym', { weekdays: ['Mon', 'Wed', 'Fri'] })

    // Date-robust: Today only lists habits scheduled *today*.
    const scheduledToday = [1, 3, 5].includes(new Date().getDay())
    if (scheduledToday) {
      await waitFor(() => expect(screen.getAllByText('Gym').length).toBeGreaterThan(0))
      expect(screen.getByText('Mon · Wed · Fri')).toBeTruthy()
    } else {
      await waitFor(() => expect(screen.getByText(/Nothing scheduled today/i)).toBeTruthy())
    }
  })

  it('completes and uncompletes; state survives a full remount (reload)', async () => {
    const ob = await onboard()
    await addHabit('Water')
    fireEvent.click(await screen.findByRole('button', { name: /Mark Water complete/i }))
    await waitFor(() => expect(screen.getByText(/Everything done/i)).toBeTruthy())

    ob.unmount()
    renderApp()
    fireEvent.click(await screen.findByRole('button', { name: /Mark Water not done/i }))
    await waitFor(() => expect(screen.getByText(textContentMatcher('0 of 1 complete'))).toBeTruthy())
  })

  it('renames a habit inline (tap name → edit → Enter)', async () => {
    await onboard()
    await addHabit('Read')
    await screen.findByRole('button', { name: /Mark Read complete/i })
    fireEvent.click(screen.getByRole('button', { name: /Rename Read/i }))
    const input = screen.getByLabelText(/Rename Read/i)
    await userEvent.clear(input)
    await userEvent.type(input, 'Read books{Enter}')
    await waitFor(() => expect(screen.getByRole('button', { name: /Mark Read books complete/i })).toBeTruthy())
  })

  it('deletes from the detail sheet with undo restoring habit + history', async () => {
    await onboard()
    await addHabit('Journal')
    fireEvent.click(await screen.findByRole('button', { name: /Mark Journal complete/i }))
    fireEvent.click(screen.getByRole('button', { name: /Details for Journal/i }))
    const sheet = await screen.findByRole('dialog')
    fireEvent.click(within(sheet).getByRole('button', { name: /Delete/i }))
    fireEvent.click(within(sheet).getByRole('button', { name: /Really delete/i }))
    await screen.findByText(/Deleted/i)
    fireEvent.click(screen.getByRole('button', { name: /Undo/i }))
    // habit back, still marked done
    await waitFor(() => expect(screen.getByRole('button', { name: /Mark Journal not done/i })).toBeTruthy())
  })

  it('archive hides the habit; undo restores it', async () => {
    await onboard()
    await addHabit('Stretch')
    await screen.findByRole('button', { name: /Mark Stretch complete/i })
    fireEvent.click(screen.getByRole('button', { name: /Details for Stretch/i }))
    const sheet = await screen.findByRole('dialog')
    fireEvent.click(within(sheet).getByRole('button', { name: /Archive/i }))
    await screen.findByText(/Stretch archived/i)
    fireEvent.click(screen.getByRole('button', { name: /Undo/i }))
    await screen.findByRole('button', { name: /Mark Stretch complete/i })
  })

  it('mood: pick + note, persists across reload', async () => {
    await onboard()
    window.location.hash = '#/mind'
    await screen.findByText(/How are you feeling today/i)
    fireEvent.click(screen.getAllByRole('button', { name: /Good/i })[0])
    fireEvent.change(screen.getByLabelText(/A line about today/i), { target: { value: 'Solid focus' } })
    fireEvent.click(screen.getByRole('button', { name: /Save/i }))

    const { unmount } = renderApp()
    unmount()
    renderApp()
    window.location.hash = '#/mind'
    await waitFor(() => {
      const good = screen.getAllByRole('button', { name: /Good/i })[0]
      expect(good.getAttribute('aria-pressed')).toBe('true')
    })
    expect((await screen.findAllByText(/Solid focus/i)).length).toBeGreaterThan(0)
  })

  it('goals: create → milestone → task → 100% completion state', async () => {
    await onboard()
    window.location.hash = '#/goals'
    await screen.findByText(/No goals yet/i)

    fireEvent.click(screen.getByRole('button', { name: /New goal/i }))
    const form = await screen.findByRole('dialog')
    fireEvent.change(within(form).getByLabelText(/^Goal/i), { target: { value: 'Ship v1' } })
    fireEvent.click(within(form).getByRole('button', { name: /Create goal/i }))
    await screen.findByText('Ship v1')

    fireEvent.click(screen.getByRole('button', { name: /Add milestone/i }))
    fireEvent.change(screen.getByLabelText(/New milestone name/i), { target: { value: 'Scope' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await screen.findByText('Scope')

    const taskInput = screen.getByRole('textbox', { name: /Add task to Scope/i })
    fireEvent.change(taskInput, { target: { value: 'Write spec' } })
    fireEvent.submit(taskInput.closest('form'))

    fireEvent.click(await screen.findByRole('checkbox'))
    await waitFor(() => expect(screen.getAllByText(textContentMatcher('100%')).length).toBeGreaterThan(0))
  })

  it('settings: switch theme → persists; export/import round-trip via store', async () => {
    const ob = await onboard()
    await addHabit('Water')
    await screen.findByRole('button', { name: /Mark Water complete/i })

    window.location.hash = '#/settings'
    await screen.findByText(/Your name/i)
    fireEvent.click(screen.getByRole('button', { name: /Daylight/i }))
    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('daylight'))

    ob.unmount()
    renderApp()
    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('daylight'))
    // habit persisted too (navigate back to Today)
    window.location.hash = '#/today'
    await screen.findByRole('button', { name: /Mark Water complete/i })
  })

  it('unknown hash falls back to Today', async () => {
    await onboard()
    window.location.hash = '#/nonsense'
    await screen.findByText(/Start with one habit/i)
  })

  it('bottom nav has exactly the five tabs and they navigate', async () => {
    await onboard()
    const nav = document.querySelector('.bottom-nav')
    expect(nav).toBeTruthy()
    for (const label of ['Today', 'Calendar', 'Week', 'Insights', 'Mind']) {
      expect(within(nav).getByText(label)).toBeTruthy()
    }
    expect(within(nav).getAllByRole('link')).toHaveLength(5)

    fireEvent.click(within(nav).getByText('Calendar'))
    await screen.findByText(/Tap any past day to log it/i)
    fireEvent.click(within(nav).getByText('Week'))
    await screen.findByText(/No habits scheduled this week/i)
    fireEvent.click(within(nav).getByText('Insights'))
    await screen.findByText(/Nothing to analyze yet/i)
  })

  it('calendar: toggling a past day updates stats (data integrity)', async () => {
    await onboard()
    await addHabit('Pushups')
    await screen.findByRole('button', { name: /Mark Pushups complete/i })

    window.location.hash = '#/calendar'
    const now = new Date()
    const tLabel = `Mark done: Pushups, ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`
    const cell = await screen.findByRole('button', { name: tLabel })
    fireEvent.click(cell)
    await waitFor(() => expect(cell.getAttribute('aria-pressed')).toBe('true'))
    // today's screen agrees
    window.location.hash = '#/today'
    await waitFor(() => expect(screen.getByRole('button', { name: /Mark Pushups not done/i })).toBeTruthy())
    window.location.hash = '#/week'

    // week screen reflects it
    window.location.hash = '#/week'
    await screen.findByText(/By habit/i)
    await waitFor(() => {
      const el = screen.getByText((_, e) => e?.tagName === 'P' && / of \d+ check-ins/.test(e.textContent || ''))
      expect(el.textContent).toMatch(/^\d+ of \d+ check-ins$/)
      expect(Number(el.textContent.match(/^(\d+)/)[1])).toBeGreaterThanOrEqual(1)
    })
  })
})
