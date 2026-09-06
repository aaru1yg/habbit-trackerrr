/* Achievements 2.0 — the unlock moment fires once, and only for new trophies. */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { StoreProvider } from '../src/store.jsx'
import App from '../src/App.jsx'

const renderApp = () => render(<StoreProvider><App /></StoreProvider>)

async function onboardOneHabit() {
  const utils = renderApp()
  await screen.findByText(/What should we call you/i)
  fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'Tester' } })
  fireEvent.click(screen.getByRole('button', { name: /^Continue$/i }))
  await screen.findByText(/Pick a few to start/i)
  fireEvent.click(screen.getByRole('button', { name: /Move for 20 minutes/i }))
  fireEvent.click(screen.getByRole('button', { name: /^Continue$/i }))
  await screen.findByText(/A daily nudge/i)
  fireEvent.click(screen.getByRole('button', { name: /Maybe later/i }))
  await waitFor(() => expect(screen.queryByLabelText('Welcome')).toBeNull())
  return utils
}

beforeEach(() => {
  window.localStorage.clear()
  window.location.hash = ''
})

const toastText = () => [...document.querySelectorAll('.toast-region')].map((n) => n.textContent).join('')

describe('UnlockWatcher', () => {
  it('celebrates an achievement the moment the data earns it', async () => {
    const utils = await onboardOneHabit()
    // no trophy toast before anything is logged
    expect(toastText()).not.toMatch(/Trophy earned/)

    fireEvent.click(screen.getByRole('button', { name: /Mark .* complete/i }))

    await waitFor(() => expect(toastText()).toMatch(/troph(y|ies) earned: First step/), { timeout: 4000 })
    utils.unmount()
  }, 15000)

  it('never re-announces trophies that were already earned at load', async () => {
    const first = await onboardOneHabit()
    fireEvent.click(screen.getByRole('button', { name: /Mark .* complete/i }))
    await waitFor(() => expect(toastText()).toMatch(/troph(y|ies) earned: First step/), { timeout: 4000 })
    const saved = localStorage.getItem('aaru.habits.v4')
    expect(saved).toBeTruthy()
    first.unmount()

    // second session boots with the trophy already earned: silence
    localStorage.setItem('aaru.habits.v4', saved)
    render(<StoreProvider><App /></StoreProvider>)
    await waitFor(() => expect(document.querySelectorAll('.toast-region').length).toBeGreaterThan(0))
    await new Promise((r) => setTimeout(r, 300))
    expect(toastText()).not.toMatch(/Trophy earned/)
  }, 15000)
})
