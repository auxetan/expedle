// Les règles chiffrées d'OpenFront, reprises telles quelles : troupes, combat case par case, bâtiments, bombes.
// Un tour dure 100 ms ; toutes les durées sont en tours. Les puissances passent par detmath, pour que tous les
// navigateurs calculent la même partie en ligne.
import { exp, log, pow, pow2 } from './detmath'

export type Kind = 'human' | 'nation' | 'bot'
export type Level = 'facile' | 'moyen' | 'difficile' | 'impossible'
export type Terrain = 'plaine' | 'plateau' | 'montagne'
export type UnitType = 'ville' | 'port' | 'usine' | 'poste' | 'silo' | 'dca' | 'navire'
export type NukeType = 'bombe' | 'hbombe' | 'mirv'
export type Buyable = UnitType | NukeType

export const TICK_MS = 100
export const WIN_SHARE = 0.8
export const MAX_BOATS = 3
export const SPAWN_RADIUS = 4
export const SPAWN_TICKS = 100
export const STRUCTURE_MIN_DIST = 15
export const DEFENSE_RANGE = 30
export const PORT_RANGE = 20
export const TRAITOR_TICKS = 300
export const ALLIANCE_TICKS = 3000
export const EXTEND_WINDOW = 300
export const REQUEST_TICKS = 200
export const REQUEST_COOLDOWN = 300
export const RETREAT_LOSS = 0.25
export const SILO_COOLDOWN = 90
export const SAM_COOLDOWN = 90
export const NUKE_ALLY_BREAK = 100
// une bombe n'est interceptable qu'à moins de 150 cases de son silo ou de sa cible
export const NUKE_EXPOSED_RANGE = 150
export const WARSHIP_HP = 1000
// un navire de guerre patrouille à 100 cases de son point d'attache et tire jusqu'à 130 ; près d'un port à son
// pays (150 cases), il se répare d'un point par tour
export const WARSHIP_PATROL = 100
export const WARSHIP_RANGE = 130
export const WARSHIP_HEAL_RANGE = 150
export const SHELL_DAMAGE = 250
export const CITY_TROOPS = 250_000
// rails : une usine se relie aux gares (villes, ports, usines) à moins de 110 cases, par la terre
export const RAIL_RANGE = 110
export const TRAIN_SPEED = 2
export const TRAIN_CAP = 100
export const SAM_SPEED = 12
// au début de la partie, humains et nations sont protégés cinq secondes ; aucune bombe ne part
export const SPAWN_IMMUNITY_TICKS = 50
// une cible désignée dure dix secondes, et on ne peut en désigner une nouvelle qu'après quinze
export const TARGET_TICKS = 100
export const TARGET_COOLDOWN = 150

const sigmoid = (x: number, rate: number, mid: number) => 1 / (1 + exp(-rate * (x - mid)))
const within = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

// Un petit réseau (moins de six ports ou usines) démarre plus vite : jusqu'à moitié plus de départs.
const smallEconomyBoost = (levels: number) => (levels <= 0 ? 1 : 1 + (0.5 * within((6 - levels) / 5, 0, 1)) / levels)

// Ce que rapporte un navire marchand à son arrivée, aux deux ports : une courbe en S autour de 300 cases,
// qui punit les trajets courts, plus 50 d'or par case parcourue.
export const tradeGold = (distance: number) => Math.floor(75_000 / (1 + exp(-0.03 * (distance - 300))) + 50 * distance)

// Un port a une chance sur ce nombre de lancer un navire marchand, à chaque essai (toutes les secondes, une fois
// par niveau) : chaque refus rapproche le suivant, et la mer se sature au-delà de quelques centaines de navires.
export function tradeSpawnOdds(refusals: number, tradeShips: number, ports: number): number {
  const saturation = Math.max(1 - sigmoid(tradeShips, Math.LN2 / 50, 330), 0.25 * (1 - sigmoid(tradeShips, Math.LN2 / 100, 800)))
  const boost = smallEconomyBoost(ports)
  return Math.max(1, Math.floor(100 / (boost * boost) / (refusals + 1) / saturation))
}

// Une usine a une chance sur ce nombre de lancer un train, à chaque tour et par niveau.
export function trainSpawnOdds(factories: number, trainUnits: number): number {
  const saturation = Math.max(1 - sigmoid(trainUnits, Math.LN2 / 100, 560), 0.25 * (1 - sigmoid(trainUnits, Math.LN2 / 150, 900)))
  return Math.max(1, Math.floor(((factories + 10) * 15) / (saturation * smallEconomyBoost(factories))))
}

export type Relation = 'self' | 'ally' | 'other'

// Ce que rapporte un train à chaque gare (ville ou port) : plus chez un allié, moins chez soi ; au-delà de dix gares
// sur le même trajet, 5 000 de moins par gare, jamais sous 5 000.
export function trainGold(relation: Relation, stops: number): number {
  const base = relation === 'ally' ? 35_000 : relation === 'other' ? 25_000 : 10_000
  return Math.max(5_000, base - Math.max(0, stops - 9) * 5_000)
}

const NATION: Record<Level, { cap: number; growth: number; start: number }> = {
  facile: { cap: 0.5, growth: 0.9, start: 12_500 },
  moyen: { cap: 0.75, growth: 0.95, start: 18_750 },
  difficile: { cap: 1, growth: 1, start: 25_000 },
  impossible: { cap: 1.25, growth: 1.05, start: 31_250 },
}

export function startTroops(kind: Kind, level: Level): number {
  return kind === 'bot' ? 10_000 : kind === 'nation' ? NATION[level].start : 25_000
}

export function maxTroops(kind: Kind, level: Level, tiles: number, cityLevels: number): number {
  const max = 2 * (pow(tiles, 0.6) * 1000 + 50_000) + cityLevels * CITY_TROOPS
  return kind === 'bot' ? max / 3 : kind === 'nation' ? max * NATION[level].cap : max
}

// Ce que l'armée gagne à chaque tour : beaucoup loin du plafond, plus rien une fois dessus.
export function troopGrowth(kind: Kind, level: Level, troops: number, max: number): number {
  let add = (10 + pow(troops, 0.73) / 4) * (1 - troops / max)
  if (kind === 'bot') add *= 0.5
  if (kind === 'nation') add *= NATION[level].growth
  return Math.min(troops + add, max) - troops
}

export const goldPerTick = (kind: Kind) => (kind === 'bot' ? 50 : 100)

export function terrainOf(magnitude: number): Terrain {
  return magnitude < 10 ? 'plaine' : magnitude < 20 ? 'plateau' : 'montagne'
}

const TERRAIN: Record<Terrain, { mag: number; cost: number; slow: number }> = {
  plaine: { mag: 80, cost: 16.5, slow: 1 },
  plateau: { mag: 100, cost: 20, slow: 1.5 },
  montagne: { mag: 120, cost: 25, slow: 2 },
}

// Ordre de prise des cases du front : celles déjà entourées et en plaine d'abord, un peu de hasard pour un front vivant.
export function priority(random: number, ownNeighbors: number, terrain: Terrain, tick: number): number {
  return (Math.floor(random * 7) + 10) * (1 - ownNeighbors * 0.5 + TERRAIN[terrain].slow / 2) + tick
}

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const fallout = (ratio: number) => 5 - ratio * 2

export interface Cost {
  loss: number
  defenderLoss: number
  // part du budget du tour consommée par la case : une attaque prend des cases jusqu'à l'avoir dépensé
  fraction: number
}

export function neutralCost(kind: Kind, terrain: Terrain, attackTroops: number, borderSize: number, falloutRatio: number | null = null): Cost {
  let { mag, cost } = TERRAIN[terrain]
  if (falloutRatio !== null) {
    mag *= fallout(falloutRatio)
    cost *= fallout(falloutRatio)
  }
  return {
    loss: mag / (kind === 'bot' ? 10 : 5),
    defenderLoss: 0,
    fraction: clamp((2000 * cost) / attackTroops, 5, 100) / (borderSize * 2),
  }
}

// Les très grands territoires attaquent et se font attaquer plus facilement, pour que les fins de partie bougent.
function large(tiles: number, depth: number): number {
  return 1 - depth / (1 + exp(-2.5 * (log(Math.max(1, tiles)) - log(300_000))))
}

export interface Defender {
  kind: Kind
  tiles: number
  troops: number
  traitor: boolean
  // un poste de défense couvre la case
  post: boolean
}

export function landCost(attacker: { kind: Kind; tiles: number }, attackTroops: number, terrain: Terrain, d: Defender, borderSize: number, falloutRatio: number | null = null): Cost {
  let { mag, cost } = TERRAIN[terrain]
  if (d.post) {
    mag *= 5
    cost *= 3
  }
  if (falloutRatio !== null) {
    mag *= fallout(falloutRatio)
    cost *= fallout(falloutRatio)
  }
  if (attacker.kind !== 'bot' && d.kind === 'bot') mag *= 0.7
  const bigAttacker = large(attacker.tiles, 0.7)
  const bigDefender = large(d.tiles, 0.3)
  const defenderLoss = d.troops / Math.max(1, d.tiles)
  const ratio = d.troops / attackTroops
  const loss = mag * (d.traitor ? 0.5 : 1) * clamp(ratio, 0.6, 2) * (0.463 * bigAttacker * bigDefender + 0.0039 * defenderLoss)
  const speed = (clamp(ratio, 0.82, 7.5) * clamp(ratio / 20, 1, 50)) / 8.55
  return { loss, defenderLoss, fraction: (speed * cost * large(attacker.tiles, 0.73) * bigDefender * (d.traitor ? 0.8 : 1)) / borderSize }
}

// Prix du prochain exemplaire, selon combien on en possède déjà (ou combien de MIRV ont été lancés).
export function unitCost(type: Buyable, owned: number): number {
  switch (type) {
    case 'ville':
    case 'port':
    case 'usine':
      return Math.min(1_000_000, pow2(owned) * 125_000)
    case 'navire':
      return Math.min(1_000_000, (owned + 1) * 250_000)
    case 'poste':
      return Math.min(250_000, (owned + 1) * 50_000)
    case 'dca':
      return Math.min(3_000_000, (owned + 1) * 1_500_000)
    case 'silo':
      return 1_000_000
    case 'bombe':
      return 750_000
    case 'hbombe':
      return 5_000_000
    case 'mirv':
      return 25_000_000 + owned * 15_000_000
  }
}

export const BUILD_TICKS: Record<UnitType, number> = { ville: 20, port: 50, usine: 20, poste: 50, silo: 100, dca: 300, navire: 0 }

export const BLAST: Record<NukeType | 'ogive', { inner: number; outer: number; speed: number }> = {
  bombe: { inner: 12, outer: 30, speed: 10 },
  hbombe: { inner: 80, outer: 100, speed: 10 },
  mirv: { inner: 0, outer: 0, speed: 15 },
  ogive: { inner: 12, outer: 18, speed: 22 },
}

// Portée d'une défense antiaérienne : 70 cases au niveau 1, jusqu'à 150.
export const samRange = (level: number) => 150 - 480 / (level + 5)

export const nukeDeaths = (troops: number, tilesLeft: number) => (5 * troops) / Math.max(1, tilesLeft)

// Les phrases du tchat rapide d'OpenFront : leur code, et vrai pour celles qui désignent un autre joueur.
export const PHRASES: Record<string, boolean> = {
  troupes: false,
  or: false,
  paix: false,
  alliance: false,
  commerce: false,
  defends: true,
  attaque: true,
  bombe: true,
  achever: true,
  navires: false,
  dca: false,
  front: false,
  bombes: false,
  traitre: true,
  menace: true,
  salut: false,
  gg: false,
  merci: false,
  desole: false,
  bonne: false,
  oui: false,
  non: false,
  attends: false,
  rire: false,
}
