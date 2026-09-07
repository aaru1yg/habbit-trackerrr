/* ============================================================
   PHASE E — deterministic capture parsing.

   Two rules these tests exist to protect:
     1. nothing is invented — an unstated deadline, duration, project
        or type stays null;
     2. ambiguity is reported, never resolved by guessing.
   Plus the date boundaries E6 asks for explicitly: midnight, week,
   month and year transitions.
   ============================================================ */
import { describe, it, expect } from 'vitest'
import {
  resolveRelativeDate, parseDuration, classifyCapture, parseCapture,
  extractTitle, suggestLinks, validateCapture, detectDuplicate,
  captureToAction, CONFIDENCE, CAPTURE_TYPES,
} from '../src/lib/quickCapture.js'
import { dayStr } from '../src/lib/dates.js'

const NOON = (s) => new Date(`${s}T12:00:00`)
const state = {
  projects: [{ id: 'p1', name: 'Habit OS', archived: false }],
  goals: [{ id: 'g1', title: 'Run a marathon', archived: false }],
  habits: [{ id: 'h1', name: 'Morning run', createdAt: '2026-09-01' }],
  assignments: [{ id: 'a1', name: 'Physics set', createdAtDay: '2026-09-05' }],
}

/* ============================================================
   E6 · relative dates
   ============================================================ */
describe('resolveRelativeDate', () => {
  const now = NOON('2026-09-08') // a Tuesday

  it('returns nothing when no date was written', () => {
    const r = resolveRelativeDate('Study probability', { now })
    expect(r.date).toBeNull()
    expect(r.matched).toBeNull()
    expect(r.label).toBeNull()
    expect(r.ambiguous).toBe(false)
  })

  it('resolves today and tomorrow', () => {
    expect(resolveRelativeDate('Submit assignment today', { now }).date).toBe('2026-09-08')
    expect(resolveRelativeDate('Workout tomorrow morning', { now }).date).toBe('2026-09-09')
  })

  it('resolves "in N days" and "in N weeks"', () => {
    expect(resolveRelativeDate('Review notes in 3 days', { now }).date).toBe('2026-09-11')
    expect(resolveRelativeDate('Ship it in 2 weeks', { now }).date).toBe('2026-09-22')
    expect(resolveRelativeDate('Call mum in a day', { now }).date).toBe('2026-09-09')
  })

  it('resolves a bare weekday to the nearest occurrence, today included', () => {
    expect(resolveRelativeDate('Finish DSA Chapter 4 by Friday', { now }).date).toBe('2026-09-11')
    // typed on a Tuesday: "by Tuesday" means today, and says so
    const r = resolveRelativeDate('Pay the bill by Tuesday', { now })
    expect(r.date).toBe('2026-09-08')
    expect(r.sameDay).toBe(true)
    expect(r.label).toBe('Today')
  })

  it('keeps "this Friday" inside the current week', () => {
    expect(resolveRelativeDate('Present this Friday', { now }).date).toBe('2026-09-11')
  })

  it('refuses "this Monday" once Monday has passed, instead of silently meaning next week', () => {
    const r = resolveRelativeDate('Hand this in this Monday', { now })
    expect(r.date).toBeNull()
    expect(r.ambiguous).toBe(true)
    expect(r.note).toMatch(/already passed/)
  })

  it('resolves "next Monday" to the following week, not this one', () => {
    expect(resolveRelativeDate('Prepare presentation next Monday', { now }).date).toBe('2026-09-14')
  })

  it('resolves "next week" to the start of the following week', () => {
    expect(resolveRelativeDate('Tidy the repo next week', { now }).date).toBe('2026-09-14')
  })

  it('passes an ISO date straight through', () => {
    expect(resolveRelativeDate('Submit by 2026-12-25', { now }).date).toBe('2026-12-25')
  })

  it('resolves a month name, rolling to next year once passed', () => {
    expect(resolveRelativeDate('Renew passport on March 12', { now }).date).toBe('2027-03-12')
    expect(resolveRelativeDate('Book flights on December 2', { now }).date).toBe('2026-12-02')
  })

  /* ---- boundaries E6 names explicitly ---- */

  it('crosses midnight without drifting a day', () => {
    const late = new Date('2026-09-08T23:59:00')
    expect(resolveRelativeDate('Submit tomorrow', { now: late }).date).toBe('2026-09-09')
    const early = new Date('2026-09-09T00:01:00')
    expect(resolveRelativeDate('Submit tomorrow', { now: early }).date).toBe('2026-09-10')
  })

  it('crosses a week boundary correctly on a Sunday', () => {
    const sunday = NOON('2026-09-13') // weekStartsOn 1 → week is Mon 7th–Sun 13th
    expect(dayStr(sunday)).toBe('2026-09-13')
    // Monday is tomorrow and belongs to the NEXT week
    expect(resolveRelativeDate('Start next Monday', { now: sunday }).date).toBe('2026-09-14')
    expect(resolveRelativeDate('Start Monday', { now: sunday }).date).toBe('2026-09-14')
  })

  it('crosses a month boundary', () => {
    const endOfMonth = NOON('2026-09-29')
    expect(resolveRelativeDate('Submit in 5 days', { now: endOfMonth }).date).toBe('2026-10-04')
    expect(resolveRelativeDate('Submit tomorrow', { now: NOON('2026-09-30') }).date).toBe('2026-10-01')
  })

  it('crosses a year boundary', () => {
    const nye = NOON('2026-12-30')
    expect(resolveRelativeDate('Gym tomorrow', { now: nye }).date).toBe('2026-12-31')
    expect(resolveRelativeDate('Gym in 3 days', { now: nye }).date).toBe('2027-01-02')
    expect(resolveRelativeDate('Plan the year next week', { now: nye }).date).toBe('2027-01-04')
  })

  it('resolves in February across a leap year', () => {
    expect(resolveRelativeDate('Submit in 3 days', { now: NOON('2028-02-27') }).date).toBe('2028-03-01')
  })
})

/* ============================================================
   E7 · durations
   ============================================================ */
describe('parseDuration', () => {
  it.each([
    ['Study DSA for 45 minutes', 45],
    ['Read for 45m', 45],
    ['Review for 30 mins', 30],
    ['Deep work 1h', 60],
    ['Deep work 1.5h', 90],
    ['Deep work 2 hours', 120],
    ['Session 1h 30m', 90],
    ['Sit with it for half an hour', 30],
    ['Focus an hour', 60],
  ])('reads %j as %i minutes', (text, minutes) => {
    expect(parseDuration(text).minutes).toBe(minutes)
  })

  it('does not invent a duration when none was given', () => {
    expect(parseDuration('Finish DSA Chapter 4 by Friday').minutes).toBeNull()
    expect(parseDuration('Prepare presentation').minutes).toBeNull()
    expect(parseDuration('').minutes).toBeNull()
  })

  it('does not read an ordinary number as a duration', () => {
    expect(parseDuration('Solve 30 problems').minutes).toBeNull()
    expect(parseDuration('Read chapter 12').minutes).toBeNull()
  })

  it('refuses an absurd duration rather than storing it', () => {
    expect(parseDuration('work for 99999 minutes').minutes).toBeNull()
  })
})

/* ============================================================
   E3/E5 · classification
   ============================================================ */
describe('classifyCapture', () => {
  const now = NOON('2026-09-08')

  it('detects a habit from recurrence', () => {
    const c = classifyCapture('Read 20 pages every day', state, { now })
    expect(c.type).toBe('habit')
    expect(c.confidence).toBe(CONFIDENCE.CONFIDENT)
  })

  it('detects an assignment from its own wording', () => {
    const c = classifyCapture('Submit assignment tomorrow', state, { now })
    expect(c.type).toBe('assignment')
    expect(c.confidence).toBe(CONFIDENCE.CONFIDENT)
  })

  it('treats "project task" as one phrase, not two competing types', () => {
    const c = classifyCapture('project task for Habit OS', state, { now })
    expect(c.type).toBe('project-task')
    expect(c.confidence).toBe(CONFIDENCE.CONFIDENT)
  })

  it('detects a goal milestone', () => {
    const c = classifyCapture('milestone: first 10 km run', state, { now })
    expect(c.type).toBe('goal-milestone')
    expect(c.confidence).toBe(CONFIDENCE.CONFIDENT)
  })

  it('detects a project when the user describes building one', () => {
    const c = classifyCapture('create a project for the portfolio rebuild', state, { now })
    expect(c.type).toBe('project')
    expect(c.confidence).toBe(CONFIDENCE.CONFIDENT)
  })

  it('ASKS on genuinely ambiguous input instead of guessing', () => {
    const c = classifyCapture('Prepare presentation', state, { now })
    // "presentation" matches nothing; the engine must not pick a winner
    expect([CONFIDENCE.AMBIGUOUS, CONFIDENCE.UNRESOLVED]).toContain(c.confidence)
  })

  it('reports unresolved when nothing matched at all', () => {
    const c = classifyCapture('xyzzy', state, { now })
    expect(c.confidence).toBe(CONFIDENCE.UNRESOLVED)
    expect(c.type).toBeNull()
    expect(c.reason).toMatch(/Couldn’t confidently classify/)
  })

  it('names competing types when the user wrote two of them', () => {
    const c = classifyCapture('add a habit and an assignment', state, { now })
    expect(c.confidence).toBe(CONFIDENCE.AMBIGUOUS)
    expect(c.candidates).toEqual(expect.arrayContaining(['habit', 'assignment']))
  })

  it('always exposes a reason a human can read', () => {
    for (const text of ['Workout tomorrow', 'Submit assignment tomorrow', 'Read every day', 'xyzzy']) {
      expect(classifyCapture(text, state, { now }).reason).toBeTruthy()
    }
  })
})

/* ============================================================
   E8 · linking
   ============================================================ */
describe('suggestLinks', () => {
  it('suggests a project whose name literally appears', () => {
    const l = suggestLinks('Finish API work for Habit OS by Friday', state)
    expect(l.projects).toEqual([{ id: 'p1', name: 'Habit OS' }])
    expect(l.any).toBe(true)
  })

  it('suggests a goal whose title literally appears', () => {
    expect(suggestLinks('Log 10 km for Run a marathon', state).goals).toEqual([{ id: 'g1', name: 'Run a marathon' }])
  })

  it('never links on a partial or short match', () => {
    expect(suggestLinks('Work on Habit', state).projects).toEqual([])
    expect(suggestLinks('marathon prep', state).goals).toEqual([])
    expect(suggestLinks('DSA revision', state).any).toBe(false)
  })

  it('does not suggest archived work', () => {
    const archived = { projects: [{ id: 'p2', name: 'Old Site', archived: true }], goals: [] }
    expect(suggestLinks('Polish Old Site', archived).projects).toEqual([])
  })
})

/* ============================================================
   parseCapture — the whole pipeline
   ============================================================ */
describe('parseCapture', () => {
  const now = NOON('2026-09-08')

  it('parses the canonical example end to end', () => {
    const r = parseCapture('Finish DSA Chapter 4 by Friday', state, { now })
    expect(r.ok).toBe(true)
    expect(r.type).toBe('assignment')
    expect(r.title).toBe('Finish DSA Chapter 4')
    expect(r.date.date).toBe('2026-09-11')
    expect(r.date.label).toBe('Friday')
    expect(r.duration.minutes).toBeNull()
    expect(r.confidence).toBe(CONFIDENCE.CONFIDENT)
  })

  it('keeps a stated duration and drops it from the title', () => {
    const r = parseCapture('Study probability for 45 minutes', state, { now })
    expect(r.duration.minutes).toBe(45)
    expect(r.duration.label).toBe('45m')
    expect(r.title).toBe('Study probability')
  })

  it('parses "Workout tomorrow morning" as a dated habit', () => {
    const r = parseCapture('Workout every morning', state, { now })
    expect(r.type).toBe('habit')
  })

  it('links a named project but leaves the decision to the user', () => {
    const r = parseCapture('Finish API work for Habit OS by Friday', state, { now })
    expect(r.links.projects[0].id).toBe('p1')
  })

  it('refuses empty input', () => {
    const r = parseCapture('   ', state, { now })
    expect(r.ok).toBe(false)
    expect(r.confidence).toBe(CONFIDENCE.UNRESOLVED)
  })

  it('flags an ambiguous date rather than picking one', () => {
    const r = parseCapture('Hand this in this Monday', state, { now })
    expect(r.confidence).toBe(CONFIDENCE.AMBIGUOUS)
    expect(r.date.date).toBeNull()
  })

  it('marks the deadline fallback as a suggestion, not a detection', () => {
    const r = parseCapture('Finish DSA Chapter 4 by Friday', state, { now })
    expect(r.defaulted).toBe(true)
    expect(r.reason).toMatch(/suggested/i)
    // an explicitly named type is a detection, not a suggestion
    expect(parseCapture('Submit assignment tomorrow', state, { now }).defaulted).toBe(false)
  })

  it('does not fall back to assignment when the date could not be resolved', () => {
    const r = parseCapture('Hand this in this Monday', state, { now })
    expect(r.defaulted).toBe(false)
    expect(r.type).toBeNull()
  })

  it('lists every supported type', () => {
    expect(CAPTURE_TYPES.map((t) => t.id)).toEqual(['assignment', 'project-task', 'habit', 'goal-milestone', 'project', 'note'])
  })
})

describe('extractTitle', () => {
  it('strips the consumed date and duration phrases', () => {
    expect(extractTitle('Study DSA for 45 minutes by Friday', {
      date: { matched: 'by Friday' }, duration: { matched: 'for 45 minutes' },
    })).toBe('Study DSA')
  })

  it('leaves a title with no phrases untouched', () => {
    expect(extractTitle('Prepare presentation', { date: {}, duration: {} })).toBe('Prepare presentation')
  })
})

/* ============================================================
   E25 · validation
   ============================================================ */
describe('validateCapture', () => {
  it('accepts a complete draft', () => {
    const v = validateCapture({ type: 'assignment', title: 'Physics set', deadline: '2026-09-11T18:00', estimateMin: 45 })
    expect(v.ok).toBe(true)
    expect(v.errors).toEqual([])
  })

  it('rejects a missing title', () => {
    const v = validateCapture({ type: 'assignment', title: '   ' })
    expect(v.ok).toBe(false)
    expect(v.errors.map((e) => e.field)).toContain('title')
  })

  it('rejects an absurd title length', () => {
    expect(validateCapture({ type: 'assignment', title: 'x'.repeat(201) }).ok).toBe(false)
  })

  it('rejects an invalid deadline', () => {
    const v = validateCapture({ type: 'assignment', title: 'x', deadline: '2026-13-45' })
    expect(v.errors.map((e) => e.field)).toContain('deadline')
  })

  it('requires a project for a project task and a goal for a milestone', () => {
    expect(validateCapture({ type: 'project-task', title: 'x' }).errors.map((e) => e.field)).toContain('projectId')
    expect(validateCapture({ type: 'goal-milestone', title: 'x' }).errors.map((e) => e.field)).toContain('goalId')
  })

  it('rejects an unknown type', () => {
    expect(validateCapture({ type: 'spaceship', title: 'x' }).ok).toBe(false)
  })
})

/* ============================================================
   E24 · duplicate protection
   ============================================================ */
describe('detectDuplicate', () => {
  it('warns about a recent same-named item', () => {
    const d = detectDuplicate(state, { title: 'Physics set' }, { now: NOON('2026-09-08') })
    expect(d.possible).toHaveLength(1)
    expect(d.possible[0].kind).toBe('assignment')
    expect(d.reason).toMatch(/already have/)
  })

  it('ignores items outside the recent window', () => {
    const d = detectDuplicate(state, { title: 'Morning run' }, { now: NOON('2026-09-08'), days: 3 })
    expect(d.possible).toEqual([])
    expect(d.reason).toBeNull()
  })

  it('matches case-insensitively and ignores punctuation', () => {
    expect(detectDuplicate(state, { title: 'physics set!' }, { now: NOON('2026-09-08') }).possible).toHaveLength(1)
  })

  it('never blocks — a duplicate is the user’s call', () => {
    const d = detectDuplicate(state, { title: 'Physics set' }, { now: NOON('2026-09-08') })
    expect(d).not.toHaveProperty('block')
  })
})

/* ============================================================
   Store actions
   ============================================================ */
describe('captureToAction', () => {
  const base = { deadline: '2026-09-11', estimateMin: 45 }

  it('builds an assignment action carrying the caller-supplied id', () => {
    const a = captureToAction({ type: 'assignment', title: 'Physics set', ...base }, { id: 'NEW1' })
    expect(a.type).toBe('ADD_ASSIGNMENT')
    expect(a.assignment.id).toBe('NEW1')
    expect(a.assignment.deadline).toBe('2026-09-11T18:00')
    expect(a.assignment.estimateMin).toBe(45)
    expect(a.created).toEqual({ kind: 'assignment', id: 'NEW1', name: 'Physics set' })
  })

  it('builds a habit action with a real schedule', () => {
    const a = captureToAction({ type: 'habit', title: 'Morning run' }, { id: 'NEW2' })
    expect(a.type).toBe('ADD_HABIT')
    expect(a.habit.schedule).toEqual({ type: 'daily' })
  })

  it('routes a project task into the right project and milestone', () => {
    const a = captureToAction({ type: 'project-task', title: 'Wire up sync', projectId: 'p1', milestoneId: 'm1', ...base }, { id: 'x' })
    expect(a.type).toBe('ADD_TASK')
    expect(a.projectId).toBe('p1')
    expect(a.milestoneId).toBe('m1')
    expect(a.due).toBe('2026-09-11')
  })

  it('routes a milestone into the right goal', () => {
    const a = captureToAction({ type: 'goal-milestone', title: 'First 10 km', goalId: 'g1', ...base }, { id: 'x' })
    expect(a.type).toBe('ADD_GOAL_MILESTONE')
    expect(a.id).toBe('g1')
    expect(a.milestone.targetDate).toBe('2026-09-11')
  })

  it('appends a note instead of overwriting an existing one', () => {
    const a = captureToAction({ type: 'note', title: 'Call the dentist' }, { id: null, existingNote: 'Booked the flight.' })
    expect(a.type).toBe('SET_MOOD')
    expect(a.patch.note).toBe('Booked the flight.\nCall the dentist')
  })

  it('leaves unstated fields null rather than inventing them', () => {
    const a = captureToAction({ type: 'assignment', title: 'Physics set' }, { id: 'NEW3' })
    expect(a.assignment.deadline).toBeNull()
    expect(a.assignment.estimateMin).toBeNull()
    expect(a.assignment.projectId).toBeNull()
  })

  it('returns nothing for an unknown type', () => {
    expect(captureToAction({ type: 'nope', title: 'x' }, { id: 'x' })).toBeNull()
  })
})
