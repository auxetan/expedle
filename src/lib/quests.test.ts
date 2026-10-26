import { describe, expect, it } from 'vitest'
import { closestQuest, progressOf, questRewards, questsOf } from './quests'
import type { Play } from './stats'

const at = (g: string, day: string, extra: Partial<Play> = {}): Play => ({ g, t: new Date(`${day}T12:00:00`).getTime(), pts: 50, ...extra })

describe('quêtes du jour', () => {
  it('tirent trois quêtes différentes, les mêmes pour tout le monde le même jour', () => {
    const today = questsOf('2026-10-24')
    expect(today).toHaveLength(3)
    expect(new Set(today.map((q) => q.id)).size).toBe(3)
    expect(questsOf('2026-10-24').map((q) => [q.id, q.params, q.reward])).toEqual(today.map((q) => [q.id, q.params, q.reward]))
    // d'un jour à l'autre, le tirage change
    const week = ['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28'].map((d) => questsOf(d).map((q) => q.id).join())
    expect(new Set(week).size).toBeGreaterThan(1)
  })

  it('avancent avec les parties du jour seulement, sans dépasser leur but', () => {
    const day = '2026-10-24'
    const quest = questsOf(day)[0]
    const plays = Array.from({ length: 12 }, () => at('worldle', day, { win: true, pts: 100 }))
    expect(progressOf(quest, [])).toBe(0)
    expect(progressOf(quest, plays)).toBeLessThanOrEqual(quest.goal)
  })

  it('payent chaque quête réussie une seule fois, jour par jour, depuis l’historique', () => {
    // une avalanche de parties gagnées dans tous les jeux du jour réussit toutes les quêtes de la journée
    const ids = ['itineraire', 'worldle', 'statele', 'globle', 'countryle', 'flagle', 'geogrid', 'dailygeo', 'echelle-objets', 'balance', 'question', 'quiz-jour', 'factle', 'wikitrivia', 'tightrope', 'classement-jour', 'echelle-pop', 'echelle-geo', 'itineraire-usa', 'geoguessr-jour', 'photoguessr-jour']
    const day = '2026-10-24'
    const plays = ids.flatMap((g) => [at(g, day, { win: true, pts: 100 }), at(g, day, { win: true, pts: 100 })])
    const all = questsOf(day).reduce((s, q) => s + q.reward, 0)
    expect(questRewards(plays)).toBe(all)
    // les mêmes parties un autre jour paient les quêtes de cet autre jour
    const other = '2026-10-25'
    const twoDays = [...plays, ...plays.map((p) => ({ ...p, t: p.t + 86_400_000 }))]
    expect(questRewards(twoDays)).toBe(all + questsOf(other).reduce((s, q) => s + q.reward, 0))
    expect(questRewards([])).toBe(0)
  })
})

describe('quête la plus proche', () => {
  it('montre la quête du jour la plus avancée qui n’est pas encore remplie', () => {
    const day = '2026-10-24'
    const quests = questsOf(day)
    const game = quests.find((q) => q.id.startsWith('jeu:'))!
    const plays = [at(game.id.slice(4), day)]
    const closest = closestQuest(plays, day)!
    expect(closest.quest.id).not.toBe(game.id)
    expect(closest.done).toBe(progressOf(closest.quest, plays))
    expect(closest.done).toBeLessThan(closest.quest.goal)
  })

  it('ne montre rien quand toutes les quêtes sont remplies', () => {
    const day = '2026-10-24'
    const plays = questsOf(day).flatMap((q) => (q.id.startsWith('jeu:') ? [at(q.id.slice(4), day)] : []))
    const all = [...plays, ...Array.from({ length: 12 }, (_, i) => at(['worldle', 'quiz-jour', 'question', 'itineraire', 'classement-jour', 'globle'][i % 6], day, { pts: 90, win: true }))]
    expect(questsOf(day).every((q) => progressOf(q, all) >= q.goal)).toBe(true)
    expect(closestQuest(all, day)).toBeNull()
  })
})
