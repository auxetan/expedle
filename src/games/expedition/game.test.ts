import { describe, expect, it } from 'vitest'
import { worldAtlas } from '../../geo/atlas'
import { answer, CHANCES, choices, dailyTrip, hops, left, nextCountry, remark, route, score, shareText, stars, startRun, status, tourTrip, type Trip } from './game'

// une ligne A-B-C-D-E, et un détour B-X-D
const LINE = new Map<string, Set<string>>([
  ['A', new Set(['B'])],
  ['B', new Set(['A', 'C', 'X'])],
  ['C', new Set(['B', 'D'])],
  ['D', new Set(['C', 'E', 'X'])],
  ['E', new Set(['D'])],
  ['X', new Set(['B', 'D'])],
])
const trip: Trip = { start: 'A', end: 'E', route: ['A', 'B', 'C', 'D', 'E'] }

describe('chemins', () => {
  it('compte les frontières et tire un plus court chemin, le même pour une même graine', () => {
    expect(hops(LINE, 'A').get('E')).toBe(4)
    expect(route(LINE, 'A', 'E', () => 0)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(route(LINE, 'A', 'E', () => 0.99)).toEqual(['A', 'B', 'X', 'D', 'E'])
  })
})

describe('voyage du jour', () => {
  const atlas = worldAtlas()

  it('est le même pour tout le monde le même jour, et change le lendemain', () => {
    const a = dailyTrip(atlas.neighbors, atlas.playable, atlas.region, '2026-11-02')
    expect(dailyTrip(atlas.neighbors, atlas.playable, atlas.region, '2026-11-02')).toEqual(a)
    expect(dailyTrip(atlas.neighbors, atlas.playable, atlas.region, '2026-11-03')).not.toEqual(a)
  })

  it('relie deux régions en 5 à 7 frontières, de voisin en voisin', () => {
    for (const day of ['2026-11-02', '2026-11-09', '2026-12-25', '2027-03-14', '2027-07-01']) {
      const t = dailyTrip(atlas.neighbors, atlas.playable, atlas.region, day)
      expect(atlas.region(t.start)).not.toBe(atlas.region(t.end))
      expect(t.route.length - 1).toBeGreaterThanOrEqual(5)
      expect(t.route.length - 1).toBeLessThanOrEqual(7)
      expect(t.route[0]).toBe(t.start)
      expect(t.route.at(-1)).toBe(t.end)
      t.route.slice(1).forEach((c, i) => expect(atlas.neighbors.get(t.route[i])?.has(c)).toBe(true))
    }
  })
})

describe('en route', () => {
  it('passe chaque frontière, même après une erreur, et arrive', () => {
    let run = startRun(trip)
    run = answer(run, 'B', 'B')
    run = answer(run, 'C', 'X')
    expect(run.path).toEqual(['A', 'B', 'C'])
    expect(run.mistakes).toBe(1)
    expect(left(trip, run)).toBe(2)
    run = answer(answer(run, 'D', 'D'), 'E', 'E')
    expect(status(trip, run)).toBe('arrivé')
  })

  it('s’arrête à la troisième erreur, là où l’on est', () => {
    let run = startRun(trip)
    for (const [next, pick] of [
      ['B', 'X'],
      ['C', 'X'],
      ['D', 'X'],
    ])
      run = answer(run, next, pick)
    expect(run.mistakes).toBe(CHANCES)
    expect(run.path).toEqual(['A', 'B', 'C'])
    expect(status(trip, run)).toBe('interrompu')
  })
})

describe('fin de voyage', () => {
  it('note l’arrivée selon les erreurs, et un voyage interrompu selon le chemin fait', () => {
    let run = startRun(trip)
    for (const c of ['B', 'C', 'D', 'E']) run = answer(run, c, c)
    expect([score(trip, run), stars(trip, run)]).toEqual([100, 3])
    let slip = startRun(trip)
    for (const [n, p] of [
      ['B', 'B'],
      ['C', 'X'],
      ['D', 'D'],
      ['E', 'E'],
    ])
      slip = answer(slip, n, p)
    expect([score(trip, slip), stars(trip, slip)]).toEqual([80, 2])
    const stuck = { path: ['A', 'B', 'C'], picks: [], mistakes: 3 }
    expect([score(trip, stuck), stars(trip, stuck)]).toEqual([20, 0])
  })

  it('se partage en drapeaux et en étoiles', () => {
    const t: Trip = { start: 'PT', end: 'FR', route: ['PT', 'ES', 'FR'] }
    let run = startRun(t)
    run = answer(run, 'ES', 'ES')
    run = answer(run, 'FR', 'IT')
    const text = shareText(t, run, '2026-11-02', (c) => ({ PT: 'Portugal', FR: 'France' })[c] ?? c)
    expect(text).toContain('Portugal → France')
    expect(text).toContain('🇵🇹🇪🇸🇫🇷 🏁')
    expect(text).toContain('★★☆')
    expect(text).toContain('expedle.com')
  })
})

describe('douane', () => {
  it('propose le bon pays parmi quatre, avec d’autres voisins pour brouiller', () => {
    const options = choices(LINE, () => 'Z', ['A', 'B', 'C', 'D', 'E', 'X'], 'B', 'C', () => 0.42)
    expect(options).toHaveLength(4)
    expect(options).toContain('C')
    expect(new Set(options).size).toBe(4)
    expect(options).toEqual(expect.arrayContaining(['A', 'X']))
  })
})

describe('Tour du monde', () => {
  it('va de voisin en voisin sans repasser par un pays déjà vu, tant qu’il en reste', () => {
    const tour = tourTrip('B')
    let run = startRun(tour)
    const next = nextCountry(LINE, tour, run, 's')!
    expect(['A', 'C', 'X']).toContain(next)
    run = answer(run, next, next)
    expect(nextCountry(LINE, tour, run, 's')).not.toBe('B')
    expect(status(tour, run)).toBe('en route')
  })
})

describe('Pépite en route', () => {
  it('compte les dernières frontières et prévient à la dernière chance', () => {
    let run = answer(startRun(trip), 'B', 'B')
    expect(remark(trip, run, null)).toBe('Plus que 3 frontières')
    run = answer(answer(run, 'C', 'C'), 'D', 'D')
    expect(remark(trip, run, null)).toBe('Dernière frontière !')
    const shaky = { path: ['A', 'B'], picks: ['X', 'X'], mistakes: 2 }
    expect(remark(trip, shaky, null)).toBe('Plus qu’une chance !')
  })

  it('pousse vers le record du Tour du monde', () => {
    const tour = tourTrip('A')
    expect(remark(tour, startRun(tour), 2)).toBe('Encore 3 tampons pour battre ton record')
    expect(remark(tour, { path: ['A', 'B', 'C', 'D'], picks: [], mistakes: 0 }, 2)).toBe('Nouveau record !')
  })
})
