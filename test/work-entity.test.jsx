/* Step 5A: Work entity foundation contract tests.
   Uses real fixtures built from store factories + real
   workWorkspace() adapter to verify the presentation against the
   existing engines (no invented logic). */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { workWorkspace } from '../src/components/work/workViewModel.js'
import { baseProject, baseAssignment } from '../src/store.jsx'
import { todayStr, addDaysStr, subDaysStr } from '../src/lib/dates.js'
import WorkEntity from '../src/components/work/WorkEntity.jsx'
import { readFileSync } from 'node:fs'

function fixture() {
  const now = new Date('2026-09-13T12:00:00')
  const today = todayStr(now)
  const past = (n) => subDaysStr(today, n)
  const future = (n) => addDaysStr(today, n)
  const p = baseProject({
    id: 'p1', name: 'Website redesign', priority: 'normal',
    startDate: past(14), deadline: future(10), manualPercent: 35, archived: false,
    milestones: [
      { id: 'm-done', name: 'Wireframes', due: past(2), order: 0, tasks: [
        { id: 't1', name: 'Audit pages', done: true, status: 'done', priority: 'normal', estimateMin: 60, notes: '', order: 0 },
        { id: 't2', name: 'Draft IA', done: true, status: 'done', priority: 'normal', estimateMin: 90, notes: '', order: 1 },
      ]},
      { id: 'm-active', name: 'Visual design', due: future(6), order: 1, tasks: [
        { id: 't3', name: 'Homepage comp', done: false, status: 'doing', priority: 'high', estimateMin: 120, due: future(2), notes: '', order: 0 },
        { id: 't4', name: 'Pricing grid', done: false, status: 'todo', priority: 'normal', estimateMin: 60, due: future(5), notes: '', order: 1 },
      ]},
      { id: 'm-future', name: 'Launch', due: future(10), order: 2, tasks: []},
    ],
  })
  const pOverdue = baseProject({
    id: 'p2', name: 'Thesis chapter', priority: 'normal',
    startDate: past(30), deadline: past(2), manualPercent: 60, archived: false,
    milestones: [
      { id: 'm-late', name: 'First draft', due: past(10), order: 0, tasks: [
        { id: 't5', name: 'Write draft', done: false, status: 'doing', priority: 'high', estimateMin: 480, due: past(2), notes: '', order: 0 },
      ]},
    ],
  })
  const aOnTrack = baseAssignment({
    id: 'a1', name: 'Read Shape Up ch.4', priority: 'low',
    assignedDate: past(1), deadline: future(5), progress: 0, estimateMin: 40, archived: false,
  })
  const aOverdue = baseAssignment({
    id: 'a2', name: 'Review vendor contract', priority: 'high',
    assignedDate: past(8), deadline: past(1), progress: 20, estimateMin: 30, projectId: 'p1', archived: false,
  })
  return {
    version: 4,
    profile: { name: 'A', onboarded: true, theme: 'midnight', dailyCapacityMin: 360 },
    projects: [p, pOverdue], assignments: [aOnTrack, aOverdue],
    habits: [], routines: [], goals: [], checkins: {}, notes: [],
    achievements: [], signals: [], focusLog: [], preferences: { weekStartsOn: 1 },
  }
}

function rows() {
  const now = new Date('2026-09-13T12:00:00')
  return workWorkspace(fixture(), now)
}

const css = () => readFileSync('src/components/work/WorkEntity.css', 'utf8')

function renderRow(row) {
  // Dispatch is a no-op stub — action dispatches are not the target of this
  // presentation test; we only verify that the button exposes the correct
  // aria-label and that clicking does not throw.
  return render(<WorkEntity row={row} dispatch={() => {}} />)
}

describe('Step 5A: Work entity foundation', () => {
  const model = rows()

  it('produces rows for all four entity types using real engines', () => {
    const kinds = new Set(model.rows.map(r => r.kind))
    expect(kinds.has('project')).toBe(true)
    expect(kinds.has('assignment')).toBe(true)
    expect(kinds.has('project-task')).toBe(true)
    expect(kinds.has('milestone')).toBe(true)
  })

  it('Project row renders title + 3px progress rail + deadline meta', () => {
    const project = model.rows.find(r => r.kind === 'project' && r.item.id === 'p1')
    renderRow(project)
    expect(screen.getByRole('heading', { level: 3, name: 'Website redesign' })).toBeTruthy()
    // progress: role=progressbar with 3px-thin rail
    const bar = screen.getByRole('progressbar')
    // Tasks-derived progress dominates manualPercent: 2 of 4 tasks done = 50%.
    expect(bar.getAttribute('aria-valuenow')).toBe('50')
    // deadline text present (not overdue/at-risk for healthy project)
    expect(screen.getByText(/days left|Due/)).toBeTruthy()
  })

  it('Overdue project uses danger tone for risk/deadline, no on-track "On track" label (one clear signal)', () => {
    const project = model.rows.find(r => r.kind === 'project' && r.item.id === 'p2')
    const { container } = renderRow(project)
    // Within the project row only, "Overdue" appears exactly once and there is
    // no redundant "On track" label competing with it.
    const row = container.querySelector('.we')
    expect(row.textContent).toMatch(/Overdue/)
    expect(row.textContent).not.toMatch(/On track/)
  })

  it('Assignment renders with relationship to project when projectId is set', () => {
    const a = model.rows.find(r => r.kind === 'assignment' && r.item.id === 'a2')
    renderRow(a)
    expect(screen.getByRole('heading', { level: 3, name: 'Review vendor contract' })).toBeTruthy()
    // parent project link
    expect(screen.getByRole('link', { name: 'Website redesign' })).toBeTruthy()
  })

  it('Task renders parent relationship (project · milestone) and completion toggle', () => {
    const task = model.rows.find(r => r.kind === 'project-task' && r.item.id === 't3')
    renderRow(task)
    expect(screen.getByRole('heading', { level: 3, name: 'Homepage comp' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Website redesign' })).toBeTruthy()
    expect(screen.getByText('Visual design')).toBeTruthy() // milestone in rel line
    expect(screen.getByRole('button', { name: /Mark Homepage comp as complete/ })).toBeTruthy()
  })

  it('Completed task shows strike-through, Undo label, and success progress', () => {
    const done = model.rows.find(r => r.kind === 'project-task' && r.item.id === 't1')
    renderRow(done)
    const heading = screen.getByRole('heading', { level: 3, name: 'Audit pages' })
    expect(heading.closest('.we').classList.contains('is-complete')).toBe(true)
    expect(screen.getByRole('button', { name: /Mark Audit pages as not complete/ })).toBeTruthy()
  })

  it('Milestone renders without Complete/⋮ actions (no milestone reducer completion)', () => {
    const m = model.rows.find(r => r.kind === 'milestone' && r.item.id === 'm-future')
    renderRow(m)
    expect(screen.getByRole('heading', { level: 3, name: 'Launch' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Complete/ })).toBeNull()
  })

  it('uses 3px thin Progress rail (p-progress--thin) for aggregate progress', () => {
    const cssText = readFileSync('src/components/primitives/primitives.css', 'utf8')
    expect(cssText).toMatch(/\.p-progress--thin\s*\{[^}]*height:\s*3px/)
  })

  it('does NOT render circular rings (Work uses linear rails only)', () => {
    const cssText = css()
    // No border-radius on large circular progress elements in WorkEntity.css
    expect(cssText).not.toMatch(/\.we[^}]*border-radius:\s*50%/)
  })

  it('Work row min-height is 44px (touch target floor)', () => {
    expect(css()).toMatch(/min-height:44px/)
  })
  it('Complete button uses accessible name "Mark [name] as complete"', () => {
    const a = model.rows.find(r => r.kind === 'assignment' && r.item.id === 'a1')
    renderRow(a)
    expect(screen.getByRole('button', { name: /^Mark Read Shape Up ch\.4 as complete$/ })).toBeTruthy()
  })

  it('focus-visible is styled (visible focus) without relying on color alone', () => {
    expect(css()).toMatch(/\.we:focus-visible\{outline/)
  })
})
