import { getWorld } from '../../geo/world'
import GuessGame, { type GuessSource } from './GuessGame'
import PhotoViewer from './PhotoViewer'
import { findPlace, placeById, type Place } from './photos'
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
  dailyMode: 'monde',
  find: (mode, seen, signal, rng = Math.random) =>
    findPlace(world, mode, rng, seen, signal).then((p) => {
      new Image().src = p.image
      return p
    }),
  imagery: 'photo',
  keyOf: (spot) => spot.id,
  load: (id, signal) =>
    placeById(world, id, signal).then((p) => {
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

export default function PhotoGuessr({ daily = false }: { daily?: boolean }) {
  return <GuessGame source={photos} daily={daily} />
}
