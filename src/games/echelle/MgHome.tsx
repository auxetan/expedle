import { useMemo, type ReactNode } from 'react'
import { dailyResult, playStats } from '../../lib/stats'
import { load, todayKey, weekKey } from '../../lib/util'
import HomeButton from '../../ui/HomeButton'
import { weeklyTheme } from './Echelle'
import './mg.css'

interface Card {
  href: string
  title: string
  text: string
  badge: string
  dailyId?: string
  day?: string
  art: ReactNode
}

const Sil = ({ e, red, size }: { e: string; red?: boolean; size?: number }) => (
  <span className={red ? 'mgh-sil red' : 'mgh-sil'} style={size ? { fontSize: size } : undefined}>
    {e}
  </span>
)
const Arrow = () => <span className="mgh-arrow">→</span>

function Logo() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />
    </svg>
  )
}

export default function MgHome() {
  const { streak } = playStats()
  const best = Math.max(0, ...load<number[]>('mg-hist:echelle-objets', []))
  const big: Card[] = [
    {
      href: '#/echelle',
      title: 'À l’échelle',
      text: 'L’échelle des objets réels.',
      badge: 'QUOTIDIEN',
      dailyId: 'echelle-objets',
      art: (
        <>
          <Sil e="🦒" />
          <Arrow />
          <Sil e="🐈" red size={44} />
        </>
      ),
    },
    {
      href: '#/echelle/1000',
      title: 'Le 1 000',
      text: `Dix manches · ${weeklyTheme().name.toLowerCase()}.`,
      badge: 'HEBDO',
      dailyId: 'echelle-1000',
      day: weekKey(),
      art: <span className="mgh-num">1000</span>,
    },
    {
      href: '#/echelle/geo',
      title: 'Géographie',
      text: 'L’échelle des territoires.',
      badge: 'QUOTIDIEN',
      dailyId: 'echelle-geo',
      art: (
        <svg viewBox="0 0 140 70" width="150" height="75" aria-hidden>
          <path d="M14 22l16-3 6 9 12 2-2 14-12 5-5 10-10-5-5-12-7-5z" fill="#8a8fa3" />
          <text x="64" y="40" fill="#8a8fa3" fontSize="10">
            →
          </text>
          <path d="M100 14l7 2-2 9 7 7-3 12 9 9-7 5-11-5-2-12 2-9-5-7z" fill="#f2554b" />
        </svg>
      ),
    },
  ]
  const more: Card[] = [
    { href: '#/balance', title: 'La Balance', text: 'Équilibre le poids réel.', badge: 'QUOTIDIEN', dailyId: 'balance', art: <span className="mgh-glyph">⚖</span> },
    { href: '#/question', title: 'Question du jour', text: 'Une question. Une estimation.', badge: 'QUOTIDIEN', dailyId: 'question', art: <span className="mgh-glyph">Σ</span> },
    { href: '#/survie', title: 'Survie', text: 'Estime vite. Reste en vie.', badge: 'DÉFI', art: <span className="mgh-glyph">♡</span> },
    { href: '#/estimation/archive', title: 'Archive', text: 'Rejoue tous les puzzles passés.', badge: 'TOUS LES PUZZLES', art: <span className="mgh-glyph">≋</span> },
  ]
  const isDone = (c: Card) => (c.dailyId ? dailyResult(c.dailyId, c.day ?? todayKey()) !== null : false)

  return (
    <div className="mg mgh">
      <header className="mgh-head">
        <div className="mgh-brand">
          <div className="mgh-logo">
            <Logo />
          </div>
          <div>
            <h1>Grandeurs</h1>
            <p>Le jeu des échelles et des estimations</p>
          </div>
        </div>
        <div className="mgh-stats">
          <div>
            <small>🔥 SÉRIE</small>
            <b>{streak}</b>
          </div>
          <div>
            <small>🏆 RECORD</small>
            <b>{best || '—'}</b>
          </div>
          <HomeButton className="mgh-home" />
        </div>
      </header>
      <h2 className="mgh-section red">À L’ÉCHELLE</h2>
      <div className="mgh-big">
        {big.map((c) => (
          <a key={c.href} href={c.href} className="mgh-card">
            <span className={isDone(c) ? 'mgh-badge done' : 'mgh-badge'}>{isDone(c) ? '✓ FAIT' : c.badge}</span>
            <div className="mgh-art">{c.art}</div>
            <div className="mgh-foot">
              <div>
                <h3>{c.title}</h3>
                <p>{c.text}</p>
              </div>
              <span className="mgh-play">Jouer →</span>
            </div>
          </a>
        ))}
      </div>
      <h2 className="mgh-section">AUTRES FAÇONS DE JOUER</h2>
      <div className="mgh-small">
        {more.map((c) => (
          <a key={c.href} href={c.href} className="mgh-card small">
            <div className="mgh-art-s">{c.art}</div>
            <h3>{c.title}</h3>
            <p>{c.text}</p>
            <div className="mgh-foot-s">
              <span className={isDone(c) ? 'mgh-badge done' : 'mgh-badge'}>{isDone(c) ? '✓ FAIT' : c.badge}</span>
              <span className="mgh-round">→</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

const ARCHIVE_GAMES = [
  { id: 'echelle-objets', label: 'À l’échelle', href: '#/echelle' },
  { id: 'echelle-geo', label: 'Géographie', href: '#/echelle/geo' },
  { id: 'balance', label: 'La Balance', href: '#/balance' },
  { id: 'question', label: 'Question du jour', href: '#/question' },
]

export function MgArchive() {
  const days = useMemo(() => {
    const out: string[] = []
    const d = new Date()
    for (let i = 0; i < 30; i++) {
      out.push(todayKey(d))
      d.setDate(d.getDate() - 1)
    }
    return out
  }, [])
  return (
    <div className="mg mgh">
      <header className="mgh-head">
        <div className="mgh-brand">
          <a href="#/estimation" className="mgh-logo">
            <Logo />
          </a>
          <div>
            <h1>Archive</h1>
            <p>Rejoue tous les puzzles passés</p>
          </div>
        </div>
        <HomeButton className="mgh-home" />
      </header>
      <div className="mga-table">
        <div className="mga-row mga-headrow">
          <span>DATE</span>
          {ARCHIVE_GAMES.map((g) => (
            <span key={g.id}>{g.label}</span>
          ))}
        </div>
        {days.map((day) => (
          <div key={day} className="mga-row">
            <span className="mga-date">{new Date(day + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
            {ARCHIVE_GAMES.map((g) => {
              const res = dailyResult<{ scores?: number[]; score?: number }>(g.id, day)
              const score = res?.scores ? res.scores.reduce((a, b) => a + b, 0) : res?.score
              return (
                <a key={g.id} href={`${g.href}?date=${day}`} className={res ? 'mga-cell done' : 'mga-cell'}>
                  {res ? `✓ ${score ?? ''}` : 'Jouer'}
                </a>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
