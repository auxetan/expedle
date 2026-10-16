import { describe, expect, it } from 'vitest'
import { getWorld } from '../../geo/world'
import { bonusChoices, dailyTarget, evaluate, squares, targets } from './game'

const world = getWorld()

describe('Worldle', () => {
  it('ne tire que des pays souverains présents sur la carte', () => {
    const list = targets(world)
    expect(list.length).toBeGreaterThan(180)
    expect(list).toContain('FR')
    expect(list).not.toContain('GF')
    expect(list).toContain(dailyTarget(world, '2026-10-16'))
    expect(dailyTarget(world, '2026-10-16')).toBe(dailyTarget(world, '2026-10-16'))
  })

  it('note un essai : distance, direction et proximité', () => {
    const g = evaluate(world, 'JP', 'FR')
    expect(g.arrow).toBe('➡️')
    expect(g.km).toBeGreaterThan(9000)
    expect(g.proximity).toBeLessThan(60)
    expect(evaluate(world, 'JP', 'JP')).toMatchObject({ km: 0, arrow: '🎉', proximity: 100 })
  })

  it('traduit la proximité en carrés comme le jeu d’origine', () => {
    expect(squares(100)).toBe('🟩🟩🟩🟩🟩')
    expect(squares(45)).toBe('🟩🟩⬜⬜⬜')
    expect(squares(71)).toBe('🟩🟩🟩🟨⬜')
  })

  it('propose des choix bonus qui contiennent la bonne réponse, sans doublon', () => {
    const { flags, capitals } = bonusChoices('FR', () => 0.42)
    expect(flags).toHaveLength(6)
    expect(flags).toContain('FR')
    expect(new Set(flags).size).toBe(6)
    expect(capitals).toHaveLength(4)
    expect(capitals).toContain('Paris')
    expect(new Set(capitals).size).toBe(4)
  })
})
