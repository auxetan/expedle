import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { evaluate, levelOf } from '../lib/achievements'
import { dailyResult, plays, summarize } from '../lib/stats'
import { load, save, weekKey } from '../lib/util'
import GameIcon from './GameIcon'
import { ALL_GAMES, GAME_SECTIONS } from './games'
import { setTheme, useTheme, type Theme } from './theme'

export interface Profile {
  name: string
  avatar: string
}

const AVATARS = ['🧭', '🌍', '🗺️', '🦉', '🐢', '🦊', '🐧', '🚀', '⛰️', '🎯', '📚', '🧠']

export function loadProfile(): Profile {
  return load<Profile>('profile', { name: '', avatar: '🧭' })
}

export function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  )
}

export const ICONS = {
  back: 'M15 18l-6-6 6-6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  close: 'M18 6 6 18M6 6l12 12',
  home: 'M3 10.5 12 3l9 7.5M5.5 9v11h13V9',
  chart: 'M4 20h16M7 16v-4M12 16V7M17 16v-7',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9.5 17h5',
  podium: 'M3 20h18M5 20v-6h4v6M10 20V9h4v11M15 20v-8h4v8',
}

export function isDoneToday(g: { dailyId?: string; weekly?: boolean }): boolean {
  return g.dailyId ? dailyResult(g.dailyId, g.weekly ? weekKey() : undefined) !== null : false
}

export function Drawer({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const [closing, setClosing] = useState(false)
  const close = useCallback(() => {
    setClosing(true)
    setTimeout(onClose, 180)
  }, [onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  return (
    <div className={closing ? 'ui-drawer-bg out' : 'ui-drawer-bg'} onClick={close}>
      <aside className="ui-drawer" onClick={(e) => e.stopPropagation()}>
        <button className="ui-tool ui-drawer-close" onClick={close} aria-label="Fermer">
          <Icon d={ICONS.close} />
        </button>
        {children}
      </aside>
    </div>
  )
}

export function ProfilePanel({ onChange }: { onChange?: (p: Profile) => void }) {
  const [profile, setProfile] = useState(loadProfile)
  const history = plays()
  const { total, streak } = summarize(history)
  const level = levelOf(history, evaluate(history))
  const dailies = ALL_GAMES.filter((g) => g.rhythm === 'quotidien')
  const doneToday = dailies.filter(isDoneToday).length

  function update(patch: Partial<Profile>) {
    const next = { ...profile, ...patch }
    setProfile(next)
    save('profile', next)
    onChange?.(next)
  }

  return (
    <>
      <h3>Profil</h3>
      <label className="ui-field">
        <span>Pseudo</span>
        <input value={profile.name} maxLength={24} placeholder="Ton pseudo" onChange={(e) => update({ name: e.target.value })} />
      </label>
      <div className="ui-field">
        <span>Avatar</span>
        <div className="ui-avatars">
          {AVATARS.map((a) => (
            <button key={a} className={a === profile.avatar ? 'on' : ''} onClick={() => update({ avatar: a })}>
              {a}
            </button>
          ))}
        </div>
      </div>
      <div className="ui-figures">
        <div>
          <b>{total}</b>parties
        </div>
        <div>
          <b>{streak}</b>jours de série
        </div>
        <div>
          <b>{level.level}</b>
          {level.title.toLowerCase()}
        </div>
      </div>
      <p className="ui-note">
        {doneToday}/{dailies.length} jeux du jour terminés aujourd’hui.
      </p>
      <a href="#/succes" className="ui-btn-line ui-stats-link">
        <Icon d={ICONS.trophy} />
        Mes succès
      </a>
      <a href="#/stats" className="ui-btn-line ui-stats-link">
        <Icon d={ICONS.chart} />
        Toutes mes statistiques
      </a>
    </>
  )
}

export function SettingsPanel({ extra }: { extra?: ReactNode }) {
  const theme = useTheme()
  const [confirm, setConfirm] = useState(false)

  function reset() {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('cg:') && k !== 'cg:theme' && k !== 'cg:profile')
      .forEach((k) => localStorage.removeItem(k))
    setConfirm(false)
    window.location.reload()
  }

  return (
    <>
      <h3>Réglages</h3>
      <div className="ui-field">
        <span>Thème</span>
        <div className="ui-seg">
          {(['sombre', 'clair'] as Theme[]).map((t) => (
            <button key={t} className={theme === t ? 'on' : ''} onClick={() => setTheme(t)}>
              {t === 'sombre' ? 'Sombre' : 'Clair'}
            </button>
          ))}
        </div>
      </div>
      {extra}
      <div className="ui-field">
        <span>Données</span>
        <p className="ui-note">Tes parties, séries et records sont enregistrés uniquement dans ce navigateur.</p>
        {confirm ? (
          <div className="ui-confirm">
            <span>Tout effacer ? Cette action est définitive.</span>
            <button className="danger" onClick={reset}>
              Oui, effacer
            </button>
            <button onClick={() => setConfirm(false)}>Annuler</button>
          </div>
        ) : (
          <button className="ui-btn-line" onClick={() => setConfirm(true)}>
            Réinitialiser mes données
          </button>
        )}
      </div>
    </>
  )
}

export function GamesPanel({ onPick }: { onPick: () => void }) {
  const current = window.location.hash.split('?')[0]
  return (
    <>
      <h3>Jeux</h3>
      <a href="#/" className="ui-game-row" onClick={onPick}>
        <span className="ui-game-glyph">
          <Icon d={ICONS.home} />
        </span>
        <b>Accueil</b>
      </a>
      <a href="#/stats" className={current === '#/stats' ? 'ui-game-row on' : 'ui-game-row'} onClick={onPick}>
        <span className="ui-game-glyph">
          <Icon d={ICONS.chart} />
        </span>
        <b>Statistiques</b>
      </a>
      {GAME_SECTIONS.map((s) => (
        <div key={s.label} className="ui-game-section">
          <h4>{s.label}</h4>
          {s.games.map((g) => (
            <a key={g.href} href={g.href} className={current === g.href ? 'ui-game-row on' : 'ui-game-row'} onClick={onPick}>
              <span className="ui-game-glyph">
                <GameIcon icon={g.icon} size={30} />
              </span>
              <span className="ui-game-text">
                <b>{g.title}</b>
                <small>{g.tagline}</small>
              </span>
              {isDoneToday(g) && <span className="ui-game-done">✓</span>}
            </a>
          ))}
        </div>
      ))}
    </>
  )
}
