export type Dim = 'h' | 'l'

export interface ObjectItem {
  emoji: string
  name: string
  detail: string
  dim: Dim
  cm: number
}

// dim : 'h' = hauteur de la silhouette, 'l' = longueur (largeur de la silhouette)
const RAW: [string, string, string, Dim, number][] = [
  ['🍎', 'Pomme', 'Golden moyenne', 'h', 8],
  ['🥚', 'Œuf de poule', 'calibre moyen', 'h', 5.7],
  ['🍍', 'Ananas', 'couronne comprise', 'h', 30],
  ['🎃', 'Citrouille', 'lanterne d’Halloween', 'h', 30],
  ['🥫', 'Boîte de conserve', 'format 400 g', 'h', 11],
  ['⚽', 'Ballon de football', 'taille 5', 'h', 22],
  ['🏀', 'Ballon de basket', 'taille 7', 'h', 24],
  ['🎾', 'Balle de tennis', 'diamètre officiel', 'h', 6.7],
  ['🎱', 'Boule de billard', 'boule n°8', 'h', 5.7],
  ['📱', 'Smartphone', 'écran 6,1 pouces', 'h', 14.7],
  ['🪑', 'Chaise', 'dossier compris', 'h', 90],
  ['🚪', 'Porte d’intérieur', 'standard', 'h', 204],
  ['🗿', 'Moaï', 'moyenne de l’île de Pâques', 'h', 400],
  ['🗽', 'Statue de la Liberté', 'du pied à la torche', 'h', 4600],
  ['🗼', 'Tour de Tokyo', 'antenne comprise', 'h', 33300],
  ['🎡', 'London Eye', 'grande roue', 'h', 13500],
  ['🗻', 'Mont Fuji', 'altitude du sommet', 'h', 377600],
  ['🐘', 'Éléphant d’Afrique', 'mâle adulte', 'h', 330],
  ['🦒', 'Girafe', 'mâle adulte, hauteur totale', 'h', 550],
  ['🐎', 'Cheval', 'longueur du museau à la queue', 'l', 240],
  ['🐄', 'Vache', 'Holstein adulte', 'l', 250],
  ['🐖', 'Cochon', 'porc domestique adulte', 'l', 150],
  ['🐑', 'Mouton', 'adulte', 'l', 120],
  ['🐕', 'Chien', 'labrador, queue comprise', 'l', 110],
  ['🐈', 'Chat domestique', 'queue comprise', 'l', 70],
  ['🐁', 'Souris grise', 'queue comprise', 'l', 17],
  ['🐜', 'Fourmi', 'ouvrière', 'l', 0.5],
  ['🐝', 'Abeille', 'ouvrière', 'l', 1.4],
  ['🐞', 'Coccinelle', 'à sept points', 'l', 0.7],
  ['🦋', 'Monarque', 'envergure', 'l', 10],
  ['🐌', 'Escargot de Bourgogne', 'en mouvement', 'l', 8],
  ['🐊', 'Crocodile marin', 'mâle adulte', 'l', 520],
  ['🦈', 'Grand requin blanc', 'adulte', 'l', 450],
  ['🐋', 'Baleine bleue', 'adulte', 'l', 2500],
  ['🐬', 'Grand dauphin', 'adulte', 'l', 250],
  ['🦖', 'Tyrannosaure', 'spécimen « Sue »', 'l', 1230],
  ['🦕', 'Brachiosaure', 'longueur totale', 'l', 2200],
  ['🐓', 'Coq', 'crête comprise', 'h', 55],
  ['🦩', 'Flamant rose', 'debout', 'h', 130],
  ['🐧', 'Manchot empereur', 'debout', 'h', 115],
  ['🦘', 'Kangourou roux', 'mâle debout', 'h', 160],
  ['🐪', 'Dromadaire', 'tête haute', 'h', 220],
  ['🦏', 'Rhinocéros blanc', 'adulte', 'l', 400],
  ['🦛', 'Hippopotame', 'adulte', 'l', 400],
  ['🦓', 'Zèbre des plaines', 'queue comprise', 'l', 250],
  ['🐅', 'Tigre de Sibérie', 'queue comprise', 'l', 330],
  ['🦣', 'Mammouth laineux', 'au garrot', 'h', 340],
  ['🐢', 'Tortue géante des Galápagos', 'carapace', 'l', 150],
  ['🐿️', 'Écureuil roux', 'queue comprise', 'l', 40],
  ['🦔', 'Hérisson', 'adulte', 'l', 25],
  ['🦉', 'Grand-duc d’Europe', 'perché', 'h', 70],
  ['🚲', 'Vélo', 'adulte', 'l', 175],
  ['🛵', 'Scooter', '125 cm³', 'l', 185],
  ['🚜', 'Tracteur agricole', 'taille moyenne', 'l', 450],
  ['🚁', 'Hélicoptère', 'monomoteur léger, rotor compris', 'l', 1290],
  ['🛶', 'Canoë', 'deux places', 'l', 490],
  ['🚙', 'SUV', 'compact', 'l', 450],
  ['🌴', 'Cocotier', 'adulte', 'h', 2500],
  ['🌵', 'Saguaro', 'cactus adulte', 'h', 1200],
  ['🌻', 'Tournesol', 'en pleine floraison', 'h', 200],
  ['🌲', 'Séquoia géant', '« General Sherman »', 'h', 8380],
  ['🧍', 'Homme adulte', 'taille moyenne en France', 'h', 176],
  ['🏆', 'Trophée de la Coupe du monde', 'FIFA', 'h', 36.8],
  ['🎩', 'Chapeau haut-de-forme', 'classique', 'h', 18],
  ['👟', 'Basket', 'pointure 43', 'l', 29],
  ['🧳', 'Valise cabine', 'roulettes comprises', 'h', 55],
  ['💡', 'Ampoule', 'culot E27', 'h', 11],
]

export const OBJECTS: ObjectItem[] = RAW.map(([emoji, name, detail, dim, cm]) => ({ emoji, name, detail, dim, cm }))

const ANIMALS = '🐘🦒🐎🐄🐖🐑🐕🐈🐁🐜🐝🐞🦋🐌🐊🦈🐋🐬🦖🦕🐓🦩🐧🦘🐪🦏🦛🦓🐅🦣🐢🐿️🦔🦉'
const EVERYDAY = '🍎🥚🍍🎃🥫⚽🏀🎾🎱📱🪑🚪🏆🎩👟🧳💡🧍'
const LANDMARKS = '🗿🗽🗼🎡🗻🌴🌵🌻🌲🚲🛵🚜🚁🛶🚙🧍🐘🦒'

// Thèmes du « 1 000 de la semaine »
export const WEEKLY_THEMES: { name: string; items: ObjectItem[] }[] = [
  { name: 'Le règne animal', items: OBJECTS.filter((o) => ANIMALS.includes(o.emoji)) },
  { name: 'La vie quotidienne', items: OBJECTS.filter((o) => EVERYDAY.includes(o.emoji)) },
  { name: 'Monuments, nature et véhicules', items: OBJECTS.filter((o) => LANDMARKS.includes(o.emoji)) },
]
