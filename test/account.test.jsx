/* ============================================================
   ACCOUNT UI — the two builds, and the promises each one makes.

   The app ships in two honest configurations: with cloud config
   and without. The rule is that it must never describe a
   capability it does not have, in either direction, so both are
   rendered here and checked against what they claim.
   ============================================================ */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/* Mutable so each suite can choose a build before importing the app. */
const cfg = { cloudConfigured: false, googleEnabled: false }

vi.mock('../src/cloud/config.js', () => ({
  get cloudConfigured() { return cfg.cloudConfigured },
  get googleEnabled() { return cfg.googleEnabled },
  SUPABASE_URL: 'https://example-project.supabase.co',
  SUPABASE_KEY: 'publishable-test-key',
  redirectTo: () => 'http://localhost/',
}))

/* No network, ever, from a unit test. */
vi.mock('../src/cloud/client.js', () => ({
  getSupabase: async () => null,
  __setSupabaseForTests: () => {},
}))

const { default: App } = await import('../src/App.jsx')
const { StoreProvider } = await import('../src/core/store.jsx')
const { RouterProvider } = await import('../src/app/router.jsx')
const { ToastHost } = await import('../src/ui/index.jsx')
const { default: AuthProvider } = await import('../src/cloud/AuthProvider.jsx')
const { default: SyncProvider } = await import('../src/cloud/SyncProvider.jsx')
const { emptyState, STORAGE_KEY } = await import('../src/core/schema.js')

function mount(route = 'account', state = null) {
  window.location.hash = `#/${route}`
  if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  return render(
    <StoreProvider>
      <AuthProvider>
        <SyncProvider>
          <RouterProvider>
            <ToastHost><App /></ToastHost>
          </RouterProvider>
        </SyncProvider>
      </AuthProvider>
    </StoreProvider>
  )
}

beforeEach(() => {
  localStorage.clear()
  window.location.hash = ''
})
afterEach(() => { cfg.cloudConfigured = false; cfg.googleEnabled = false })

describe('a build with no cloud credentials', () => {
  beforeEach(() => { cfg.cloudConfigured = false })

  it('offers no sign-in, and says why rather than failing silently', async () => {
    mount('account')
    expect(await screen.findByText(/not available in this build/i)).toBeTruthy()
    expect(screen.queryByLabelText(/^Email$/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /^Sign in$/i })).toBeNull()
  })

  it('shows no sync indicator, because there is nothing to report', () => {
    const { container } = mount('today')
    expect(container.querySelector('.syncbadge')).toBeNull()
  })

  it('still claims, truthfully, that data stays in the browser', () => {
    const { container } = mount('today')
    expect(container.querySelector('.foot__legal').textContent)
      .toMatch(/stays in this browser/i)
  })

  it('keeps the privacy policy free of account promises it cannot keep', async () => {
    mount('privacy')
    expect(await screen.findByText(/this particular build has no account system/i)).toBeTruthy()
    expect(screen.getByText(/no account system, so there is no account/i)).toBeTruthy()
  })
})

describe('a build with cloud credentials', () => {
  beforeEach(() => { cfg.cloudConfigured = true })

  it('offers a real sign-in form', async () => {
    mount('account')
    expect(await screen.findByLabelText(/^Email$/i)).toBeTruthy()
    expect(screen.getByLabelText(/^Password$/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Sign in$/i })).toBeTruthy()
  })

  it('reports "This device only" until an account actually exists', async () => {
    const { container } = mount('today')
    await waitFor(() => expect(container.querySelector('.syncbadge')).toBeTruthy())
    expect(container.querySelector('.syncbadge').textContent).toMatch(/This device only/i)
  })

  it('hides Google sign-in unless the deployment enabled the provider', async () => {
    mount('account')
    await screen.findByLabelText(/^Email$/i)
    expect(screen.queryByRole('button', { name: /google/i })).toBeNull()
  })

  it('shows Google sign-in when the deployment did enable it', async () => {
    cfg.googleEnabled = true
    mount('account')
    await screen.findByLabelText(/^Email$/i)
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeTruthy()
  })

  it('lets you switch to creating an account, and asks for a password length', async () => {
    const user = userEvent.setup()
    mount('account')
    await user.click(await screen.findByRole('button', { name: /create an account/i }))
    expect(screen.getByRole('button', { name: /^Create account$/i })).toBeTruthy()
    expect(screen.getByText(/at least 8 characters/i)).toBeTruthy()
  })

  it('offers password recovery without revealing whether an address exists', async () => {
    const user = userEvent.setup()
    mount('account')
    await user.click(await screen.findByRole('button', { name: /forgot your password/i }))
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeTruthy()
    // The password field is gone: a reset needs only the address.
    expect(screen.queryByLabelText(/^Password$/i)).toBeNull()
  })

  it('tells a signed-out visitor what signing in would change, and what it would not', async () => {
    mount('account')
    await screen.findByLabelText(/^Email$/i)
    expect(screen.getByText(/nothing changes if you do not/i)).toBeTruthy()
  })

  it('describes the account in the privacy policy, including the host', async () => {
    mount('privacy')
    expect(await screen.findByRole('heading', { name: /what is stored in your account/i })).toBeTruthy()
    expect(screen.getByText('example-project.supabase.co')).toBeTruthy()
    expect(screen.queryByText(/this particular build has no account system/i)).toBeNull()
  })

  it('adds an accounts section to the terms', async () => {
    mount('terms')
    expect(await screen.findByRole('heading', { name: /^Accounts$/i })).toBeTruthy()
  })

  it('links to the account page from settings without duplicating it', async () => {
    const { container } = mount('settings', { ...emptyState(), profile: { ...emptyState().profile, onboarded: true } })
    await waitFor(() => expect(container.querySelector('.acctrow')).toBeTruthy())
    expect(container.querySelector('.acctrow').getAttribute('href')).toBe('#/account')
    expect(container.querySelector('.acctrow').textContent).toMatch(/sign in to sync/i)
  })
})
