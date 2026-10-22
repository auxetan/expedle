import type { Game } from './engine'

const BIN = 25
// une case sur deux dans chaque sens suffit pour placer les noms, et coûte quatre fois moins
const STRIDE = 2

export interface Anchor {
  id: number
  x: number
  y: number
  // cases du morceau où se pose le nom, pour en régler la taille
  cells: number
}

// Où écrire le nom de chaque joueur : au centre du coin le plus dense de son territoire,
// pour qu'un débarquement lointain ne tire pas l'étiquette au milieu de la mer.
export function anchors(g: Game): Anchor[] {
  const bw = Math.ceil(g.w / BIN)
  const bh = Math.ceil(g.h / BIN)
  const n = g.players.length + 1
  const bins = new Int32Array(n * bw * bh)
  for (let y = 0; y < g.h; y += STRIDE)
    for (let x = 0; x < g.w; x += STRIDE) {
      const o = g.owner[y * g.w + x]
      if (o > 0) bins[(o * bh + Math.floor(y / BIN)) * bw + Math.floor(x / BIN)]++
    }
  const out: Anchor[] = []
  for (const p of g.players) {
    if (!p.alive || !p.tiles) continue
    let best = 0
    for (let b = 1; b < bw * bh; b++) if (bins[p.id * bw * bh + b] > bins[p.id * bw * bh + best]) best = b
    const bx = best % bw
    const by = Math.floor(best / bw)
    let sx = 0
    let sy = 0
    let cells = 0
    for (let y = Math.max(0, (by - 1) * BIN); y < Math.min(g.h, (by + 2) * BIN); y += STRIDE)
      for (let x = Math.max(0, (bx - 1) * BIN); x < Math.min(g.w, (bx + 2) * BIN); x += STRIDE)
        if (g.owner[y * g.w + x] === p.id) {
          sx += x
          sy += y
          cells++
        }
    // un territoire trop petit pour l'échantillonnage n'a pas la place d'afficher son nom
    if (cells) out.push({ id: p.id, x: sx / cells, y: sy / cells, cells: cells * STRIDE * STRIDE })
  }
  return out
}
