import type { Topology } from 'topojson-specification'
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

export function loadAtlas(id: AtlasId): Promise<Atlas> {
  return id === 'usa' ? loadUsaAtlas() : Promise.resolve(worldAtlas())
}
