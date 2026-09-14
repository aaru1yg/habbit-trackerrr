/* ============================================================
   TOKEN MIGRATION MAP
   Legacy token → new semantic token.
   Old names continue to resolve via tokens.css and
   tokens/legacy-aliases.css during the rebuild; once a surface
   is migrated, its styles move to the right-hand side.
   ============================================================

   TYPOGRAPHY
   ------------------------------------------------------------
   --font-body            →  --font-family          (Inter Variable; Manrope removed)
   --font-display         →  --font-family-display
   --font-num             →  --font-family           (with --font-numeric-features tabular)
   --fs-hero              →  --font-metric           (clamp(2.25rem,7vw,4rem))
   --fs-display           →  --font-display          (clamp(1.75rem,3vw,2.25rem))
   --fs-h1                →  --font-h1               (--fs-32 / 2rem)
   --fs-h2                →  --font-h2               (--fs-24 / 1.5rem)
   --fs-h3                →  --font-h3               (--fs-20 / 1.25rem)
   --fs-body              →  --font-body             (--fs-15 / 0.9375rem)
   --fs-sm                →  --font-caption          (--fs-13 / 0.8125rem)
   --fs-xs                →  --font-micro            (--fs-12 / 0.75rem)
   --fs-micro             →  --font-micro            (unchanged)
   --lh-tight             →  --leading-display        (1.15 vs 1.12 — near identical)
   --lh-snug              →  --leading-heading
   --lh-body              →  --leading-body          (1.5 vs 1.55 — slight tightening)
   --tr-display/title     →  --tracking-display / --tracking-heading
   --tr-body              →  --tracking-body
   --tr-caps              →  --tracking-caps
   --fw-regular/medium/... →  (kept; exposed as --weight-*)

   SPACING
   ------------------------------------------------------------
   --sp-1..16 (4px base)  →  kept as primitives (--sp-1..24 now extended to 96px)
   --space-* (8px base)   →  DEPRECATED. Use --sp-* / --space-* semantic instead:
                              --space-micro=4, --space-compact=8, --space-default=16,
                              --space-comfortable=20, --space-section=32, --space-page=48
   --sp-* was already the de-facto scale (used by components.css/work.css),
   so the "legacy 8px aliases" simply retire.

   RADIUS
   ------------------------------------------------------------
   --r-xs (8)             →  --radius-sm             (8, controls)
   --r-sm (12)            →  --radius-md             (12, compact surfaces)
   --r-md (16)            →  --radius-lg             (16, cards)
   --r-lg (22)            →  --radius-xl             (20, large surfaces)
   --r-xl (28) / --r-hero(32) → DEPRECATED. New hero uses --radius-xl (20).
   --r-pill               →  --radius-full (999px)

   COLOR
   ------------------------------------------------------------
   --bg                   →  --bg-base / --color-bg
   --bg-deep              →  --color-bg-deep
   --bg-raise             →  --color-bg-raise
   --surface              →  --surface-raised (note: default surfaces are now transparent/flat;
                              --surface-raised is the explicit elevated surface)
   --surface-solid        →  --surface-raised
   --surface-2 / -3       →  collapse into --surface-raised + --surface-inset hierarchy.
   --surface-inset        →  --surface-inset
   --text                 →  --text-primary / --color-text
   --text-2               →  --text-secondary / --color-text-2
   --text-3               →  --text-muted / --color-text-3
                             (--text-disabled added)
   --border               →  --border-default (color: --color-border)
   --border-2             →  --border-strong (--bw-strong solid --color-border-strong)
   --accent-1 (#7048f5)   →  --accent / --color-accent (#7B5CFF — slight refinement)
   --accent-2             →  --accent-secondary / --color-accent-2 (cyan preserved)
   --accent-soft          →  --accent-soft
   --accent-1-lift        →  --accent-strong
   --accent-ink           →  --text-on-accent (--color-accent-contrast)
   --focus                →  --focus-color / --color-focus
   --good/warn/bad/info   →  --color-success / --color-warning / --color-danger / --color-info
                             (+ -soft variants preserved)
   --track                →  --color-border-subtle
   --scrim                →  --surface-overlay / --color-scrim
   --aurora-* / --noise-* → RETAINED in legacy tokens.css until V4 ambient layers are retired.
                             New system does NOT use them.
   --c1..c8               →  --chart-series-1..8 (identical palette on Midnight; refined for Daylight)
   --seq-0..4             →  --chart-seq-0..4
   --pos/neg              →  --chart-positive / --chart-negative
   --grid                 →  --chart-grid
   --cat-<area>           →  kept; now paired with --cat-<area>-soft/-muted/-strong/-contrast
                             (habit/goal/project tokens derive from these by default)

   ELEVATION
   ------------------------------------------------------------
   --e-1..e-card..e-4     →  --depth-none / --depth-low / --depth-medium / --depth-high
                              Glow/colored shadows removed; shadows use neutral rgb.
   --e-hairline           →  --hairline-highlight (inset 0 1px 0)

   MOTION
   ------------------------------------------------------------
   --dur-1/2/3/4          →  --motion-fast / --motion-normal / --motion-slow
                              (--motion-instant = 0 added)
   --dur-fast/med/slow    →  same mapping
   --ease-out             →  --ease-standard
   --ease-in-out          →  kept (used by legacy); new code uses --ease-enter/exit
   --ease-spring          →  DEPRECATED. Use --ease-emphasized (similar cubic).
   --ease                 →  --ease-standard

   LAYOUT
   ------------------------------------------------------------
   --nav-h (64px)         →  --layout-nav-h (56px — new nav is denser; legacy 64 preserved until shell rebuilt)
   --sidebar-w (258)      →  --layout-sidebar-w (256px; 2px tuck)
   --content-max (1240)   →  --layout-content-max (1200)
   --gutter               →  --layout-page-gutter (16→24 at desktop)

   TOUCH
   ------------------------------------------------------------
   --touch (44)           →  --touch-min (44)

   Z-INDEX
   ------------------------------------------------------------
   (was ad-hoc in components) → --z-base/sticky/header/popover/sheet/dialog/toast

   BORDERS
   ------------------------------------------------------------
   --bd-1/2               →  --bw-subtle/default/strong/focus (1 / 1 / 1.5 / 2)

   OBSOLETE (no new-system equivalent; remove when owning file is rebuilt)
   ------------------------------------------------------------
   --aurora-a/b/c / --aurora-opacity / --noise-opacity
   --shadow-1/2/3 (legacy aliases were unprefixed; folded into depth scale)
   --e-hairline (retained as highlight, not shadow)
   --line / --hairline    → --divider (--border-subtle)
   --r-hero (32)          → removed; replaced by --radius-xl (20)
*/
