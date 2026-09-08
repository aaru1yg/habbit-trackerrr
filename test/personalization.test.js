/* ============================================================
   PERSONALIZATION ENGINE — Phase B

   The engine's contract is the interesting part: it must adapt when
   there is real evidence, and must refuse to adapt when there is not.
   Every "not enough data" assertion below is as load-bearing as the
   ones that produce a value.
   ============================================================ */
import { describe, expect, it } from 'vitest'
import {
  SIGNAL_TYPES, MAX_SIGNALS, PERSONALIZATION_THRESHOLDS, ADJUSTMENT_CAP, EMPHASIS_WEIGHTS, EMPHASIS_RANGE,
  DEFAULT_PREFERENCES, coercePreferences, preferencesOf, preferencesSet,
  recordSignal, pruneSignals, signalCounts, signalTotal,
  recordFocusSession, baseFocusSession,
  completedByKind, activityMix, preferredWindow, workingWindow,
  estimateAdvice, quickActions, homeEmphasis,
  typicalFocusDuration, typicalDailyLoad, productivityProfile,
  personalizeScore, personalizedRanking, personalizedNextBestAction, contextualLens,
} from '../src/lib/personalization.js'
import { normalizeImport, exportPayload } from '../src/lib/importExport.js'
import { mergeDocs, mergeEventLog, comparableDoc } from '../src/lib/cloud/merge.js'
import { getTodayPriorities } from '../src/lib/adaptive.js'

const now = new Date('2026-09-07T09:30:00')
const at = (day, time) => `${day}T${time}`

const baseState = () => ({
  version: 4,
  profile: { name: 'Aaru', onboarded: true, theme: 'midnight' },
  habits: [], checkins: {}, routines: [], projects: [], assignments: [], goals: [], moods: {},
  preferences: { ...DEFAULT_PREFERENCES }, signals: [], focusLog: [],
})

/* ------------------------------------------------------------ */
describe('signal log — observable behaviour only', () => {
  it('records a real event with its type, time and target', () => {
    const log = recordSignal([], 'focus-start', { at: at('2026-09-07', '09:00'), target: 'a1' })
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({ type: 'focus-start', target: 'a1' })
    expect(log[0].id).toBeTruthy()
  })

  it('refuses to store an unknown signal type rather than invent one', () => {
    expect(recordSignal([], 'mood-was-low')).toEqual([])
    expect(recordSignal([], 'inferred-personality')).toEqual([])
  })

  it('stays capped, keeping the most recent events', () => {
    let log = []
    for (let i = 0; i < MAX_SIGNALS + 50; i++) log = recordSignal(log, 'screen-visit', { target: `s${i}` })
    expect(log).toHaveLength(MAX_SIGNALS)
    expect(log.at(-1).target).toBe(`s${MAX_SIGNALS + 49}`)
  })

  it('counts only what happened inside the window', () => {
    const log = [
      recordSignal([], 'habit-add', { at: at('2026-09-01', '08:00') })[0],
      recordSignal([], 'habit-add', { at: at('2026-09-06', '08:00') })[0],
      recordSignal([], 'focus-start', { at: at('2026-09-03', '08:00') })[0],
      recordSignal([], 'capture', { at: at('2026-06-01', '08:00') })[0], // outside 30 days
    ]
    const counts = signalCounts(log, { days: 30, now })
    expect(counts).toEqual({ 'habit-add': 2, 'focus-start': 1 })
    expect(signalCounts(log, { days: 3, now })).toEqual({ 'habit-add': 1 })
    expect(signalTotal(log, { days: 30, now })).toBe(3)
    expect(signalTotal(log, { days: 365, now })).toBe(4)
  })

  it('prunes old signals so the log stays bounded and current', () => {
    const log = [
      recordSignal([], 'capture', { at: at('2026-01-01', '08:00') })[0],
      recordSignal([], 'capture', { at: at('2026-09-07', '08:00') })[0],
    ]
    expect(pruneSignals(log, { days: 30, now })).toHaveLength(1)
  })

  it('documents every signal type it is willing to store', () => {
    expect(Object.keys(SIGNAL_TYPES)).toContain('focus-complete')
    expect(SIGNAL_TYPES['inferred-anything']).toBeUndefined()
  })
})

/* ------------------------------------------------------------ */
describe('preferences — explicit, editable, never assumed', () => {
  it('defaults to nothing set at all', () => {
    const p = coercePreferences(undefined)
    expect(p.focusStartHour).toBeNull()
    expect(p.focusEndHour).toBeNull()
    expect(p.dailyCapacityMin).toBeNull()
    expect(p.breakStyle).toBeNull()
    expect(p.planningTime).toBeNull()
    expect(p.reminderWindow).toBeNull()
  })

  it('keeps an absent hour absent instead of assuming midnight', () => {
    // Regression: `null` used to coerce to 0, inventing a preference.
    expect(coercePreferences({ focusStartHour: null }).focusStartHour).toBeNull()
    expect(coercePreferences({ focusStartHour: '' }).focusStartHour).toBeNull()
    expect(coercePreferences({}).focusEndHour).toBeNull()
  })

  it('accepts values the user really chose', () => {
    const p = coercePreferences({
      focusStartHour: 9, focusEndHour: 12, planningTime: '20:30', breakStyle: 'short',
      dailyCapacityMin: 240, planningBufferPct: 20, weekStartsOn: 0, reminderWindow: '07:00-09:00',
    })
    expect(p).toMatchObject({ focusStartHour: 9, focusEndHour: 12, planningTime: '20:30', breakStyle: 'short', dailyCapacityMin: 240, planningBufferPct: 20, weekStartsOn: 0, reminderWindow: '07:00-09:00' })
  })

  it('rejects nonsense rather than repairing it into a guess', () => {
    const p = coercePreferences({ focusStartHour: 99, dailyCapacityMin: 5, planningTime: '25:00', breakStyle: 'party', reminderWindow: 'morning-ish', weekStartsOn: 9 })
    expect(p.focusStartHour).toBeNull()
    expect(p.dailyCapacityMin).toBeNull()
    expect(p.planningTime).toBeNull()
    expect(p.breakStyle).toBeNull()
    expect(p.reminderWindow).toBeNull()
    expect(p.weekStartsOn).toBe(1)
  })

  it('is idempotent — normalising twice changes nothing', () => {
    const once = coercePreferences({ focusStartHour: 9, dailyCapacityMin: 180 })
    expect(coercePreferences(once)).toEqual(once)
    expect(coercePreferences(coercePreferences({}))).toEqual(coercePreferences({}))
  })

  it('reports which preferences are actually set', () => {
    expect(preferencesSet({ preferences: { ...DEFAULT_PREFERENCES } })).toEqual([])
    expect(preferencesSet({ preferences: coercePreferences({ dailyCapacityMin: 240, focusStartHour: 9 }) }).sort())
      .toEqual(['dailyCapacityMin', 'focusStartHour'])
  })

  it('reads through a missing preferences key safely', () => {
    expect(preferencesOf({})).toEqual(DEFAULT_PREFERENCES)
    expect(preferencesOf(null)).toEqual(DEFAULT_PREFERENCES)
  })
})

/* ------------------------------------------------------------ */
describe('focus log — the data source for learning', () => {
  it('stores a session that really started and ended', () => {
    const log = recordFocusSession([], { kind: 'assignment', itemId: 'a1', name: 'Essay', startedAt: at('2026-09-07', '09:00'), endedAt: at('2026-09-07', '09:52'), plannedMin: 45, actualMin: 52, completed: true })
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({ actualMin: 52, plannedMin: 45, completed: true })
  })

  it('refuses a session with no end — that is not a measurement', () => {
    expect(recordFocusSession([], { startedAt: at('2026-09-07', '09:00') })).toEqual([])
    expect(recordFocusSession([], {})).toEqual([])
  })

  it('normalises an out-of-range duration to null rather than clamping it', () => {
    expect(baseFocusSession({ actualMin: 99999 }).actualMin).toBeNull()
    expect(baseFocusSession({ plannedMin: 0 }).plannedMin).toBeNull()
  })
})

/* ------------------------------------------------------------ */
describe('import / export / sync round trip', () => {
  const rich = () => ({
    ...baseState(),
    habits: [{ id: 'h1', name: 'Run', createdAt: '2026-08-01' }],
    checkins: { h1: { '2026-09-01': { done: true, at: at('2026-09-01', '09:10') } } },
    preferences: coercePreferences({ focusStartHour: 9, dailyCapacityMin: 240, breakStyle: 'long' }),
    signals: recordSignal(recordSignal([], 'focus-start', { at: at('2026-09-06', '09:00') }), 'habit-add', { at: at('2026-09-05', '08:00') }),
    focusLog: recordFocusSession([], { kind: 'habit', itemId: 'h1', startedAt: at('2026-09-06', '09:00'), endedAt: at('2026-09-06', '09:45'), plannedMin: 45, actualMin: 45, completed: true }),
  })

  it('survives an export → import round trip', () => {
    const back = normalizeImport(exportPayload(rich()))
    expect(back.preferences).toMatchObject({ focusStartHour: 9, dailyCapacityMin: 240, breakStyle: 'long' })
    expect(back.signals).toHaveLength(2)
    expect(back.focusLog).toHaveLength(1)
  })

  it('is idempotent, so a synced document never looks like a conflict', () => {
    const once = normalizeImport(exportPayload(rich()))
    const twice = normalizeImport(JSON.parse(JSON.stringify(once)))
    expect(twice.preferences).toEqual(once.preferences)
    expect(twice.signals).toEqual(once.signals)
    expect(twice.focusLog).toEqual(once.focusLog)
  })

  it('gives an older file no preferences and no history instead of inventing them', () => {
    const legacy = normalizeImport({ ...baseState(), preferences: undefined, signals: undefined, focusLog: undefined })
    expect(legacy.preferences).toEqual(DEFAULT_PREFERENCES)
    expect(legacy.signals).toEqual([])
    expect(legacy.focusLog).toEqual([])
  })

  it('drops malformed signal and session entries', () => {
    const dirty = normalizeImport({
      ...baseState(),
      signals: [{ type: 'made-up' }, { type: 'capture' }, { type: 'capture', at: 'not-a-date' }, { type: 'capture', at: at('2026-09-07', '08:00') }],
      focusLog: [{ startedAt: at('2026-09-07', '08:00') }, { startedAt: at('2026-09-07', '08:00'), endedAt: at('2026-09-07', '08:30') }],
    })
    expect(dirty.signals).toHaveLength(1)
    expect(dirty.focusLog).toHaveLength(1)
  })

  it('unions event logs from two devices chronologically', () => {
    const local = recordSignal([], 'capture', { at: at('2026-09-07', '08:00') })
    const cloud = recordSignal([], 'capture', { at: at('2026-09-05', '08:00') })
    const merged = mergeEventLog(local, cloud, { at: 'at', cap: 400 })
    expect(merged).toHaveLength(2)
    expect(merged[0].at).toBe(at('2026-09-05', '08:00'))
  })

  it('does not treat a pre-adaptive cloud doc as different from a default local one', () => {
    const legacyCloud = { ...baseState(), preferences: undefined, signals: undefined, focusLog: undefined, profile: { name: 'Aaru', onboarded: true } }
    delete legacyCloud.preferences; delete legacyCloud.signals; delete legacyCloud.focusLog
    const local = normalizeImport(exportPayload(baseState()))
    expect(comparableDoc(legacyCloud).preferences).toEqual(comparableDoc(local).preferences)
    expect(comparableDoc(legacyCloud).signals).toEqual([])
    expect(comparableDoc(legacyCloud).profile.updatedAt).toBeNull()
  })

  it('lets the more recently edited profile state the preferences', () => {
    const local = { ...baseState(), preferences: coercePreferences({ dailyCapacityMin: 120 }), profile: { updatedAt: '2026-09-07T08:00:00' } }
    const cloud = { ...baseState(), preferences: coercePreferences({ dailyCapacityMin: 300 }), profile: { updatedAt: '2026-09-01T08:00:00' } }
    expect(mergeDocs(local, cloud).preferences.dailyCapacityMin).toBe(120)
    const flipped = mergeDocs({ ...local, profile: { updatedAt: '2026-08-01T08:00:00' } }, cloud)
    expect(flipped.preferences.dailyCapacityMin).toBe(300)
  })
})

/* ------------------------------------------------------------ */
describe('real completion history', () => {
  it('says there is nothing for a brand-new user', () => {
    expect(completedByKind(baseState(), { now })).toMatchObject({ total: 0, enough: false, topKind: null, reason: PERSONALIZATION_THRESHOLDS.signals ? 'Not enough data yet.' : '' })
  })

  it('counts only dated completions inside the window', () => {
    const s = {
      ...baseState(),
      habits: [{ id: 'h1', name: 'Run' }],
      checkins: { h1: { '2026-09-01': { done: true }, '2026-09-02': { done: true }, '2026-09-03': { done: true } } },
      assignments: [{ id: 'a1', name: 'Essay', completedAt: at('2026-09-04', '10:00') }],
    }
    const by = completedByKind(s, { now })
    expect(by.counts.habit).toBe(3)
    expect(by.counts.assignment).toBe(1)
    expect(by.total).toBe(4)
    expect(by.enough).toBe(false) // 4 < 5 observations
    expect(by.topKind).toBe('habit')
  })

  it('ignores check-ins that are not marked done', () => {
    const s = { ...baseState(), habits: [{ id: 'h1', name: 'Run' }], checkins: { h1: { '2026-09-01': { done: false } } } }
    expect(completedByKind(s, { now }).counts.habit).toBe(0)
  })

  it('reports the activity mix only once there is enough of it', () => {
    expect(activityMix(baseState(), { now })).toMatchObject({ enough: false, dominant: null, total: 0 })
    const s = {
      ...baseState(),
      habits: [{ id: 'h1', name: 'Run' }],
      checkins: { h1: Object.fromEntries(['01', '02', '03', '04', '05', '06'].map((d) => [`2026-09-${d}`, { done: true }])) },
    }
    expect(activityMix(s, { now })).toMatchObject({ enough: true, dominant: 'habit', habit: 6, work: 0 })
  })
})

/* ------------------------------------------------------------ */
describe('preferred working window', () => {
  const withCheckins = (times) => ({
    ...baseState(),
    habits: [{ id: 'h1', name: 'Run' }],
    checkins: { h1: Object.fromEntries(times.map((t, i) => [`2026-08-${String(i + 1).padStart(2, '0')}`, { done: true, at: t }])) },
  })

  it('refuses to name a window without enough observations', () => {
    expect(preferredWindow(baseState(), { now })).toMatchObject({ enough: false, hour: null, reason: 'Not enough data yet.' })
    expect(preferredWindow(withCheckins(['2026-08-01T09:00', '2026-08-02T10:00']), { now })).toMatchObject({ enough: false, observations: 2 })
  })

  it('refuses when activity is genuinely spread across the day', () => {
    const spread = ['06:00', '10:00', '13:00', '16:00', '20:00', '22:00'].map((t) => `2026-08-0${['6:00', '10:00', '13:00', '16:00', '20:00', '22:00'].indexOf(t) + 1}T${t}`)
    expect(preferredWindow(withCheckins(spread), { now })).toMatchObject({ enough: false, reason: 'Your activity is spread across the day.' })
  })

  it('names the hour the user actually works in, with the count behind it', () => {
    const times = ['09:05', '09:20', '09:40', '09:55', '14:00', '21:00'].map((t, i) => `2026-08-0${i + 1}T${t}`)
    const w = preferredWindow(withCheckins(times), { now })
    expect(w).toMatchObject({ enough: true, hour: 9, label: '09:00', part: 'morning', observations: 6 })
    expect(w.reason).toMatch(/4 of 6 logged actions/)
  })

  it('lets an explicit preference win over inference, and says which it used', () => {
    const observed = withCheckins(['09:05', '09:20', '09:40', '09:55', '14:00', '21:00'].map((t, i) => `2026-08-0${i + 1}T${t}`))
    expect(workingWindow(observed, { now })).toMatchObject({ source: 'observed', startHour: 9 })
    const withPref = { ...observed, preferences: coercePreferences({ focusStartHour: 20, focusEndHour: 22 }) }
    expect(workingWindow(withPref, { now })).toMatchObject({ source: 'preference', startHour: 20, endHour: 22 })
    expect(workingWindow(baseState(), { now })).toMatchObject({ enough: false, source: 'none' })
  })
})

/* ------------------------------------------------------------ */
describe('adaptive estimates', () => {
  const done = (id, est, act, day) => ({ id, name: `A${id}`, estimateMin: est, actualMin: act, completedAt: at(day, '12:00'), progress: 100 })

  it('says there is not enough history rather than inventing a number', () => {
    const s = { ...baseState(), assignments: [done('1', 60, 90, '2026-09-01')] }
    expect(estimateAdvice({ kind: 'assignment', estimateMin: 45 }, s, { now }))
      .toMatchObject({ enough: false, suggestedMin: null, reason: 'Not enough data yet.' })
  })

  it('suggests from real actuals and shows the sample size', () => {
    const s = { ...baseState(), assignments: [done('1', 60, 66, '2026-09-01'), done('2', 60, 60, '2026-09-02'), done('3', 60, 75, '2026-09-03')] }
    const advice = estimateAdvice({ kind: 'assignment', estimateMin: 45 }, s, { now })
    expect(advice).toMatchObject({ enough: true, samples: 3, suggestedMin: 67, actualMeanMin: 67, plannedMeanMin: 60, deltaMin: 22 })
    expect(advice.reason).toMatch(/last 3 comparable assignments averaged/)
  })

  it('only compares like with like', () => {
    const s = { ...baseState(), assignments: [done('1', 60, 66, '2026-09-01'), done('2', 60, 60, '2026-09-02'), done('3', 60, 75, '2026-09-03')] }
    expect(estimateAdvice({ kind: 'project', estimateMin: 45 }, s, { now })).toMatchObject({ enough: false })
  })

  it('learns habit durations from finished focus sessions only', () => {
    let log = []
    for (const [i, mins] of [48, 52, 50].entries()) {
      log = recordFocusSession(log, { kind: 'habit', itemId: 'h1', startedAt: at(`2026-09-0${i + 1}`, '09:00'), endedAt: at(`2026-09-0${i + 1}`, '10:00'), plannedMin: 45, actualMin: mins, completed: true })
    }
    const advice = estimateAdvice({ kind: 'habit', estimateMin: 45 }, { ...baseState(), focusLog: log }, { now })
    expect(advice).toMatchObject({ enough: true, suggestedMin: 50, samples: 3 })
  })

  it('never rewrites the stored estimate', () => {
    const s = { ...baseState(), assignments: [done('1', 60, 120, '2026-09-01'), done('2', 60, 120, '2026-09-02'), done('3', 60, 120, '2026-09-03')] }
    const item = { kind: 'assignment', estimateMin: 60 }
    estimateAdvice(item, s, { now })
    expect(item.estimateMin).toBe(60)
    expect(s.assignments[0].estimateMin).toBe(60)
  })
})

/* ------------------------------------------------------------ */
describe('personalized quick actions', () => {
  const logWith = (entries) => entries.reduce((log, [type, target, day]) => recordSignal(log, type, { at: at(day, '09:00'), target }), [])

  it('falls back to the default order and admits it has not learned', () => {
    const r = quickActions(baseState(), { now })
    expect(r).toMatchObject({ learned: false, source: 'default' })
    expect(r.actions[0].id).toBe('capture')
    expect(r.reason).toMatch(/Default order/)
  })

  it('promotes what the user actually does once there is evidence', () => {
    const signals = logWith([
      ['focus-start', null, '2026-09-01'], ['focus-start', null, '2026-09-02'], ['focus-start', null, '2026-09-03'],
      ['habit-add', null, '2026-09-04'], ['capture', null, '2026-09-05'],
    ])
    const r = quickActions({ ...baseState(), signals }, { now })
    expect(r).toMatchObject({ learned: true, source: 'observed', observations: 5 })
    expect(r.actions[0]).toMatchObject({ id: 'start-focus', observations: 3 })
  })

  it('learns "add project" and "add assignment" separately from one signal', () => {
    const signals = logWith([
      ['work-add', 'project', '2026-09-01'], ['work-add', 'project', '2026-09-02'], ['work-add', 'project', '2026-09-03'],
      ['work-add', 'assignment', '2026-09-04'], ['capture', null, '2026-09-05'],
    ])
    const r = quickActions({ ...baseState(), signals }, { now, limit: 8 })
    expect(r.actions.find((a) => a.id === 'add-project').observations).toBe(3)
    expect(r.actions.find((a) => a.id === 'add-assignment').observations).toBe(1)
  })

  it('always returns a full set, never an empty palette', () => {
    const r = quickActions(baseState(), { now, limit: 4 })
    expect(r.actions).toHaveLength(4)
    expect(new Set(r.actions.map((a) => a.id)).size).toBe(4)
  })
})

/* ------------------------------------------------------------ */
describe('adaptive home emphasis', () => {
  it('keeps every emphasis weight inside the band that preserves hierarchy', () => {
    for (const [id, weights] of Object.entries(EMPHASIS_WEIGHTS)) {
      expect(Object.keys(weights).sort()).toEqual(['deadline', 'goal', 'habit', 'work'])
      for (const w of Object.values(weights)) {
        expect(w, `${id} weight out of range`).toBeGreaterThanOrEqual(EMPHASIS_RANGE.min)
        expect(w, `${id} weight out of range`).toBeLessThanOrEqual(EMPHASIS_RANGE.max)
      }
    }
  })

  it('emphasises starting out when nothing is tracked', () => {
    expect(homeEmphasis(baseState(), { now })).toMatchObject({ id: 'start', enough: false })
  })

  it('elevates deadlines when work is already late', () => {
    const s = { ...baseState(), assignments: [{ id: 'a1', name: 'Essay', deadline: at('2026-09-06', '17:00'), progress: 20 }] }
    const e = homeEmphasis(s, { now })
    expect(e).toMatchObject({ id: 'deadline', enough: true })
    expect(e.evidence[0]).toMatchObject({ label: 'Overdue', value: '1' })
  })

  it('elevates deadlines when a cluster is landing soon', () => {
    const mk = (id, day) => ({ id, name: `A${id}`, deadline: at(day, '17:00'), progress: 0 })
    const s = { ...baseState(), assignments: [mk('1', '2026-09-08'), mk('2', '2026-09-09'), mk('3', '2026-09-10')] }
    expect(homeEmphasis(s, { now })).toMatchObject({ id: 'deadline' })
  })

  it('surfaces goals when the day is genuinely light', () => {
    const s = {
      ...baseState(),
      habits: [{ id: 'h1', name: 'Run' }],
      goals: [{ id: 'g1', title: 'Run a marathon', status: 'active', milestones: [] }],
      preferences: coercePreferences({ dailyCapacityMin: 240 }),
    }
    const e = homeEmphasis(s, { now })
    expect(e).toMatchObject({ id: 'goal' })
    expect(e.counts).toMatchObject({ committedMin: 0, capacityMin: 240 })
  })

  it('emphasises habits when habits are all there is', () => {
    const s = { ...baseState(), habits: [{ id: 'h1', name: 'Run' }, { id: 'h2', name: 'Read' }] }
    expect(homeEmphasis(s, { now })).toMatchObject({ id: 'habit' })
  })

  it('emphasises work when work is all there is', () => {
    const s = { ...baseState(), projects: [{ id: 'p1', name: 'Site', milestones: [] }] }
    expect(homeEmphasis(s, { now })).toMatchObject({ id: 'work' })
  })

  it('stays balanced when nothing is urgent and everything is in play', () => {
    const s = {
      ...baseState(),
      habits: [{ id: 'h1', name: 'Run' }],
      projects: [{ id: 'p1', name: 'Site', milestones: [] }],
      goals: [{ id: 'g1', title: 'Goal', status: 'active', milestones: [] }],
    }
    expect(homeEmphasis(s, { now })).toMatchObject({ id: 'balanced' })
  })

  it('always returns the same section keys so structure never changes', () => {
    const states = [
      baseState(),
      { ...baseState(), habits: [{ id: 'h1', name: 'Run' }] },
      { ...baseState(), assignments: [{ id: 'a1', name: 'X', deadline: at('2026-09-06', '09:00') }] },
    ]
    for (const s of states) {
      const e = homeEmphasis(s, { now })
      expect(Object.keys(e.weights).sort()).toEqual(['deadline', 'goal', 'habit', 'work'])
      expect(e).toHaveProperty('reason')
      expect(e).toHaveProperty('evidence')
      expect(e).toHaveProperty('counts')
    }
  })
})

/* ------------------------------------------------------------ */
describe('personal productivity profile', () => {
  it('refuses to describe a user with no history', () => {
    const p = productivityProfile(baseState(), { now })
    expect(p.enough).toBe(false)
    expect(p.supported).toBe(0)
    expect(p.reason).toBe('Not enough data yet.')
    expect(p.sections.every((s) => s.enough === false)).toBe(true)
  })

  it('never returns a section without evidence behind it', () => {
    const p = productivityProfile(baseState(), { now })
    for (const s of p.sections) expect(s.evidence).toEqual([])
  })

  it('reports a typical focus session from finished sessions only', () => {
    expect(typicalFocusDuration(baseState(), { now })).toMatchObject({ enough: false })
    let log = []
    for (const [i, mins] of [40, 50, 60, 70].entries()) {
      log = recordFocusSession(log, { kind: 'habit', startedAt: at(`2026-09-0${i + 1}`, '09:00'), endedAt: at(`2026-09-0${i + 1}`, '10:00'), plannedMin: 45, actualMin: mins, completed: true })
    }
    const f = typicalFocusDuration({ ...baseState(), focusLog: log }, { now })
    expect(f).toMatchObject({ enough: true, sessions: 4, meanMin: 55, lowMin: 50, highMin: 70, label: '50m–1h 10m' })
  })

  it('ignores sessions that were not completed', () => {
    const log = recordFocusSession([], { kind: 'habit', startedAt: at('2026-09-01', '09:00'), endedAt: at('2026-09-01', '10:00'), plannedMin: 45, actualMin: 60, completed: false })
    expect(typicalFocusDuration({ ...baseState(), focusLog: log }, { now })).toMatchObject({ enough: false, sessions: 0 })
  })

  it('builds a transparent profile once there is real data', () => {
    const checkins = {}
    for (let d = 1; d <= 20; d++) checkins[`2026-08-${String(d).padStart(2, '0')}`] = { done: true, at: `2026-08-${String(d).padStart(2, '0')}T09:1${d % 6}:00` }
    let log = []
    for (const [i, mins] of [45, 50, 55].entries()) log = recordFocusSession(log, { kind: 'habit', startedAt: at(`2026-09-0${i + 1}`, '09:00'), endedAt: at(`2026-09-0${i + 1}`, '10:00'), plannedMin: 45, actualMin: mins, completed: true })
    const s = { ...baseState(), habits: [{ id: 'h1', name: 'Run', createdAt: '2026-08-01' }], checkins: { h1: checkins }, focusLog: log }

    const p = productivityProfile(s, { now })
    expect(p.enough).toBe(true)
    expect(p.supported).toBeGreaterThan(0)
    const focus = p.sections.find((x) => x.id === 'typical-focus')
    expect(focus).toMatchObject({ enough: true, value: '45m–55m' })
    expect(focus.evidence.length).toBeGreaterThan(0)
    expect(p.generatedFrom).toContain('focus session log')
  })

  it('describes typical daily load only when several days carry work', () => {
    expect(typicalDailyLoad(baseState(), { now })).toMatchObject({ enough: false })
  })
})

/* ------------------------------------------------------------ */
describe('personalized priority — bounded, explainable, never authoritative', () => {
  const urgent = { id: 'a1', name: 'Due now', kind: 'assignment', priority: 'high', progress: 10, estimateMin: 90, deadline: at('2026-09-08', '09:00') }
  const habit = { id: 'h1', name: 'Meditate', kind: 'habit', priority: 'low', createdAt: '2026-08-01', schedule: { type: 'daily' } }

  const stateWith = (extra = {}) => ({
    ...baseState(),
    assignments: [urgent],
    habits: [habit],
    checkins: { h1: Object.fromEntries(['01', '02', '03', '04', '05', '06'].map((d) => [`2026-09-${d}`, { done: true, at: `2026-09-${d}T09:15:00` }])) },
    ...extra,
  })

  it('changes nothing at all when there is no personal evidence', () => {
    const s = baseState()
    const plain = getTodayPriorities(s, { now, limit: 50 })
    const ranked = personalizedRanking(s, { now })
    expect(ranked.rows.map((r) => r.item.id)).toEqual(plain.slice(0, 5).map((r) => r.item.id))
    expect(ranked).toMatchObject({ enough: false, nudged: 0, reordered: false })
    for (const r of ranked.rows) expect(r.adjustedScore).toBe(r.score)
  })

  it('caps every personal adjustment', () => {
    const completions = { enough: true, topKind: 'habit' }
    const res = personalizeScore(
      { item: { kind: 'habit' }, score: 0.5, remainingMin: 10 },
      { now, preferences: coercePreferences({ focusStartHour: 9 }), capacityMin: 120, completions },
    )
    // +0.04 window, +0.02 capacity, +0.03 kind = +0.09 → capped
    expect(res.delta).toBe(ADJUSTMENT_CAP)
    expect(res.capped).toBe(true)
    expect(res.adjustments).toHaveLength(3)
  })

  it('can never go below the negative cap either', () => {
    const res = personalizeScore(
      { item: { kind: 'project' }, score: 0.5, remainingMin: 400 },
      { now: new Date('2026-09-07T23:30:00'), preferences: coercePreferences({ focusStartHour: 9 }), capacityMin: 60, completions: { enough: true, topKind: 'habit' } },
    )
    expect(res.delta).toBeGreaterThanOrEqual(-ADJUSTMENT_CAP)
  })

  it('never overturns a large deterministic gap', () => {
    const s = stateWith({ preferences: coercePreferences({ focusStartHour: 9, dailyCapacityMin: 120 }) })
    const plain = getTodayPriorities(s, { now, limit: 50, capacityMin: 120 })
    const ranked = personalizedRanking(s, { now, limit: 5 })
    expect(plain[0].item.id).toBe('a1')
    expect(ranked.rows[0].item.id).toBe('a1')
    expect(ranked.nudged).toBeGreaterThan(0)
    expect(ranked.authoritative).toBe('deterministic')
  })

  it('explains every nudge in plain language', () => {
    const s = stateWith({ preferences: coercePreferences({ focusStartHour: 9, dailyCapacityMin: 120 }) })
    const ranked = personalizedRanking(s, { now, limit: 5 })
    const nudged = ranked.rows.find((r) => r.adjusted)
    expect(nudged.adjustments.length).toBeGreaterThan(0)
    for (const a of nudged.adjustments) {
      expect(['window-fit', 'capacity-fit', 'kind-preference']).toContain(a.id)
      expect(a.reason.length).toBeGreaterThan(5)
    }
  })

  it('does not bend an item that already has a hard deadline to the clock', () => {
    const res = personalizeScore(
      { item: { kind: 'assignment', deadline: at('2026-09-08', '09:00') }, score: 0.5, remainingMin: 10 },
      { now, preferences: coercePreferences({ focusStartHour: 22 }) },
    )
    expect(res.adjustments.find((a) => a.id === 'window-fit')).toBeUndefined()
  })

  it('keeps the Next Best Action shape compatible with adaptive.js', () => {
    const nba = personalizedNextBestAction(stateWith(), { now })
    expect(nba).toHaveProperty('item')
    expect(nba).toHaveProperty('reason')
    expect(nba).toHaveProperty('urgency')
    expect(nba).toHaveProperty('signals')
    expect(personalizedNextBestAction(baseState(), { now })).toBeNull()
  })
})

/* ------------------------------------------------------------ */
describe('contextual lens', () => {
  it('surfaces critical work when the day is genuinely overloaded', () => {
    const s = {
      ...baseState(),
      assignments: [{ id: 'a1', name: 'Big', deadline: at('2026-09-07', '23:00'), estimateMin: 300, progress: 0 }],
      preferences: coercePreferences({ dailyCapacityMin: 60 }),
    }
    const c = contextualLens(s, { now })
    expect(c).toMatchObject({ id: 'critical', loaded: true, prefers: 'critical' })
  })

  it('respects focus hours the user set', () => {
    const s = { ...baseState(), preferences: coercePreferences({ focusStartHour: 9, focusEndHour: 11 }) }
    expect(contextualLens(s, { now })).toMatchObject({ id: 'deep', inFocusHours: true })
    expect(contextualLens(s, { now: new Date('2026-09-07T15:00:00') }).inFocusHours).toBe(false)
  })

  it('suggests shorter work late at night', () => {
    expect(contextualLens(baseState(), { now: new Date('2026-09-07T23:30:00') })).toMatchObject({ id: 'wind-down', prefers: 'short' })
  })

  it('does not claim a context it cannot support', () => {
    expect(contextualLens(baseState(), { now })).toMatchObject({ enough: false })
  })
})
