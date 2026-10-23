import { describe, expect, it } from 'vitest'
import { joinable, pickPublicTeams, PUBLIC_MAX, ranked, type Listing } from './net'

const listing = (code: string, players: number, startsAt: number): Listing => ({ code, players, startsAt, map: 'world', teams: 0 })

describe('parties publiques', () => {
  it('rejoignent celle qui part le plus tôt, s’il y reste de la place et du temps', () => {
    const now = 100_000
    const list = [listing('LATER', 2, now + 50_000), listing('FULL', PUBLIC_MAX, now + 10_000), listing('GONE', 1, now + 1_000), listing('NEXT', 3, now + 30_000)]
    expect(joinable(list, now)?.code).toBe('NEXT')
  })

  it('ne proposent jamais la sienne, et rien quand aucune n’attend', () => {
    const now = 0
    expect(joinable([listing('MINE', 1, 40_000)], now, 'MINE')).toBeUndefined()
    expect(joinable([], now)).toBeUndefined()
  })

  it('se départagent par le départ, puis par le code, pour que deux hôtes seuls se retrouvent dans la même', () => {
    const a = listing('AAAAA', 1, 60_000)
    const b = listing('BBBBB', 1, 60_000)
    expect(ranked(a, b)).toBeLessThan(0)
    expect(ranked(b, a)).toBeGreaterThan(0)
    expect(ranked(listing('ZZZZZ', 1, 50_000), a)).toBeLessThan(0)
  })

  it('se jouent une fois sur trois par équipes, de deux à quatre', () => {
    const rolls = (...values: number[]) => () => values.shift()!
    expect(pickPublicTeams(rolls(0.5))).toBe(0)
    expect(pickPublicTeams(rolls(0.1, 0))).toBe(2)
    expect(pickPublicTeams(rolls(0.1, 0.99))).toBe(4)
  })
})
