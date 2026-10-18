export const MISSING_RANK = 100

export function rankBy(
  entries: { id: string; value: number }[],
  dir: 'desc' | 'asc',
  valid: (v: number) => boolean = (v) => v > 0,
): Map<string, number> {
  const list = entries.filter((e) => Number.isFinite(e.value) && valid(e.value))
  list.sort((a, b) => (dir === 'desc' ? b.value - a.value : a.value - b.value))
  const out = new Map<string, number>()
  list.forEach((e, i) => {
    const prev = list[i - 1]
    out.set(e.id, prev && prev.value === e.value ? out.get(prev.id)! : i + 1)
  })
  return out
}

export function rankFromList(list: string): Map<string, number> {
  return new Map(list.split(' ').map((code, i) => [code, i + 1]))
}

// matrix[entité][catégorie] ; perm[entité] = catégorie attribuée
export function optimalAssignment(matrix: number[][]): { total: number; perm: number[] } {
  const n = matrix.length
  let best = { total: Infinity, perm: [] as number[] }
  const perm: number[] = []
  const used = new Array<boolean>(n).fill(false)
  const go = (row: number, sum: number) => {
    if (sum >= best.total) return
    if (row === n) {
      best = { total: sum, perm: perm.slice() }
      return
    }
    for (let c = 0; c < n; c++) {
      if (used[c]) continue
      used[c] = true
      perm[row] = c
      go(row + 1, sum + matrix[row][c])
      used[c] = false
    }
  }
  go(0, 0)
  return best
}

export function averageTotal(matrix: number[][]): number {
  const n = matrix.length
  let sum = 0
  for (const row of matrix) for (const v of row) sum += v
  return sum / n
}
