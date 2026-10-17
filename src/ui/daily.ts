import { plural, t } from '../lib/i18n'
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

// Parties commencées mais pas terminées (Travle, Worldle et Globle gardent la partie en cours).
const IN_PROGRESS: Record<string, () => string> = {
  itineraire: () => `itin:jour:${todayKey()}`,
  'itineraire-usa': () => `itin:usa:${todayKey()}`,
  'itineraire-hebdo': () => `itin:hebdo:${weekKey()}`,
  worldle: () => `worldle:${todayKey()}`,
  globle: () => `globle:${todayKey()}`,
  countryle: () => `countryle:${todayKey()}`,
  flagle: () => `flagle:${todayKey()}`,
  geogrid: () => `geogrid:${todayKey()}`,
}

function resultLabel(id: string, r: AnyResult): string {
  if (r.scores) return `${r.scores.reduce((a, b) => a + b, 0)} / ${r.scores.length * 100}`
  if (id.startsWith('itineraire')) return r.won ? plural(r.guesses!, '{n} essai', '{n} essais') : t('perdu')
  if (id === 'classement-jour') return `${r.total} pts`
  if (id === 'question') return `${r.score} / 100`
  if (id === 'quiz-jour') return `${r.good} / 10`
  if (id === 'worldle') return r.won ? `${r.guesses}/6` : t('perdu')
  if (id === 'globle') return r.won ? plural(r.guesses!, '{n} essai', '{n} essais') : t('abandon')
  if (id === 'countryle') return r.won ? `${r.guesses}/8` : t('perdu')
  if (id === 'flagle') return r.won ? `${r.guesses}/6` : t('perdu')
  if (id === 'geogrid') return `${r.score}/9`
  return t('joué')
}

export function dailyStatus(g: GameEntry): DailyStatus {
  if (!g.dailyId) return { state: 'todo', label: t(g.rhythm) }
  const res = dailyResult<AnyResult>(g.dailyId, g.weekly ? weekKey() : undefined)
  if (res) return { state: 'done', label: resultLabel(g.dailyId, res) }
  const key = IN_PROGRESS[g.dailyId]?.()
  // GeoGrid compte ses essais, les autres jeux gardent la liste des pays proposés
  const guesses = key ? load<{ guesses: string[] | number }>(key, { guesses: 0 }).guesses : 0
  if (Array.isArray(guesses) ? guesses.length : guesses) return { state: 'progress', label: t('en cours') }
  return { state: 'todo', label: t('à jouer') }
}
