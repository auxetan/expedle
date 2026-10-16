import { VectorTile } from '@mapbox/vector-tile'
import { PbfReader } from 'pbf'
import { countryAt, distanceKm, rhumbBearing, type LonLat } from '../../geo/measure'
import type { World } from '../../geo/world'
import { load, save } from '../../lib/util'
import { modeCodes, pickCountry, type Mode } from './guess'
import { wholeImage, type NodeLink, type SphereNode, type SphereSpot } from './sphere'

const GRAPH = 'https://graph.mapillary.com'
// Tuile 0/0/0 : le monde entier en ~400 Ko, avec un point par séquence (calque « overview »).
const WORLD_TILE = 'https://tiles.mapillary.com/maps/vtp/mly1_computed_public/2/0/0/0'

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

// On demande un objet qui n'existe pas (réponse en ~150 ms, contre plusieurs secondes pour une recherche) :
// un bon jeton reçoit « introuvable », un faux une erreur OAuth.
export async function checkToken(token: string): Promise<void> {
  const res = await fetch(`${GRAPH}/1?${new URLSearchParams({ fields: 'id', access_token: token })}`)
  const { error } = (await res.json()) as GraphError
  if (error && (error.type === 'OAuthException' || error.code === 190)) throw new TokenError(error.message)
}

export interface PanoPoint {
  sequence: string
  lng: number
  lat: number
}

// Les points 360° de la tuile du monde, en degrés (projection Web Mercator, précision ~0,1°).
export function panoPoints(buffer: ArrayBuffer): PanoPoint[] {
  const layer = new VectorTile(new PbfReader(new Uint8Array(buffer))).layers.overview
  if (!layer) return []
  const points: PanoPoint[] = []
  for (let i = 0; i < layer.length; i++) {
    const f = layer.feature(i)
    if (f.properties.is_pano !== true && f.properties.is_pano !== 'true') continue
    const { x, y } = f.loadGeometry()[0][0]
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / layer.extent))) * 180) / Math.PI
    points.push({ sequence: String(f.properties.sequence_id), lng: (x / layer.extent) * 360 - 180, lat })
  }
  return points
}

// Tout près d'une côte, le point arrondi peut tomber à l'eau : on tâte autour avant de renoncer.
const NUDGES: LonLat[] = [[0, 0], [0.06, 0], [-0.06, 0], [0, 0.06], [0, -0.06]]
const nearestCountry = (world: World, p: PanoPoint) => NUDGES.map(([dx, dy]) => countryAt(world, [p.lng + dx, p.lat + dy])).find(Boolean) ?? null

const worlds = new Map<string, Promise<(PanoPoint & { country: string | null })[]>>()

function worldPoints(world: World, token: string) {
  let points = worlds.get(token)
  if (!points) {
    points = fetch(`${WORLD_TILE}?access_token=${encodeURIComponent(token)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Mapillary ${res.status}`)
        return res.arrayBuffer()
      })
      .then((buf) => panoPoints(buf).map((p) => ({ ...p, country: nearestCountry(world, p) })))
    points.catch(() => worlds.delete(token))
    worlds.set(token, points)
  }
  return points
}

export interface Img {
  id: string
  captured_at: number
  geometry: { coordinates: LonLat }
  computed_geometry?: { coordinates: LonLat }
  compass_angle?: number
  computed_compass_angle?: number
  width?: number
  height?: number
}

export interface Frame {
  id: string
  date: number
  lng: number
  lat: number
  azimuth: number
  links: NodeLink[]
}

const FIELDS = 'id,captured_at,geometry,computed_geometry,compass_angle,computed_compass_angle,width,height'

// Une séquence devient une rue où l'on avance d'image en image, dans l'ordre de prise de vue. Sont écartées
// les images prises à l'arrêt (moins de 2 m de la précédente) et les panoramas incomplets, qui ne sont pas
// des sphères entières (rapport 2:1) et s'afficheraient étirés.
export function chain(images: Img[]): Frame[] {
  const kept: (Img & { at: LonLat })[] = []
  for (const img of [...images].sort((a, b) => a.captured_at - b.captured_at)) {
    if (img.width && img.height && Math.abs(img.width / img.height - 2) > 0.02) continue
    const at = (img.computed_geometry ?? img.geometry).coordinates
    const prev = kept.at(-1)
    if (prev && distanceKm(prev.at, at) < 0.002) continue
    kept.push({ ...img, at })
  }
  // sans boussole (cap absent ou à 0 pile), on suppose la caméra tournée dans le sens de la marche
  const travel = (i: number) => (kept[i + 1] ? rhumbBearing(kept[i].at, kept[i + 1].at) : i > 0 ? rhumbBearing(kept[i - 1].at, kept[i].at) : 0)
  return kept.map((img, i) => ({
    id: img.id,
    date: img.captured_at,
    lng: img.at[0],
    lat: img.at[1],
    azimuth: img.computed_compass_angle || img.compass_angle || travel(i),
    links: [kept[i - 1], kept[i + 1]].filter(Boolean).map((n) => ({ id: n.id, lng: n.at[0], lat: n.at[1] })),
  }))
}

// La séquence se charge sans les adresses des images (signées, elles pèsent lourd) ; chaque vue va chercher
// les siennes au moment où on s'y rend.
const frames = new Map<string, Frame>()
const nodes = new Map<string, Promise<SphereNode & { creator: string }>>()

async function loadSequence(token: string, sequence: string, signal: AbortSignal): Promise<Frame[]> {
  const { data } = await graph<{ data: Img[] }>('images', { sequence_ids: sequence, fields: FIELDS, limit: '2000' }, token, signal)
  const list = chain(data)
  for (const f of list) frames.set(f.id, f)
  return list
}

export function mapillaryLoader(token: string) {
  return (id: string) => {
    let node = nodes.get(id)
    if (!node) {
      const frame = frames.get(id)
      if (!frame) return Promise.reject(new Error('Vue Mapillary inconnue.'))
      node = graph<{ thumb_1024_url?: string; thumb_2048_url?: string; creator?: { username: string } }>(
        id,
        { fields: 'thumb_1024_url,thumb_2048_url,creator' },
        token,
      ).then((img) => {
        // certaines séquences sont en ligne avant que leurs images soient publiées
        if (!img.thumb_2048_url) throw new Error('Image Mapillary pas encore publiée.')
        return { ...frame, panorama: wholeImage(img.thumb_2048_url, 2048, img.thumb_1024_url), creator: img.creator?.username ?? '' }
      })
      node.catch(() => nodes.delete(id))
      nodes.set(id, node)
    }
    return node
  }
}

// Une vraie rue : au moins cinq vues, qui s'éloignent d'au moins 300 m du départ. Les sphères isolées et les
// visites de musées ou de maisons, prises en intérieur, ne vont presque jamais aussi loin.
export const isStreet = (frames: Frame[]) =>
  frames.length >= 5 && frames.some((f) => distanceKm([frames[0].lng, frames[0].lat], [f.lng, f.lat]) >= 0.3)

// Un pays du mode tiré comme d'habitude (au prorata de la racine de sa surface), mais parmi ceux où
// Mapillary a des séquences 360°, puis une séquence de ce pays et une image au hasard dedans. Trois séquences
// se chargent en même temps et la première qui convient l'emporte : une longue séquence met plusieurs secondes.
export async function findMapillary(world: World, token: string, mode: Mode, rng: () => number, seen: Set<string>, signal: AbortSignal): Promise<SphereSpot> {
  const allowed = new Set(modeCodes(world, mode))
  const points = (await worldPoints(world, token)).filter((p) => p.country && allowed.has(p.country))
  const covered = new Set(points.map((p) => p.country!))
  const loader = mapillaryLoader(token)

  const choose = (street: Frame[]) => {
    const fresh = isStreet(street) ? street.filter((f) => !seen.has(f.id)) : []
    const frame = fresh[Math.floor(rng() * fresh.length)]
    const country = frame && countryAt(world, [frame.lng, frame.lat])
    return country && allowed.has(country) ? { frame, country } : null
  }

  for (let wave = 0; wave < 4 && covered.size; wave++) {
    const sequences = Array.from({ length: 3 }, () => {
      const code = pickCountry(world, mode, rng, covered)
      const inCountry = points.filter((p) => p.country === code)
      return inCountry[Math.floor(rng() * inCountry.length)].sequence
    })
    const hit = await new Promise<{ frame: Frame; country: string; start: Awaited<ReturnType<typeof loader>> } | null>((resolve, reject) => {
      let left = sequences.length
      const done = () => --left === 0 && resolve(null)
      const fail = (e: unknown) => (e instanceof TokenError || signal.aborted ? reject(e) : done())
      for (const seq of sequences)
        loadSequence(token, seq, signal).then((street) => {
          const found = choose(street)
          if (!found) return done()
          loader(found.frame.id).then((start) => resolve({ ...found, start }), fail)
        }, fail)
    })
    if (!hit) continue
    const { frame, country, start } = hit
    return {
      id: frame.id,
      lat: frame.lat,
      lng: frame.lng,
      country,
      start,
      heading: Math.round(rng() * 360),
      date: new Date(frame.date).toISOString(),
      credit: start.creator,
      license: 'CC BY-SA 4.0',
      page: `https://www.mapillary.com/app/?pKey=${frame.id}&focus=photo`,
    }
  }
  throw new Error('Aucune vue 360° trouvée cette fois.')
}
