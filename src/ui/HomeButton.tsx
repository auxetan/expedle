export default function HomeButton({ className = '', label = true }: { className?: string; label?: boolean }) {
  return (
    <a href="#/" className={`home-btn ${className}`} aria-label="Retour à l’accueil de Méridien" title="Retour à l’accueil">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5.5 9v11h13V9" />
      </svg>
      {label && <span>Accueil</span>}
    </a>
  )
}
