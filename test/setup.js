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
