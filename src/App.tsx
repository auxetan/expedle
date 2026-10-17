import { lazy, Suspense } from 'react'
import Hub from './hub/Hub'
import { CloudSync } from './ui/Account'
import Celebrations from './ui/Celebrations'
import { useRoute } from './lib/router'

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
const JetPunk = lazy(() => import('./games/jetpunk/JetPunk'))
const Worldle = lazy(() => import('./games/worldle/Worldle'))
const Globle = lazy(() => import('./games/globle/Globle'))
const PhotoGuessr = lazy(() => import('./games/guessr/PhotoGuessr'))
const GeoGuessr = lazy(() => import('./games/guessr/GeoGuessr'))

export default function App() {
  const route = useRoute()
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
    case 'jetpunk':
      content = <JetPunk key={key} segments={route.segments} params={route.params} />
      break
    case 'worldle':
      content = <Worldle key={key} mode={sub} />
      break
    case 'globle':
      content = <Globle key={key} mode={sub} />
      break
    case 'photoguessr':
      content = <PhotoGuessr key={key} />
      break
    case 'geoguessr':
      content = <GeoGuessr key={key} />
      break
    default:
      content = <Hub />
  }

  return (
    <>
      <Suspense fallback={<div className="page-loading">Chargement…</div>}>
        <div className="page" key={`${page ?? ''}/${sub ?? ''}`}>
          {content}
        </div>
      </Suspense>
      <Celebrations />
      <CloudSync />
    </>
  )
}
