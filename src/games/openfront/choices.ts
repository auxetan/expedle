// Les réglages qu'on choisit avant une partie, en solo comme dans un salon en ligne.
import { msg } from '../../lib/i18n'
import type { Level } from './rules'

export const NATIONS = 50
export const TRIBES = 250
export const LEVELS: Level[] = ['facile', 'moyen', 'difficile', 'impossible']
export const LEVEL_NAMES: Record<Level, string> = { facile: msg('Facile'), moyen: msg('Moyen'), difficile: msg('Difficile'), impossible: msg('Impossible') }
export const BOTS = [0, 50, 100, 150, 250, 400]
