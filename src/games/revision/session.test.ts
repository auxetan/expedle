import { describe, expect, it } from 'vitest'
import { countryCenter, distanceKm } from '../../geo/measure'
import { getWorld } from '../../geo/world'
import { FACETS, type Card, type Savoir } from '../../lib/savoir'
import { seededRng } from '../../lib/util'
import { askable, buildQuestions, decodeSession, encodeSession, pickItems, SESSION, type Item } from './session'

const world = getWorld()
const NOW = new Date(2026, 9, 29, 10).getTime()
const DAY = 86400000
const card = (box: number, at: number): Card => ({ box, at, ok: [], ko: [] })
const key = (it: Item) => `${it.code} ${it.facet}`

describe('révision du jour', () => {
  it('ne demande que ce qui peut se demander', () => {
    expect(askable(world, { code: 'FR', facet: 'voisins' })).toBe(true)
    expect(askable(world, { code: 'JP', facet: 'voisins' })).toBe(false)
    expect(askable(world, { code: 'JP', facet: 'forme' })).toBe(true)
    expect(askable(world, { code: 'GF', facet: 'forme' })).toBe(false)
  })

  it('prend d’abord les cartes du jour, les plus fragiles en tête et en alternant les angles', () => {
    const book: Savoir = {
      FR: { drapeau: card(1, NOW), forme: card(3, NOW - 10 * DAY) },
      DE: { drapeau: card(1, NOW - DAY) },
      // une île n'a pas de voisins à demander, et une carte pas encore due attend son jour
      JP: { voisins: card(1, NOW), capitale: card(2, NOW) },
      BR: { position: card(2, NOW - 2 * DAY) },
    }
    const items = pickItems(world, book, NOW, seededRng('a'))
    expect(items).toHaveLength(SESSION)
    expect(new Set(items.map(key)).size).toBe(SESSION)
    expect(items.slice(0, 4).map(key).sort()).toEqual(['BR position', 'DE drapeau', 'FR drapeau', 'FR forme'])
    expect(new Set(items.slice(0, 3).map((it) => it.facet)).size).toBe(3)
    expect(items.map(key).indexOf('DE drapeau')).toBeLessThan(items.map(key).indexOf('FR drapeau'))
    // puis des angles encore jamais demandés des pays déjà rencontrés
    for (const it of items.slice(4)) {
      expect(book[it.code]).toBeDefined()
      expect(book[it.code]![it.facet]).toBeUndefined()
      expect(askable(world, it)).toBe(true)
    }
    expect(pickItems(world, {}, NOW, seededRng('a'))).toEqual([])
  })

  it('emporte la séance dans la graine d’un défi', () => {
    const items: Item[] = [
      { code: 'FR', facet: 'drapeau' },
      { code: 'JP', facet: 'forme' },
      { code: 'BR', facet: 'voisins' },
    ]
    const seed = encodeSession(items, 'k3x9')
    expect(seed).toBe('k3x9:FRd.JPf.BRv')
    expect(seed).toMatch(/^[A-Za-z0-9._~:,-]{1,400}$/)
    expect(decodeSession(seed)).toEqual(items)
    expect(decodeSession('k3x9:FRd.xx.ZZq.12f.')).toEqual([{ code: 'FR', facet: 'drapeau' }])
    expect(decodeSession('k3x9')).toEqual([])
  })

  it('pose chaque question avec quatre choix dont la bonne réponse, toujours les mêmes pour une graine', () => {
    const items: Item[] = FACETS.map((facet) => ({ code: 'FR', facet }))
    const questions = buildQuestions(world, items, seededRng('b'))
    for (const q of questions) {
      expect(q.options).toHaveLength(4)
      expect(new Set(q.options).size).toBe(4)
      expect(q.options).toContain(q.answer)
    }
    const [forme, drapeau, capitale, position, voisins] = questions
    expect(forme.answer).toBe('FR')
    expect(drapeau.answer).toBe('FR')
    expect(capitale.answer).toBe('Paris')
    // les leurres de la carte sont des pays proches : il faut reconnaître le bon dans sa région
    for (const code of position.options) expect(distanceKm(countryCenter(world, 'FR'), countryCenter(world, code))).toBeLessThan(1500)
    const next = world.neighbors.get('FR')!
    expect(voisins.options.filter((code) => next.has(code))).toEqual([voisins.answer])
    expect(buildQuestions(world, items, seededRng('b'))).toEqual(questions)
  })
})
