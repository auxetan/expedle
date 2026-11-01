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
  tries?: number
  placed?: number
  // l'Expédition : erreurs aux douanes
  mistakes?: number
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
  statele: () => `statele:${todayKey()}`,
  dailygeo: () => `dailygeo:${todayKey()}`,
  expedition: () => `expedition:v2:${todayKey()}`,
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
  if (id === 'statele') return r.won ? `${r.guesses}/6` : t('perdu')
  if (id === 'dailygeo') return `${r.score}/100`
  if (id === 'expedition') return r.won ? '★'.repeat(3 - (r.mistakes ?? 0)) : t('interrompu')
  if (id === 'factle') return r.won ? `${r.tries}/5` : t('perdu')
  if (id === 'wikitrivia') return `${r.placed}/15`
  if (id === 'tightrope') return `${r.good}/9`
  if (id.endsWith('guessr-jour')) return t('{n} pts', { n: r.total ?? 0 })
  return t('joué')
}

export function dailyStatus(g: GameEntry): DailyStatus {
  if (!g.dailyId) return { state: 'todo', label: t(g.rhythm) }
  const res = dailyResult<AnyResult>(g.dailyId, g.weekly ? weekKey() : undefined)
  if (res) return { state: 'done', label: resultLabel(g.dailyId, res) }
  const key = IN_PROGRESS[g.dailyId]?.()
  // GeoGrid compte ses essais, l'Expédition garde ses réponses, les autres jeux la liste des pays proposés
  const saved = key ? load<{ guesses?: string[] | number; picks?: string[] }>(key, {}) : {}
  const moves = Array.isArray(saved.guesses) ? saved.guesses.length : (saved.guesses ?? saved.picks?.length ?? 0)
  if (moves) return { state: 'progress', label: t('en cours') }
  return { state: 'todo', label: t('à jouer') }
}
