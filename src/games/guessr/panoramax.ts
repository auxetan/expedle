import { countryAt, randomPointIn, type LonLat } from '../../geo/measure'
import type { World } from '../../geo/world'
import { isPowerOfTwo, wholeImage, type SphereNode, type SphereSpot } from './sphere'
import { t } from '../../lib/i18n'

// Catalogue fédéré de Panoramax : sans clé, CORS ouvert, toutes les instances (IGN, OSM France…).
const API = 'https://api.panoramax.xyz/api'

interface Link {
  rel: string
  href: string
  id?: string
  geometry?: { coordinates: LonLat }
}

interface Matrix {
  tileWidth: number
  matrixWidth: number
  matrixHeight: number
}

export interface Item {
  id: string
  collection: string
  geometry: { coordinates: LonLat }
  links: Link[]
  assets: { sd: { href: string }; thumb: { href: string } }
  asset_templates?: { tiles?: { href: string } }
  providers?: { name: string; roles: string[] }[]
  properties: {
    datetime: string
    license?: string
    'view:azimuth'?: number
    'tiles:tile_matrix_sets'?: Record<string, { tileMatrix: Matrix[] }>
  }
}

// Les identifiants de nœud portent la séquence : c'est elle qui donne l'adresse de la vue voisine.
const nodeId = (collection: string, id: string) => `${collection}/${id}`

export function toNode(item: Item): SphereNode {
  const [lng, lat] = item.geometry.coordinates
  const template = item.asset_templates?.tiles?.href
  const matrix = Object.values(item.properties['tiles:tile_matrix_sets'] ?? {})[0]?.tileMatrix.at(-1)
  const tiled = template && matrix && isPowerOfTwo(matrix.matrixWidth) && isPowerOfTwo(matrix.matrixHeight)
  return {
    id: nodeId(item.collection, item.id),
    lng,
    lat,
    azimuth: item.properties['view:azimuth'] ?? 0,
    panorama: tiled
      ? {
          width: matrix.tileWidth * matrix.matrixWidth,
          cols: matrix.matrixWidth,
          rows: matrix.matrixHeight,
          baseUrl: item.assets.sd.href,
          tileUrl: (col, row) => template.replace('{TileCol}', String(col)).replace('{TileRow}', String(row)),
        }
      : wholeImage(item.assets.sd.href, 2048, item.assets.thumb.href),
    links: item.links
      .filter((l) => (l.rel === 'prev' || l.rel === 'next') && l.id && l.geometry)
      .map((l) => ({ id: nodeId(item.collection, l.id!), lng: l.geometry!.coordinates[0], lat: l.geometry!.coordinates[1] })),
  }
}

const nodes = new Map<string, Promise<SphereNode>>()

export function panoramaxNode(id: string): Promise<SphereNode> {
  let node = nodes.get(id)
  if (!node) {
    const [collection, item] = id.split('/')
    node = fetch(`${API}/collections/${collection}/items/${item}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Panoramax ${res.status}`)
        return res.json() as Promise<Item>
      })
      .then(toNode)
    node.catch(() => nodes.delete(id))
    nodes.set(id, node)
  }
  return node
}

async function search([lng, lat]: LonLat, radius: number, signal: AbortSignal): Promise<Item[]> {
  const q = new URLSearchParams({ bbox: [lng - radius, lat - radius, lng + radius, lat + radius].join(','), limit: '20', filter: 'field_of_view=360' })
  const res = await fetch(`${API}/search?${q}`, { signal })
  if (!res.ok) throw new Error(`Panoramax ${res.status}`)
  return ((await res.json()) as { features: Item[] }).features
}

// La carte du mode France montre la métropole : les points tirés outre-mer sont écartés.
const METROPOLE = { west: -5.3, east: 9.7, south: 41.3, north: 51.2 }

export function metropolePoint(world: World, rng: () => number): LonLat {
  for (;;) {
    const p = randomPointIn(world, 'FR', rng)
    if (p[0] > METROPOLE.west && p[0] < METROPOLE.east && p[1] > METROPOLE.south && p[1] < METROPOLE.north) return p
  }
}

// Par vagues de quatre points en France, une vue 360° prise dans les ~10 km de l'un d'eux, jamais déjà jouée,
// et qu'on peut quitter en avançant dans la rue.
export async function findPanoramax(world: World, rng: () => number, seen: Set<string>, signal: AbortSignal): Promise<SphereSpot> {
  for (let wave = 0; wave < 5; wave++) {
    const pages = await Promise.all(Array.from({ length: 4 }, () => search(metropolePoint(world, rng), 0.1, signal)))
    const fresh = pages.flat().filter((i) => !seen.has(i.id) && i.links.some((l) => l.rel === 'prev' || l.rel === 'next'))
    if (!fresh.length) continue
    const item = fresh[Math.floor(rng() * fresh.length)]
    const start = toNode(item)
    nodes.set(start.id, Promise.resolve(start))
    return {
      id: item.id,
      lat: start.lat,
      lng: start.lng,
      country: countryAt(world, [start.lng, start.lat]),
      start,
      heading: Math.round(rng() * 360),
      date: item.properties.datetime,
      credit: item.providers?.find((p) => p.roles.includes('producer'))?.name ?? '',
      license: item.properties.license ?? '',
      page: `https://api.panoramax.xyz/#focus=pic&pic=${item.id}`,
    }
  }
  throw new Error(t('Aucune vue 360° trouvée cette fois.'))
}
