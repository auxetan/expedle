import { describe, expect, it } from 'vitest'
import { ALL_GAMES } from '../ui/games'
import { ACHIEVEMENTS, evaluate, levelOf, TIER_XP } from './achievements'
import type { Play } from './stats'

const at = (g: string, day: string, hour = 12, extra: Partial<Play> = {}): Play => ({
  g,
  t: new Date(`${day}T${String(hour).padStart(2, '0')}:30:00`).getTime(),
  pts: 50,
  ...extra,
})
const now = new Date('2026-10-17T18:00:00')
const get = (plays: Play[], id: string) => evaluate(plays, now).find((a) => a.id === id)!

describe('succès', () => {
  it('ont des identifiants uniques et des buts atteignables', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length)
    for (const a of ACHIEVEMENTS) expect(a.goal, a.id).toBeGreaterThan(0)
  })

  it('se débloquent rétroactivement à partir de l’historique', () => {
    const plays = [at('worldle', '2026-10-15', 12, { win: true, s: 1 }), at('itineraire', '2026-10-16', 12, { win: true, pts: 100 })]
    expect(get(plays, 'premiers-pas').unlocked).toBe(true)
    expect(get(plays, 'worldle-1').unlocked).toBe(true)
    expect(get(plays, 'travle-parfait').unlocked).toBe(true)
    expect(get(plays, 'worldle-10')).toMatchObject({ unlocked: false, current: 1, goal: 10 })
  })

  it('ne compte pas une défaite comme une victoire', () => {
    expect(get([at('globle', '2026-10-16', 12, { win: false, s: 3 })], 'globle-5').unlocked).toBe(false)
    expect(get([at('globle', '2026-10-16', 12, { win: true, s: 5 })], 'globle-5').unlocked).toBe(true)
  })

  it('suit la meilleure série et l’heure de jeu', () => {
    const days = ['2026-10-10', '2026-10-11', '2026-10-12']
    const plays = days.map((d, i) => at('quiz-culture', d, [2, 6, 12][i]))
    expect(get(plays, 'serie-3').unlocked).toBe(true)
    expect(get(plays, 'noctambule').unlocked).toBe(true)
    expect(get(plays, 'leve-tot').unlocked).toBe(true)
  })

  it('demande tous les jeux du jour le même jour pour le grand chelem', () => {
    const dailies = ALL_GAMES.filter((g) => g.rhythm === 'quotidien').map((g) => g.dailyId!)
    const sameDay = dailies.map((g) => at(g, '2026-10-16'))
    expect(get(sameDay, 'grand-chelem').unlocked).toBe(true)
    const spread = dailies.map((g, i) => at(g, i % 2 ? '2026-10-16' : '2026-10-15'))
    expect(get(spread, 'grand-chelem').unlocked).toBe(false)
    const practice = sameDay.map((p) => (p.g === 'question' ? { ...p, sub: 'entrainement' } : p))
    expect(get(practice, 'grand-chelem').current).toBe(dailies.length - 1)
  })

  it('compte les quiz différents, pas les parties', () => {
    const plays = Array.from({ length: 30 }, (_, i) => at('jetpunk', '2026-10-16', 12, { sub: `quiz-${i % 5}` }))
    expect(get(plays, 'jetpunk-25').current).toBe(5)
  })
})

describe('niveaux', () => {
  it('commencent au niveau 1 et demandent 100 XP de plus à chaque niveau', () => {
    expect(levelOf([], evaluate([], now))).toMatchObject({ xp: 0, level: 1, into: 0, need: 200, title: 'Touriste' })
    const plays = Array.from({ length: 5 }, (_, i) => at('survie', '2026-10-16', 12, { pts: 100, s: i }))
    const progress = evaluate(plays, now)
    const bonus = progress.filter((a) => a.unlocked).reduce((s, a) => s + TIER_XP[a.tier], 0)
    const level = levelOf(plays, progress)
    expect(level.xp).toBe(500 + bonus)
    expect(level.level).toBe(3)
    expect(level.into).toBe(500 + bonus - 500)
  })
})
