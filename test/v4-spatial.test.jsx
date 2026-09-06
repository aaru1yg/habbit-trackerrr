/* V4 spatial screens — gallery / atlas / pressure / collectible
   presentation contracts. These prove the spatial layer renders,
   stays honest to the underlying data, and never hides information
   behind tilt or depth. */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const rectAt = (top = 100, height = 400) => vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
  .mockReturnValue({ width: 1200, height, top, left: 0, bottom: top + height, right: 1200, x: 0, y: top, toJSON: () => {} })

import { StoreProvider } from '../src/store.jsx'
import { ToastProvider } from '../src/components/ui/Toaster.jsx'
import WorkUIProvider from '../src/components/work/WorkUIProvider.jsx'
import ProjectGallery from '../src/components/work/ProjectGallery.jsx'
import { projectStatus } from '../src/lib/work.js'

const day = (offset) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

const project = {
  id: 'p1',
  name: 'Portfolio site',
  category: 'Design',
  priority: 'medium',
  startDate: day(-6),
  deadline: `${day(3)}T18:00`,
  milestones: [
    { id: 'm1', name: 'Plan', tasks: [{ id: 't1', name: 'Outline', done: true }] },
    { id: 'm2', name: 'Build', tasks: [{ id: 't2', name: 'Write', done: false }, { id: 't3', name: 'Deploy', done: false }] },
  ],
  linkedHabitIds: ['h1'],
  createdAtDay: day(-6),
  completedAt: null,
}

function renderGallery() {
  rectAt()
  const now = new Date()
  const rows = [{ project, status: projectStatus(project, now) }]
  return render(
    <StoreProvider>
      <ToastProvider>
        <WorkUIProvider>
          <ProjectGallery rows={rows} now={now} />
        </WorkUIProvider>
      </ToastProvider>
    </StoreProvider>,
  )
}

describe('project gallery (V4 §9)', () => {
  it('renders one semantic list item per row, real data only', () => {
    renderGallery()
    const card = screen.getByRole('listitem')
    expect(card.className).toContain('gal-item')
    expect(screen.getByRole('link', { name: 'Portfolio site' })).toBeTruthy()
    expect(card.textContent).toContain('1 / 3 tasks')
    expect(card.textContent).toContain('Next: Build')
    expect(card.textContent).toContain('1 habit')
    expect(card.textContent).toContain('33%') // honest math: one of three tasks
  })

  it('keeps edit, delete and open reachable for keyboard and AT', () => {
    renderGallery()
    expect(screen.getByRole('button', { name: 'Edit Portfolio site' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete Portfolio site' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open Portfolio site' })).toBeTruthy()
  })

  it('the progress meter carries an aria description of pace', () => {
    renderGallery()
    const meter = screen.getAllByRole('img').find((m) => m.getAttribute('aria-label')?.includes('complete'))
    expect(meter).toBeTruthy()
    expect(meter.getAttribute('aria-label')).toMatch(/33% complete.*pace marker/s)
  })

  it('every plane sits on a named depth lane without hiding content', () => {
    const { container } = renderGallery()
    const depth = container.querySelector('.sp-card[data-depth]')
    expect(depth).toBeTruthy()
    expect(['1', '2', '3', '4']).toContain(depth.dataset.depth)
    expect(depth.textContent).toContain('Portfolio site')
  })

  it('a completed project never fakes a countdown', () => {
    rectAt()
    const done = { ...project, completedAt: day(0), milestones: [{ id: 'm', name: 'x', tasks: [{ id: 't', name: 'a', done: true }] }] }
    const now = new Date()
    render(
      <StoreProvider>
        <ToastProvider>
          <WorkUIProvider>
            <ProjectGallery rows={[{ project: done, status: projectStatus(done, now) }]} now={now} />
          </WorkUIProvider>
        </ToastProvider>
      </StoreProvider>,
    )
    expect(screen.getByText('100%')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/left/) // no phantom countdown
  })
})
