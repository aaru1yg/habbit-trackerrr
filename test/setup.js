import { configure } from '@testing-library/react'

/* Every screen, plus the command palette, the Analytics Lab and the execution
   panels, is React.lazy — so each findBy* is really waiting on a dynamic
   import, not on a render. testing-library's 1000ms default is comfortable on
   a dev machine and flaky on the contended 2-core CI runner, where it showed
   up as "Unable to find a label with the text of: What do you need to do?"
   with the palette simply not loaded yet. Successful finds still resolve
   immediately, so this only buys time for the cases that need it. */
configure({ asyncUtilTimeout: 10000 })

// jsdom lacks these; stub them so framer-motion + the SVG chart kit can mount.
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.IntersectionObserver = class {
  constructor(cb) { this.cb = cb }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return [] }
  root = null
  rootMargin = ''
  thresholds = []
}

if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

if (!window.HTMLElement.prototype.getBoundingClientRect) {
  window.HTMLElement.prototype.getBoundingClientRect = () => ({
    width: 800, height: 400, top: 0, left: 0, bottom: 400, right: 800,
    x: 0, y: 0, toJSON: () => {},
  })
}

if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = (cb) => setTimeout(cb, 0)
  window.cancelAnimationFrame = (id) => clearTimeout(id)
}

if (!window.scrollTo) window.scrollTo = () => {}
if (!window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = () => {}
}

if (!window.localStorage) {
  const store = {}
  window.localStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
    clear: () => { for (const k in store) delete store[k] },
  }
}
