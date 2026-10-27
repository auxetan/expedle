// Fin d'une partie du jour : sa place parmi les joueurs du jour, ce qu'il manque pour passer le joueur juste devant,
// et le podium. Sans compte, une invitation à se connecter pour être classé.
import { useEffect, useState } from 'react'
import { cloudEnabled, dailyBoard, useAccount, whenSynced, type DailyRow } from '../lib/cloud'
import { ordinal, t } from '../lib/i18n'
import { standing, type Standing } from '../lib/ranking'
import { plays } from '../lib/stats'
import { todayKey } from '../lib/util'
import { ALL_GAMES } from './games'
import './rank.css'

// la dernière partie est-elle la partie officielle du jour de ce jeu (ni entraînement, ni défi, ni archive) ?
function isDaily(game: string): boolean {
  const last = plays().at(-1)
  return !!last && last.g === game && !last.sub && todayKey(new Date(last.t)) === todayKey() && ALL_GAMES.some((g) => g.dailyId === game)
}

export default function DailyRank({ game }: { game: string }) {
  const account = useAccount()
  const [daily] = useState(() => isDaily(game))
  const [place, setPlace] = useState<Standing<DailyRow> | null>(null)

  useEffect(() => {
    if (!daily || account.state !== 'in') return
    let alive = true
    whenSynced()
      .then(() => dailyBoard(game, todayKey()))
      .then(
        (rows) => alive && setPlace(standing(rows, (r) => r.pts)),
        () => {},
      )
    return () => {
      alive = false
    }
  }, [daily, account.state, game])

  if (!daily || !cloudEnabled) return null
  if (account.state === 'out')
    return (
      <a href="#/classements" className="dr out">
        {t('Connecte-toi pour te classer parmi les joueurs du jour')}
      </a>
    )
  if (!place) return null
  const { rank, ahead, podium } = place
  return (
    <a href="#/classements" className={`dr${rank <= 3 ? ` top${rank}` : ''}`}>
      <span className="dr-rank">
        <b>{ordinal(rank)}</b>
        <small>{t('du jour')}</small>
      </span>
      <span className="dr-text">
        <span>
          {!ahead
            ? t('Tu mènes le classement du jour')
            : ahead.gap
              ? t('Encore {n} pts pour passer {rank}', { n: ahead.gap, rank: ordinal(ahead.rank) })
              : t('À égalité avec {name}, départagés au chrono', { name: ahead.name })}
        </span>
        <small className="dr-podium">
          {podium.map((r) => (
            <span key={r.rank} title={r.name}>
              {r.avatar}
            </span>
          ))}
        </small>
      </span>
    </a>
  )
}
