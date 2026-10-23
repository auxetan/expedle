// Le niveau et les statistiques de Frontières, tirés des parties enregistrées dans ce navigateur.
import { msg } from '../../lib/i18n'
import type { Play } from '../../lib/stats'
import { load } from '../../lib/util'
import { owns } from '../../lib/wallet'

export const GAME = 'openfront'

// passer du niveau n au suivant demande 100 × n points
const need = (level: number) => 100 * level

export interface Rank {
  level: number
  // points gagnés dans le niveau en cours, et points qu'il demande
  into: number
  need: number
  xp: number
}

export function rankOf(xp: number): Rank {
  let level = 1
  let into = xp
  while (into >= need(level)) into -= need(level++)
  return { level, into, need: need(level), xp }
}

export interface Tally {
  games: number
  wins: number
  // meilleure part des terres tenue, en %
  best: number
  // part moyenne tenue en fin de partie, en %
  average: number
  ms: number
  multi: number
}

export function tallyOf(list: Play[]): Tally {
  const mine = list.filter((p) => p.g === GAME)
  return {
    games: mine.length,
    wins: mine.filter((p) => p.win).length,
    best: Math.max(0, ...mine.map((p) => p.s ?? 0)),
    average: mine.length ? Math.round(mine.reduce((s, p) => s + (p.s ?? 0), 0) / mine.length) : 0,
    ms: mine.reduce((s, p) => s + (p.ms ?? 0), 0),
    multi: mine.filter((p) => p.sub === 'multi').length,
  }
}

export const xpOf = (list: Play[]) => list.filter((p) => p.g === GAME).reduce((s, p) => s + p.pts, 0)

// Les motifs de territoire, achetés en pépites dans la boutique : des classiques, et des drôles.
export interface Skin {
  id: string
  name: string
  price: number
  group: 'classique' | 'drole'
  // vrai pour les cases peintes de la teinte secondaire
  at: (x: number, y: number) => boolean
}

// Un petit dessin répété sur tout le territoire, une rangée sur deux décalée d'un demi-dessin ; une marge
// autour de chacun l'empêche de toucher ses voisins.
function drawing(rows: string[]): Skin['at'] {
  const w = rows[0].length + 4
  const h = rows.length + 3
  return (x, y) => {
    const shift = (Math.floor(y / h) % 2) * (w >> 1)
    return rows[(y % h) - 1]?.[((x + shift) % w) - 2] === '#'
  }
}

export const SKINS: Skin[] = [
  { id: 'uni', name: msg('Uni'), price: 0, group: 'classique', at: () => false },
  { id: 'rayures', name: msg('Rayures'), price: 150, group: 'classique', at: (x, y) => (x + y) % 6 < 2 },
  { id: 'damier', name: msg('Damier'), price: 250, group: 'classique', at: (x, y) => ((x >> 2) + (y >> 2)) % 2 === 0 },
  { id: 'pois', name: msg('Pois'), price: 400, group: 'classique', at: (x, y) => ((x % 6) - 2.5) ** 2 + ((y % 6) - 2.5) ** 2 < 2.5 },
  { id: 'grille', name: msg('Grille'), price: 600, group: 'classique', at: (x, y) => x % 5 === 0 || y % 5 === 0 },
  { id: 'briques', name: msg('Briques'), price: 800, group: 'classique', at: (x, y) => y % 4 === 0 || (x + (Math.floor(y / 4) % 2) * 4) % 8 === 0 },
  { id: 'vagues', name: msg('Vagues'), price: 1000, group: 'classique', at: (x, y) => (y + Math.round(2 * Math.sin(x / 3)) + 60) % 6 < 2 },
  { id: 'losanges', name: msg('Losanges'), price: 1200, group: 'classique', at: (x, y) => Math.abs((x % 8) - 3.5) + Math.abs((y % 8) - 3.5) < 2 },
  { id: 'chevrons', name: msg('Chevrons'), price: 1500, group: 'classique', at: (x, y) => (Math.abs((x % 8) - 4) + y) % 6 < 2 },
  { id: 'ecailles', name: msg('Écailles'), price: 2000, group: 'classique', at: (x, y) => ((x % 6) - 3) ** 2 + ((y % 4) * 1.5) ** 2 > 9 },
  {
    id: 'coeurs',
    name: msg('Cœurs'),
    price: 300,
    group: 'drole',
    at: drawing([
      '.##..##.',
      '########',
      '########',
      '########',
      '.######.',
      '..####..',
      '...##...',
    ]),
  },
  {
    id: 'smileys',
    name: msg('Smileys'),
    price: 500,
    group: 'drole',
    at: drawing([
      '....####....',
      '..########..',
      '.##########.',
      '.##.####.##.',
      '###.####.###',
      '############',
      '##.######.##',
      '.##.####.##.',
      '.###....###.',
      '..########..',
      '....####....',
    ]),
  },
  {
    id: 'canards',
    name: msg('Canards'),
    price: 700,
    group: 'drole',
    at: drawing([
      '.....###..',
      '....#####.',
      '....##.##.',
      '....######',
      '....####..',
      '...####...',
      '#########.',
      '.#######..',
      '..#####...',
    ]),
  },
  {
    id: 'bananes',
    name: msg('Bananes'),
    price: 800,
    group: 'drole',
    at: drawing([
      '.........#',
      '........##',
      '........##',
      '.......###',
      '......###.',
      '#...####..',
      '.######...',
      '..####....',
    ]),
  },
  {
    id: 'pizzas',
    name: msg('Pizzas'),
    price: 1000,
    group: 'drole',
    at: drawing([
      '##########',
      '#.##..#.##',
      '.##..####.',
      '.#.####.#.',
      '..######..',
      '..#.##.#..',
      '...####...',
      '....##....',
    ]),
  },
  {
    id: 'champignons',
    name: msg('Champignons'),
    price: 1200,
    group: 'drole',
    at: drawing([
      '...####...',
      '.##.##.##.',
      '#..####..#',
      '##.####.##',
      '##########',
      '...#..#...',
      '...#..#...',
      '...####...',
    ]),
  },
  {
    id: 'chats',
    name: msg('Chats'),
    price: 1500,
    group: 'drole',
    at: drawing([
      '#........#',
      '##......##',
      '###....###',
      '##########',
      '#.##..##.#',
      '#.##..##.#',
      '####..####',
      '.###..###.',
      '..##..##..',
      '...####...',
    ]),
  },
  {
    id: 'fantomes',
    name: msg('Fantômes'),
    price: 1800,
    group: 'drole',
    at: drawing([
      '...####...',
      '.########.',
      '##########',
      '##..##..##',
      '##..##..##',
      '##########',
      '##########',
      '##########',
      '##.##.##.#',
      '#..#..#..#',
    ]),
  },
  {
    id: 'poulpes',
    name: msg('Poulpes'),
    price: 2200,
    group: 'drole',
    at: drawing([
      '...####...',
      '..######..',
      '.##.##.##.',
      '.##.##.##.',
      '.########.',
      '##########',
      '#.#.##.#.#',
      '#.#.##.#.#',
      '.#..#..#.#',
    ]),
  },
  {
    id: 'moustaches',
    name: msg('Moustaches'),
    price: 2600,
    group: 'drole',
    at: drawing([
      '...##..##...',
      '.##########.',
      '#####..#####',
      '.####..####.',
      '..##....##..',
      '#..........#',
      '.##......##.',
    ]),
  },
  {
    id: 'pirates',
    name: msg('Pirates'),
    price: 3000,
    group: 'drole',
    at: drawing([
      '..######..',
      '.########.',
      '##########',
      '##..##..##',
      '##..##..##',
      '####..####',
      '.###..###.',
      '..######..',
      '..#.##.#..',
    ]),
  },
]

export const skinById = (id: string) => SKINS.find((s) => s.id === id) ?? SKINS[0]

// le motif porté, s'il est toujours à soi
export function loadSkin() {
  const id = load<string>('openfront-motif', 'uni')
  return skinById(id).price === 0 || owns(`motif:${id}`) ? id : 'uni'
}
