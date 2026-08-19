/** Inline SVG lock identity: solid (brand seal), outline (dark lock), open (unsealed). */
export function SealMark({
  variant = "solid",
  size = 18,
}: {
  variant?: "solid" | "outline" | "open";
  size?: number;
}) {
  if (variant === "solid") {
    return (
      <svg viewBox="0 0 24 24" fill="none" width={size} height={size} aria-hidden="true">
        <path d="M7 10V7.5a5 5 0 0 1 10 0V10" stroke="currentColor" strokeWidth="2" />
        <rect x="5" y="10" width="14" height="10" rx="3" fill="currentColor" />
      </svg>
    );
  }
  if (variant === "open") {
    return (
      <svg viewBox="0 0 24 24" fill="none" width={size} height={size} aria-hidden="true">
        <path d="M7.5 10V7.5a4.5 4.5 0 0 1 8.8-1.3" stroke="currentColor" strokeWidth="2" />
        <rect x="5" y="10" width="14" height="10" rx="3" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} aria-hidden="true">
      <path d="M7.5 10V7.5a4.5 4.5 0 0 1 9 0V10" stroke="currentColor" strokeWidth="1.8" />
      <rect x="5" y="10" width="14" height="10" rx="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
