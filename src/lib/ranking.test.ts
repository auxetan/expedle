import { describe, expect, it } from 'vitest'
import { standing } from './ranking'

const row = (rank: number, pts: number, me = false) => ({ rank, name: `J${rank}`, avatar: '🦊', pts, me })
const byPts = (r: { pts: number }) => r.pts

describe('place au classement', () => {
  it('dit son rang, le joueur juste devant et l’écart à combler', () => {
    const s = standing([row(1, 98), row(2, 95), row(3, 90), row(11, 74), row(12, 70, true)], byPts)!
    expect(s.rank).toBe(12)
    expect(s.ahead).toMatchObject({ rank: 11, gap: 4 })
    expect(s.podium.map((r) => r.rank)).toEqual([1, 2, 3])
  })

  it('ne cherche personne devant le premier', () => {
    expect(standing([row(1, 98, true), row(2, 95)], byPts)!.ahead).toBeNull()
  })

  it('signale une égalité de points, départagée au chrono', () => {
    expect(standing([row(4, 80), row(5, 80, true)], byPts)!.ahead).toMatchObject({ rank: 4, gap: 0 })
  })

  it('ne dit rien quand on n’est pas classé', () => {
    expect(standing([row(1, 98), row(2, 95)], byPts)).toBeNull()
  })
})
