import { describe, expect, it } from 'vitest'
import { US_REGIONS } from '../geo/atlas'
import { CONTINENT_NAMES } from '../geo/countries'
import { COLUMNS, ROWS } from '../games/geogrid/game'
import { MODES } from '../games/guessr/guess'
import { CATEGORIES as QUIZ_CATEGORIES } from '../games/jetpunk/model'
import { ACHIEVEMENTS, TITLES } from '../lib/achievements'
import { GAMES } from '../ui/gameInfo'
import { GAME_SECTIONS } from '../ui/games'
import { MESSAGES } from './messages'

// Tout le code de l'interface, lu tel quel (les tests et les traductions elles-mêmes exclus).
const SOURCES = import.meta.glob<string>(['../**/*.{ts,tsx}', '!../**/*.test.ts', '!./**'], { query: '?raw', import: 'default', eager: true })

const STR = String.raw`'((?:[^'\\]|\\.)*)'`
const CALLS = [new RegExp(String.raw`\b(?:t|tx|msg)\(\s*` + STR, 'g'), new RegExp(String.raw`\bplural\([^,]+,\s*` + STR + String.raw`,\s*` + STR, 'g')]

// Noms propres, identiques dans toutes les langues.
const PROPER = new Set(['Travle', 'Travle USA', 'Worldle', 'Globle', 'Countryle', 'Flagle', 'GeoGrid', 'GeoGuessr', 'PhotoGuessr', 'GeoHunter', 'Seterra', 'Size It Up', 'The Weekly 1K', 'Weigh It Up', 'Daily Question', 'Survival Mode', 'JetPunk', 'Statele', 'DailyGeo', 'Factle', 'Wikitrivia', 'Tightrope', 'OpenFront', 'Frontières'])

function usedKeys(): Set<string> {
  const keys = new Set<string>()
  for (const text of Object.values(SOURCES)) {
    for (const re of CALLS) for (const m of text.matchAll(re)) m.slice(1).forEach((k) => k && keys.add(k.replace(/\\'/g, "'")))
  }
  const games = GAME_SECTIONS.flatMap((s) => s.games)
  ;[
    ...GAME_SECTIONS.map((s) => s.label),
    ...games.flatMap((g) => [g.tagline, g.rhythm, g.title]),
    ...Object.values(GAMES).map((g) => g.title),
    ...ACHIEVEMENTS.flatMap((a) => [a.group, a.title, a.desc]),
    ...TITLES.map(([, title]) => title),
    ...Object.values(CONTINENT_NAMES),
    ...[...ROWS, ...COLUMNS].map((c) => c.label),
    ...MODES.map((m) => m.label),
    ...Object.keys(US_REGIONS),
    ...QUIZ_CATEGORIES,
    'Nord',
    'Sud',
  ].forEach((k) => keys.add(k))
  PROPER.forEach((k) => keys.delete(k))
  return keys
}

const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('traductions', () => {
  const keys = usedKeys()

  it('existent pour chaque texte de l’interface, dans les cinq langues', () => {
    const missing = [...keys].filter((k) => !MESSAGES[k] || MESSAGES[k].some((v) => !v.trim()))
    expect(missing).toEqual([])
  })

  it('gardent les mêmes {trous} que le français', () => {
    const broken = Object.entries(MESSAGES).filter(([fr, list]) => list.some((v) => holes(v).join() !== holes(fr).join()))
    expect(broken.map(([fr]) => fr)).toEqual([])
  })

  it('ne gardent pas de traductions orphelines', () => {
    expect(Object.keys(MESSAGES).filter((k) => !keys.has(k))).toEqual([])
  })
})
