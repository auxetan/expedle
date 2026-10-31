import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { evaluate, levelOf } from '../lib/achievements'
import { PROFILE_CHANGED, pushProfile } from '../lib/cloud'
import AccountBox from './Account'
import { LANGS, ordinal, plural, setLang, t, useLang } from '../lib/i18n'
import { due } from '../lib/savoir'
import { dailyResult, plays, summarize } from '../lib/stats'
import { load, normalize, save, weekKey } from '../lib/util'
import GameIcon from './GameIcon'
import { familiesOf, GAME_SECTIONS } from './games'
import { setTheme, useTheme, type Theme } from './theme'
import { feedback, feedbackSettings, saveFeedbackSettings, type FeedbackSettings } from '../lib/feedback'
import InstallButton from './InstallButton'
import { Pepites, useWallet } from './Pepites'
import { PREMIUM_AVATARS } from './shop'
import { useWeekRank } from './useWeekRank'

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
  map: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15',
  bag: 'M6 8h12l-1 12H7L6 8zM9 8V6a3 3 0 0 1 6 0v2',
  swords: 'M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M9.5 17.5 21 6V3h-3L6.5 14.5M5 13l6 6M8 16l-4 4M3 19l2 2',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
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

// une destination du menu Profil, au même style que la liste des jeux
function Row({ href, icon, label, end, onPick }: { href: string; icon: string; label: string; end?: ReactNode; onPick?: () => void }) {
  return (
    <a href={href} className="ui-game-row" onClick={onPick}>
      <span className="ui-game-glyph">
        <Icon d={icon} />
      </span>
      <b>{label}</b>
      {end && <span className="ui-row-end">{end}</span>}
    </a>
  )
}

// Le menu Profil : qui tu es, puis tout ce qui n'est pas un jeu, rangé par groupes. Les réglages d'un jeu
// (`extra`) passent en tête des réglages ; `focus` ouvre le menu directement sur eux.
export function ProfilePanel({ onChange, onPick, extra, focus }: { onChange?: (p: Profile) => void; onPick?: () => void; extra?: ReactNode; focus?: 'reglages' }) {
  const [profile, setProfile] = useState(loadProfile)
  const [editing, setEditing] = useState(false)
  const settingsRef = useRef<HTMLElement>(null)
  const { owned, balance } = useWallet()
  const weekRank = useWeekRank()
  const duelWins = plays().filter((p) => p.g === 'duel' && p.win).length
  // les avatars offerts, puis ceux achetés dans la boutique
  const avatars = [...AVATARS, ...PREMIUM_AVATARS.map(([a]) => a).filter((a) => owned.has(`avatar:${a}`))]
  const history = plays()
  const { total, streak } = summarize(history)
  const level = levelOf(history, evaluate(history))
  const toReview = due().length

  // le profil peut arriver du compte (connexion sur un nouvel appareil)
  useEffect(() => {
    const refresh = () => setProfile(loadProfile())
    window.addEventListener(PROFILE_CHANGED, refresh)
    return () => window.removeEventListener(PROFILE_CHANGED, refresh)
  }, [])

  useEffect(() => {
    if (focus === 'reglages') settingsRef.current?.scrollIntoView({ block: 'start' })
  }, [focus])

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
      <section className="ui-me">
        <span className="ui-me-avatar">{profile.avatar}</span>
        <span className="ui-me-text">
          <b className={profile.name ? '' : 'empty'}>{profile.name || t('Ton pseudo')}</b>
          <a href="#/succes" className="ui-me-level" onClick={onPick}>
            {t('Niveau {n}', { n: level.level })} · {t(level.title)}
            <i>
              <i style={{ width: `${(level.into / level.need) * 100}%` }} />
            </i>
          </a>
          <small>
            {streak} {plural(streak, 'jour de série', 'jours de série')} · {total} {plural(total, 'partie', 'parties')}
          </small>
        </span>
        <button className="ui-me-edit" onClick={() => setEditing(!editing)} aria-expanded={editing}>
          {editing ? t('Fermer') : t('Modifier')}
        </button>
      </section>
      {editing && (
        <div className="ui-me-form">
          <label className="ui-field">
            <span>{t('Pseudo')}</span>
            <input value={profile.name} maxLength={24} placeholder={t('Ton pseudo')} onChange={(e) => update({ name: e.target.value })} />
          </label>
          <div className="ui-field">
            <span>{t('Avatar')}</span>
            <div className="ui-avatars">
              {avatars.map((a) => (
                <button key={a} className={a === profile.avatar ? 'on' : ''} onClick={() => update({ avatar: a })}>
                  {a}
                </button>
              ))}
            </div>
            <a href="#/boutique" className="ui-note" onClick={onPick}>
              {t('D’autres avatars t’attendent dans la boutique.')}
            </a>
          </div>
        </div>
      )}
      <h4>{t('Progression')}</h4>
      <Row href="#/succes" icon={ICONS.trophy} label={t('Mes succès')} onPick={onPick} />
      <Row href="#/stats" icon={ICONS.chart} label={t('Statistiques')} onPick={onPick} />
      <Row href="#/passeport" icon={ICONS.passport} label={t('Mon passeport')} onPick={onPick} />
      <Row
        href="#/savoir"
        icon={ICONS.map}
        label={t('Ma carte du savoir')}
        end={toReview > 0 && <small className="ui-row-note">{t('{n} à revoir', { n: toReview })}</small>}
        onPick={onPick}
      />
      <h4>{t('Entre joueurs')}</h4>
      <Row
        href="#/classements"
        icon={ICONS.podium}
        label={t('Classements')}
        end={weekRank && <small className="ui-row-note">{t('{rank} cette semaine', { rank: ordinal(weekRank) })}</small>}
        onPick={onPick}
      />
      <Row href="#/defis" icon={ICONS.swords} label={t('Défis entre amis')} onPick={onPick} />
      <Row
        href="#/duel"
        icon={ICONS.bolt}
        label={t('Duel en direct')}
        end={duelWins > 0 && <small className="ui-row-note">{plural(duelWins, '{n} victoire', '{n} victoires')}</small>}
        onPick={onPick}
      />
      <h4>{t('Pépites')}</h4>
      <Row href="#/boutique" icon={ICONS.bag} label={t('Boutique et quêtes du jour')} end={<Pepites n={balance} />} onPick={onPick} />
      <div className="ui-me-account">
        <AccountBox />
      </div>
      <section ref={settingsRef} className="ui-me-settings">
        <h4>{t('Réglages')}</h4>
        {extra && (
          <div className="ui-extra">
            <h5>{t('Réglages de ce jeu')}</h5>
            {extra}
          </div>
        )}
        <Settings />
      </section>
    </>
  )
}

// l'AGPL demande d'offrir le code à qui utilise le site
const SOURCE = 'https://github.com/auxetan/m-ridien'

// Les réglages du site, en bas du menu Profil.
function Settings() {
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
      <div className="ui-field">
        <span>{t('Code source')}</span>
        <p className="ui-note">
          {t('Expedle est un logiciel libre sous licence AGPL-3.0. Son jeu Frontières est adapté du jeu libre OpenFront, dont il reprend des icônes, des sprites et des sons (CC BY-SA 4.0) et du code (AGPL-3.0).')} © OpenFront and Contributors.{' '}
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

// Le menu Jeux : rien que les jeux, à chercher ou à parcourir par rubrique et par famille.
export function GamesPanel({ onPick }: { onPick: () => void }) {
  const current = window.location.hash.split('?')[0]
  const [query, setQuery] = useState('')
  // au doigt, le clavier ne s'ouvre pas tout seul
  const [fine] = useState(() => matchMedia('(pointer: fine)').matches)
  const q = normalize(query)
  // la recherche marche dans la langue du site comme en français
  const sections = GAME_SECTIONS.map((s) => ({
    ...s,
    games: s.games.filter((g) => !q || normalize(`${t(g.title)} ${t(g.tagline)} ${t(s.label)} ${g.family ? t(g.family) : ''} ${g.title} ${g.tagline}`).includes(q)),
  })).filter((s) => s.games.length)
  const first = sections[0]?.games[0]

  return (
    <>
      <h3>{t('Jeux')}</h3>
      <label className="ui-search">
        <Icon d={ICONS.search} />
        <input
          value={query}
          autoFocus={fine}
          placeholder={t('Rechercher un jeu…')}
          aria-label={t('Rechercher un jeu…')}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || !q || !first) return
            window.location.hash = first.href
            onPick()
          }}
        />
      </label>
      {!q && (
        <a href="#/" className="ui-game-row" onClick={onPick}>
          <span className="ui-game-glyph">
            <Icon d={ICONS.home} />
          </span>
          <b>{t('Accueil')}</b>
        </a>
      )}
      {sections.length === 0 && <p className="ui-note">{t('Aucun jeu ne correspond à « {query} ».', { query })}</p>}
      {sections.map((s) => (
        <div key={s.label} className="ui-game-section" data-tint={s.tint}>
          <h4>{t(s.label)}</h4>
          {familiesOf(s.games).map((f) => (
            <div key={f.family ?? s.label} className="ui-game-family">
              {f.family && <h5>{t(f.family)}</h5>}
              {f.games.map((g) => (
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
        </div>
      ))}
    </>
  )
}
