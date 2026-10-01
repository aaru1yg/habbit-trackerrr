import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

/* jsdom ships none of these. The app is built to degrade without
   them, and the tests should exercise that same path. */
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })
}

globalThis.IntersectionObserver ||= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ||= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

window.scrollTo ||= () => {}
HTMLCanvasElement.prototype.getContext ||= () => null

/* Deterministic ids keep snapshots of reducer output stable. */
let seq = 0
vi.stubGlobal('cryptoSeq', () => ++seq)

/* The build plugin replaces __BUILD_ID__ at bundle time, so under vitest it
   is an undefined global and Settings throws on render. Give it a value here
   rather than guarding the reference in app code. */
globalThis.__BUILD_ID__ = globalThis.__BUILD_ID__ ?? 'test'
