import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ShellSidebar from '../src/components/shell/ShellSidebar.jsx'
import ShellMobileNav from '../src/components/shell/ShellMobileNav.jsx'
import ShellTopBar from '../src/components/shell/ShellTopBar.jsx'
import PageContainer from '../src/components/shell/PageContainer.jsx'
import { PRIMARY, resolveActivePillar, pageTitle } from '../src/components/shell/nav.js'

vi.mock('../src/lib/router.jsx', async () => {
  const actual = await vi.importActual('../src/lib/router.jsx')
  return {
    ...actual,
    Link: ({ to, children, ...rest }) => (
      <a href={`#/${to}`} data-to={to} {...rest}>{children}</a>
    ),
  }
})

describe('nav model', () => {
  it('exposes four primary pillars in the canonical order', () => {
    expect(PRIMARY.map((p) => p.id)).toEqual(['today', 'work', 'habits', 'insights'])
  })
  it('resolves canonical parents for contextual routes', () => {
    expect(resolveActivePillar('today')).toBe('today')
    expect(resolveActivePillar('projects')).toBe('work')
    expect(resolveActivePillar('assignments')).toBe('work')
    expect(resolveActivePillar('workload')).toBe('work')
    expect(resolveActivePillar('timeline')).toBe('work')
    expect(resolveActivePillar('calendar')).toBe('habits')
    expect(resolveActivePillar('week')).toBe('habits')
    expect(resolveActivePillar('library')).toBe('habits')
    expect(resolveActivePillar('mind')).toBe('insights')
    expect(resolveActivePillar('record')).toBe('insights')
    expect(resolveActivePillar('achievements')).toBe('insights')
  })
  it('resolves secondary shell items', () => {
    expect(resolveActivePillar('goals')).toBe('goals')
    expect(resolveActivePillar('settings')).toBe('settings')
  })
  it('maps page titles for secondary views', () => {
    expect(pageTitle('work', 'projects')).toBe('Projects')
    expect(pageTitle('work', 'deliverables')).toBe('Deliverables')
    expect(pageTitle('assignments')).toBe('Deliverables')
    expect(pageTitle('work', 'deadlines')).toBe('Deadlines')
    expect(pageTitle('habits', 'calendar')).toBe('Calendar')
    expect(pageTitle('habits', 'week')).toBe('Week review')
    expect(pageTitle('insights', 'achievements')).toBe('Achievements')
    expect(pageTitle('insights', 'mind')).toBe('Mind')
    expect(pageTitle('today')).toBe('Today')
    expect(pageTitle('goals')).toBe('Goals')
    expect(pageTitle('settings')).toBe('Settings')
  })
})

describe('ShellSidebar', () => {
  it('renders primary navigation links', () => {
    render(<ShellSidebar route="today" />)
    const nav = screen.getByRole('navigation', { name: /primary/i })
    expect(nav).toBeTruthy()
    for (const p of PRIMARY) {
      expect(screen.getByRole('link', { name: new RegExp(p.label, 'i') })).toBeTruthy()
    }
  })
  it('marks the active pillar with aria-current', () => {
    render(<ShellSidebar route="projects" />)
    const work = screen.getByRole('link', { name: /work/i })
    expect(work.getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: /today/i }).getAttribute('aria-current')).toBeNull()
  })
  it('renders secondary Goals + Settings', () => {
    render(<ShellSidebar route="goals" />)
    const sec = screen.getByRole('navigation', { name: /secondary/i })
    expect(sec).toBeTruthy()
    expect(screen.getByRole('link', { name: /goals/i }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: /settings/i })).toBeTruthy()
  })
  it('provides a labelled Omni trigger and Search button', async () => {
    const user = userEvent.setup()
    const onOmni = vi.fn()
    const onSearch = vi.fn()
    render(<ShellSidebar route="today" onOmni={onOmni} onSearch={onSearch} />)
    await user.click(screen.getByRole('button', { name: /open omni/i }))
    expect(onOmni).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /^search$/i }))
    expect(onSearch).toHaveBeenCalled()
  })
})

describe('ShellMobileNav', () => {
  it('renders 4 primary items + Omni + More', () => {
    render(<ShellMobileNav route="today" />)
    const nav = screen.getByRole('navigation', { name: /primary/i })
    expect(nav).toBeTruthy()
    for (const p of PRIMARY) {
      expect(screen.getByRole('link', { name: new RegExp(p.label, 'i') })).toBeTruthy()
    }
    expect(screen.getByRole('button', { name: /omni/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /more/i })).toBeTruthy()
  })
  it('applies aria-current to active pillar for contextual routes', () => {
    const { rerender } = render(<ShellMobileNav route="habits" />)
    expect(screen.getByRole('link', { name: /habits/i }).getAttribute('aria-current')).toBe('page')
    rerender(<ShellMobileNav route="calendar" />)
    expect(screen.getByRole('link', { name: /habits/i }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: /work/i }).getAttribute('aria-current')).toBeNull()
  })
  it('fires onCapture and onMore', async () => {
    const user = userEvent.setup()
    const onCapture = vi.fn()
    const onMore = vi.fn()
    render(<ShellMobileNav route="today" onCapture={onCapture} onMore={onMore} />)
    await user.click(screen.getByRole('button', { name: /omni/i }))
    expect(onCapture).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /more/i }))
    expect(onMore).toHaveBeenCalled()
  })
  it('renders all interactive targets with the shell mobile item class', () => {
    render(<ShellMobileNav route="today" onMore={() => {}} onCapture={() => {}} />)
    const links = screen.getAllByRole('link')
    const buttons = screen.getAllByRole('button')
    for (const el of [...links, ...buttons]) {
      expect(el.className).toMatch(/app-mobile-nav__/)
    }
    // The central Omni button is a prominent ≥48px target.
    const omni = screen.getByRole('button', { name: /omni/i })
    expect(omni.className).toMatch(/app-mobile-nav__omni/)
  })
})

describe('ShellTopBar', () => {
  it('renders the provided title', () => {
    render(<ShellTopBar title="Today" />)
    expect(screen.getByText('Today')).toBeTruthy()
    expect(screen.getByText('Today').className).toMatch(/app-topbar__heading/)
  })
  it('renders Omni on desktop and calls handler', async () => {
    const user = userEvent.setup()
    const onOmni = vi.fn()
    render(<ShellTopBar title="Work" onOmni={onOmni} />)
    const btn = screen.getByRole('button', { name: /open omni/i })
    await user.click(btn)
    expect(onOmni).toHaveBeenCalled()
  })
  it('renders icon buttons on mobile', () => {
    render(<ShellTopBar title="Habits" isMobile />)
    expect(screen.getByRole('button', { name: /search/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /open omni/i })).toBeTruthy()
  })
})

describe('PageContainer', () => {
  it('renders children and app page class', () => {
    render(<PageContainer data-testid="pc"><p>screen</p></PageContainer>)
    const pc = screen.getByTestId('pc')
    expect(pc.className).toMatch(/app-page/)
    expect(pc.textContent).toBe('screen')
  })
})
