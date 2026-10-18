import type { Spot } from './GuessGame'

// Panorama découpé en tuiles (format de l'adaptateur de Photo Sphere Viewer) : une image basse définition
// s'affiche d'abord, les tuiles nettes arrivent à mesure qu'on regarde autour.
export interface TiledPanorama {
  width: number
  cols: number
  rows: number
  baseUrl?: string
  tileUrl: (col: number, row: number) => string
}

export interface NodeLink {
  id: string
  lng: number
  lat: number
}

// Une vue 360° où l'on peut se tenir : sa position, le cap du centre de l'image et les vues voisines.
export interface SphereNode {
  id: string
  lng: number
  lat: number
  azimuth: number
  panorama: TiledPanorama
  links: NodeLink[]
}

export interface SphereSpot extends Spot {
  start: SphereNode
  heading: number
  date: string
  credit: string
  license: string
  page: string
}

// Une image équirectangulaire entière, vue comme une seule tuile.
export function wholeImage(url: string, width: number, preview?: string): TiledPanorama {
  return { width, cols: 1, rows: 1, baseUrl: preview, tileUrl: () => url }
}

export const isPowerOfTwo = (n: number) => n > 0 && (n & (n - 1)) === 0
