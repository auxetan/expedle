import { geoAzimuthalEquidistant, geoCentroid, geoDistance, geoGraticule, geoMercator, geoPath, type GeoProjection } from 'd3-geo'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom'
import type { Feature, FeatureCollection, MultiPolygon } from 'geojson'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Atlas } from '../../geo/atlas'

export interface Layer {
  code: string
  fill: string
}

export type ProjectionKind = 'azimutale' | 'mercator'

interface Props {
  atlas: Atlas
  layers: Layer[]
  focus: string[]
  outlines: string[]
  showAll: boolean
  initials: boolean
  projection: ProjectionKind
  // noms visibles au survol (mode difficile : aucun)
  named: Set<string>
}

interface View {
  rotate: [number, number]
  scale: number
  translate: [number, number]
}

const RATIO = 0.74
const PAD = 28

const fitCache = new Map<string, Feature<MultiPolygon>>()
function fitFeature(atlas: Atlas, code: string): Feature<MultiPolygon> {
  const key = atlas.id + code
  const cached = fitCache.get(key)
  if (cached) return cached
  const parts = atlas.parts.filter((p) => p.code === code)
  const max = Math.max(...parts.map((p) => p.area))
  const f: Feature<MultiPolygon> = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'MultiPolygon',
      coordinates: parts.filter((p) => p.area >= max * 0.25).map((p) => p.feature.geometry.coordinates),
    },
  }
  fitCache.set(key, f)
  return f
}

const anchorCache = new Map<string, { c: [number, number]; r: number }>()
function anchor(atlas: Atlas, code: string) {
  const key = atlas.id + code
  const cached = anchorCache.get(key)
  if (cached) return cached
  const parts = atlas.parts.filter((p) => p.code === code)
  const main = parts.reduce((a, b) => (b.area > a.area ? b : a))
  let r = 0
  for (const ring of main.feature.geometry.coordinates)
    for (const pt of ring) r = Math.max(r, geoDistance(main.centroid, pt as [number, number]))
  const v = { c: main.centroid, r }
  anchorCache.set(key, v)
  return v
}

function baseProjection(kind: ProjectionKind): GeoProjection {
  return kind === 'mercator' ? geoMercator() : geoAzimuthalEquidistant()
}

// focus[0] et focus[1] = départ et arrivée ; un essai très lointain ne déplace pas la caméra.
function computeView(atlas: Atlas, kind: ProjectionKind, focus: string[], w: number, h: number): View {
  const [a, b] = [anchor(atlas, focus[0]).c, anchor(atlas, focus[1]).c]
  const mid = geoCentroid({ type: 'MultiPoint', coordinates: [a, b] })
  const reach = Math.max(0.6, 1.3 * geoDistance(a, b))
  const kept = focus.filter((c, i) => i < 2 || geoDistance(mid, anchor(atlas, c).c) < reach)
  const fc: FeatureCollection<MultiPolygon> = { type: 'FeatureCollection', features: kept.map((c) => fitFeature(atlas, c)) }
  const [lon, lat] = geoCentroid(fc)
  const rotate: [number, number] = kind === 'mercator' ? [-lon, 0] : [-lon, -lat]
  const p = baseProjection(kind)
    .rotate(rotate)
    .fitExtent(
      [
        [PAD, PAD],
        [w - PAD, h - PAD],
      ],
      fc,
    )
  const maxScale = Math.min(w, h) / 0.09
  if (p.scale() > maxScale) {
    const q = baseProjection(kind).rotate(rotate).scale(maxScale).translate([w / 2, h / 2])
    const c = q([lon, lat])!
    return { rotate, scale: maxScale, translate: [w - c[0], h - c[1]] }
  }
  return { rotate, scale: p.scale(), translate: p.translate() as [number, number] }
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

export default function RouteMap({ atlas, layers, focus, outlines, showAll, initials, projection: kind, named }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const [width, setWidth] = useState(640)
  const height = Math.round(width * RATIO)
  const [zt, setZt] = useState<ZoomTransform>(zoomIdentity)
  const [settled, setSettled] = useState<ZoomTransform>(zoomIdentity)
  const [tip, setTip] = useState<{ code: string; x: number; y: number } | null>(null)
  const dragging = useRef(false)

  useLayoutEffect(() => {
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    ro.observe(wrapRef.current!)
    return () => ro.disconnect()
  }, [])

  const focusKey = focus.join(',')
  const target = useMemo(() => computeView(atlas, kind, focusKey.split(','), width, height), [atlas, kind, focusKey, width, height])
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
      .scaleExtent([0.4, 40])
      .on('start', () => {
        dragging.current = true
        setTip(null)
      })
      .on('zoom', (e) => setZt(e.transform))
      .on('end', (e) => {
        dragging.current = false
        setSettled(e.transform)
      })
    zoomRef.current = z
    select(svg).call(z)
    return () => {
      select(svg).on('.zoom', null)
    }
  }, [])

  const proj = useMemo(
    () => baseProjection(kind).rotate(view.rotate).scale(view.scale).translate(view.translate).precision(0.4),
    [kind, view],
  )
  const path = useMemo(() => geoPath(proj), [proj])

  // pays visibles dans la fenêtre actuelle (après déplacement et zoom)
  const inView = useMemo(() => {
    if (!showAll && !initials) return []
    const center = proj.invert?.([(width / 2 - settled.x) / settled.k, (height / 2 - settled.y) / settled.k]) ?? [
      -view.rotate[0],
      -view.rotate[1],
    ]
    const radius = Math.hypot(width, height) / 2 / (view.scale * settled.k)
    return atlas.codes.filter((c) => {
      const a = anchor(atlas, c)
      return geoDistance(center as [number, number], a.c) - a.r < radius * 1.2 + 0.05
    })
  }, [showAll, initials, proj, settled, width, height, view, atlas])

  const base = useMemo(
    () => (showAll ? inView.map((c) => ({ c, d: path(atlas.features.get(c)!) ?? '' })) : []),
    [showAll, inView, path, atlas],
  )
  const drawn = useMemo(() => layers.map((l) => ({ ...l, d: path(atlas.features.get(l.code)!) ?? '' })), [layers, path, atlas])
  const outlinePaths = useMemo(() => outlines.map((c) => ({ c, d: path(atlas.features.get(c)!) ?? '' })), [outlines, path, atlas])
  const grat = useMemo(() => path(graticule) ?? '', [path])

  const labels = initials
    ? inView
        .map((c) => {
          const p = proj(anchor(atlas, c).c)
          return p ? { c, x: p[0] * zt.k + zt.x, y: p[1] * zt.k + zt.y } : null
        })
        .filter((l): l is { c: string; x: number; y: number } => !!l && l.x > 0 && l.x < width && l.y > 0 && l.y < height)
    : []

  const moved = zt.k !== 1 || zt.x !== 0 || zt.y !== 0

  function zoomBy(k: number) {
    if (svgRef.current && zoomRef.current) select(svgRef.current).call(zoomRef.current.scaleBy, k, [width / 2, height / 2])
  }

  function recenter() {
    const svg = svgRef.current
    const z = zoomRef.current
    if (!svg || !z) return
    const from = zt
    const t0 = performance.now()
    const step = (now: number) => {
      const t = ease(Math.min(1, (now - t0) / 450))
      const k = from.k + (1 - from.k) * t
      select(svg).call(z.transform, zoomIdentity.translate(from.x * (1 - t), from.y * (1 - t)).scale(k))
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (dragging.current) return
    const code = (e.target as Element).closest('[data-code]')?.getAttribute('data-code')
    if (!code || !named.has(code)) return setTip(null)
    const r = wrapRef.current!.getBoundingClientRect()
    setTip({ code, x: e.clientX - r.left, y: e.clientY - r.top })
  }

  return (
    <div className="rm-wrap" ref={wrapRef} onPointerMove={onPointerMove} onPointerLeave={() => setTip(null)}>
      <svg ref={svgRef} width={width} height={height} className="rm-svg">
        <g transform={zt.toString()}>
          <path d={grat} className="rm-grat" />
          {base.map(({ c, d }) => (
            <path key={'b' + c} d={d} className="rm-base" />
          ))}
          {outlinePaths.map(({ c, d }) => (
            <path key={'o' + c} d={d} className="rm-outline" />
          ))}
          {drawn.map(({ code, fill, d }) => (
            <path key={code} data-code={code} d={d} fill={fill} className="rm-country" />
          ))}
        </g>
        {labels.map((l) => (
          <text key={l.c} x={l.x} y={l.y} className="rm-label" textAnchor="middle" dominantBaseline="middle">
            {atlas.name(l.c).replace(/^(Îles?|La|Le|Les)\s+/i, '').charAt(0)}
          </text>
        ))}
        <text x={10} y={height - 14} className="rm-watermark">
          itinéraire
        </text>
      </svg>
      {tip && (
        <div className="rm-tip" style={{ left: tip.x, top: tip.y }}>
          {atlas.name(tip.code)}
        </div>
      )}
      <div className="rm-controls">
        <div className="rm-zoom">
          <button onClick={() => zoomBy(1.6)} aria-label="Zoomer">
            +
          </button>
          <button onClick={() => zoomBy(1 / 1.6)} aria-label="Dézoomer">
            −
          </button>
        </div>
        {moved && (
          <button className="rm-recenter" onClick={recenter} aria-label="Recentrer la carte" title="Recentrer">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M20 12a8 8 0 1 1-2.3-5.6" />
              <path d="M20 4v5h-5" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
