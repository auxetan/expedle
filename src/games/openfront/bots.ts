import { buildCity, cityCost, maxTroops, neighbors, NEUTRAL, player, sendBoat, startAttack, WATER, type Game } from './engine'

// Comment joue un bot : à quel rythme il réfléchit, quand il s'étend, quand il attaque et avec quelle part de ses troupes.
export interface BotLevel {
  every: number
  expand: number
  attack: number
  share: number
  // il attaque un voisin quand ses troupes dépassent celles du voisin multipliées par ce chiffre
  bold: number
  // chance de viser le joueur plutôt que le voisin le plus faible
  hunt: number
}

export type Level = 'facile' | 'normal' | 'difficile'

export const LEVELS: Record<Level, BotLevel> = {
  facile: { every: 30, expand: 0.5, attack: 0.9, share: 0.3, bold: 1.6, hunt: 0 },
  normal: { every: 20, expand: 0.35, attack: 0.75, share: 0.4, bold: 1.2, hunt: 0.25 },
  difficile: { every: 12, expand: 0.25, attack: 0.6, share: 0.5, bold: 0.9, hunt: 0.5 },
}

function buildSomewhere(g: Game, id: number) {
  const border = [...player(g, id).border]
  for (let i = 0; i < 10 && border.length; i++) if (buildCity(g, id, border[Math.floor(g.rng() * border.length)])) return
}

function boat(g: Game, id: number, troops: number): boolean {
  if (g.boats.some((b) => b.owner === id)) return false
  // quelques tirages au hasard, la terre libre d'abord : chaque essai calcule une traversée
  for (let i = 0; i < 40; i++) {
    const c = Math.floor(g.rng() * g.owner.length)
    const o = g.owner[c]
    if (o === WATER || o === id || (o !== NEUTRAL && i < 30)) continue
    return sendBoat(g, id, c, troops)
  }
  return false
}

export function think(g: Game, id: number, level: BotLevel) {
  const p = player(g, id)
  if (!p.alive || !p.spawned) return
  const fill = p.troops / maxTroops(g, p)
  if (p.gold >= cityCost(g, id) && g.rng() < 0.5) buildSomewhere(g, id)

  const around = new Set<number>()
  for (const c of p.border)
    for (const n of neighbors(g, c)) {
      const o = g.owner[n]
      if (o !== WATER && o !== id) around.add(o)
    }

  if (around.has(NEUTRAL)) {
    if (fill > level.expand) startAttack(g, id, NEUTRAL, p.troops * level.share)
    return
  }
  const rivals = [...around].map((o) => player(g, o))
  if (rivals.length && fill > level.attack) {
    const human = rivals.find((r) => r.human)
    const weakest = rivals.reduce((a, b) => (b.troops < a.troops ? b : a))
    const target = human && g.rng() < level.hunt ? human : weakest
    if (p.troops > target.troops * level.bold) return startAttack(g, id, target.id, p.troops * level.share)
  }
  // seul sur son île, ou à l'étroit : on tente la mer
  if (fill > level.expand && (!rivals.length || (fill > 0.95 && g.rng() < 0.2))) boat(g, id, p.troops * level.share)
}

// Chaque bot réfléchit à son tour, décalé des autres pour étaler le calcul.
export function runBots(g: Game, level: BotLevel) {
  for (const p of g.players) if (!p.human && (g.tick + p.id * 7) % level.every === 0) think(g, p.id, level)
}
