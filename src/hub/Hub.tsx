import { useEffect, useMemo, useRef, useState } from 'react'
import { evaluate, levelOf } from '../lib/achievements'
import { plural, t } from '../lib/i18n'
import { plays, summarize } from '../lib/stats'
import { dailyProgram, NEW_GAMES, playIds, PROGRAM_SIZE, suggest } from '../lib/suggest'
import { normalize } from '../lib/util'
import AppBar from '../ui/AppBar'
import { dailyStatus } from '../ui/daily'
import GameIcon from '../ui/GameIcon'
import { ALL_GAMES, GAME_SECTIONS } from '../ui/games'
import { Icon, ICONS, isDoneToday, loadProfile } from '../ui/Panels'
import './hub.css'

function greeting(hour: number): string {
  if (hour < 5) return t('Bonne nuit')
  if (hour < 12) return t('Bonjour')
  if (hour < 18) return t('Bon après-midi')
  return t('Bonsoir')
}

export default function Hub() {
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const [now] = useState(() => Date.now())
  const history = useMemo(() => plays(), [])
  const { streak } = summarize(history)
  const level = levelOf(history, evaluate(history))
  const name = loadProfile().name

  useEffect(() => {
    if (searching) searchRef.current?.focus()
  }, [searching])

  const program = useMemo(() => dailyProgram(ALL_GAMES, history, isDoneToday, now), [history, now])
  const programDone = program.filter(isDoneToday).length
  // la prochaine partie : le premier jeu du programme pas encore fait, sinon la meilleure suggestion du moment
  const nextUp = useMemo(() => {
    const picks = suggest(ALL_GAMES, history, isDoneToday, now)
    return picks.find((s) => program.includes(s.game) && !isDoneToday(s.game)) ?? picks[0]
  }, [history, now, program])

  const played = new Set(history.map((p) => p.g))
  const q = normalize(query)
  const sections = GAME_SECTIONS.map((s) => ({
    ...s,
    // la recherche marche dans la langue du site comme en français
    games: s.games.filter((g) => !q || normalize(`${t(g.title)} ${t(g.tagline)} ${t(s.label)} ${g.title} ${g.tagline}`).includes(q)),
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
        placeholder={t('Rechercher un jeu…')}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && closeSearch()}
      />
      <button onClick={closeSearch} aria-label={t('Fermer la recherche')}>
        <Icon d={ICONS.close} />
      </button>
    </div>
  ) : (
    <button className="ui-tool" onClick={() => setSearching(true)} aria-label={t('Rechercher')}>
      <Icon d={ICONS.search} />
    </button>
  )

  const hello = greeting(new Date(now).getHours())

  return (
    <div className="home">
      <AppBar home tools={search} />
      <main className="home-main">
        <section className="home-intro">
          <h1>{name ? t('{hello} {name}.', { hello, name }) : `${hello}.`}</h1>
          <a href="#/succes" className="home-level" aria-label={t('Niveau {n}, {title} : voir mes succès', { n: level.level, title: t(level.title) })}>
            <b>{level.level}</b>
            <span>{t(level.title)}</span>
            <i style={{ width: `${(level.into / level.need) * 100}%` }} />
          </a>
          <p>
            {streak ? `${plural(streak, 'série de {n} jour', 'série de {n} jours')} · ` : ''}
            <a href="#/stats">{t('Statistiques')}</a> · <a href="#/passeport">{t('Passeport')}</a> · <a href="#/classements">{t('Classements')}</a> ·{' '}
            <a href="#/defis">{t('Défis')}</a>
          </p>
        </section>

        {!q && nextUp && (
          <a href={nextUp.game.href} className="home-next">
            <GameIcon icon={nextUp.game.icon} size={64} />
            <span className="home-next-text">
              <small>{t('À jouer maintenant')}</small>
              <b>{t(nextUp.game.title)}</b>
              <span>{t(nextUp.reason)}</span>
            </span>
            <span className="home-next-go" aria-hidden>
              →
            </span>
          </a>
        )}

        {!q && (
          <section className="home-program">
            <div className="home-program-head">
              <h2>{t('Ton programme du jour')}</h2>
              <span>
                {programDone}/{PROGRAM_SIZE}
              </span>
            </div>
            <ol className="home-program-list">
              {program.map((g) => {
                const st = dailyStatus(g)
                return (
                  <li key={g.href}>
                    <a href={g.href} className={`home-program-card ${st.state}`}>
                      <GameIcon icon={g.icon} size={36} />
                      <span>
                        <b>{t(g.title)}</b>
                        <small>{st.state === 'done' ? `✓ ${st.label}` : st.label}</small>
                      </span>
                    </a>
                  </li>
                )
              })}
            </ol>
          </section>
        )}

        {sections.length === 0 && <p className="home-empty">{t('Aucun jeu ne correspond à « {query} ».', { query })}</p>}
        {sections.map((section) => (
          <section key={section.label} className="home-section">
            <h2>{t(section.label)}</h2>
            <div className="home-grid">
              {section.games.map((g) => {
                const done = isDoneToday(g)
                const fresh = NEW_GAMES.has(g.href) && !playIds(g).some((id) => played.has(id))
                return (
                  <a key={g.href} href={g.href} className="home-card">
                    <span className={done ? 'home-card-state done' : fresh ? 'home-card-state new' : 'home-card-state'}>
                      {done ? `✓ ${t('joué')}` : fresh ? t('nouveau') : t(g.rhythm)}
                    </span>
                    <div className="home-card-art">
                      <GameIcon icon={g.icon} size={76} />
                    </div>
                    <div className="home-card-text">
                      <b>{t(g.title)}</b>
                      <span>{t(g.tagline)}</span>
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
