// Le tchat rapide d'OpenFront : des phrases toutes faites, rangées par thème, qu'on envoie à un joueur.
// Les textes sont les nôtres ; la partie ne connaît que leurs codes (voir PHRASES dans rules.ts).
import { msg } from '../../lib/i18n'

export interface Phrase {
  id: string
  // `{name}` : le joueur désigné
  text: string
}

export const CHAT: { title: string; phrases: Phrase[] }[] = [
  {
    title: msg('Aide'),
    phrases: [
      { id: 'troupes', text: msg('Tu peux m’envoyer des troupes ?') },
      { id: 'or', text: msg('Tu peux m’envoyer de l’or ?') },
      { id: 'paix', text: msg('Ne m’attaque pas, s’il te plaît !') },
      { id: 'alliance', text: msg('On fait alliance ?') },
      { id: 'commerce', text: msg('On commerce ensemble ?') },
      { id: 'defends', text: msg('Aide-moi contre {name} !') },
    ],
  },
  {
    title: msg('Attaque'),
    phrases: [
      { id: 'attaque', text: msg('Attaquons {name} !') },
      { id: 'bombe', text: msg('Bombardons {name} !') },
      { id: 'achever', text: msg('Achevons {name} !') },
      { id: 'navires', text: msg('Construis des navires de guerre !') },
      { id: 'dca', text: msg('Construis des défenses antiaériennes !') },
    ],
  },
  {
    title: msg('Défense'),
    phrases: [
      { id: 'front', text: msg('Tiens la ligne de front !') },
      { id: 'bombes', text: msg('Attention, des bombes arrivent !') },
      { id: 'traitre', text: msg('{name} est un traître !') },
      { id: 'menace', text: msg('{name} devient trop fort !') },
    ],
  },
  {
    title: msg('Salutations'),
    phrases: [
      { id: 'salut', text: msg('Salut !') },
      { id: 'gg', text: msg('Bien joué !') },
      { id: 'merci', text: msg('Merci !') },
      { id: 'desole', text: msg('Désolé !') },
      { id: 'bonne', text: msg('Bonne partie !') },
    ],
  },
  {
    title: msg('Divers'),
    phrases: [
      { id: 'oui', text: msg('Oui') },
      { id: 'non', text: msg('Non') },
      { id: 'attends', text: msg('Attends un peu') },
      { id: 'rire', text: msg('Haha') },
    ],
  },
]

export const phraseText = (id: string) => CHAT.flatMap((c) => c.phrases).find((p) => p.id === id)?.text ?? ''
