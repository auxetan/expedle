import { useEffect, useRef, useState } from 'react'
import { playStats } from '../lib/stats'
import { normalize } from '../lib/util'
import AppBar from '../ui/AppBar'
import { ALL_GAMES, GAME_SECTIONS } from '../ui/games'
import { Icon, ICONS, isDoneToday, loadProfile } from '../ui/Panels'
import './hub.css'

export default function Hub() {
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const { total, streak } = playStats()
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
          <p>
            {doneToday}/{dailies.length} jeux du jour · série de {streak} jour{streak > 1 ? 's' : ''} · {total} partie{total > 1 ? 's' : ''}
          </p>
        </section>

        {sections.length === 0 && <p className="home-empty">Aucun jeu ne correspond à « {query} ».</p>}
        {sections.map((section) => (
          <section key={section.label} className="home-section">
            <h2>{section.label}</h2>
            <div className="home-grid">
              {section.games.map((g) => {
                const done = isDoneToday(g)
                return (
                  <a key={g.href} href={g.href} className="home-card">
                    <span className={done ? 'home-card-state done' : 'home-card-state'}>{done ? '✓ joué' : g.rhythm}</span>
                    <div className="home-card-art">
                      <span className="card-glyph">{g.glyph}</span>
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
