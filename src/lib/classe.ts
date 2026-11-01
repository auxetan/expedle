import { FRANCE_ASKS, quizId, quizTitle, REGIONS, type Ask } from '../games/cartographe/quizzes'
import { GAMES } from '../ui/gameInfo'
import { ALL_GAMES, GAME_SECTIONS } from '../ui/games'
import { t } from './i18n'
import type { Play } from './stats'

// Le code d'une classe tel qu'on le tape : majuscules, sans espace ni tiret.
export const cleanCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)

// Comme la base : de 2 à 20 caractères, et pas d'email en guise de pseudo.
export const validPseudo = (s: string) => s.trim().length >= 2 && s.trim().length <= 20 && !s.includes('@')

export const MAX_PINS = 8

export interface Pin {
  href: string
  title: string
}

// Ce qu'un professeur peut épingler : les quiz de France d'abord, puis ceux de Seterra et tous les jeux.
export function pinGroups(): { label: string; pins: Pin[] }[] {
  const seterra = (id: string): Pin => ({ href: `#/cartographe/${id}`, title: quizTitle(id)! })
  const france = [...FRANCE_ASKS.map((ask) => seterra(`france-${ask}`)), { href: '#/quiz/francophonie', title: t('Francophonie') }]
  return [
    { label: t('France'), pins: france },
    { label: 'Seterra', pins: (['pays', 'capitales', 'drapeaux'] as Ask[]).flatMap((ask) => REGIONS.map((r) => seterra(quizId(r.id, ask)))) },
    ...GAME_SECTIONS.map((s) => ({
      label: t(s.label),
      pins: s.games.filter((g) => !france.some((f) => f.href === g.href)).map((g) => ({ href: g.href, title: t(g.title) })),
    })),
  ]
}

export function pinTitle(href: string): string {
  const quiz = href.match(/^#\/cartographe\/(.+)$/)
  if (quiz) return quizTitle(quiz[1]) ?? href
  const game = ALL_GAMES.find((g) => g.href === href)
  return game ? t(game.title) : href
}

// Les adresses des jeux joués depuis une date, pour cocher les jeux à faire de la semaine.
export function playedSince(list: Play[], since: Date): Set<string> {
  const out = new Set<string>()
  for (const p of list) {
    if (p.t < since.getTime()) continue
    if (p.g === 'cartographe' && p.sub) out.add(`#/cartographe/${p.sub}`)
    const href = GAMES[p.g]?.href
    if (href) out.add(href)
  }
  return out
}
