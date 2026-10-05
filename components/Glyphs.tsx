/**
 * Minimal inline icons for the shapes that repeat hundreds of times.
 *
 * Lucide's components render ~340 bytes each — `xmlns`, four sizing attributes,
 * `strokeLinecap`, `strokeLinejoin`, and a wrapper per shape. At ~2,200 of them
 * (Star + Play + Lock on every poster card) that was 742 KB of the document.
 *
 * These are the same geometry inlined, at roughly a quarter of the bytes, with
 * `currentColor` so existing Tailwind colour classes still apply. Lucide stays in
 * use for one-off UI chrome, where the per-instance cost is irrelevant.
 */

type IconProps = {
  className?: string;
  /** Rendered as width/height. Defaults suit the poster card. */
  size?: number;
};

export function PlayGlyph({ className, size = 16 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function StarGlyph({ className, size = 12 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21l1.2-6.8-5-4.9 6.9-1z" />
    </svg>
  );
}

export function LockGlyph({ className, size = 14 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function TvGlyph({ className, size = 32 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      className={className}
    >
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
