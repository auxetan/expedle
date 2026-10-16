import { VectorTile } from '@mapbox/vector-tile'
import { PbfReader } from 'pbf'
import { countryAt, distanceKm, randomPointIn, type LonLat } from '../../geo/measure'
import type { World } from '../../geo/world'
import { load, save } from '../../lib/util'
import { modeCodes, pickCountry, type Mode } from './guess'
import { wholeImage, type SphereNode, type SphereSpot } from './sphere'

const GRAPH = 'https://graph.mapillary.com'
const TILES = 'https://tiles.mapillary.com/maps/vtp/mly1_computed_public/2'

export class TokenError extends Error {}

// Le jeton client vient de .env.local (VITE_MAPILLARY_TOKEN) ou, à défaut, de ce navigateur.
const ENV_TOKEN = ((import.meta.env.VITE_MAPILLARY_TOKEN as string | undefined) ?? '').trim()
export const tokenFromEnv = !!ENV_TOKEN
export const storedToken = (): string => ENV_TOKEN || load<string>('mly-token', '')
export const saveToken = (token: string) => save('mly-token', token.trim())

interface GraphError {
  error?: { message: string; type?: string; code?: number }
}

async function graph<T>(path: string, params: Record<string, string>, token: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${GRAPH}/${path}?${new URLSearchParams({ ...params, access_token: token })}`, { signal })
  const data = (await res.json()) as T & GraphError
  if (data.error) {
    if (data.error.type === 'OAuthException' || data.error.code === 190 || res.status === 401 || res.status === 403) throw new TokenError(data.error.message)
    throw new Error(`Mapillary : ${data.error.message}`)
  }
  return data
}

// Une requête minuscule sur le Champ-de-Mars : Mapillary répond par une erreur OAuth si le jeton est faux.
export async function checkToken(token: string): Promise<void> {
  await graph('images', { bbox: '2.29,48.85,2.30,48.86', limit: '1', fields: 'id' }, token)
}

export function tileOf([lng, lat]: LonLat, z: number): [number, number] {
  const n = 2 ** z
  const r = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180
  const x = Math.floor(((lng + 180) / 360) * n)
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)
  return [Math.min(n - 1, Math.max(0, x)), Math.min(n - 1, Math.max(0, y))]
}

// Les séquences 360° d'une tuile vectorielle de couverture (calque « sequence », zooms 6 à 14).
export function panoSequences(buffer: ArrayBuffer): string[] {
  const layer = new VectorTile(new PbfReader(new Uint8Array(buffer))).layers.sequence
  if (!layer) return []
  const ids: string[] = []
  for (let i = 0; i < layer.length; i++) {
    const { id, is_pano } = layer.feature(i).properties
    if (is_pano === true || is_pano === 'true') ids.push(String(id))
  }
  return ids
}

// Zoom 7 : une tuile d'environ 300 km, assez large pour croiser une séquence 360° hors des grandes villes.
async function sequencesNear(token: string, point: LonLat, signal: AbortSignal): Promise<string[]> {
  const [x, y] = tileOf(point, 7)
  const res = await fetch(`${TILES}/7/${x}/${y}?access_token=${encodeURIComponent(token)}`, { signal })
  if (res.status === 401 || res.status === 403) throw new TokenError('Mapillary refuse ce jeton.')
  if (!res.ok || res.status === 204) return []
  return panoSequences(await res.arrayBuffer())
}

export interface Img {
  id: string
  captured_at: number
  geometry: { coordinates: LonLat }
  computed_geometry?: { coordinates: LonLat }
  compass_angle?: number
  computed_compass_angle?: number
  thumb_1024_url?: string
  thumb_2048_url?: string
  creator?: { username: string }
}

const FIELDS = 'id,captured_at,geometry,computed_geometry,compass_angle,computed_compass_angle,thumb_1024_url,thumb_2048_url,creator'

// Une séquence devient une rue où l'on avance d'image en image, dans l'ordre de prise de vue ; les images
// prises à l'arrêt (moins de 2 m de la précédente) sont sautées pour ne pas piétiner.
export function sequenceNodes(images: Img[]): SphereNode[] {
  const kept: (Img & { at: LonLat })[] = []
  for (const img of [...images].sort((a, b) => a.captured_at - b.captured_at)) {
    if (!img.thumb_2048_url) continue
    const at = (img.computed_geometry ?? img.geometry).coordinates
    const prev = kept.at(-1)
    if (prev && distanceKm(prev.at, at) < 0.002) continue
    kept.push({ ...img, at })
  }
  return kept.map((img, i) => ({
    id: img.id,
    lng: img.at[0],
    lat: img.at[1],
    azimuth: img.computed_compass_angle ?? img.compass_angle ?? 0,
    panorama: wholeImage(img.thumb_2048_url!, 2048, img.thumb_1024_url),
    links: [kept[i - 1], kept[i + 1]].filter(Boolean).map((n) => ({ id: n.id, lng: n.at[0], lat: n.at[1] })),
  }))
}

// Toute la séquence est chargée d'un coup : avancer dans la rue ne coûte ensuite plus aucune requête.
const nodes = new Map<string, SphereNode>()
const owners = new Map<string, Img>()

export async function mapillaryNode(id: string): Promise<SphereNode> {
  const node = nodes.get(id)
  if (!node) throw new Error('Vue Mapillary inconnue.')
  return node
}

async function loadSequence(token: string, sequence: string, signal: AbortSignal): Promise<SphereNode[]> {
  const { data } = await graph<{ data: Img[] }>('images', { sequence_ids: sequence, fields: FIELDS, limit: '2000' }, token, signal)
  const list = sequenceNodes(data)
  for (const n of list) nodes.set(n.id, n)
  for (const img of data) owners.set(img.id, img)
  return list
}

// Par vagues de quatre points tirés dans les pays du mode : une séquence 360° de la tuile qui les contient,
// puis une image au hasard dedans, retenue si elle tombe bien dans un pays du mode.
export async function findMapillary(world: World, token: string, mode: Mode, rng: () => number, seen: Set<string>, signal: AbortSignal): Promise<SphereSpot> {
  const allowed = new Set(modeCodes(world, mode))
  for (let wave = 0; wave < 6; wave++) {
    const points = Array.from({ length: 4 }, () => randomPointIn(world, pickCountry(world, mode, rng)!, rng))
    const tiles = await Promise.all(points.map((p) => sequencesNear(token, p, signal)))
    for (const sequences of tiles) {
      if (!sequences.length) continue
      const fresh = (await loadSequence(token, sequences[Math.floor(rng() * sequences.length)], signal)).filter((n) => !seen.has(n.id))
      if (!fresh.length) continue
      const start = fresh[Math.floor(rng() * fresh.length)]
      const country = countryAt(world, [start.lng, start.lat])
      if (!country || !allowed.has(country)) continue
      const img = owners.get(start.id)!
      return {
        id: start.id,
        lat: start.lat,
        lng: start.lng,
        country,
        start,
        heading: Math.round(rng() * 360),
        date: new Date(img.captured_at).toISOString(),
        credit: img.creator?.username ?? '',
        license: 'CC BY-SA 4.0',
        page: `https://www.mapillary.com/app/?pKey=${start.id}&focus=photo`,
      }
    }
  }
  throw new Error('Aucune vue 360° trouvée cette fois.')
}
