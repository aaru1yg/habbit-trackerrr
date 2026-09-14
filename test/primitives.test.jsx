import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Surface, Button, IconButton, Text, Stack, Row, Cluster, Divider,
  Badge, Status, Progress, Metric, Loading, EmptyState, Callout,
} from '../src/components/primitives/index.js'

describe('Surface', () => {
  it('renders base variant without bg/border', () => {
    render(<Surface data-testid="s">hello</Surface>)
    expect(screen.getByTestId('s').className).toMatch(/p-surface/)
    expect(screen.getByTestId('s').className).not.toMatch(/p-surface--raised/)
  })
  it('applies raised variant class', () => {
    render(<Surface variant="raised" data-testid="s">x</Surface>)
    expect(screen.getByTestId('s').className).toMatch(/p-surface--raised/)
  })
})

describe('Button', () => {
  it('renders primary with label', () => {
    render(<Button variant="primary">Go</Button>)
    expect(screen.getByRole('button', { name: 'Go' })).toBeTruthy()
  })
  it('disables and marks aria-busy when loading', () => {
    render(<Button loading>Saving</Button>)
    const b = screen.getByRole('button')
    expect(b.disabled).toBe(true)
    expect(b.getAttribute('aria-busy')).toBe('true')
  })
  it('fires click when enabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Tap</Button>)
    await user.click(screen.getByRole('button', { name: 'Tap' }))
    expect(onClick).toHaveBeenCalled()
  })
  it('does not fire when disabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Tap</Button>)
    await user.click(screen.getByRole('button', { name: 'Tap' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('IconButton', () => {
  it('requires an accessible label', () => {
    render(<IconButton label="Search" icon={<span data-testid="i">s</span>} />)
    expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy()
  })
  it('renders aria-pressed when active', () => {
    render(<IconButton label="Fav" active icon={<span />} />)
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true')
  })
})

describe('Text', () => {
  it('renders h1 tag for level h1', () => {
    render(<Text level="h1">Hello</Text>)
    expect(screen.getByRole('heading', { level: 1, name: 'Hello' })).toBeTruthy()
  })
  it('renders metric', () => {
    const { container } = render(<Text level="metric">87%</Text>)
    expect(container.querySelector('.p-metric__value')).toBeTruthy()
  })
})

describe('Stack/Row/Cluster', () => {
  it('Stack renders children with gap class', () => {
    render(<Stack gap="compact" data-testid="s"><span>a</span><span>b</span></Stack>)
    expect(screen.getByTestId('s').className).toMatch(/p-gap-compact/)
  })
  it('Row applies align between', () => {
    render(<Row align="between" data-testid="r"><span>a</span><span>b</span></Row>)
    expect(screen.getByTestId('r').className).toMatch(/p-row--between/)
  })
  it('Cluster renders wrapping inline group', () => {
    render(<Cluster data-testid="c"><span>a</span><span>b</span></Cluster>)
    expect(screen.getByTestId('c').className).toMatch(/p-cluster/)
  })
})

describe('Divider', () => {
  it('renders hr with aria orientation', () => {
    render(<Divider />)
    expect(screen.getByRole('separator').getAttribute('aria-orientation')).toBe('horizontal')
  })
})

describe('Badge/Status', () => {
  it('renders success badge', () => {
    render(<Badge tone="success">ok</Badge>)
    expect(screen.getByText('ok').className).toMatch(/p-badge--success/)
  })
  it('status renders dot + label', () => {
    render(<Status tone="warning">due soon</Status>)
    const el = screen.getByText('due soon').closest('.p-status')
    expect(el.className).toMatch(/p-status--warning/)
    expect(el.querySelector('.p-status__dot')).toBeTruthy()
  })
})

describe('Progress', () => {
  it('sets aria-valuenow for determinate', () => {
    render(<Progress value={42} label="completion" />)
    const p = screen.getByRole('progressbar', { name: 'completion' })
    expect(p.getAttribute('aria-valuenow')).toBe('42')
  })
  it('renders indeterminate without valueNow', () => {
    render(<Progress indeterminate label="loading" />)
    const p = screen.getByRole('progressbar', { name: 'loading' })
    expect(p.getAttribute('aria-valuenow')).toBeNull()
    expect(p.className).toMatch(/p-progress--indeterminate/)
  })
})

describe('Metric', () => {
  it('renders value + label', () => {
    render(<Metric value="12" label="Open goals" context="2 at risk" />)
    expect(screen.getByText('12')).toBeTruthy()
    expect(screen.getByText('Open goals')).toBeTruthy()
    expect(screen.getByText('2 at risk')).toBeTruthy()
  })
})

describe('Loading', () => {
  it('skeleton has aria-busy', () => {
    render(<Loading shape="text" width="80%" label="Loading" />)
    const s = screen.getByRole('status')
    expect(s.getAttribute('aria-busy')).toBe('true')
  })
  it('spinner uses role status', () => {
    render(<Loading variant="spinner" label="loading" />)
    expect(screen.getByRole('status', { name: 'loading' })).toBeTruthy()
  })
})

describe('EmptyState', () => {
  it('renders title/desc/action', () => {
    render(<EmptyState title="Empty" action={<Button>Add</Button>}>desc</EmptyState>)
    expect(screen.getByText('Empty')).toBeTruthy()
    expect(screen.getByText('desc')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add' })).toBeTruthy()
  })
})

describe('Callout', () => {
  it('renders polite status by default', () => {
    render(<Callout tone="success" title="Done">ok</Callout>)
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText('Done')).toBeTruthy()
  })
})
