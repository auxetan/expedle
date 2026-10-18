import { useSyncExternalStore } from 'react'

// Installation sur l'écran d'accueil. Chrome et Edge proposent l'installation par un événement qu'il faut garder
// dès le chargement ; Safari sur iPhone n'en a pas : on y explique le geste à faire.
interface InstallPrompt extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPrompt | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((f) => f())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallPrompt
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
}

const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export type InstallState = 'installed' | 'prompt' | 'ios' | 'none'

function state(): InstallState {
  if (standalone()) return 'installed'
  if (deferred) return 'prompt'
  return ios() ? 'ios' : 'none'
}

export function useInstall(): InstallState {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f)
      return () => listeners.delete(f)
    },
    state,
  )
}

export async function install(): Promise<void> {
  if (!deferred) return
  await deferred.prompt()
  await deferred.userChoice
  deferred = null
  notify()
}
