import { beforeEach, describe, expect, it, vi } from 'vitest'
import { evaluate, levelOf } from './achievements'
import type { Play } from './stats'
import { balanceOf, buy, earnedOf, LEVEL_PEPITES, loadPurchases, owns, playPepites, TIER_PEPITES } from './wallet'

const play = (p: Partial<Play> = {}): Play => ({ g: 'worldle', t: new Date('2026-10-20T12:00:00').getTime(), pts: 0, ...p })

describe('pépites', () => {
  // le localStorage de Node demande un fichier : une mémoire suffit ici
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) })
  })

  it('rapportent de 2 à 17 par partie selon le score et la victoire, quel que soit le jeu', () => {
    expect(playPepites(play())).toBe(2)
    expect(playPepites(play({ pts: 54 }))).toBe(7)
    expect(playPepites(play({ g: 'openfront', pts: 100, win: true }))).toBe(17)
  })

  it('s’ajoutent aux récompenses des succès et des niveaux', () => {
    const list = [play({ pts: 100, win: true }), play({ g: 'quiz', pts: 40 })]
    const progress = evaluate(list)
    const fromAchievements = progress.filter((a) => a.unlocked).reduce((s, a) => s + TIER_PEPITES[a.tier], 0)
    expect(fromAchievements).toBeGreaterThan(0)
    const level = levelOf(list, progress).level
    expect(earnedOf(list)).toBe(17 + 6 + fromAchievements + LEVEL_PEPITES * (level - 1))
  })

  it('se dépensent au prix payé, même si la boutique change ses prix ensuite', () => {
    const list = [play({ pts: 100, win: true })]
    expect(balanceOf(list, [{ id: 'avatar:🐉', price: 10 }])).toBe(earnedOf(list) - 10)
  })

  it('n’achètent qu’une fois, et seulement ce qu’on peut payer', () => {
    localStorage.setItem('cg:history', JSON.stringify([play({ pts: 100, win: true })]))
    const balance = balanceOf([play({ pts: 100, win: true })], [])
    expect(buy('avatar:🐉', balance + 1)).toBe(false)
    expect(buy('avatar:🐉', 5)).toBe(true)
    expect(buy('avatar:🐉', 5)).toBe(false)
    expect(owns('avatar:🐉')).toBe(true)
    expect(loadPurchases()).toEqual([{ id: 'avatar:🐉', price: 5 }])
  })
})
