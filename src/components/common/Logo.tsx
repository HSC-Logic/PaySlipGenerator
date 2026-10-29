/** The Sliply mark: a payment slip with a torn edge and an amber S line, on a teal tile that follows the theme. */
export function Logo({ size = 34 }: { size?: number }) {
  return <svg className="logo" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <rect width="32" height="32" rx="8" style={{ fill: 'var(--logo-tile, #0d5c63)' }} />
    <path fill="#fff" d="M9 5h14v22l-2.33-2.5L18.33 27 16 24.5 13.67 27l-2.34-2.5L9 27z" />
    <path fill="none" stroke="#e8a33d" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" d="M19.2 10.2c-.5-1.3-1.9-2-3.4-2-1.9 0-3.1.9-3.1 2.3 0 3.3 6.7 1.5 6.7 5.3 0 1.5-1.4 2.5-3.5 2.5-1.7 0-3.2-.6-3.8-1.9" />
  </svg>
}
