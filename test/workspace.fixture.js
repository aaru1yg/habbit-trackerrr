import { dayStr, addDaysStr } from '../src/lib/dates.js'
export function workspaceFixture(now = new Date()) {
  const today = dayStr(now)
  const date = offset => `${addDaysStr(today, offset)}T23:59`
  return {
    version: 4,
    profile: { onboarded: true, name: 'Work QA', theme: 'midnight', workReminders: false },
    habits: [], goals: [], checkins: {}, routines: [], moods: {}, notes: [], achievements: [], signals: [], focusLog: [],
    preferences: { dailyCapacityMin: 120 },
    projects: [{ id: 'p1', name: 'Habit OS', startDate: addDaysStr(today, -10), deadline: date(6), estimateMin: 180, category: 'Development', priority: 'normal', updatedAt: now.toISOString(),
      milestones: [{ id: 'm1', name: 'API milestone', due: addDaysStr(today, 2), tasks: [{ id: 't1', name: 'Finish API layer', due: today, estimateMin: 90, done: false }, { id: 't2', name: 'Auth complete', done: true }] }, { id: 'm2', name: 'Research checkpoint', due: addDaysStr(today, 1), tasks: [] }] }],
    assignments: [
      { id: 'a1', name: 'Submit DSA report', projectId: 'p1', assignedDate: addDaysStr(today, -4), deadline: date(0), progress: 20, progressMode: 'explicit', estimateMin: 180, priority: 'high', subtasks: [{ id: 's1', name: 'Proofread results', done: false }] },
      { id: 'a2', name: 'Overdue lab', assignedDate: addDaysStr(today, -9), deadline: date(-1), progress: 50, estimateMin: 60 },
      { id: 'a3', name: 'Tomorrow brief', assignedDate: today, deadline: date(1), progress: 0, estimateMin: 30 },
      { id: 'a4', name: 'Delivered paper', assignedDate: addDaysStr(today, -9), deadline: date(-2), progress: 100, completedAt: now.toISOString() },
      { id: 'a5', name: 'Archived report', deadline: date(0), progress: 0, archived: true },
      { id: 'a6', name: 'Undated work', progress: 0, estimateMin: null },
    ],
  }
}
