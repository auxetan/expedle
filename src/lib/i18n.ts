import { createElement, Fragment, useSyncExternalStore, type ReactNode } from 'react'
import { MESSAGES } from '../i18n/messages'
import { load, save } from './util'

export type Lang = 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt'

// L'ordre (hors français) est celui des traductions dans i18n/messages.ts.
export const LANGS: { id: Lang; label: string; locale: string }[] = [
  { id: 'fr', label: 'Français', locale: 'fr-FR' },
  { id: 'en', label: 'English', locale: 'en-GB' },
  { id: 'es', label: 'Español', locale: 'es-ES' },
  { id: 'de', label: 'Deutsch', locale: 'de-DE' },
  { id: 'it', label: 'Italiano', locale: 'it-IT' },
  { id: 'pt', label: 'Português', locale: 'pt-PT' },
]

const INDEX: Record<Lang, number> = { fr: -1, en: 0, es: 1, de: 2, it: 3, pt: 4 }

// Langue du navigateur au premier passage, l'anglais si elle n'est pas proposée ; le français hors navigateur (tests).
function detect(): Lang {
  if (typeof window === 'undefined') return 'fr'
  const wanted = navigator.languages?.map((l) => l.slice(0, 2)) ?? []
  return (wanted.find((l) => LANGS.some((x) => x.id === l)) as Lang | undefined) ?? 'en'
}

let lang: Lang = load<Lang | null>('lang', null) ?? detect()
const listeners = new Set<() => void>()

export const getLang = () => lang
export const locale = () => LANGS.find((l) => l.id === lang)!.locale

export function setLang(next: Lang) {
  lang = next
  save('lang', next)
  if (typeof document !== 'undefined') document.documentElement.lang = next
  listeners.forEach((f) => f())
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f)
      return () => listeners.delete(f)
    },
    () => lang,
  )
}

const translate = (fr: string) => (lang === 'fr' ? fr : (MESSAGES[fr]?.[INDEX[lang]] ?? fr))

// Le texte français sert de clé : tant qu'une phrase n'est pas traduite, elle s'affiche en français.
export function t(fr: string, vars?: Record<string, string | number>): string {
  const text = translate(fr)
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text
}

// Comme t(), mais les {trous} reçoivent des éléments (un nom en couleur, un lien…) placés là où la langue les veut.
export function tx(fr: string, nodes: Record<string, ReactNode>): ReactNode[] {
  return translate(fr)
    .split(/(\{\w+\})/)
    .map((part, i) => {
      const key = part.match(/^\{(\w+)\}$/)?.[1]
      return key && key in nodes ? createElement(Fragment, { key: i }, nodes[key]) : part
    })
}

// Singulier ou pluriel selon les règles de la langue (en français, 0 et 1 sont au singulier).
export function plural(n: number, one: string, other: string, vars?: Record<string, string | number>): string {
  const rule = new Intl.PluralRules(locale()).select(n)
  return t(rule === 'one' ? one : other, { n: fmt(n), ...vars })
}

export const fmt = (n: number, options?: Intl.NumberFormatOptions) => n.toLocaleString(locale(), options)

// Rang écrit comme dans chaque langue : 1er, 2e · 1st, 2nd · 1., 2. · 1º, 2º.
export function ordinal(r: number): string {
  if (lang === 'fr') return r === 1 ? '1er' : `${r}e`
  if (lang === 'en') return `${r}${{ one: 'st', two: 'nd', few: 'rd' }[new Intl.PluralRules('en', { type: 'ordinal' }).select(r) as string] ?? 'th'}`
  return lang === 'de' ? `${r}.` : `${r}º`
}

// Marque un texte déclaré hors d'un composant, traduit plus tard à l'affichage avec t() : ne fait rien,
// mais le test des traductions le repère.
export const msg = (fr: string) => fr
