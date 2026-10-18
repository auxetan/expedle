import { geoAzimuthalEqualArea, geoCentroid, geoDistance, geoPath } from 'd3-geo'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { loadUsaAtlas } from '../../geo/atlas'
import { countryName } from '../../geo/countries'
import { getWorld } from '../../geo/world'
import { COUNTRY_STATS } from '../classement/data'

export interface GeoShape {
  name: string
  detail: string
  d: string
  w: number
  h: number
}

type Source =
  | { country: string }
  | { part: string; near: [number, number] }
  | { rect: [number, number] }

const DEFS: [string, string, Source][] = [
  ['France', 'métropole', { country: 'FR' }],
  ['Espagne', 'pays', { country: 'ES' }],
  ['Italie', 'pays', { country: 'IT' }],
  ['Allemagne', 'pays', { country: 'DE' }],
  ['Royaume-Uni', 'pays', { country: 'GB' }],
  ['Irlande', 'pays', { country: 'IE' }],
  ['Islande', 'pays', { country: 'IS' }],
  ['Portugal', 'pays', { country: 'PT' }],
  ['Belgique', 'pays', { country: 'BE' }],
  ['Suisse', 'pays', { country: 'CH' }],
  ['Luxembourg', 'pays', { country: 'LU' }],
  ['Pays-Bas', 'pays', { country: 'NL' }],
  ['Danemark', 'pays', { country: 'DK' }],
  ['Norvège', 'pays', { country: 'NO' }],
  ['Suède', 'pays', { country: 'SE' }],
  ['Finlande', 'pays', { country: 'FI' }],
  ['Pologne', 'pays', { country: 'PL' }],
  ['Grèce', 'pays', { country: 'GR' }],
  ['Turquie', 'pays', { country: 'TR' }],
  ['Ukraine', 'pays', { country: 'UA' }],
  ['Égypte', 'pays', { country: 'EG' }],
  ['Maroc', 'pays', { country: 'MA' }],
  ['Madagascar', 'pays', { country: 'MG' }],
  ['Japon', 'pays', { country: 'JP' }],
  ['Corée du Sud', 'pays', { country: 'KR' }],
  ['Taïwan', 'pays', { country: 'TW' }],
  ['Sri Lanka', 'pays', { country: 'LK' }],
  ['Inde', 'pays', { country: 'IN' }],
  ['Mongolie', 'pays', { country: 'MN' }],
  ['Australie', 'pays', { country: 'AU' }],
  ['Nouvelle-Zélande', 'pays', { country: 'NZ' }],
  ['Chili', 'pays', { country: 'CL' }],
  ['Brésil', 'pays', { country: 'BR' }],
  ['Cuba', 'pays', { country: 'CU' }],
  ['Groenland', 'territoire', { country: 'GL' }],
  ['Vatican', 'pays', { country: 'VA' }],
  ['Monaco', 'pays', { country: 'MC' }],
  ['Malte', 'pays', { country: 'MT' }],
  ['Singapour', 'pays', { country: 'SG' }],
  ['Chypre', 'pays', { country: 'CY' }],
  ['Israël', 'pays', { country: 'IL' }],
  ['Corse', 'île', { part: 'FR', near: [9.1, 42.1] }],
  ['Sicile', 'île', { part: 'IT', near: [14.1, 37.5] }],
  ['Sardaigne', 'île', { part: 'IT', near: [9, 40] }],
  ['Crète', 'île', { part: 'GR', near: [24.9, 35.2] }],
  ['Tasmanie', 'île', { part: 'AU', near: [146.6, -42] }],
  ['Hokkaidō', 'île', { part: 'JP', near: [143, 43.3] }],
  ['Central Park', 'New York', { rect: [0.83, 4.0] }],
]

function shape(name: string, detail: string, fc: FeatureCollection): GeoShape {
  const [lon, lat] = geoCentroid(fc)
  const proj = geoAzimuthalEqualArea().rotate([-lon, -lat]).scale(6371).translate([0, 0]).precision(0.05)
  const path = geoPath(proj)
  const [[x0, y0], [x1, y1]] = path.bounds(fc)
  proj.translate([-x0, -y0])
  return { name, detail, d: geoPath(proj)(fc) ?? '', w: x1 - x0, h: y1 - y0 }
}

function mainParts(code: string): Feature[] {
  const parts = getWorld().parts.filter((p) => p.code === code)
  const main = parts.reduce((a, b) => (b.area > a.area ? b : a))
  let radius = 0
  for (const ring of main.feature.geometry.coordinates)
    for (const pt of ring) radius = Math.max(radius, geoDistance(main.centroid, pt as [number, number]))
  return parts.filter((p) => geoDistance(main.centroid, p.centroid) < Math.max(radius * 1.5, 0.02)).map((p) => p.feature)
}

function nearestPart(code: string, near: [number, number]): Feature {
  const parts = getWorld().parts.filter((p) => p.code === code)
  return parts.reduce((a, b) => (geoDistance(b.centroid, near) < geoDistance(a.centroid, near) ? b : a)).feature
}

let cache: Promise<GeoShape[]> | null = null
export function loadGeoShapes(): Promise<GeoShape[]> {
  cache ??= loadUsaAtlas().then((usa) => {
    const fc = (features: Feature[]): FeatureCollection => ({ type: 'FeatureCollection', features: features as Feature<Geometry>[] })
    const named = DEFS.map(([name, detail, src]) => {
      if ('rect' in src) {
        const [w, h] = src.rect
        return { name, detail, d: `M0 0H${w}V${h}H0Z`, w, h }
      }
      return shape(name, detail, fc('country' in src ? mainParts(src.country) : [nearestPart(src.part, src.near)]))
    })
    const taken = new Set(named.map((n) => n.name))
    const present = new Set(getWorld().codes)
    const countries = COUNTRY_STATS.filter((c) => present.has(c.code) && !taken.has(countryName(c.code))).map((c) =>
      shape(countryName(c.code), 'pays', fc(mainParts(c.code))),
    )
    const usStates = usa.codes.map((code) => shape(usa.name(code), 'État américain', fc([usa.features.get(code)!])))
    return [...named, ...countries, ...usStates].filter((s) => s.w > 0 && s.h > 0 && Number.isFinite(s.w))
  })
  return cache
}
