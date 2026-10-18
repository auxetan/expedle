import { describe, expect, it } from 'vitest'
import { getWorld } from '../../geo/world'
import { answersFor, check, COLUMNS, countryFacts, makeGrid, ROWS, score, solvable } from './game'

const world = getWorld()
const facts = countryFacts(world)
const fact = (code: string) => facts.find((f) => f.code === code)!

describe('GeoGrid', () => {
  it('connaît les pays enclavés, insulaires et traversés par l’équateur', () => {
    const test = (id: string, code: string) => ROWS.find((r) => r.id === id)!.test(fact(code))
    expect(test('enclave', 'CH')).toBe(true)
    expect(test('enclave', 'FR')).toBe(false)
    expect(test('ile', 'JP')).toBe(true)
    expect(test('ile', 'IS')).toBe(true)
    expect(test('ile', 'ES')).toBe(false)
    for (const code of ['BR', 'ID', 'EC', 'KE']) expect(test('equateur', code), code).toBe(true)
    // la Guyane et la Réunion n'en font pas un pays de l'équateur
    expect(test('equateur', 'FR')).toBe(false)
    expect(test('ru', 'FI')).toBe(true)
  })

  it('a des réponses pour chaque critère', () => {
    for (const c of [...ROWS, ...COLUMNS]) expect(facts.filter(c.test).length, c.id).toBeGreaterThan(2)
  })

  it('génère chaque jour une grille complète possible, avec au moins deux réponses par case', () => {
    const seen = new Set<string>()
    for (let d = 0; d < 365; d++) {
      const grid = makeGrid(world, `jour-${d}`)
      expect(grid.answers).toHaveLength(9)
      for (const a of grid.answers) expect(a.length).toBeGreaterThanOrEqual(2)
      expect(solvable(grid.answers)).toBe(true)
      seen.add([...grid.rows, ...grid.cols].map((c) => c.id).join(','))
    }
    expect(seen.size).toBeGreaterThan(300)
    expect(makeGrid(world, 'x')).toEqual(makeGrid(world, 'x'))
  })

  it('refuse un pays déjà placé ou qui ne remplit pas les deux critères', () => {
    const europe = ROWS.find((r) => r.id === 'eu')!
    const ue = COLUMNS.find((c) => c.id === 'ue')!
    const grid = { rows: [europe], cols: [ue], answers: [answersFor(facts, europe, ue)] }
    expect(check(grid, [null], 0, 'FR')).toBe('ok')
    expect(check(grid, [null], 0, 'NO')).toBe('wrong')
    expect(check(grid, ['FR'], 0, 'FR')).toBe('used')
  })

  it('sait quand neuf pays différents ne suffisent pas', () => {
    expect(solvable([['A', 'B'], ['A', 'B'], ['C']])).toBe(true)
    expect(solvable([['A', 'B'], ['A', 'B'], ['A', 'B']])).toBe(false)
    expect(score(['FR', null, 'DE', null, null, null, null, null, 'IT'])).toBe(33)
  })
})
