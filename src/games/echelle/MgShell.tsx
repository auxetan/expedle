import { useState, type ReactNode } from 'react'
import HomeButton from '../../ui/HomeButton'

const MENU = [
  ['#/', 'Accueil Méridien'],
  ['#/estimation', 'Magnitudle : tous les jeux'],
  ['#/echelle', 'Size It Up'],
  ['#/echelle/geo', 'Size It Up : Géographie'],
  ['#/echelle/1000', 'The Weekly 1K'],
  ['#/balance', 'Weigh It Up'],
  ['#/question', 'Daily Question'],
  ['#/survie', 'Survival Mode'],
  ['#/estimation/archive', 'Archive'],
]

export default function MgShell({ title, help, children }: { title: string; help: ReactNode; children: ReactNode }) {
  const [helpOpen, setHelpOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  return (
    <div className="mg">
      <div className="mg-top">
        <HomeButton />
        <a href="#/estimation" className="mg-logo" aria-label="Tous les jeux Magnitudle">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />
          </svg>
        </a>
        <button className="mg-burger" onClick={() => setMenu(!menu)} aria-label="Menu">
          ☰
        </button>
        {menu && (
          <nav className="mg-menu" onClick={() => setMenu(false)}>
            {MENU.map(([href, label]) => (
              <a key={href} href={href}>
                {label}
              </a>
            ))}
          </nav>
        )}
      </div>
      <header className="mg-head">
        <h1>
          {title}
          <button className="mg-help-btn" onClick={() => setHelpOpen(true)} aria-label="Aide">
            ?
          </button>
        </h1>
      </header>
      <main className="mg-main">{children}</main>
      <footer className="mg-foot">
        <span className="mg-kicker">UN JEU MAGNITUDLE · MÉRIDIEN</span>
        <a href="#/estimation">← Tous les jeux Magnitudle</a>
      </footer>
      {helpOpen && (
        <div className="mg-modal-bg" onClick={() => setHelpOpen(false)}>
          <div className="mg-modal mg-help" onClick={(e) => e.stopPropagation()}>
            <button className="mg-close" onClick={() => setHelpOpen(false)} aria-label="Fermer">
              ✕
            </button>
            {help}
          </div>
        </div>
      )}
    </div>
  )
}

export function MgHelp({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <>
      <h2>{title}</h2>
      <p className="mg-intro">{intro}</p>
      <div className="mg-steps">{children}</div>
    </>
  )
}

export function HelpStep({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <div className="mg-step">
      <span className="mg-step-n">{n}</span>
      <div>
        <b>{title}</b>
        <p>{children}</p>
      </div>
    </div>
  )
}
