// Ce qu'on achète avec ses pépites : des avatars pour tout Expedle, l'édition dorée de l'icône de chaque jeu,
// les motifs de territoire de Frontières, et des jokers à utiliser en partie libre.
import { SKINS } from '../games/openfront/progress'
import { msg } from '../lib/i18n'
import { ALL_GAMES } from './games'

export interface ShopItem {
  id: string
  kind: 'avatar' | 'icone' | 'motif' | 'joker'
  price: number
  // l'emoji d'un avatar, l'icône d'un jeu, le motif de Frontières, le signe d'un joker
  value: string
  // le nom affiché, déjà marqué pour la traduction (titres des jeux exceptés)
  name: string
  // un joker se vend par lot de n, et sert dans ces jeux
  n?: number
  games?: string[]
}

export const PREMIUM_AVATARS: [string, number][] = [
  ['🐼', 150],
  ['🦁', 150],
  ['🐙', 200],
  ['🐳', 200],
  ['🦅', 250],
  ['🐺', 250],
  ['🤠', 300],
  ['🎩', 300],
  ['🥷', 400],
  ['🧙', 400],
  ['🧜', 500],
  ['👽', 500],
  ['🛸', 600],
  ['🗿', 600],
  ['🌋', 700],
  ['🏰', 700],
  ['🦖', 800],
  ['🦄', 900],
  ['🐉', 1000],
  ['👑', 1500],
]

export const ICON_PRICE = 250

// une icône par jeu, même quand plusieurs modes la partagent
const icons = ALL_GAMES.filter((g, i) => ALL_GAMES.findIndex((o) => o.icon === g.icon) === i)

export const ITEMS: ShopItem[] = [
  ...PREMIUM_AVATARS.map(([emoji, price]): ShopItem => ({ id: `avatar:${emoji}`, kind: 'avatar', price, value: emoji, name: emoji })),
  ...icons.map((g): ShopItem => ({ id: `icone:${g.icon}`, kind: 'icone', price: ICON_PRICE, value: g.icon, name: g.title })),
  ...SKINS.filter((s) => s.price > 0).map((s): ShopItem => ({ id: `motif:${s.id}`, kind: 'motif', price: s.price, value: s.id, name: s.name })),
  { id: 'joker:essai', kind: 'joker', price: 60, n: 3, value: '+1', name: msg('Essai en plus'), games: ['Worldle', 'Statele', 'Flagle', 'Countryle'] },
  { id: 'joker:vie', kind: 'joker', price: 75, n: 3, value: '♥', name: msg('Vie en plus'), games: ['Survival Mode'] },
  { id: 'joker:passe', kind: 'joker', price: 45, n: 3, value: '»', name: msg('Passer la question'), games: [msg('Quiz culture G')] },
]
