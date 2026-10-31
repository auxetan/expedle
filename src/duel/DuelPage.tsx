// Le duel en direct : choisir un jeu, inviter un ami ou trouver un adversaire au hasard, puis le salon où les deux
// joueurs se retrouvent avant de partir. Avec un compte : chacun joue sous son nom.
import { useEffect, useState } from 'react'
import { cloudEnabled, useAccount } from '../lib/cloud'
import { DUEL_GAMES, duelCard, duelGame, duelTitle, isCode, newCode } from '../lib/duel'
import { duel, FIND_MS, gameHash, joinQueue, leaveDuel, leaveQueue, openDuel, queuedGame, useDuel, useQueue, type Player, type Who } from '../lib/duelRoom'
import { plural, t } from '../lib/i18n'
import { copyText } from '../lib/util'
import AccountBox from '../ui/Account'
import AppBar from '../ui/AppBar'
import GameIcon from '../ui/GameIcon'
import { loadProfile } from '../ui/Panels'
import './duel.css'

const SURPRISE = 'surprise'

const randomGame = () => DUEL_GAMES[Math.floor(Math.random() * DUEL_GAMES.length)].id

function quit() {
  leaveDuel()
  location.hash = '#/duel'
}

export default function DuelPage({ code, params }: { code?: string; params: URLSearchParams }) {
  const account = useAccount()
  const profile = loadProfile()
  const who: Who | null = account.state === 'in' ? { user: account.userId, name: profile.name || t('Joueur'), avatar: profile.avatar } : null
  return (
    <div className="home">
      <AppBar title={t('Duel')} />
      <main className="home-main duel-main">
        {!code && (
          <section className="duel-intro">
            <h1>{t('Duel en direct')}</h1>
            <p className="muted">{t('La même partie au même moment, contre un ami ou un inconnu : le plus rapide gagne.')}</p>
          </section>
        )}
        {!cloudEnabled ? (
          <p className="lb-banner">{t('Le duel en direct a besoin du compte en ligne.')}</p>
        ) : !who ? (
          <>
            <p className="lb-banner">{t('Les duels se jouent avec un compte : connecte-toi, c’est sans mot de passe.')}</p>
            <AccountBox />
          </>
        ) : code ? (
          <Room code={code.toUpperCase()} who={who} />
        ) : (
          <Lobby who={who} initial={params.get('jeu')} />
        )}
      </main>
    </div>
  )
}

function Lobby({ who, initial }: { who: Who; initial: string | null }) {
  const [game, setGame] = useState(duelGame(initial) ? initial! : SURPRISE)
  const [code, setCode] = useState('')
  const queue = useQueue()
  const found = useDuel()
  const pick = game === SURPRISE ? null : game

  // la file a trouvé un adversaire : direction le salon commun
  useEffect(() => {
    if (found?.fromQueue) location.hash = `#/duel/${found.code}`
  }, [found?.code, found?.fromQueue])
  useEffect(() => () => leaveQueue(), [])

  function invite() {
    const room = newCode()
    void openDuel(room, who, { game: pick ?? randomGame() })
    location.hash = `#/duel/${room}`
  }

  if (queue)
    return (
      <section className="duel-card duel-search" aria-live="polite">
        <span className="duel-pulse" aria-hidden />
        <h2>{t('Recherche d’un adversaire…')}</h2>
        <p className="muted">
          {queue.count > 1
            ? plural(queue.count - 1, '{n} autre joueur dans la file', '{n} autres joueurs dans la file')
            : t('Personne d’autre pour l’instant : invite un ami en attendant.')}
        </p>
        <div className="duel-actions">
          <button className="ui-btn" onClick={invite}>
            {t('Inviter un ami')}
          </button>
          <button className="ui-btn line" onClick={leaveQueue}>
            {t('Annuler')}
          </button>
        </div>
      </section>
    )

  return (
    <>
      <section className="duel-card">
        <h2>{t('Choisis le jeu')}</h2>
        <div className="duel-games">
          <button className={game === SURPRISE ? 'on' : ''} aria-pressed={game === SURPRISE} onClick={() => setGame(SURPRISE)}>
            <span className="duel-surprise" aria-hidden>
              ?
            </span>
            <b>{t('Surprise')}</b>
          </button>
          {DUEL_GAMES.map((g) => (
            <button key={g.id} className={game === g.id ? 'on' : ''} aria-pressed={game === g.id} onClick={() => setGame(g.id)}>
              <GameIcon icon={duelCard(g.id)!.icon} size={36} />
              <b>{duelTitle(g.id)}</b>
            </button>
          ))}
        </div>
        <div className="duel-actions">
          <button className="ui-btn" onClick={invite}>
            {t('Inviter un ami')}
          </button>
          <button className="ui-btn line" onClick={() => void joinQueue(who, pick)}>
            {t('Adversaire au hasard')}
          </button>
        </div>
      </section>
      <section className="duel-card">
        <h2>{t('Rejoindre un duel')}</h2>
        <form
          className="duel-join"
          onSubmit={(e) => {
            e.preventDefault()
            if (isCode(code)) location.hash = `#/duel/${code}`
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
            placeholder={t('Code à 5 lettres')}
            aria-label={t('Code du duel')}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
          />
          <button className="ui-btn line" disabled={!isCode(code)}>
            {t('Rejoindre')}
          </button>
        </form>
      </section>
    </>
  )
}

function Seat({ p, me, ready }: { p: Player; me?: boolean; ready: boolean }) {
  return (
    <div className="duel-seat">
      <span className="duel-av">{p.avatar}</span>
      <b>{me ? t('Toi') : p.name}</b>
      <small className={ready ? 'ready' : ''}>{ready ? t('Prêt') : t('Pas prêt')}</small>
    </div>
  )
}

function Room({ code, who }: { code: string; who: Who }) {
  const d = useDuel()
  const [copied, setCopied] = useState(false)
  const user = who.user

  useEffect(() => {
    if (duel()?.state.code !== code) void openDuel(code, who, { find: FIND_MS })
    // un seul salon par code, quel que soit le rendu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, user])

  // l'adversaire trouvé par la file n'est pas venu : retour dans la file
  const lostMatch = d?.fromQueue && d.phase === 'introuvable'
  useEffect(() => {
    if (!lostMatch) return
    leaveDuel()
    void joinQueue(who, queuedGame())
    location.hash = '#/duel'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lostMatch])

  if (!d || d.code !== code || d.phase === 'connexion') return <p className="duel-status">{t('Connexion au salon…')}</p>
  if (d.phase === 'introuvable' || d.phase === 'complet' || d.phase === 'reseau')
    return (
      <section className="duel-card">
        <p>
          {d.phase === 'introuvable'
            ? t('Ce duel est introuvable : le lien a peut-être expiré.')
            : d.phase === 'complet'
              ? t('Ce duel est déjà complet.')
              : t('La connexion au duel est perdue.')}
        </p>
        <div className="duel-actions">
          <button className="ui-btn line" onClick={quit}>
            {t('Retour aux duels')}
          </button>
        </div>
      </section>
    )

  const game = duelGame(d.game)
  const rival = d.them && !d.gone ? d.them : null
  const link = `${location.origin}${location.pathname}#/duel/${code}`

  return (
    <>
      <section className="duel-intro">
        <h1>{t('Salon de duel')}</h1>
      </section>
      <section className="duel-card duel-room">
        <div className="duel-code">
          <span>
            <small>{t('Code du duel')}</small>
            <b>{code}</b>
          </span>
          <button
            className="ui-btn line"
            onClick={async () => {
              setCopied(await copyText(link))
              window.setTimeout(() => setCopied(false), 1800)
            }}
          >
            {copied ? t('Lien copié !') : t('Copier le lien')}
          </button>
        </div>
        <div className="duel-seats">
          <Seat p={d.me} me ready={d.me.ready} />
          <span className="duel-vs">{t('contre')}</span>
          {rival ? (
            <Seat p={rival} ready={rival.ready} />
          ) : (
            <div className="duel-seat empty">
              <span className="duel-av" aria-hidden>
                …
              </span>
              <b>{t('En attente d’un adversaire')}</b>
            </div>
          )}
        </div>
        <div className="duel-game">
          <small>{t('Jeu')}</small>
          {d.host ? (
            <select value={d.game ?? ''} onChange={(e) => duel()?.chooseGame(e.target.value)} aria-label={t('Jeu')}>
              <option value="" disabled>
                {t('Choisis le jeu')}
              </option>
              {DUEL_GAMES.map((g) => (
                <option key={g.id} value={g.id}>
                  {duelTitle(g.id)}
                </option>
              ))}
            </select>
          ) : (
            <b>{game ? duelTitle(game.id) : t('L’hôte choisit le jeu…')}</b>
          )}
          {game && <p className="muted">{game.rule === 'course' ? t('Course : le premier à réussir gagne.') : t('Score : le meilleur score gagne, puis le plus rapide.')}</p>}
        </div>
        {d.phase === 'salon' ? (
          <div className="duel-actions">
            <button className={d.me.ready ? 'ui-btn line' : 'ui-btn'} disabled={!game} onClick={() => duel()?.setReady(!d.me.ready)}>
              {d.me.ready ? t('Pas encore prêt') : t('Je suis prêt')}
            </button>
            <button className="ui-btn line" onClick={quit}>
              {t('Quitter')}
            </button>
          </div>
        ) : (
          d.round && (
            <p className="duel-status">
              <a href={gameHash(code, d.round)}>{t('Une manche est en cours : y retourner')}</a>
            </p>
          )
        )}
        {d.phase === 'salon' && d.me.ready && rival && !rival.ready && <p className="duel-status">{t('En attente de {name}…', { name: rival.name })}</p>}
      </section>
    </>
  )
}
