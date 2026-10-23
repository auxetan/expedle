// Le salon en ligne, comme sur OpenFront : créer une partie et donner son code, ou rejoindre celle d'un ami.
// L'hôte choisit les réglages et lance ; tous partent alors avec la même graine.
import { useEffect, useRef, useState } from 'react'
import { t } from '../../lib/i18n'
import { copyText, load } from '../../lib/util'
import { BOTS, LEVEL_NAMES, LEVELS, TRIBES } from './choices'
import { Lobby, newCode, type LobbySettings, type Member, type Start } from './net'

export default function Salon({ name, skin, onStart, onBack }: { name: string; skin: string; onStart: (lobby: Lobby, start: Start) => void; onBack: () => void }) {
  const [lobby, setLobby] = useState<Lobby | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [settings, setSettings] = useState<LobbySettings>(() => ({ level: load('openfront-niveau', 'moyen'), bots: TRIBES, nations: true, nukes: true }))
  // un salon quitté avant le lancement se ferme ; lancé, il appartient à la partie
  const started = useRef(false)

  useEffect(
    () => () => {
      if (!started.current) lobby?.leave()
    },
    [lobby],
  )

  async function open(roomCode: string, host: boolean) {
    setBusy(true)
    setError('')
    try {
      const next = await Lobby.open(roomCode, host, name, skin)
      next.onMembers = setMembers
      next.onStart = (start) => {
        started.current = true
        onStart(next, start)
      }
      next.onClose = () => {
        setError(t('L’hôte a fermé le salon.'))
        setLobby(null)
      }
      setMembers(next.members)
      setLobby(next)
    } catch (e) {
      setError((e as Error).message === 'introuvable' ? t('Aucun salon ouvert avec ce code.') : t('Connexion impossible pour l’instant.'))
    }
    setBusy(false)
  }

  return (
    <div className="of-home">
      <header>
        <h2>{t('Multijoueur')}</h2>
        <small>{t('Jusqu’à huit joueurs, avec les nations et les bots')}</small>
      </header>
      {!lobby ? (
        <>
          <div className="of-play">
            <button className="primary" disabled={busy} onClick={() => open(newCode(), true)}>
              <b>{t('Créer un salon')}</b>
              <small>{t('Tu choisis les réglages et lances la partie')}</small>
            </button>
          </div>
          <form
            className="of-join"
            onSubmit={(e) => {
              e.preventDefault()
              if (code.length === 5) open(code, false)
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
          <ul className="of-members">
            {members.map((m) => (
              <li key={m.key}>
                <span>{m.name}</span>
                <small>{m.host ? t('Hôte') : m.key === lobby.key ? t('Toi') : ''}</small>
              </li>
            ))}
          </ul>
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
              <button className="ui-btn" disabled={members.length > 8} onClick={() => lobby.start(settings)}>
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
