import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { evaluate, levelOf } from '../lib/achievements'
import { PROFILE_CHANGED, pushProfile } from '../lib/cloud'
import AccountBox from './Account'
import { LANGS, plural, setLang, t, useLang } from '../lib/i18n'
import { dailyResult, plays, summarize } from '../lib/stats'
import { load, save, weekKey } from '../lib/util'
import GameIcon from './GameIcon'
import { ALL_GAMES, GAME_SECTIONS } from './games'
import { setTheme, useTheme, type Theme } from './theme'
import { feedback, feedbackSettings, saveFeedbackSettings, type FeedbackSettings } from '../lib/feedback'
import InstallButton from './InstallButton'

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
  passport: 'M6 3h12v18H6zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM9 17h6',
  swords: 'M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M9.5 17.5 21 6V3h-3L6.5 14.5M5 13l6 6M8 16l-4 4M3 19l2 2',
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
        <button className="ui-tool ui-drawer-close" onClick={close} aria-label={t('Fermer')}>
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

  // le profil peut arriver du compte (connexion sur un nouvel appareil)
  useEffect(() => {
    const refresh = () => setProfile(loadProfile())
    window.addEventListener(PROFILE_CHANGED, refresh)
    return () => window.removeEventListener(PROFILE_CHANGED, refresh)
  }, [])

  function update(patch: Partial<Profile>) {
    const next = { ...profile, ...patch }
    setProfile(next)
    save('profile', next)
    onChange?.(next)
    pushProfile(next)
  }

  return (
    <>
      <h3>{t('Profil')}</h3>
      <label className="ui-field">
        <span>{t('Pseudo')}</span>
        <input value={profile.name} maxLength={24} placeholder={t('Ton pseudo')} onChange={(e) => update({ name: e.target.value })} />
      </label>
      <div className="ui-field">
        <span>{t('Avatar')}</span>
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
          <b>{total}</b>
          {plural(total, 'partie', 'parties')}
        </div>
        <div>
          <b>{streak}</b>
          {plural(streak, 'jour de série', 'jours de série')}
        </div>
        <div>
          <b>{level.level}</b>
          {t(level.title).toLowerCase()}
        </div>
      </div>
      <p className="ui-note">
        {t('{done}/{total} jeux du jour terminés aujourd’hui.', { done: doneToday, total: dailies.length })}
      </p>
      <AccountBox />
      <a href="#/classements" className="ui-btn-line ui-stats-link">
        <Icon d={ICONS.podium} />
        {t('Classements')}
      </a>
      <a href="#/passeport" className="ui-btn-line ui-stats-link">
        <Icon d={ICONS.passport} />
        {t('Mon passeport')}
      </a>
      <a href="#/defis" className="ui-btn-line ui-stats-link">
        <Icon d={ICONS.swords} />
        {t('Défis entre amis')}
      </a>
      <a href="#/succes" className="ui-btn-line ui-stats-link">
        <Icon d={ICONS.trophy} />
        {t('Mes succès')}
      </a>
      <a href="#/stats" className="ui-btn-line ui-stats-link">
        <Icon d={ICONS.chart} />
        {t('Toutes mes statistiques')}
      </a>
    </>
  )
}

// l'AGPL demande d'offrir le code à qui utilise le site
const SOURCE = 'https://github.com/auxetan/m-ridien'

export function SettingsPanel({ extra }: { extra?: ReactNode }) {
  const theme = useTheme()
  const lang = useLang()
  const [confirm, setConfirm] = useState(false)
  const [fx, setFx] = useState(feedbackSettings)

  function setFeedback(patch: Partial<FeedbackSettings>) {
    const next = { ...fx, ...patch }
    setFx(next)
    saveFeedbackSettings(next)
    // on entend tout de suite ce qu'on vient d'activer
    if (patch.sound || patch.haptics) feedback('good')
  }

  function reset() {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('cg:') && !['cg:theme', 'cg:profile', 'cg:lang', 'cg:feedback'].includes(k))
      .forEach((k) => localStorage.removeItem(k))
    setConfirm(false)
    window.location.reload()
  }

  return (
    <>
      <h3>{t('Réglages')}</h3>
      <div className="ui-field">
        <span>{t('Langue')}</span>
        <div className="ui-seg">
          {LANGS.map((l) => (
            <button key={l.id} lang={l.id} className={lang === l.id ? 'on' : ''} onClick={() => setLang(l.id)}>
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <div className="ui-field">
        <span>{t('Thème')}</span>
        <div className="ui-seg">
          {(['sombre', 'clair'] as Theme[]).map((th) => (
            <button key={th} className={theme === th ? 'on' : ''} onClick={() => setTheme(th)}>
              {th === 'sombre' ? t('Sombre') : t('Clair')}
            </button>
          ))}
        </div>
      </div>
      <div className="ui-field">
        <span>{t('Sons')}</span>
        <div className="ui-seg">
          {[true, false].map((on) => (
            <button key={String(on)} className={fx.sound === on ? 'on' : ''} onClick={() => setFeedback({ sound: on })}>
              {on ? t('Activés') : t('Coupés')}
            </button>
          ))}
        </div>
      </div>
      {'vibrate' in navigator && (
        <div className="ui-field">
          <span>{t('Vibrations')}</span>
          <div className="ui-seg">
            {[true, false].map((on) => (
              <button key={String(on)} className={fx.haptics === on ? 'on' : ''} onClick={() => setFeedback({ haptics: on })}>
                {on ? t('Activées') : t('Coupées')}
              </button>
            ))}
          </div>
        </div>
      )}
      <InstallButton />
      {extra}
      <div className="ui-field">
        <span>{t('Code source')}</span>
        <p className="ui-note">
          {t('Expedle est un logiciel libre sous licence AGPL-3.0. Son jeu Frontières est adapté du jeu libre OpenFront, dont il reprend des icônes et des sprites (CC BY-SA 4.0) et du code (AGPL-3.0).')} © OpenFront and Contributors.{' '}
          <a href={SOURCE} target="_blank" rel="noreferrer">
            {t('Voir le code')}
          </a>
        </p>
      </div>
      <div className="ui-field">
        <span>{t('Données')}</span>
        <p className="ui-note">{t('Tes parties, séries et records sont enregistrés uniquement dans ce navigateur.')}</p>
        {confirm ? (
          <div className="ui-confirm">
            <span>{t('Tout effacer ? Cette action est définitive.')}</span>
            <button className="danger" onClick={reset}>
              {t('Oui, effacer')}
            </button>
            <button onClick={() => setConfirm(false)}>{t('Annuler')}</button>
          </div>
        ) : (
          <button className="ui-btn-line" onClick={() => setConfirm(true)}>
            {t('Réinitialiser mes données')}
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
      <h3>{t('Jeux')}</h3>
      <a href="#/" className="ui-game-row" onClick={onPick}>
        <span className="ui-game-glyph">
          <Icon d={ICONS.home} />
        </span>
        <b>{t('Accueil')}</b>
      </a>
      <a href="#/stats" className={current === '#/stats' ? 'ui-game-row on' : 'ui-game-row'} onClick={onPick}>
        <span className="ui-game-glyph">
          <Icon d={ICONS.chart} />
        </span>
        <b>{t('Statistiques')}</b>
      </a>
      {GAME_SECTIONS.map((s) => (
        <div key={s.label} className="ui-game-section">
          <h4>{t(s.label)}</h4>
          {s.games.map((g) => (
            <a key={g.href} href={g.href} className={current === g.href ? 'ui-game-row on' : 'ui-game-row'} onClick={onPick}>
              <span className="ui-game-glyph">
                <GameIcon icon={g.icon} size={30} />
              </span>
              <span className="ui-game-text">
                <b>{t(g.title)}</b>
                <small>{t(g.tagline)}</small>
              </span>
              {isDoneToday(g) && <span className="ui-game-done">✓</span>}
            </a>
          ))}
        </div>
      ))}
    </>
  )
}
