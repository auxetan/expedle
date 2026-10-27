// Fin de partie : le jeu à enchaîner, d'un geste (ou d'Entrée). Le programme du jour avance d'un point, et une seule
// accroche dit ce que la suite peut rapporter : le combo en cours, sinon la quête la plus proche d'être remplie.
import { useEffect, useMemo, useState } from 'react'
import { t } from '../lib/i18n'
import { closestQuest } from '../lib/quests'
import { plays, PLAYED } from '../lib/stats'
import { dailyProgram, nextGame, playIds, PROGRAM_SIZE } from '../lib/suggest'
import { comboNow } from '../lib/wallet'
import GameIcon from './GameIcon'
import { ALL_GAMES, rubriqueOf } from './games'
import { isDoneToday } from './Panels'
import { Pepites, useFlying } from './Pepites'
import './nextgame.css'

export default function NextGame() {
  const [now] = useState(Date.now)
  // relu à chaque partie enregistrée, et une fois le moment de victoire passé
  const [version, setVersion] = useState(0)
  const ready = useFlying() === 0

  useEffect(() => {
    const refresh = () => setVersion((v) => v + 1)
    window.addEventListener(PLAYED, refresh)
    return () => window.removeEventListener(PLAYED, refresh)
  }, [])

  const { program, next, last, combo, quest } = useMemo(() => {
    const history = plays()
    return {
      program: dailyProgram(ALL_GAMES, history, isDoneToday, now),
      next: nextGame(ALL_GAMES, history, isDoneToday, now),
      last: history.at(-1),
      combo: comboNow(history, now),
      quest: closestQuest(history),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ready, now])

  useEffect(() => {
    if (!ready || !next) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && document.activeElement === document.body) window.location.hash = next.game.href
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ready, next])

  if (!next) return null
  const done = program.filter(isDoneToday).length

  return (
    <a href={next.game.href} className={ready ? 'ng ready' : 'ng'} data-tint={rubriqueOf(next.game.href)?.tint}>
      <span className="ng-head">
        <span>{done === PROGRAM_SIZE ? t('Programme du jour terminé') : t('Ton programme du jour')}</span>
        <span className="ng-dots" role="img" aria-label={`${done}/${PROGRAM_SIZE}`}>
          {program.map((g) => (
            <i key={g.href} className={[isDoneToday(g) && 'on', last && playIds(g).includes(last.g) && 'just'].filter(Boolean).join(' ')} />
          ))}
        </span>
      </span>
      <span className="ng-main">
        <GameIcon icon={next.game.icon} size={52} />
        <span className="ng-text">
          <small>{t('Jeu suivant')}</small>
          <b>{t(next.game.title)}</b>
        </span>
        <span className="ng-go" aria-hidden>
          →
        </span>
      </span>
      {combo.next > 0 ? (
        <span className="ng-hook combo">
          {t('Prochaine victoire : combo ×{n}', { n: combo.combo + 1 })} <Pepites n={combo.next} />
        </span>
      ) : (
        quest && (
          <span className="ng-hook">
            <span className="ng-quest">{t(quest.quest.text, quest.quest.id.startsWith('jeu:') ? { game: t(String(quest.quest.params.game)) } : quest.quest.params)}</span>
            <span className="ng-bar">
              <i style={{ width: `${(quest.done / quest.quest.goal) * 100}%` }} />
            </span>
            <small>
              {quest.done}/{quest.quest.goal}
            </small>
            <Pepites n={quest.quest.reward} />
          </span>
        )
      )}
    </a>
  )
}
