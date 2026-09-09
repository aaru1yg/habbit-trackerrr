import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StoreProvider, baseGoal } from '../src/store.jsx'
import { ToastProvider } from '../src/components/ui/Toaster.jsx'
import WorkUIProvider from '../src/components/work/WorkUIProvider.jsx'
import { describeHabit } from '../src/components/habits/habitRowModel.js'
import { HabitRing, HabitCard } from '../src/components/entity/habits.jsx'
import { GoalHealth, GoalProgress, GoalCard } from '../src/components/entity/goals.jsx'
import { WorkStatus, WorkItem, ProjectCard, AssignmentCard, MilestoneRow } from '../src/components/entity/work.jsx'

const TODAY = '2026-09-09'
const habit = {
  id: 'h1', name: 'Read 20 pages', category: 'learning',
  schedule: { type: 'daily' }, archived: false, createdAt: '2026-09-01',
  reminder: null, notes: '', order: 0, accent: '#22d3ee',
}
const state = {
  habits: [habit], checkins: {}, routines: [], projects: [], assignments: [],
  goals: [], moods: {}, preferences: {}, signals: [], focusLog: [],
  profile: { name: '', onboarded: true, theme: 'midnight' },
}

function workWrappers(ui) {
  return render(
    <StoreProvider><ToastProvider><WorkUIProvider>{ui}</WorkUIProvider></ToastProvider></StoreProvider>
  )
}

describe('habit entity', () => {
  it('HabitRing renders sizes and honest null state', () => {
    const { container, rerender } = render(<HabitRing pct={75} size="sm" label="Read: 75 percent" />)
    expect(screen.getByRole('img', { name: 'Read: 75 percent' })).toBeTruthy()
    expect(container.querySelector('.vring').dataset.size).toBe('sm')
    expect(container.querySelectorAll('.vring-bar')).toHaveLength(1)
    rerender(<HabitRing pct={null} size="hero" label="No history" />)
    expect(container.querySelectorAll('.vring-bar')).toHaveLength(0) // track only
  })

  it('HabitCard composes ring + name + status + toggle', () => {
    const onToggle = vi.fn()
    const onDetail = vi.fn()
    const row = describeHabit(state, habit, TODAY)
    expect(row.scheduledToday).toBe(true)
    const { container } = render(
      <HabitCard row={row} weekRate={75} onToggle={onToggle} onDetail={onDetail} />
    )
    expect(screen.getByText('Read 20 pages')).toBeTruthy()
    expect(screen.getByText('Today')).toBeTruthy() // status pill text
    expect(container.querySelector('.vhabit').style.getPropertyValue('--ea-base')).toBe('#22d3ee')
    fireEvent.click(screen.getByRole('button', { name: 'Mark Read 20 pages complete' }))
    expect(onToggle).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Details for Read 20 pages' }))
    expect(onDetail).toHaveBeenCalled()
  })

  it('HabitCard ring opens detail when not scheduled today', () => {
    const onToggle = vi.fn()
    const onDetail = vi.fn()
    const weekend = { ...habit, id: 'h2', schedule: { type: 'weekdays', days: [0] } } // Sunday only
    const row = describeHabit({ ...state, habits: [weekend] }, weekend, TODAY) // a Wednesday
    expect(row.scheduledToday).toBe(false)
    render(<HabitCard row={row} weekRate={null} onToggle={onToggle} onDetail={onDetail} />)
    fireEvent.click(screen.getByRole('button', { name: /not scheduled today/ }))
    expect(onDetail).toHaveBeenCalled()
    expect(onToggle).not.toHaveBeenCalled()
  })
})

describe('goal entity', () => {
  const goal = baseGoal({
    title: 'Run a 10K', targetDate: '2026-10-09',
    milestones: [{ id: 'm1', name: 'Run 5K', targetDate: null, done: false, doneAt: null, order: 0 }],
  })

  it('GoalHealth + GoalProgress render engine truth', () => {
    render(<GoalHealth state={state} goal={goal} now={new Date('2026-09-09T12:00:00')} />)
    expect(screen.getByText(/On track|Safe|At risk/)).toBeTruthy()
    render(<GoalProgress pct={40} detail="2 of 5 milestones" />)
    expect(screen.getByText('40%')).toBeTruthy()
  })

  it('GoalCard reads what → progress → health → next', () => {
    render(<GoalCard state={state} goal={goal} now={new Date('2026-09-09T12:00:00')} />)
    expect(screen.getByText('Run a 10K')).toBeTruthy()
    expect(screen.getByText('Run 5K')).toBeTruthy() // next milestone
  })
})

describe('work entity', () => {
  const row = {
    key: 'assignment:a1', kind: 'assignment', href: 'assignments/a1',
    item: { id: 'a1', name: 'History essay', subject: 'History', deadline: '2026-09-12T23:59:00', subtasks: [] },
    status: { id: 'atRisk', label: 'At risk', tone: 'warn', pct: 40, complete: false },
    risk: 'AT RISK', remainingMin: 120, day: 'Sep 12',
  }

  it('WorkStatus is always text + tone', () => {
    render(<WorkStatus status={row.status} />)
    expect(screen.getByText('At risk')).toBeTruthy()
  })

  it('WorkItem keeps act-without-navigating behaviors', () => {
    workWrappers(<WorkItem row={row} now={new Date('2026-09-09T12:00:00')} />)
    expect(screen.getByRole('article', { name: 'Assignment: History essay' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Focus on History essay' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'View History essay' })).toBeTruthy()
  })

  it('ProjectCard + AssignmentCard render honest counts', () => {
    const { container } = render(
      <ProjectCard project={{ id: 'p1', name: 'Site', milestones: [], accent: '#f472b6' }}
        status={{ id: 'onTrack', label: 'On track', tone: 'good', pct: 0, complete: false, dueText: 'Due Oct 1' }} />
    )
    expect(screen.getByText('No tasks yet · Due Oct 1')).toBeTruthy()
    expect(container.querySelector('.vproj').style.getPropertyValue('--ea-base')).toBe('#f472b6')
    render(
      <AssignmentCard assignment={{ id: 'a1', name: 'Essay', subject: 'Hist', subtasks: [{ id: 's', done: true }] }}
        status={{ id: 'completed', label: 'Completed', tone: 'good', pct: 100, complete: true }} />
    )
    expect(screen.getByText('1 of 1 subtasks')).toBeTruthy()
  })

  it('MilestoneRow toggles with an honest checkbox', () => {
    const onToggle = vi.fn()
    render(<MilestoneRow milestone={{ id: 'm', name: 'Draft', due: '2026-09-10', done: false, tasks: [] }} onToggle={onToggle} />)
    const box = screen.getByRole('checkbox', { name: 'Complete milestone Draft' })
    expect(box).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(box)
    expect(onToggle).toHaveBeenCalled()
  })
})
