import { useEffect, useState } from 'react'
import { t } from '../lib/i18n'
import { PLAYED, plays, type Play } from '../lib/stats'
import { dailyProgram, playIds, PROGRAM_SIZE, suggest, type Suggestion } from '../lib/suggest'
import { load, save, todayKey } from '../lib/util'
import { confetti } from './confetti'
import GameIcon from './GameIcon'
import { ALL_GAMES } from './games'
import { isDoneToday } from './Panels'
import { feedback } from '../lib/feedback'

// Une belle partie se fête : victoire franche ou score élevé.
const great = (p: Play) => (p.win === true && p.pts >= 60) || (p.win === undefined && p.pts >= 85)

// Après chaque partie, la suivante se propose d'elle-même : on enchaîne sans repasser par l'accueil.
export default function NextUp() {
  const [next, setNext] = useState<{ suggestion: Suggestion; done: number; finished: boolean } | null>(null)

  useEffect(() => {
    let timer = 0
    const onPlayed = (e: Event) => {
      const play = (e as CustomEvent<Play>).detail
      const history = plays()
      const program = dailyProgram(ALL_GAMES, history, isDoneToday)
      const done = program.filter(isDoneToday).length
      // le programme vient d'être bouclé par cette partie
      const key = `programme-fete:${todayKey()}`
      const finished = done === PROGRAM_SIZE && !load(key, false)
      if (finished) save(key, true)
      if (finished || great(play)) setTimeout(() => confetti(finished ? 220 : 120), 600)
      feedback(finished || great(play) ? 'win' : play.win === false || play.pts < 30 ? 'lose' : 'good')
      const pick = suggest(ALL_GAMES, history, isDoneToday).find((s) => !playIds(s.game).includes(play.g))
      clearTimeout(timer)
      // le temps de voir son résultat avant que la suite apparaisse
      if (pick) timer = window.setTimeout(() => setNext({ suggestion: pick, done, finished }), 1800)
    }
    const onRoute = () => {
      clearTimeout(timer)
      setNext(null)
    }
    window.addEventListener(PLAYED, onPlayed)
    window.addEventListener('hashchange', onRoute)
    return () => {
      clearTimeout(timer)
      window.removeEventListener(PLAYED, onPlayed)
      window.removeEventListener('hashchange', onRoute)
    }
  }, [])

  if (!next) return null
  const { suggestion, done, finished } = next
  return (
    <aside className="nextup" role="status">
      <a href={suggestion.game.href} className="nextup-main">
        <GameIcon icon={suggestion.game.icon} size={44} />
        <span className="nextup-text">
          <small>{finished ? t('Programme du jour bouclé ! Et maintenant ?') : t('Et maintenant ?')}</small>
          <b>{t(suggestion.game.title)}</b>
          <span>
            {t(suggestion.reason)} · {t('programme {done}/{total}', { done, total: PROGRAM_SIZE })}
          </span>
        </span>
        <span className="nextup-go">{t('Jouer')} →</span>
      </a>
      <button className="nextup-close" onClick={() => setNext(null)} aria-label={t('Fermer')}>
        ✕
      </button>
    </aside>
  )
}
