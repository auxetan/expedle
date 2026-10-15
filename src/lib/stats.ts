import { load, save, todayKey } from './util'

interface PlayLog {
  total: number
  days: string[]
}

export function recordPlay(gameId: string): void {
  const log = load<PlayLog>('plays', { total: 0, days: [] })
  const today = todayKey()
  log.total += 1
  if (!log.days.includes(today)) log.days = [...log.days, today].slice(-400)
  save('plays', log)
  const perGame = load<Record<string, number>>('plays-by-game', {})
  perGame[gameId] = (perGame[gameId] ?? 0) + 1
  save('plays-by-game', perGame)
}

export function playStats(): { total: number; streak: number } {
  const log = load<PlayLog>('plays', { total: 0, days: [] })
  const days = new Set(log.days)
  let streak = 0
  const d = new Date()
  if (!days.has(todayKey(d))) d.setDate(d.getDate() - 1)
  while (days.has(todayKey(d))) {
    streak += 1
    d.setDate(d.getDate() - 1)
  }
  return { total: log.total, streak }
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
