// Ce qu'on achète avec ses pépites : des avatars pour tout Expedle, l'édition dorée de l'icône de chaque jeu,
// et les motifs de territoire de Frontières.
import { SKINS } from '../games/openfront/progress'
import { ALL_GAMES } from './games'

export interface ShopItem {
  id: string
  kind: 'avatar' | 'icone' | 'motif'
  price: number
  // l'emoji d'un avatar, l'icône d'un jeu, le motif de Frontières
  value: string
  // le nom affiché, déjà marqué pour la traduction (titres des jeux exceptés)
  name: string
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
]
