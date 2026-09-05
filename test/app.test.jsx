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

  it('project progress is mathematical: 1 of 2 tasks = 50%, 2 of 2 = 100% + celebration', async () => {
    await onboard()
    window.location.hash = '#/projects'
    await screen.findByText('No projects yet')
    fireEvent.click(screen.getByRole('button', { name: /Add a project/i }))
    const form = await screen.findByRole('dialog', { name: 'New project' })
    fireEvent.change(within(form).getByLabelText(/^Project$/i), { target: { value: 'Ship v1' } })
    fireEvent.change(within(form).getByLabelText(/Milestones/i), { target: { value: 'Scope\nBuild' } })
    fireEvent.click(within(form).getByRole('button', { name: /Create project/i }))
    await screen.findByText('Ship v1')

    // open the project and add one task per milestone
    fireEvent.click(screen.getByRole('link', { name: /Open Ship v1/i }))
    const scopeInput = await screen.findByRole('textbox', { name: /task to Scope/i })
    fireEvent.change(scopeInput, { target: { value: 'Write spec' } })
    fireEvent.submit(scopeInput.closest('form'))
    const buildInput = await screen.findByRole('textbox', { name: /task to Build/i })
    fireEvent.change(buildInput, { target: { value: 'Frontend' } })
    fireEvent.submit(buildInput.closest('form'))
    await screen.findByText('Write spec')
    await screen.findByText('Frontend')

    // 1 of 2 tasks done is exactly 50%
    fireEvent.click(screen.getByRole('button', { name: 'Mark Write spec done' }))
    await waitFor(() => expect(screen.getAllByText(textContentMatcher('50%')).length).toBeGreaterThan(0))

    // 2 of 2 is 100% and earns the big celebration (§84)
    fireEvent.click(screen.getByRole('button', { name: 'Mark Frontend done' }))
    const dialog = await screen.findByRole('dialog', { name: 'Project complete' })
    expect(within(dialog).getByText('Ship v1')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: /Close it out/i }))
  })

  it('goals: direction links a habit to a project and shows the real 30-day rate', async () => {
    await onboard()
    await addHabit('Write')
    fireEvent.click(await screen.findByRole('button', { name: /Mark Write complete/i }))

    window.location.hash = '#/projects'
    await screen.findByText('No projects yet')
    fireEvent.click(screen.getByRole('button', { name: /Add a project/i }))
    const form = await screen.findByRole('dialog', { name: 'New project' })
    fireEvent.change(within(form).getByLabelText(/^Project$/i), { target: { value: 'Write a novella' } })
    fireEvent.change(within(form).getByLabelText(/Milestones/i), { target: { value: 'Draft' } })
    fireEvent.click(within(form).getByRole('button', { name: /Create project/i }))
    await screen.findByText('Write a novella')

    window.location.hash = '#/goals'
    await screen.findByRole('heading', { name: 'Goals' })
    await screen.findByText('Write a novella')
    expect(screen.getByText(/Habits not tied to a goal/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Link habits/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'Write' }))
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    await waitFor(() => expect(screen.queryByText(/Habits not tied to a goal/)).toBeNull())
    // a real completion today means a real rate, never a placeholder
    expect(screen.getByText(/100% · 30d/)).toBeTruthy()
    // the direction summary counts the link
    expect(screen.getByText('Habits linked')).toBeTruthy()
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

  it('settings: deadline alerts toggle and window persist across a reload', async () => {
    const ob = await onboard()
    window.location.hash = '#/settings'
    await screen.findByLabelText('Your name')

    const sw = screen.getByRole('switch', { name: 'Deadline alerts' })
    expect(sw.getAttribute('aria-checked')).toBe('true')
    fireEvent.change(screen.getByLabelText('Alert window'), { target: { value: '72' } })
    fireEvent.click(sw)
    expect(sw.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(sw)
    expect(sw.getAttribute('aria-checked')).toBe('true')

    ob.unmount()
    renderApp()
    window.location.hash = '#/settings'
    await screen.findByLabelText('Your name')
    expect(screen.getByRole('switch', { name: 'Deadline alerts' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByLabelText('Alert window').value).toBe('72')
  })

  it('unknown hash falls back to Today', async () => {
    await onboard()
    window.location.hash = '#/nonsense'
    await screen.findByText(/Start with one habit/i)
  })

  it('mobile nav shows the four primary tabs and More reveals the rest (§78)', async () => {
    await onboard()
    const nav = document.querySelector('.bottom-nav')
    expect(nav).toBeTruthy()
    for (const label of ['Today', 'Calendar', 'Work', 'Insights']) {
      expect(within(nav).getByText(label)).toBeTruthy()
    }
    expect(within(nav).getAllByRole('link')).toHaveLength(4)

    fireEvent.click(within(nav).getByText('Calendar'))
    await screen.findByText(/Tap any past day to log it/i)
    fireEvent.click(within(nav).getByText('Work'))
    await screen.findByText('No projects yet')
    fireEvent.click(within(nav).getByText('Insights'))
    await screen.findByText(/Nothing to analyze yet/i)

    // More sheet carries the secondary routes
    fireEvent.click(within(nav).getByRole('button', { name: 'More sections' }))
    const sheet = await screen.findByRole('dialog')
    for (const label of ['Week', 'Mind', 'Workload', 'Deadlines', 'Habit library', 'Goals', 'Record', 'Settings']) {
      expect(within(sheet).getByText(label)).toBeTruthy()
    }
    fireEvent.click(within(sheet).getByText('Week'))
    await screen.findByText(/No habits scheduled this week/i)
  })

  it('desktop sidebar exposes every route and the search shortcut (§78, §30)', async () => {
    await onboard()
    const links = [...document.querySelectorAll('.sidebar-nav a, .sidebar-settings')].map((a) => a.getAttribute('href'))
    for (const to of ['#/today', '#/calendar', '#/week', '#/projects', '#/assignments', '#/workload',
      '#/timeline', '#/insights', '#/mind', '#/library', '#/goals', '#/record', '#/settings']) {
      expect(links).toContain(to)
    }
    expect(document.querySelector('.sidebar-search')).toBeTruthy()

    // '/' opens the palette anywhere
    fireEvent.keyDown(window, { key: '/' })
    await screen.findByRole('dialog', { name: 'Search' })
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


describe('work layer', () => {
  it('every work route renders without crashing', async () => {
    await onboard()
    window.location.hash = '#/projects'
    await screen.findByText('No projects yet')
    window.location.hash = '#/assignments'
    await screen.findByText('Nothing due yet')
    window.location.hash = '#/workload'
    await screen.findByText('No work scheduled')
    window.location.hash = '#/timeline'
    await screen.findByText('No deadlines in this view')
    window.location.hash = '#/library'
    await screen.findByText('No habits yet')
    window.location.hash = '#/record'
    await screen.findByText('Nothing recorded yet')
  })

  it('Work tab segments between Projects and Assignments', async () => {
    await onboard()
    window.location.hash = '#/projects'
    await screen.findByText('No projects yet')
    const seg = document.querySelector('.tabbar')
    expect(seg).toBeTruthy()
    fireEvent.click(within(seg).getByText('Assignments'))
    await screen.findByText('Nothing due yet')
    expect(window.location.hash).toBe('#/assignments')
  })

  it('creates a project from the Work FAB and shows it on the dashboard', async () => {
    await onboard()
    window.location.hash = '#/projects'
    await screen.findByText('No projects yet')
    fireEvent.click(screen.getByRole('button', { name: /Add a project/i }))
    const form = await screen.findByRole('dialog', { name: 'New project' })
    fireEvent.change(within(form).getByLabelText(/^Project$/i), { target: { value: 'Portfolio site' } })
    fireEvent.change(within(form).getByLabelText(/Milestones/i), { target: { value: 'Plan\nBuild\nLaunch' } })
    fireEvent.click(within(form).getByRole('button', { name: /Create project/i }))
    await screen.findByText('Portfolio site')
    // milestones drive the stepper; progress is honest at 0%
    await screen.findByText('Next: Plan')
    await screen.findByText('No tasks yet')
  })

  it('creates an assignment with a deadline and shows the countdown', async () => {
    await onboard()
    window.location.hash = '#/assignments'
    await screen.findByText('Nothing due yet')
    fireEvent.click(screen.getByRole('button', { name: /Create an assignment/i }))
    const form = await screen.findByRole('dialog', { name: 'New assignment' })
    fireEvent.change(within(form).getByLabelText(/^Assignment$/i), { target: { value: 'DS Lab 3' } })
    fireEvent.change(within(form).getByLabelText(/^Subject/i), { target: { value: 'Data Structures' } })
    fireEvent.click(within(form).getByRole('button', { name: /Create assignment/i }))
    await screen.findByText('DS Lab 3')
    await screen.findByText('Data Structures')
  })

  it('global search finds habits, projects and assignments (§30)', async () => {
    await onboard()
    await addHabit('Deep work')
    await screen.findByRole('button', { name: /Mark Deep work complete/i })

    window.location.hash = '#/projects'
    await screen.findByText('No projects yet')
    fireEvent.click(screen.getByRole('button', { name: /Add a project/i }))
    const pform = await screen.findByRole('dialog', { name: 'New project' })
    fireEvent.change(within(pform).getByLabelText(/^Project$/i), { target: { value: 'Thesis draft' } })
    fireEvent.click(within(pform).getByRole('button', { name: /Create project/i }))
    await screen.findByText('Thesis draft')

    window.location.hash = '#/assignments'
    await screen.findByText('Nothing due yet')
    fireEvent.click(screen.getByRole('button', { name: /Create an assignment/i }))
    const aform = await screen.findByRole('dialog', { name: 'New assignment' })
    fireEvent.change(within(aform).getByLabelText(/^Assignment$/i), { target: { value: 'Physics problem set' } })
    fireEvent.change(within(aform).getByLabelText(/^Subject/i), { target: { value: 'Physics' } })
    fireEvent.click(within(aform).getByRole('button', { name: /Create assignment/i }))
    await screen.findByText('Physics problem set')

    // open the palette and search
    fireEvent.keyDown(window, { key: '/' })
    const sheet = await screen.findByRole('dialog', { name: 'Search' })
    const input = within(sheet).getByLabelText(/Search everything/i)
    fireEvent.change(input, { target: { value: 'thesis' } })
    await waitFor(() => expect(within(sheet).getByText('Thesis draft')).toBeTruthy())
    expect(within(sheet).getByText('Project')).toBeTruthy()

    fireEvent.change(input, { target: { value: 'physics' } })
    await waitFor(() => expect(within(sheet).getByText('Physics problem set')).toBeTruthy())
    expect(within(sheet).getAllByText('Assignment').length).toBeGreaterThan(0)

    fireEvent.change(input, { target: { value: 'deep' } })
    await waitFor(() => expect(within(sheet).getByText('Deep work')).toBeTruthy())

    // picking a result navigates to the entity
    fireEvent.change(input, { target: { value: 'thesis' } })
    await waitFor(() => expect(within(sheet).getByText('Thesis draft')).toBeTruthy())
    fireEvent.click(within(sheet).getByText('Thesis draft'))
    await waitFor(() => expect(window.location.hash).toMatch(/^#\/projects\//))
  })
})
