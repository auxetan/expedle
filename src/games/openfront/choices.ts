// Les réglages qu'on choisit avant une partie, en solo comme dans un salon en ligne.
import { msg, t } from '../../lib/i18n'
import type { Level } from './rules'

export const NATIONS = 50
export const TRIBES = 250
export const LEVELS: Level[] = ['facile', 'moyen', 'difficile', 'impossible']
export const LEVEL_NAMES: Record<Level, string> = { facile: msg('Facile'), moyen: msg('Moyen'), difficile: msg('Difficile'), impossible: msg('Impossible') }
export const BOTS = [0, 50, 100, 150, 250, 400]
// chacun pour soi, ou de deux à sept équipes comme sur OpenFront
export const TEAM_COUNTS = [0, 2, 3, 4, 5, 6, 7]
// les couleurs des équipes d'OpenFront : rouge, bleu, turquoise, violet, jaune, orange, vert
export const TEAM_HUES = [4, 218, 176, 278, 48, 26, 122]
export const teamMode = (n: number) => (n ? t('{n} équipes', { n }) : t('Chacun pour soi'))
export const TEAM_NAMES = [msg('Équipe rouge'), msg('Équipe bleue'), msg('Équipe turquoise'), msg('Équipe violette'), msg('Équipe jaune'), msg('Équipe orange'), msg('Équipe verte')]
