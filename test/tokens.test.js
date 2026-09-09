import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { contrastRatio } from '../src/lib/accent.js'

const css = fs.readFileSync('src/styles/tokens.css', 'utf8')

/** Extract the declaration block for html[data-theme='id'] (midnight shares :root). */
function themeBlock(id) {
  const m = css.match(new RegExp(`html\\[data-theme='${id}'\\]\\s*{([\\s\\S]*?)}`, ''))
  if (!m) throw new Error(`theme block missing: ${id}`)
  return m[1]
}

function varValue(block, name) {
  const m = block.match(new RegExp(`${name}:\\s*([^;]+);`))
  return m ? m[1].trim() : null
}

const THEMES = ['midnight', 'aurora', 'ember', 'verdant', 'daylight']
const CONTRACT = [
  '--bg', '--surface', '--surface-2', '--surface-3',
  '--text', '--text-2', '--text-3', '--border',
  '--accent-1', '--accent-2', '--accent-soft', '--accent-1-lift', '--accent-ink', '--focus',
  '--good', '--good-soft', '--warn', '--warn-soft', '--bad', '--bad-soft', '--info', '--info-soft',
  '--track', '--scrim',
  '--e-1', '--e-2', '--e-3', '--e-card',
  '--c1', '--c2', '--c3', '--c4', '--c5', '--c6', '--c7', '--c8',
  '--seq-0', '--seq-1', '--seq-2', '--seq-3', '--seq-4', '--grid',
]

describe('design tokens', () => {
  it('defines the primitive layer once at :root', () => {
    for (const v of ['--font-body', '--font-display', '--fs-body', '--space-1', '--space-2',
      '--r-md', '--dur-1', '--ease-out', '--touch', '--content-max']) {
      expect(css.includes(`${v}:`), `missing primitive ${v}`).toBe(true)
    }
  })

  it('every theme fulfills the full token contract', () => {
    for (const id of THEMES) {
      const block = themeBlock(id)
      for (const v of CONTRACT) {
        expect(varValue(block, v), `${id} missing ${v}`).toBeTruthy()
      }
    }
  })

  it('defines the V5 slots: entity accents, series, glow, z, rings, skeleton', () => {
    for (const v of ['--ea-base', '--ea-soft', '--ea-muted', '--ea-strong', '--ea-ink',
      '--series-1', '--series-8', '--glow-1', '--glow-soft',
      '--z-nav', '--z-fab', '--z-sheet', '--z-toast', '--z-boot',
      '--ring-sm', '--ring-md', '--ring-hero',
      '--skel-from', '--skel-to', '--focus-ring',
      '--btn-h-md', '--field-h', '--card-pad']) {
      expect(css.includes(`${v}:`), `missing V5 slot ${v}`).toBe(true)
    }
  })

  it('body text contrast passes 7:1 in every theme', () => {
    for (const id of THEMES) {
      const b = themeBlock(id)
      const ratio = contrastRatio(varValue(b, '--text'), varValue(b, '--bg'))
      expect(ratio, `${id} text/bg`).toBeGreaterThanOrEqual(7)
    }
  })

  it('secondary text passes 4.5:1 in every theme', () => {
    for (const id of THEMES) {
      const b = themeBlock(id)
      const ratio = contrastRatio(varValue(b, '--text-2'), varValue(b, '--bg'))
      expect(ratio, `${id} text-2/bg`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('accent text on surfaces passes 4.5:1 in every theme', () => {
    for (const id of THEMES) {
      const b = themeBlock(id)
      const ratio = contrastRatio(varValue(b, '--accent-1-lift'), varValue(b, '--surface'))
      expect(ratio, `${id} accent-lift/surface`).toBeGreaterThanOrEqual(4.5)
    }
  })
})
