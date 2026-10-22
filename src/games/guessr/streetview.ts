import { countryAt, randomPointIn } from '../../geo/measure'
import type { World } from '../../geo/world'
import { load, save } from '../../lib/util'
import { pickCountry, type Mode } from './guess'
import { t } from '../../lib/i18n'

// Pays où Google a une couverture Street View officielle étendue ; ailleurs, la recherche tomberait à vide.
export const COVERED = new Set(
  `AD AL AT BE BG CH CZ DE DK EE ES FI FR GB GR HR HU IE IS IT LI LT LU LV MC ME MK MT NL NO PL PT RO RS RU SE SI SK SM UA
  AE BD BT ID IL IN JO JP KG KH KR KZ LA LB LK MN MY PH QA SG TH TR TW
  BW GH KE LS MG NA NG RW SN SZ TN UG ZA
  AR BO BR CA CL CO DO EC GT MX PA PE US UY
  AU NZ`.split(/\s+/),
)

export interface Pano {
  id: string
  lat: number
  lng: number
  country: string | null
  heading: number
  date: string
}

export interface Meta {
  status: string
  pano_id?: string
  location?: { lat: number; lng: number }
  copyright?: string
  date?: string
  error_message?: string
}

export class KeyError extends Error {}

// La clé vient de .env.local (VITE_GOOGLE_MAPS_KEY) ou, à défaut, de ce navigateur.
const ENV_KEY = ((import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined) ?? '').trim()
export const keyFromEnv = !!ENV_KEY
export const storedKey = (): string => ENV_KEY || load<string>('gg-key', '')
export const saveKey = (key: string) => save('gg-key', key.trim())

const META = 'https://maps.googleapis.com/maps/api/streetview/metadata'

// Les métadonnées sont gratuites et sans quota : on cherche les lieux avec elles, on ne paie qu'à l'affichage.
function metadata(key: string, lat: number, lng: number, radius: number, signal?: AbortSignal): Promise<Meta> {
  return query(new URLSearchParams({ location: `${lat},${lng}`, radius: String(radius), source: 'outdoor', key }), signal)
}

async function query(q: URLSearchParams, signal?: AbortSignal): Promise<Meta> {
  const res = await fetch(`${META}?${q}`, { signal })
  const data = (await res.json()) as Meta
  if (data.status === 'REQUEST_DENIED') throw new KeyError(data.error_message || t('Google a refusé la clé.'))
  if (data.status === 'OVER_QUERY_LIMIT') throw new Error(t('Quota Google atteint pour aujourd’hui.'))
  return data
}

export function acceptPano(m: Meta, seen: Set<string>): boolean {
  return m.status === 'OK' && !!m.pano_id && !!m.location && /google/i.test(m.copyright ?? '') && !seen.has(m.pano_id)
}

// Vérifie la clé sur un lieu couvert à coup sûr (le Champ-de-Mars) avant de l'enregistrer.
export async function checkKey(key: string): Promise<void> {
  await metadata(key, 48.8556, 2.2986, 1000)
}

// Par vagues de quatre points tirés dans des pays couverts : le premier panorama officiel trouvé l'emporte.
export async function findPano(world: World, key: string, mode: Mode, rng: () => number, seen: Set<string>, signal: AbortSignal): Promise<Pano> {
  for (let wave = 0; wave < 6; wave++) {
    const points = Array.from({ length: 4 }, () => {
      const code = pickCountry(world, mode, rng, COVERED)
      if (!code) throw new Error(t('Pas de Street View pour ce mode.'))
      return randomPointIn(world, code, rng)
    })
    const metas = await Promise.all(points.map(([lng, lat]) => metadata(key, lat, lng, 50000, signal)))
    const hit = metas.find((m) => acceptPano(m, seen))
    if (hit) {
      const { lat, lng } = hit.location!
      return { id: hit.pano_id!, lat, lng, country: countryAt(world, [lng, lat]), heading: Math.round(rng() * 360), date: hit.date ?? '' }
    }
  }
  throw new Error(t('Aucun panorama trouvé cette fois.'))
}

// Un panorama précis et son cap de départ, quand un défi les désigne.
export async function panoById(world: World, key: string, pano: string, heading: number, signal: AbortSignal): Promise<Pano> {
  const m = await query(new URLSearchParams({ pano, key }), signal)
  if (m.status !== 'OK' || !m.location) throw new Error(t('Ce panorama n’est plus disponible.'))
  const { lat, lng } = m.location
  return { id: pano, lat, lng, country: countryAt(world, [lng, lat]), heading, date: m.date ?? '' }
}

// L'API JavaScript ne se charge qu'une fois par page ; Google appelle gm_authFailure si la clé est refusée.
let loading: Promise<typeof google.maps.StreetViewPanorama> | null = null
const authListeners = new Set<() => void>()

export const mapsRequested = () => loading !== null

export function onAuthFailure(f: () => void): () => void {
  authListeners.add(f)
  return () => authListeners.delete(f)
}

export function loadStreetView(key: string): Promise<typeof google.maps.StreetViewPanorama> {
  loading ??= new Promise<void>((resolve, reject) => {
    const w = window as unknown as Record<string, unknown>
    w.gm_authFailure = () => authListeners.forEach((f) => f())
    w.__expedleMapsReady = () => resolve()
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&language=fr&callback=__expedleMapsReady`
    s.async = true
    s.onerror = () => {
      loading = null
      reject(new Error(t('Impossible de charger Google Maps.')))
    }
    document.head.appendChild(s)
  }).then(async () => ((await google.maps.importLibrary('streetView')) as google.maps.StreetViewLibrary).StreetViewPanorama)
  return loading
}
