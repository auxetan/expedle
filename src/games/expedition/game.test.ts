import { describe, expect, it } from 'vitest'
import { worldAtlas } from '../../geo/atlas'
import {
  answerCustoms,
  choices,
  customsQuestion,
  cross,
  customsDue,
  dailyExpedition,
  here,
  hops,
  miss,
  route,
  score,
  shareText,
  stars,
  startRun,
  status,
  type Expedition,
} from './game'

// une ligne A-B-C-D-E, et un détour B-X-D
const LINE = new Map<string, Set<string>>([
  ['A', new Set(['B'])],
  ['B', new Set(['A', 'C', 'X'])],
  ['C', new Set(['B', 'D'])],
  ['D', new Set(['C', 'E', 'X'])],
  ['E', new Set(['D'])],
  ['X', new Set(['B', 'D'])],
])
const exp = (p: Partial<Expedition> = {}): Expedition => ({ start: 'A', end: 'E', closed: null, cache: null, optimal: 4, supplies: 9, ...p })

describe('chemins', () => {
  it('compte les frontières à passer, une frontière fermée en moins', () => {
    expect(hops(LINE, 'A').get('E')).toBe(4)
    expect(hops(LINE, 'A', ['B', 'C']).get('E')).toBe(4)
    expect(route(LINE, 'A', 'E', ['B', 'C'])).toEqual(['A', 'B', 'X', 'D', 'E'])
    expect(hops(LINE, 'A', ['A', 'B']).get('E')).toBeUndefined()
  })
})

describe('expédition du jour', () => {
  const atlas = worldAtlas()

  it('est la même pour tout le monde le même jour, et change le lendemain', () => {
    const a = dailyExpedition(atlas.neighbors, atlas.playable, atlas.region, '2026-10-29')
    expect(dailyExpedition(atlas.neighbors, atlas.playable, atlas.region, '2026-10-29')).toEqual(a)
    expect(dailyExpedition(atlas.neighbors, atlas.playable, atlas.region, '2026-10-30')).not.toEqual(a)
  })

  it('relie toujours deux régions par un vrai chemin, détour de la frontière fermée compris', () => {
    for (const day of ['2026-10-29', '2026-11-02', '2026-12-25', '2027-03-14', '2027-07-01']) {
      const e = dailyExpedition(atlas.neighbors, atlas.playable, atlas.region, day)
      expect(atlas.region(e.start)).not.toBe(atlas.region(e.end))
      expect(e.optimal).toBeGreaterThanOrEqual(7)
      expect(hops(atlas.neighbors, e.start, e.closed).get(e.end)).toBe(e.optimal)
      expect(e.supplies).toBe(e.optimal + 5)
    }
  })
})

describe('en route', () => {
  it('coûte un vivre par frontière et deux par erreur à la douane', () => {
    let run = startRun(exp())
    run = cross(exp(), run, 'B')
    expect(here(run)).toBe('B')
    expect(run.supplies).toBe(8)
    run = miss(run, 'C')
    expect(run.supplies).toBe(6)
    expect(run.revealed).toContain('C')
    expect(here(run)).toBe('B')
  })

  it('rend des vivres à la réserve, une seule fois', () => {
    const e = exp({ cache: 'X' })
    let run = cross(e, startRun(e), 'B')
    run = cross(e, run, 'X')
    expect(run.supplies).toBe(9 - 2 + 2)
    run = cross(e, run, 'B')
    run = cross(e, run, 'X')
    expect(run.supplies).toBe(9 - 4 + 2)
  })

  it('arrive, ou reste bloqué faute de vivres', () => {
    let run = startRun(exp())
    for (const c of ['B', 'C', 'D', 'E']) run = cross(exp(), run, c)
    expect(status(exp(), run)).toBe('arrivé')
    const short = exp({ supplies: 2 })
    expect(status(short, miss(startRun(short), 'B'))).toBe('bloqué')
  })

  it('pose une question à la douane toutes les trois frontières, et rend un vivre si elle est juste', () => {
    let run = startRun(exp())
    for (const c of ['B', 'C']) run = cross(exp(), run, c)
    expect(customsDue(run)).toBe(false)
    run = cross(exp(), run, 'D')
    expect(customsDue(run)).toBe(true)
    run = answerCustoms(run, true)
    expect(customsDue(run)).toBe(false)
    expect(run.supplies).toBe(9 - 3 + 1)
  })
})

describe('fin d’expédition', () => {
  it('note l’arrivée selon les vivres restants, et un échec selon le chemin fait', () => {
    let run = startRun(exp())
    for (const c of ['B', 'C', 'D', 'E']) run = cross(exp(), run, c)
    expect(score(LINE, exp(), run)).toBe(100)
    expect(stars(exp(), run)).toBe(3)
    const stuck = { ...cross(exp(), cross(exp(), startRun(exp()), 'B'), 'C'), supplies: 0 }
    expect(score(LINE, exp(), stuck)).toBe(20)
    expect(stars(exp(), stuck)).toBe(0)
  })

  it('se partage en drapeaux, la route dans l’ordre', () => {
    const e = exp({ start: 'PT', end: 'FR', optimal: 2, supplies: 7 })
    let run = startRun(e)
    run = cross(e, run, 'ES')
    run = cross(e, run, 'FR')
    const text = shareText(e, run, '2026-10-29', (c) => ({ PT: 'Portugal', FR: 'France' })[c] ?? c)
    expect(text).toContain('Portugal → France')
    expect(text).toContain('🇵🇹🇪🇸🇫🇷 🏁')
    expect(text).toContain('expedle.com')
  })
})

describe('douane', () => {
  it('propose le bon pays parmi quatre, avec d’autres voisins pour brouiller', () => {
    const pool = ['A', 'B', 'C', 'D', 'E', 'X']
    const options = choices(LINE, () => 'Z', pool, 'B', 'C', () => 0.42)
    expect(options).toHaveLength(4)
    expect(options).toContain('C')
    expect(new Set(options).size).toBe(4)
    expect(options).toEqual(expect.arrayContaining(['A', 'X']))
  })
})

describe('douane renforcée', () => {
  const capital = (c: string) => ({ A: 'Alpha', B: 'Bêta', C: 'Gamma', D: 'Delta', E: 'Epsilon', X: 'Xi' })[c] ?? ''
  const pop = (c: string) => ({ A: 10, B: 30, C: 20 })[c as 'A']

  it('demande la capitale parmi quatre, ou compare la population avec le pays d’avant', () => {
    const pool = ['A', 'B', 'C', 'D', 'E', 'X']
    const cap = customsQuestion('C', 'B', pool, () => 'Z', capital, pop, () => 0.1)
    expect(cap).toMatchObject({ kind: 'capitale', answer: 'Gamma' })
    if (cap.kind === 'capitale') expect(cap.options).toContain('Gamma')
    const comp = customsQuestion('C', 'B', pool, () => 'Z', capital, pop, () => 0.9)
    expect(comp).toEqual({ kind: 'population', than: 'B', answer: 'moins' })
  })

  it('se rabat sur la capitale quand la population manque', () => {
    expect(customsQuestion('D', 'C', ['C', 'D', 'E', 'X'], () => 'Z', capital, pop, () => 0.9).kind).toBe('capitale')
  })
})

