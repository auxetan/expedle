// Le duel en direct : deux joueurs, la même partie au même moment, et le plus rapide gagne. Ici ce qui se calcule sans
// réseau : les jeux qui s'y prêtent, le vainqueur, l'appariement de la file d'attente et le code du salon.
import { ALL_GAMES } from '../ui/games'
import { newSeed } from './challenge'
import { t } from './i18n'
import { seededRng } from './util'

// course : le jeu se gagne, et le premier à réussir l'emporte ; score : le meilleur score, puis le plus rapide
export type Rule = 'course' | 'score'

export interface DuelGame {
  // la partie telle que recordPlay l'inscrit dans l'historique
  id: string
  // la page où se joue la graine, sans le #
  path: string
  // la fiche du jeu dans la liste des jeux, pour son titre et son icône
  href: string
  rule: Rule
}

// Les jeux qui rejouent exactement la même partie à partir d'une graine, et dont la partie a une fin.
export const DUEL_GAMES: DuelGame[] = [
  { id: 'itineraire-libre', path: '/itineraire/libre', href: '#/itineraire', rule: 'course' },
  { id: 'expedition', path: '/expedition', href: '#/expedition', rule: 'course' },
  { id: 'worldle', path: '/worldle', href: '#/worldle', rule: 'course' },
  { id: 'flagle', path: '/flagle', href: '#/flagle', rule: 'course' },
  { id: 'globle', path: '/globle', href: '#/globle', rule: 'course' },
  { id: 'countryle', path: '/countryle', href: '#/countryle', rule: 'course' },
  { id: 'factle', path: '/factle', href: '#/factle', rule: 'course' },
  { id: 'dailygeo', path: '/dailygeo', href: '#/dailygeo', rule: 'course' },
  { id: 'geogrid', path: '/geogrid', href: '#/geogrid', rule: 'score' },
  { id: 'wikitrivia', path: '/wikitrivia', href: '#/wikitrivia', rule: 'score' },
  { id: 'tightrope', path: '/tightrope', href: '#/tightrope', rule: 'score' },
  { id: 'balance', path: '/balance', href: '#/balance', rule: 'score' },
  { id: 'quiz-capitales', path: '/quiz/capitales', href: '#/quiz/capitales', rule: 'score' },
  { id: 'quiz-drapeaux', path: '/quiz/drapeaux', href: '#/quiz/drapeaux', rule: 'score' },
]

export const duelGame = (id: string | null | undefined) => DUEL_GAMES.find((g) => g.id === id)

// la fiche du jeu dans la liste des jeux : son titre et son icône
export const duelCard = (id: string | null | undefined) => ALL_GAMES.find((g) => g.href === duelGame(id)?.href)

export function duelTitle(id: string | null | undefined): string {
  const card = duelCard(id)
  return card ? t(card.title) : ''
}

// Une graine neuve pour une manche : n'importe quelle chaîne, sauf pour Travle, dont la graine décrit le trajet.
export async function duelSeed(game: DuelGame): Promise<string> {
  if (game.id !== 'itineraire-libre') return newSeed()
  const [{ loadAtlas }, { makePuzzle }, { travleSeed }] = await Promise.all([import('../geo/atlas'), import('../games/itineraire/puzzle'), import('../games/itineraire/ItinPages')])
  const atlas = await loadAtlas('monde')
  for (;;) {
    const p = makePuzzle(atlas, Math.random, 4, 7)
    if (p) return travleSeed(atlas, p)
  }
}

export interface Finish {
  // du « Partez » à la fin de partie, mesuré par le joueur lui-même : la latence ne favorise personne
  ms: number
  pts: number
  win?: boolean
  // hors course avant d'avoir fini : on a abandonné, ou l'adversaire a réussi plus vite qu'on ne peut encore le faire
  out?: 'abandon' | 'battu'
}

export type Outcome = 'gagné' | 'perdu' | 'égalité'

// L'issue vue par `a`, quand les deux ont fini. Les deux joueurs la calculent pareil à partir des mêmes résultats.
export function decide(rule: Rule, a: Finish, b: Finish): Outcome {
  if (!!a.out !== !!b.out) return a.out ? 'perdu' : 'gagné'
  if (rule === 'course' && !!a.win !== !!b.win) return a.win ? 'gagné' : 'perdu'
  const d = rule === 'course' && a.win ? b.ms - a.ms : a.pts - b.pts || b.ms - a.ms
  return d > 0 ? 'gagné' : d < 0 ? 'perdu' : 'égalité'
}

// En course, l'adversaire a réussi en `them.ms` : passé ce temps, on ne peut plus le battre.
export const beaten = (rule: Rule, them: Finish | null, elapsed: number) => rule === 'course' && !!them?.win && !them.out && elapsed > them.ms

export interface Waiting {
  key: string
  // le compte : on ne joue pas contre soi-même, même depuis deux onglets
  user: string
  // le jeu voulu, ou null pour n'importe lequel
  game: string | null
  joined: number
}

// L'appariement de la file, le même chez tous puisqu'il se calcule sur la même liste : par ordre d'arrivée, chacun
// prend le premier joueur compatible encore libre. Renvoie la paire de `me`, l'hôte (le plus ancien) en premier.
export function pairOf(list: Waiting[], me: string): [Waiting, Waiting] | null {
  const queue = [...list].sort((a, b) => a.joined - b.joined || a.key.localeCompare(b.key))
  const taken = new Set<string>()
  for (const a of queue) {
    if (taken.has(a.key)) continue
    const b = queue.find((x) => x !== a && !taken.has(x.key) && x.user !== a.user && (!a.game || !x.game || a.game === x.game))
    if (!b) continue
    taken.add(a.key).add(b.key)
    if (me === a.key || me === b.key) return [a, b]
  }
  return null
}

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const code = (rng: () => number) => Array.from({ length: 5 }, () => LETTERS[Math.floor(rng() * LETTERS.length)]).join('')

export const newCode = () => code(Math.random)
export const isCode = (s: string) => /^[A-HJ-NP-Z2-9]{5}$/.test(s)

// le salon d'une paire trouvée dans la file : les deux joueurs en tirent le même code, sans avoir à se parler
export const pairCode = (host: string, guest: string) => code(seededRng(`${host}:${guest}`))

// le jeu d'une paire : celui que l'un des deux a choisi, sinon un tirage que les deux font pareil
export const pairGame = (host: Waiting, guest: Waiting, room: string) =>
  host.game ?? guest.game ?? DUEL_GAMES[Math.floor(seededRng(room)() * DUEL_GAMES.length)].id

// ce qu'il reste à faire à un joueur, envoyé en nombre et écrit dans la langue de celui qui le lit
export interface Progress {
  left: number
  unit: 'pays' | 'frontieres'
}

export function progressText(p: Progress): string {
  if (p.unit === 'frontieres') return p.left <= 1 ? t('Dernière frontière !') : t('Plus que {n} frontières', { n: p.left })
  return p.left <= 1 ? t('Dernier pays !') : t('Plus que {n} pays', { n: p.left })
}
