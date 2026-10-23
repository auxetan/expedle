// Les parties en ligne, comme sur OpenFront. Une partie publique se rejoint d'un clic et part à heure dite avec
// les réglages de tous ; un salon privé se crée et se partage par son code, et son hôte choisit les réglages.
import { useEffect, useRef, useState } from 'react'
import { t } from '../../lib/i18n'
import { copyText, formatTime, load } from '../../lib/util'
import { BOTS, LEVEL_NAMES, LEVELS, TRIBES } from './choices'
import { Directory, joinable, Lobby, newCode, PUBLIC_MAX, PUBLIC_SETTINGS, PUBLIC_WAIT_MS, ranked, type LobbySettings, type Member, type Start } from './net'

export type SalonKind = 'public' | 'prive'

export default function Salon({ kind, name, skin, onStart, onBack }: { kind: SalonKind; name: string; skin: string; onStart: (lobby: Lobby, start: Start) => void; onBack: () => void }) {
  const [lobby, setLobby] = useState<Lobby | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(kind === 'public')
  const [error, setError] = useState('')
  const [settings, setSettings] = useState<LobbySettings>(() => ({ level: load('openfront-niveau', 'moyen'), bots: TRIBES, nations: true, nukes: true }))
  const [now, setNow] = useState(Date.now)
  // les rappels du réseau lisent le salon en cours sans dépendre d'un rendu
  const current = useRef<Lobby | null>(null)
  const directory = useRef<Directory | null>(null)
  // un salon quitté avant le lancement se ferme ; lancé, il appartient à la partie
  const started = useRef(false)

  // Change de salon : l'ancien est quitté, et l'annonce publique de son hôte retirée.
  function enter(next: Lobby | null) {
    const before = current.current
    if (before && before !== next) {
      if (before.host) directory.current?.announce(null)
      before.leave()
    }
    current.current = next
    setLobby(next)
    setMembers(next ? [...next.members] : [])
  }

  async function open(roomCode: string, host: boolean): Promise<Lobby | null> {
    try {
      const next = await Lobby.open(roomCode, host, name, skin)
      next.onMembers = (list) => {
        if (current.current !== next) return
        setMembers([...list])
        // une partie publique pleine : les derniers arrivés vont en chercher une autre
        if (kind === 'public' && !next.host && list.findIndex((m) => m.key === next.key) >= PUBLIC_MAX) void find(next.code)
      }
      next.onStart = (start) => {
        if (next.playerOf(next.key) === 0) {
          if (kind === 'public') void find(next.code)
          else {
            setError(t('Le salon est complet.'))
            enter(null)
          }
          return
        }
        started.current = true
        directory.current?.release()
        onStart(next, start)
      }
      next.onClose = () => {
        if (current.current !== next) return
        if (kind === 'public') {
          setError(t('L’hôte est parti : recherche d’une autre partie…'))
          void find(next.code)
        } else {
          setError(t('L’hôte a fermé le salon.'))
          enter(null)
        }
      }
      return next
    } catch (e) {
      if (kind === 'prive') setError((e as Error).message === 'introuvable' ? t('Aucun salon ouvert avec ce code.') : t('Connexion impossible pour l’instant.'))
      return null
    }
  }

  async function openPrivate(roomCode: string, host: boolean) {
    setBusy(true)
    setError('')
    const next = await open(roomCode, host)
    if (next) enter(next)
    setBusy(false)
  }

  // Rejoint la prochaine partie publique, ou en ouvre une si aucune n'attend ; `skip` : celle qu'on quitte.
  async function find(skip?: string) {
    const dir = directory.current
    if (!dir || started.current) return
    enter(null)
    setBusy(true)
    const tried = new Set(skip ? [skip] : [])
    for (;;) {
      const next = joinable(
        dir.listings.filter((l) => !tried.has(l.code)),
        Date.now(),
      )
      if (!next) break
      tried.add(next.code)
      const joined = await open(next.code, false)
      if (joined) {
        enter(joined)
        setBusy(false)
        return
      }
    }
    const hosted = await open(newCode(), true)
    if (hosted) {
      hosted.setStartsAt(Date.now() + PUBLIC_WAIT_MS)
      enter(hosted)
    } else setError(t('Connexion impossible pour l’instant.'))
    setBusy(false)
  }

  // la partie publique : l'annuaire d'abord, puis la meilleure partie à rejoindre
  useEffect(() => {
    if (kind !== 'public') return
    let gone = false
    let unwatch = () => {}
    Directory.open()
      .then(async (dir) => {
        if (gone) return dir.release()
        directory.current = dir
        // un hôte resté seul rejoint une partie qui part avant la sienne : deux joueurs arrivés en même temps
        // finissent ensemble au lieu d'attendre chacun de leur côté
        unwatch = dir.watch((list) => {
          const mine = current.current
          const at = mine?.startsAt()
          if (!mine?.host || !at || mine.members.length > 1 || started.current) return
          const other = joinable(list, Date.now(), mine.code)
          if (other && ranked(other, { code: mine.code, players: 1, startsAt: at }) < 0) void find(mine.code)
        })
        await dir.ready()
        if (!gone) await find()
      })
      .catch(() => {
        setBusy(false)
        setError(t('Connexion impossible pour l’instant.'))
      })
    return () => {
      gone = true
      unwatch()
    }
    // l'annuaire s'ouvre une fois, à l'arrivée sur l'écran
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(
    () => () => {
      if (started.current) return
      if (current.current?.host) directory.current?.announce(null)
      current.current?.leave()
      directory.current?.release()
    },
    [],
  )

  const startsAt = lobby?.startsAt()

  // l'hôte d'une partie publique l'annonce tant qu'elle attend : son code, ses joueurs, l'heure du départ
  useEffect(() => {
    if (kind === 'public' && lobby?.host && startsAt) directory.current?.announce({ code: lobby.code, players: members.length, startsAt })
  }, [kind, lobby, members.length, startsAt])

  useEffect(() => {
    if (kind !== 'public' || !lobby) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [kind, lobby])

  // À l'heure dite, ou dès qu'elle est pleine, la partie part ; seul, l'hôte repousse le départ.
  useEffect(() => {
    if (kind !== 'public' || !lobby?.host || !startsAt || started.current) return
    if (members.length < PUBLIC_MAX && now < startsAt) return
    if (members.length < 2) lobby.setStartsAt(Date.now() + PUBLIC_WAIT_MS)
    else {
      directory.current?.announce(null)
      lobby.start(PUBLIC_SETTINGS, PUBLIC_MAX)
    }
  }, [kind, lobby, startsAt, now, members.length])

  const memberList = lobby && (
    <ul className="of-members">
      {members.map((m) => (
        <li key={m.key}>
          <span>{m.name}</span>
          <small>{m.key === lobby.key ? t('Toi') : kind === 'prive' && m.host ? t('Hôte') : ''}</small>
        </li>
      ))}
    </ul>
  )

  return (
    <div className="of-home">
      <header>
        <h2>{kind === 'public' ? t('Partie publique') : t('Avec des amis')}</h2>
        <small>{kind === 'public' ? t('Ouverte à tous · jusqu’à huit joueurs, avec les nations et les bots') : t('Jusqu’à huit joueurs, avec les nations et les bots')}</small>
      </header>
      {kind === 'public' ? (
        lobby && startsAt ? (
          <div className="of-lobby">
            <p className="of-code">
              <span>{t('Départ dans')}</span>
              <b>{formatTime(Math.max(0, startsAt - now))}</b>
              <span>{t('{n} / {max} joueurs', { n: Math.min(members.length, PUBLIC_MAX), max: PUBLIC_MAX })}</span>
            </p>
            {memberList}
            <p className="of-hint">
              {members.length < 2 ? t('En attente d’autres joueurs : le départ est repoussé tant que tu es seul.') : t('Carte du monde · {level} · {bots} bots · nations · bombes', { level: t(LEVEL_NAMES[PUBLIC_SETTINGS.level]), bots: PUBLIC_SETTINGS.bots })}
            </p>
          </div>
        ) : (
          busy && <p className="of-hint">{t('Recherche d’une partie publique…')}</p>
        )
      ) : !lobby ? (
        <>
          <div className="of-play">
            <button className="primary" disabled={busy} onClick={() => openPrivate(newCode(), true)}>
              <b>{t('Créer un salon')}</b>
              <small>{t('Tu choisis les réglages et lances la partie')}</small>
            </button>
          </div>
          <form
            className="of-join"
            onSubmit={(e) => {
              e.preventDefault()
              if (code.length === 5) openPrivate(code, false)
            }}
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
              placeholder={t('Code du salon')}
              aria-label={t('Code du salon')}
              autoCapitalize="characters"
              spellCheck={false}
            />
            <button className="ui-btn" disabled={busy || code.length !== 5}>
              {t('Rejoindre')}
            </button>
          </form>
        </>
      ) : (
        <div className="of-lobby">
          <p className="of-code">
            <span>{t('Code du salon')}</span>
            <b>{lobby.code}</b>
            <button onClick={() => copyText(lobby.code)}>{t('Copier')}</button>
          </p>
          {memberList}
          {lobby.host ? (
            <>
              <div className="of-levels" role="radiogroup" aria-label={t('Difficulté')}>
                {LEVELS.map((l) => (
                  <button key={l} role="radio" aria-checked={l === settings.level} className={l === settings.level ? 'on' : ''} onClick={() => setSettings({ ...settings, level: l })}>
                    {t(LEVEL_NAMES[l])}
                  </button>
                ))}
              </div>
              <div className="of-options">
                <label>
                  {t('Bots')}
                  <select value={settings.bots} onChange={(e) => setSettings({ ...settings, bots: Number(e.target.value) })}>
                    {BOTS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <input type="checkbox" checked={settings.nations} onChange={(e) => setSettings({ ...settings, nations: e.target.checked })} />
                  {t('Nations')}
                </label>
                <label>
                  <input type="checkbox" checked={settings.nukes} onChange={(e) => setSettings({ ...settings, nukes: e.target.checked })} />
                  {t('Bombes')}
                </label>
              </div>
              <button className="ui-btn" disabled={members.length > PUBLIC_MAX} onClick={() => lobby.start(settings)}>
                {t('Lancer la partie')}
              </button>
            </>
          ) : (
            <p className="of-hint">{t('En attente du lancement par l’hôte…')}</p>
          )}
        </div>
      )}
      {error && <p className="of-error">{error}</p>}
      <button className="of-back" onClick={onBack}>
        {t('Retour')}
      </button>
    </div>
  )
}
