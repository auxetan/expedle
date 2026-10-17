import { geoCentroid, geoDistance, geoGraticule, geoOrthographic, geoPath } from 'd3-geo'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { countryCenter, simplifiedFeatures } from '../../geo/measure'
import { getWorld } from '../../geo/world'
import { cssColor, useTheme } from '../../ui/theme'
import './globe.css'
import { t } from '../../lib/i18n'

interface Props {
  // couleur de remplissage par pays ; les autres restent couleur terre
  fills: Map<string, string>
  // pays vers lequel le globe pivote quand il change
  focus?: string | null
  highlight?: string | null
  maxSize?: number
  // grossissement de départ : 2 pour voir de près le pays révélé
  initialZoom?: number
}

const graticule = geoGraticule().step([20, 20])()

// Terres nettement plus claires que l'océan dans les deux thèmes ; les frontières reprennent la couleur de l'océan.
const PALETTE = {
  sombre: { ocean: '#161514', land: '#47443e', grid: '#24221f' },
  clair: { ocean: '#e6dfd2', land: '#fbf8f2', grid: '#d8d0c2' },
}

// Pour chaque pays, son centre et son rayon angulaire : de quoi sauter d'un coup ceux de la face cachée.
const cullCache = new Map<string, { center: [number, number]; radius: number }>()
function cullInfo(code: string, feature: GeoJSON.Feature<GeoJSON.MultiPolygon>) {
  let c = cullCache.get(code)
  if (!c) {
    const center = geoCentroid(feature) as [number, number]
    const radius = Math.max(...(feature.geometry.coordinates.flat(2) as [number, number][]).map((p) => geoDistance(center, p)))
    cullCache.set(code, (c = { center, radius }))
  }
  return c
}

// Globe orthographique sur canvas. En mouvement, contours allégés et face cachée ignorée ; au repos, le détail complet.
export default function GlobeView({ fills, focus, highlight, maxSize = 560, initialZoom = 1 }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState(320)
  const rot = useRef<[number, number]>([-10, -25])
  const zoom = useRef(initialZoom)
  const frame = useRef(0)
  const theme = useTheme()
  const props = useRef({ fills, highlight })
  const world = getWorld()

  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setSize(Math.min(maxSize, Math.round(e.contentRect.width))))
    ro.observe(wrap.current!)
    return () => ro.disconnect()
  }, [maxSize])

  const drawRef = useRef((detail: boolean) => void detail)
  const idle = useRef(0)
  useEffect(() => {
    const { ocean, land, grid } = PALETTE[theme]
    const strong = cssColor('--fg')
    const lite = simplifiedFeatures(world)
    drawRef.current = (detail: boolean) => {
      const c = canvas.current
      if (!c) return
      const dpr = window.devicePixelRatio || 1
      if (c.width !== size * dpr) {
        c.width = c.height = size * dpr
      }
      const ctx = c.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size, size)
      const projection = geoOrthographic()
        .rotate(rot.current)
        .translate([size / 2, size / 2])
        .scale((size / 2 - 4) * zoom.current)
        .clipAngle(90)
      const path = geoPath(projection, ctx)
      ctx.beginPath()
      path({ type: 'Sphere' })
      ctx.fillStyle = ocean
      ctx.fill()
      ctx.beginPath()
      path(graticule)
      ctx.strokeStyle = grid
      ctx.lineWidth = 0.5
      ctx.stroke()
      const { fills: f, highlight: h } = props.current
      const view: [number, number] = [-rot.current[0], -rot.current[1]]
      // zoomé, seule une calotte est à l'écran : peu de pays à dessiner, on garde donc le détail complet
      const reach = Math.asin(Math.min(1, size / 2 / projection.scale()))
      const shapes = detail || zoom.current >= 2.5 ? world.features : lite
      const colored: [string, GeoJSON.Feature<GeoJSON.MultiPolygon>][] = []
      // toutes les terres neutres en un seul tracé, puis les pays colorés par-dessus
      ctx.beginPath()
      for (const [code, feature] of shapes) {
        const { center, radius } = cullInfo(code, lite.get(code)!)
        if (geoDistance(view, center) - radius > reach + 0.02) continue
        if (f.has(code)) colored.push([code, feature])
        else path(feature)
      }
      ctx.fillStyle = land
      ctx.fill()
      ctx.strokeStyle = ocean
      ctx.lineWidth = 0.6
      ctx.stroke()
      for (const [code, feature] of colored) {
        ctx.beginPath()
        path(feature)
        ctx.fillStyle = f.get(code)!
        ctx.fill()
        ctx.stroke()
      }
      if (h && shapes.has(h)) {
        ctx.beginPath()
        path(shapes.get(h)!)
        ctx.strokeStyle = strong
        ctx.lineWidth = 1.6
        ctx.stroke()
      }
      ctx.beginPath()
      path({ type: 'Sphere' })
      ctx.strokeStyle = grid
      ctx.lineWidth = 1
      ctx.stroke()
    }
    drawRef.current(true)
  }, [size, theme, world])

  useEffect(() => {
    props.current = { fills, highlight }
    drawRef.current(true)
  }, [fills, highlight])

  // pendant un mouvement : version allégée à chaque image, puis le détail complet 150 ms après l'arrêt
  const movingRef = useRef(() => {})
  useEffect(() => {
    movingRef.current = () => {
      cancelAnimationFrame(frame.current)
      frame.current = requestAnimationFrame(() => drawRef.current(false))
      clearTimeout(idle.current)
      idle.current = window.setTimeout(() => drawRef.current(true), 150)
    }
  })

  // pivot animé vers le pays demandé, par le plus court chemin en longitude
  useEffect(() => {
    if (!focus || !world.features.has(focus)) return
    const [lon, lat] = countryCenter(world, focus)
    const [l0, p0] = rot.current
    let dl = (-lon - l0) % 360
    if (dl > 180) dl -= 360
    if (dl < -180) dl += 360
    const target: [number, number] = [l0 + dl, -lat * 0.8]
    const t0 = performance.now()
    cancelAnimationFrame(frame.current)
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 900)
      const e = 1 - (1 - k) ** 3
      rot.current = [l0 + (target[0] - l0) * e, p0 + (target[1] - p0) * e]
      drawRef.current(k >= 1)
      if (k < 1) frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame.current)
  }, [focus, world])

  useEffect(() => {
    const c = canvas.current!
    const pointers = new Map<number, { x: number; y: number }>()
    let pinch = 0
    const redraw = () => movingRef.current()
    const down = (e: PointerEvent) => {
      c.setPointerCapture(e.pointerId)
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinch = Math.hypot(a.x - b.x, a.y - b.y)
      }
    }
    const move = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId)
      if (!prev) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinch) zoom.current = Math.min(6, Math.max(0.9, zoom.current * (d / pinch)))
        pinch = d
      } else {
        const speed = 0.3 / zoom.current
        const [l, p] = rot.current
        rot.current = [l + (e.clientX - prev.x) * speed, Math.max(-88, Math.min(88, p - (e.clientY - prev.y) * speed))]
      }
      redraw()
    }
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      pinch = 0
    }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      zoom.current = Math.min(6, Math.max(0.9, zoom.current * Math.exp(-e.deltaY * 0.0015)))
      redraw()
    }
    c.addEventListener('pointerdown', down)
    c.addEventListener('pointermove', move)
    c.addEventListener('pointerup', up)
    c.addEventListener('pointercancel', up)
    c.addEventListener('wheel', wheel, { passive: false })
    return () => {
      clearTimeout(idle.current)
      c.removeEventListener('pointerdown', down)
      c.removeEventListener('pointermove', move)
      c.removeEventListener('pointerup', up)
      c.removeEventListener('pointercancel', up)
      c.removeEventListener('wheel', wheel)
    }
  }, [])

  return (
    <div className="globe" ref={wrap}>
      <canvas ref={canvas} style={{ width: size, height: size }} aria-label={t('Globe : fais-le tourner pour explorer')} />
    </div>
  )
}
