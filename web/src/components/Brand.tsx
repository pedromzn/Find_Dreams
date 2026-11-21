/**
 * The brand: the MZN Vagas mascot — a chibi girl at her desk, searching jobs in neon red. The same artwork is the app
 * icon (`build/icon.png`, on the macOS grid) and the favicon (`web/public/icon.png`).
 */
export function Brand({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/icon.png"
      width={size}
      height={size}
      alt=""
      aria-hidden
      draggable={false}
      className={`shrink-0 select-none ${className ?? ''}`}
      style={{ width: size, height: size }}
    />
  )
}
