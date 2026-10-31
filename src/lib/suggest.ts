import { GAMES } from '../ui/gameInfo'
import { GAME_SECTIONS, type GameEntry } from '../ui/games'
import { msg } from './i18n'
import { due } from './savoir'
import type { Play } from './stats'
import { hashString, load, save, todayKey } from './util'

// La révision du jour n'a pas sa place parmi les jeux de l'accueil : elle n'est proposée, comme un jeu du jour, que
// tant que des réponses attendent d'être revues.
export const REVISION: GameEntry = {
  href: '#/revision',
  title: msg('Révision du jour'),
  tagline: msg('Tes points faibles, revus au bon moment'),
  rhythm: 'quotidien',
  dailyId: 'revision',
  icon: 'revision',
}

// Les jeux arrivés récemment, mis en avant tant qu'on ne les a pas essayés.
// le jeu signature d'Expedle, proposé en premier chaque jour tant qu'il n'est pas fait
export const SIGNATURE = '#/expedition'

export const NEW_GAMES = new Set(['#/expedition', '#/openfront', '#/statele', '#/dailygeo', '#/factle', '#/wikitrivia', '#/tightrope', '#/geoguessr/jour', '#/photoguessr/jour'])

// Pour qui débute : les classiques, simples et rapides, avant les nouveautés.
const STARTERS = new Set(['#/worldle', '#/itineraire', '#/quiz/jour', '#/flagle', '#/echelle', '#/globle', '#/question'])
const BEGINNER = 10

export interface Suggestion {
  game: GameEntry
  // la raison montrée au joueur, à traduire avec t()
  reason: string
  score: number
}

const HOUR = 3600000
const sectionOf = new Map(GAME_SECTIONS.flatMap((s) => s.games.map((g) => [g.href, s.label] as const)))

// Les identifiants d'historique d'un jeu de l'accueil : celui de sa partie du jour et ceux qui partagent son adresse.
export function playIds(g: GameEntry): string[] {
  const ids = Object.entries(GAMES)
    .filter(([, info]) => info.href === g.href)
    .map(([id]) => id)
  return g.dailyId && !ids.includes(g.dailyId) ? [...ids, g.dailyId] : ids
}

// Ce qu'il y a de mieux à jouer maintenant : d'abord les jeux du jour pas encore faits, puis les favoris et les
// nouveautés, en évitant de reproposer le jeu qu'on vient de finir. Un léger hasard, fixe pour la journée, varie l'ordre.
export function suggest(games: GameEntry[], history: Play[], done: (g: GameEntry) => boolean, now = Date.now()): Suggestion[] {
  const day = todayKey(new Date(now))
  const recent = history.filter((p) => p.t > now - 30 * 24 * HOUR)
  const counts = new Map<string, number>()
  for (const p of recent) counts.set(p.g, (counts.get(p.g) ?? 0) + 1)
  const favorites = new Set(
    games
      .map((g) => [g.href, playIds(g).reduce((n, id) => n + (counts.get(id) ?? 0), 0)] as const)
      .filter(([, n]) => n >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([href]) => href),
  )
  const beginner = history.length < BEGINNER
  const last = history.at(-1)
  const lastGame = last ? games.find((g) => playIds(g).includes(last.g)) : undefined

  return games
    .map((g) => {
      const ids = playIds(g)
      const played = history.some((p) => ids.includes(p.g))
      const reasons: [number, string][] = []
      if (g.href === SIGNATURE && !done(g)) reasons.push([90, msg('L’expédition du jour t’attend')])
      if (g.dailyId && !done(g)) reasons.push(g.weekly ? [40, msg('Le défi de la semaine t’attend')] : [60, msg('Pas encore joué aujourd’hui')])
      if (beginner) {
        if (STARTERS.has(g.href)) reasons.push([25, msg('Parfait pour commencer')])
      } else if (!played) reasons.push(NEW_GAMES.has(g.href) ? [30, msg('Nouveau sur Expedle')] : [15, msg('Tu ne l’as jamais essayé')])
      if (favorites.has(g.href)) reasons.push([20, msg('Un de tes favoris')])
      let score = reasons.reduce((s, [w]) => s + w, 0)
      if (g.dailyId && done(g)) score -= 100
      if (!g.dailyId && !favorites.has(g.href)) score -= 10
      if (history.some((p) => ids.includes(p.g) && p.t > now - 2 * HOUR)) score -= 30
      if (lastGame && lastGame.href !== g.href && sectionOf.get(lastGame.href) === sectionOf.get(g.href)) score -= 8
      score += (hashString(day + g.href) % 100) / 12
      // à qui débute, on dit d'abord pourquoi commencer par là
      const reason = beginner && STARTERS.has(g.href) ? msg('Parfait pour commencer') : (reasons.sort((a, b) => b[0] - a[0])[0]?.[1] ?? msg('Pour varier les plaisirs'))
      return { game: g, reason, score }
    })
    .concat(due(now).length ? [revision(history, done, now, day)] : [])
    .sort((a, b) => b.score - a.score)
}

// Des réponses attendent : la révision passe devant un jeu du jour ordinaire, après l'expédition du jour, les favoris
// et les nouveautés.
function revision(history: Play[], done: (g: GameEntry) => boolean, now: number, day: string): Suggestion {
  let score = done(REVISION) ? -100 : 75
  if (history.some((p) => p.g === REVISION.dailyId && p.t > now - 2 * HOUR)) score -= 30
  return { game: REVISION, reason: msg('Tes points faibles t’attendent'), score: score + (hashString(day + REVISION.href) % 100) / 12 }
}

// Le programme du jour : cinq jeux du jour choisis à la première visite et gardés toute la journée, pour qu'il ne
// bouge pas à mesure qu'on joue.
export const PROGRAM_SIZE = 5

export function dailyProgram(games: GameEntry[], history: Play[], done: (g: GameEntry) => boolean, now = Date.now()): GameEntry[] {
  const key = `programme:${todayKey(new Date(now))}`
  const kept = load<string[] | null>(key, null)
  const dailies = games.filter((g) => g.dailyId && !g.weekly)
  // entrée au programme ce matin, la révision y reste même une fois les réponses revues
  const fromKept = kept?.map((href) => [...dailies, REVISION].find((g) => g.href === href)).filter((g): g is GameEntry => !!g)
  if (fromKept?.length === PROGRAM_SIZE) return fromKept
  // deux jeux au plus par rubrique, pour un programme varié
  const perSection = new Map<string, number>()
  const picked: GameEntry[] = []
  for (const { game } of suggest(dailies, history, done, now)) {
    const section = sectionOf.get(game.href) ?? ''
    if ((perSection.get(section) ?? 0) >= 2) continue
    perSection.set(section, (perSection.get(section) ?? 0) + 1)
    picked.push(game)
    if (picked.length === PROGRAM_SIZE) break
  }
  save(key, picked.map((g) => g.href))
  return picked
}

// Le jeu à enchaîner après une partie : le premier du programme du jour pas encore fait, sinon la meilleure
// suggestion ; jamais celui qu'on vient de finir.
export function nextGame(games: GameEntry[], history: Play[], done: (g: GameEntry) => boolean, now = Date.now()): Suggestion | undefined {
  const program = dailyProgram(games, history, done, now)
  const last = history.at(-1)
  const picks = suggest(games, history, done, now).filter((s) => !last || !playIds(s.game).includes(last.g))
  return picks.find((s) => program.includes(s.game) && !done(s.game)) ?? picks[0]
}
