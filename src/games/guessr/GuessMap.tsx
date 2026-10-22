import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { cssColor, useTheme } from '../../ui/theme'
import { t } from '../../lib/i18n'

export type LatLng = [number, number]

export interface Pair {
  guess: LatLng | null
  truth: LatLng
}

interface Props {
  view: { center: LatLng; zoom: number }
  guess?: LatLng | null
  onGuess?: (p: LatLng) => void
  // manches révélées : réponse, essai et le trait qui les relie
  pairs?: Pair[]
}

// Tuiles OpenStreetMap, sans clé ; la teinte Expedle vient d'un filtre CSS selon le thème.
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

// Carte Leaflet pilotée à la main : React ne gère que le conteneur, Leaflet le reste.
export default function GuessMap({ view, guess = null, onGuess, pairs = [] }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const onGuessRef = useRef(onGuess)
  const theme = useTheme()

  useEffect(() => {
    onGuessRef.current = onGuess
  })

  useEffect(() => {
    const m = L.map(el.current!, { worldCopyJump: true, minZoom: 1, zoomSnap: 0.5, zoomControl: true }).setView(view.center, view.zoom)
    m.attributionControl.setPrefix('Leaflet')
    L.tileLayer(TILES, {
      maxZoom: 19,
      className: 'wg-tiles',
      attribution: `© <a href="https://www.openstreetmap.org/copyright">${t('contributeurs OpenStreetMap')}</a>`,
    }).addTo(m)
    layer.current = L.layerGroup().addTo(m)
    m.on('click', (e: L.LeafletMouseEvent) => {
      const p = e.latlng.wrap()
      onGuessRef.current?.([p.lat, p.lng])
    })
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(el.current!)
    map.current = m
    return () => {
      ro.disconnect()
      m.remove()
      map.current = null
    }
    // la vue initiale ne sert qu'à la création ; ensuite le joueur se déplace librement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const g = layer.current!
    g.clearLayers()
    const fg = cssColor('--fg')
    const good = cssColor('--good')
    const muted = cssColor('--muted')
    const dot = (p: LatLng, color: string, radius: number) =>
      L.circleMarker(p, { radius, color: cssColor('--bg'), weight: 2, fillColor: color, fillOpacity: 1 }).addTo(g)
    if (!pairs.length) {
      if (guess) dot(guess, fg, 7)
      return
    }
    const points: LatLng[] = []
    for (const { guess: gp, truth } of pairs) {
      if (gp) {
        L.polyline([gp, truth], { color: muted, weight: 2, dashArray: '6 6' }).addTo(g)
        dot(gp, fg, 6)
        points.push(gp)
      }
      dot(truth, good, 8)
      points.push(truth)
    }
    map.current!.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 9 })
  }, [guess, pairs, theme])

  return <div className="wg-leaflet" ref={el} />
}
