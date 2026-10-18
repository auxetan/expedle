import { geoArea, geoBounds, geoContains, geoDistance } from 'd3-geo'
import type { Feature, MultiPolygon } from 'geojson'
import type { PolygonPart, World } from './world'
import { CROSSINGS } from './world'

export type LonLat = [number, number]

const EARTH_KM = 6371
const RAD = Math.PI / 180

export function distanceKm(a: LonLat, b: LonLat): number {
  return geoDistance(a, b) * EARTH_KM
}

// Cap constant (loxodromie) en degrés depuis le nord : « le Japon est à l'est de la France », comme sur une carte.
export function rhumbBearing([lon1, lat1]: LonLat, [lon2, lat2]: LonLat): number {
  const dPsi = Math.log(Math.tan(Math.PI / 4 + (lat2 * RAD) / 2) / Math.tan(Math.PI / 4 + (lat1 * RAD) / 2))
  let dLon = (lon2 - lon1) * RAD
  if (Math.abs(dLon) > Math.PI) dLon -= Math.sign(dLon) * 2 * Math.PI
  return ((Math.atan2(dLon, dPsi) / RAD) + 360) % 360
}

const ARROWS = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️']
export function compassArrow(deg: number): string {
  return ARROWS[Math.round(deg / 45) % 8]
}

function partsOf(world: World, code: string): PolygonPart[] {
  return world.parts.filter((p) => p.code === code)
}

// Centre de la masse principale : la métropole pour la France, les 48 États contigus pour les États-Unis.
export function countryCenter(world: World, code: string): LonLat {
  return partsOf(world, code).reduce((a, b) => (b.area > a.area ? b : a)).centroid
}

type Box = [[number, number], [number, number]]
const boxes = new WeakMap<PolygonPart, Box>()
const boxOf = (p: PolygonPart) => {
  let b = boxes.get(p)
  if (!b) boxes.set(p, (b = geoBounds(p.feature) as Box))
  return b
}

// Une boîte qui traverse l'antiméridien a son ouest à droite de son est.
function inBox([[w, s], [e, n]]: Box, [lon, lat]: LonLat): boolean {
  if (lat < s || lat > n) return false
  return w <= e ? lon >= w && lon <= e : lon >= w || lon <= e
}

export function countryAt(world: World, p: LonLat): string | null {
  const hit = world.parts.find((part) => inBox(boxOf(part), p) && geoContains(part.feature, p))
  return hit?.code ?? null
}

// Tirage par rejet dans une partie choisie au prorata de sa surface.
export function randomPointIn(world: World, code: string, rng: () => number): LonLat {
  const parts = partsOf(world, code)
  const total = parts.reduce((s, p) => s + p.area, 0)
  let r = rng() * total
  const part = parts.find((p) => (r -= p.area) <= 0) ?? parts[0]
  const [[w, s], [e, n]] = boxOf(part)
  const span = e >= w ? e - w : e + 360 - w
  for (let i = 0; i < 500; i++) {
    let lon = w + rng() * span
    if (lon > 180) lon -= 360
    const p: LonLat = [lon, s + rng() * (n - s)]
    if (geoContains(part.feature, p)) return p
  }
  return part.centroid
}

// Points de frontière en vecteurs unitaires 3D : le produit scalaire remplace la trigonométrie
// de geoDistance, une dizaine de fois plus vite sur les centaines de milliers de paires à comparer.
const borders = new Map<string, Float64Array>()

function borderVectors(world: World, code: string, max = 900): Float64Array {
  const cached = borders.get(code)
  if (cached) return cached
  const all = world.features.get(code)!.geometry.coordinates.flat(2) as LonLat[]
  const step = Math.max(1, Math.floor(all.length / max))
  const pts = all.filter((_, i) => i % step === 0)
  const v = new Float64Array(pts.length * 3)
  pts.forEach(([lon, lat], i) => {
    const cl = Math.cos(lat * RAD)
    v[i * 3] = cl * Math.cos(lon * RAD)
    v[i * 3 + 1] = cl * Math.sin(lon * RAD)
    v[i * 3 + 2] = Math.sin(lat * RAD)
  })
  borders.set(code, v)
  return v
}

const pairs = new Map<string, number>()

// Distance entre les frontières les plus proches, comme dans Globle ; zéro entre voisins terrestres.
export function borderDistanceKm(world: World, a: string, b: string): number {
  if (a === b) return 0
  if (world.neighbors.get(a)?.has(b) && !CROSSINGS.has(`${a}-${b}`)) return 0
  const key = a < b ? `${a}|${b}` : `${b}|${a}`
  const cached = pairs.get(key)
  if (cached !== undefined) return cached
  const va = borderVectors(world, a)
  const vb = borderVectors(world, b)
  let best = -1
  for (let i = 0; i < va.length; i += 3) {
    const x = va[i]
    const y = va[i + 1]
    const z = va[i + 2]
    for (let j = 0; j < vb.length; j += 3) {
      const dot = x * vb[j] + y * vb[j + 1] + z * vb[j + 2]
      if (dot > best) best = dot
    }
  }
  const km = Math.acos(Math.min(1, best)) * EARTH_KM
  pairs.set(key, km)
  return km
}

const lite = new WeakMap<World, Map<string, Feature<MultiPolygon>>>()

// Contours allégés pour dessiner le globe en mouvement : un point gardé tous les ~0,3°, et les îlots plus petits
// qu'un pixel écartés, sauf le plus grand morceau de chaque pays pour que les micro-États restent visibles.
export function simplifiedFeatures(world: World, tolerance = 0.3): Map<string, Feature<MultiPolygon>> {
  const cached = lite.get(world)
  if (cached) return cached
  const thin = (ring: LonLat[]): LonLat[] => {
    const out: LonLat[] = [ring[0]]
    for (let i = 1; i < ring.length - 1; i++) {
      const [px, py] = out[out.length - 1]
      const [x, y] = ring[i]
      if (Math.abs(x - px) + Math.abs(y - py) >= tolerance) out.push(ring[i])
    }
    out.push(ring[ring.length - 1])
    if (out.length >= 4 || ring.length <= 5) return out.length >= 4 ? out : ring
    const step = (ring.length - 1) / 4
    return [0, 1, 2, 3].map((k) => ring[Math.round(k * step)]).concat([ring[0]])
  }
  const map = new Map<string, Feature<MultiPolygon>>()
  const extent = (ring: LonLat[]) => {
    const xs = ring.map((p) => p[0])
    const ys = ring.map((p) => p[1])
    return Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys)
  }
  for (const [code, f] of world.features) {
    const polys = f.geometry.coordinates as LonLat[][][]
    const kept = polys.filter((poly) => extent(poly[0]) >= tolerance)
    const biggest = polys.reduce((a, b) => (extent(b[0]) > extent(a[0]) ? b : a))
    // un anneau allégé peut changer de sens et englober tout le reste du globe : on garde alors l'original
    const coordinates = (kept.length ? kept : [biggest]).map((poly) => {
      const light = poly.map(thin)
      const area = (rings: LonLat[][]) => geoArea({ type: 'Polygon', coordinates: rings })
      return area(light) > Math.max(2 * area(poly), 1e-4) ? poly : light
    })
    map.set(code, { ...f, geometry: { type: 'MultiPolygon', coordinates } })
  }
  lite.set(world, map)
  return map
}
