import { beforeEach, describe, expect, it, vi } from 'vitest'
import { evaluate, levelOf } from './achievements'
import { questRewards } from './quests'
import type { Play } from './stats'
import { balanceOf, buy, consume, earnedOf, LEVEL_PEPITES, loadPurchases, loadUses, mergeWallets, owns, playPepites, stockOf, TIER_PEPITES } from './wallet'

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
    expect(earnedOf(list)).toBe(17 + 6 + fromAchievements + LEVEL_PEPITES * (level - 1) + questRewards(list))
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
    expect(loadPurchases()).toMatchObject([{ id: 'avatar:🐉', price: 5 }])
  })
})

describe('jokers', () => {
  const history = [play({ pts: 100, win: true })]

  beforeEach(() => {
    const store = new Map<string, string>([['cg:history', JSON.stringify(history)]])
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) })
  })

  it('s’achètent par lots, autant de fois qu’on veut, chaque lot à son prix', () => {
    expect(buy('joker:essai', 5, 3)).toBe(true)
    expect(buy('joker:essai', 8, 3)).toBe(true)
    expect(stockOf('joker:essai')).toBe(6)
    expect(loadPurchases()).toMatchObject([
      { id: 'joker:essai', price: 5, n: 3 },
      { id: 'joker:essai', price: 8, n: 3 },
    ])
    expect(balanceOf(history, loadPurchases())).toBe(earnedOf(history) - 13)
  })

  it('ne s’achètent pas au-delà du solde', () => {
    expect(buy('joker:vie', earnedOf(history) + 1, 3)).toBe(false)
    expect(stockOf('joker:vie')).toBe(0)
  })

  it('se consomment un par un, jamais au-delà du stock, sans rendre de pépites', () => {
    buy('joker:vie', 5, 2)
    const balance = balanceOf(history, loadPurchases())
    expect(consume('joker:vie')).toBe(true)
    expect(stockOf('joker:vie')).toBe(1)
    expect(consume('joker:vie')).toBe(true)
    expect(consume('joker:vie')).toBe(false)
    expect(stockOf('joker:vie')).toBe(0)
    expect(balanceOf(history, loadPurchases())).toBe(balance)
  })

  it('gardent un stock par sorte de joker', () => {
    buy('joker:essai', 5, 3)
    buy('joker:passe', 5, 3)
    consume('joker:passe')
    expect(stockOf('joker:essai')).toBe(3)
    expect(stockOf('joker:passe')).toBe(2)
    expect(consume('joker:vie')).toBe(false)
  })
})

describe('portefeuille partagé entre appareils', () => {
  it('réunit les achats et les jokers utilisés des deux côtés, sans compter deux fois ce qu’ils ont en commun', () => {
    const phone = {
      purchases: [
        { id: 'avatar:🐉', price: 1000, at: 1 },
        { id: 'joker:essai', price: 60, n: 3, at: 2 },
      ],
      uses: [{ id: 'joker:essai', at: 5 }],
    }
    const laptop = {
      purchases: [
        { id: 'avatar:🐉', price: 1000, at: 1 },
        { id: 'joker:vie', price: 60, n: 3, at: 3 },
      ],
      uses: [
        { id: 'joker:essai', at: 5 },
        { id: 'joker:essai', at: 7 },
      ],
    }
    const merged = mergeWallets(phone, laptop)
    expect(merged.purchases.map((p) => p.id)).toEqual(['avatar:🐉', 'joker:essai', 'joker:vie'])
    expect(merged.uses.map((u) => u.at)).toEqual([5, 7])
    expect(stockOf('joker:essai', merged.purchases, merged.uses)).toBe(1)
  })

  it('date chaque achat et chaque joker utilisé, pour les reconnaître d’un appareil à l’autre', () => {
    const store = new Map<string, string>([['cg:history', JSON.stringify([play({ pts: 100, win: true })])]])
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) })
    buy('joker:vie', 5, 2)
    consume('joker:vie')
    expect(loadPurchases()[0].at).toBeGreaterThan(0)
    expect(loadUses()).toEqual([{ id: 'joker:vie', at: expect.any(Number) }])
  })
})
