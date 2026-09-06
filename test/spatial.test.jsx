/* V4 spatial foundation — behaviour contracts (docs/V4-AUDIT.md §4). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

import { SpatialStage, DepthLayer, SpatialPanel, DepthCard, SpatialStack, StackSlot } from '../src/components/spatial/Depth.jsx'
import WorldLayer from '../src/components/spatial/WorldLayer.jsx'
import BootSequence from '../src/components/spatial/BootSequence.jsx'
import { CAM, spatialMode, applySpatialMode, scenePresence, cameraEnabled } from '../src/lib/spatial.js'
import { getCapability } from '../src/lib/capability.js'

describe('camera choreography budget (spec §8)', () => {
  it('keeps every camera beat inside 300–900ms', () => {
    expect(CAM.enter).toBeGreaterThanOrEqual(300)
    expect(CAM.enter).toBeLessThanOrEqual(900)
    expect(CAM.focus).toBeLessThanOrEqual(900)
    expect(CAM.travel).toBeLessThanOrEqual(900)
    expect(CAM.enter).toBeLessThan(CAM.focus)
    expect(CAM.focus).toBeLessThanOrEqual(CAM.travel)
  })

  it('never grants the animated camera to low tiers in this environment', () => {
    const cap = getCapability()
    if (cap.tier === 'low') expect(cameraEnabled()).toBe(false)
    else expect(typeof cameraEnabled()).toBe('boolean')
  })
})

describe('SpatialStage / DepthLayer primitives (spec §18)', () => {
  it('renders a perspective stage with the camera inner group', () => {
    render(
      <SpatialStage data-testid="stage" className="x" focus={1500}>
        <p>inside</p>
      </SpatialStage>,
    )
    const stage = screen.getByTestId('stage')
    expect(stage.className).toContain('sp-stage')
    expect(stage.className).toContain('x')
    expect(stage.style.getPropertyValue('--sp-focus')).toBe('1500px')
    expect(stage.querySelector('.sp-cam')).toBeTruthy()
    expect(screen.getByText('inside')).toBeTruthy()
  })

  it('places depth layers on named z planes without touching semantics', () => {
    const { container } = render(
      <DepthLayer as="section" z={3} aria-label="lane">
        <h2>content stays semantic</h2>
      </DepthLayer>,
    )
    const el = container.querySelector('section.sp-depth')
    expect(el.dataset.z).toBe('3')
    expect(el.getAttribute('aria-label')).toBe('lane')
    expect(el.querySelector('h2')).toBeTruthy()
  })

  it('SpatialPanel renders the plain static surface when capability says no tilt', () => {
    // jsdom is a low-tier device: the static path must be complete
    const { container } = render(<SpatialPanel depth={2}><button>ok</button></SpatialPanel>)
    const panel = container.querySelector('[data-sp-panel]')
    expect(panel).toBeTruthy()
    expect(panel.dataset.depth).toBe('2')
    expect(screen.getByText('ok')).toBeTruthy()
    if (getCapability().tier === 'low') expect(panel.className).toContain('sp-panel-static')
  })

  it('DepthCard keeps children reachable and adds no interactive noise', () => {
    render(
      <DepthCard as="article" depth={2} aria-label="card">
        <a href="#/x">open me</a>
      </DepthCard>,
    )
    expect(screen.getByRole('link', { name: 'open me' })).toBeTruthy()
    expect(screen.getByRole('article', { name: 'card' }).className).toContain('sp-card')
  })

  it('SpatialStack assigns a cyclic depth lane per slot', () => {
    const { container } = render(
      <SpatialStack>
        {[0, 1, 2, 3, 4].map((i) => (
          <StackSlot as="li" key={i} index={i}>
            <span>{`item ${i}`}</span>
          </StackSlot>
        ))}
      </SpatialStack>,
    )
    const slots = [...container.querySelectorAll('.sp-slot')]
    expect(slots).toHaveLength(5)
    expect(slots.map((s) => s.dataset.z)).toEqual(['1', '2', '3', '4', '1'])
    expect(screen.getByText('item 4')).toBeTruthy()
  })
})

describe('spatial mode switch', () => {
  it('reports a mode the CSS understands and applies it to <html>', () => {
    const mode = spatialMode()
    expect(['full', 'reduced', 'flat']).toContain(mode)
    const off = applySpatialMode()
    expect(document.documentElement.dataset.spatial).toBe(mode)
    act(() => off())
  })

  it('jsdom resolves to the conservative flat mode', () => {
    // no WebGL in this environment → no camera, by contract
    expect(getCapability().webgl).toBe(false)
    expect(spatialMode()).toBe('flat')
  })
})

describe('scenePresence (WebGL lifecycle, spec §4)', () => {
  it('is live by default and survives a missing IntersectionObserver', () => {
    const host = document.createElement('div')
    const p = scenePresence(host)
    expect(p.live()).toBe(true)
    let seen = null
    const off = p.subscribe((v) => { seen = v })
    expect(seen).toBe(true)
    off()
    p.dispose()
  })

  it('pauses subscribers when the tab hides', () => {
    const host = document.createElement('div')
    const p = scenePresence(host)
    const vals = []
    p.subscribe((v) => vals.push(v))
    const original = document.visibilityState
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => original })
    expect(vals).toEqual([true, false])
    p.dispose()
  })
})

describe('WorldLayer gate', () => {
  it('renders nothing where WebGL is unavailable — the CSS world stands alone', () => {
    const { container } = render(<WorldLayer />)
    if (!getCapability().webgl) expect(container.firstChild).toBeNull()
  })
})

describe('BootSequence (spec §6)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    try {
      sessionStorage.clear()
      localStorage.clear()
    } catch { /* noop */ }
    localStorage.setItem('aaru.boot', 'on') // force playback past the low-tier skip
  })
  afterEach(() => {
    vi.useRealTimers()
    try { localStorage.removeItem('aaru.boot'); sessionStorage.clear() } catch { /* noop */ }
  })

  it('plays once, shows the editorial headline, then removes itself', async () => {
    render(<BootSequence />)
    expect(screen.getByText('SMALL THINGS.')).toBeTruthy()
    expect(screen.getByText('DONE DAILY.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Skip intro' })).toBeTruthy()
    act(() => { vi.advanceTimersByTime(1500) })
    // dissolving
    act(() => { vi.advanceTimersByTime(500) })
    expect(screen.queryByText('SMALL THINGS.')).toBeNull()
  })

  it('any Escape dismisses it early', async () => {
    render(<BootSequence />)
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) })
    act(() => { vi.advanceTimersByTime(500) })
    expect(screen.queryByText('SMALL THINGS.')).toBeNull()
  })

  it('marks the session so a reload cannot replay it', () => {
    render(<BootSequence />)
    expect(sessionStorage.getItem('aaru.boot.v4')).toBe('1')
  })
})
