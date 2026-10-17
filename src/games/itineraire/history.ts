import { load, save, todayKey } from '../../lib/util'
import type { ProjectionKind } from './RouteMap'
import { msg } from '../../lib/i18n'

export interface ItinSettings {
  hard: boolean
  hideMap: boolean
  projection: ProjectionKind
}

export const DEFAULT_SETTINGS: ItinSettings = { hard: false, hideMap: false, projection: 'azimutale' }

export function loadSettings(): ItinSettings {
  return { ...DEFAULT_SETTINGS, ...load<Partial<ItinSettings>>('itin-settings', {}) }
}

export function saveSettings(s: ItinSettings): void {
  save('itin-settings', s)
}

export interface GameRecord {
  id: string
  kind: 'jour' | 'hebdo' | 'usa' | 'libre'
  date: string
  won: boolean
  guesses: number
  shortest: number
  hints: number
}

export function history(): GameRecord[] {
  return load<GameRecord[]>('itin-history', [])
}

export function addRecord(r: GameRecord): void {
  const list = history().filter((x) => x.id !== r.id)
  save('itin-history', [...list, r].slice(-500))
}

export interface ItinStats {
  played: number
  winRate: number
  streak: number
  maxStreak: number
  distribution: { label: string; count: number }[]
  perfectRate: number
  noHintRate: number
  hints: number
  last10: number
}

function dayBefore(key: string): string {
  const d = new Date(key + 'T12:00:00')
  d.setDate(d.getDate() - 1)
  return todayKey(d)
}

export function computeStats(list = history()): ItinStats {
  const played = list.length
  const won = list.filter((r) => r.won)
  const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0)
  const wonDays = new Set(list.filter((r) => r.kind === 'jour' && r.won).map((r) => r.date))
  let streak = 0
  let day = todayKey()
  if (!wonDays.has(day)) day = dayBefore(day)
  while (wonDays.has(day)) {
    streak++
    day = dayBefore(day)
  }
  let maxStreak = 0
  let run = 0
  const days = [...wonDays].sort()
  days.forEach((d, i) => {
    run = i > 0 && dayBefore(d) === days[i - 1] ? run + 1 : 1
    maxStreak = Math.max(maxStreak, run)
  })
  const buckets = [msg('Parfait'), '+1', '+2', '+3', '+4', msg('+5 et plus'), msg('Perdu')]
  const distribution = buckets.map((label) => ({ label, count: 0 }))
  for (const r of list) {
    const extra = r.guesses - r.shortest
    const i = !r.won ? 6 : Math.min(5, Math.max(0, extra))
    distribution[i].count++
  }
  const last = list.slice(-10)
  return {
    played,
    winRate: pct(won.length, played),
    streak,
    maxStreak,
    distribution,
    perfectRate: pct(won.filter((r) => r.guesses === r.shortest).length, played),
    noHintRate: pct(won.filter((r) => r.hints === 0).length, played),
    hints: list.reduce((s, r) => s + r.hints, 0),
    last10: pct(last.filter((r) => r.won).length, last.length),
  }
}
