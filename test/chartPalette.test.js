import { describe, it, expect } from 'vitest'
import {
  SERIES_COUNT, SERIES_HEX, seriesStyle, assignSeriesColors, hexToHue,
} from '../src/lib/chartPalette.js'

describe('chart palette', () => {
  it('defines 8 deterministic series styles', () => {
    expect(SERIES_COUNT).toBe(8)
    expect(SERIES_HEX).toHaveLength(8)
    expect(seriesStyle(0)).toEqual({ color: 'var(--series-1)', dash: null, shape: 'circle' })
    expect(seriesStyle(1).dash).toBeTruthy()
    expect(seriesStyle(1).shape).toBe('square')
    // cycles deterministically
    expect(seriesStyle(8)).toEqual(seriesStyle(0))
  })

  it('reads hue honestly', () => {
    expect(hexToHue('#ff0000')).toBeCloseTo(0, 0)
    expect(hexToHue('#00ff00')).toBeCloseTo(120, 0)
    expect(hexToHue('#0000ff')).toBeCloseTo(240, 0)
    expect(hexToHue('#808080')).toBeNull() // achromatic
    expect(hexToHue('bogus')).toBeNull()
  })

  it('keeps distant customs, replaces near-duplicates', () => {
    const out = assignSeriesColors(['#ff0000', '#ff2200', null])
    expect(out).toHaveLength(3)
    expect(out[0].color).toBe('#ff0000') // first custom kept
    expect(out[1].color).toMatch(/^var\(--series-/) // near-dup replaced
    expect(out[2].color).toMatch(/^var\(--series-/)
    // every series still gets dash + shape identity
    for (const s of out) {
      expect(s).toHaveProperty('dash')
      expect(s).toHaveProperty('shape')
    }
  })

  it('is deterministic and length-exact', () => {
    const wants = ['#8b6bff', null, '#22d3ee', null, null, null]
    expect(assignSeriesColors(wants)).toEqual(assignSeriesColors(wants))
    expect(assignSeriesColors(wants)).toHaveLength(6)
    expect(assignSeriesColors([])).toEqual([])
  })

  it('never hands two series the same palette slot (up to 8)', () => {
    const out = assignSeriesColors([null, null, null, null, null, null])
    const colors = out.map((s) => s.color)
    expect(new Set(colors).size).toBe(6)
  })
})
