import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'

export interface Route {
  segments: string[]
  params: URLSearchParams
}

function parse(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?')
  return { segments: path.split('/').filter(Boolean), params: new URLSearchParams(query) }
}

export function useRoute(): Route {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onChange = () => {
      const update = () => {
        flushSync(() => setHash(window.location.hash))
        window.scrollTo(0, 0)
      }
      // d'une page à l'autre, un fondu enchaîné là où le navigateur sait le faire
      // un onglet caché saute l'animation : la page change quand même, l'erreur annoncée n'en est pas une
      if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(update).ready.catch(() => {})
      else update()
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return parse(hash)
}

export function go(path: string): void {
  window.location.hash = path
}
