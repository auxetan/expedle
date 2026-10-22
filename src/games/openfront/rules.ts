// Les règles chiffrées d'OpenFront, reprises telles quelles : troupes, combat case par case, bâtiments, bombes.
// Un tour dure 100 ms ; toutes les durées sont en tours.

export type Kind = 'human' | 'nation' | 'bot'
export type Level = 'facile' | 'moyen' | 'difficile' | 'impossible'
export type Terrain = 'plaine' | 'plateau' | 'montagne'
export type UnitType = 'ville' | 'port' | 'poste' | 'silo' | 'dca' | 'navire'
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
export const WARSHIP_HP = 1000
export const SHELL_DAMAGE = 250
export const CITY_TROOPS = 250_000

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
  const max = 2 * (tiles ** 0.6 * 1000 + 50_000) + cityLevels * CITY_TROOPS
  return kind === 'bot' ? max / 3 : kind === 'nation' ? max * NATION[level].cap : max
}

// Ce que l'armée gagne à chaque tour : beaucoup loin du plafond, plus rien une fois dessus.
export function troopGrowth(kind: Kind, level: Level, troops: number, max: number): number {
  let add = (10 + troops ** 0.73 / 4) * (1 - troops / max)
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
  return 1 - depth / (1 + Math.exp(-2.5 * (Math.log(Math.max(1, tiles)) - Math.log(300_000))))
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
      return Math.min(1_000_000, 2 ** owned * 125_000)
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

export const BUILD_TICKS: Record<UnitType, number> = { ville: 20, port: 50, poste: 50, silo: 100, dca: 300, navire: 0 }

export const BLAST: Record<NukeType | 'ogive', { inner: number; outer: number; speed: number }> = {
  bombe: { inner: 12, outer: 30, speed: 10 },
  hbombe: { inner: 80, outer: 100, speed: 10 },
  mirv: { inner: 0, outer: 0, speed: 15 },
  ogive: { inner: 12, outer: 18, speed: 22 },
}

// Portée d'une défense antiaérienne : 70 cases au niveau 1, jusqu'à 150.
export const samRange = (level: number) => 150 - 480 / (level + 5)

export const nukeDeaths = (troops: number, tilesLeft: number) => (5 * troops) / Math.max(1, tilesLeft)
