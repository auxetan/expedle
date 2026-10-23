import { describe, expect, it } from 'vitest'
import { landCost, maxTroops, neutralCost, startTroops, terrainOf, tradeGold, trainGold, tradeSpawnOdds, trainSpawnOdds, troopGrowth, unitCost } from './rules'

describe('troupes', () => {
  it('partent de 25 000 pour le joueur, moins pour les tribus', () => {
    expect(startTroops('human', 'moyen')).toBe(25_000)
    expect(startTroops('bot', 'moyen')).toBe(10_000)
    expect(startTroops('nation', 'facile')).toBe(12_500)
  })

  it('plafonnent selon le territoire et les villes', () => {
    expect(maxTroops('human', 'moyen', 50, 0)).toBeCloseTo(2 * (50 ** 0.6 * 1000 + 50_000))
    expect(maxTroops('human', 'moyen', 50, 2)).toBeCloseTo(maxTroops('human', 'moyen', 50, 0) + 500_000)
    expect(maxTroops('bot', 'moyen', 50, 0)).toBeCloseTo(maxTroops('human', 'moyen', 50, 0) / 3)
  })

  it('poussent vite quand l’armée est loin de son plafond, plus du tout au plafond', () => {
    const max = maxTroops('human', 'moyen', 50, 0)
    expect(troopGrowth('human', 'moyen', 25_000, max)).toBeCloseTo((10 + 25_000 ** 0.73 / 4) * (1 - 25_000 / max))
    expect(troopGrowth('human', 'moyen', max, max)).toBe(0)
    expect(troopGrowth('bot', 'moyen', 25_000, max)).toBeCloseTo(troopGrowth('human', 'moyen', 25_000, max) / 2)
  })
})

describe('combat', () => {
  it('lit le relief : plaines, hauts plateaux, montagnes', () => {
    expect(terrainOf(5)).toBe('plaine')
    expect(terrainOf(12)).toBe('plateau')
    expect(terrainOf(25)).toBe('montagne')
  })

  it('prend la terre libre plus vite avec une grosse armée', () => {
    const small = neutralCost('human', 'plaine', 2_000, 20)
    const big = neutralCost('human', 'plaine', 20_000, 20)
    expect(small.loss).toBe(16)
    expect(big.fraction).toBeLessThan(small.fraction)
    expect(neutralCost('bot', 'plaine', 2_000, 20).loss).toBe(8)
  })

  it('coûte plus cher face à un défenseur nombreux, et moins face à un traître', () => {
    const base = { kind: 'nation' as const, tiles: 1000, troops: 50_000, traitor: false, post: false }
    const weak = landCost({ kind: 'human', tiles: 1000 }, 5000, 'plaine', { ...base, troops: 5_000 }, 30)
    const strong = landCost({ kind: 'human', tiles: 1000 }, 5000, 'plaine', base, 30)
    const traitor = landCost({ kind: 'human', tiles: 1000 }, 5000, 'plaine', { ...base, traitor: true }, 30)
    expect(strong.loss).toBeGreaterThan(weak.loss)
    expect(strong.fraction).toBeGreaterThan(weak.fraction)
    expect(traitor.loss).toBeLessThan(strong.loss)
    expect(strong.defenderLoss).toBe(50)
    expect(landCost({ kind: 'human', tiles: 1000 }, 5000, 'plaine', { ...base, post: true }, 30).loss).toBeGreaterThan(strong.loss * 4)
  })
})

describe('bâtiments', () => {
  it('coûtent de plus en plus cher, avec un plafond', () => {
    expect(unitCost('ville', 0)).toBe(125_000)
    expect(unitCost('ville', 1)).toBe(250_000)
    expect(unitCost('ville', 9)).toBe(1_000_000)
    expect(unitCost('poste', 0)).toBe(50_000)
    expect(unitCost('silo', 3)).toBe(1_000_000)
    expect(unitCost('bombe', 0)).toBe(750_000)
  })
})

describe('commerce et trains, aux chiffres d’OpenFront', () => {
  it('un navire marchand rapporte une courbe en S autour de 300 cases, plus 50 par case', () => {
    expect(tradeGold(300)).toBe(52_500)
    expect(tradeGold(1000)).toBe(124_999)
    expect(tradeGold(50)).toBeLessThan(5_000)
  })

  it('un train rapporte 10 000 chez soi, 25 000 chez un autre, 35 000 chez un allié, moins après dix gares', () => {
    expect([trainGold('self', 0), trainGold('other', 3), trainGold('ally', 9)]).toEqual([10_000, 25_000, 35_000])
    expect(trainGold('ally', 12)).toBe(20_000)
    expect(trainGold('self', 30)).toBe(5_000)
  })

  it('un port tente sa chance plus souvent après chaque refus, et un petit port est aidé', () => {
    expect(tradeSpawnOdds(0, 0, 1)).toBe(44)
    expect(tradeSpawnOdds(3, 0, 1)).toBe(11)
    expect(tradeSpawnOdds(0, 0, 8)).toBe(101)
    expect(tradeSpawnOdds(0, 1000, 8)).toBeGreaterThan(300)
  })

  it('une usine lance ses trains moins souvent quand il y en a beaucoup', () => {
    expect(trainSpawnOdds(1, 0)).toBe(112)
    expect(trainSpawnOdds(10, 0)).toBe(306)
    expect(trainSpawnOdds(10, 2000)).toBeGreaterThan(1000)
  })
})
