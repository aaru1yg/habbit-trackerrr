# Habit OS V4 — art direction guide

One sentence: **deep ink space, glass objects, two lights.** Everything else
is derived from that.

## Palette discipline

| Role | Value | Notes |
|---|---|---|
| Canvas | `#0b0f1a` ink-navy | never pure black; scenes are generated over this hex |
| Key light | violet `#7048f5` | one per composition, soft, off-centre |
| Fill light | cyan `#22d3ee` | a quarter-intensity accent, never the hero |
| Surfaces | frosted glass, 4–12 % white | panels, cards, ribbons — matte, never chrome |
| Type | warm white | `--text` token; data numbers in Manrope |

Forbidden: saturated multi-hue gradients, chrome/metal, neon outlines,
starfields, HUD frames, grid floors, lens flares, humans, readable text
inside artwork (art must survive translation and screen readers).

## The four V4 scenes (generated, pipeline-owned)

All four live in `public/art/gen/` as 16:9 masters and are reprocessed by
`node scripts/optimize-art.mjs` (box sizes and quality are declared in its
PLAN — 34 kB of WebP total).

| Asset | Box | Job | Where |
|---|---|---|---|
| `scene-hero` | 1200×675 | the environment promise | auth brand panel, masked, `loading="eager"` (only screen shown pre-login) |
| `scene-gallery` | 960×420 | depth of the projects corridor | gallery backdrop (≥900 px) + projects empty state |
| `scene-data-room` | 840×560 | analytics is a room, not a table | insights hero corner, masked, lazy |
| `scene-constellation` | 840×470 | one goal, many satellites | goal atlas frame backdrop, lazy |

## Integration rules

1. **Art is atmosphere, UI is truth.** Every scene image is `alt=""`,
   `pointer-events:none`, and sits at `z-index` below content with a
   `mask-image` that dissolves the edges into the canvas. Copy contrast is
   never re-tested against the art because the art never sits under copy —
   the mask guarantees it.
2. **Depth via placement, not shadow paint.** Panels float because of
   perspective, tilt and parallax, not because of drop-shadow stacks.
3. **Lazy by default.** Only the auth moment loads art eagerly; everything
   else is `loading="lazy"` + `decoding="async"`.
4. **One family.** New imagery is generated with the same prompt spine
   (deep ink + frosted glass + one violet key light + faint cyan fill +
   negative space) and enters through `optimize-art.mjs`, never by hand.
5. **Empty states stay honest.** Art decorates an empty state; the sentence
   below it still says exactly what is missing.

## Prompt spine (reuse verbatim for consistency)

> Cinematic premium minimal 3D artwork, abstract … environment. Very deep ink
> navy background (#0b0f1a), translucent frosted-glass panels/objects floating
> at different depths in perspective, restrained violet (#7048f5) and faint
> cyan (#22d3ee) volumetric glow, fine dust, matte, quiet, editorial,
> design-studio aesthetic. No text, no letters, no logos, no people, no grid
> floors, no neon cyberpunk. Generous negative space.
