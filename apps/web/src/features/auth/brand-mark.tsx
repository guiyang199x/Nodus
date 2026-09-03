/**
 * The product mark is three connected nodes, drawn here rather than borrowed
 * from an icon set: the spec forbids substituting Remix Icon for the brand.
 */
import { LOGIN_COPY } from './login-copy';

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className ?? ''}`}>
      <svg width="28" height="28" viewBox="0 0 28 28" role="img" aria-label={LOGIN_COPY.productName}>
        <g stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" fill="none">
          <path d="M8.4 18.6 15.6 8.2" />
          <path d="M8.4 18.6h11.2" />
          <path d="M15.6 8.2 19.6 18.6" />
        </g>
        <circle cx="15.6" cy="7.4" r="3.1" fill="var(--accent)" />
        <circle cx="7.6" cy="19.2" r="3.1" fill="var(--accent)" />
        <circle cx="20.4" cy="19.2" r="2.4" fill="var(--accent)" opacity="0.55" />
      </svg>
      <span className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
        {LOGIN_COPY.productName}
      </span>
    </span>
  );
}
