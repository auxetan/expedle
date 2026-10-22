import { useEffect, useState } from 'react'
import { compare, localChallenges } from '../lib/challenge'
import {
  addFriend,
  challengeBoard,
  cloudEnabled,
  myChallenges,
  myFriends,
  removeFriend,
  useAccount,
  type ChallengeItem,
  type ChallengeRow,
  type Friend,
} from '../lib/cloud'
import { fmt, locale, ordinal, plural, t } from '../lib/i18n'
import { copyText } from '../lib/util'
import AppBar from '../ui/AppBar'
import { clock, resultLabel } from '../ui/ChallengeBox'
import { gameIcon, gameInfo } from '../ui/gameInfo'
import GameIcon from '../ui/GameIcon'
import { loadProfile } from '../ui/Panels'
import './challenges.css'
import './leaderboards.css'

const link = (game: string, seed: string) => `${gameInfo(game).href}?defi=${encodeURIComponent(seed)}`

function GameBadge({ game }: { game: string }) {
  const icon = gameIcon(game)
  return icon ? <GameIcon icon={icon} size={36} /> : <span className="cf-glyph">⚔️</span>
}

function when(at: string | number): string {
  return new Date(at).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })
}

function Board({ game, seed }: { game: string; seed: string }) {
  const [rows, setRows] = useState<ChallengeRow[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    challengeBoard(game, seed).then(setRows, (e: Error) => setError(e.message))
  }, [game, seed])
  if (error) return <p className="ch-note">{error}</p>
  if (!rows) return <div className="lb-spinner" />
  return (
    <ol className="ch-list">
      {rows.map((r, i) => (
        <li key={`${r.code}-${i}`} className={r.me ? 'me' : ''}>
          <span className="ch-rank">{r.rank}</span>
          <span className="ch-avatar">{r.avatar}</span>
          <b className="ch-name">
            {r.name}
            {r.me && <small> · {t('toi')}</small>}
          </b>
          <span className="ch-value">
            {resultLabel(game, r)}
            {!gameInfo(game).untimed && r.ms !== null && <small>{clock(r.ms)}</small>}
          </span>
        </li>
      ))}
    </ol>
  )
}

function FriendsSection({ initialCode }: { initialCode: string }) {
  const account = useAccount()
  const [friends, setFriends] = useState<Friend[] | null>(null)
  const [code, setCode] = useState(initialCode)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [confirm, setConfirm] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    myFriends().then(setFriends, (e: Error) => setMessage(e.message))
  }, [])

  async function add() {
    setBusy(true)
    setMessage('')
    try {
      const f = await addFriend(code)
      setFriends((list) => [...(list ?? []).filter((x) => x.code !== f.code), f].sort((a, b) => a.name.localeCompare(b.name, locale())))
      setMessage(t('{name} fait maintenant partie de tes amis.', { name: f.name }))
      setCode('')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('Ajout impossible.'))
    } finally {
      setBusy(false)
    }
  }

  async function remove(f: Friend) {
    await removeFriend(f.code)
    setFriends((list) => list?.filter((x) => x.code !== f.code) ?? null)
    setConfirm('')
  }

  async function shareCode() {
    const url = `${location.origin}${location.pathname}#/defis?ami=${account.code}`
    const ok = await copyText(t('Ajoute-moi en ami sur Expedle : {url}', { url }))
    setCopied(ok)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="cf-section">
      <h2>{t('Amis')}</h2>
      <div className="cf-code">
        <div>
          <small>{t('Ton code ami')}</small>
          <b>{account.code || '…'}</b>
        </div>
        <button className="ui-btn line" onClick={() => void shareCode()} disabled={!account.code}>
          {copied ? t('Lien copié !') : t('Partager mon lien ami')}
        </button>
      </div>
      <form
        className="cf-add"
        onSubmit={(e) => {
          e.preventDefault()
          if (code.trim().length >= 6) void add()
        }}
      >
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={t('Code ami (8 caractères)')} maxLength={8} spellCheck={false} />
        <button className="ui-btn" disabled={busy || code.trim().length < 6}>
          {t('Ajouter')}
        </button>
      </form>
      {message && <p className="ch-note">{message}</p>}
      {friends && !friends.length && <p className="ch-note">{t('Pas encore d’amis : partage ton code ou ajoute celui d’un ami.')}</p>}
      {friends && friends.length > 0 && (
        <ul className="cf-friends">
          {friends.map((f) => (
            <li key={f.code}>
              <span className="ch-avatar">{f.avatar}</span>
              <div className="cf-friend-name">
                <b>{f.name}</b>
                <small>{f.mutual ? t('Vous vous suivez') : t('Ne te suit pas encore')}</small>
              </div>
              <span className="ch-value">
                {t('{n} pts', { n: fmt(f.week_points) })}
                <small>{t('cette semaine')}</small>
              </span>
              {confirm === f.code ? (
                <span className="ui-confirm">
                  <button className="danger" onClick={() => void remove(f)}>
                    {t('Retirer')}
                  </button>
                  <button onClick={() => setConfirm('')}>{t('Annuler')}</button>
                </span>
              ) : (
                <button className="cf-remove" onClick={() => setConfirm(f.code)} aria-label={t('Retirer {name}', { name: f.name })}>
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function OnlineChallenges() {
  const [items, setItems] = useState<ChallengeItem[] | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState('')
  useEffect(() => {
    myChallenges().then(setItems, (e: Error) => setError(e.message))
  }, [])

  if (error) return <p className="ch-note">{error}</p>
  if (!items) return <div className="lb-spinner" />
  const received = items.filter((c) => c.from_name && !c.played)
  const played = items.filter((c) => c.played)

  return (
    <>
      {received.length > 0 && (
        <section className="cf-section">
          <h2>{t('Défis reçus')}</h2>
          <ul className="cf-items">
            {received.map((c) => (
              <li key={c.game + c.seed}>
                <GameBadge game={c.game} />
                <div className="cf-item-text">
                  <b>{t('{name} te défie sur {game}', { name: `${c.from_avatar} ${c.from_name}`, game: t(gameInfo(c.game).title) })}</b>
                  <small>
                    {when(c.at)} · {plural(c.players, '{n} joueur', '{n} joueurs')}
                  </small>
                </div>
                <a className="ui-btn" href={link(c.game, c.seed)}>
                  {t('Relever')}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="cf-section">
        <h2>{t('Mes défis')}</h2>
        {!played.length && <p className="ch-note">{t('Aucun défi joué pour l’instant. Termine une partie et appuie sur « Défier un ami ».')}</p>}
        <ul className="cf-items">
          {played.map((c) => {
            const key = c.game + c.seed
            return (
              <li key={key} className="cf-played">
                <button className="cf-item-head" onClick={() => setOpen(open === key ? '' : key)}>
                  <GameBadge game={c.game} />
                  <div className="cf-item-text">
                    <b>{t(gameInfo(c.game).title)}</b>
                    <small>
                      {when(c.at)} · {plural(c.players, '{n} joueur', '{n} joueurs')}
                      {c.from_name ? ` · ${t('défi de {name}', { name: c.from_name })}` : ''}
                    </small>
                  </div>
                  <span className={c.my_rank === 1 ? 'cf-rank first' : 'cf-rank'}>
                    {c.players > 1 ? t('{rank} sur {n}', { rank: ordinal(c.my_rank ?? c.players), n: c.players }) : t('En attente')}
                  </span>
                </button>
                {open === key && (
                  <div className="cf-board">
                    <Board game={c.game} seed={c.seed} />
                    <a className="ui-btn line" href={link(c.game, c.seed)}>
                      {t('Rejouer ce tirage')}
                    </a>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}

function LocalChallenges() {
  const list = localChallenges().filter((c) => c.mine)
  const me = loadProfile()
  return (
    <section className="cf-section">
      <h2>{t('Mes défis')}</h2>
      {!list.length && <p className="ch-note">{t('Aucun défi joué pour l’instant. Termine une partie et appuie sur « Défier un ami ».')}</p>}
      <ul className="cf-items">
        {list.map((c) => {
          const versus = c.by && c.mine ? compare(c.mine, c.by.r) : null
          return (
            <li key={c.game + c.seed}>
              <GameBadge game={c.game} />
              <div className="cf-item-text">
                <b>{t(gameInfo(c.game).title)}</b>
                <small>
                  {when(c.at)} · {me.name || t('Toi')} : {resultLabel(c.game, c.mine!)}
                  {c.by ? ` · ${c.by.name} : ${resultLabel(c.game, c.by.r)}` : ''}
                </small>
              </div>
              <span className={versus !== null && versus < 0 ? 'cf-rank first' : 'cf-rank'}>
                {versus === null ? t('En attente') : versus < 0 ? t('Gagné') : versus > 0 ? t('Perdu') : t('Égalité')}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default function Challenges({ params }: { params: URLSearchParams }) {
  const account = useAccount()
  const online = cloudEnabled && account.state === 'in'
  return (
    <div className="home">
      <AppBar title={t('Défis')} />
      <main className="home-main cf-main">
        <section className="cf-intro">
          <h1>{t('Défis entre amis')}</h1>
          <p className="muted">
            {t('Termine une partie, puis « Défier un ami » : ton ami joue exactement la même partie et vous comparez vos scores. Seul le premier essai compte.')}
          </p>
        </section>
        {cloudEnabled && account.state === 'out' && (
          <p className="lb-banner">{t('Connecte-toi depuis ton profil (en haut à droite) pour ajouter des amis, recevoir leurs défis et voir tous les joueurs de chaque défi.')}</p>
        )}
        {online && <FriendsSection initialCode={(params.get('ami') ?? '').toUpperCase().slice(0, 8)} />}
        {online ? <OnlineChallenges /> : <LocalChallenges />}
      </main>
    </div>
  )
}
