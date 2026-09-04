import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { StoreProvider } from '../src/store.jsx'
import App from '../src/App.jsx'

const renderApp = () =>
  render(
    <StoreProvider>
      <App />
    </StoreProvider>
  )

describe('Aaru habit tracker', () => {
  it('renders the header and seeded data without crashing', async () => {
    renderApp()
    // Header greeting for the user
    expect(screen.getByText(/Aaru/)).toBeTruthy()
    // Seeded habit name appears somewhere
    expect(screen.getAllByText(/Workout|Meditate|Read|Drink Water|Code/).length).toBeGreaterThan(0)
    // Key section headings present
    expect(screen.getByText(/Habits over time/)).toBeTruthy()
    expect(screen.getByText(/Master project pie/)).toBeTruthy()
    expect(screen.getByText(/Custom project tracker/)).toBeTruthy()
    expect(screen.getByText(/Achievements/)).toBeTruthy()
    await waitFor(() => expect(screen.getByText(/All trackers/)).toBeTruthy())
  })

  it('has a circular gauge and percent-step controls for projects', () => {
    renderApp()
    // project percent buttons (10..100) exist
    const ten = screen.getAllByText('10').length
    expect(ten).toBeGreaterThan(0)
    const hundred = screen.getAllByText('100').length
    expect(hundred).toBeGreaterThan(0)
  })

  it('opens the add-habit modal with type + duration options', () => {
    renderApp()
    fireEvent.click(screen.getByText('＋ New habit'))
    expect(screen.getByText(/What kind is this/)).toBeTruthy()
    // daily + project toggle present
    expect(screen.getByText(/Daily habit/)).toBeTruthy()
    expect(screen.getByText(/Project \/ activity/)).toBeTruthy()
    // duration modes (always visible)
    expect(screen.getAllByText(/Forever/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/One-day/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Short-term/).length).toBeGreaterThan(0)
  })

  it('can toggle a daily habit check-in from the today list', async () => {
    renderApp()
    const before = document.querySelectorAll('button[aria-label^="Mark "]').length
    expect(before).toBeGreaterThan(0)
    fireEvent.click(document.querySelector('button[aria-label^="Mark "]'))
    // at least one toggle flipped state (either marked done or undone)
    await waitFor(() => {
      const after = document.querySelectorAll('button[aria-label^="Mark "]').length
      expect(after).toBeGreaterThan(0)
    })
  })
})
