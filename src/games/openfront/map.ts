import { geoEquirectangular, geoPath } from 'd3-geo'
import { getWorld } from '../../geo/world'
import type { MapGrid } from './engine'

// Le monde en cases, de 80° nord à 58° sud : l'Antarctique reste hors jeu.
const NORTH = 80
const SOUTH = -58
export const MAP_W = 640
export const MAP_H = Math.round((MAP_W * (NORTH - SOUTH)) / 360)

export interface Seat {
  code: string
  // la case la plus centrale du pays, où son armée démarre
  cell: number
  size: number
}

export interface WorldMap extends MapGrid {
  seats: Seat[]
}

let cached: WorldMap | null = null

// Chaque pays est peint d'une couleur qui porte son numéro, puis relu case par case.
export function worldMap(): WorldMap {
  if (cached) return cached
  const w = MAP_W
  const h = MAP_H
  const k = w / (2 * Math.PI)
  const projection = geoEquirectangular()
    .scale(k)
    .translate([w / 2, (k * NORTH * Math.PI) / 180])
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const path = geoPath(projection, ctx)
  const { features } = getWorld()
  const codes = [...features.keys()]
  codes.forEach((code, i) => {
    ctx.fillStyle = `rgb(${(i + 1) & 255}, ${(i + 1) >> 8}, 0)`
    ctx.beginPath()
    path(features.get(code)!)
    ctx.fill()
  })
  const px = ctx.getImageData(0, 0, w, h).data
  const land = new Uint8Array(w * h)
  const country = new Int16Array(w * h).fill(-1)
  const sum = codes.map(() => ({ x: 0, y: 0, n: 0 }))
  for (let i = 0; i < w * h; i++) {
    if (px[i * 4 + 3] < 128) continue
    land[i] = 1
    // les bords anticrénelés mélangent deux pays : on ne garde que les couleurs franches
    const id = px[i * 4] + px[i * 4 + 1] * 256 - 1
    if (px[i * 4 + 3] < 255 || id < 0 || id >= codes.length) continue
    country[i] = id
    sum[id].x += i % w
    sum[id].y += Math.floor(i / w)
    sum[id].n++
  }
  const best = codes.map(() => ({ cell: -1, d: Infinity }))
  for (let i = 0; i < w * h; i++) {
    const id = country[i]
    if (id < 0) continue
    const s = sum[id]
    const d = (i % w - s.x / s.n) ** 2 + (Math.floor(i / w) - s.y / s.n) ** 2
    if (d < best[id].d) best[id] = { cell: i, d }
  }
  const seats = codes.map((code, id) => ({ code, cell: best[id].cell, size: sum[id].n })).filter((s) => s.size >= 25)
  cached = { w, h, land, seats }
  return cached
}
