import { geoArea, geoCentroid } from 'd3-geo'
import type { Feature, MultiPolygon, Polygon } from 'geojson'
import isoCountries from 'i18n-iso-countries'
import { feature } from 'topojson-client'
import type { GeometryObject, Topology } from 'topojson-specification'
import topoJson from 'world-atlas/countries-50m.json'
import { COUNTRY_BY_CODE } from './countries'
import { buildGraph, type Graph } from './graph'

const topo = topoJson as unknown as Topology

export interface PolygonPart {
  code: string
  feature: Feature<Polygon>
  centroid: [number, number]
  area: number
}

export interface World {
  codes: string[]
  features: Map<string, Feature<MultiPolygon>>
  parts: PolygonPart[]
  graph: Graph
  neighbors: Map<string, Set<string>>
}

const UNNAMED: Record<string, string | null> = {
  Somaliland: 'SO',
  Kosovo: 'XK',
  'N. Cyprus': 'CY',
  'Siachen Glacier': 'IN',
  'Indian Ocean Ter.': null,
}

// Régions d'outre-mer traitées comme des régions à part, comme dans le jeu d'origine.
function regionCode(code: string, lon: number, lat: number): string {
  if (code === 'FR') {
    if (lon < -50 && lat < 8) return 'GF'
    if (lon < -60 && lat > 15.6) return 'GP'
    if (lon < -60) return 'MQ'
    if (lon > 50 && lat < -15) return 'RE'
    if (lon > 44 && lon < 46 && lat < -12) return 'YT'
  }
  if (code === 'NL' && lon < -20) return 'BQ'
  return code
}

// Exclaves : elles ne créent pas de nouvelles frontières pour le reste du pays.
function exclaveTag(code: string, lon: number, lat: number): string {
  if (code === 'RU' && lon < 23 && lat < 56) return '#kaliningrad'
  if (code === 'AO' && lat > -6.5) return '#cabinda'
  if (code === 'AZ' && lon < 46) return '#nakhitchevan'
  if (code === 'PS' && lon < 34.6) return '#gaza'
  if (code === 'ES' && lat < 36) return lon > -8 ? '#ceuta-melilla' : '#canaries'
  return ''
}

// Ponts, tunnels et frontières que les données ne voient pas.
const EXTRA_LINKS: [string, string][] = [
  ['FR', 'GB'],
  ['DK', 'SE'],
  ['GL', 'CA'],
  ['SG', 'MY'],
  ['BH', 'SA'],
  ['ZM', 'BW'],
]

type PolygonArcs = number[][]

function build(): World {
  const geoms = (topo.objects.countries as { geometries: (GeometryObject & { properties?: { name: string } })[] })
    .geometries
  const polys: { code: string; comp: string; arcs: PolygonArcs; part: PolygonPart }[] = []

  for (const geom of geoms) {
    const name = geom.properties?.name ?? ''
    const code = geom.id ? isoCountries.numericToAlpha2(String(geom.id)) : UNNAMED[name]
    if (!code || !COUNTRY_BY_CODE.has(code)) continue
    if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') continue
    const list = (geom.type === 'Polygon' ? [geom.arcs] : geom.arcs) as PolygonArcs[]
    for (const arcs of list) {
      const f = feature(topo, { type: 'Polygon', arcs } as GeometryObject) as unknown as Feature<Polygon>
      const centroid = geoCentroid(f) as [number, number]
      const region = regionCode(code, centroid[0], centroid[1])
      polys.push({
        code: region,
        comp: region + exclaveTag(region, centroid[0], centroid[1]),
        arcs,
        part: { code: region, feature: f, centroid, area: geoArea(f) },
      })
    }
  }

  const byCode = new Map<string, PolygonArcs[]>()
  for (const p of polys) byCode.set(p.code, [...(byCode.get(p.code) ?? []), p.arcs])
  const features = new Map<string, Feature<MultiPolygon>>()
  for (const [code, arcs] of byCode) {
    const f = feature(topo, { type: 'MultiPolygon', arcs } as GeometryObject) as unknown as Feature<MultiPolygon>
    f.id = code
    features.set(code, f)
  }

  const compIds = [...new Set(polys.map((p) => p.comp))]
  const compIndex = new Map(compIds.map((c, i) => [c, i]))
  const owners = new Map<number, Set<number>>()
  for (const p of polys) {
    const ci = compIndex.get(p.comp)!
    for (const ring of p.arcs)
      for (const a of ring) {
        const k = a < 0 ? ~a : a
        const set = owners.get(k) ?? new Set<number>()
        set.add(ci)
        owners.set(k, set)
      }
  }
  const edgeKeys = new Set<string>()
  const edges: [number, number][] = []
  const addEdge = (a: number, b: number) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`
    if (a === b || edgeKeys.has(key)) return
    edgeKeys.add(key)
    edges.push([a, b])
  }
  for (const set of owners.values()) {
    const list = [...set]
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) addEdge(list[i], list[j])
  }
  for (const [a, b] of EXTRA_LINKS) {
    const ia = compIndex.get(a)
    const ib = compIndex.get(b)
    if (ia !== undefined && ib !== undefined) addEdge(ia, ib)
  }

  const nodes = compIds.map((c) => ({ country: c.split('#')[0] }))
  const graph = buildGraph(nodes, edges)
  const neighbors = new Map<string, Set<string>>()
  for (const [a, b] of edges) {
    const ca = nodes[a].country
    const cb = nodes[b].country
    if (ca === cb) continue
    neighbors.set(ca, (neighbors.get(ca) ?? new Set()).add(cb))
    neighbors.set(cb, (neighbors.get(cb) ?? new Set()).add(ca))
  }

  return { codes: [...features.keys()], features, parts: polys.map((p) => p.part), graph, neighbors }
}

let cached: World | null = null
export function getWorld(): World {
  cached ??= build()
  return cached
}
