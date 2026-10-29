import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ALL_GAMES, GAME_SECTIONS } from '../ui/games'
import type { Play } from './stats'
import { dailyProgram, nextGame, playIds, PROGRAM_SIZE, SIGNATURE, suggest } from './suggest'

const NOW = new Date(2026, 9, 18, 15).getTime()
const game = (href: string) => ALL_GAMES.find((g) => g.href === href)!
const play = (g: string, hoursAgo: number): Play => ({ g, t: NOW - hoursAgo * 3600000, pts: 50 })

describe('suggestions', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) })
  })

  it('retrouve les identifiants d’historique d’un jeu', () => {
    expect(playIds(game('#/worldle'))).toContain('worldle')
    expect(playIds(game('#/quiz/jour'))).toContain('quiz-jour')
  })

  it('propose d’abord les jeux du jour pas encore faits', () => {
    const done = (g: { href: string }) => g.href === '#/worldle'
    const list = suggest(ALL_GAMES, [], done, NOW)
    expect(list[0].game.dailyId).toBeTruthy()
    expect(list.findIndex((s) => s.game.href === '#/worldle')).toBeGreaterThan(list.findIndex((s) => s.game.href === '#/globle'))
  })

  it('évite de reproposer le jeu qu’on vient de finir et met en avant les favoris', () => {
    const history = [...Array.from({ length: 5 }, (_, i) => play('jetpunk', 30 + i)), play('globle', 0.5)]
    const list = suggest(ALL_GAMES, history, () => false, NOW)
    const rank = (href: string) => list.findIndex((s) => s.game.href === href)
    expect(list.find((s) => s.game.href === '#/jetpunk')!.reason).toBe('Un de tes favoris')
    expect(rank('#/globle')).toBeGreaterThan(rank('#/worldle'))
  })

  it('propose l’expédition du jour d’abord, puis les classiques à qui débute, et un programme varié', () => {
    const list = suggest(ALL_GAMES, [], () => false, NOW)
    expect(list[0].game.href).toBe(SIGNATURE)
    expect(list[1].reason).toBe('Parfait pour commencer')
    const program = dailyProgram(ALL_GAMES, [], () => false, NOW)
    const sections = program.map((g) => GAME_SECTIONS.find((s) => s.games.includes(g))!.label)
    for (const label of new Set(sections)) expect(sections.filter((x) => x === label).length).toBeLessThanOrEqual(2)
  })

  it('garde le même programme de cinq jeux toute la journée', () => {
    const first = dailyProgram(ALL_GAMES, [], () => false, NOW)
    expect(first).toHaveLength(PROGRAM_SIZE)
    expect(first.every((g) => g.dailyId && !g.weekly)).toBe(true)
    const later = dailyProgram(ALL_GAMES, [play('worldle', 0)], (g) => g.href === first[0].href, NOW + 3600000)
    expect(later.map((g) => g.href)).toEqual(first.map((g) => g.href))
  })

  it('enchaîne sur le programme du jour, jamais sur le jeu qu’on vient de finir', () => {
    const history = [play('worldle', 0.1)]
    const done = (g: { href: string }) => g.href === '#/worldle'
    const program = dailyProgram(ALL_GAMES, history, done, NOW)
    const next = nextGame(ALL_GAMES, history, done, NOW)!
    expect(next.game.href).not.toBe('#/worldle')
    expect(program).toContain(next.game)
  })

  it('propose encore un jeu quand le programme est terminé', () => {
    const history = [play('worldle', 0.1)]
    const program = dailyProgram(ALL_GAMES, history, () => false, NOW)
    const done = (g: { href: string }) => program.some((p) => p.href === g.href)
    const next = nextGame(ALL_GAMES, history, done, NOW)!
    expect(program).not.toContain(next.game)
    expect(next.game.href).not.toBe('#/worldle')
  })
})
