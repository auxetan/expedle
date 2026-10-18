import { useEffect, useMemo, useRef, useState } from 'react'
import { evaluate, levelOf } from '../lib/achievements'
import { cloudEnabled, pointsBoard, useAccount, type PointsRow } from '../lib/cloud'
import { fmt, ordinal, plural, t } from '../lib/i18n'
import { install, useInstall } from '../lib/install'
import { coverage, passport } from '../lib/passport'
import { plays, summarize } from '../lib/stats'
import { dailyProgram, NEW_GAMES, playIds, PROGRAM_SIZE, suggest } from '../lib/suggest'
import { load, normalize, save, todayKey } from '../lib/util'
import AppBar from '../ui/AppBar'
import { confetti } from '../ui/confetti'
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

// Lundi 0 h, heure locale : le début de la ligue de la semaine.
function weekStart(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
}

function ProgramRing({ done, total }: { done: number; total: number }) {
  const r = 30
  const c = 2 * Math.PI * r
  return (
    <div className={done === total ? 'home-ring full' : 'home-ring'} aria-label={t('{done} jeux sur {total} du programme', { done, total })}>
      <svg viewBox="0 0 72 72" aria-hidden>
        <circle cx="36" cy="36" r={r} />
        <circle cx="36" cy="36" r={r} className="fill" style={{ strokeDasharray: `${(c * done) / total} ${c}` }} />
      </svg>
      <b>
        {done}
        <small>/{total}</small>
      </b>
    </div>
  )
}

// La ligue de la semaine : le classement entre amis depuis lundi, pour qui est connecté et a des amis.
function League() {
  const account = useAccount()
  const [rows, setRows] = useState<PointsRow[] | null>(null)
  useEffect(() => {
    if (account.state !== 'in') return
    pointsBoard(weekStart(), true).then(setRows, () => setRows(null))
  }, [account.state])
  if (!cloudEnabled || account.state !== 'in' || !rows || rows.length < 2) return null
  const me = rows.find((r) => r.me)
  const daysLeft = 7 - ((new Date().getDay() + 6) % 7)
  return (
    <a href="#/classements/semaine" className="home-teaser league">
      <span className="home-teaser-glyph">🏆</span>
      <b>{me ? t('{rank} de ta ligue', { rank: ordinal(me.rank) }) : t('Ta ligue de la semaine')}</b>
      <span>
        {rows[0].me ? t('Tu mènes la semaine !') : t('{name} mène avec {n} pts', { name: rows[0].name, n: fmt(rows[0].points) })} ·{' '}
        {plural(daysLeft, 'encore {n} jour', 'encore {n} jours')}
      </span>
    </a>
  )
}

export default function Hub() {
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const history = plays()
  const { total, streak } = summarize(history)
  const level = levelOf(history, evaluate(history))
  const name = loadProfile().name
  const book = passport()
  const stamped = coverage(book)
  const [now] = useState(() => Date.now())
  const installState = useInstall()

  useEffect(() => {
    if (searching) searchRef.current?.focus()
  }, [searching])

  const program = useMemo(() => dailyProgram(ALL_GAMES, history, isDoneToday, now), [history, now])
  const programDone = program.filter(isDoneToday).length
  const picks = useMemo(() => suggest(ALL_GAMES, history, isDoneToday, now), [history, now])
  // la prochaine partie : le premier jeu du programme pas encore fait, sinon la meilleure suggestion du moment
  const nextUp = program.find((g) => !isDoneToday(g)) ? picks.find((s) => program.includes(s.game) && !isDoneToday(s.game))! : picks[0]

  // programme bouclé : une seule fête par jour
  useEffect(() => {
    const key = `programme-fete:${todayKey()}`
    if (programDone === PROGRAM_SIZE && !load(key, false)) {
      save(key, true)
      setTimeout(() => confetti(), 400)
    }
  }, [programDone])

  const dailies = ALL_GAMES.filter((g) => g.rhythm === 'quotidien')
  const doneToday = dailies.filter(isDoneToday).length
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

  return (
    <div className="home">
      <AppBar home tools={search} />
      <main className="home-main">
        <section className="home-hero">
          <div className="home-hero-text">
            <h1>{name ? t('{hello} {name}.', { hello: greeting(new Date(now).getHours()), name }) : `${greeting(new Date(now).getHours())}.`}</h1>
            <div className="home-chips">
              <a href="#/succes" className="home-level" aria-label={t('Niveau {n}, {title} : voir mes succès', { n: level.level, title: t(level.title) })}>
                <b>{level.level}</b>
                <span>{t(level.title)}</span>
                <i style={{ width: `${(level.into / level.need) * 100}%` }} />
              </a>
              <a href="#/stats" className={streak ? 'home-chip streak on' : 'home-chip streak'}>
                <span className="home-flame">🔥</span>
                {streak ? plural(streak, '{n} jour', '{n} jours') : t('Lance ta série')}
              </a>
              <a href="#/passeport" className="home-chip">
                🌍 {plural(stamped.stamped, '{n} pays visité', '{n} pays visités')}
              </a>
            </div>
          </div>
          {!q && <ProgramRing done={programDone} total={PROGRAM_SIZE} />}
        </section>

        {!q && nextUp && (
          <a href={nextUp.game.href} className="home-next" key={nextUp.game.href}>
            <span className="home-next-art">
              <GameIcon icon={nextUp.game.icon} size={92} />
            </span>
            <span className="home-next-text">
              <small>{t('À jouer maintenant')}</small>
              <b>{t(nextUp.game.title)}</b>
              <span>{t(nextUp.game.tagline)}</span>
              <em>{t(nextUp.reason)}</em>
            </span>
            <span className="home-next-go">{t('Jouer')} →</span>
          </a>
        )}

        {!q && (
          <section className="home-program">
            <div className="home-program-head">
              <h2>{t('Ton programme du jour')}</h2>
              <span>{programDone === PROGRAM_SIZE ? t('Bouclé ! Bravo.') : plural(PROGRAM_SIZE - programDone, 'encore {n} jeu', 'encore {n} jeux')}</span>
            </div>
            <ol className="home-program-list stagger">
              {program.map((g) => {
                const st = dailyStatus(g)
                return (
                  <li key={g.href}>
                    <a href={g.href} className={`home-program-card ${st.state}`}>
                      <GameIcon icon={g.icon} size={40} />
                      <span>
                        <b>{t(g.title)}</b>
                        <small>{st.label}</small>
                      </span>
                      <i className="home-check" aria-hidden>
                        {st.state === 'done' ? '✓' : ''}
                      </i>
                    </a>
                  </li>
                )
              })}
            </ol>
          </section>
        )}

        {!q && (
          <section className="home-teasers">
            <a href="#/passeport" className="home-teaser">
              <span className="home-teaser-glyph">🛂</span>
              <b>{t('Passeport')}</b>
              <span>
                {stamped.stamped
                  ? t('{n} pays tamponnés · {pct} du monde', { n: stamped.stamped, pct: fmt(stamped.stamped / stamped.total, { style: 'percent', maximumFractionDigits: 0 }) })
                  : t('Trouve un pays dans un jeu pour ton premier tampon')}
              </span>
            </a>
            <a href="#/defis" className="home-teaser">
              <span className="home-teaser-glyph">⚔️</span>
              <b>{t('Défis entre amis')}</b>
              <span>{t('Rejouez la même partie et comparez')}</span>
            </a>
            <League />
            {installState === 'prompt' && total >= 2 && (
              <button className="home-teaser" onClick={() => void install()}>
                <span className="home-teaser-glyph">📲</span>
                <b>{t('Installer Méridien')}</b>
                <span>{t('Sur ton écran d’accueil, comme une vraie app')}</span>
              </button>
            )}
            <a href="#/classements" className="home-teaser">
              <span className="home-teaser-glyph">📊</span>
              <b>{t('Classements')}</b>
              <span>{plural(total, '{n} partie jouée', '{n} parties jouées')}</span>
            </a>
          </section>
        )}

        {!q && (
          <details className="home-today">
            <summary>
              <span>{t('Tous les jeux du jour')}</span>
              <span className="home-progress" aria-label={t('{done} jeux du jour sur {total}', { done: doneToday, total: dailies.length })}>
                <i style={{ width: `${(doneToday / dailies.length) * 100}%` }} />
              </span>
              <span className="muted">
                {doneToday}/{dailies.length}
              </span>
            </summary>
            <div className="home-today-row">
              {dailies.map((g) => {
                const st = dailyStatus(g)
                return (
                  <a key={g.href} href={g.href} className={`home-today-card ${st.state}`}>
                    <span className="home-today-glyph">
                      <GameIcon icon={g.icon} size={30} />
                    </span>
                    <b>{t(g.title)}</b>
                    <span>{st.state === 'done' ? `✓ ${st.label}` : st.label}</span>
                  </a>
                )
              })}
            </div>
          </details>
        )}

        {sections.length === 0 && <p className="home-empty">{t('Aucun jeu ne correspond à « {query} ».', { query })}</p>}
        {sections.map((section) => (
          <section key={section.label} className="home-section">
            <h2>{t(section.label)}</h2>
            <div className="home-grid">
              {section.games.map((g, i) => {
                const done = isDoneToday(g)
                const fresh = NEW_GAMES.has(g.href) && !playIds(g).some((id) => played.has(id))
                return (
                  <a key={g.href} href={g.href} className="home-card" style={{ animationDelay: `${i * 35}ms` }}>
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
