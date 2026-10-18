import { COUNTRIES, type Continent } from '../geo/countries'
import { load, save } from './util'

// Le passeport : chaque pays trouvé ou reconnu dans un jeu y reçoit un tampon.
export interface Stamp {
  // nombre de fois où le pays a été trouvé
  n: number
  first: number
  last: number
  games: string[]
}

export type Passport = Record<string, Stamp>

export const STAMPED = 'cg:stamped'
// tout changement du passeport, pour la synchronisation avec le compte
export const PASSPORT_CHANGED = 'cg:passport'

export const passport = (): Passport => load<Passport>('passport', {})

// Les pays qui comptent pour le pourcentage du monde : les États, pas les territoires.
export const NATIONS = COUNTRIES.filter((c) => !c.territory)

export function stamp(codes: string | (string | null | undefined)[], game: string, now = Date.now()): string[] {
  const book = passport()
  const fresh: string[] = []
  for (const code of [codes].flat()) {
    if (!code || !/^[A-Z]{2}$/.test(code)) continue
    const s = book[code]
    if (!s) fresh.push(code)
    book[code] = s
      ? { n: s.n + 1, first: s.first, last: now, games: s.games.includes(game) ? s.games : [...s.games, game] }
      : { n: 1, first: now, last: now, games: [game] }
  }
  save('passport', book)
  globalThis.dispatchEvent?.(new Event(PASSPORT_CHANGED))
  // un premier tampon s'annonce, comme un succès
  if (fresh.length) globalThis.dispatchEvent?.(new CustomEvent<string[]>(STAMPED, { detail: fresh }))
  return fresh
}

// Deux passeports du même joueur (deux appareils) : chaque pays garde sa première et sa dernière visite, le plus
// grand nombre de passages (un nombre ne s'additionne pas : il a peut-être déjà été envoyé) et tous ses jeux.
export function mergePassports(a: Passport, b: Passport): Passport {
  const out: Passport = { ...a }
  for (const [code, s] of Object.entries(b)) {
    const o = out[code]
    out[code] = o
      ? { n: Math.max(o.n, s.n), first: Math.min(o.first, s.first), last: Math.max(o.last, s.last), games: [...new Set([...o.games, ...s.games])] }
      : s
  }
  return out
}

export function savePassport(book: Passport): void {
  save('passport', book)
}

export interface Coverage {
  stamped: number
  total: number
  byContinent: { continent: Continent; stamped: number; total: number }[]
}

export function coverage(book: Passport): Coverage {
  const continents = [...new Set(NATIONS.map((c) => c.continent))].filter((c) => c !== 'AN')
  return {
    stamped: NATIONS.filter((c) => book[c.code]).length,
    total: NATIONS.length,
    byContinent: continents.map((continent) => {
      const list = NATIONS.filter((c) => c.continent === continent)
      return { continent, stamped: list.filter((c) => book[c.code]).length, total: list.length }
    }),
  }
}
