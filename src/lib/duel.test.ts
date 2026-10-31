import { describe, expect, it } from 'vitest'
import { loadAtlas } from '../geo/atlas'
import { puzzleFor } from '../games/itineraire/puzzle'
import { beaten, decide, DUEL_GAMES, duelCard, duelGame, duelSeed, pairCode, pairGame, pairOf, progressText, type Waiting } from './duel'

describe('vainqueur', () => {
  it('en course, le premier à réussir gagne, même avec un moins bon score', () => {
    expect(decide('course', { ms: 40_000, pts: 70, win: true }, { ms: 52_000, pts: 100, win: true })).toBe('gagné')
    expect(decide('course', { ms: 30_000, pts: 0, win: false }, { ms: 90_000, pts: 40, win: true })).toBe('perdu')
  })

  it('en course sans gagnant, puis au score : le meilleur score, puis le plus rapide', () => {
    expect(decide('course', { ms: 9_000, pts: 20, win: false }, { ms: 5_000, pts: 10, win: false })).toBe('gagné')
    expect(decide('score', { ms: 60_000, pts: 80 }, { ms: 50_000, pts: 80 })).toBe('perdu')
    expect(decide('score', { ms: 50_000, pts: 80 }, { ms: 50_000, pts: 80 })).toBe('égalité')
  })

  it('celui qui sort de la course perd', () => {
    expect(decide('score', { ms: 9_000, pts: 0, out: 'abandon' }, { ms: 80_000, pts: 5 })).toBe('perdu')
    expect(decide('course', { ms: 80_000, pts: 0, win: false }, { ms: 9_000, pts: 0, win: false, out: 'battu' })).toBe('gagné')
  })

  it('on est battu en course dès qu’on dépasse le temps de l’adversaire qui a réussi', () => {
    const them = { ms: 42_000, pts: 85, win: true }
    expect(beaten('course', them, 41_000)).toBe(false)
    expect(beaten('course', them, 43_000)).toBe(true)
    expect(beaten('score', them, 43_000)).toBe(false)
    expect(beaten('course', { ...them, win: false }, 43_000)).toBe(false)
  })
})

describe('file d’attente', () => {
  const w = (key: string, joined: number, game: string | null = null, user = key): Waiting => ({ key, user, game, joined })

  it('apparie par ordre d’arrivée, le plus ancien en hôte, pareil chez les deux', () => {
    const list = [w('c', 3), w('a', 1), w('b', 2)]
    expect(pairOf(list, 'b')).toEqual([w('a', 1), w('b', 2)])
    expect(pairOf(list, 'a')).toEqual(pairOf(list, 'b'))
    expect(pairOf(list, 'c')).toBeNull()
  })

  it('ne met personne face à lui-même ni face à un autre jeu', () => {
    expect(pairOf([w('a', 1, null, 'moi'), w('b', 2, null, 'moi')], 'a')).toBeNull()
    const list = [w('a', 1, 'flagle'), w('b', 2, 'globle'), w('c', 3, null)]
    expect(pairOf(list, 'c')).toEqual([w('a', 1, 'flagle'), w('c', 3, null)])
  })

  it('donne aux deux le même salon et le même jeu', () => {
    expect(pairCode('a', 'b')).toBe(pairCode('a', 'b'))
    expect(pairCode('a', 'b')).toMatch(/^[A-Z2-9]{5}$/)
    expect(pairGame(w('a', 1), w('b', 2, 'globle'), 'ABCDE')).toBe('globle')
    expect(duelGame(pairGame(w('a', 1), w('b', 2), 'ABCDE'))).toBeDefined()
  })
})

describe('jeux en duel', () => {
  it('ont chacun leur fiche dans la liste des jeux', () => {
    for (const g of DUEL_GAMES) expect(duelCard(g.id)?.icon).toBeTruthy()
  })

  it('tirent un trajet Travle jouable', async () => {
    const seed = await duelSeed(duelGame('itineraire-libre')!)
    const [, start, end] = seed.split('.')
    expect(puzzleFor(await loadAtlas('monde'), start, end)).not.toBeNull()
    expect(await duelSeed(duelGame('flagle')!)).toMatch(/^[a-z0-9]+$/)
  })

  it('disent ce qu’il reste à l’adversaire', () => {
    expect(progressText({ left: 3, unit: 'pays' })).toBe('Plus que 3 pays')
    expect(progressText({ left: 1, unit: 'frontieres' })).toBe('Dernière frontière !')
  })
})
