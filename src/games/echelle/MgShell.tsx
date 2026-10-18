import { useState, type ReactNode } from 'react'
import AppBar, { SubLink } from '../../ui/AppBar'
import { msg, t } from '../../lib/i18n'

const SUBNAV: [string, string][] = [
  ['#/estimation', msg('Tous les jeux')],
  ['#/echelle', 'Size It Up'],
  ['#/echelle/pop', 'Pop Culture'],
  ['#/echelle/geo', msg('Géographie')],
  ['#/echelle/1000', 'Weekly 1K'],
  ['#/balance', 'Weigh It Up'],
  ['#/question', 'Daily Question'],
  ['#/survie', 'Survival Mode'],
  ['#/estimation/archive', msg('Archive')],
]

export function MgNav() {
  const current = window.location.hash.split('?')[0]
  return (
    <>
      {SUBNAV.map(([href, label]) => (
        <SubLink key={href} href={href} active={current === href}>
          {t(label)}
        </SubLink>
      ))}
    </>
  )
}

export default function MgShell({ title, help, children }: { title: string; help: ReactNode; children: ReactNode }) {
  const [helpOpen, setHelpOpen] = useState(false)
  return (
    <div className="mg">
      <AppBar title="Magnitudle">
        <MgNav />
      </AppBar>
      <div className="mg-body">
      <header className="mg-head">
        <h1>
          {title}
          <button className="mg-help-btn" onClick={() => setHelpOpen(true)} aria-label={t('Aide')}>
            ?
          </button>
        </h1>
      </header>
      <main className="mg-main">{children}</main>
      <footer className="mg-foot">
        <span className="mg-kicker">MAGNITUDLE · MÉRIDIEN</span>
        <a href="#/estimation">{t('Tous les jeux Magnitudle →')}</a>
      </footer>
      </div>
      {helpOpen && (
        <div className="mg-modal-bg" onClick={() => setHelpOpen(false)}>
          <div className="mg-modal mg-help" onClick={(e) => e.stopPropagation()}>
            <button className="mg-close" onClick={() => setHelpOpen(false)} aria-label={t('Fermer')}>
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
