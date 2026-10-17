import { useEffect, useRef, useState } from 'react'
import { evaluate, levelOf } from '../lib/achievements'
import { plays, summarize } from '../lib/stats'
import { normalize } from '../lib/util'
import AppBar from '../ui/AppBar'
import GameIcon from '../ui/GameIcon'
import { ALL_GAMES, GAME_SECTIONS } from '../ui/games'
import { dailyStatus } from '../ui/daily'
import { Icon, ICONS, isDoneToday, loadProfile } from '../ui/Panels'
import './hub.css'

export default function Hub() {
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const history = plays()
  const { total, streak } = summarize(history)
  const level = levelOf(history, evaluate(history))
  const name = loadProfile().name

  useEffect(() => {
    if (searching) searchRef.current?.focus()
  }, [searching])

  const dailies = ALL_GAMES.filter((g) => g.rhythm === 'quotidien')
  const doneToday = dailies.filter(isDoneToday).length
  const q = normalize(query)
  const sections = GAME_SECTIONS.map((s) => ({
    ...s,
    games: s.games.filter((g) => !q || normalize(`${g.title} ${g.tagline} ${s.label}`).includes(q)),
  })).filter((s) => s.games.length)

  function closeSearch() {
    setSearching(false)
    setQuery('')
  }

  const search = searching ? (
    <div className="home-search">
      <Icon d={ICONS.search} />
      <input
        ref={searchRef}
        value={query}
        placeholder="Rechercher un jeu…"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && closeSearch()}
      />
      <button onClick={closeSearch} aria-label="Fermer la recherche">
        <Icon d={ICONS.close} />
      </button>
    </div>
  ) : (
    <button className="ui-tool" onClick={() => setSearching(true)} aria-label="Rechercher">
      <Icon d={ICONS.search} />
    </button>
  )

  return (
    <div className="home">
      <AppBar home tools={search} />
      <main className="home-main">
        <section className="home-intro">
          <h1>{name ? `Bonjour ${name}.` : 'Bonjour.'}</h1>
          <a href="#/succes" className="home-level" aria-label={`Niveau ${level.level}, ${level.title} : voir mes succès`}>
            <b>{level.level}</b>
            <span>{level.title}</span>
            <i style={{ width: `${(level.into / level.need) * 100}%` }} />
          </a>
          <p>
            {doneToday}/{dailies.length} jeux du jour · série de {streak} jour{streak > 1 ? 's' : ''} · {total} partie{total > 1 ? 's' : ''} ·{' '}
            <a href="#/stats" className="home-stats-link">
              Mes statistiques →
            </a>
          </p>
        </section>

        {!q && (
          <section className="home-today">
            <div className="home-today-head">
              <h2>Aujourd’hui</h2>
              <div className="home-progress" aria-label={`${doneToday} jeux du jour sur ${dailies.length}`}>
                <i style={{ width: `${(doneToday / dailies.length) * 100}%` }} />
              </div>
            </div>
            <div className="home-today-row stagger">
              {dailies.map((g) => {
                const st = dailyStatus(g)
                return (
                  <a key={g.href} href={g.href} className={`home-today-card ${st.state}`}>
                    <span className="home-today-glyph">
                      <GameIcon icon={g.icon} size={30} />
                    </span>
                    <b>{g.title}</b>
                    <span>{st.state === 'done' ? `✓ ${st.label}` : st.label}</span>
                  </a>
                )
              })}
            </div>
          </section>
        )}

        {sections.length === 0 && <p className="home-empty">Aucun jeu ne correspond à « {query} ».</p>}
        {sections.map((section) => (
          <section key={section.label} className="home-section">
            <h2>{section.label}</h2>
            <div className="home-grid">
              {section.games.map((g, i) => {
                const done = isDoneToday(g)
                return (
                  <a key={g.href} href={g.href} className="home-card" style={{ animationDelay: `${i * 35}ms` }}>
                    <span className={done ? 'home-card-state done' : 'home-card-state'}>{done ? '✓ joué' : g.rhythm}</span>
                    <div className="home-card-art">
                      <GameIcon icon={g.icon} size={76} />
                    </div>
                    <div className="home-card-text">
                      <b>{g.title}</b>
                      <span>{g.tagline}</span>
                    </div>
                  </a>
                )
              })}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}
