// Le duel posé sur la page du jeu : le compte à rebours, la barre de course face à l'adversaire et l'écran d'arrivée.
// Hors de la page du jeu, une pastille ramène au duel en cours.
import { useEffect, useState } from 'react'
import { duelGame, duelTitle, progressText, type Finish, type Progress } from '../lib/duel'
import { duel, gameHash, leaveDuel, useDuel, type DuelState, type Player } from '../lib/duelRoom'
import { feedback } from '../lib/feedback'
import { fmt, t } from '../lib/i18n'
import type { Route } from '../lib/router'
import { clock } from './ChallengeBox'
import Mascot from './Mascot'
import '../duel/duel.css'

// l'heure, rafraîchie tant qu'un chrono tourne
function useNow(every: number) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!every) return
    const id = window.setInterval(() => setNow(Date.now()), every)
    return () => clearInterval(id)
  }, [every])
  return now
}

function statusOf(d: DuelState, f: Finish | null, p: Progress | null): string {
  if (!f) return p ? progressText(p) : t('en jeu…')
  if (f.out) return f.out === 'abandon' ? t('Abandon') : t('Hors course')
  if (duelGame(d.round?.game)?.rule === 'score') return `${t('{n} pts', { n: fmt(Math.round(f.pts)) })} · ${clock(f.ms)}`
  return f.win === false ? t('Raté') : t('Fini en {time}', { time: clock(f.ms) })
}

function Side({ p, status, done, me }: { p: Player | null; status: string; done: boolean; me?: boolean }) {
  return (
    <div className={me ? 'duel-side' : 'duel-side them'}>
      <span className="duel-av">{p?.avatar ?? '…'}</span>
      <span>
        <b>{me ? t('Toi') : (p?.name ?? '')}</b>
        <small className={done ? 'done' : ''}>{status}</small>
      </span>
    </div>
  )
}

function Result({ d, onHide }: { d: DuelState; onHide: () => void }) {
  const name = d.them?.name ?? ''
  const { mine, theirs, outcome, rematch, gone } = d
  const won = outcome === 'gagné'
  const both = mine?.win && theirs?.win && duelGame(d.round?.game)?.rule === 'course'
  const gap = both ? fmt(Math.abs(mine.ms - theirs.ms) / 1000, { maximumFractionDigits: 1 }) : null
  return (
    <section className={won ? 'duel-result won' : 'duel-result'} role="dialog" aria-label={t('Fin du duel')}>
      <Mascot mood={won ? 'joie' : outcome === 'perdu' ? 'rate' : 'calme'} size={52} />
      <h2>{won ? t('Duel gagné !') : outcome === 'perdu' ? t('Duel perdu') : t('Égalité !')}</h2>
      {gap ? (
        <p className="muted">{won ? t('Tu gagnes de {s} s', { s: gap }) : t('{name} gagne de {s} s', { name, s: gap })}</p>
      ) : (
        theirs?.win && !won && <p className="muted">{t('{name} a fini en {time}', { name, time: clock(theirs.ms) })}</p>
      )}
      <div className="duel-board">
        <Side p={d.me} me status={statusOf(d, mine, d.myProgress)} done={!!mine && !mine.out} />
        <Side p={d.them} status={gone && !theirs ? t('Parti') : statusOf(d, theirs, d.progress)} done={!!theirs && !theirs.out} />
      </div>
      <div className="duel-actions">
        {!gone && (
          <button className={rematch.them && !rematch.me ? 'ui-btn' : 'ui-btn line'} disabled={rematch.me} onClick={() => duel()?.rematch()}>
            {rematch.me ? t('En attente de {name}…', { name }) : rematch.them ? t('{name} veut une revanche : accepter', { name }) : t('Revanche')}
          </button>
        )}
        <button
          className="ui-btn line"
          onClick={() => {
            duel()?.backToRoom()
            location.hash = `#/duel/${d.code}`
          }}
        >
          {t('Changer de jeu')}
        </button>
        <button
          className="ui-btn line"
          onClick={() => {
            leaveDuel()
            location.hash = '#/duel'
          }}
        >
          {t('Quitter')}
        </button>
      </div>
      {(!mine || mine.out) && (
        <button className="duel-link" onClick={onHide}>
          {t('Finir la partie quand même')}
        </button>
      )}
    </section>
  )
}

// la route vient d'App : un second useRoute lancerait une seconde transition de page à chaque navigation
export default function DuelLayer({ route }: { route: Route }) {
  const d = useDuel()
  const phase = d?.phase
  const onGame = !!d && route.params.get('duel') === d.code
  const now = useNow(phase === 'depart' ? 100 : phase === 'partie' ? 250 : 0)
  // la manche dont on a fermé l'écran d'arrivée pour finir sa partie
  const [hidden, setHidden] = useState(0)
  const n = d?.round?.n

  // au départ, chacun rejoint la page du jeu : elle se charge pendant le compte à rebours
  useEffect(() => {
    const s = duel()?.state
    if (s?.phase === 'depart' && s.round) location.hash = gameHash(s.code, s.round)
  }, [n])

  // l'un des deux a demandé à changer de jeu : retour au salon
  useEffect(() => {
    const s = duel()?.state
    if (s?.phase === 'salon' && new URLSearchParams(location.hash.split('?')[1]).get('duel') === s.code) location.hash = `#/duel/${s.code}`
  }, [phase])

  // la partie reste voilée jusqu'au « Partez », et la barre de course lui réserve sa place
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('duel-veil', onGame && phase === 'depart')
    root.classList.toggle('duel-on', onGame && (phase === 'depart' || phase === 'partie' || phase === 'fin'))
    return () => root.classList.remove('duel-veil', 'duel-on')
  }, [onGame, phase])

  const count = phase === 'depart' && d ? Math.ceil((d.goAt - now) / 1000) : 0
  useEffect(() => {
    if (onGame && count > 0) feedback('tap', 3 - count)
  }, [onGame, count])
  useEffect(() => {
    if (onGame && phase === 'partie') feedback('good', 3)
    // le « Partez », une fois
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  if (!d) return null
  if (!onGame) {
    const playing = (phase === 'depart' || phase === 'partie' || phase === 'fin') && d.round
    if (!playing && (phase !== 'salon' || route.segments[0] === 'duel')) return null
    return (
      <a className="duel-chip" href={playing ? gameHash(d.code, d.round!) : `#/duel/${d.code}`}>
        {playing ? t('Duel en cours · reprendre') : t('Salon de duel · y revenir')}
      </a>
    )
  }

  const title = duelTitle(d.round?.game)
  const name = d.them?.name ?? ''
  const banner =
    phase !== 'partie'
      ? null
      : d.gone && !d.mine
        ? t('{name} a quitté le duel : termine ta partie pour gagner.', { name })
        : d.theirs?.out && !d.mine
          ? t('{name} abandonne : termine ta partie pour gagner.', { name })
          : d.mine && !d.outcome
            ? t('En attente de {name}…', { name })
            : null

  return (
    <>
      {phase === 'depart' && (
        <div className="duel-countdown" role="status" aria-live="assertive">
          <span key={count} className="duel-count">
            {count > 0 ? count : t('Partez !')}
          </span>
          <small>{t('{game} contre {name}', { game: title, name })}</small>
        </div>
      )}
      {(phase === 'partie' || (phase === 'fin' && hidden === n)) && (
        <div className="duel-bar">
          <Side p={d.me} me status={statusOf(d, d.mine, d.myProgress)} done={!!d.mine && !d.mine.out} />
          <b className="duel-clock">{clock(d.mine ? d.mine.ms : Math.max(0, now - d.goAt))}</b>
          <Side p={d.them} status={d.gone && !d.theirs ? t('Parti') : statusOf(d, d.theirs, d.progress)} done={!!d.theirs && !d.theirs.out} />
          {phase === 'partie' && !d.mine && (
            <button className="duel-link duel-giveup" onClick={() => duel()?.giveUp()}>
              {t('Abandonner')}
            </button>
          )}
          {phase === 'fin' && (
            <button className="duel-link duel-giveup" onClick={() => setHidden(0)}>
              {t('Voir le résultat')}
            </button>
          )}
        </div>
      )}
      {banner && <p className="duel-banner">{banner}</p>}
      {phase === 'fin' && hidden !== n && <Result d={d} onHide={() => setHidden(n ?? 0)} />}
    </>
  )
}
