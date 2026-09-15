/**
 * BrandMark — minimal monogram mark (no gradient glow).
 * Sized via the `size` prop so sidebar/top-bar/boot share one mark.
 */
export default function BrandMark({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect x="3" y="3" width="42" height="42" rx="13" fill="var(--accent)" />
      <path
        d="M15 24.5l6 6L34 17"
        stroke="var(--text-on-accent)"
        strokeWidth="4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}
