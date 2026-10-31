import { lazy, Suspense } from 'react'
import Hub from './hub/Hub'
import { CloudSync } from './ui/Account'
import Celebrations from './ui/Celebrations'
import DuelLayer from './ui/DuelLayer'
import OfflineBadge from './ui/OfflineBadge'
import { t, useLang } from './lib/i18n'
import { useRoute } from './lib/router'
import { rubriqueOf } from './ui/games'

const Itineraire = lazy(() => import('./games/itineraire/Itineraire'))
const Echelle = lazy(() => import('./games/echelle/Echelle'))
const Balance = lazy(() => import('./games/echelle/Balance'))
const Estimation = lazy(() => import('./games/echelle/Estimation'))
const MgHome = lazy(() => import('./games/echelle/MgHome'))
const MgArchive = lazy(() => import('./games/echelle/MgHome').then((m) => ({ default: m.MgArchive })))
const Classement = lazy(() => import('./games/classement/Classement'))
const Cartographe = lazy(() => import('./games/cartographe/Cartographe'))
const Quiz = lazy(() => import('./games/quiz/Quiz'))
const Stats = lazy(() => import('./hub/Stats'))
const Achievements = lazy(() => import('./hub/Achievements'))
const Leaderboards = lazy(() => import('./hub/Leaderboards'))
const Challenges = lazy(() => import('./hub/Challenges'))
const Passport = lazy(() => import('./hub/Passport'))
const Shop = lazy(() => import('./hub/Shop'))
const Savoir = lazy(() => import('./hub/Savoir'))
const Revision = lazy(() => import('./games/revision/Revision'))
const JetPunk = lazy(() => import('./games/jetpunk/JetPunk'))
const Worldle = lazy(() => import('./games/worldle/Worldle'))
const Globle = lazy(() => import('./games/globle/Globle'))
const Countryle = lazy(() => import('./games/countryle/Countryle'))
const Flagle = lazy(() => import('./games/flagle/Flagle'))
const GeoGrid = lazy(() => import('./games/geogrid/GeoGrid'))
const DailyGeo = lazy(() => import('./games/dailygeo/DailyGeo'))
const Factle = lazy(() => import('./games/factle/Factle'))
const Wikitrivia = lazy(() => import('./games/wikitrivia/Wikitrivia'))
const Tightrope = lazy(() => import('./games/tightrope/Tightrope'))
const PhotoGuessr = lazy(() => import('./games/guessr/PhotoGuessr'))
const GeoGuessr = lazy(() => import('./games/guessr/GeoGuessr'))
const OpenFront = lazy(() => import('./games/openfront/OpenFront'))
const Expedition = lazy(() => import('./games/expedition/Expedition'))
const DuelPage = lazy(() => import('./duel/DuelPage'))

export default function App() {
  const route = useRoute()
  // changer de langue redessine toute la page
  const lang = useLang()
  const [page, sub] = route.segments
  const key = route.segments.join('/') + '?' + route.params.toString()
  const date = route.params.get('date')

  let content
  switch (page) {
    case 'itineraire':
      content = <Itineraire key={key} mode={sub} params={route.params} />
      break
    case 'echelle':
      content = <Echelle key={key} variant={sub === 'geo' || sub === '1000' || sub === 'pop' ? sub : 'objets'} date={date} />
      break
    case 'estimation':
      content = sub === 'archive' ? <MgArchive key={key} /> : <MgHome key={key} />
      break
    case 'balance':
      content = <Balance key={key} date={date} />
      break
    case 'question':
      content = <Estimation key={key} mode="daily" date={date} />
      break
    case 'survie':
      content = <Estimation key={key} mode="survival" />
      break
    case 'classement':
      content = <Classement key={key} mode={sub} params={route.params} />
      break
    case 'cartographe':
      content = <Cartographe key={key} quizId={sub} params={route.params} />
      break
    case 'quiz':
      content = <Quiz key={key} kind={sub} />
      break
    case 'stats':
      content = <Stats />
      break
    case 'succes':
      content = <Achievements />
      break
    case 'classements':
      content = <Leaderboards key={key} tab={sub} />
      break
    case 'passeport':
      content = <Passport />
      break
    case 'boutique':
      content = <Shop />
      break
    case 'savoir':
      content = <Savoir />
      break
    case 'revision':
      content = <Revision key={key} />
      break
    case 'defis':
      content = <Challenges key={key} params={route.params} />
      break
    case 'jetpunk':
      content = <JetPunk key={key} segments={route.segments} params={route.params} />
      break
    case 'worldle':
      content = <Worldle key={key} mode={sub} />
      break
    case 'statele':
      content = <Worldle key={key} mode={sub} variant="statele" />
      break
    case 'globle':
      content = <Globle key={key} mode={sub} />
      break
    case 'countryle':
      content = <Countryle key={key} mode={sub} />
      break
    case 'flagle':
      content = <Flagle key={key} mode={sub} />
      break
    case 'geogrid':
      content = <GeoGrid key={key} mode={sub} />
      break
    case 'dailygeo':
      content = <DailyGeo key={key} mode={sub} />
      break
    case 'factle':
      content = <Factle key={key} mode={sub} />
      break
    case 'wikitrivia':
      content = <Wikitrivia key={key} mode={sub} />
      break
    case 'tightrope':
      content = <Tightrope key={key} mode={sub} />
      break
    case 'photoguessr':
      content = <PhotoGuessr key={key} daily={sub === 'jour'} />
      break
    case 'geoguessr':
      content = <GeoGuessr key={key} daily={sub === 'jour'} />
      break
    case 'expedition':
      content = <Expedition key={key} mode={sub} />
      break
    case 'openfront':
      content = <OpenFront key={key} />
      break
    case 'duel':
      content = <DuelPage key={key} code={sub} params={route.params} />
      break
    default:
      content = <Hub />
  }

  return (
    <>
      <Suspense fallback={<div className="page-loading">{t('Chargement…')}</div>}>
        {/* data-tint pose --rubrique (ui.css) : la teinte de la rubrique, repère de la page */}
        <div className="page" key={`${lang}/${page ?? ''}/${sub ?? ''}`} data-tint={rubriqueOf(`#/${route.segments.join('/')}`)?.tint}>
          {content}
        </div>
      </Suspense>
      <Celebrations />
      <DuelLayer route={route} />
      <OfflineBadge />
      <CloudSync />
    </>
  )
}
