/* V3 motion foundation — behaviour contracts. */
import { describe, it, expect, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'

/* jsdom performs no layout: pin the rect so viewport maths is deterministic. */
const rectAt = (top, height = 400) => vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
  .mockReturnValue({ width: 800, height, top, left: 0, bottom: top + height, right: 800, x: 0, y: top, toJSON: () => {} })
import Reveal from '../src/components/motion/Reveal.jsx'
import TiltCard from '../src/components/motion/TiltCard.jsx'
import Parallax from '../src/components/motion/Parallax.jsx'
import Burst from '../src/components/motion/Burst.jsx'
import AnimateOnView from '../src/components/motion/AnimateOnView.jsx'
import ProgressCore from '../src/components/ui/ProgressCore.jsx'
import SceneLayer from '../src/components/three/SceneLayer.jsx'
import { stagger, interactionFeedback, DUR, SPRING } from '../src/lib/motion.js'
import { getCapability, particleBudget, allowsLiveScenes } from '../src/lib/capability.js'

describe('motion tokens', () => {
  it('staggers cap so long lists stay calm', () => {
    expect(stagger(0)).toBe(0)
    expect(stagger(2)).toBeCloseTo(0.1)
    expect(stagger(50)).toBe(0.4)
  })

  it('exposes the named spring/duration language', () => {
    expect(SPRING.press.type).toBe('spring')
    expect(SPRING.pop.stiffness).toBeGreaterThan(SPRING.glide.stiffness)
    expect(DUR.press).toBeLessThan(DUR.hero)
  })
})

describe('interactionFeedback', () => {
  it('announces interactions on a subscribable channel', () => {
    const seen = []
    const on = (e) => seen.push(e.detail)
    window.addEventListener('aaru:feedback', on)
    interactionFeedback('complete', { habitId: 'h1' })
    interactionFeedback('unlock', { id: 'a1' })
    window.removeEventListener('aaru:feedback', on)
    expect(seen).toEqual([
      { kind: 'complete', habitId: 'h1' },
      { kind: 'unlock', id: 'a1' },
    ])
  })
})

describe('capability', () => {
  it('degrades conservatively where WebGL is unavailable', () => {
    const cap = getCapability()
    expect(['high', 'balanced', 'low']).toContain(cap.tier)
    if (!cap.webgl) {
      expect(cap.tier).not.toBe('high')
      expect(allowsLiveScenes()).toBe(false)
    }
  })

  it('never grants particles to a device without budget', () => {
    const cap = getCapability()
    if (cap.tier === 'low') expect(particleBudget()).toBe(0)
    expect([0, 0.4, 1]).toContain(particleBudget())
  })
})

describe('Reveal', () => {
  it('reveals above-the-fold content immediately (no flash)', () => {
    const spy = rectAt(0)
    const { container } = render(<Reveal variant="depth">hello</Reveal>)
    const el = container.firstChild
    expect(el.className).toContain('reveal')
    expect(el.className).toContain('is-in')
    expect(el.textContent).toBe('hello')
    spy.mockRestore()
  })

  it('waits for the observer below the fold', () => {
    const spy = rectAt(6000)
    const { container } = render(<Reveal>below</Reveal>)
    expect(container.firstChild.className).not.toContain('is-in')
    spy.mockRestore()
  })

  it('applies variant and delay', () => {
    const { container } = render(<Reveal variant="rise" delay={120}>x</Reveal>)
    const el = container.firstChild
    expect(el.dataset.reveal).toBe('rise')
    expect(el.style.getPropertyValue('--mo-delay')).toBe('120ms')
  })

  it('uses the stagger index when given one', () => {
    const { container } = render(<Reveal index={3}>x</Reveal>)
    expect(container.firstChild.style.getPropertyValue('--mo-i')).toBe('3')
  })
})

describe('useInViewOnce', () => {
  it('observes offscreen elements and reveals once they intersect', () => {
    const spy = rectAt(6000)
    const observe = vi.fn()
    const disconnect = vi.fn()
    let cb
    vi.stubGlobal('IntersectionObserver', class {
      constructor(fn) { cb = fn; this.observe = observe; this.disconnect = disconnect }
    })
    const { container, unmount } = render(<Reveal>x</Reveal>)
    expect(observe).toHaveBeenCalled()
    expect(container.firstChild.className).not.toContain('is-in')
    // simulate the observer reporting entry
    act(() => { cb([{ isIntersecting: true }], { disconnect }) })
    expect(container.firstChild.className).toContain('is-in')
    unmount()
    expect(disconnect).toHaveBeenCalled()
    vi.unstubAllGlobals()
    spy.mockRestore()
  })

  it('reveals immediately when IntersectionObserver is missing entirely', () => {
    const spy = rectAt(6000)
    vi.stubGlobal('IntersectionObserver', undefined)
    const { container } = render(<Reveal>x</Reveal>)
    expect(container.firstChild.className).toContain('is-in')
    vi.unstubAllGlobals()
    spy.mockRestore()
  })
})

describe('TiltCard', () => {
  it('renders its children and the sheen layer', () => {
    const { container } = render(<TiltCard><span>card</span></TiltCard>)
    expect(container.firstChild.className).toContain('tilt')
    expect(container.querySelector('.tilt-sheen')).toBeTruthy()
    expect(screen.getByText('card')).toBeTruthy()
  })

  it('ignores pointer movement on touch or reduced devices', () => {
    const { container } = render(<TiltCard>x</TiltCard>)
    const el = container.firstChild
    el.dispatchEvent(new window.Event('pointermove', { bubbles: true }))
    expect(el.style.getPropertyValue('--tilt-x') || '0deg').toBe('0deg')
  })
})

describe('Parallax', () => {
  it('renders and pins at rest without scroll support surprises', () => {
    const { container } = render(<Parallax travel={2}>layer</Parallax>)
    const el = container.firstChild
    expect(el.className).toContain('parallax')
    expect(el.dataset.travel).toBe('2')
    expect(el.textContent).toBe('layer')
  })
})

describe('Burst', () => {
  it('renders nothing without a trigger', () => {
    const { container } = render(<Burst fire={0} />)
    expect(container.querySelector('.burst')).toBeNull()
  })

  it('never fires for reduced motion or zero-particle devices', () => {
    const { container } = render(<Burst fire={1} />)
    // jsdom: no WebGL → tier low → particleBudget 0 → no burst
    if (particleBudget() === 0) expect(container.querySelector('.burst')).toBeNull()
  })
})

describe('AnimateOnView', () => {
  it('marks the effect class in view', () => {
    const spy = rectAt(0)
    const { container } = render(<AnimateOnView effect="chart-draw">svg</AnimateOnView>)
    expect(container.firstChild.className).toContain('chart-draw')
    expect(container.firstChild.className).toContain('is-in')
    spy.mockRestore()
  })
})

describe('ProgressCore', () => {
  it('labels itself for assistive tech', () => {
    render(<ProgressCore pct={42} />)
    expect(screen.getByRole('img', { name: '42 percent complete' })).toBeTruthy()
  })

  it('clamps out-of-range values without lying', () => {
    render(<ProgressCore pct={140} label="over" />)
    expect(screen.getByRole('img', { name: 'over' })).toBeTruthy()
  })

  it('reports an honest empty state when there is no data', () => {
    render(<ProgressCore pct={null} />)
    expect(screen.getByRole('img', { name: 'No progress yet' })).toBeTruthy()
  })

  it('lights ticks in proportion to progress', () => {
    const { container } = render(<ProgressCore pct={50} orbit={false} />)
    const lines = container.querySelectorAll('.core-ticks line')
    expect(lines.length).toBe(48)
    const lit = [...lines].filter((l) => l.getAttribute('stroke') === 'var(--accent-2)')
    // ticks light inclusively up to the percentage: i/48 <= 0.5 → 0..24
    expect(lit.length).toBe(25)
  })

  it('scales orbit particles with progress', () => {
    const low = render(<ProgressCore pct={5} />)
    const lowDots = low.container.querySelectorAll('.core-orbit i').length
    low.unmount()
    const high = render(<ProgressCore pct={95} />)
    const highDots = high.container.querySelectorAll('.core-orbit i').length
    expect(highDots).toBeGreaterThan(lowDots)
  })
})

describe('SceneLayer', () => {
  it('renders nothing when the device cannot carry WebGL', () => {
    const { container } = render(<SceneLayer pct={50} theme="midnight" />)
    expect(container.querySelector('canvas')).toBeNull()
    if (!allowsLiveScenes()) expect(container.firstChild).toBeNull()
  })
})
