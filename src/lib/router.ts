import { useEffect, useState } from 'react'

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
      setHash(window.location.hash)
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return parse(hash)
}

export function go(path: string): void {
  window.location.hash = path
}
