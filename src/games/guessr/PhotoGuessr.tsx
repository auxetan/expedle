import { getWorld } from '../../geo/world'
import GuessGame, { type GuessSource } from './GuessGame'
import PhotoViewer from './PhotoViewer'
import { findPlace, type Place } from './photos'
import { msg, t } from '../../lib/i18n'

const world = getWorld()

const photos: GuessSource<Place> = {
  game: 'photoguessr',
  title: 'PhotoGuessr',
  question: msg('Où a été prise cette photo ?'),
  intro: msg(
    'Cinq vraies photos géolocalisées, venues de Wikimedia Commons. Scrute les panneaux, la végétation, l’architecture, puis place ton repère sur la carte : plus tu es près, plus tu marques, jusqu’à 5 000 points par manche.',
  ),
  note: msg('Il faut une connexion : les photos et le fond de carte sont chargés en direct.'),
  find: (mode, seen, signal) =>
    findPlace(world, mode, Math.random, seen, signal).then((p) => {
      new Image().src = p.image
      return p
    }),
  View: ({ spot }) => <PhotoViewer key={spot.id} src={spot.image} alt={t('Lieu à retrouver')} />,
  Details: ({ spot }) => (
    <>
      <p className="wg-place muted">{spot.title}</p>
      <p className="wg-credit muted">
        {t('Photo : {author}', { author: spot.author })} ·{' '}
        {spot.licenseUrl ? (
          <a href={spot.licenseUrl} target="_blank" rel="noopener noreferrer">
            {spot.license}
          </a>
        ) : (
          spot.license
        )}{' '}
        ·{' '}
        <a href={spot.page} target="_blank" rel="noopener noreferrer">
          Wikimedia Commons
        </a>
      </p>
    </>
  ),
  Thumb: ({ spot }) => <img src={spot.image} alt="" />,
  explain: (e) =>
    e instanceof Error && /Commons|Failed to fetch|NetworkError/.test(e.message) ? t('Impossible de joindre Wikimedia Commons. Vérifie ta connexion.') : t('Aucune photo trouvée cette fois.'),
}

export default function PhotoGuessr() {
  return <GuessGame source={photos} />
}
