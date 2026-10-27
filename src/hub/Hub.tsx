import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import { evaluate, levelOf } from '../lib/achievements'
import { coin } from '../lib/feedback'
import { fmt, locale, ordinal, t, tx } from '../lib/i18n'
import { plays, summarize } from '../lib/stats'
import { dailyProgram, NEW_GAMES, playIds, PROGRAM_SIZE, suggest } from '../lib/suggest'
import { load, save, todayKey, weekKey } from '../lib/util'
import AppBar from '../ui/AppBar'
import { dailyStatus } from '../ui/daily'
import GameIcon from '../ui/GameIcon'
import { ALL_GAMES, familiesOf, GAME_SECTIONS, type GameEntry } from '../ui/games'
import Mascot, { type Mood } from '../ui/Mascot'
import { useWeekRank } from '../ui/useWeekRank'
import { isDoneToday, loadProfile } from '../ui/Panels'
import './hub.css'

function greeting(hour: number): string {
  if (hour < 5) return t('Bonne nuit')
  if (hour < 12) return t('Bonjour')
  if (hour < 18) return t('Bon après-midi')
  return t('Bonsoir')
}

// Ce que l'accueil montrait à la dernière visite : au retour, seul ce qui a bougé depuis s'anime.
interface LastView {
  level: number
  progress: number
  streak: number
  done: string[]
}

const LAST_VIEW = 'accueil-vu'
const CASCADE = 'cg:accueil-cascade'

// un jeu fini l'est pour sa journée, ou pour sa semaine s'il est hebdomadaire
const doneKey = (g: GameEntry) => `${g.href}@${g.weekly ? weekKey() : todayKey()}`

// Le nombre vu la dernière fois sort par le haut, le nouveau entre par le bas.
function Roll({ from, to, delay }: { from?: number; to: number; delay: number }) {
  const [rolling, setRolling] = useState(from !== undefined && from < to)
  if (!rolling) return <>{fmt(to)}</>
  return (
    <span className="home-roll" style={{ '--delay': `${delay}ms` } as CSSProperties} onAnimationEnd={() => setRolling(false)}>
      <span aria-hidden>{fmt(from!)}</span>
      <span>{fmt(to)}</span>
    </span>
  )
}

export default function Hub() {
  const [now] = useState(() => Date.now())
  const history = useMemo(() => plays(), [])
  const { streak } = summarize(history)
  const level = levelOf(history, evaluate(history))
  const progress = level.into / level.need
  const name = loadProfile().name
  const [last] = useState(() => load<LastView | null>(LAST_VIEW, null))
  const [cascade] = useState(() => {
    try {
      return !sessionStorage.getItem(CASCADE)
    } catch {
      return false
    }
  })

  // enregistré une fois les animations posées : un rechargement rapide ne les rejoue pas
  useEffect(() => {
    const done = ALL_GAMES.filter((g) => dailyStatus(g).state === 'done').map(doneKey)
    save(LAST_VIEW, { level: level.level, progress, streak, done } satisfies LastView)
    try {
      sessionStorage.setItem(CASCADE, '1')
    } catch {
      // stockage indisponible : la cascade reviendra à chaque visite
    }
  }, [level.level, progress, streak])

  // le filet repart d'où on l'avait laissé ; un niveau gagné le remplit jusqu'au bout avant de repartir de zéro
  const levelMove = !last || last.level > level.level ? '' : last.level < level.level ? 'up' : last.progress < progress ? 'grow' : ''
  const streakRoll = <Roll from={last?.streak} to={streak} delay={600} />

  const program = useMemo(() => dailyProgram(ALL_GAMES, history, isDoneToday, now), [history, now])
  const programDone = program.filter(isDoneToday).length
  // la prochaine partie : le premier jeu du programme pas encore fait, sinon la meilleure suggestion du moment
  const nextUp = useMemo(() => {
    const picks = suggest(ALL_GAMES, history, isDoneToday, now)
    return picks.find((s) => program.includes(s.game) && !isDoneToday(s.game)) ?? picks[0]
  }, [history, now, program])

  const played = new Set(history.map((p) => p.g))
  const hello = greeting(new Date(now).getHours())
  const [mood, setMood] = useState<Mood>('calme')
  const weekRank = useWeekRank()

  // Pépite sourit et tinte quand on la touche
  function poke() {
    setMood('joie')
    coin(4, true)
    window.setTimeout(() => setMood('calme'), 1400)
  }

  return (
    <div className="home">
      <AppBar home />
      <main className="home-main">
        <section className="home-intro">
          <div className="home-hello">
            <button onClick={poke} aria-label={t('Pépite')}>
              <Mascot mood={mood} size={46} />
            </button>
            <h1>{name ? t('{hello} {name}.', { hello, name }) : `${hello}.`}</h1>
          </div>
          <a href="#/succes" className="home-level" aria-label={t('Niveau {n}, {title} : voir mes succès', { n: level.level, title: t(level.title) })}>
            <b>
              <Roll from={last?.level} to={level.level} delay={1200} />
            </b>
            <span>{t(level.title)}</span>
            <i className={levelMove} style={{ width: `${progress * 100}%`, '--from': `${(last?.progress ?? 0) * 100}%` } as CSSProperties} />
          </a>
          <p>
            {streak > 0 && (
              <>
                {new Intl.PluralRules(locale()).select(streak) === 'one' ? tx('série de {n} jour', { n: streakRoll }) : tx('série de {n} jours', { n: streakRoll })}
                {' · '}
              </>
            )}
            <a href="#/stats">{t('Statistiques')}</a> · <a href="#/passeport">{t('Passeport')}</a> · <a href="#/classements">
              {t('Classements')}
              {weekRank && <small className="home-rank"> {ordinal(weekRank)}</small>}
            </a>{' '}
            ·{' '}
            <a href="#/defis">{t('Défis')}</a>
          </p>
        </section>

        {nextUp && (
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

        <section className="home-program">
            <div className="home-program-head">
              <h2>{t('Ton programme du jour')}</h2>
              <span>
                {programDone}/{PROGRAM_SIZE}
              </span>
            </div>
            <ol className={cascade ? 'home-program-list stagger' : 'home-program-list'}>
              {program.map((g) => {
                const st = dailyStatus(g)
                const justDone = last && st.state === 'done' && !last.done.includes(doneKey(g))
                return (
                  <li key={g.href}>
                    <a href={g.href} className={`home-program-card ${st.state}`}>
                      <GameIcon icon={g.icon} size={36} />
                      <span>
                        <b>{t(g.title)}</b>
                        {st.state === 'done' ? (
                          <small>
                            <span className={justDone ? 'home-tick bounce' : 'home-tick'}>✓</span> {st.label}
                          </small>
                        ) : (
                          <small>{st.label}</small>
                        )}
                      </span>
                    </a>
                  </li>
                )
              })}
            </ol>
          </section>

        {GAME_SECTIONS.map((section) => (
          <section key={section.label} className="home-section" data-tint={section.tint}>
            <h2>{t(section.label)}</h2>
            {familiesOf(section.games).map((f) => (
              <div key={f.family ?? section.label} className="home-family">
                {f.family && <h3>{t(f.family)}</h3>}
                <div className={cascade ? 'home-grid stagger' : 'home-grid'}>
                  {f.games.map((g) => {
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
              </div>
            ))}
          </section>
        ))}
      </main>
    </div>
  )
}
