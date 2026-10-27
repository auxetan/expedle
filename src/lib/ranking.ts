// Où l'on se tient dans un classement : son rang, le joueur juste devant et ce qu'il faut pour le dépasser, le podium.
interface Ranked {
  rank: number
  name: string
  me: boolean
}

export interface Standing<T> {
  rank: number
  // l'écart en points avec le joueur juste devant ; 0 : à égalité, départagés au chrono
  ahead: { name: string; rank: number; gap: number } | null
  podium: T[]
}

export function standing<T extends Ranked>(rows: T[], value: (r: T) => number): Standing<T> | null {
  const me = rows.find((r) => r.me)
  if (!me) return null
  const before = rows.filter((r) => r.rank < me.rank)
  const next = before.reduce<T | null>((best, r) => (!best || r.rank > best.rank ? r : best), null)
  return {
    rank: me.rank,
    ahead: next && { name: next.name, rank: next.rank, gap: Math.max(0, value(next) - value(me)) },
    podium: rows.filter((r) => r.rank <= 3).sort((a, b) => a.rank - b.rank).slice(0, 3),
  }
}
