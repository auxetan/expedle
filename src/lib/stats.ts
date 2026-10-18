import { useCallback, useEffect, useRef } from 'react'
import { load, save, todayKey } from './util'

export interface Play {
  g: string
  t: number
  // de 0 à 100 selon la performance, quel que soit le jeu
  pts: number
  // score dans l'unité du jeu (essais, rang cumulé, %…)
  s?: number
  ms?: number
  win?: boolean
  sub?: string
}

export function plays(): Play[] {
  return load<Play[]>('history', [])
}

export const PLAYED = 'cg:played'

export function recordPlay(g: string, detail: Omit<Play, 'g' | 't'>): void {
  const pts = Math.round(Math.max(0, Math.min(100, detail.pts)))
  const play = { ...detail, g, t: Date.now(), pts }
  save('history', [...plays(), play].slice(-5000))
  // succès, niveau et synchronisation écoutent les parties terminées
  globalThis.dispatchEvent?.(new CustomEvent<Play>(PLAYED, { detail: play }))
}


// Durée écoulée depuis le début de la partie, relancée quand `reset` change.
export function useStopwatch(reset?: unknown): () => number {
  const began = useRef(0)
  useEffect(() => {
    began.current = Date.now()
  }, [reset])
  return useCallback(() => Date.now() - began.current, [])
}

const dayOf = (t: number) => todayKey(new Date(t))

function shift(day: string, by: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return todayKey(new Date(y, m - 1, d + by))
}

export interface Summary {
  total: number
  points: number
  ms: number
  days: number
  streak: number
  bestStreak: number
  byDay: Map<string, { n: number; pts: number }>
  bestDay: { day: string; n: number } | null
  // lundi en premier
  weekdays: number[]
  hours: number[]
  favorite: string | null
}

export function summarize(list: Play[], now = new Date()): Summary {
  const byDay = new Map<string, { n: number; pts: number }>()
  const weekdays = Array<number>(7).fill(0)
  const hours = Array<number>(24).fill(0)
  const perGame = new Map<string, number>()
  let points = 0
  let ms = 0
  for (const p of list) {
    const day = dayOf(p.t)
    const cell = byDay.get(day) ?? { n: 0, pts: 0 }
    byDay.set(day, { n: cell.n + 1, pts: cell.pts + p.pts })
    const date = new Date(p.t)
    weekdays[(date.getDay() + 6) % 7]++
    hours[date.getHours()]++
    perGame.set(p.g, (perGame.get(p.g) ?? 0) + 1)
    points += p.pts
    ms += p.ms ?? 0
  }

  const sorted = [...byDay.keys()].sort()
  let bestStreak = 0
  let run = 0
  sorted.forEach((day, i) => {
    run = i > 0 && shift(sorted[i - 1], 1) === day ? run + 1 : 1
    bestStreak = Math.max(bestStreak, run)
  })
  let cursor = todayKey(now)
  if (!byDay.has(cursor)) cursor = shift(cursor, -1)
  let streak = 0
  while (byDay.has(cursor)) {
    streak++
    cursor = shift(cursor, -1)
  }

  let bestDay: Summary['bestDay'] = null
  for (const [day, { n }] of byDay) if (!bestDay || n > bestDay.n) bestDay = { day, n }
  let favorite: string | null = null
  for (const [g, n] of perGame) if (!favorite || n > perGame.get(favorite)!) favorite = g

  return { total: list.length, points, ms, days: byDay.size, streak, bestStreak, byDay, bestDay, weekdays, hours, favorite }
}

export function playStats(): { total: number; streak: number } {
  const { total, streak } = summarize(plays())
  return { total, streak }
}

export interface GameRecord {
  g: string
  n: number
  avg: number
  best: number | null
  bestMs: number | null
  ms: number
  wins: number
  last: number
}

export function gameRecords(list: Play[], lowerIsBetter: (g: string) => boolean): GameRecord[] {
  const groups = new Map<string, Play[]>()
  for (const p of list) groups.set(p.g, [...(groups.get(p.g) ?? []), p])
  return [...groups].map(([g, ps]) => {
    const scored = ps.filter((p) => p.s !== undefined && p.win !== false).map((p) => p.s!)
    const timed = ps.filter((p) => p.ms && p.win !== false).map((p) => p.ms!)
    return {
      g,
      n: ps.length,
      avg: Math.round(ps.reduce((a, p) => a + p.pts, 0) / ps.length),
      best: scored.length ? (lowerIsBetter(g) ? Math.min(...scored) : Math.max(...scored)) : null,
      bestMs: timed.length ? Math.min(...timed) : null,
      ms: ps.reduce((a, p) => a + (p.ms ?? 0), 0),
      wins: ps.filter((p) => p.win !== false).length,
      last: Math.max(...ps.map((p) => p.t)),
    }
  })
}

// Colonnes de 7 jours (lundi → dimanche) jusqu'à la semaine en cours ; null après aujourd'hui.
export function calendarWeeks(now = new Date(), count = 53): (string | null)[][] {
  const today = todayKey(now)
  const monday = shift(today, -((now.getDay() + 6) % 7))
  return Array.from({ length: count }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const day = shift(monday, (w - count + 1) * 7 + d)
      return day > today ? null : day
    }),
  )
}

export function dailyResult<T>(gameId: string, day = todayKey()): T | null {
  return load<T | null>(`daily:${gameId}:${day}`, null)
}

export function saveDailyResult(gameId: string, value: unknown, day = todayKey()): void {
  save(`daily:${gameId}:${day}`, value)
}

export function bestScore(key: string): number | null {
  return load<number | null>(`best:${key}`, null)
}

export function submitBest(key: string, score: number, lowerIsBetter = false): boolean {
  const prev = bestScore(key)
  const better = prev === null || (lowerIsBetter ? score < prev : score > prev)
  if (better) save(`best:${key}`, score)
  return better
}
