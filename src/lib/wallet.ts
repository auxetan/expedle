// Les pépites, la monnaie d'Expedle : chaque partie en rapporte, quel que soit le jeu, et chaque succès, niveau ou
// quête du jour en offre davantage. On les dépense dans la boutique, pour des objets de tous les jeux. Elles ne s'achètent pas.
// Le solde se recalcule depuis l'historique des parties, moins ce qu'ont coûté les achats.
import { evaluate, levelOf, type Tier } from './achievements'
import { questRewards } from './quests'
import { plays, type Play } from './stats'
import { load, save } from './util'

export const playPepites = (p: Play) => 2 + Math.round(p.pts / 10) + (p.win ? 5 : 0)

export const TIER_PEPITES: Record<Tier, number> = { bronze: 25, argent: 75, or: 200 }

// à chaque niveau gagné
export const LEVEL_PEPITES = 50

export function earnedOf(list: Play[]): number {
  const progress = evaluate(list)
  const level = levelOf(list, progress).level
  const fromPlays = list.reduce((s, p) => s + playPepites(p), 0)
  const fromAchievements = progress.filter((a) => a.unlocked).reduce((s, a) => s + TIER_PEPITES[a.tier], 0)
  return fromPlays + fromAchievements + LEVEL_PEPITES * (level - 1) + questRewards(list)
}

// un achat garde son prix : changer les prix de la boutique ne touche pas aux soldes
export interface Purchase {
  id: string
  price: number
  // un objet consommable (un joker) s'achète par lots de n, autant de fois qu'on veut
  n?: number
  // l'instant de l'achat, qui le reconnaît d'un appareil à l'autre
  at?: number
}

// un joker utilisé, daté pour la même raison ; tenu à part pour que les achats gardent leur prix
export interface Use {
  id: string
  at: number
}

export const loadPurchases = () => load<Purchase[]>('achats', [])

export const loadUses = () => load<Use[]>('jokers-utilises', [])

export const owns = (id: string) => loadPurchases().some((p) => p.id === id)

export const stockOf = (id: string, bought = loadPurchases(), uses = loadUses()) =>
  bought.reduce((s, p) => s + (p.id === id ? (p.n ?? 0) : 0), 0) - uses.filter((u) => u.id === id).length

export interface Wallet {
  purchases: Purchase[]
  uses: Use[]
}

const union = <T extends { id: string; at?: number }>(a: T[], b: T[]) => {
  const seen = new Set(a.map((x) => `${x.id}@${x.at ?? 0}`))
  return [...a, ...b.filter((x) => !seen.has(`${x.id}@${x.at ?? 0}`))].sort((x, y) => (x.at ?? 0) - (y.at ?? 0))
}

// Le portefeuille de deux appareils réunis : chaque achat et chaque joker utilisé une seule fois.
export const mergeWallets = (a: Wallet, b: Wallet): Wallet => ({ purchases: union(a.purchases, b.purchases), uses: union(a.uses, b.uses) })

export function saveWallet(wallet: Wallet) {
  save('achats', wallet.purchases)
  save('jokers-utilises', wallet.uses)
  changed()
}

export const balanceOf = (list: Play[], bought: Purchase[]) => earnedOf(list) - bought.reduce((s, p) => s + p.price, 0)

export const WALLET_CHANGED = 'cg:wallet'

const changed = () => globalThis.dispatchEvent?.(new Event(WALLET_CHANGED))

// Achète un objet si on ne l'a pas déjà et qu'on peut le payer ; un lot de `n` consommables, lui, se rachète.
export function buy(id: string, price: number, n?: number): boolean {
  const bought = loadPurchases()
  if ((!n && bought.some((p) => p.id === id)) || balanceOf(plays(), bought) < price) return false
  save('achats', [...bought, n ? { id, price, n, at: Date.now() } : { id, price, at: Date.now() }])
  changed()
  return true
}

// Utilise un objet consommable, s'il en reste.
export function consume(id: string): boolean {
  if (stockOf(id) <= 0) return false
  save('jokers-utilises', [...loadUses(), { id, at: Date.now() }])
  changed()
  return true
}
