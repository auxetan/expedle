import type { Feature, FeatureCollection, Polygon } from 'geojson'
import { feature, mergeArcs } from 'topojson-client'
import type { GeometryCollection, MultiPolygon as TopoMultiPolygon, Polygon as TopoPolygon, Topology } from 'topojson-specification'
import { getLang } from '../lib/i18n'
import { COUNTRY_BY_CODE, CONTINENT_NAMES, countryName, foreignNames } from './countries'
import { assemble, getWorld, polygonPart, type PolygonArcs, type RawPolygon, type World } from './world'

export type AtlasId = 'monde' | 'usa'

export interface Atlas extends World {
  id: AtlasId
  label: string
  name: (code: string) => string
  aliases: (code: string) => string[]
  // départs/arrivées tirés au hasard
  playable: string[]
  region: (code: string) => string | null
  regions: string[]
}

let world: Atlas | null = null
export function worldAtlas(): Atlas {
  if (world) return world
  const w = getWorld()
  world = {
    ...w,
    id: 'monde',
    label: 'Monde',
    name: countryName,
    // le nom français reste une réponse valable quelle que soit la langue du site
    aliases: (c) => {
      const meta = COUNTRY_BY_CODE.get(c)
      return meta ? [meta.name, ...meta.aliases, ...foreignNames(c)] : []
    },
    playable: w.codes.filter((c) => w.neighbors.has(c) && !COUNTRY_BY_CODE.get(c)?.territory),
    region: (c) => {
      const cont = COUNTRY_BY_CODE.get(c)?.continent
      return cont ? CONTINENT_NAMES[cont] : null
    },
    regions: ['Afrique', 'Amérique du Nord', 'Amérique du Sud', 'Asie', 'Europe', 'Océanie'],
  }
  return world
}

// FIPS|nom français|abréviation postale|alias anglais
const STATES = `01|Alabama|AL
02|Alaska|AK
04|Arizona|AZ
05|Arkansas|AR
06|Californie|CA|California
08|Colorado|CO
09|Connecticut|CT
10|Delaware|DE
11|District de Columbia|DC|Washington DC;District of Columbia
12|Floride|FL|Florida
13|Géorgie|GA|Georgia
15|Hawaï|HI|Hawaii
16|Idaho|ID
17|Illinois|IL
18|Indiana|IN
19|Iowa|IA
20|Kansas|KS
21|Kentucky|KY
22|Louisiane|LA|Louisiana
23|Maine|ME
24|Maryland|MD
25|Massachusetts|MA
26|Michigan|MI
27|Minnesota|MN
28|Mississippi|MS
29|Missouri|MO
30|Montana|MT
31|Nebraska|NE
32|Nevada|NV
33|New Hampshire|NH
34|New Jersey|NJ
35|Nouveau-Mexique|NM|New Mexico
36|New York|NY
37|Caroline du Nord|NC|North Carolina
38|Dakota du Nord|ND|North Dakota
39|Ohio|OH
40|Oklahoma|OK
41|Oregon|OR
42|Pennsylvanie|PA|Pennsylvania
44|Rhode Island|RI
45|Caroline du Sud|SC|South Carolina
46|Dakota du Sud|SD|South Dakota
47|Tennessee|TN
48|Texas|TX
49|Utah|UT
50|Vermont|VT
51|Virginie|VA|Virginia
53|Washington|WA
54|Virginie-Occidentale|WV|West Virginia
55|Wisconsin|WI
56|Wyoming|WY`

const STATE_META = new Map(
  STATES.split('\n').map((line) => {
    const [fips, name, postal, aliases = ''] = line.split('|')
    return [fips, { name, aliases: [postal, ...aliases.split(';').filter(Boolean)] }]
  }),
)

export const US_REGIONS: Record<string, string[]> = {
  'Nord-Est': ['09', '23', '25', '33', '44', '50', '34', '36', '42'],
  'Midwest': ['17', '18', '26', '39', '55', '19', '20', '27', '29', '31', '38', '46'],
  Sud: ['10', '11', '12', '13', '24', '37', '45', '51', '54', '01', '21', '28', '47', '05', '22', '40', '48'],
  Ouest: ['04', '08', '16', '30', '32', '35', '49', '56', '02', '06', '15', '41', '53'],
}

let usa: Promise<Atlas> | null = null
export function loadUsaAtlas(): Promise<Atlas> {
  usa ??= import('us-atlas/states-10m.json').then((mod) => {
    const topo = (mod.default ?? mod) as unknown as Topology
    const geoms = (topo.objects.states as unknown as { geometries: { id: string; type: string; arcs: unknown }[] }).geometries
    const polys: RawPolygon[] = []
    for (const g of geoms) {
      if (!STATE_META.has(g.id)) continue
      const list = (g.type === 'Polygon' ? [g.arcs] : g.arcs) as PolygonArcs[]
      for (const arcs of list) polys.push({ code: g.id, comp: g.id, arcs, part: polygonPart(topo, g.id, arcs) })
    }
    // Four Corners : les coins comptent comme frontière
    const built = assemble(topo, polys, [
      ['49', '35'],
      ['04', '08'],
    ])
    const regionOf = new Map(Object.entries(US_REGIONS).flatMap(([r, codes]) => codes.map((c) => [c, r] as const)))
    return {
      ...built,
      id: 'usa',
      label: 'États-Unis',
      // hors du français, le nom anglais de l'État quand il diffère (California, Georgia…)
      name: (c) => {
        const meta = STATE_META.get(c)
        if (!meta) return c
        return getLang() === 'fr' ? meta.name : (meta.aliases.find((a) => a.length > 2) ?? meta.name)
      },
      aliases: (c) => {
        const meta = STATE_META.get(c)
        return meta ? [meta.name, ...meta.aliases] : []
      },
      playable: built.codes.filter((c) => built.neighbors.has(c) && c !== '11'),
      region: (c) => regionOf.get(c) ?? null,
      regions: Object.keys(US_REGIONS),
    } satisfies Atlas
  })
  return usa
}

// Les régions et leurs départements (code INSEE), outre-mer compris.
export const FR_REGIONS: Record<string, string[]> = {
  'Auvergne-Rhône-Alpes': ['01', '03', '07', '15', '26', '38', '42', '43', '63', '69', '73', '74'],
  'Bourgogne-Franche-Comté': ['21', '25', '39', '58', '70', '71', '89', '90'],
  Bretagne: ['22', '29', '35', '56'],
  'Centre-Val de Loire': ['18', '28', '36', '37', '41', '45'],
  Corse: ['2A', '2B'],
  'Grand Est': ['08', '10', '51', '52', '54', '55', '57', '67', '68', '88'],
  'Hauts-de-France': ['02', '59', '60', '62', '80'],
  'Île-de-France': ['75', '77', '78', '91', '92', '93', '94', '95'],
  Normandie: ['14', '27', '50', '61', '76'],
  'Nouvelle-Aquitaine': ['16', '17', '19', '23', '24', '33', '40', '47', '64', '79', '86', '87'],
  Occitanie: ['09', '11', '12', '30', '31', '32', '34', '46', '48', '65', '66', '81', '82'],
  'Pays de la Loire': ['44', '49', '53', '72', '85'],
  'Provence-Alpes-Côte d’Azur': ['04', '05', '06', '13', '83', '84'],
  Guadeloupe: ['971'],
  Martinique: ['972'],
  Guyane: ['973'],
  'La Réunion': ['974'],
  Mayotte: ['976'],
}

export interface France {
  departements: World
  // les régions, recomposées à partir de leurs départements : leurs frontières se superposent exactement
  regions: World
  // les cadres des départements d'outre-mer, rapprochés de la métropole (voir france/LICENSE.md)
  frames: Feature<Polygon>[]
}

let france: Promise<France> | null = null
export function loadFrance(): Promise<France> {
  france ??= import('./france/departements.json').then((mod) => {
    const topo = (mod.default ?? mod) as unknown as Topology
    const geoms = (topo.objects.departements as GeometryCollection).geometries as (TopoPolygon | TopoMultiPolygon)[]
    const byCode = new Map(geoms.map((g) => [String(g.id), g]))
    const polygons = (code: string, g: TopoPolygon | TopoMultiPolygon): RawPolygon[] =>
      (g.type === 'Polygon' ? [g.arcs] : g.arcs).map((arcs) => ({ code, comp: code, arcs, part: polygonPart(topo, code, arcs) }))
    const regions = Object.entries(FR_REGIONS).flatMap(([name, codes]) => polygons(name, mergeArcs(topo, codes.map((c) => byCode.get(c)!))))
    return {
      departements: assemble(topo, [...byCode].flatMap(([code, g]) => polygons(code, g)), []),
      regions: assemble(topo, regions, []),
      frames: (feature(topo, topo.objects.cadres) as FeatureCollection<Polygon>).features,
    }
  })
  return france
}

export function loadAtlas(id: AtlasId): Promise<Atlas> {
  return id === 'usa' ? loadUsaAtlas() : Promise.resolve(worldAtlas())
}
