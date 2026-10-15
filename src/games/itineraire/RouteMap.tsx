import { geoAzimuthalEquidistant, geoCentroid, geoDistance, geoGraticule, geoPath } from 'd3-geo'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom'
import type { Feature, FeatureCollection, MultiPolygon } from 'geojson'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { countryName } from '../../geo/countries'
import { getWorld } from '../../geo/world'

export interface Layer {
  code: string
  fill: string
}

interface Props {
  layers: Layer[]
  focus: string[]
  outlines: string[]
  showAll: boolean
  initials: boolean
}

interface View {
  rotate: [number, number]
  scale: number
  translate: [number, number]
}

const RATIO = 0.74
const PAD = 28

// Pour cadrer la vue, on ignore les petites îles lointaines (Alaska, Svalbard…).
const fitCache = new Map<string, Feature<MultiPolygon>>()
function fitFeature(code: string): Feature<MultiPolygon> {
  const cached = fitCache.get(code)
  if (cached) return cached
  const parts = getWorld().parts.filter((p) => p.code === code)
  const max = Math.max(...parts.map((p) => p.area))
  const f: Feature<MultiPolygon> = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'MultiPolygon',
      coordinates: parts.filter((p) => p.area >= max * 0.25).map((p) => p.feature.geometry.coordinates),
    },
  }
  fitCache.set(code, f)
  return f
}

const anchorCache = new Map<string, { c: [number, number]; r: number }>()
function anchor(code: string) {
  const cached = anchorCache.get(code)
  if (cached) return cached
  const parts = getWorld().parts.filter((p) => p.code === code)
  const main = parts.reduce((a, b) => (b.area > a.area ? b : a))
  const c = main.centroid
  let r = 0
  for (const ring of main.feature.geometry.coordinates)
    for (const pt of ring) r = Math.max(r, geoDistance(c, pt as [number, number]))
  const v = { c, r }
  anchorCache.set(code, v)
  return v
}

// focus[0] et focus[1] = départ et arrivée ; les essais trop lointains ne déplacent pas la caméra.
function computeView(focus: string[], w: number, h: number): View {
  const [a, b] = [anchor(focus[0]).c, anchor(focus[1]).c]
  const mid = geoCentroid({ type: 'MultiPoint', coordinates: [a, b] })
  const reach = Math.max(0.6, 1.3 * geoDistance(a, b))
  const kept = focus.filter((c, i) => i < 2 || geoDistance(mid, anchor(c).c) < reach)
  const fc: FeatureCollection<MultiPolygon> = { type: 'FeatureCollection', features: kept.map(fitFeature) }
  const [lon, lat] = geoCentroid(fc)
  const p = geoAzimuthalEquidistant()
    .rotate([-lon, -lat])
    .fitExtent(
      [
        [PAD, PAD],
        [w - PAD, h - PAD],
      ],
      fc,
    )
  const maxScale = Math.min(w, h) / 0.09
  if (p.scale() > maxScale) return { rotate: [-lon, -lat], scale: maxScale, translate: [w / 2, h / 2] }
  return { rotate: [-lon, -lat], scale: p.scale(), translate: p.translate() as [number, number] }
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

function lerpView(a: View, b: View, t: number): View {
  let dl = b.rotate[0] - a.rotate[0]
  if (dl > 180) dl -= 360
  if (dl < -180) dl += 360
  return {
    rotate: [a.rotate[0] + dl * t, a.rotate[1] + (b.rotate[1] - a.rotate[1]) * t],
    scale: Math.exp(Math.log(a.scale) + (Math.log(b.scale) - Math.log(a.scale)) * t),
    translate: [a.translate[0] + (b.translate[0] - a.translate[0]) * t, a.translate[1] + (b.translate[1] - a.translate[1]) * t],
  }
}

const graticule = geoGraticule().step([15, 15])()

export default function RouteMap({ layers, focus, outlines, showAll, initials }: Props) {
  const world = getWorld()
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const [width, setWidth] = useState(640)
  const height = Math.round(width * RATIO)
  const [zt, setZt] = useState<ZoomTransform>(zoomIdentity)

  useLayoutEffect(() => {
    const el = wrapRef.current!
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const focusKey = focus.join(',')
  const target = useMemo(() => computeView(focusKey.split(','), width, height), [focusKey, width, height])
  const [view, setView] = useState<View>(target)
  const viewRef = useRef(view)
  viewRef.current = view

  useEffect(() => {
    const from = viewRef.current
    const t0 = performance.now()
    let raf = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 750)
      setView(lerpView(from, target, ease(t)))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    if (svgRef.current && zoomRef.current) select(svgRef.current).call(zoomRef.current.transform, zoomIdentity)
    return () => cancelAnimationFrame(raf)
  }, [target])

  useEffect(() => {
    const svg = svgRef.current!
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 16])
      .translateExtent([
        [0, 0],
        [width, height],
      ])
      .on('zoom', (e) => setZt(e.transform))
    zoomRef.current = z
    select(svg).call(z)
    return () => {
      select(svg).on('.zoom', null)
    }
  }, [width, height])

  const projection = useMemo(
    () =>
      geoAzimuthalEquidistant()
        .rotate(view.rotate)
        .scale(view.scale)
        .translate(view.translate)
        .clipExtent([
          [-40, -40],
          [width + 40, height + 40],
        ])
        .precision(0.4),
    [view, width, height],
  )
  const path = useMemo(() => geoPath(projection), [projection])

  const inView = useMemo(() => {
    if (!showAll && !initials) return []
    const center: [number, number] = [-view.rotate[0], -view.rotate[1]]
    const radius = Math.hypot(width, height) / 2 / view.scale
    return world.codes.filter((c) => {
      const a = anchor(c)
      return geoDistance(center, a.c) - a.r < radius * 1.15
    })
  }, [showAll, initials, view, width, height, world])

  const base = useMemo(
    () => (showAll ? inView.map((c) => ({ c, d: path(world.features.get(c)!) ?? '' })) : []),
    [showAll, inView, path, world],
  )
  const drawn = useMemo(
    () => layers.map((l) => ({ ...l, d: path(world.features.get(l.code)!) ?? '' })),
    [layers, path, world],
  )
  const outlinePaths = useMemo(
    () => outlines.map((c) => ({ c, d: path(world.features.get(c)!) ?? '' })),
    [outlines, path, world],
  )
  const grat = useMemo(() => path(graticule) ?? '', [path])

  const labels = initials
    ? inView
        .map((c) => {
          const p = projection(anchor(c).c)
          return p ? { c, x: p[0] * zt.k + zt.x, y: p[1] * zt.k + zt.y } : null
        })
        .filter((l): l is { c: string; x: number; y: number } => !!l && l.x > 0 && l.x < width && l.y > 0 && l.y < height)
    : []

  const zoomBy = (k: number) => {
    if (svgRef.current && zoomRef.current) select(svgRef.current).call(zoomRef.current.scaleBy, k)
  }

  return (
    <div className="rm-wrap" ref={wrapRef}>
      <svg ref={svgRef} width={width} height={height} className="rm-svg">
        <g transform={zt.toString()}>
          <path d={grat} className="rm-grat" />
          {base.map(({ c, d }) => (
            <path key={'b' + c} d={d} className="rm-base" />
          ))}
          {drawn.map(({ code, fill, d }) => (
            <path key={code} d={d} fill={fill} className="rm-country" />
          ))}
          {outlinePaths.map(({ c, d }) => (
            <path key={'o' + c} d={d} className="rm-outline" />
          ))}
        </g>
        {labels.map((l) => (
          <text key={l.c} x={l.x} y={l.y} className="rm-label" textAnchor="middle" dominantBaseline="middle">
            {countryName(l.c).replace(/^(Îles?|La|Le|Les)\s+/i, '').charAt(0)}
          </text>
        ))}
        <text x={10} y={height - 14} className="rm-watermark">
          itinéraire
        </text>
      </svg>
      <div className="rm-zoom">
        <button onClick={() => zoomBy(1.6)} aria-label="Zoomer">
          +
        </button>
        <button onClick={() => zoomBy(1 / 1.6)} aria-label="Dézoomer">
          −
        </button>
      </div>
    </div>
  )
}
