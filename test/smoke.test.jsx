import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { StoreProvider } from '../src/store.jsx'
import App from '../src/App.jsx'

const renderApp = () =>
  render(
    <StoreProvider>
      <App />
    </StoreProvider>
  )

beforeEach(() => {
  window.localStorage.clear()
})

describe('Aaru habit tracker', () => {
  it('starts completely empty — no fake / seeded data', () => {
    renderApp()
    expect(screen.getByText(/Aaru/)).toBeTruthy()
    expect(screen.getByText(/Fresh start/)).toBeTruthy()
    // no seeded habit names or check-ins anywhere
    expect(screen.queryByText(/Build Portfolio Site/)).toBeNull()
    expect(document.querySelectorAll('button[aria-label^="Mark "]').length).toBe(0)
    // the calendar + week board render their empty states
    expect(screen.getByText(/Your calendar is ready/)).toBeTruthy()
    expect(screen.getByText(/Your week board is empty/)).toBeTruthy()
  })

  it('renders an auto calendar for the current month with weekly bands', () => {
    renderApp()
    const now = new Date()
    const monthName = now.toLocaleString('en-US', { month: 'long' })
    expect(screen.getAllByText(new RegExp(monthName)).length).toBeGreaterThan(0)
    expect(screen.getByText(/Habit Tracker/)).toBeTruthy()
    // week start date shown on the task tracker board
    expect(screen.getByText(/Week Start Date/)).toBeTruthy()
  })

  it('can add a habit via quick add and it appears in the calendar grid', async () => {
    renderApp()
    const input = screen.getByLabelText('Quick add habit name')
    fireEvent.change(input, { target: { value: 'Cold Shower' } })
    fireEvent.submit(input.closest('form'))
    await waitFor(() => expect(screen.getAllByText(/Cold Shower/).length).toBeGreaterThan(0))
    // week bands now visible
    expect(screen.getAllByText(/Week 1/).length).toBeGreaterThan(0)
    // checkbox cells exist (one per day for the habit)
    const cells = document.querySelectorAll('button[aria-label^="Mark "]')
    const dim = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
    expect(cells.length).toBeGreaterThanOrEqual(dim)
    // Analysis section with per-habit % appears
    expect(screen.getByText(/Analysis$/)).toBeTruthy()
  })

  it('adds a preset with one tap and toggles today in the calendar', async () => {
    renderApp()
    fireEvent.click(screen.getByText(/＋ 💪 Gym/))
    await waitFor(() => expect(screen.getAllByText(/Gym/).length).toBeGreaterThan(0))
    const enabled = Array.from(document.querySelectorAll('button[aria-label="Mark done"]')).filter((b) => !b.disabled)
    expect(enabled.length).toBeGreaterThan(0)
    fireEvent.click(enabled[enabled.length - 1])
    await waitFor(() => expect(document.querySelectorAll('button[aria-label="Mark not done"]').length).toBeGreaterThan(0))
  })

  it('opens the add modal for a habit and for a project', () => {
    renderApp()
    fireEvent.click(screen.getByText('📅 New habit'))
    expect(screen.getByText(/What kind is this/)).toBeTruthy()
    expect(screen.getByText(/Quick pick/)).toBeTruthy()
    fireEvent.click(screen.getByText('Cancel'))
    fireEvent.click(screen.getAllByText('🚀 New project')[0])
    expect(screen.getByText(/Create project/)).toBeTruthy()
  })

  it('creates a project through the modal and shows the project tracker', async () => {
    renderApp()
    fireEvent.click(screen.getAllByText('🚀 New project')[0])
    const nameInput = screen.getByPlaceholderText(/Build portfolio site/)
    fireEvent.change(nameInput, { target: { value: 'Launch App' } })
    fireEvent.click(screen.getByText(/Create project/))
    await waitFor(() => expect(screen.getByText(/Custom project tracker/)).toBeTruthy())
    expect(screen.getAllByText(/Launch App/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('100').length).toBeGreaterThan(0)
  })

  it('logs mood & motivation for the mental state graph', async () => {
    renderApp()
    expect(screen.getByText(/Mental State/)).toBeTruthy()
    const dials = screen.getAllByText('8')
    fireEvent.click(dials[0])
    await waitFor(() => expect(screen.getByText(/Today's score/).textContent).toMatch(/80%/))
  })

  it('has a floating add button', () => {
    renderApp()
    expect(screen.getByLabelText('Add new habit or project')).toBeTruthy()
  })
})
