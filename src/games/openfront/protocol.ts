// Ce que l'affichage et la simulation (dans son Worker) s'échangent.
import type { AskResult, Alliance, Blast, BuildResult, GameEvent, LaunchResult, Missile, Nuke, Options, Order, Request, Shell, Unit } from './engine'
import type { Anchor } from './labels'
import type { Level, NukeType, UnitType } from './rules'
import type { Seat } from './map'

export type Command =
  | { op: 'attack'; tile: number; ratio: number }
  | { op: 'boat'; tile: number; ratio: number }
  | { op: 'build'; unit: UnitType; tile: number }
  | { op: 'launch'; nuke: NukeType; tile: number }
  | { op: 'demolish'; tile: number }
  | { op: 'ally'; to: number }
  | { op: 'accept'; from: number }
  | { op: 'refuse'; from: number }
  | { op: 'betray'; other: number }
  | { op: 'extend'; other: number }
  | { op: 'troops'; to: number; ratio: number }
  | { op: 'gold'; to: number; share: number }
  | { op: 'retreat'; attack: number }
  | { op: 'recall'; boat: number }
  | { op: 'emoji'; to: number; emoji: string }
  | { op: 'target'; other: number }
  | { op: 'embargo'; other: number }
  | { op: 'move'; unit: number; tile: number }

export type Reply = Order | BuildResult | LaunchResult | AskResult | boolean | null

export type ToSim =
  | { type: 'init'; w: number; h: number; terrain: Uint8Array; level: Level; name: string; seats: Seat[]; names: Record<string, string>; nations: number; tribes: number; options: Options }
  | { type: 'spawn'; tile: number }
  | { type: 'run'; running: boolean }
  | { type: 'speed'; value: number }
  | { type: 'cmd'; id: number; cmd: Command }

// L'état des joueurs voyage en un seul tableau de nombres, huit par joueur :
// troupes, or, cases, en vie, apparu, fin de trahison, tombeur, niveaux de villes.
export const PLAYER_FIELDS = 8

export interface Snapshot {
  tick: number
  mirvs: number
  falloutTiles: number
  // paires (case, propriétaire | retombées << 16) des cases changées
  tiles: Int32Array
  players: Float64Array
  units: Unit[]
  boats: { id: number; owner: number; to: number; troops: number; at: number; trade: boolean; dst: number; back: boolean }[]
  // chemins des bateaux et des trains apparus (ou détournés : capture, rappel) depuis le dernier envoi
  paths: { id: number; path: Int32Array }[]
  trains: { id: number; owner: number; at: number }[]
  rails?: { a: number; b: number; path: Int32Array }[]
  attacks: { id: number; from: number; to: number; troops: number; source: number; front: Int32Array | null }[]
  nukes: Nuke[]
  missiles: Missile[]
  shells: Shell[]
  blasts: Blast[]
  alliances: (Omit<Alliance, 'extend'> & { extend: number[] })[]
  requests: Request[]
  events: GameEvent[]
  labels?: Anchor[]
  // la diplomatie du joueur : sa cible et ses embargos
  me: { target: number; embargo: number[] }
}

export type FromSim =
  | { type: 'ready'; players: { id: number; name: string; kind: 'human' | 'nation' | 'bot'; code: string }[]; snap: Snapshot }
  | { type: 'tick'; snap: Snapshot }
  | { type: 'reply'; id: number; value: Reply }
