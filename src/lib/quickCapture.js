/* ============================================================
   QUICK CAPTURE — deterministic parsing (Phase E).

   PURE. No React, no store, no dispatch. Every function here is a
   string in / structured result out, so it can be tested without
   mounting anything.

   The rule this module lives by: it may only report what the text
   actually contained. If a deadline, duration, project or type was
   not stated, the result carries `null` and a `confidence` that says
   so — it never fills the gap with a guess.
   ============================================================ */
import { dayStr, addDaysStr, isValidDayStr } from './dates.js'
import { weekDays } from './dates.js'
import { weekdayOf } from './schedule.js'

export const NOT_ENOUGH = 'Not enough data yet.'

/* ------------------------------------------------------------
   Types
   ------------------------------------------------------------ */

export const CAPTURE_TYPES = [
  { id: 'assignment', label: 'Assignment' },
  { id: 'project-task', label: 'Project task' },
  { id: 'habit', label: 'Habit' },
  { id: 'goal-milestone', label: 'Goal milestone' },
  { id: 'project', label: 'Project' },
  { id: 'note', label: 'Note' },
]

export const CONFIDENCE = { CONFIDENT: 'confident', AMBIGUOUS: 'ambiguous', UNRESOLVED: 'unresolved' }

const WORDS = {
  habit: ['habit', 'daily', 'every day', 'every morning', 'every evening', 'every night', 'each day', 'every week', 'streak'],
  assignment: ['assignment', 'submit', 'homework', 'problem set', 'lab report', 'essay', 'quiz', 'coursework'],
  'project-task': ['task', 'todo', 'to-do'],
  'goal-milestone': ['milestone'],
  project: ['project'],
  note: ['note', 'remember', 'remind me', 'idea'],
}

/* Words that name a type outright. If one of these is present the
   classification is not a guess — the user said it. */
const EXPLICIT = {
  habit: /\bhabit\b|\bevery (day|morning|evening|night|week)\b|\beach day\b|\bdaily\b/i,
  assignment: /\bassignment\b|\bhomework\b|\bproblem set\b|\blab report\b/i,
  'project-task': /\bproject task\b|\btask\b|\btodo\b|\bto-do\b/i,
  'goal-milestone': /\bmilestone\b/i,
  project: /\bproject\b/i,
  note: /\bnote\b|\bremember (to|that)\b|\bremind me\b/i,
}

/* Recurrence is what separates a habit from a one-off task. */
const RECURRENCE = /\b(every|each) (day|morning|evening|night|monday|tuesday|wednesday|thursday|friday|saturday|sunday|week)\b|\bdaily\b|\bweekly\b/i

const WEEKDAY_WORD = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3, thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5, saturday: 6, sat: 6,
}

/* ------------------------------------------------------------
   E6 · Relative dates
   Resolved in the user's local timezone through date-fns helpers,
   which build dates from local components — never UTC arithmetic.
   ------------------------------------------------------------ */

const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
}

const NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fourteen: 14, thirty: 30 }

const toInt = (s) => (NUM[String(s).toLowerCase()] != null ? NUM[String(s).toLowerCase()] : Number.parseInt(s, 10))

/**
 * Resolve a relative date phrase against a local `now`.
 * @returns {{date: string|null, matched: string|null, label: string|null,
 *            ambiguous: boolean, note: string|null}}
 * `date` is null whenever the phrase is absent or cannot be resolved
 * honestly — the caller then shows "Not specified".
 */
export function resolveRelativeDate(text, { now = new Date(), weekStartsOn = 1 } = {}) {
  const src = String(text || '')
  const today = dayStr(now)
  const miss = { date: null, matched: null, label: null, ambiguous: false, note: null }
  if (!src.trim()) return miss

  const found = (matched, date, label, extra = {}) => ({
    date, matched, label, ambiguous: false, note: null, ...extra,
  })

  // ISO passthrough — unambiguous by definition.
  const iso = src.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (iso && isValidDayStr(iso[0])) return found(iso[0], iso[0], iso[0])

  // today / tonight
  let m = src.match(/\b(today|tonight)\b/i)
  if (m) return found(m[0], today, 'Today')

  // tomorrow
  m = src.match(/\b(tomorrow|tmrw|tmr)\b/i)
  if (m) return found(m[0], addDaysStr(today, 1), 'Tomorrow')

  // in N days / in N weeks
  m = src.match(/\bin (a|an|\d+|one|two|three|four|five|six|seven|eight|nine|ten|fourteen|thirty) (day|days|week|weeks)\b/i)
  if (m) {
    const n = toInt(m[1])
    if (Number.isFinite(n) && n > 0 && n <= 365) {
      const days = /week/i.test(m[2]) ? n * 7 : n
      return found(m[0], addDaysStr(today, days), `In ${days} day${days === 1 ? '' : 's'}`)
    }
  }

  // next week → the start of the following week (local week start)
  m = src.match(/\bnext week\b/i)
  if (m) {
    const nextWeekStart = weekDays(addDaysStr(today, 7), weekStartsOn)[0]
    return found(m[0], nextWeekStart, 'Next week')
  }

  // this / next / bare weekday
  m = src.match(/\b(this|next|on|by)?\s*(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)\b/i)
  if (m) {
    const qualifier = (m[1] || '').toLowerCase()
    const target = WEEKDAY_WORD[m[2].toLowerCase()]
    const current = weekdayOf(today)
    const delta = (target - current + 7) % 7

    if (qualifier === 'next') {
      // the occurrence inside the FOLLOWING week, never this week's
      const nextWeek = weekDays(addDaysStr(today, 7), weekStartsOn)
      const pick = nextWeek.find((x) => weekdayOf(x) === target)
      return found(m[0], pick, `Next ${m[2][0].toUpperCase()}${m[2].slice(1).toLowerCase()}`)
    }

    if (qualifier === 'this') {
      const thisWeek = weekDays(today, weekStartsOn)
      const pick = thisWeek.find((x) => weekdayOf(x) === target)
      if (pick && pick < today) {
        // Already happened this week. Do not silently mean next week.
        return {
          date: null, matched: m[0], label: null, ambiguous: true,
          note: `“${m[0]}” has already passed this week. Pick the date you mean.`,
        }
      }
      return found(m[0], pick, `This ${m[2][0].toUpperCase()}${m[2].slice(1).toLowerCase()}`)
    }

    // Bare weekday: the nearest occurrence, today included. The resolved
    // date is always shown in the preview, so this is transparent, not hidden.
    return found(m[0], addDaysStr(today, delta), delta === 0 ? 'Today' : m[2][0].toUpperCase() + m[2].slice(1).toLowerCase(),
      { sameDay: delta === 0 })
  }

  // on/by <Month> <day>
  m = src.match(/\b(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i)
  if (m) {
    const month = MONTHS[m[1].toLowerCase()]
    const day = Number.parseInt(m[2], 10)
    if (day >= 1 && day <= 31) {
      const year = now.getFullYear()
      const pad = (n) => String(n).padStart(2, '0')
      const candidate = `${year}-${pad(month)}-${pad(day)}`
      // Roll to next year only when the date has unambiguously passed.
      const final = isValidDayStr(candidate) && candidate >= today ? candidate : `${year + 1}-${pad(month)}-${pad(day)}`
      if (isValidDayStr(final)) return found(m[0], final, m[2] + ' ' + m[1][0].toUpperCase() + m[1].slice(1).toLowerCase())
    }
  }

  return miss
}

/* ------------------------------------------------------------
   E7 · Durations
   Only what was written. "Study DSA" gets no duration at all.
   ------------------------------------------------------------ */

const HOUR_UNITS = /\bhour|hours|hr|hrs|h\b/i
const MIN_UNITS = /\bminute|minutes|min|mins|m\b/i

/**
 * @returns {{minutes: number|null, matched: string|null, label: string|null}}
 */
export function parseDuration(text) {
  const src = String(text || '')
  const miss = { minutes: null, matched: null, label: null }
  if (!src.trim()) return miss

  const label = (mins) => (mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}`)

  // "2h 30m" / "2h30m"
  let m = src.match(/\b(\d+(?:\.\d+)?)\s*(?:hour|hours|hr|hrs|h)\s*(\d+)\s*(?:minute|minutes|min|mins|m)\b/i)
  if (m) {
    const mins = Math.round(Number(m[1]) * 60) + Number(m[2])
    if (Number.isFinite(mins) && mins > 0 && mins <= 24 * 60) return { minutes: mins, matched: m[0], label: label(mins) }
  }

  // "1.5h" / "90 minutes" / "45m" / "2 hours"
  m = src.match(/\b(\d+(?:\.\d+)?)\s*(hour|hours|hr|hrs|h|minute|minutes|min|mins|m)\b/i)
  if (m) {
    const n = Number(m[1])
    const unit = m[2].toLowerCase()
    const isHour = HOUR_UNITS.test(unit) && /^h/.test(unit)
    const isMin = MIN_UNITS.test(unit) && /^m/.test(unit)
    if (isHour || isMin) {
      const mins = Math.round((isHour ? n * 60 : n))
      if (Number.isFinite(mins) && mins > 0 && mins <= 24 * 60) return { minutes: mins, matched: m[0], label: label(mins) }
    }
  }

  // "for half an hour"
  if (/\bhalf an hour\b/i.test(src)) return { minutes: 30, matched: 'half an hour', label: label(30) }
  if (/\ban hour\b/i.test(src)) return { minutes: 60, matched: 'an hour', label: label(60) }

  return miss
}

/* ------------------------------------------------------------
   E3 · Classification
   Scored from evidence, never asserted. Two types close together
   means ASK — that is the whole point of `ambiguous`.
   ------------------------------------------------------------ */

const TYPE_SCORE_THRESHOLD = 1
const TYPE_MARGIN = 1

export function classifyCapture(text, state, { now = new Date() } = {}) {
  const src = String(text || '').toLowerCase()
  const scores = Object.fromEntries(CAPTURE_TYPES.map((t) => [t.id, 0]))
  const evidence = {}
  const add = (id, why) => { scores[id] += 1; (evidence[id] = evidence[id] || []).push(why) }

  // 1. The user named the type. That outranks every heuristic.
  //    "project task" is ONE phrase — matching it must not also count as
  //    naming a project, or every task would look ambiguous.
  const explicit = []
  if (/\bproject task\b/i.test(src)) {
    explicit.push('project-task')
    add('project-task', 'you wrote “project task”')
  } else {
    for (const [id, re] of Object.entries(EXPLICIT)) {
      if (re.test(src)) { explicit.push(id); add(id, `you wrote “${src.match(re)[0]}”`) }
    }
  }

  // 2. Recurrence turns a verb into a habit, whatever else it looks like.
  const recurrence = RECURRENCE.test(src)
  if (recurrence) add('habit', 'it repeats')

  // 3. Keyword evidence.
  for (const [id, words] of Object.entries(WORDS)) {
    for (const w of words) {
      if (id === 'habit' && w === 'habit') continue // already counted as explicit
      if (src.includes(w)) add(id, `“${w}”`)
    }
  }

  // 4. Structure: "task for <project>" is a project task, not a project.
  const hasProjectLink = suggestLinks(src, state, { now }).projects.length > 0
  if (/\b(task|todo|to-do)\b/i.test(src) && hasProjectLink) add('project-task', 'a task against a known project')

  // "project" alone with a build verb leans project; with "task" it does not.
  if (/\b(build|launch|start|create)\b/.test(src) && /\bproject\b/.test(src) && !/\btask\b/.test(src)) add('project', 'you described building it')

  const ranked = Object.entries(scores)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || CAPTURE_TYPES.findIndex((t) => t.id === a[0]) - CAPTURE_TYPES.findIndex((t) => t.id === b[0]))

  if (!ranked.length) {
    return {
      type: null, confidence: CONFIDENCE.UNRESOLVED, candidates: [],
      reason: 'Couldn’t confidently classify this.',
      evidence,
    }
  }

  const [topId, topScore] = ranked[0]
  const second = ranked[1] || null
  const candidates = ranked.slice(0, 3).map(([id]) => id)

  if (explicit.length === 1) {
    return {
      type: explicit[0], confidence: CONFIDENCE.CONFIDENT, candidates: [explicit[0], ...candidates.filter((c) => c !== explicit[0])],
      reason: `You said “${explicit[0].replace('-', ' ')}”.`, evidence,
    }
  }
  if (explicit.length > 1) {
    return {
      type: null, confidence: CONFIDENCE.AMBIGUOUS, candidates: explicit,
      reason: 'You named more than one kind of thing.', evidence,
    }
  }

  if (topScore >= TYPE_SCORE_THRESHOLD && (!second || topScore - second[1] >= TYPE_MARGIN)) {
    return {
      type: topId, confidence: CONFIDENCE.CONFIDENT, candidates: [topId, ...candidates.filter((c) => c !== topId)],
      reason: evidence[topId]?.length ? `Matched ${evidence[topId].join(' and ')}.` : 'Matched on wording.',
      evidence,
    }
  }

  return {
    type: null, confidence: CONFIDENCE.AMBIGUOUS, candidates: candidates.length ? candidates : [topId],
    reason: 'This could be saved more than one way.', evidence,
  }
}

/* ------------------------------------------------------------
   E8 · Linking
   A link is only suggested when the name literally appears. It is
   never applied without the user confirming it.
   ------------------------------------------------------------ */

const nameIn = (text, name) => {
  const n = String(name || '').trim()
  if (n.length < 4) return false // too short to be a reliable match
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(text)
}

export function suggestLinks(text, state, { limit = 3 } = {}) {
  const src = String(text || '')
  const projects = (state?.projects || []).filter((p) => !p.archived && nameIn(src, p.name)).slice(0, limit)
  const goals = (state?.goals || []).filter((g) => !g.archived && nameIn(src, g.title)).slice(0, limit)
  return {
    projects: projects.map((p) => ({ id: p.id, name: p.name })),
    goals: goals.map((g) => ({ id: g.id, name: g.title })),
    any: projects.length > 0 || goals.length > 0,
  }
}

/* ------------------------------------------------------------
   Title extraction — strip what the parser already consumed.
   ------------------------------------------------------------ */

export function extractTitle(text, parsed) {
  let out = String(text || '')
  for (const matched of [parsed.date?.matched, parsed.duration?.matched]) {
    if (!matched) continue
    out = out.replace(new RegExp(matched.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ')
  }
  // leading/trailing connective noise left behind by the removals
  out = out
    .replace(/^\s*(and|then|to|for|by|on|at|in)\s+/i, '')
    .replace(/\s+(by|on|at|for|in)\s*$/i, '')
    .replace(/^\s*(create|add|make|start|new)\s+(a|an|the)?\s*/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return out.replace(/\s*[.,;:!?]+$/, '')
}

/* ------------------------------------------------------------
   The one entry point.
   ------------------------------------------------------------ */

export function parseCapture(text, state = {}, { now = new Date(), weekStartsOn = 1 } = {}) {
  const raw = String(text || '').trim()
  if (!raw) {
    return {
      ok: false, raw, title: '', type: null, confidence: CONFIDENCE.UNRESOLVED, candidates: [],
      defaulted: false,
      date: { date: null, matched: null, label: null, ambiguous: false, note: null },
      duration: { minutes: null, matched: null, label: null },
      links: { projects: [], goals: [], any: false },
      reason: 'Type what you need to do.',
      evidence: {},
    }
  }

  const date = resolveRelativeDate(raw, { now, weekStartsOn })
  const duration = parseDuration(raw)
  let classification = classifyCapture(raw, state, { now })
  const links = suggestLinks(raw, state)
  const title = extractTitle(raw, { date, duration })

  /* Deterministic fallback, not a guess: a one-off thing that carries a
     deadline and never repeats is an assignment in this product. The rule
     is stated out loud and the preview offers it as a *suggestion* the
     user confirms or changes — `defaulted` is what tells the UI to say
     "Suggested" instead of "Detected". */
  let defaulted = false
  if (classification.confidence === CONFIDENCE.UNRESOLVED && date.date && !date.ambiguous) {
    classification = {
      ...classification,
      type: 'assignment',
      confidence: CONFIDENCE.CONFIDENT,
      candidates: ['assignment', 'project-task', 'note'],
      reason: 'It has a deadline and does not repeat, so an assignment is suggested. Change it if that is wrong.',
    }
    defaulted = true
  }

  return {
    ok: Boolean(title),
    raw,
    title,
    type: classification.type,
    confidence: date.ambiguous ? CONFIDENCE.AMBIGUOUS : classification.confidence,
    defaulted,
    candidates: classification.candidates,
    reason: date.ambiguous ? date.note : classification.reason,
    evidence: classification.evidence,
    date,
    duration,
    links,
  }
}

/* ------------------------------------------------------------
   E25 · Validation — the last gate before anything is created.
   ------------------------------------------------------------ */

export function validateCapture(draft) {
  const errors = []
  const title = String(draft?.title || '').trim()

  if (!title) errors.push({ field: 'title', message: 'Give it a name.' })
  else if (title.length > 200) errors.push({ field: 'title', message: 'That name is too long (200 characters max).' })

  if (draft?.deadline && !isValidDayStr(String(draft.deadline).slice(0, 10))) {
    errors.push({ field: 'deadline', message: 'That date is not valid.' })
  }
  if (draft?.estimateMin != null && (!Number.isFinite(draft.estimateMin) || draft.estimateMin <= 0)) {
    errors.push({ field: 'estimateMin', message: 'That duration is not valid.' })
  }
  if (!CAPTURE_TYPES.some((t) => t.id === draft?.type)) {
    errors.push({ field: 'type', message: 'Choose what kind of thing this is.' })
  }
  if (draft?.type === 'project-task' && !draft?.projectId) {
    errors.push({ field: 'projectId', message: 'A project task needs a project.' })
  }
  if (draft?.type === 'goal-milestone' && !draft?.goalId) {
    errors.push({ field: 'goalId', message: 'A milestone needs a goal.' })
  }

  return { ok: errors.length === 0, errors }
}

/* ------------------------------------------------------------
   E24 · Duplicate protection
   Warns, never blocks. Legitimate duplicates are the user's call.
   ------------------------------------------------------------ */

const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()

export function detectDuplicate(state, draft, { now = new Date(), days = 14 } = {}) {
  const title = normalize(draft?.title)
  if (!title) return { possible: [], reason: null }
  const cutoff = addDaysStr(dayStr(now), -days)
  const possible = []

  const consider = (kind, name, createdAt, id, href) => {
    if (createdAt && String(createdAt).slice(0, 10) < cutoff) return
    if (normalize(name) !== title) return
    possible.push({ kind, name, id, href })
  }

  for (const h of state?.habits || []) consider('habit', h.name, h.createdAt, h.id, `habits/${h.id}`)
  for (const p of state?.projects || []) consider('project', p.name, p.createdAtDay || p.createdAt, p.id, `projects/${p.id}`)
  for (const a of state?.assignments || []) consider('assignment', a.name, a.createdAtDay || a.createdAt, a.id, `assignments/${a.id}`)
  for (const g of state?.goals || []) consider('goal', g.title, g.createdAt, g.id, `goals/${g.id}`)

  return {
    possible,
    reason: possible.length
      ? `You already have ${possible.length} thing${possible.length === 1 ? '' : 's'} with this name. Creating it again is fine — just check first.`
      : null,
  }
}

/* ------------------------------------------------------------
   Turning a confirmed draft into a store action.

   Ids are minted by the caller (store exports `newId`) so the UI can
   still offer "add to today's plan" for the exact object it created.
   ------------------------------------------------------------ */

export function captureToAction(draft, { id, existingNote = null } = {}) {
  const title = String(draft.title || '').trim()
  const deadline = draft.deadline ? `${String(draft.deadline).slice(0, 10)}T18:00` : null
  const estimateMin = draft.estimateMin ?? null

  switch (draft.type) {
    case 'habit':
      return { type: 'ADD_HABIT', habit: { id, name: title, notes: draft.note || '', schedule: draft.schedule || { type: 'daily' } }, created: { kind: 'habit', id, name: title } }
    case 'assignment':
      return { type: 'ADD_ASSIGNMENT', assignment: { id, name: title, deadline, estimateMin, priority: draft.priority || 'normal', projectId: draft.projectId || null, notes: draft.note || '' }, created: { kind: 'assignment', id, name: title } }
    case 'project':
      return { type: 'ADD_PROJECT', project: { id, name: title, deadline, estimateMin, notes: draft.note || '' }, created: { kind: 'project', id, name: title } }
    case 'project-task':
      return { type: 'ADD_TASK', projectId: draft.projectId, milestoneId: draft.milestoneId, name: title, due: deadline ? deadline.slice(0, 10) : null, estimateMin, created: { kind: 'project-task', id: draft.projectId, name: title } }
    case 'goal-milestone':
      return { type: 'ADD_GOAL_MILESTONE', id: draft.goalId, milestone: { name: title, targetDate: deadline ? deadline.slice(0, 10) : null }, created: { kind: 'goal-milestone', id: draft.goalId, name: title } }
    case 'note': {
      /* Append, never overwrite: today may already hold a reflection the
         user wrote by hand. */
      const note = existingNote ? `${existingNote}\n${title}` : title
      return { type: 'SET_MOOD', date: dayStr(new Date()), patch: { note }, created: { kind: 'note', id: null, name: title }, isNote: true }
    }
    default:
      return null
  }
}
