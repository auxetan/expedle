import { useState } from 'react'
import { dailyResult, playStats } from '../lib/stats'
import { load, save, weekKey } from '../lib/util'
import Logo from '../ui/Logo'
import './hub.css'

interface Game {
  href: string
  title: string
  tagline: string
  rhythm: 'quotidien' | 'hebdo' | 'libre'
  dailyId?: string
  weekly?: boolean
}

const SECTIONS: { label: string; games: Game[] }[] = [
  {
    label: 'Géographie',
    games: [
      { href: '#/itineraire', title: 'Itinéraire', tagline: 'Relier deux pays par la terre', rhythm: 'quotidien', dailyId: 'itineraire' },
      { href: '#/itineraire/hebdo', title: 'Itinéraire long', tagline: 'Un trajet plus long, chaque lundi', rhythm: 'hebdo', dailyId: 'itineraire-hebdo', weekly: true },
      { href: '#/itineraire/usa', title: 'Itinéraire : États-Unis', tagline: 'D’un État américain à l’autre', rhythm: 'quotidien', dailyId: 'itineraire-usa' },
      { href: '#/classement', title: 'Classement', tagline: 'Placer chaque pays là où il est le mieux classé', rhythm: 'quotidien', dailyId: 'classement-jour' },
      { href: '#/cartographe', title: 'Cartographe', tagline: 'Situer pays, capitales et drapeaux sur la carte', rhythm: 'libre' },
    ],
  },
  {
    label: 'Estimation',
    games: [
      { href: '#/echelle', title: 'À l’échelle', tagline: 'Redimensionner une silhouette à sa taille réelle', rhythm: 'quotidien', dailyId: 'echelle-objets' },
      { href: '#/echelle/geo', title: 'À l’échelle : Géographie', tagline: 'Comparer la taille réelle des territoires', rhythm: 'quotidien', dailyId: 'echelle-geo' },
      { href: '#/echelle/1000', title: 'Le 1 000 de la semaine', tagline: 'Dix manches sur un thème', rhythm: 'hebdo', dailyId: 'echelle-1000', weekly: true },
      { href: '#/balance', title: 'La Balance', tagline: 'Équilibrer avec le bon nombre d’objets', rhythm: 'quotidien', dailyId: 'balance' },
      { href: '#/question', title: 'Question du jour', tagline: 'Une question, une estimation', rhythm: 'quotidien', dailyId: 'question' },
      { href: '#/survie', title: 'Survie', tagline: 'Estimer vite, rester en vie', rhythm: 'libre' },
    ],
  },
  {
    label: 'Culture générale',
    games: [
      { href: '#/quiz/jour', title: 'Quiz du jour', tagline: 'Dix questions, les mêmes pour tous', rhythm: 'quotidien', dailyId: 'quiz-jour' },
      { href: '#/quiz', title: 'Quiz', tagline: 'Toutes les catégories, en continu', rhythm: 'libre' },
      { href: '#/quiz/drapeaux', title: 'Drapeaux', tagline: 'Reconnaître un pays à son drapeau', rhythm: 'libre' },
      { href: '#/quiz/capitales', title: 'Capitales', tagline: 'Associer chaque pays à sa capitale', rhythm: 'libre' },
    ],
  },
]

type Theme = 'sombre' | 'clair'

export default function Hub() {
  const [theme, setTheme] = useState<Theme>(() => load<Theme>('theme', 'sombre'))
  const { total, streak } = playStats()
  const longDate = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const today = longDate.charAt(0).toUpperCase() + longDate.slice(1)
  const all = SECTIONS.flatMap((s) => s.games).filter((g) => g.rhythm === 'quotidien')
  const doneToday = all.filter((g) => g.dailyId && dailyResult(g.dailyId) !== null).length

  function toggleTheme() {
    const next = theme === 'sombre' ? 'clair' : 'sombre'
    setTheme(next)
    save('theme', next)
  }

  return (
    <div className={`home home-${theme}`}>
      <header className="home-head">
        <div className="home-brand">
          <Logo />
          <span>méridien</span>
        </div>
        <button className="home-theme" onClick={toggleTheme} aria-label="Changer de thème">
          {theme === 'sombre' ? '☀' : '☾'}
        </button>
      </header>

      <main className="home-main">
        <section className="home-intro">
          <h1>
            Jeux de géographie,
            <br />
            d’estimation et de culture générale.
          </h1>
          <p className="home-date">{today}</p>
          <dl className="home-stats">
            <div>
              <dt>Jeux du jour</dt>
              <dd>
                {doneToday}/{all.length}
              </dd>
            </div>
            <div>
              <dt>Série</dt>
              <dd>{streak} j</dd>
            </div>
            <div>
              <dt>Parties</dt>
              <dd>{total}</dd>
            </div>
          </dl>
        </section>

        {SECTIONS.map((section) => (
          <section key={section.label} className="home-section">
            <h2>{section.label}</h2>
            <ul>
              {section.games.map((g) => {
                const done = g.dailyId ? dailyResult(g.dailyId, g.weekly ? weekKey() : undefined) !== null : false
                return (
                  <li key={g.href}>
                    <a href={g.href} className="home-row">
                      <span className="home-row-title">{g.title}</span>
                      <span className="home-row-tag">{g.tagline}</span>
                      <span className={done ? 'home-row-state done' : 'home-row-state'}>{done ? '✓ joué' : g.rhythm}</span>
                      <span className="home-row-arrow" aria-hidden>
                        →
                      </span>
                    </a>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </main>

      <footer className="home-foot">méridien · les jeux du jour changent à minuit</footer>
    </div>
  )
}
