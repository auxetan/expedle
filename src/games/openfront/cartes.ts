// Les cartes d'OpenFront (© OpenFront and Contributors, CC BY-SA 4.0, voir cartes/LICENSE.md), avec leur relief :
// chaque carte se télécharge, compressée, au lancement d'une partie ; sa vignette sert à la choisir.
import { countryName } from '../../geo/countries'
import { msg } from '../../lib/i18n'
import catalog from './cartes/catalog.json'
import { MAP_H, MAP_W, worldMap, type Seat, type WorldMap } from './map'

const FILES = import.meta.glob<string>('./cartes/*.bin.gz', { eager: true, query: '?url', import: 'default' })
const THUMBS = import.meta.glob<string>('./cartes/*.webp', { eager: true, query: '?url', import: 'default' })

export type MapGroup = 'monde' | 'regions' | 'imaginaires'

export interface MapInfo {
  id: string
  name: string
  group: MapGroup
  w: number
  h: number
  // la fréquence de la carte dans les parties publiques d'OpenFront
  weight: number
  thumb?: string
}

const NAMES: Record<string, string> = {
  world: msg('Monde'),
  europe: msg('Europe'),
  northamerica: msg('Amérique du Nord'),
  southamerica: msg('Amérique du Sud'),
  asia: msg('Asie'),
  africa: msg('Afrique'),
  australia: msg('Australie'),
  britannia: msg('Îles Britanniques'),
  france: msg('France'),
  italia: msg('Italie'),
  scandinavia: msg('Scandinavie'),
  baltics: msg('Pays baltes'),
  iceland: msg('Islande'),
  blacksea: msg('Mer Noire'),
  marenostrum: msg('Mare Nostrum'),
  mena: msg('Afrique du Nord et Moyen-Orient'),
  middleeast: msg('Moyen-Orient'),
  eastasia: msg('Asie de l’Est'),
  japan: msg('Japon'),
  pangaea: msg('Pangée'),
  fourislands: msg('Quatre îles'),
  mars: msg('Mars'),
  luna: msg('Lune'),
  expedle: msg('Monde sans relief'),
}

export const GROUPS: [MapGroup, string][] = [
  ['monde', msg('Monde et continents')],
  ['regions', msg('Régions')],
  ['imaginaires', msg('Imaginaires et autres astres')],
]

export const MAPS: MapInfo[] = [
  ...catalog.map((c) => ({ id: c.id, name: NAMES[c.id], group: c.group as MapGroup, w: c.w, h: c.h, weight: c.weight, thumb: THUMBS[`./cartes/${c.id}.webp`] })),
  // la carte maison d'Expedle, sans relief, qui ne demande aucun téléchargement
  { id: 'expedle', name: NAMES.expedle, group: 'monde', w: MAP_W, h: MAP_H, weight: 0 },
]

export const DEFAULT_MAP = 'world'

export const mapById = (id: string) => MAPS.find((m) => m.id === id) ?? MAPS[0]

type Nation = [number, number, string, string]

// Les nations d'une carte, à leur case de départ ; les premières listées passent avant les autres.
export function seatsOf({ w, nations }: { w: number; nations: (Nation | (string | number)[])[] }): Seat[] {
  return nations.map((n, i) => {
    const [x, y, flag, name] = n as Nation
    return { code: flag.length === 2 ? flag.toUpperCase() : '', name, cell: y * w + x, size: nations.length - i }
  })
}

const english = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' })

// Le nom d'une nation : celui de son pays dans la langue du joueur quand elle est ce pays (ou que la carte ne
// donne que le drapeau), celui de la carte sinon, pour une région sous le drapeau de son pays ou un drapeau d'emprunt.
export function nationName(s: Seat): string {
  if (!s.code) return s.name
  return !s.name || english.of(s.code)?.toLowerCase() === s.name.toLowerCase() ? countryName(s.code) : s.name
}

// La carte d'une partie publique, tirée selon les fréquences d'OpenFront.
export function pickPublicMap(rng: () => number = Math.random): string {
  const pool = MAPS.filter((m) => m.weight > 0)
  let r = rng() * pool.reduce((s, m) => s + m.weight, 0)
  for (const m of pool) if ((r -= m.weight) < 0) return m.id
  return pool[pool.length - 1].id
}

// le relief case par case ; un serveur peut l'avoir déjà décompressé en route
async function terrainOf(url: string): Promise<Uint8Array> {
  const raw = new Uint8Array(await (await fetch(url)).arrayBuffer())
  if (raw[0] !== 0x1f || raw[1] !== 0x8b) return raw
  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

const loaded = new Map<string, Promise<WorldMap>>()

export function loadMap(id: string): Promise<WorldMap> {
  const info = mapById(id)
  if (info.id === 'expedle') return Promise.resolve(worldMap())
  let map = loaded.get(info.id)
  if (!map) {
    const c = catalog.find((e) => e.id === info.id)!
    map = terrainOf(FILES[`./cartes/${c.id}.bin.gz`]).then((terrain) => ({ w: c.w, h: c.h, terrain, seats: seatsOf(c) }))
    // un échec se retente au lancement suivant
    map.catch(() => loaded.delete(info.id))
    loaded.set(info.id, map)
  }
  return map
}
