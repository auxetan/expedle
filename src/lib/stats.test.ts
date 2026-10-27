import { describe, expect, it } from 'vitest'
import { calendarWeeks, gameRecords, streakStep, summarize, victoryOf, type Play } from './stats'

const at = (day: string, hour = 12, extra: Partial<Play> = {}): Play => ({
  g: 'quiz-culture',
  t: new Date(`${day}T${String(hour).padStart(2, '0')}:30:00`).getTime(),
  pts: 50,
  ...extra,
})

describe('summarize', () => {
  const now = new Date('2026-10-16T18:00:00')

  it('compte parties, points, temps et jours distincts', () => {
    const s = summarize([at('2026-10-16', 9, { pts: 80, ms: 60000 }), at('2026-10-16', 21, { pts: 20, ms: 30000 }), at('2026-10-10')], now)
    expect(s.total).toBe(3)
    expect(s.points).toBe(150)
    expect(s.ms).toBe(90000)
    expect(s.days).toBe(2)
  })

  it('mesure la série en cours et la meilleure série', () => {
    const days = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-14', '2026-10-15', '2026-10-16']
    const s = summarize(days.map((d) => at(d)), now)
    expect(s.streak).toBe(3)
    expect(s.bestStreak).toBe(4)
  })

  it('garde la série si on n’a pas encore joué aujourd’hui', () => {
    expect(summarize([at('2026-10-14'), at('2026-10-15')], now).streak).toBe(2)
    expect(summarize([at('2026-10-13'), at('2026-10-14')], now).streak).toBe(0)
  })

  it('trouve la meilleure journée, le jour de semaine et l’heure favoris', () => {
    // 2026-10-13 est un mardi
    const s = summarize([at('2026-10-13', 21), at('2026-10-13', 21), at('2026-10-13', 8), at('2026-10-16', 21, { g: 'survie' })], now)
    expect(s.bestDay).toEqual({ day: '2026-10-13', n: 3 })
    expect(s.weekdays[1]).toBe(3)
    expect(s.weekdays[4]).toBe(1)
    expect(s.hours[21]).toBe(3)
    expect(s.favorite).toBe('quiz-culture')
    expect(s.byDay.get('2026-10-13')).toEqual({ n: 3, pts: 150 })
  })
})

describe('gameRecords', () => {
  it('retient le meilleur score selon le sens du jeu et le meilleur temps réussi', () => {
    const list = [
      at('2026-10-10', 12, { g: 'classement-classique', s: 40, ms: 90000, pts: 60 }),
      at('2026-10-11', 12, { g: 'classement-classique', s: 25, ms: 120000, pts: 90 }),
      at('2026-10-12', 12, { g: 'itineraire', s: 6, win: false, ms: 10000, pts: 0 }),
      at('2026-10-13', 12, { g: 'itineraire', s: 8, win: true, ms: 50000, pts: 70 }),
    ]
    const r = gameRecords(list, (g) => g.startsWith('classement') || g.startsWith('itineraire'))
    const gh = r.find((x) => x.g === 'classement-classique')!
    expect(gh).toMatchObject({ n: 2, best: 25, bestMs: 90000, ms: 210000, avg: 75, wins: 2 })
    const tr = r.find((x) => x.g === 'itineraire')!
    expect(tr).toMatchObject({ n: 2, best: 8, bestMs: 50000, wins: 1 })
  })
})

describe('calendarWeeks', () => {
  it('aligne les colonnes sur le lundi et s’arrête à aujourd’hui', () => {
    const weeks = calendarWeeks(new Date('2026-10-16T10:00:00'), 3)
    expect(weeks).toHaveLength(3)
    expect(weeks[0][0]).toBe('2026-09-28')
    expect(weeks[2][4]).toBe('2026-10-16')
    expect(weeks[2][5]).toBeNull()
    expect(weeks[2][6]).toBeNull()
  })
})

describe('victoryOf', () => {
  it('fête toute partie gagnée, et la parfaite plus encore', () => {
    expect(victoryOf(at('2026-10-16', 12, { win: true, pts: 20 }))).toBe('victoire')
    expect(victoryOf(at('2026-10-16', 12, { win: true, pts: 100 }))).toBe('parfait')
    expect(victoryOf(at('2026-10-16', 12, { win: false, pts: 70 }))).toBeNull()
  })

  it('fête un bon score dans les jeux sans victoire', () => {
    expect(victoryOf(at('2026-10-16', 12, { pts: 59 }))).toBeNull()
    expect(victoryOf(at('2026-10-16', 12, { pts: 60 }))).toBe('bravo')
    expect(victoryOf(at('2026-10-16', 12, { pts: 95 }))).toBe('parfait')
  })
})

describe('streakStep', () => {
  it('fait grandir la série avec la première partie du jour', () => {
    const before = [at('2026-10-14'), at('2026-10-15')]
    expect(streakStep(before, at('2026-10-16', 9))).toEqual({ from: 2, to: 3 })
  })

  it('ne dit rien des parties suivantes du même jour', () => {
    expect(streakStep([at('2026-10-15'), at('2026-10-16', 9)], at('2026-10-16', 15))).toBeNull()
  })

  it('repart de 1 après un jour sans partie', () => {
    expect(streakStep([at('2026-10-13'), at('2026-10-14')], at('2026-10-16'))).toEqual({ from: 0, to: 1 })
  })
})
