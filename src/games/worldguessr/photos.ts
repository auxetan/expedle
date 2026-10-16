import { COUNTRY_BY_CODE, type Continent } from '../../geo/countries'
import { countryAt, randomPointIn } from '../../geo/measure'
import type { World } from '../../geo/world'
import { normalize } from '../../lib/util'

export interface Mode {
  id: string
  label: string
  continents: Continent[] | null
  codes?: string[]
  // distance qui fait passer de 5 000 à ~1 800 points, comme le barème de GeoGuessr pour cette carte
  scaleKm: number
  view: { center: [number, number]; zoom: number }
}

export const MODES: Mode[] = [
  { id: 'monde', label: 'Monde', continents: null, scaleKm: 14916, view: { center: [20, 10], zoom: 1 } },
  { id: 'europe', label: 'Europe', continents: ['EU'], scaleKm: 4500, view: { center: [52, 15], zoom: 3 } },
  { id: 'afrique', label: 'Afrique', continents: ['AF'], scaleKm: 8000, view: { center: [2, 18], zoom: 3 } },
  { id: 'asie', label: 'Asie', continents: ['AS'], scaleKm: 9000, view: { center: [32, 90], zoom: 2 } },
  { id: 'ameriques', label: 'Amériques', continents: ['NA', 'SA'], scaleKm: 13000, view: { center: [12, -80], zoom: 2 } },
  { id: 'oceanie', label: 'Océanie', continents: ['OC'], scaleKm: 6000, view: { center: [-22, 150], zoom: 3 } },
  { id: 'france', label: 'France', continents: null, codes: ['FR'], scaleKm: 1300, view: { center: [46.6, 2.4], zoom: 5 } },
]

export function score(km: number, scaleKm: number): number {
  return Math.round(5000 * Math.exp((-10 * km) / scaleKm))
}

export interface CommonsPage {
  pageid: number
  title: string
  coordinates?: { lat: number; lon: number }[]
  imageinfo?: {
    mime: string
    width: number
    height: number
    thumburl?: string
    descriptionurl?: string
    extmetadata?: Record<string, { value: string } | undefined>
  }[]
}

// Ce qui ne se joue pas : cartes et schémas (la réponse est dessus), portraits, intérieurs, œuvres, documents,
// et les vues prises depuis l'espace ou d'avion, géolocalisées au point survolé.
const BLOCK =
  /\b(maps?|cartes?|plans?|logos?|flags?|drapeaux?|coat of arms|blasons?|diagrams?|charts?|graphs?|schemas?|signatures?|documents?|stamps?|timbres?|posters?|affiches?|books?|manuscripts?|paintings?|tableaux?|illustrations?|drawings?|dessins?|engravings?|gravures?|postcards?|aerial|satellite|interiors?|interieurs?|museums?|musees?|exhibits?|portraits?|selfies?|screenshots?|plaques?|x ray|microscop\w*|iss\d*|sts\d*|view of earth|earth observation|astronaut\w*|space station|spacecraft|expedition \d+|nasa|from (an? )?(air)?plane|airplane window|in flight|vue aerienne|vue d avion|flowers?|fleurs?|insects?|insectes?|birds?|oiseaux?|plants?|plantes?|animals?|animaux|macro\w*|fungi|mushrooms?|champignons?|butterfl\w+|papillons?|moths?|spiders?|beetles?|frogs?|lizards?|snakes?|inaturalist|specimens?|herbarium|taxon\w*|species|flora|fauna|close up|food|dishes?)\b/

const meta = (p: CommonsPage, key: string) => p.imageinfo?.[0].extmetadata?.[key]?.value ?? ''

function playable(p: CommonsPage): boolean {
  const ii = p.imageinfo?.[0]
  if (!ii || !p.coordinates?.length || !ii.thumburl) return false
  if (ii.mime !== 'image/jpeg' || ii.width < 900 || ii.height < 500) return false
  const ratio = ii.width / ii.height
  if (ratio < 1.15 || ratio > 2.6) return false
  return !BLOCK.test(normalize(`${p.title} ${meta(p, 'Categories')} ${meta(p, 'ObjectName')}`))
}

// Les imports Panoramio sont des vues de rue ou de paysage prises par des voyageurs : le meilleur matériau.
const preferred = (p: CommonsPage) => /panoramio/i.test(meta(p, 'Categories'))

// En mode strict, seules les vues Panoramio passent ; sinon toute photo jouable.
export function pickPhoto(pages: CommonsPage[], seen: Set<number>, rng: () => number, strict = false): CommonsPage | null {
  const ok = pages.filter((p) => !seen.has(p.pageid) && playable(p))
  const best = ok.filter(preferred)
  const pool = best.length || strict ? best : ok
  return pool.length ? pool[Math.floor(rng() * pool.length)] : null
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface Place {
  pageid: number
  lat: number
  lng: number
  image: string
  page: string
  title: string
  author: string
  license: string
  licenseUrl: string
  country: string | null
}

function toPlace(world: World, p: CommonsPage): Place {
  const ii = p.imageinfo![0]
  const { lat, lon } = p.coordinates![0]
  return {
    pageid: p.pageid,
    lat,
    lng: lon,
    image: ii.thumburl!,
    page: ii.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
    title: p.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, '').replace(/_/g, ' '),
    author: stripHtml(meta(p, 'Artist')) || 'auteur inconnu',
    license: meta(p, 'LicenseShortName') || 'licence libre',
    licenseUrl: meta(p, 'LicenseUrl'),
    country: countryAt(world, [lon, lat]),
  }
}

const API = 'https://commons.wikimedia.org/w/api.php'

class RateLimited extends Error {
  waitMs: number
  constructor(waitMs: number) {
    super('Commons demande de patienter')
    this.waitMs = waitMs
  }
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const id = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => (clearTimeout(id), reject(signal.reason)), { once: true })
  })

async function photosAround(lat: number, lng: number, signal: AbortSignal): Promise<CommonsPage[]> {
  const q = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'geosearch',
    ggscoord: `${lat}|${lng}`,
    ggsradius: '10000',
    ggslimit: '50',
    ggsnamespace: '6',
    prop: 'imageinfo|coordinates',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '1280',
    iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl|Categories|ObjectName',
  })
  // Wikimedia demande aux outils de se présenter ; ce nom passe par un en-tête autorisé en CORS.
  const res = await fetch(`${API}?${q}`, { signal, headers: { 'Api-User-Agent': 'Meridien/1.0 (jeu de géographie personnel)' } })
  if (res.status === 429) throw new RateLimited(1000 * (Number(res.headers.get('Retry-After')) || 2))
  if (!res.ok) throw new Error(`Commons ${res.status}`)
  const data = (await res.json()) as { query?: { pages?: Record<string, CommonsPage> } }
  return Object.values(data.query?.pages ?? {})
}

function weightedCountry(world: World, mode: Mode, rng: () => number): string {
  const codes =
    mode.codes ??
    world.codes.filter((c) => {
      const m = COUNTRY_BY_CODE.get(c)
      return m && !m.territory && m.continent !== 'AN' && (!mode.continents || mode.continents.includes(m.continent))
    })
  // racine de la surface : la Russie sort plus souvent que Malte, sans écraser le reste du monde
  const weights = codes.map((c) => Math.sqrt(world.parts.filter((p) => p.code === c).reduce((s, p) => s + p.area, 0)))
  let r = rng() * weights.reduce((a, b) => a + b, 0)
  return codes[weights.findIndex((w) => (r -= w) <= 0)] ?? codes[0]
}

// Par vagues de cinq points tirés dans des pays au sort, interrogées en parallèle : la première photo
// qui convient l'emporte. Les deux premières vagues n'acceptent que des vues Panoramio.
export async function findPlace(world: World, mode: Mode, rng: () => number, seen: Set<number>, signal: AbortSignal): Promise<Place> {
  let lastError: unknown = null
  for (let wave = 0; wave < 5; wave++) {
    const points = Array.from({ length: 5 }, () => randomPointIn(world, weightedCountry(world, mode, rng), rng))
    const answers = await Promise.all(
      points.map(([lng, lat]) =>
        photosAround(lat, lng, signal).catch((e: unknown) => {
          lastError = e
          return e
        }),
      ),
    )
    if (signal.aborted) throw signal.reason
    for (const a of answers) {
      if (!Array.isArray(a)) continue
      const pick = pickPhoto(a, seen, rng, wave < 2)
      if (pick) return toPlace(world, pick)
    }
    const limited = answers.find((a): a is RateLimited => a instanceof RateLimited)
    if (limited) await sleep(Math.min(6000, limited.waitMs), signal)
  }
  throw lastError ?? new Error('Aucune photo trouvée')
}
