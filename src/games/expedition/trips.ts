// Les expéditions passées, gardées pour la carte du monde de chacun (Carnet.tsx).
import { load, save } from '../../lib/util'

export interface Trip {
  day: string
  start: string
  // vide pour un Tour du monde
  end: string
  path: string[]
  arrived: boolean
  tour: boolean
  at: number
}

export const loadTrips = () => load<Trip[]>('expeditions', [])

export function saveTrip(trip: Trip) {
  save('expeditions', [...loadTrips(), trip].slice(-500))
}
