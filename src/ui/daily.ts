import { dailyResult } from '../lib/stats'
import { load, todayKey, weekKey } from '../lib/util'
import type { GameEntry } from './games'

export interface DailyStatus {
  state: 'todo' | 'progress' | 'done'
  label: string
}

interface AnyResult {
  won?: boolean
  guesses?: number
  scores?: number[]
  total?: number
  score?: number
  good?: number
}

// Parties Travle commencées mais pas terminées (les autres jeux ne gardent pas de partie en cours).
const IN_PROGRESS: Record<string, () => string> = {
  itineraire: () => `itin:jour:${todayKey()}`,
  'itineraire-usa': () => `itin:usa:${todayKey()}`,
  'itineraire-hebdo': () => `itin:hebdo:${weekKey()}`,
}

function resultLabel(id: string, r: AnyResult): string {
  if (r.scores) return `${r.scores.reduce((a, b) => a + b, 0)} / ${r.scores.length * 100}`
  if (id.startsWith('itineraire')) return r.won ? `${r.guesses} essais` : 'perdu'
  if (id === 'classement-jour') return `${r.total} pts`
  if (id === 'question') return `${r.score} / 100`
  if (id === 'quiz-jour') return `${r.good} / 10`
  return 'joué'
}

export function dailyStatus(g: GameEntry): DailyStatus {
  if (!g.dailyId) return { state: 'todo', label: g.rhythm }
  const res = dailyResult<AnyResult>(g.dailyId, g.weekly ? weekKey() : undefined)
  if (res) return { state: 'done', label: resultLabel(g.dailyId, res) }
  const key = IN_PROGRESS[g.dailyId]?.()
  if (key && load<{ guesses: string[] }>(key, { guesses: [] }).guesses.length) return { state: 'progress', label: 'en cours' }
  return { state: 'todo', label: 'à jouer' }
}
