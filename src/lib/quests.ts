// Les quêtes du jour : trois petits objectifs, les mêmes pour tout le monde, qui paient des pépites une fois remplis.
// Comme le reste du portefeuille, elles se recalculent depuis l'historique : chaque jour passé a ses quêtes,
// et ses parties disent si elles ont été remplies.
import { ALL_GAMES, GAME_SECTIONS } from '../ui/games'
import { msg } from './i18n'
import type { Play } from './stats'
import { seededRng, shuffle, todayKey } from './util'

export interface Quest {
  id: string
  // le texte, marqué pour la traduction, avec ses paramètres
  text: string
  params: Record<string, string | number>
  goal: number
  reward: number
  count: (plays: Play[]) => number
}

// les jeux du jour tels qu'ils s'inscrivent dans l'historique ; entraînements, défis et archives n'en sont pas
const DAILIES = ALL_GAMES.filter((g) => g.rhythm === 'quotidien' && g.dailyId)
const official = (p: Play) => !p.sub

const sectionOf = new Map(GAME_SECTIONS.flatMap((s) => s.games.filter((g) => g.dailyId).map((g) => [g.dailyId!, s.label] as const)))

const FIXED: Omit<Quest, 'params'>[] = [
  { id: 'parties', text: msg('Joue {n} parties'), goal: 3, reward: 30, count: (ps) => ps.length },
  { id: 'victoires', text: msg('Gagne {n} parties'), goal: 2, reward: 40, count: (ps) => ps.filter((p) => p.win).length },
  { id: 'jour', text: msg('Termine {n} jeux du jour'), goal: 3, reward: 50, count: (ps) => new Set(ps.filter((p) => official(p) && sectionOf.has(p.g)).map((p) => p.g)).size },
  { id: 'score', text: msg('Marque au moins 80 points dans une partie'), goal: 1, reward: 35, count: (ps) => ps.filter((p) => p.pts >= 80).length },
  { id: 'rubriques', text: msg('Joue dans les {n} rubriques'), goal: 3, reward: 50, count: (ps) => new Set(ps.map((p) => sectionOf.get(p.g)).filter(Boolean)).size },
]

// Les trois quêtes d'un jour : deux objectifs généraux et un jeu du jour à découvrir.
export function questsOf(day: string): Quest[] {
  const rng = seededRng(`quetes:${day}`)
  const general = shuffle(FIXED, rng).slice(0, 2)
  const game = DAILIES[Math.floor(rng() * DAILIES.length)]
  return [
    ...general.map((q) => ({ ...q, params: { n: q.goal } })),
    { id: `jeu:${game.dailyId}`, text: msg('Joue à {game}'), params: { game: game.title }, goal: 1, reward: 25, count: (ps: Play[]) => ps.filter((p) => p.g === game.dailyId).length },
  ]
}

export const progressOf = (q: Quest, plays: Play[]) => Math.min(q.goal, q.count(plays))

// Les pépites de toutes les quêtes remplies, jour après jour.
export function questRewards(list: Play[]): number {
  const days = new Map<string, Play[]>()
  for (const p of list) {
    const day = todayKey(new Date(p.t))
    days.set(day, [...(days.get(day) ?? []), p])
  }
  let total = 0
  for (const [day, plays] of days) for (const q of questsOf(day)) if (progressOf(q, plays) >= q.goal) total += q.reward
  return total
}

// La quête du jour la plus proche d'être remplie, à montrer au moment de rejouer.
export function closestQuest(list: Play[], day = todayKey()): { quest: Quest; done: number } | null {
  const today = list.filter((p) => todayKey(new Date(p.t)) === day)
  const open = questsOf(day)
    .map((quest) => ({ quest, done: progressOf(quest, today) }))
    .filter((q) => q.done < q.quest.goal)
  return open.sort((a, b) => b.done / b.quest.goal - a.done / a.quest.goal)[0] ?? null
}
