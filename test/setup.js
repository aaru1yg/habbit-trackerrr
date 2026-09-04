import { vi } from 'vitest'

// jsdom lacks these; stub them so framer-motion + recharts can mount.
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
