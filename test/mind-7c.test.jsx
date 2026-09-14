/* ============================================================
   STEP 7C — Mind / behavioural insights.

   What this file defends:
   1. the screen renders on both of its routes and keeps its deep links;
   2. the primary visual is real data, one question, multi-series;
   3. the 7A colour defect stays fixed — neutral dimensions wear identity
      colours, semantic tones are reserved for real state;
   4. every engine gate still suppresses an unsupported finding, and the
      copy stays correlational;
   5. nothing outside Mind moved: Overview / Records / Achievements /
      Advanced / other pillars, and the lazy + CSS-budget boundaries.
   ============================================================ */
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { StoreProvider, STORAGE_KEY, emptyState } from '../src/store.jsx'
import App from '../src/App.jsx'
import { todayStr, subDaysStr } from '../src/lib/dates.js'
import { mindSeries, moodCorrelations, habitCorrelations } from '../src/lib/analytics.js'
import { workloadInteraction } from '../src/lib/habitPatterns.js'
import { activeHabits } from '../src/lib/stats.js'

const T = todayStr()
const dayAt = (i) => subDaysStr(T, i)
const isWeekend = (d) => [0, 6].includes(new Date(`${d}T12:00:00`).getDay())

const habit = (id, name, category) => ({
  id, name, category, cadence: 'daily', schedule: { type: 'daily' },
  createdAt: dayAt(89), archived: false, order: 0, reminder: null, notes: '', skips: [], pause: null,
})

/** 60 days where weekday/weekend and high/low mood line up by construction,
 *  so the gates genuinely open — and 12 committed-work days, so the workload
 *  comparison has both sides. */
function richState() {
  const s = emptyState()
  s.profile = { ...s.profile, name: 'Tester', onboarded: true }
  s.habits = [habit('med', 'Meditate', 'mind'), habit('read', 'Read 20 pages', 'learning'), habit('run', 'Run', 'fitness')]
  s.checkins = { med: {}, read: {}, run: {} }
  s.moods = {}
  for (let i = 0; i < 60; i++) {
    const d = dayAt(i)
    const good = !isWeekend(d)
    s.checkins.med[d] = { done: good, at: `${d}T07:20` }
    s.checkins.read[d] = { done: good && i % 3 !== 0, at: `${d}T21:10` }
    s.checkins.run[d] = { done: good && i % 4 === 0, at: `${d}T06:30` }
    s.moods[d] = { score: good ? 5 : 2, energy: good ? 4 : 1, focus: good ? 5 : 2, motivation: good ? 4 : 1 }
  }
  s.assignments = Array.from({ length: 12 }, (_, i) => ({
    id: `a${i}`, name: `Set ${i}`, subject: '', description: '', priority: 'normal',
    assignedDate: dayAt(40), deadline: `${dayAt(i + 1)}T23:59`, progressMode: 'explicit', progress: 0,
    subtasks: [], projectId: null, notes: '', estimateMin: 60, actualMin: null, progressLog: [],
    createdAt: dayAt(40), createdAtDay: dayAt(40), completedAt: null, archived: false, order: 0,
  }))
  return s
}

/** Two logged days, one habit, no work: nothing on this screen may speak. */
function thinState() {
  const s = emptyState()
  s.profile = { ...s.profile, name: 'Tester', onboarded: true }
  s.habits = [habit('med', 'Meditate', 'mind')]
  s.checkins = { med: { [dayAt(1)]: { done: true, at: `${dayAt(1)}T08:00` }, [dayAt(0)]: { done: false } } }
  s.moods = { [dayAt(0)]: { score: 4 }, [dayAt(1)]: { score: 5 }, [dayAt(2)]: { score: 3 } }
  return s
}

async function mountMind(state = richState(), route = 'mind') {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  window.location.hash = `#/${route}`
  const r = render(<StoreProvider><App /></StoreProvider>)
  await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Mind' })).toBeTruthy())
  return r
}

const text = (sel) => document.querySelector(sel)?.textContent || ''
const causalVerbs = /\b(cause[sd]?|because of|led to|makes you|make it easier|drives your|proves|caused by)\b/i

describe('Mind screen (Step 7C)', () => {
  beforeEach(() => { cleanup(); localStorage.clear(); window.location.hash = ''; document.body.innerHTML = '' })

  it('renders on its own route and under the Insights pillar', async () => {
    await mountMind(richState(), 'mind')
    expect(document.querySelector('#mind-screen')).toBeTruthy()
    cleanup(); localStorage.clear(); document.body.innerHTML = ''
    await mountMind(richState(), 'insights?view=mind')
    expect(document.querySelector('#mind-screen')).toBeTruthy()
  })

  it('leads with one primary visual that answers one question', async () => {
    await mountMind()
    const card = document.querySelector('#mind-screen .mind-cocomove').closest('.ins-surface')
    expect(card.querySelector('.ins-chart-head h2').textContent).toBe('Do your capable days turn into doing days?')
    const svg = card.querySelector('svg[role="img"]')
    expect(svg).toBeTruthy()
    expect(svg.getAttribute('aria-label')).toMatch(/^Line chart of mood/)
    expect(svg.getAttribute('aria-label')).toMatch(/average .* of 5/)
    expect(svg.getAttribute('aria-label')).toMatch(/A day with no entry is left blank/)
  })

  it('draws one line per logged dimension, and only the logged ones', async () => {
    await mountMind()
    const paths = [...document.querySelectorAll('#mind-screen .mind-cocomove svg g > path[stroke][fill="none"]')]
    expect(paths).toHaveLength(4)
    cleanup(); localStorage.clear(); document.body.innerHTML = ''
    await mountMind(thinState())
    const thin = [...document.querySelectorAll('#mind-screen .mind-cocomove svg g > path[stroke][fill="none"]')]
    expect(thin).toHaveLength(1) // mood only: energy/focus/drive were never logged
  })

  it('gives neutral dimensions identity colour, never good/warn/bad', async () => {
    await mountMind()
    const strokes = [...document.querySelectorAll('#mind-screen .mind-cocomove svg g > path[stroke][fill="none"]')]
      .map((p) => p.getAttribute('stroke'))
    expect(strokes).toEqual(['var(--cat-mind)', 'var(--accent-2)', 'var(--accent-1)', 'var(--cat-creative)'])
    strokes.forEach((s) => expect(s).not.toMatch(/--(good|warn|bad)/))
    // …and the completion band stays a neutral reference
    expect(text('#mind-screen .mind-legend')).toMatch(/Completion %/)
  })

  it('keys every series with a name and a number, so colour is not load-bearing', async () => {
    await mountMind()
    const legend = text('#mind-screen .mind-legend')
    for (const label of ['Mood', 'Energy', 'Focus', 'Drive', 'Window mean']) expect(legend).toContain(label)
    expect(legend).toMatch(/avg \d\.\d/)
    // shape markers: four different geometries carry the same identity as colour
    const shapes = [...document.querySelectorAll('#mind-screen .mind-legend svg[aria-hidden="true"]')]
    expect(shapes.length).toBeGreaterThanOrEqual(4)
    expect(document.querySelectorAll('#mind-screen .mind-legend rect').length).toBeGreaterThan(0)
    expect(document.querySelectorAll('#mind-screen .mind-legend circle').length).toBeGreaterThan(0)
  })

  it('uses semantic tone only on the tile values, where a real delta exists', async () => {
    await mountMind()
    const tiles = [...document.querySelectorAll('#mind-screen .ins-signal')]
    expect(tiles).toHaveLength(4)
    tiles.forEach((t) => {
      expect(t.getAttribute('style')).toMatch(/--dim-c: var\(--(cat-mind|accent-1|accent-2|cat-creative)\)/)
      expect(t.getAttribute('data-tone')).toMatch(/^(good|warn|neutral)$/)
    })
  })

  it('reports the evidence window on each reading', async () => {
    await mountMind()
    const body = text('#mind-screen')
    expect(body).toMatch(/over 30 days/)
    expect(body).toMatch(/last 30 days/i)
    expect(body).toMatch(/\d+ of 30 days logged/)
  })

  it('keeps every engine gate: nothing is claimed on two logged days', async () => {
    await mountMind(thinState())
    const body = text('#mind-screen')
    expect(body).toMatch(/needs at least four days at 4–5/i)
    expect(body).toMatch(/No habit pair clears the bar yet/)
    expect(body).toMatch(/Needs at least five days carrying committed work/)
    // the claim rows themselves are absent — not zeroed, not estimated
    const card = [...document.querySelectorAll('#mind-screen .ins-surface')]
      .find((c) => /What moves together/.test(c.textContent))
    expect(card.querySelectorAll('.corr-row')).toHaveLength(0)
    expect(card.textContent).not.toMatch(/points\b.*across/i)
    expect(body).not.toMatch(/r = -?0\.\d+ \(/)
  })

  it('shows capacity, co-occurrence and workload readings when the gates open', async () => {
    await mountMind()
    const groups = text('#mind-screen')
    expect(groups).toMatch(/Mood days vs flat days/)
    expect(groups).toMatch(/r = -?\d\.\d\d/)
    expect(groups).toMatch(/Meditate.*Read 20 pages/s)
    expect(groups).toMatch(/heaviest-workload days/)
    // workload wording is comparative, never causal
    const load = [...document.querySelectorAll('#mind-screen .corr-row')].find((r) => /workload/i.test(r.textContent))
    expect(load.textContent).not.toMatch(causalVerbs)
  })

  it('explains why the note field is locked before a mood exists', async () => {
    const fresh = richState()
    delete fresh.moods[T]
    await mountMind(fresh)
    expect(text('#mind-screen')).toMatch(/Pick a mood to unlock the note field/)
  })

  it('keeps the correlation disclaimer in the reading itself', async () => {
    await mountMind()
    expect(text('#mind-screen')).toMatch(/[Aa]ssociation, not causation/)
    expect(text('#mind-screen')).toMatch(/co-occurrence, not cause/)
  })

  it('never states a cause, only what co-moved', async () => {
    await mountMind()
    const offenders = text('#mind-screen').split(/(?<=[.!?])\s+/)
      .filter((sent) => causalVerbs.test(sent) && !/\bnot\b/i.test(sent))
    expect(offenders).toEqual([])
  })

  it('switching the window re-scopes the analysis, not just the label', async () => {
    await mountMind()
    const group = screen.getByRole('group', { name: 'Analysis window' })
    const buttons = within(group).getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(['30D', '60D', '90D'])
    expect(buttons.filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1)
    fireEvent.click(buttons[2])
    await waitFor(() => expect(text('#mind-screen')).toMatch(/over 90 days/))
    expect(text('#mind-screen')).toMatch(/last 90 days/i)
  })

  it('reflows instead of shrinking on narrow screens', async () => {
    const real = window.matchMedia
    window.matchMedia = (q) => ({
      matches: /max-width: 640px/.test(q), media: q, onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {},
      dispatchEvent: () => false,
    })
    try {
      await mountMind()
      const svg = document.querySelector('#mind-screen .mind-cocomove svg')
      expect(svg.getAttribute('viewBox')).toBe('0 0 360 292')
      expect(svg.getAttribute('aria-label')).toMatch(/Line chart of/)
      // the wide-only annotation is dropped rather than squeezed
      expect(svg.textContent).not.toMatch(/mood avg/)
    } finally {
      window.matchMedia = real
    }
  })

  it('keeps the write surfaces working, because they are the evidence source', async () => {
    const fresh = richState()
    delete fresh.moods[T] // today has no entry yet, exactly as on a fresh morning
    await mountMind(fresh)
    expect(screen.queryByText('A line about today')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Great/ }))
    expect(await screen.findByText('A line about today')).toBeTruthy()
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(saved.moods[T].score).toBe(5)
    fireEvent.click(screen.getByRole('button', { name: 'Energy 4 of 5' }))
    await waitFor(() => expect(JSON.parse(localStorage.getItem(STORAGE_KEY)).moods[T].energy).toBe(4))
    fireEvent.click(screen.getByRole('button', { name: 'Write today' }))
    expect(screen.getByLabelText('What went well?')).toBeTruthy()
  })

  it('leaves the Insights Overview exactly as 7B built it', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(richState()))
    window.location.hash = '#/insights'
    render(<StoreProvider><App /></StoreProvider>)
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Insights' })).toBeTruthy())
    expect(screen.getByText('What changed')).toBeTruthy()
    expect(document.querySelectorAll('#insights-screen .ins-signal')).toHaveLength(4)
    expect(document.querySelector('#insights-screen .ins-svg-wrap svg')).toBeTruthy()
    expect(text('#insights-screen')).not.toMatch(/Do your capable days/)
    // and its pillar nav still reaches Mind
    fireEvent.click(screen.getByText('Mind', { selector: '.ins-pillar-label' }))
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Mind' })).toBeTruthy())
  })

  it('does not pull advanced analytics into Mind, and keeps the Lab lazy', async () => {
    await mountMind()
    expect(document.querySelector('#mind-screen')).toBeTruthy()
    expect(screen.queryByText(/advanced analytics/i)).toBeNull()
    const insights = readFileSync('src/screens/InsightsScreen.jsx', 'utf8')
    expect(insights).toMatch(/const AnalyticsLab = lazy\(\(\) => import\('\.\/AnalyticsLab\.jsx'\)\)/)
    const app = readFileSync('src/App.jsx', 'utf8')
    expect(app).toMatch(/const MindScreen = lazy\(\(\) => import\('\.\/screens\/MindScreen\.jsx'\)\)/)
  })

  it('keeps Mind styling lazy and the initial CSS ceiling untouched', () => {
    const index = readFileSync('src/index.css', 'utf8')
    expect(index).not.toMatch(/mind\.css/)
    expect(index).not.toMatch(/insights\.css/)
    // Mind-only rules must no longer be paid for by every screen…
    for (const f of ['work.css', 'system.css']) {
      const css = readFileSync(`src/styles/${f}`, 'utf8')
      for (const cls of ['mood-row', 'level-row', 'level-btn', 'dim-label', 'mood-strip']) {
        expect(css, `${f} still styles .${cls}`).not.toMatch(new RegExp(`(^|\\})\\s*\\.${cls}\\b`))
      }
    }
    // …and must actually exist where they are used
    const mind = readFileSync('src/styles/mind.css', 'utf8')
    for (const cls of ['mood-row', 'level-btn', 'mind-checkin__grid', 'mind-wd__row']) expect(mind).toContain(`.${cls}`)
    expect(readFileSync('src/screens/MindScreen.jsx', 'utf8')).toMatch(/import '\.\.\/styles\/mind\.css'/)
    // the ceiling itself must not have been raised
    expect(readFileSync('qa/build-proof.mjs', 'utf8')).toMatch(/initialCssGzip: 55 \* 1024/)
  })

  it('leaves Records, Achievements and the other pillars standing', async () => {
    for (const [route, probe] of [
      ['insights?view=record', () => screen.getByRole('heading', { level: 1, name: 'Record' })],
      ['insights?view=achievements', () => screen.getByRole('heading', { level: 1, name: 'Achievements' })],
      ['today', () => document.querySelector('#today-screen')],
      ['habits', () => document.querySelector('#habits-screen')],
      ['work', () => document.querySelector('#work-screen')],
      ['goals', () => screen.getByRole('heading', { level: 1, name: 'Goals' })],
    ]) {
      cleanup(); localStorage.clear(); document.body.innerHTML = ''
      localStorage.setItem(STORAGE_KEY, JSON.stringify(richState()))
      window.location.hash = `#/${route}`
      render(<StoreProvider><App /></StoreProvider>)
      await waitFor(() => expect(probe()).toBeTruthy(), { timeout: 8000 })
    }
  })
})

describe('Mind engines stay honest under 7C (reused, not re-implemented)', () => {
  it('mindSeries returns nulls for unlogged days instead of zeroes', () => {
    const rows = mindSeries(thinState(), 30).rows
    expect(rows[rows.length - 1].score).toBe(4)
    expect(rows[0].score).toBeNull()
    expect(rows[0].energy).toBeNull()
  })

  it('moodCorrelations stays closed until both sides have four days', () => {
    expect(moodCorrelations(thinState(), 60).rows).toHaveLength(0)
    expect(moodCorrelations(thinState(), 60).enough).toBe(false)
    const rich = moodCorrelations(richState(), 60)
    expect(rich.enough).toBe(true)
    expect(rich.rows.every((r) => r.highTotal >= 4 && r.lowTotal >= 4 && Math.abs(r.delta) >= 10)).toBe(true)
  })

  it('habit co-occurrence and workload gates are what the screen prints', () => {
    expect(habitCorrelations(thinState(), 60, 3).enough).toBe(false)
    expect(habitCorrelations(richState(), 60, 3).enough).toBe(true)
    const rich = richState()
    const habit0 = activeHabits(rich)[0]
    expect(workloadInteraction(rich, habit0, 90).enough).toBe(true)
    expect(workloadInteraction(thinState(), habit0, 90).enough).toBe(false)
  })
})
