import { load, save } from '../../lib/util'

export const CATEGORIES = ['Géographie', 'Histoire', 'Sciences', 'Arts & culture', 'Sport', 'Langues', 'Divers'] as const

export interface Row {
  hint?: string
  answer: string
  alts?: string[]
  // les lignes d'un même groupe forment un tableau à part (pays par continent…)
  group?: string
}

export interface TableQuiz {
  id: string
  title: string
  description: string
  category: string
  tags: string[]
  // secondes
  time: number
  // intitulés des colonnes ; sans `hint`, le tableau n'a que des cases à remplir
  hint?: string
  answer: string
  rows: Row[]
  author?: string
}

// « Le Caire », « le caire » et « Caire » se valent ; l'article initial est facultatif.
export function answerKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/ø/g, 'o')
    .replace(/ł/g, 'l')
    .replace(/đ/g, 'd')
    .replace(/ı/g, 'i')
    .replace(/[’`]/g, "'")
    .trim()
    .replace(/^(?:le |la |les |l'|the )/, '')
    .replace(/[^a-z0-9]/g, '')
}

const keyCache = new WeakMap<TableQuiz, string[][]>()

function rowKeys(quiz: TableQuiz): string[][] {
  let keys = keyCache.get(quiz)
  if (!keys) {
    keys = quiz.rows.map((r) => [r.answer, ...(r.alts ?? [])].map(answerKey))
    keyCache.set(quiz, keys)
  }
  return keys
}

// Toutes les lignes encore vides dont la réponse correspond : une réponse répétée se remplit partout d'un coup.
export function matchAnswer(quiz: TableQuiz, input: string, found: Set<number>): number[] {
  const key = answerKey(input)
  if (!key) return []
  return rowKeys(quiz).flatMap((keys, i) => (!found.has(i) && keys.includes(key) ? [i] : []))
}

// Une ligne = « indice ; réponse ; variante / variante » ou simplement « réponse / variante ».
export function parseAnswers(text: string): Row[] {
  const split = (s: string) =>
    s
      .split('/')
      .map((x) => x.trim())
      .filter(Boolean)
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line): Row[] => {
      if (line.includes(';')) {
        const [hint = '', answer = '', alts = ''] = line.split(';').map((x) => x.trim())
        if (!answer) return []
        const row: Row = { answer }
        if (hint) row.hint = hint
        if (split(alts).length) row.alts = split(alts)
        return [row]
      }
      const [answer, ...alts] = split(line)
      if (!answer) return []
      return [alts.length ? { answer, alts } : { answer }]
    })
}

export function formatAnswers(rows: Row[]): string {
  return rows
    .map((r) => {
      const alts = r.alts?.length ? r.alts.join(' / ') : ''
      return r.hint ? [r.hint, r.answer, alts].filter(Boolean).join(' ; ') : [r.answer, alts].filter(Boolean).join(' / ')
    })
    .join('\n')
}

const str = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)

// Frontière : un quiz venu d'un lien ou du stockage local est vérifié champ par champ.
export function validateQuiz(raw: unknown): TableQuiz | null {
  if (!raw || typeof raw !== 'object') return null
  const q = raw as Record<string, unknown>
  const title = str(q.title, 80)
  if (!title || !Array.isArray(q.rows)) return null
  const rows = q.rows.slice(0, 500).flatMap((r): Row[] => {
    if (!r || typeof r !== 'object') return []
    const o = r as Record<string, unknown>
    const answer = str(o.answer, 120)
    if (!answer) return []
    const row: Row = { answer }
    const hint = str(o.hint, 120)
    const group = str(o.group, 60)
    const alts = Array.isArray(o.alts) ? o.alts.flatMap((a) => str(a, 120) ?? []).slice(0, 10) : []
    if (hint) row.hint = hint
    if (alts.length) row.alts = alts
    if (group) row.group = group
    return [row]
  })
  if (!rows.length) return null
  const quiz: TableQuiz = {
    id: typeof q.id === 'string' && /^[\w-]{1,40}$/.test(q.id) ? q.id : 'partage',
    title,
    description: str(q.description, 300) ?? '',
    category: CATEGORIES.includes(q.category as (typeof CATEGORIES)[number]) ? (q.category as string) : 'Divers',
    tags: Array.isArray(q.tags) ? q.tags.flatMap((t) => str(t, 30) ?? []).slice(0, 10) : [],
    time: Math.min(3600, Math.max(10, Math.round(Number(q.time) || 0))),
    answer: str(q.answer, 40) ?? 'Réponse',
    rows,
  }
  const hint = str(q.hint, 40)
  const author = str(q.author, 30)
  if (hint) quiz.hint = hint
  if (author) quiz.author = author
  return quiz
}

export function encodeQuiz(quiz: TableQuiz): string {
  const bytes = new TextEncoder().encode(JSON.stringify(quiz))
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeQuiz(code: string): TableQuiz | null {
  try {
    const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'))
    const json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
    return validateQuiz(JSON.parse(json))
  } catch {
    return null
  }
}

export function loadMine(): TableQuiz[] {
  return load<unknown[]>('jp-mine', []).flatMap((q) => validateQuiz(q) ?? [])
}

export function saveMine(list: TableQuiz[]): void {
  save('jp-mine', list)
}

export interface Best {
  found: number
  total: number
  ms: number
}

export function bestResult(id: string): Best | null {
  return load<Best | null>(`jp-best:${id}`, null)
}

// Meilleur = plus de réponses, puis plus rapide à égalité.
export function submitResult(id: string, r: Best): boolean {
  const prev = bestResult(id)
  const better = !prev || r.found > prev.found || (r.found === prev.found && r.ms < prev.ms)
  if (better) save(`jp-best:${id}`, r)
  return better
}
