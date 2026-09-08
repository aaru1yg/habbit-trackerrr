import { describe, expect, it } from 'vitest'
import { canonicalParent, legacyRoute } from '../src/lib/router.jsx'

describe('Phase 1 information architecture routes', () => {
  it('uses the five canonical parent destinations', () => {
    expect(['today', 'work', 'habits', 'goals', 'insights'].map(canonicalParent)).toEqual([
      'today', 'work', 'habits', 'goals', 'insights',
    ])
  })

  it('groups legacy destinations under their canonical parent without deleting them', () => {
    expect(canonicalParent('projects')).toBe('work')
    expect(canonicalParent('assignments')).toBe('work')
    expect(canonicalParent('timeline')).toBe('work')
    expect(canonicalParent('library')).toBe('habits')
    expect(canonicalParent('week')).toBe('habits')
    expect(canonicalParent('mind')).toBe('insights')
    expect(canonicalParent('record')).toBe('insights')
    expect(canonicalParent('achievements')).toBe('insights')
  })

  it('documents safe legacy destinations', () => {
    expect(legacyRoute('library')).toBe('habits')
    expect(legacyRoute('timeline')).toBe('work?view=deadlines')
    expect(legacyRoute('week')).toBe('habits?view=week')
    expect(legacyRoute('mind')).toBe('insights?view=mind')
    expect(legacyRoute('record')).toBe('insights?view=record')
    expect(legacyRoute('achievements')).toBe('insights?view=achievements')
    expect(legacyRoute('today')).toBeNull()
  })
})
