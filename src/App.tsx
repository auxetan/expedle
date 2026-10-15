import { lazy, Suspense } from 'react'
import Hub from './hub/Hub'
import { useRoute } from './lib/router'

const Itineraire = lazy(() => import('./games/itineraire/Itineraire'))
const Echelle = lazy(() => import('./games/echelle/Echelle'))
const Balance = lazy(() => import('./games/echelle/Balance'))
const Estimation = lazy(() => import('./games/echelle/Estimation'))
const Classement = lazy(() => import('./games/classement/Classement'))
const Cartographe = lazy(() => import('./games/cartographe/Cartographe'))
const Quiz = lazy(() => import('./games/quiz/Quiz'))

export default function App() {
  const route = useRoute()
  const [page, sub] = route.segments
  const key = route.segments.join('/') + '?' + route.params.toString()

  let content
  switch (page) {
    case 'itineraire':
      content = <Itineraire key={key} mode={sub} params={route.params} />
      break
    case 'echelle':
      content = <Echelle key={key} variant={sub === 'geo' ? 'geo' : 'objets'} />
      break
    case 'balance':
      content = <Balance key={key} />
      break
    case 'question':
      content = <Estimation key={key} mode="daily" />
      break
    case 'survie':
      content = <Estimation key={key} mode="survival" />
      break
    case 'classement':
      content = <Classement key={key} mode={sub} />
      break
    case 'cartographe':
      content = <Cartographe key={key} quizId={sub} params={route.params} />
      break
    case 'quiz':
      content = <Quiz key={key} kind={sub} />
      break
    default:
      content = <Hub />
  }

  return <Suspense fallback={<div className="page-loading">Chargement…</div>}>{content}</Suspense>
}
