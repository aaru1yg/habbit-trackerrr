import { describe, it, expect } from 'vitest'
import {
  ACCENT_PRESETS, isHex, hexToRgb, relLuminance, contrastRatio,
  inkFor, deriveAccent, accentVars,
} from '../src/lib/accent.js'

describe('accent system', () => {
  it('parses hex strictly', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 })
    expect(hexToRgb('#f00')).toEqual({ r: 255, g: 0, b: 0 })
    expect(hexToRgb('red')).toBeNull()
    expect(hexToRgb('#12345')).toBeNull()
    expect(hexToRgb(null)).toBeNull()
    expect(isHex('#ABCDEF')).toBe(true)
    expect(isHex('  #abc  ')).toBe(true)
  })

  it('computes WCAG contrast honestly', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 0)
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 2)
    expect(contrastRatio('nope', '#fff')).toBeNull()
    expect(relLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 3)
    expect(relLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 3)
  })

  it('picks readable ink on the fill', () => {
    expect(inkFor('#000000').ink).toBe('#ffffff')
    expect(inkFor('#ffffff').ink).toBe('#10131a')
    const mid = inkFor('#8b6bff')
    expect(mid.ratio).toBeGreaterThanOrEqual(4.5)
    expect(mid.passes).toBe(true)
  })

  it('every preset passes the 4.5:1 ink floor', () => {
    expect(ACCENT_PRESETS.length).toBeGreaterThanOrEqual(8)
    for (const p of ACCENT_PRESETS) {
      const { passes, ratio } = inkFor(p.base)
      expect(passes, `${p.id} ${p.base} ink ratio ${ratio}`).toBe(true)
    }
  })

  it('derives the token chain from one base', () => {
    const d = deriveAccent('#8b6bff')
    expect(d.base).toBe('#8b6bff')
    expect(d.soft).toContain('color-mix')
    expect(d.muted).toContain('var(--surface)')
    expect(d.strong).toContain('var(--text)')
    expect(d.ink).toMatch(/^#/)
    expect(deriveAccent('bogus')).toBeNull()
    expect(deriveAccent(null)).toBeNull()
  })

  it('accentVars degrades to theme fallback when unset/invalid', () => {
    expect(accentVars(undefined)).toEqual({})
    expect(accentVars('')).toEqual({})
    expect(accentVars('not-a-color')).toEqual({})
    const v = accentVars('#22d3ee')
    expect(v['--ea-base']).toBe('#22d3ee')
    expect(v['--ea-soft']).toContain('color-mix')
    expect(v['--ea-muted']).toContain('color-mix')
    expect(v['--ea-strong']).toContain('color-mix')
    expect(v['--ea-ink']).toMatch(/^#/)
  })
})
