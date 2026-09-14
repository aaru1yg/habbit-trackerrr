/* Step 4G-2D: Calendar + Week state-language consistency.
   Verifies done/missed/today/upcoming/off markers share one semantic
   vocabulary across Calendar and Week by reading the shipped CSS and the
   JSX presentational helpers. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const calCss = readFileSync('src/styles/habit-calendar.css', 'utf8')
const wkCss = readFileSync('src/styles/habit-week.css', 'utf8')
const calJsx = readFileSync('src/screens/CalendarScreen.jsx', 'utf8')
const wkJsx = readFileSync('src/screens/WeekScreen.jsx', 'utf8')

describe('Step 4G-2D: Calendar state markers use semantic palette', () => {
  it('done mark is filled var(--good) (semantic success), no box-shadow halo', () => {
    expect(calCss).toMatch(/\.hc-mark\.done\s*\{[\s\S]*?background:\s*var\(--good\)/)
    // no legacy halo rule
    expect(calCss).not.toMatch(/\.hc-mark\.done\s*\{[\s\S]*?box-shadow/)
  })
  it('missed mark uses var(--bad) with ::before/::after cross shape', () => {
    expect(calCss).toMatch(/\.hc-mark\.missed\s*\{[\s\S]*?color:\s*var\(--bad\)/)
    expect(calCss).toMatch(/\.hc-mark\.missed::before/)
    expect(calCss).toMatch(/\.hc-mark\.missed::after/)
  })
  it('today mark is a hollow ring (no inner fill dot that reads as completed)', () => {
    expect(calCss).toMatch(/\.hc-mark\.today\s*\{[\s\S]*?border:\s*1\.5px solid currentColor[\s\S]*?background:\s*transparent/)
    expect(calCss).not.toMatch(/\.hc-mark\.today::after\s*\{[\s\S]*?background:\s*currentColor/)
  })
  it('scheduled/upcoming is a hollow ring with reduced opacity', () => {
    expect(calCss).toMatch(/\.hc-mark\.scheduled\s*\{[\s\S]*?border:\s*1\.5px solid currentColor[\s\S]*?background:\s*transparent[\s\S]*?opacity:\s*\.45/)
  })
  it('unscheduled renders no mark (DayMark returns null) — no .hc-mark.unscheduled rule', () => {
    expect(calCss).not.toMatch(/\.hc-mark\.unscheduled/)
    expect(calJsx).toMatch(/state === 'unscheduled'\) return null/)
  })
  it('selected-day state badge maps done/missed/today/scheduled/unscheduled classes', () => {
    expect(calCss).toMatch(/data-state="done"/)
    expect(calCss).toMatch(/data-state="missed"/)
    expect(calCss).toMatch(/data-state="today"/)
    expect(calCss).toMatch(/data-state="scheduled"/)
    expect(calCss).toMatch(/data-state="unscheduled"/)
    expect(calJsx).toMatch(/done: 'Completed'/)
    expect(calJsx).toMatch(/missed: 'Missed'/)
    expect(calJsx).toMatch(/today: 'Scheduled today'/)
    expect(calJsx).toMatch(/scheduled: 'Upcoming'/)
    expect(calJsx).toMatch(/unscheduled: 'Not scheduled'/)
  })
})

describe('Step 4G-2D: Week state markers match Calendar semantics', () => {
  it('done mark is filled var(--good)', () => {
    expect(wkCss).toMatch(/\.wr-mark\.done\{[\s\S]*?background:var\(--good\)/)
  })
  it('missed mark uses var(--bad) with ::before/::after cross', () => {
    expect(wkCss).toMatch(/\.wr-mark\.missed\{[\s\S]*?color:var\(--bad\)/)
    expect(wkCss).toMatch(/\.wr-mark\.missed:before/)
    expect(wkCss).toMatch(/\.wr-mark\.missed:after/)
  })
  it('today mark is a hollow ring (no completed fill dot)', () => {
    expect(wkCss).toMatch(/\.wr-mark\.today\{[\s\S]*?border:1\.5px solid currentColor[\s\S]*?background:transparent/)
    expect(wkCss).not.toMatch(/\.wr-mark\.today:after\{[\s\S]*?background:currentColor/)
  })
  it('upcoming is a smaller hollow ring at reduced opacity', () => {
    expect(wkCss).toMatch(/\.wr-mark\.upcoming\{[\s\S]*?border:1\.5px solid currentColor[\s\S]*?background:transparent[\s\S]*?opacity:\.45/)
  })
  it('off (not scheduled) is a tiny muted dot, NOT the red ×', () => {
    // Match the first .wr-mark.off{...} base rule
    const m = wkCss.match(/\.wr-mark\.off\{[^}]*\}/)
    expect(m).toBeTruthy()
    expect(m[0]).toMatch(/background:var\(--border-2\)/)
    expect(m[0]).toMatch(/opacity:\.5/)
    expect(m[0]).not.toMatch(/color:var\(--bad\)/)
  })
})

describe('Step 4G-2D: Habit color reserved for identity', () => {
  it('JSX helpers skip inline habit color for done/missed so --good/--bad win', () => {
    expect(calJsx).toMatch(/const semantic = state === 'done' \|\| state === 'missed'/)
    expect(calJsx).toMatch(/!semantic && color/)
    expect(wkJsx).toMatch(/const semantic = state === 'done' \|\| state === 'missed'/)
    expect(wkJsx).toMatch(/!semantic && color/)
  })
  it('today/scheduled still receive habit color for identity outline', () => {
    // No `if (state === 'today' || state === 'scheduled')` early return — color is passed when !semantic
    expect(calJsx).not.toMatch(/state === 'scheduled'\) return null/)
    expect(wkJsx).not.toMatch(/state === 'today'[\s\S]*color/)
  })
})

describe('Step 4G-2D: Reduced motion + focus preserved', () => {
  it('calendar and week cells retain focus-visible rules', () => {
    expect(calCss).toMatch(/\.hc-day__btn:focus-visible/)
    expect(calCss).toMatch(/\.hc-cell:focus-visible/)
    expect(wkCss).toMatch(/\.wr-nav .icon-btn:focus-visible/)
  })
})
