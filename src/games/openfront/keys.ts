// Les touches de Frontières, celles d'OpenFront par défaut, modifiables et gardées dans ce navigateur.
// Chaque action retient un code de touche (KeyboardEvent.code), indépendant de la disposition du clavier.
import { msg } from '../../lib/i18n'
import { load, save } from '../../lib/util'

export type Action =
  | 'moveUp'
  | 'moveLeft'
  | 'moveDown'
  | 'moveRight'
  | 'zoomOut'
  | 'zoomIn'
  | 'centerCamera'
  | 'toggleView'
  | 'attackRatioDown'
  | 'attackRatioUp'
  | 'groundAttack'
  | 'boatAttack'
  | 'requestAlliance'
  | 'breakAlliance'
  | 'targetPlayer'
  | 'emojiMenu'
  | 'buildCity'
  | 'buildFactory'
  | 'buildPort'
  | 'buildDefensePost'
  | 'buildMissileSilo'
  | 'buildSamLauncher'
  | 'buildWarship'
  | 'buildAtomBomb'
  | 'buildHydrogenBomb'
  | 'buildMIRV'
  | 'pauseGame'
  | 'gameSpeedDown'
  | 'gameSpeedUp'

export type Keys = Record<Action, string>

export const DEFAULT_KEYS: Keys = {
  moveUp: 'KeyW',
  moveLeft: 'KeyA',
  moveDown: 'KeyS',
  moveRight: 'KeyD',
  zoomOut: 'KeyQ',
  zoomIn: 'KeyE',
  centerCamera: 'KeyC',
  toggleView: 'Space',
  attackRatioDown: 'KeyT',
  attackRatioUp: 'KeyY',
  groundAttack: 'KeyG',
  boatAttack: 'KeyB',
  requestAlliance: 'KeyK',
  breakAlliance: 'KeyL',
  targetPlayer: 'KeyN',
  emojiMenu: 'KeyF',
  buildCity: 'Digit1',
  buildFactory: 'Digit2',
  buildPort: 'Digit3',
  buildDefensePost: 'Digit4',
  buildMissileSilo: 'Digit5',
  buildSamLauncher: 'Digit6',
  buildWarship: 'Digit7',
  buildAtomBomb: 'Digit8',
  buildHydrogenBomb: 'Digit9',
  buildMIRV: 'Digit0',
  pauseGame: 'KeyP',
  gameSpeedDown: 'Comma',
  gameSpeedUp: 'Period',
}

// les flèches et les touches - et = gardent toujours leur rôle, en plus des touches choisies
const ALIASES: Record<string, Action> = {
  ArrowUp: 'moveUp',
  ArrowLeft: 'moveLeft',
  ArrowDown: 'moveDown',
  ArrowRight: 'moveRight',
  Minus: 'zoomOut',
  NumpadSubtract: 'zoomOut',
  Equal: 'zoomIn',
  NumpadAdd: 'zoomIn',
}

export const KEY_GROUPS: { title: string; actions: [Action, string][] }[] = [
  {
    title: msg('Caméra'),
    actions: [
      ['moveUp', msg('Monter')],
      ['moveLeft', msg('Aller à gauche')],
      ['moveDown', msg('Descendre')],
      ['moveRight', msg('Aller à droite')],
      ['zoomOut', msg('Dézoomer')],
      ['zoomIn', msg('Zoomer')],
      ['centerCamera', msg('Te retrouver')],
      ['toggleView', msg('Vue des camps (maintenir)')],
    ],
  },
  {
    title: msg('Attaque'),
    actions: [
      ['attackRatioDown', msg('Envoyer moins de troupes')],
      ['attackRatioUp', msg('Envoyer plus de troupes')],
      ['groundAttack', msg('Attaquer par la terre')],
      ['boatAttack', msg('Attaquer par la mer')],
    ],
  },
  {
    title: msg('Diplomatie'),
    actions: [
      ['requestAlliance', msg('Proposer une alliance')],
      ['breakAlliance', msg('Rompre l’alliance')],
      ['targetPlayer', msg('Cibler')],
      ['emojiMenu', msg('Emoji')],
    ],
  },
  {
    title: msg('Construire'),
    actions: [
      ['buildCity', msg('Ville')],
      ['buildFactory', msg('Usine')],
      ['buildPort', msg('Port')],
      ['buildDefensePost', msg('Poste de défense')],
      ['buildMissileSilo', msg('Silo à missiles')],
      ['buildSamLauncher', msg('Défense antiaérienne')],
      ['buildWarship', msg('Navire de guerre')],
      ['buildAtomBomb', msg('Bombe A')],
      ['buildHydrogenBomb', msg('Bombe H')],
      ['buildMIRV', msg('MIRV')],
    ],
  },
  {
    title: msg('Partie'),
    actions: [
      ['pauseGame', msg('Pause')],
      ['gameSpeedDown', msg('Ralentir')],
      ['gameSpeedUp', msg('Accélérer')],
    ],
  },
]

export const loadKeys = (): Keys => ({ ...DEFAULT_KEYS, ...load<Partial<Keys>>('openfront-touches', {}) })

export const saveKeys = (keys: Keys) => save('openfront-touches', keys)

// L'action d'une touche ; une touche reprise par une autre action n'en a plus qu'une, la dernière choisie.
export function actionFor(keys: Keys, code: string): Action | undefined {
  for (const action in keys) if (keys[action as Action] === code) return action as Action
  return ALIASES[code]
}

// Choisir une touche la retire de l'action qui l'avait, pour qu'une touche ne fasse jamais deux choses.
export function rebind(keys: Keys, action: Action, code: string): Keys {
  const next = { ...keys, [action]: code }
  for (const other in next) if (other !== action && next[other as Action] === code) next[other as Action] = ''
  return next
}

export function keyName(code: string): string {
  if (!code) return '—'
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  const names: Record<string, string> = { Comma: ',', Period: '.', Minus: '-', Equal: '=', Space: '␣', Slash: '/', Semicolon: ';', Quote: '’', BracketLeft: '[', BracketRight: ']', Backquote: '`' }
  return names[code] ?? code
}
