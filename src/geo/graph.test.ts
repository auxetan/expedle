import { describe, expect, it } from 'vitest'
import { buildGraph, filterGraph, guessLimit, isSolved, nextCountries, remaining, scoreGuess, shortestPath, startConnected } from './graph'

const edges = [
  'ES-PT', 'ES-FR', 'FR-DE', 'FR-CH', 'FR-IT', 'DE-AT', 'CH-AT', 'IT-AT', 'DE-CZ', 'DE-PL',
  'CZ-SK', 'PL-SK', 'SK-AT', 'CZ-AT', 'CH-DE', 'IT-CH', 'PL-LT', 'LT-LV', 'LV-EE',
].map((e) => e.split('-') as [string, string])

function toy() {
  const codes = [...new Set(edges.flat())]
  return buildGraph(
    codes.map((c) => ({ country: c })),
    edges.map(([a, b]) => [codes.indexOf(a), codes.indexOf(b)]),
  )
}

describe('itinerary graph', () => {
  const g = toy()

  it('counts the countries still needed', () => {
    expect(remaining(g, 'ES', 'AT', new Set())).toBe(2)
    expect(remaining(g, 'ES', 'AT', new Set(['DE']))).toBe(1)
    expect(remaining(g, 'ES', 'AT', new Set(['FR', 'IT']))).toBe(0)
  })

  it('scores guesses like the reference game', () => {
    expect(scoreGuess(g, 'ES', 'AT', [], 'FR')).toBe('optimal')
    expect(scoreGuess(g, 'ES', 'AT', [], 'DE')).toBe('good')
    expect(scoreGuess(g, 'ES', 'AT', ['DE'], 'IT')).toBe('close')
    expect(scoreGuess(g, 'ES', 'AT', ['DE'], 'SK')).toBe('close')
    expect(scoreGuess(g, 'ES', 'AT', [], 'PT')).toBe('close')
    expect(scoreGuess(g, 'ES', 'AT', [], 'EE')).toBe('far')
  })

  it('detects a solved route', () => {
    expect(isSolved(g, 'ES', 'AT', new Set(['DE']))).toBe(false)
    expect(isSolved(g, 'ES', 'AT', new Set(['DE', 'FR']))).toBe(true)
  })

  it('knows which guesses touch the start', () => {
    expect([...startConnected(g, 'ES', new Set(['DE', 'PL']))].sort()).toEqual([])
    expect([...startConnected(g, 'ES', new Set(['FR', 'DE', 'PL']))].sort()).toEqual(['DE', 'FR', 'PL'])
  })

  it('suggests the next countries on a shortest route', () => {
    expect(nextCountries(g, 'ES', 'AT', new Set())).toEqual(['FR'])
    expect(nextCountries(g, 'ES', 'AT', new Set(['FR'])).sort()).toEqual(['CH', 'DE', 'IT'])
  })

  it('reconstructs one shortest path', () => {
    const p = shortestPath(g, 'ES', 'AT')
    expect(p).toHaveLength(2)
    expect(p[0]).toBe('FR')
  })

  it('gives extra guesses by route length', () => {
    expect(guessLimit(3)).toBe(7)
    expect(guessLimit(6)).toBe(11)
    expect(guessLimit(9)).toBe(15)
    expect(guessLimit(13)).toBe(21)
  })

  it('reroutes around an avoided country', () => {
    const noFrance = filterGraph(g, (c) => c !== 'FR')
    expect(remaining(noFrance, 'ES', 'AT', new Set())).toBe(Infinity)
    const noGermany = filterGraph(g, (c) => c !== 'DE')
    expect(remaining(noGermany, 'FR', 'PL', new Set())).toBe(3)
  })

  it('lets an exclave reach the end but not bridge the mainland', () => {
    // RU has two nodes: mainland (touching LV) and Kaliningrad (touching PL)
    const ex = buildGraph(
      [{ country: 'PL' }, { country: 'RU' }, { country: 'RU' }, { country: 'LV' }, { country: 'LT' }],
      [[0, 1], [2, 3], [4, 1], [4, 3], [0, 4]],
    )
    expect(remaining(ex, 'PL', 'RU', new Set())).toBe(0)
    expect(remaining(ex, 'PL', 'LV', new Set(['RU']))).toBe(1)
  })
})
