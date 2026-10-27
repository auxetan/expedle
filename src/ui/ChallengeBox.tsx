import { useEffect, useState } from 'react'
import { challengeUrl, compare, readChallenge, rememberChallenge, type Result } from '../lib/challenge'
import { addFriend, challengeBoard, myFriends, sendChallenge, submitChallenge, useAccount, type ChallengeRow, type Friend } from '../lib/cloud'
import { plural, t } from '../lib/i18n'
import { copyText } from '../lib/util'
import { gameInfo } from './gameInfo'
import DailyRank from './DailyRank'
import NextGame from './NextGame'
import { loadProfile } from './Panels'

export function clock(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return ''
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function resultLabel(game: string, r: { pts: number; s?: number | null; win?: boolean | null }): string {
  if (r.win === false) return t('perdu')
  return r.s !== undefined && r.s !== null ? gameInfo(game).unit(r.s) : t('{n} pts', { n: r.pts })
}

interface Props {
  // identifiant de la partie, comme dans l'historique (worldle, quiz-drapeaux…)
  game: string
  // page du jeu sans le #, où le lien du défi renvoie
  path: string
  seed: string
  result: Result
}

// Fin de partie : le rang du jour, le jeu à enchaîner, puis comparer avec les autres joueurs du défi et lancer un défi sur ce même tirage.
export default function ChallengeBox({ game, path, seed, result }: Props) {
  const account = useAccount()
  const [challenge] = useState(() => {
    const c = readChallenge()
    return c?.seed === seed ? c : null
  })
  const [board, setBoard] = useState<ChallengeRow[] | null>(null)
  const [friends, setFriends] = useState<Friend[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [toast, setToast] = useState('')
  const info = gameInfo(game)
  const timed = !info.untimed

  useEffect(() => {
    if (challenge) rememberChallenge({ game, seed, at: Date.now(), mine: result, by: challenge.by })
    // une seule fois, à l'arrivée sur l'écran de fin
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!challenge || account.state !== 'in') return
    let alive = true
    submitChallenge(game, seed, result)
      .then(() => challengeBoard(game, seed))
      .then(
        (rows) => alive && setBoard(rows),
        () => {},
      )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.state])

  function flash(text: string) {
    setToast(text)
    setTimeout(() => setToast(''), 2000)
  }

  async function invite() {
    const me = loadProfile()
    const url = challengeUrl(path, seed, result, me.name ? me : undefined)
    rememberChallenge({ game, seed, at: Date.now(), mine: result, by: challenge?.by ?? null })
    if (account.state === 'in') {
      void submitChallenge(game, seed, result).catch(() => {})
      if (friends === null) myFriends().then(setFriends, () => setFriends([]))
    }
    const text = t('Je te défie sur {game} : fais mieux que {score} !', { game: t(info.title), score: resultLabel(game, result) })
    // sur téléphone, la feuille de partage du système ; ailleurs, le lien copié
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ text, url }).catch(() => {})
      return
    }
    flash((await copyText(`${text}\n${url}`)) ? t('Lien du défi copié !') : t('Copie impossible'))
  }

  async function send() {
    try {
      const n = await sendChallenge(game, seed, [...picked])
      setMessage(plural(n, 'Défi envoyé à {n} ami.', 'Défi envoyé à {n} amis.'))
      setPicked(new Set())
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('Envoi impossible.'))
    }
  }

  async function follow(code: string) {
    try {
      await addFriend(code)
      setBoard((rows) => rows?.map((r) => (r.code === code ? { ...r, friend: true } : r)) ?? null)
    } catch (e) {
      flash(e instanceof Error ? e.message : t('Ajout impossible.'))
    }
  }

  const rival = challenge?.by
  const versus = rival && !board ? compare(result, rival.r) : null

  // sans comparaison à montrer, juste un bouton : la fin de partie reste légère
  const bare = !(board && board.length > 0) && !(rival && !board) && !friends
  return (
    <>
      <DailyRank game={game} />
      <NextGame />
      <section className={bare ? 'ch-box bare' : 'ch-box'}>
        {board && board.length > 0 && (
          <>
            <h3>{t('Les joueurs de ce défi')}</h3>
            <ol className="ch-list">
              {board.map((r, i) => (
                <li key={`${r.code}-${i}`} className={r.me ? 'me' : ''}>
                  <span className="ch-rank">{r.rank}</span>
                  <span className="ch-avatar">{r.avatar}</span>
                  <b className="ch-name">
                    {r.name}
                    {r.me && <small> · {t('toi')}</small>}
                  </b>
                  {!r.me && !r.friend && (
                    <button className="ch-follow" onClick={() => void follow(r.code)}>
                      {t('+ Ami')}
                    </button>
                  )}
                  <span className="ch-value">
                    {resultLabel(game, r)}
                    {timed && r.ms !== null && <small>{clock(r.ms)}</small>}
                  </span>
                </li>
              ))}
            </ol>
            <p className="ch-verdict">
              {board.find((r) => r.me)?.rank === 1
                ? board.length > 1
                  ? t('Tu mènes ce défi !')
                  : t('Tu es le premier à relever ce défi.')
                : t('{name} mène ce défi.', { name: board[0].name })}
            </p>
          </>
        )}

        {rival && !board && (
          <>
            <h3>{t('Défi de {name}', { name: rival.name })}</h3>
            <ol className="ch-list">
              {[
                { name: rival.name, avatar: rival.avatar, r: rival.r, me: false },
                { name: loadProfile().name, avatar: loadProfile().avatar, r: result, me: true },
              ]
                .sort((a, b) => compare(a.r, b.r))
                .map((p) => (
                  <li key={p.me ? 'me' : 'rival'} className={p.me ? 'me' : ''}>
                    <span className="ch-avatar">{p.avatar}</span>
                    <b className="ch-name">
                      {p.name || t('Toi')}
                      {p.me && p.name && <small> · {t('toi')}</small>}
                    </b>
                    <span className="ch-value">
                      {resultLabel(game, p.r)}
                      {timed && p.r.ms !== undefined && <small>{clock(p.r.ms)}</small>}
                    </span>
                  </li>
                ))}
            </ol>
            <p className="ch-verdict">
              {versus === 0 ? t('Égalité parfaite !') : versus! < 0 ? t('Tu gagnes le défi !') : t('{name} gagne le défi.', { name: rival.name })}
            </p>
          </>
        )}

        <div className="ch-actions">
          <button className="ui-btn line" onClick={() => void invite()} title={t('Le lien fait jouer exactement la même partie.')}>
            ⚔️ {challenge ? t('Défier un autre ami') : t('Défier un ami')}
          </button>
        </div>

        {friends && friends.length > 0 && (
          <div className="ch-friends">
            <span>{t('Ou l’envoyer directement à :')}</span>
            <div className="ch-chips">
              {friends.map((f) => (
                <button
                  key={f.code}
                  className={picked.has(f.code) ? 'on' : ''}
                  onClick={() => {
                    const next = new Set(picked)
                    if (!next.delete(f.code)) next.add(f.code)
                    setPicked(next)
                    setMessage('')
                  }}
                >
                  {f.avatar} {f.name}
                </button>
              ))}
            </div>
            <button className="ui-btn line" disabled={!picked.size} onClick={() => void send()}>
              {t('Envoyer le défi')}
            </button>
            {message && <p className="ch-note">{message}</p>}
          </div>
        )}
        {friends && friends.length === 0 && (
          <p className="ch-note">
            {t('Ajoute des amis pour leur envoyer tes défis directement :')} <a href="#/defis">{t('page Défis →')}</a>
          </p>
        )}
        {toast && <div className="toast-copy">{toast}</div>}
      </section>
    </>
  )
}
