import { createElement, forwardRef } from 'react'

const LEVELS = {
  display: { tag: 'h1', className: 'p-display' },
  h1:      { tag: 'h1', className: 'p-h1' },
  h2:      { tag: 'h2', className: 'p-h2' },
  h3:      { tag: 'h3', className: 'p-h3' },
  body:    { tag: 'p',  className: 'p-body' },
  'body-lg':{ tag: 'p', className: 'p-body p-body--lg' },
  label:   { tag: 'span', className: 'p-label' },
  caption: { tag: 'span', className: 'p-caption' },
  micro:   { tag: 'span', className: 'p-micro' },
  metric:  { tag: 'p',  className: 'p-metric__value' },
}

/**
 * Text / Typography primitive.
 *
 * Props:
 *   as?:    tag override (default chosen per level)
 *   level:  'display'|'h1'|'h2'|'h3'|'body'|'body-lg'|'label'|'caption'|'micro'|'metric'
 *
 * All typography goes through Step 1A tokens. Screens don't pick raw sizes.
 */
const Text = forwardRef(function Text({
  as,
  level = 'body',
  className = '',
  children,
  ...rest
}, ref) {
  const spec = LEVELS[level] || LEVELS.body
  const Tag = as || spec.tag
  return createElement(
    Tag,
    { ref, className: `${spec.className} ${className}`.trim(), ...rest },
    children,
  )
})

export default Text
