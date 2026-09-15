# Habit OS — Token system (Step 1A)

Three-tier architecture, loaded in this order (see `src/index.css`):

1. **`primitives.css`** — raw values (type scale, 4px spacing scale, radius,
   borders, motion durations/easings, z-index, breakpoints, focus, touch).
   New UI must NOT reference these directly.
2. **`../tokens.css` (legacy)** — existing V4 palette on `:root`. Loaded next
   so the V4 screens keep rendering pixel-identically until they are
   rebuilt. The legacy file is untouched in Step 1A.
3. **`../themes/_default.css`** — Midnight bridge. Binds the new semantic
   color tokens (`--color-*`, `--chart-*`, `--depth-*`) to the legacy V4
   palette values using `var(--...)`, so no hex values are duplicated and
   the initial CSS stays within budget.
4. **`semantic.css`** — maps intent to value (surfaces, text, borders,
   accents, status, focus, charts, entities, component size placeholders).
5. **`legacy-aliases.css`** — points a small number of legacy short names
   (`--good`, `--warn`, `--font-body`, etc.) at the new semantic tokens so
   any newly-authored style that happens to use an old name still resolves.
   Shrinks as screens are migrated.

## Themes

- Midnight is the default and lives in the initial CSS (`themes/_default.css`).
- Daylight (`themes/daylight.css`) is lazy-loaded by a tiny runtime in
  `src/main.jsx` when `data-theme` is set to `daylight`. Non-default
  themes added later (aurora/ember/verdant) follow the same pattern so
  they don't ship to users who never choose them.

## Category tonal scales

Each category defines only its base hue (`--cat-<area>` already in legacy
tokens). The soft/muted/strong variants are derived via
`color-mix(in oklab, ...)` in `semantic.css`, so themes only need to
override a variant if the default derivation looks wrong.

## Status

- `npm run build` passes, including perf budget (initial CSS 42.5 kB gzip
  against a budget of 44 kB).
- All 887 existing tests pass; the data layer is untouched.
- No screens were redesigned; the V4 UI renders identically to before.
