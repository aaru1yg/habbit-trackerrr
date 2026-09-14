/* Step 4A — Theme contrast smoke: HabitObject renders under both Midnight and Daylight. */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { StoreProvider } from '../src/store.jsx'
import HabitObject from '../src/components/habits/HabitObject.jsx'
import { A_light } from './datasets.js'

const H = A_light().habits[0]

function mountWithTheme(theme) {
  return render(
    <StoreProvider initialState={{ ...A_light(), profile: { ...A_light().profile, theme } }}>
      <div data-theme={theme}>
        <HabitObject
          habit={H}
          done={false}
          streak={12}
          schedule="Daily"
          scheduledToday
          onToggleComplete={() => {}}
          onMore={() => {}}
        />
        <HabitObject
          habit={{ ...H, id: 'h2', name: 'Stretch', category: 'fitness' }}
          done
          streak={4}
          schedule="Weekdays"
          scheduledToday
          onToggleComplete={() => {}}
          onMore={() => {}}
        />
      </div>
    </StoreProvider>,
  )
}

describe('HabitObject renders in both themes', () => {
  beforeEach(cleanup)
  afterEach(cleanup)

  it('midnight: object + ring + meta + actions render', () => {
    const { container } = mountWithTheme('midnight')
    expect(container.querySelector('[data-theme="midnight"]')).toBeTruthy()
    expect(container.querySelectorAll('.habit-obj').length).toBe(2)
    expect(container.querySelector('.habit-obj__ring-fill')).toBeTruthy()
    expect(container.querySelector('.habit-obj__streak')).toBeTruthy()
    expect(container.querySelector('.habit-obj__complete')).toBeTruthy()
  })

  it('daylight: object + ring + meta + actions render', () => {
    const { container } = mountWithTheme('daylight')
    expect(container.querySelector('[data-theme="daylight"]')).toBeTruthy()
    expect(container.querySelectorAll('.habit-obj').length).toBe(2)
  })
})
