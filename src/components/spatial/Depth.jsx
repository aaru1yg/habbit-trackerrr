/* ============================================================
   SPATIAL PRIMITIVES — the reusable depth vocabulary (spec §18).

   Screens compose with these; no screen re-implements a camera,
   a tilt or a z-plane. Layer 2 of the V4 architecture: pure CSS
   3D driven by custom properties, zero WebGL dependency, and a
   complete static composition when motion/capability say stop.

   SpatialStage  perspective container + camera rig (--cam-*)
   DepthLayer    places children at a named z (--z token)
   SpatialPanel  a glass surface that lives inside a stage
   DepthCard     TiltCard lineage + depth + entry: the hero of cards
   SpatialStack  a vertical composition whose items alternate depth
   ============================================================ */
import { useRef } from 'react'
import { useCameraRig } from '../../lib/spatial.js'
import { getCapability, prefersReducedMotion } from '../../lib/capability.js'
import TiltCard from '../motion/TiltCard.jsx'

export function SpatialStage({
  as: Tag = 'div',
  parallax = 12,
  scroll = true,
  focus = 1400,           /* perspective distance in px — smaller = more dramatic */
  className = '',
  style,
  children,
  ...rest
}) {
  const ref = useRef(null)
  useCameraRig(ref, { parallax, scroll })
  return (
    <Tag
      ref={ref}
      className={`sp-stage ${className}`.trim()}
      style={{ '--sp-focus': `${focus}px`, ...style }}
      {...rest}
    >
      <div className="sp-cam">{children}</div>
    </Tag>
  )
}

/** z: 0..4 — how far forward this layer sits; par: 0..3 travel factor. */
export function DepthLayer({ z = 1, par = 0, className = '', style, as: Tag = 'div', ...rest }) {
  return (
    <Tag
      className={`sp-depth ${className}`.trim()}
      data-z={z}
      data-par={par}
      style={style}
      {...rest}
    />
  )
}

/** A panel surface that tilts toward the pointer and rests with depth. */
export function SpatialPanel({
  depth = 1,
  tilt = true,
  className = '',
  style,
  children,
  as: Tag = 'div',
  ...rest
}) {
  const useTilt = tilt && !getCapability().touch && getCapability().tier !== 'low' && !prefersReducedMotion()
  const Comp = useTilt ? TiltCard : Tag
  return (
    <Comp
      as={useTilt ? Tag : undefined}
      max={useTilt ? 4 : undefined}
      data-sp-panel
      data-depth={depth}
      className={`sp-panel${useTilt ? '' : ' sp-panel-static'} ${className}`.trim()}
      style={style}
      {...rest}
    >
      {children}
      {useTilt && <span className="sp-panel-sheen" aria-hidden="true" />}
    </Comp>
  )
}

/**
 * DepthCard — the single "spatial surface" every V4 composition uses.
 * Wraps the content in a tilting, depth-sorted card. It is presentational:
 * children keep full semantics (article/section whatever the screen chose).
 */
export function DepthCard({
  as: Tag = 'div',
  depth = 1,
  max = 4.5,
  sheen = true,
  className = '',
  style,
  children,
  ...rest
}) {
  return (
    <TiltCard
      as={Tag}
      max={max}
      sheen={false}
      className={`sp-card ${className}`.trim()}
      data-depth={depth}
      style={style}
      {...rest}
    >
      {children}
      {sheen && <span className="sp-card-sheen" aria-hidden="true" />}
    </TiltCard>
  )
}

/**
 * SpatialStack — children of a stack gain alternating z + slight yaw so
 * a list reads as a shallow corridor of planes rather than a flat column.
 * On mobile / touch / low tier the composition relaxes to a normal list
 * via CSS (--sp-k collapses), never via hidden content.
 */
export function SpatialStack({ as: Tag = 'ul', className = '', gap = 0, children, ...rest }) {
  return (
    <Tag
      className={`sp-stack ${className}`.trim()}
      data-gap={gap || undefined}
      style={gap ? { '--sp-gap': `${gap}px` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  )
}

/** A stack item: assigns its depth lane by index (0..3 cycle). */
export function StackSlot({ index = 0, className = '', children, ...rest }) {
  return (
    <DepthLayer z={(index % 4) + 1} className={`sp-slot ${className}`.trim()} {...rest}>
      {children}
    </DepthLayer>
  )
}
