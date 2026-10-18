import { describe, expect, it } from 'vitest'
import { fromRow, fromStampRows, mergePlays, toRow, toStampRows } from './cloud'
import type { Play } from './stats'

const play = (g: string, t: number, extra: Partial<Play> = {}): Play => ({ g, t, pts: 50, ...extra })

describe('synchronisation de l’historique', () => {
  it('fait l’aller-retour entre une partie et une ligne de la base sans rien perdre', () => {
    const full = play('worldle', new Date('2026-10-17T09:30:00').getTime(), { s: 3, ms: 41234.6, win: true, sub: 'libre' })
    const row = toRow(full)
    expect(row).toMatchObject({ game: 'worldle', day: '2026-10-17', pts: 50, score: 3, ms: 41235, win: true, sub: 'libre' })
    expect(fromRow(row)).toEqual({ ...full, ms: 41235 })
    const bare = play('survie', 1_000_000)
    expect(fromRow(toRow(bare))).toEqual(bare)
  })

  it('ajoute les parties jouées ailleurs, dans l’ordre et sans doublon', () => {
    const local = [play('a', 1), play('b', 5)]
    const merged = mergePlays(local, [play('b', 5), play('c', 3), play('a', 9)])
    expect(merged.map((p) => `${p.g}${p.t}`)).toEqual(['a1', 'c3', 'b5', 'a9'])
  })

  it('rend l’historique tel quel quand rien n’est nouveau', () => {
    const local = [play('a', 1)]
    expect(mergePlays(local, [play('a', 1)])).toBe(local)
  })
})

describe('passeport du compte', () => {
  it('fait l’aller-retour entre l’appareil et les lignes de la base', () => {
    const book = { JP: { n: 3, first: Date.UTC(2026, 9, 1), last: Date.UTC(2026, 9, 18), games: ['worldle', 'globle'] } }
    const rows = toStampRows(book)
    expect(rows).toEqual([{ code: 'JP', n: 3, first_at: '2026-10-01T00:00:00.000Z', last_at: '2026-10-18T00:00:00.000Z', games: ['worldle', 'globle'] }])
    expect(fromStampRows(rows)).toEqual(book)
  })
})
