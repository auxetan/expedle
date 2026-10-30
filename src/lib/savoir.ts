import { COUNTRY_BY_CODE } from '../geo/countries'
import { msg } from './i18n'
import { load, save, todayKey } from './util'

// Ce qu'Expedle retient de chaque pays, sous cinq angles. Chaque angle d'un pays est une carte de Leitner : une
// réussite la fait monter d'une boîte, un échec la renvoie dans la première, et chaque boîte a son délai avant de
// revenir en révision.
export type Facet = 'forme' | 'drapeau' | 'capitale' | 'position' | 'voisins'

export const FACETS: Facet[] = ['forme', 'drapeau', 'capitale', 'position', 'voisins']

export const FACET_LABELS: Record<Facet, string> = {
  forme: msg('Silhouette'),
  drapeau: msg('Drapeau'),
  capitale: msg('Capitale'),
  position: msg('Sur la carte'),
  voisins: msg('Voisins'),
}

export interface Card {
  // de 1 à 5
  box: number
  // l'arrivée dans la boîte : le délai avant la révision suivante part de là
  at: number
  // les dernières réussites et les derniers échecs, datés
  ok: number[]
  ko: number[]
}

export type Savoir = Record<string, Partial<Record<Facet, Card>>>

// tout changement de ce que sait le joueur
export const SAVOIR_CHANGED = 'cg:savoir'

// jours d'attente avant de revoir une carte, boîte par boîte : une erreur se revoit le jour même
const DELAYS = [0, 1, 3, 7, 21]
const KEPT = 5

export const savoir = (): Savoir => load<Savoir>('savoir', {})

// au jour près, en heure locale : une carte revient le matin de son jour, pas à l'heure exacte de la dernière réponse
function isDue(card: Card, now: number): boolean {
  const d = new Date(card.at)
  return todayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + DELAYS[card.box - 1])) <= todayKey(new Date(now))
}

export function record(code: string, facet: Facet, ok: boolean, now = Date.now()): void {
  const meta = COUNTRY_BY_CODE.get(code)
  if (!meta || meta.territory) return
  const book = savoir()
  const card = book[code]?.[facet] ?? { box: 1, at: now, ok: [], ko: [] }
  // une réussite avant l'heure ne fait pas monter la carte : seule une réponse espacée prouve qu'on a retenu
  const reviewed = !ok || isDue(card, now)
  book[code] = {
    ...book[code],
    [facet]: {
      box: !ok ? 1 : reviewed ? Math.min(card.box + 1, DELAYS.length) : card.box,
      at: reviewed ? now : card.at,
      ok: ok ? [...card.ok, now].slice(-KEPT) : card.ok,
      ko: ok ? card.ko : [...card.ko, now].slice(-KEPT),
    },
  }
  save('savoir', book)
  globalThis.dispatchEvent?.(new Event(SAVOIR_CHANGED))
}

export interface Mastery {
  // de 0 à 1 : la moyenne des angles qui comptent pour ce pays, un angle jamais demandé valant 0
  overall: number
  // de 0 à 1 par angle, null tant qu'il n'a jamais été demandé
  by: Record<Facet, number | null>
}

// `facets` : les angles qui comptent pour ce pays (un pays sans voisin terrestre n'a pas de voisins à connaître)
export function mastery(code: string, facets: Facet[] = FACETS, book = savoir()): Mastery {
  const cards = book[code] ?? {}
  const by = Object.fromEntries(FACETS.map((f) => [f, cards[f] ? (cards[f].box - 1) / (DELAYS.length - 1) : null])) as Record<Facet, number | null>
  return { overall: facets.reduce((sum, f) => sum + (by[f] ?? 0), 0) / facets.length, by }
}

export interface Due {
  code: string
  facet: Facet
  box: number
}

// Les cartes à revoir aujourd'hui : les plus fragiles d'abord, puis celles qui attendent depuis le plus longtemps.
export function due(now = Date.now(), book = savoir()): Due[] {
  return Object.entries(book)
    .flatMap(([code, cards]) => FACETS.flatMap((facet) => (cards[facet] && isDue(cards[facet], now) ? [{ code, facet, card: cards[facet] }] : [])))
    .sort((a, b) => a.card.box - b.card.box || a.card.at - b.card.at)
    .map(({ code, facet, card }) => ({ code, facet, box: card.box }))
}
