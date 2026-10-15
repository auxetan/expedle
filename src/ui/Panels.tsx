import { useState, type ReactNode } from 'react'
import { bestScore, dailyResult, playStats } from '../lib/stats'
import { load, save, weekKey } from '../lib/util'
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
}

export function isDoneToday(g: { dailyId?: string; weekly?: boolean }): boolean {
  return g.dailyId ? dailyResult(g.dailyId, g.weekly ? weekKey() : undefined) !== null : false
}

export function Drawer({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="ui-drawer-bg" onClick={onClose}>
      <aside className="ui-drawer" onClick={(e) => e.stopPropagation()}>
        <button className="ui-tool ui-drawer-close" onClick={onClose} aria-label="Fermer">
          <Icon d={ICONS.close} />
        </button>
        {children}
      </aside>
    </div>
  )
}

function bestOf(key: string): number | null {
  const list = load<number[]>(key, [])
  return list.length ? Math.max(...list) : null
}

function fmt(v: number | null, unit = ''): string {
  return v === null ? '—' : `${v.toLocaleString('fr-FR')}${unit}`
}

export function ProfilePanel({ onChange }: { onChange?: (p: Profile) => void }) {
  const [profile, setProfile] = useState(loadProfile)
  const { total, streak } = playStats()
  const dailies = ALL_GAMES.filter((g) => g.rhythm === 'quotidien')
  const doneToday = dailies.filter(isDoneToday).length

  function update(patch: Partial<Profile>) {
    const next = { ...profile, ...patch }
    setProfile(next)
    save('profile', next)
    onChange?.(next)
  }

  const records: [string, string][] = [
    ['Size It Up', fmt(bestOf('mg-hist:echelle-objets'))],
    ['Size It Up : Géographie', fmt(bestOf('mg-hist:echelle-geo'))],
    ['GeoHunter (classique)', fmt(bestScore('classement-classique'))],
    ['Survival Mode', fmt(bestScore('survie'), ' questions')],
    ['Seterra Europe', fmt(bestScore('carto-europe'), ' %')],
    ['Quiz culture G', fmt(bestScore('quiz-culture'), ' pts')],
  ]

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
          <b>
            {doneToday}/{dailies.length}
          </b>
          jeux du jour
        </div>
      </div>
      <h4>Records</h4>
      <ul className="ui-records">
        {records.map(([label, value]) => (
          <li key={label}>
            <span>{label}</span>
            <b>{value}</b>
          </li>
        ))}
      </ul>
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
      <a href="#/" className="ui-game-row home" onClick={onPick}>
        <span className="ui-game-glyph">
          <Icon d={ICONS.home} />
        </span>
        <b>Accueil</b>
      </a>
      {GAME_SECTIONS.map((s) => (
        <div key={s.label} className="ui-game-section">
          <h4>{s.label}</h4>
          {s.games.map((g) => (
            <a key={g.href} href={g.href} className={current === g.href ? 'ui-game-row on' : 'ui-game-row'} onClick={onPick}>
              <span className="ui-game-glyph">{g.glyph}</span>
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
