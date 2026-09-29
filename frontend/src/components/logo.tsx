import { cn } from "cn";

/**
 * The app mark: a three-wheeled electric cycle rickshaw in black and white.
 * Same drawing as `app/icon.svg` (the browser tab icon).
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("size-8 shrink-0", className)}
      role="img"
      aria-label="Dhaka Tesla Pool"
    >
      <rect
        x="1"
        y="1"
        width="62"
        height="62"
        rx="14"
        fill="#fff"
        stroke="#0a0a0a"
        strokeWidth="2"
      />
      <ellipse
        cx="50"
        cy="41"
        rx="5"
        ry="7.2"
        fill="#fff"
        stroke="#0a0a0a"
        strokeWidth="2.4"
      />
      <path
        d="M31.5 45 L50 41"
        stroke="#0a0a0a"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M26 34 C26 20 34 11 45 10.5 C51.5 10.2 55.5 13.5 55.5 18.5 V36 L26 38 Z"
        fill="#0a0a0a"
      />
      <path
        d="M30.5 33.8 C31 24.5 36 17.6 43.5 16.4 C47.4 15.8 50 17.4 50.6 20.6 L51 32.2 Z"
        fill="#fff"
      />
      <path d="M32 32.6 L50.5 31 V35 L32 36.6 Z" fill="#0a0a0a" />
      <path d="M44.6 19 41 25h2.6l-1.1 4.2 4.1-6h-2.6z" fill="#0a0a0a" />
      <path d="M25 37.5 L56 35.3 V39 L25 41.2 Z" fill="#0a0a0a" />
      <ellipse
        cx="31.5"
        cy="45"
        rx="6.3"
        ry="8.6"
        fill="#fff"
        stroke="#0a0a0a"
        strokeWidth="2.6"
      />
      <circle cx="31.5" cy="45" r="1.8" fill="#0a0a0a" />
      <g
        fill="none"
        stroke="#0a0a0a"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M13.5 49 L17.5 36.5 H26.5" />
        <path d="M17.5 36.5 L25 43" />
        <path d="M15.8 28.5 L17.5 36.5" />
        <path d="M12.6 28.5 H18.8" />
        <path d="M19.5 34 H24.5" />
      </g>
      <ellipse
        cx="13.5"
        cy="49"
        rx="5"
        ry="7"
        fill="#fff"
        stroke="#0a0a0a"
        strokeWidth="2.4"
      />
      <circle cx="13.5" cy="49" r="1.5" fill="#0a0a0a" />
    </svg>
  );
}
