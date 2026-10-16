import type { World } from '../../geo/world'
import { seededRng } from '../../lib/util'
import { targets } from '../worldle/game'

export function dailyTarget(world: World, day: string): string {
  const list = targets(world)
  return list[Math.floor(seededRng('globle-' + day)() * list.length)]
}

// Du rouge brique (frontière commune) au crème (l'autre bout du monde), comme la chaleur de Globle.
const STOPS: [number, [number, number, number]][] = [
  [0, [158, 42, 28]],
  [0.04, [200, 70, 46]],
  [0.13, [224, 118, 63]],
  [0.3, [235, 163, 90]],
  [0.55, [241, 205, 140]],
  [1, [246, 236, 214]],
]
export const FAR_KM = 15000

export function heat(km: number): string {
  const t = Math.min(1, Math.max(0, km / FAR_KM))
  const i = STOPS.findIndex(([at]) => at >= t)
  const [t1, c1] = STOPS[Math.max(0, i - 1)]
  const [t2, c2] = STOPS[i]
  const k = t2 === t1 ? 0 : (t - t1) / (t2 - t1)
  return '#' + c1.map((v, j) => Math.round(v + (c2[j] - v) * k).toString(16).padStart(2, '0')).join('')
}
