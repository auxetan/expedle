import { countryAt, randomPointIn } from '../../geo/measure'
import type { World } from '../../geo/world'
import { normalize } from '../../lib/util'
import { pickCountry, type Mode } from './guess'
import { t } from '../../lib/i18n'

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
export function pickPhoto(pages: CommonsPage[], seen: Set<string>, rng: () => number, strict = false): CommonsPage | null {
  const ok = pages.filter((p) => !seen.has(String(p.pageid)) && playable(p))
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
  id: string
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
    id: String(p.pageid),
    lat,
    lng: lon,
    image: ii.thumburl!,
    page: ii.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
    title: p.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, '').replace(/_/g, ' '),
    author: stripHtml(meta(p, 'Artist')) || t('auteur inconnu'),
    license: meta(p, 'LicenseShortName') || t('licence libre'),
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

async function commons(params: Record<string, string>, signal: AbortSignal): Promise<CommonsPage[]> {
  const q = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    prop: 'imageinfo|coordinates',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '1280',
    iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl|Categories|ObjectName',
    ...params,
  })
  // Wikimedia demande aux outils de se présenter ; ce nom passe par un en-tête autorisé en CORS.
  const res = await fetch(`${API}?${q}`, { signal, headers: { 'Api-User-Agent': 'Meridien/1.0 (jeu de géographie personnel)' } })
  if (res.status === 429) throw new RateLimited(1000 * (Number(res.headers.get('Retry-After')) || 2))
  if (!res.ok) throw new Error(`Commons ${res.status}`)
  const data = (await res.json()) as { query?: { pages?: Record<string, CommonsPage> } }
  return Object.values(data.query?.pages ?? {})
}

function photosAround(lat: number, lng: number, signal: AbortSignal): Promise<CommonsPage[]> {
  return commons({ generator: 'geosearch', ggscoord: `${lat}|${lng}`, ggsradius: '10000', ggslimit: '50', ggsnamespace: '6' }, signal)
}

// Une photo précise, quand un défi la désigne par son numéro de page.
export async function placeById(world: World, id: string, signal: AbortSignal): Promise<Place> {
  const [page] = await commons({ pageids: id }, signal)
  if (!page?.imageinfo?.[0]?.thumburl || !page.coordinates?.length) throw new Error(t('Cette photo n’est plus disponible.'))
  return toPlace(world, page)
}

// Par vagues de cinq points tirés dans des pays au sort, interrogées en parallèle : la première photo
// qui convient l'emporte. Les deux premières vagues n'acceptent que des vues Panoramio.
export async function findPlace(world: World, mode: Mode, rng: () => number, seen: Set<string>, signal: AbortSignal): Promise<Place> {
  let lastError: unknown = null
  for (let wave = 0; wave < 5; wave++) {
    const points = Array.from({ length: 5 }, () => randomPointIn(world, pickCountry(world, mode, rng)!, rng))
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
