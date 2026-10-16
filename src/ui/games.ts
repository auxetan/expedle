export interface GameEntry {
  href: string
  title: string
  tagline: string
  rhythm: 'quotidien' | 'hebdo' | 'libre'
  glyph: string
  dailyId?: string
  weekly?: boolean
}

export const GAME_SECTIONS: { label: string; games: GameEntry[] }[] = [
  {
    label: 'Géographie',
    games: [
      { href: '#/itineraire', title: 'Travle', tagline: 'Relier deux pays par la terre', rhythm: 'quotidien', dailyId: 'itineraire', glyph: '◎' },
      { href: '#/itineraire/hebdo', title: 'Travle : défi hebdo', tagline: 'Un long trajet, chaque lundi', rhythm: 'hebdo', dailyId: 'itineraire-hebdo', weekly: true, glyph: '⇢' },
      { href: '#/itineraire/usa', title: 'Travle USA', tagline: 'D’un État américain à l’autre', rhythm: 'quotidien', dailyId: 'itineraire-usa', glyph: '★' },
      { href: '#/classement', title: 'GeoHunter', tagline: 'Chaque pays dans sa meilleure catégorie', rhythm: 'quotidien', dailyId: 'classement-jour', glyph: '#1' },
      { href: '#/cartographe', title: 'Seterra', tagline: 'Situer pays, capitales et drapeaux', rhythm: 'libre', glyph: '⌖' },
    ],
  },
  {
    label: 'Magnitudle',
    games: [
      { href: '#/echelle', title: 'Size It Up', tagline: 'La silhouette à sa vraie taille', rhythm: 'quotidien', dailyId: 'echelle-objets', glyph: '↗' },
      { href: '#/echelle/pop', title: 'Size It Up : Pop Culture', tagline: 'La taille officielle des héros de fiction', rhythm: 'quotidien', dailyId: 'echelle-pop', glyph: '✦' },
      { href: '#/echelle/geo', title: 'Size It Up : Géographie', tagline: 'La vraie taille des territoires', rhythm: 'quotidien', dailyId: 'echelle-geo', glyph: '▱' },
      { href: '#/echelle/1000', title: 'The Weekly 1K', tagline: 'Dix manches sur un thème', rhythm: 'hebdo', dailyId: 'echelle-1000', weekly: true, glyph: '1K' },
      { href: '#/balance', title: 'Weigh It Up', tagline: 'Équilibrer la balance', rhythm: 'quotidien', dailyId: 'balance', glyph: '⚖' },
      { href: '#/question', title: 'Daily Question', tagline: 'Une question, une estimation', rhythm: 'quotidien', dailyId: 'question', glyph: 'Σ' },
      { href: '#/survie', title: 'Survival Mode', tagline: 'Estimer vite, rester en vie', rhythm: 'libre', glyph: '♡' },
    ],
  },
  {
    label: 'Culture générale',
    games: [
      { href: '#/quiz/jour', title: 'Quiz du jour', tagline: 'Dix questions, les mêmes pour tous', rhythm: 'quotidien', dailyId: 'quiz-jour', glyph: '10' },
      { href: '#/quiz', title: 'Quiz culture G', tagline: 'Des milliers de questions', rhythm: 'libre', glyph: '?' },
      { href: '#/quiz/drapeaux', title: 'Drapeaux', tagline: 'Un pays, un drapeau', rhythm: 'libre', glyph: '⚑' },
      { href: '#/quiz/capitales', title: 'Capitales', tagline: 'Chaque pays et sa capitale', rhythm: 'libre', glyph: '◆' },
    ],
  },
]

export const ALL_GAMES = GAME_SECTIONS.flatMap((s) => s.games)
