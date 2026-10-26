// Les pépites, la monnaie d'Expedle : chaque partie en rapporte, quel que soit le jeu, et chaque succès, niveau ou
// quête du jour en offre davantage. On les dépense dans la boutique, pour des objets de tous les jeux. Elles ne s'achètent pas.
// Le solde se recalcule depuis l'historique des parties, moins ce qu'ont coûté les achats.
import { evaluate, levelOf, type Tier } from './achievements'
import { msg } from './i18n'
import { questRewards } from './quests'
import { plays, victoryOf, type Play } from './stats'
import { load, save, todayKey } from './util'

const WIN_PEPITES = 5

const scorePepites = (p: Play) => 2 + Math.round(p.pts / 10)

export const playPepites = (p: Play) => scorePepites(p) + (p.win ? WIN_PEPITES : 0)

const COMBO_GAP = 30 * 60_000

// +2 dès la 2e victoire d'affilée, puis 2 de plus à chacune, jusqu'à +10
export const comboBonus = (combo: number) => (combo < 2 ? 0 : Math.min(10, 2 * (combo - 1)))

export interface Extra {
  combo: number
  comboBonus: number
  firstOfDay: number
}

// Ce que chaque partie rapporte en plus selon celles qui la précèdent (l'historique est rangé par date) : la première
// de chaque jour compte double, et chaque victoire enchaînée à moins de 30 min de la précédente ajoute un bonus croissant.
export function extrasOf(list: Play[]): Extra[] {
  const days = new Set<string>()
  let combo = 0
  return list.map((p, i) => {
    const prev = list[i - 1]
    combo = victoryOf(p) ? (combo && p.t - prev.t <= COMBO_GAP ? combo + 1 : 1) : 0
    const day = todayKey(new Date(p.t))
    const first = !days.has(day)
    days.add(day)
    return { combo, comboBonus: comboBonus(combo), firstOfDay: first ? playPepites(p) : 0 }
  })
}

// Le combo encore en cours à l'instant `now`, et ce que rapporterait la victoire suivante.
export function comboNow(list: Play[], now = Date.now()): { combo: number; next: number } {
  const last = list.at(-1)
  const combo = last && now - last.t <= COMBO_GAP ? extrasOf(list).at(-1)!.combo : 0
  return { combo, next: combo ? comboBonus(combo + 1) : 0 }
}

export const TIER_PEPITES: Record<Tier, number> = { bronze: 25, argent: 75, or: 200 }

// à chaque niveau gagné
export const LEVEL_PEPITES = 50

// les récompenses qui ne tiennent pas à une partie seule
function bonuses(list: Play[]) {
  const progress = evaluate(list)
  return {
    achievements: progress.filter((a) => a.unlocked).reduce((s, a) => s + TIER_PEPITES[a.tier], 0),
    level: levelOf(list, progress).level,
    quests: questRewards(list),
  }
}

export function earnedOf(list: Play[]): number {
  const { achievements, level, quests } = bonuses(list)
  const extras = extrasOf(list).reduce((s, e) => s + e.comboBonus + e.firstOfDay, 0)
  return list.reduce((s, p) => s + playPepites(p), 0) + extras + achievements + LEVEL_PEPITES * (level - 1) + quests
}

export interface Gain {
  label: string
  params?: Record<string, number>
  n: number
}

// Ce qu'une partie vient de rapporter, source par source, à la suite de l'historique `before`.
export function gainsOf(before: Play[], play: Play): Gain[] {
  const was = bonuses(before)
  const now = bonuses([...before, play])
  const extra = extrasOf([...before, play]).at(-1)!
  const gains: Gain[] = [
    { label: msg('Partie'), n: scorePepites(play) },
    { label: msg('Victoire'), n: play.win ? WIN_PEPITES : 0 },
    { label: msg('Première partie du jour'), n: extra.firstOfDay },
    { label: msg('Combo ×{n}'), params: { n: extra.combo }, n: extra.comboBonus },
    { label: msg('Quête du jour'), n: now.quests - was.quests },
    { label: msg('Succès'), n: now.achievements - was.achievements },
    { label: msg('Niveau {n}'), params: { n: now.level }, n: LEVEL_PEPITES * (now.level - was.level) },
  ]
  return gains.filter((g) => g.n > 0)
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
