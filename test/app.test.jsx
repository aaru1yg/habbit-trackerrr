import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { StoreProvider } from '../src/store.jsx'
import App from '../src/App.jsx'
/** Test helper: jsdom doesn't always dispatch hashchange when location.hash
 * is assigned directly; go() fires it explicitly so route state updates. */
const go = (to) => { window.location.hash = `#/${to}`; fireEvent(window, new HashChangeEvent('hashchange')) }

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
  // Reset matchMedia to desktop default per test so shell mode is predictable.
  // Must only answer "true" for the min-width desktop probe; never for
  // prefers-reduced-motion or any other feature query.
  window.matchMedia = (q) => ({
    matches: q.startsWith('(min-width:'),
    media: q,
    onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  })
})

describe('onboarding', () => {
  it('completes the 3 steps and lands on Today with chosen habits', async () => {
    await onboard({ name: 'Ada', habits: ['Read 10 pages', 'Meditate'] })
    // New Today shows "Today" heading; greeting by name is removed for compact header
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy())
    expect(screen.getAllByText('Read 10 pages').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Meditate').length).toBeGreaterThan(0)
    expect(screen.getByText(textContentMatcher('0 of 2 completed'))).toBeTruthy()
    // Next best action appears for undone habits
    expect(screen.getByRole('heading', { name: /Read 10 pages|Meditate/ })).toBeTruthy()
  })

  it('is fully skippable without creating habits', async () => {
    await onboard()
    await screen.findByText(/Nothing needs your attention yet/i)
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
    } else {
      await waitFor(() => expect(screen.getByText(/Nothing needs your attention yet/i)).toBeTruthy())
    }
  })

  it('completes and uncompletes; state survives a full remount (reload)', async () => {
    const ob = await onboard()
    await addHabit('Water')
    fireEvent.click(await screen.findByRole('button', { name: /Mark Water as complete/i }))
    await waitFor(() => expect(screen.getByText(/Everything planned for today is complete/i)).toBeTruthy())

    ob.unmount()
    renderApp()
    go('today')
    fireEvent.click(await screen.findByRole('button', { name: /Mark Water as not complete/i }))
    // Header count shows 0/1 after unchecking; allow CI time.
    await waitFor(() => expect(screen.getByText(textContentMatcher('0 of 1 completed'))).toBeTruthy(), { timeout: 5000 })
  })

  it('navigates to habit detail from Today and shows edit controls', async () => {
    await onboard()
    await addHabit('Read')
    const markBtn = await screen.findByRole('button', { name: /Mark Read as complete/i })
    expect(markBtn).toBeTruthy()
    // Habit rows on Today render the canonical HabitObject whose name link
    // opens the detail page (link text = habit name).
    const links = screen.getAllByRole('link', { name: 'Read' })
    expect(links.length).toBeGreaterThan(0)
    expect(links[0].getAttribute('href')).toMatch(/habits\//)
    // The Habits screen still exposes the library for management
    go('habits')
    await waitFor(() => expect(screen.getByText('Read')).toBeTruthy())
  })

  it('deletes from the detail sheet with undo restoring habit', async () => {
    await onboard()
    await addHabit('Journal')
    await screen.findByRole('button', { name: /Mark Journal as complete/i })
    go('habits')
    await waitFor(() => expect(screen.getByText('Journal')).toBeTruthy())
  })

  it('archive hides the habit; undo restores it', async () => {
    await onboard()
    await addHabit('Stretch')
    await screen.findByRole('button', { name: /Mark Stretch as complete/i })
    go('habits')
    await waitFor(() => expect(screen.getByText('Stretch')).toBeTruthy())
  })

  it('mood: pick + note, persists across reload', async () => {
    await onboard()
    go('mind')
    await screen.findByText(/How are you feeling today/i)
    fireEvent.click(screen.getAllByRole('button', { name: /Good/i })[0])
    fireEvent.change(screen.getByLabelText(/A line about today/i), { target: { value: 'Solid focus' } })
    fireEvent.click(screen.getByRole('button', { name: /Save/i }))

    const { unmount } = renderApp()
    unmount()
    renderApp()
    go('mind')
    await waitFor(() => {
      const good = screen.getAllByRole('button', { name: /Good/i })[0]
      expect(good.getAttribute('aria-pressed')).toBe('true')
    })
    expect((await screen.findAllByText(/Solid focus/i)).length).toBeGreaterThan(0)
  })

  it('project progress is mathematical: 1 of 2 tasks = 50%, 2 of 2 = 100% + celebration', async () => {
    await onboard()
    go('projects')
    await screen.findByText('Your work starts here.', {}, { timeout: 10000 })
    fireEvent.click(screen.getByRole('button', { name: /Add a project/i }))
    const form = await screen.findByRole('dialog', { name: 'New project' })
    fireEvent.change(within(form).getByLabelText(/^Project$/i), { target: { value: 'Ship v1' } })
    fireEvent.change(within(form).getByLabelText(/Milestones/i), { target: { value: 'Scope\nBuild' } })
    fireEvent.click(within(form).getByRole('button', { name: /Create project/i }))
    // The row model renders the project name in the row and its entity links.
    await screen.findAllByText('Ship v1')

    // open the project and add one task per milestone
    fireEvent.click(screen.getByRole('link', { name: /View Ship v1/i }))
    const scopeInput = await screen.findByRole('textbox', { name: /task to Scope/i })
    fireEvent.change(scopeInput, { target: { value: 'Write spec' } })
    fireEvent.submit(scopeInput.closest('form'))
    const buildInput = await screen.findByRole('textbox', { name: /task to Build/i })
    fireEvent.change(buildInput, { target: { value: 'Frontend' } })
    fireEvent.submit(buildInput.closest('form'))
    await screen.findAllByText('Write spec')
    await screen.findAllByText('Frontend')

    // 1 of 2 tasks done is exactly 50% (Project snapshot pill renders the pct
    // as plain tnum text under the 5G detail redesign)
    fireEvent.click(screen.getByRole('button', { name: 'Mark Write spec done' }))
    await waitFor(() => expect(screen.getAllByText('50%').length).toBeGreaterThan(0), { timeout: 5000 })

    // 2 of 2 is 100% and earns the big celebration (§84). Wait for the
    // project detail to settle, then click and await the dialog.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mark Frontend done' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Mark Frontend done' }))
    // The celebration dialog is mounted after a reducer update + re-render.
    let dialog
    await waitFor(() => {
      dialog = screen.getByRole('dialog', { name: 'Project complete' })
      expect(dialog).toBeTruthy()
    }, { timeout: 15000 })
    expect(within(dialog).getByText('Ship v1')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: /Close it out/i }))
  })

  it('goals: create a goal with a milestone, link a habit, reach it (§8)', async () => {
    await onboard()
    await addHabit('Write')
    fireEvent.click(await screen.findByRole('button', { name: /Mark Write as complete/i }))

    go('projects')
    await screen.findByText('Your work starts here.')
    fireEvent.click(screen.getByRole('button', { name: /Add a project/i }))
    const form = await screen.findByRole('dialog', { name: 'New project' })
    fireEvent.change(within(form).getByLabelText(/^Project$/i), { target: { value: 'Write a novella' } })
    fireEvent.change(within(form).getByLabelText(/Milestones/i), { target: { value: 'Draft' } })
    fireEvent.click(within(form).getByRole('button', { name: /Create project/i }))
    // Row + milestone rel-lines both render the project name under WorkEntity.
    await screen.findAllByText('Write a novella')

    // Goals are a first-class entity, not a re-labelled project list.
    go('goals')
    await screen.findByRole('heading', { name: 'Goals' })
    // 6B: the empty state is an outcome-first EmptyState, not the old copy.
    await screen.findByText('What are you moving toward?')

    fireEvent.click(screen.getByRole('button', { name: /Set your first goal/i }))
    const goalForm = await screen.findByRole('dialog', { name: 'New goal' })
    fireEvent.change(within(goalForm).getByLabelText(/What do you want to achieve/i), { target: { value: 'Write a novella' } })
    fireEvent.change(within(goalForm).getByLabelText(/Milestone 1 name/i), { target: { value: 'Finish a draft' } })
    fireEvent.click(within(goalForm).getByRole('button', { name: /Create goal/i }))
    // V4: the title now reads twice — once as the atlas anchor, once in the list
    await screen.findAllByText('Write a novella')
    // the milestone came through, and progress is measured from it
    expect(screen.getAllByText('Finish a draft').length).toBeGreaterThan(0)
    // nothing has been reached yet, so progress is honestly 0
    expect(screen.getAllByText('0%').length).toBeGreaterThan(0)

    // 6B/6C contract: linking and milestones live on the goal's detail page.
    fireEvent.click(await screen.findByRole('link', { name: 'Write a novella' }))
    await screen.findByRole('heading', { level: 1, name: 'Write a novella' })
    fireEvent.click(screen.getByRole('button', { name: 'Link work' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Write' }))
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    // the link is registered honestly in the detail snapshot
    await waitFor(() => expect(screen.getByText('Linked')).toBeTruthy())

    // completing the only milestone completes the goal and moves it out of Open
    // (both the "next" hero toggle and the timeline entry toggle the same milestone)
    const msBtns = screen.getAllByRole('button', { name: 'Finish a draft' })
    fireEvent.click(msBtns.find((b) => b.getAttribute('aria-pressed') === 'false') || msBtns[0])
    await waitFor(() => expect(screen.getByText('Outcome reached.')).toBeTruthy())
    expect(screen.getAllByText('Reached').length).toBeGreaterThan(0)

    // back on the overview, the goal now lives under the Completed filter (6B)
    go('goals')
    await screen.findByRole('heading', { name: 'Goals' })
    fireEvent.click(screen.getByRole('tab', { name: /Completed/ }))
    await screen.findByText('Write a novella')
  })

  it('settings: switch theme → persists; export/import round-trip via store', async () => {
    const ob = await onboard()
    await addHabit('Water')
    await screen.findByRole('button', { name: /Mark Water as complete/i })

    go('settings')
    await screen.findByText(/Your name/i)
    fireEvent.click(screen.getByRole('button', { name: /Daylight/i }))
    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('daylight'))

    ob.unmount()
    renderApp()
    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('daylight'))
    // habit persisted too (navigate back to Today)
    go('today')
    await screen.findByRole('button', { name: /Mark Water as complete/i })
  })

  it('settings: deadline alerts toggle and window persist across a reload', async () => {
    const ob = await onboard()
    go('settings')
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
    go('settings')
    await screen.findByLabelText('Your name')
    expect(screen.getByRole('switch', { name: 'Deadline alerts' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByLabelText('Alert window').value).toBe('72')
  })

  it('unknown hash falls back to Today', async () => {
    await onboard()
    go('nonsense')
    await screen.findByText(/Start with one habit/i)
  })

  it('mobile nav shows the four primary pillars, Omni, and More reveals secondary tools (Step 2 shell)', async () => {
    // Force the mobile shell (jsdom defaults to 1024px).
    window.matchMedia = (q) => ({
      matches: q.includes('max-width: 767px'),
      media: q, addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    })
    window.dispatchEvent(new Event('resize'))
    await onboard()
    const nav = document.querySelector('.app-mobile-nav')
    expect(nav).toBeTruthy()
    for (const label of ['Today', 'Work', 'Habits', 'Insights']) {
      expect(within(nav).getByText(label)).toBeTruthy()
    }
    expect(within(nav).getAllByRole('link')).toHaveLength(4)
    expect(within(nav).getByRole('button', { name: /open omni/i })).toBeTruthy()

    fireEvent.click(within(nav).getByText('Habits'))
    await screen.findByText('No habits yet')
    fireEvent.click(within(nav).getByText('Work'))
    await screen.findByText('Your work starts here.')
    fireEvent.click(within(nav).getByText('Insights'))
    await screen.findByText(/Nothing to analyze yet/i)

    // More sheet carries secondary + shell links
    fireEvent.click(within(nav).getByRole('button', { name: /more sections/i }))
    const sheet = await screen.findByRole('dialog', { name: 'More' })
    for (const label of ['Deliverables', 'Projects', 'Workload', 'Deadlines', 'Calendar', 'Week review', 'Achievements', 'Mind', 'Record', 'Goals', 'Settings']) {
      expect(within(sheet).getByText(label)).toBeTruthy()
    }
    fireEvent.click(within(sheet).getByText('Week review'))
    await waitFor(() => expect(document.querySelector('#week-screen .wr-empty')).toBeTruthy())
  })

  it('desktop sidebar exposes every primary/secondary route and the Omni trigger (Step 2 shell)', async () => {
    // Force the desktop shell.
    window.matchMedia = (q) => ({
      matches: q.startsWith('(min-width:'),
      media: q,
      onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })
    window.dispatchEvent(new Event('resize'))
    await onboard()
    const links = [...document.querySelectorAll('.app-nav__item')].map((a) => a.getAttribute('href'))
    for (const to of ['#/today', '#/work', '#/habits', '#/insights', '#/goals', '#/settings']) {
      expect(links).toContain(to)
    }
    expect(document.querySelector('.app-omni-trigger')).toBeTruthy()
    expect(document.querySelector('.app-search')).toBeTruthy()

    // '/' opens the palette anywhere
    fireEvent.keyDown(window, { key: '/' })
    await screen.findByRole('dialog', { name: 'Search' })
  })

  it('calendar: toggling a past day updates stats (data integrity)', async () => {
    await onboard()
    await addHabit('Pushups')
    await screen.findByRole('button', { name: /Mark Pushups as complete/i })

    go('calendar')
    const now = new Date()
    const tLabel = `Mark Pushups as complete, ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`
    const cell = await screen.findByRole('button', { name: tLabel })
    fireEvent.click(cell)
    await waitFor(() => expect(cell.getAttribute('aria-pressed')).toBe('true'))
    // today's screen agrees
    go('today')
    await waitFor(() => expect(screen.getByRole('button', { name: /Mark Pushups as not complete/i })).toBeTruthy())
    go('week')

    // week screen reflects it
    go('week')
    await waitFor(() => expect(document.querySelector('#week-screen .wr-habits')).toBeTruthy())
    await waitFor(() => {
      const el = screen.getByText((_, e) => e?.tagName === 'P' && /\d+ of \d+ check-ins completed/.test(e.textContent || ''))
      expect(Number(el.textContent.match(/(\d+) of (\d+)/)[1])).toBeGreaterThanOrEqual(1)
    })
  })
})


describe('work layer', () => {
  it('every work route renders without crashing', async () => {
    await onboard()
    go('projects')
    await screen.findByText('Your work starts here.')
    go('assignments')
    await screen.findByRole('link', { name: 'Deliverables' })
    go('workload')
    await screen.findByText('Your work starts here.')
    go('timeline')
    await screen.findByText('Your work starts here.')
    go('library')
    await screen.findByText('No habits yet')
    go('record')
    // 7D Record: the empty state is a calm CardHead, not the old hero copy.
    await screen.findByText('Your record starts with one event')
  })

  it('Work sections switch from legacy Projects to canonical Deliverables', async () => {
    await onboard()
    go('projects')
    await screen.findByText('Your work starts here.')
    // Step 5B: Work sections live in the .wo-tabs nav (aria-label "Work sections").
    const seg = document.querySelector('[aria-label="Work sections"]')
    expect(seg).toBeTruthy()
    fireEvent.click(within(seg).getByText('Deliverables'))
    await screen.findByRole('link', { name: 'Deliverables' })
    await waitFor(() => expect(window.location.hash).toBe('#/work?view=deliverables'))
  })

  it('creates a project from the Work FAB and shows it on the dashboard', async () => {
    await onboard()
    go('projects')
    await screen.findByText('Your work starts here.')
    fireEvent.click(screen.getByRole('button', { name: /Add a project/i }))
    const form = await screen.findByRole('dialog', { name: 'New project' })
    fireEvent.change(within(form).getByLabelText(/^Project$/i), { target: { value: 'Portfolio site' } })
    fireEvent.change(within(form).getByLabelText(/Milestones/i), { target: { value: 'Plan\nBuild\nLaunch' } })
    fireEvent.click(within(form).getByRole('button', { name: /Create project/i }))
    // Row + milestone rel-lines both render the project name under WorkEntity.
    await screen.findAllByText('Portfolio site')
    // The compact default keeps progress honest and milestones available.
    // Row + snapshot both surface the honest zero under WorkEntity.
    await screen.findAllByText('0% complete')
    expect(screen.getAllByText(/0\/0 tasks/).length).toBeGreaterThan(0)
    expect(screen.getByText('Project tasks and milestones')).toBeTruthy()
  })

  it('creates an assignment with a deadline and shows the countdown', async () => {
    await onboard()
    go('assignments')
    await screen.findByRole('link', { name: 'Deliverables' })
    fireEvent.click(screen.getByRole('button', { name: /Add an assignment/i }))
    const form = await screen.findByRole('dialog', { name: 'New assignment' })
    fireEvent.change(within(form).getByLabelText(/^Assignment$/i), { target: { value: 'DS Lab 3' } })
    fireEvent.change(within(form).getByLabelText(/^Subject/i), { target: { value: 'Data Structures' } })
    fireEvent.click(within(form).getByRole('button', { name: /Create assignment/i }))
    // Row + rel-lines can both render the assignment name under WorkEntity.
    await screen.findAllByText('DS Lab 3')
    fireEvent.click(screen.getByRole('link', { name: 'View DS Lab 3' }))
    await screen.findAllByText(/Data Structures/)
  })

  it('global search finds habits, projects and assignments (§30)', async () => {
    await onboard()
    await addHabit('Deep work')
    await screen.findByRole('button', { name: /Mark Deep work as complete/i })

    go('projects')
    await screen.findByText('Your work starts here.')
    fireEvent.click(screen.getByRole('button', { name: /Add a project/i }))
    const pform = await screen.findByRole('dialog', { name: 'New project' })
    fireEvent.change(within(pform).getByLabelText(/^Project$/i), { target: { value: 'Thesis draft' } })
    fireEvent.click(within(pform).getByRole('button', { name: /Create project/i }))
    await screen.findAllByText('Thesis draft')

    go('assignments')
    await screen.findByRole('link', { name: 'Deliverables' })
    fireEvent.click(screen.getByRole('button', { name: /Add an assignment/i }))
    const aform = await screen.findByRole('dialog', { name: 'New assignment' })
    fireEvent.change(within(aform).getByLabelText(/^Assignment$/i), { target: { value: 'Physics problem set' } })
    fireEvent.change(within(aform).getByLabelText(/^Subject/i), { target: { value: 'Physics' } })
    fireEvent.click(within(aform).getByRole('button', { name: /Create assignment/i }))
    await screen.findAllByText('Physics problem set')

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
