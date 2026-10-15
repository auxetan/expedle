export default function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <circle cx="16" cy="16" r="12.5" />
      <path d="M16 3.5c-5 4-5 21 0 25M16 3.5c5 4 5 21 0 25" />
      <path d="M16 3.5v25" strokeWidth="1.4" />
    </svg>
  )
}
