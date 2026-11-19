/** The brand: a red tile with a white check mark over a stroke, "one more step done". It is also the favicon. */
export function Brand({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <rect x="2" y="2" width="28" height="28" rx="7" fill="var(--accent)" />
      <path
        d="M9 16.5l4.5 4.5L23 11.5"
        stroke="var(--on-accent)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
