import { useEffect, useState } from 'react'
import { load, save } from '../lib/util'

export type Theme = 'sombre' | 'clair'

const listeners = new Set<() => void>()

export function currentTheme(): Theme {
  return load<Theme>('theme', 'sombre')
}

export function applyTheme(t: Theme = currentTheme()): void {
  document.documentElement.dataset.theme = t
}

export function setTheme(t: Theme): void {
  save('theme', t)
  const swap = () => {
    applyTheme(t)
    listeners.forEach((f) => f())
  }
  // le changement de thème se fait en fondu plutôt que d'un coup
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(swap).ready.catch(() => {})
  else swap()
}

export function useTheme(): Theme {
  const [theme, set] = useState(currentTheme)
  useEffect(() => {
    const f = () => set(currentTheme())
    listeners.add(f)
    return () => {
      listeners.delete(f)
    }
  }, [])
  return theme
}

// Couleur d'un jeton CSS, pour les dessins sur canvas qui ne lisent pas les variables.
export function cssColor(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || '#888888'
}
