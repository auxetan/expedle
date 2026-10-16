import { geoBounds, geoContains, geoDistance } from 'd3-geo'
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

const borders = new Map<string, LonLat[]>()

// Points de frontière régulièrement espacés, assez nombreux pour une distance à quelques kilomètres près.
function borderPoints(world: World, code: string, max = 600): LonLat[] {
  const cached = borders.get(code)
  if (cached) return cached
  const all = world.features.get(code)!.geometry.coordinates.flat(2) as LonLat[]
  const step = Math.max(1, Math.floor(all.length / max))
  const pts = all.filter((_, i) => i % step === 0)
  borders.set(code, pts)
  return pts
}

// Distance entre les frontières les plus proches, comme dans Globle ; zéro entre voisins terrestres.
export function borderDistanceKm(world: World, a: string, b: string): number {
  if (a === b) return 0
  if (world.neighbors.get(a)?.has(b) && !CROSSINGS.has(`${a}-${b}`)) return 0
  const pa = borderPoints(world, a)
  const pb = borderPoints(world, b)
  let best = Infinity
  for (const p of pa) for (const q of pb) best = Math.min(best, geoDistance(p, q))
  return best * EARTH_KM
}
