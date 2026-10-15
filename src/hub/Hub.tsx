import { useEffect, useRef, useState, type ReactNode } from 'react'
import { bestScore, dailyResult, playStats } from '../lib/stats'
import { load, normalize, save, weekKey } from '../lib/util'
import Logo from '../ui/Logo'
import './hub.css'

interface Game {
  href: string
  title: string
  tagline: string
  rhythm: 'quotidien' | 'hebdo' | 'libre'
  dailyId?: string
  weekly?: boolean
  art: ReactNode
}

const Glyph = ({ children }: { children: ReactNode }) => <span className="card-glyph">{children}</span>

const SECTIONS: { label: string; games: Game[] }[] = [
  {
    label: 'Géographie',
    games: [
      { href: '#/itineraire', title: 'Travle', tagline: 'Relier deux pays par la terre', rhythm: 'quotidien', dailyId: 'itineraire', art: <Glyph>◎</Glyph> },
      {
        href: '#/itineraire/hebdo',
        title: 'Travle : défi hebdo',
        tagline: 'Un long trajet, chaque lundi',
        rhythm: 'hebdo',
        dailyId: 'itineraire-hebdo',
        weekly: true,
        art: <Glyph>⇢</Glyph>,
      },
      { href: '#/itineraire/usa', title: 'Travle USA', tagline: 'D’un État américain à l’autre', rhythm: 'quotidien', dailyId: 'itineraire-usa', art: <Glyph>★</Glyph> },
      { href: '#/classement', title: 'GeoHunter', tagline: 'Chaque pays dans sa meilleure catégorie', rhythm: 'quotidien', dailyId: 'classement-jour', art: <Glyph>#1</Glyph> },
      { href: '#/cartographe', title: 'Seterra', tagline: 'Situer pays, capitales et drapeaux', rhythm: 'libre', art: <Glyph>⌖</Glyph> },
    ],
  },
  {
    label: 'Magnitudle',
    games: [
      { href: '#/echelle', title: 'Size It Up', tagline: 'La silhouette à sa vraie taille', rhythm: 'quotidien', dailyId: 'echelle-objets', art: <Glyph>↗</Glyph> },
      { href: '#/echelle/geo', title: 'Size It Up : Géographie', tagline: 'La vraie taille des territoires', rhythm: 'quotidien', dailyId: 'echelle-geo', art: <Glyph>▱</Glyph> },
      { href: '#/echelle/1000', title: 'The Weekly 1K', tagline: 'Dix manches sur un thème', rhythm: 'hebdo', dailyId: 'echelle-1000', weekly: true, art: <Glyph>1K</Glyph> },
      { href: '#/balance', title: 'Weigh It Up', tagline: 'Équilibrer la balance', rhythm: 'quotidien', dailyId: 'balance', art: <Glyph>⚖</Glyph> },
      { href: '#/question', title: 'Daily Question', tagline: 'Une question, une estimation', rhythm: 'quotidien', dailyId: 'question', art: <Glyph>Σ</Glyph> },
      { href: '#/survie', title: 'Survival Mode', tagline: 'Estimer vite, rester en vie', rhythm: 'libre', art: <Glyph>♡</Glyph> },
    ],
  },
  {
    label: 'Culture générale',
    games: [
      { href: '#/quiz/jour', title: 'Quiz du jour', tagline: 'Dix questions, les mêmes pour tous', rhythm: 'quotidien', dailyId: 'quiz-jour', art: <Glyph>10</Glyph> },
      { href: '#/quiz', title: 'Quiz culture G', tagline: 'Des milliers de questions', rhythm: 'libre', art: <Glyph>?</Glyph> },
      { href: '#/quiz/drapeaux', title: 'Drapeaux', tagline: 'Un pays, un drapeau', rhythm: 'libre', art: <Glyph>⚑</Glyph> },
      { href: '#/quiz/capitales', title: 'Capitales', tagline: 'Chaque pays et sa capitale', rhythm: 'libre', art: <Glyph>◆</Glyph> },
    ],
  },
]

type Theme = 'sombre' | 'clair'
type Panel = 'profil' | 'reglages' | null

interface Profile {
  name: string
  avatar: string
}

const AVATARS = ['🧭', '🌍', '🗺️', '🦉', '🐢', '🦊', '🐧', '🚀', '⛰️', '🎯', '📚', '🧠']

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  )
}

const ICONS = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  close: 'M18 6 6 18M6 6l12 12',
}

function bestOf(key: string): number | null {
  const list = load<number[]>(key, [])
  return list.length ? Math.max(...list) : null
}

function fmt(v: number | null, unit = ''): string {
  return v === null ? '—' : `${v.toLocaleString('fr-FR')}${unit}`
}

export default function Hub() {
  const [theme, setTheme] = useState<Theme>(() => load<Theme>('theme', 'sombre'))
  const [profile, setProfile] = useState<Profile>(() => load<Profile>('profile', { name: '', avatar: '🧭' }))
  const [panel, setPanel] = useState<Panel>(null)
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const { total, streak } = playStats()

  useEffect(() => {
    if (searching) searchRef.current?.focus()
  }, [searching])

  const isDone = (g: Game) => (g.dailyId ? dailyResult(g.dailyId, g.weekly ? weekKey() : undefined) !== null : false)
  const dailies = SECTIONS.flatMap((s) => s.games).filter((g) => g.rhythm === 'quotidien')
  const doneToday = dailies.filter(isDone).length
  const q = normalize(query)
  const sections = SECTIONS.map((s) => ({
    ...s,
    games: s.games.filter((g) => !q || normalize(`${g.title} ${g.tagline} ${s.label}`).includes(q)),
  })).filter((s) => s.games.length)

  function updateTheme(t: Theme) {
    setTheme(t)
    save('theme', t)
  }

  function updateProfile(p: Partial<Profile>) {
    const next = { ...profile, ...p }
    setProfile(next)
    save('profile', next)
  }

  function closeSearch() {
    setSearching(false)
    setQuery('')
  }

  function resetData() {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('cg:') && k !== 'cg:theme' && k !== 'cg:profile')
      .forEach((k) => localStorage.removeItem(k))
    setConfirmReset(false)
    setPanel(null)
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
    <div className={`home home-${theme}`}>
      <header className="home-head">
        <div className="home-brand">
          <Logo />
          <span>méridien</span>
        </div>
        <div className="home-tools">
          {searching ? (
            <div className="home-search">
              <Icon d={ICONS.search} />
              <input
                ref={searchRef}
                value={query}
                placeholder="Rechercher un jeu…"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && closeSearch()}
              />
              <button onClick={closeSearch} aria-label="Fermer la recherche">
                <Icon d={ICONS.close} />
              </button>
            </div>
          ) : (
            <button className="home-tool" onClick={() => setSearching(true)} aria-label="Rechercher">
              <Icon d={ICONS.search} />
            </button>
          )}
          <button className="home-tool" onClick={() => setPanel(panel === 'reglages' ? null : 'reglages')} aria-label="Réglages">
            <Icon d={ICONS.settings} />
          </button>
          <button className="home-tool home-avatar" onClick={() => setPanel(panel === 'profil' ? null : 'profil')} aria-label="Profil">
            {profile.avatar}
          </button>
        </div>
      </header>

      <main className="home-main">
        <section className="home-intro">
          <h1>{profile.name ? `Bonjour ${profile.name}.` : 'Bonjour.'}</h1>
          <p>
            {doneToday}/{dailies.length} jeux du jour · série de {streak} jour{streak > 1 ? 's' : ''} · {total} partie{total > 1 ? 's' : ''}
          </p>
        </section>

        {sections.length === 0 && <p className="home-empty">Aucun jeu ne correspond à « {query} ».</p>}
        {sections.map((section) => (
          <section key={section.label} className="home-section">
            <h2>{section.label}</h2>
            <div className="home-grid">
              {section.games.map((g) => {
                const done = isDone(g)
                return (
                  <a key={g.href} href={g.href} className="home-card">
                    <span className={done ? 'home-card-state done' : 'home-card-state'}>{done ? '✓ joué' : g.rhythm}</span>
                    <div className="home-card-art">{g.art}</div>
                    <div className="home-card-text">
                      <b>{g.title}</b>
                      <span>{g.tagline}</span>
                    </div>
                  </a>
                )
              })}
            </div>
          </section>
        ))}
      </main>

      {panel && (
        <div className="home-panel-bg" onClick={() => setPanel(null)}>
          <aside className="home-panel" onClick={(e) => e.stopPropagation()}>
            <button className="home-tool home-panel-close" onClick={() => setPanel(null)} aria-label="Fermer">
              <Icon d={ICONS.close} />
            </button>
            {panel === 'profil' ? (
              <>
                <h3>Profil</h3>
                <label className="home-field">
                  <span>Pseudo</span>
                  <input value={profile.name} maxLength={24} placeholder="Ton pseudo" onChange={(e) => updateProfile({ name: e.target.value })} />
                </label>
                <div className="home-field">
                  <span>Avatar</span>
                  <div className="home-avatars">
                    {AVATARS.map((a) => (
                      <button key={a} className={a === profile.avatar ? 'on' : ''} onClick={() => updateProfile({ avatar: a })}>
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="home-figures">
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
                <ul className="home-records">
                  {records.map(([label, value]) => (
                    <li key={label}>
                      <span>{label}</span>
                      <b>{value}</b>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <h3>Réglages</h3>
                <div className="home-field">
                  <span>Thème</span>
                  <div className="home-seg">
                    {(['sombre', 'clair'] as Theme[]).map((t) => (
                      <button key={t} className={theme === t ? 'on' : ''} onClick={() => updateTheme(t)}>
                        {t === 'sombre' ? 'Sombre' : 'Clair'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="home-field">
                  <span>Données</span>
                  <p className="home-note">Tes parties, séries et records sont enregistrés uniquement dans ce navigateur.</p>
                  {confirmReset ? (
                    <div className="home-confirm">
                      <span>Tout effacer ? Cette action est définitive.</span>
                      <button className="danger" onClick={resetData}>
                        Oui, effacer
                      </button>
                      <button onClick={() => setConfirmReset(false)}>Annuler</button>
                    </div>
                  ) : (
                    <button className="home-btn-line" onClick={() => setConfirmReset(true)}>
                      Réinitialiser mes données
                    </button>
                  )}
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
