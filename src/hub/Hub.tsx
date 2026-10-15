import type { ReactNode } from 'react'
import { dailyResult, playStats } from '../lib/stats'
import './hub.css'

interface Card {
  id: string
  href: string
  title: string
  tagline: string
  badge: 'Quotidien' | 'Libre' | 'Hebdo' | 'Défi'
  dailyId?: string
  art: ReactNode
}

const Sil = ({ e, red }: { e: string; red?: boolean }) => <span className={red ? 'sil sil-red' : 'sil'}>{e}</span>
const Arrow = () => <span className="art-arrow">→</span>

const FEATURED: Card[] = [
  {
    id: 'itineraire',
    href: '#/itineraire',
    title: 'Itinéraire',
    tagline: "Relie deux pays par la terre, en un minimum d'essais.",
    badge: 'Quotidien',
    dailyId: 'itineraire',
    art: (
      <svg viewBox="0 0 120 60" className="art-route" aria-hidden>
        <path d="M8 38c6-10 18-12 22-4s-4 16-12 14S4 46 8 38z" fill="#c9899a" />
        <path d="M44 22h14l6 8-4 10H46l-6-8z" fill="#d7c7a2" />
        <path d="M70 26h14l4 10-6 8H70l-4-9z" fill="#d7c7a2" />
        <path d="M96 14c8-2 16 4 16 12s-6 14-14 12-12-6-10-14 2-8 8-10z" fill="#88afa2" />
      </svg>
    ),
  },
  {
    id: 'echelle',
    href: '#/echelle',
    title: "À l'échelle",
    tagline: 'Redimensionne la silhouette à sa vraie taille.',
    badge: 'Quotidien',
    dailyId: 'echelle-objets',
    art: (
      <>
        <Sil e="🍾" />
        <Arrow />
        <Sil e="🍎" red />
      </>
    ),
  },
  {
    id: 'echelle-geo',
    href: '#/echelle/geo',
    title: 'Géographie',
    tagline: 'Compare la taille réelle des pays et des îles.',
    badge: 'Quotidien',
    dailyId: 'echelle-geo',
    art: (
      <svg viewBox="0 0 120 60" className="art-route" aria-hidden>
        <path d="M14 18l14-2 4 8 10 2-2 12-10 4-4 8-8-4-4-10-6-4z" fill="#8a8fa3" />
        <text x="56" y="34" fill="#8a8fa3" fontSize="9">→</text>
        <path d="M86 12l6 2-2 8 6 6-2 10 8 8-6 4-10-4-2-10 2-8-4-6z" fill="#f2554b" />
      </svg>
    ),
  },
]

const SECTIONS: { label: string; cards: Card[] }[] = [
  {
    label: 'Géographie',
    cards: [
      {
        id: 'classement',
        href: '#/classement',
        title: 'Classement',
        tagline: 'Place chaque pays là où il est le mieux classé.',
        badge: 'Libre',
        art: <span className="art-glyph">#1</span>,
      },
      {
        id: 'classement-villes',
        href: '#/classement/villes',
        title: 'Classement : villes',
        tagline: 'Huit villes, huit catégories, le plus petit total.',
        badge: 'Libre',
        art: <span className="art-glyph">🏙</span>,
      },
      {
        id: 'classement-jour',
        href: '#/classement/jour',
        title: 'Défi du jour',
        tagline: 'La même grille pour tout le monde, chaque jour.',
        badge: 'Quotidien',
        dailyId: 'classement-jour',
        art: <span className="art-glyph">◎</span>,
      },
      {
        id: 'cartographe',
        href: '#/cartographe',
        title: 'Cartographe',
        tagline: 'Pays, capitales, drapeaux : clique sur la carte.',
        badge: 'Libre',
        art: <span className="art-glyph">⌖</span>,
      },
      {
        id: 'itineraire-hebdo',
        href: '#/itineraire/hebdo',
        title: 'Itinéraire long',
        tagline: 'Un trajet plus long, renouvelé chaque lundi.',
        badge: 'Hebdo',
        art: <span className="art-glyph">⇢</span>,
      },
    ],
  },
  {
    label: 'Estimation',
    cards: [
      {
        id: 'balance',
        href: '#/balance',
        title: 'La Balance',
        tagline: 'Équilibre la balance avec le bon nombre d’objets.',
        badge: 'Quotidien',
        dailyId: 'balance',
        art: <span className="art-glyph">⚖</span>,
      },
      {
        id: 'question',
        href: '#/question',
        title: 'Question du jour',
        tagline: 'Une question. Une estimation.',
        badge: 'Quotidien',
        dailyId: 'question',
        art: <span className="art-glyph">Σ</span>,
      },
      {
        id: 'survie',
        href: '#/survie',
        title: 'Survie',
        tagline: 'Estime vite. Reste en vie.',
        badge: 'Défi',
        art: <span className="art-glyph">♡</span>,
      },
    ],
  },
  {
    label: 'Culture G',
    cards: [
      {
        id: 'quiz',
        href: '#/quiz',
        title: 'Quiz culture G',
        tagline: 'Dix questions, toutes les catégories.',
        badge: 'Libre',
        art: <span className="art-glyph">?</span>,
      },
      {
        id: 'quiz-jour',
        href: '#/quiz/jour',
        title: 'Quiz du jour',
        tagline: 'Les mêmes dix questions pour tout le monde.',
        badge: 'Quotidien',
        dailyId: 'quiz-jour',
        art: <span className="art-glyph">10</span>,
      },
      {
        id: 'drapeaux',
        href: '#/quiz/drapeaux',
        title: 'Drapeaux',
        tagline: 'Reconnais le pays à son drapeau.',
        badge: 'Libre',
        art: <span className="art-glyph">⚑</span>,
      },
      {
        id: 'capitales',
        href: '#/quiz/capitales',
        title: 'Capitales',
        tagline: 'Associe chaque pays à sa capitale.',
        badge: 'Libre',
        art: <span className="art-glyph">★</span>,
      },
    ],
  },
]

function Badge({ card }: { card: Card }) {
  const done = card.dailyId ? dailyResult(card.dailyId) !== null : false
  return <span className={done ? 'badge badge-done' : 'badge'}>{done ? '✓ Fait' : card.badge}</span>
}

export default function Hub() {
  const { total, streak } = playStats()
  return (
    <div className="hub">
      <header className="hub-head">
        <div className="hub-brand">
          <div className="hub-logo" aria-hidden>
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#fff" strokeWidth="2">
              <circle cx="12" cy="12" r="8.5" />
              <path d="M3.5 12h17M12 3.5c-3 3.2-3 13.8 0 17M12 3.5c3 3.2 3 13.8 0 17" />
            </svg>
          </div>
          <div>
            <h1>Culture G</h1>
            <p className="hub-sub">Le hub des jeux de culture générale</p>
          </div>
        </div>
        <div className="hub-stats">
          <div>
            <span className="stat-label">🔥 Série</span>
            <span className="stat-value">{streak}</span>
          </div>
          <div>
            <span className="stat-label">🏁 Parties jouées</span>
            <span className="stat-value">{total || '—'}</span>
          </div>
        </div>
      </header>

      <section>
        <h2 className="hub-section">Jeux du jour</h2>
        <div className="grid-featured">
          {FEATURED.map((card) => (
            <a key={card.id} className="card card-big" href={card.href}>
              <Badge card={card} />
              <div className="card-art">{card.art}</div>
              <div className="card-foot">
                <div>
                  <h3>{card.title}</h3>
                  <p>{card.tagline}</p>
                </div>
                <span className="play-pill">Jouer →</span>
              </div>
            </a>
          ))}
        </div>
      </section>

      {SECTIONS.map((section) => (
        <section key={section.label}>
          <h2 className="hub-section hub-section-muted">{section.label}</h2>
          <div className="grid-small">
            {section.cards.map((card) => (
              <a key={card.id} className="card card-small" href={card.href}>
                <div className="card-small-art">{card.art}</div>
                <h3>{card.title}</h3>
                <p>{card.tagline}</p>
                <div className="card-small-foot">
                  <Badge card={card} />
                  <span className="round-arrow">→</span>
                </div>
              </a>
            ))}
          </div>
        </section>
      ))}
      <footer className="hub-foot">Culture G · jeux inspirés des grands classiques de la géographie et de l’estimation</footer>
    </div>
  )
}
