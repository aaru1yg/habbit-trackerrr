import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button, IconButton, SegControl, Tabs } from '../src/components/ui/controls.jsx'
import { Badge, StatusPill, Metric } from '../src/components/ui/meta.jsx'
import {
  Field, TextInput, SelectInput, Toggle, SearchField, ColorField, FormFooter, describedProps,
} from '../src/components/ui/fields.jsx'
import { Skeleton, LoadingBlock, ErrorNote, InlineEmpty } from '../src/components/ui/feedback.jsx'
import { Tooltip, Popover } from '../src/components/ui/overlays.jsx'

describe('controls', () => {
  it('Button renders variant/size, loading disables with busy state', () => {
    const { rerender } = render(<Button variant="danger" size="lg">Go</Button>)
    const b = screen.getByRole('button', { name: 'Go' })
    expect(b.dataset.variant).toBe('danger')
    expect(b.dataset.size).toBe('lg')
    rerender(<Button loading>Go</Button>)
    const busy = screen.getByRole('button', { name: 'Go' })
    expect(busy).toBeDisabled()
    expect(busy).toHaveAttribute('aria-busy', 'true')
  })

  it('IconButton requires an accessible label', () => {
    render(<IconButton label="Close">×</IconButton>)
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
  })

  it('SegControl is a single-select radiogroup', () => {
    const onChange = vi.fn()
    render(<SegControl label="View" value="a" onChange={onChange}
      options={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]} />)
    expect(screen.getByRole('radiogroup', { name: 'View' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'A' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('radio', { name: 'B' }))
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('Tabs walk with arrow keys and rove tabindex', () => {
    const onChange = vi.fn()
    render(<Tabs label="Sections" value="one" onChange={onChange}
      tabs={[{ id: 'one', label: 'One' }, { id: 'two', label: 'Two' }]} />)
    const one = screen.getByRole('tab', { name: 'One' })
    const two = screen.getByRole('tab', { name: 'Two' })
    expect(one.tabIndex).toBe(0)
    expect(two.tabIndex).toBe(-1)
    fireEvent.keyDown(one, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith('two')
  })
})

describe('meta', () => {
  it('StatusPill always carries its text label (never color-only)', () => {
    render(<StatusPill tone="bad">Overdue</StatusPill>)
    const pill = screen.getByText('Overdue')
    expect(pill.closest('.vstatus').dataset.tone).toBe('bad')
  })

  it('Badge falls back to neutral on unknown tone', () => {
    render(<Badge tone="mystery">Hi</Badge>)
    expect(screen.getByText('Hi').dataset.tone).toBe('neutral')
  })

  it('Metric exposes one text summary', () => {
    render(<Metric label="Completion" value="72%" sub="last 7 days" delta={{ dir: 'up', text: '+5 pts' }} />)
    expect(screen.getByRole('group', { name: 'Completion: 72%, last 7 days, +5 pts' })).toBeTruthy()
  })
})

describe('fields', () => {
  it('Field wires label, hint and error correctly', () => {
    render(
      <Field id="f-name" label="Name" hint="Pick something short" error="Required">
        {({ id, described, invalid }) => <TextInput id={id} aria-describedby={described} aria-invalid={invalid} />}
      </Field>
    )
    expect(screen.getByLabelText('Name')).toBeTruthy()
    expect(screen.getByText('Required')).toHaveAttribute('role', 'alert')
    expect(describedProps({ id: 'x', described: 'h e', invalid: true })['aria-describedby']).toBe('h e')
  })

  it('Toggle is a real switch', () => {
    const onChange = vi.fn()
    render(<Toggle label="Reminders" checked={false} onChange={onChange} />)
    const sw = screen.getByRole('switch', { name: /Reminders/ })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(sw)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('SearchField clears', () => {
    const onChange = vi.fn()
    render(<SearchField label="Search" value="abc" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('ColorField picks presets, auto and custom', () => {
    const onChange = vi.fn()
    render(<ColorField value={null} onChange={onChange} />)
    expect(screen.getByRole('radiogroup', { name: 'Accent color' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Auto (theme accent)' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('radio', { name: 'cyan accent' }))
    expect(onChange).toHaveBeenCalledWith('#22d3ee')
  })

  it('SelectInput and FormFooter render the shared footer pattern', () => {
    const onCancel = vi.fn()
    render(
      <>
        <SelectInput aria-label="Area" value="a" onChange={() => {}} options={[{ value: 'a', label: 'A' }]} />
        <FormFooter onCancel={onCancel} onDelete={() => {}} />
      </>
    )
    expect(screen.getByLabelText('Area')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })
})

describe('feedback', () => {
  it('LoadingBlock labels its region; skeletons are hidden decoration', () => {
    render(<LoadingBlock label="Loading trends"><Skeleton height={20} /></LoadingBlock>)
    expect(screen.getByRole('status', { name: 'Loading trends' })).toBeTruthy()
  })

  it('ErrorNote announces and offers retry', () => {
    const onRetry = vi.fn()
    render(<ErrorNote title="Couldn't save this habit." onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('InlineEmpty carries one action', () => {
    render(<InlineEmpty title="No goals yet" action={<button type="button">Create goal</button>} />)
    expect(screen.getByRole('button', { name: 'Create goal' })).toBeTruthy()
  })
})

describe('overlays', () => {
  it('Tooltip reveals its label on focus', () => {
    render(<Tooltip label="More info"><button type="button">Hover me</button></Tooltip>)
    fireEvent.focus(screen.getByRole('button', { name: 'Hover me' }))
    expect(screen.getByRole('tooltip', { name: 'More info' })).toBeTruthy()
  })

  it('Popover opens and closes with Escape', () => {
    render(<Popover label="Menu" trigger={<button type="button">Open</button>}><button type="button">Item</button></Popover>)
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull()
  })
})
