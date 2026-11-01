import { geoNaturalEarth1, geoPath } from 'd3-geo'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom'
import type { FeatureCollection, MultiPolygon } from 'geojson'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { COUNTRY_BY_CODE, countryName, flagEmoji } from '../geo/countries'
import { countryCenter } from '../geo/measure'
import { getWorld, type World } from '../geo/world'
import { askable } from '../games/revision/session'
import { fmt, plural, t } from '../lib/i18n'
import { NATIONS } from '../lib/passport'
import { due, FACET_LABELS, FACETS, mastery, savoir, type Facet, type Mastery } from '../lib/savoir'
import AppBar from '../ui/AppBar'
import { Icon, ICONS } from '../ui/Panels'
import './savoir.css'

const percent = (x: number) => fmt(x, { style: 'percent', maximumFractionDigits: 0 })

// les angles qui comptent pour un pays : ceux que la révision sait lui demander
const facetsOf = (world: World, code: string) => FACETS.filter((facet) => askable(world, { code, facet }))

// rien tant qu'on n'a pas rencontré le pays, puis une teinte de plus en plus franche à mesure qu'on le maîtrise
const tint = (level: number) => `color-mix(in oklab, var(--teal) ${Math.round(32 + 68 * level)}%, var(--sv-land))`

export default function Savoir() {
  const world = getWorld()
  const [book] = useState(savoir)
  const [now] = useState(Date.now)
  const [picked, setPicked] = useState<string | null>(null)
  const levels = useMemo(() => new Map(Object.keys(book).map((code) => [code, mastery(code, facetsOf(world, code), book)])), [world, book])
  const todo = useMemo(() => due(now, book), [now, book])
  const known = [...levels.values()].reduce((sum, m) => sum + m.overall, 0) / NATIONS.length

  useEffect(() => {
    if (!picked) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPicked(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [picked])

  return (
    <div className="home sv">
      <AppBar title={t('Ma carte du savoir')} />
      <main className="home-main sv-main">
        <section className="sv-hero">
          <h1>{t('Ma carte du savoir')}</h1>
          <p>{t('Chaque réponse de tes jeux de géographie colore la carte. Ce que tu rates revient vite en révision, ce que tu sais revient de plus en plus tard.')}</p>
          {levels.size > 0 ? (
            <div className="sv-go">
              <a href="#/revision" className="ui-btn">
                {t('Révision du jour')}
              </a>
              <span>
                {todo.length ? plural(todo.length, '{n} réponse à revoir aujourd’hui', '{n} réponses à revoir aujourd’hui') : t('Rien à revoir aujourd’hui')}
              </span>
            </div>
          ) : (
            <p className="sv-empty">{t('Ta carte est encore vierge. Joue à Worldle, Flagle, Globle, Travle, Seterra ou aux quiz Drapeaux et Capitales : chaque réponse la colore.')}</p>
          )}
        </section>

        <SavoirMap world={world} levels={levels} picked={picked} onPick={setPicked} />

        <div className="sv-legend">
          <span>
            <i className="sv-swatch" />
            {t('Pas encore vu')}
          </span>
          <span>
            {t('À travailler')}
            <i className="sv-ramp" />
            {t('Maîtrisé')}
          </span>
        </div>
        {levels.size > 0 && (
          <p className="sv-stats">
            {plural(levels.size, '{n} pays rencontré', '{n} pays rencontrés')} · {t('{n} du monde maîtrisé', { n: percent(known) })}
          </p>
        )}
      </main>

      {picked && (
        <Sheet
          code={picked}
          facets={facetsOf(world, picked)}
          level={levels.get(picked) ?? mastery(picked, facetsOf(world, picked), book)}
          todo={new Set(todo.filter((d) => d.code === picked).map((d) => d.facet))}
          onClose={() => setPicked(null)}
        />
      )}
    </div>
  )
}

interface MapProps {
  world: World
  levels: Map<string, Mastery>
  picked: string | null
  onPick: (code: string) => void
}

function SavoirMap({ world, levels, picked, onPick }: MapProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const [width, setWidth] = useState(900)
  // sur téléphone, la carte est plus haute que la bande des terres : de la place pour zoomer sur une région
  const height = Math.round(width * (width < 640 ? 0.72 : 0.5))
  const [zt, setZt] = useState<ZoomTransform>(zoomIdentity)

  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)))
    ro.observe(wrapRef.current!)
    return () => ro.disconnect()
  }, [])

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
    // la projection suit la taille de la carte : un zoom gardé d'avant enverrait le monde hors du cadre
    select(svg).call(z).call(z.transform, zoomIdentity)
    return () => {
      select(svg).on('.zoom', null)
    }
  }, [width, height])

  const shapes = useMemo(() => {
    const land = world.codes.filter((c) => c !== 'AQ')
    const all: FeatureCollection<MultiPolygon> = { type: 'FeatureCollection', features: land.map((c) => world.features.get(c)!) }
    const projection = geoNaturalEarth1()
      .rotate([-10, 0])
      .fitExtent(
        [
          [6, 6],
          [width - 6, height - 6],
        ],
        all,
      )
    const path = geoPath(projection)
    return land.map((code) => {
      const f = world.features.get(code)!
      // un micro-État ne fait que quelques pixels : un point le rend touchable
      return { code, d: path(f) ?? '', dot: path.area(f) < 30 ? projection(countryCenter(world, code)) : null, nation: !COUNTRY_BY_CODE.get(code)?.territory }
    })
  }, [world, width, height])

  const fill = (code: string) => {
    const level = levels.get(code)
    return level ? tint(level.overall) : 'var(--sv-land)'
  }
  const zoomBy = (k: number) => svgRef.current && zoomRef.current && select(svgRef.current).call(zoomRef.current.scaleBy, k)
  const outline = shapes.find((s) => s.code === picked)

  return (
    <div className="sv-map" ref={wrapRef}>
      <svg ref={svgRef} width={width} height={height} role="img" aria-label={t('Carte du monde, chaque pays teinté selon ce que tu en sais')}>
        <g transform={zt.toString()}>
          {shapes.map(({ code, d, nation }) =>
            nation ? <path key={code} d={d} className="sv-land" style={{ fill: fill(code) }} onClick={() => onPick(code)} /> : <path key={code} d={d} className="sv-off" />,
          )}
          {shapes.map(
            ({ code, dot, nation }) =>
              nation && dot && <circle key={'c' + code} cx={dot[0]} cy={dot[1]} r={3 / Math.sqrt(zt.k)} className="sv-dot" style={{ fill: fill(code) }} onClick={() => onPick(code)} />,
          )}
          {outline && (outline.dot ? <circle cx={outline.dot[0]} cy={outline.dot[1]} r={3 / Math.sqrt(zt.k)} className="sv-picked" /> : <path d={outline.d} className="sv-picked" />)}
        </g>
      </svg>
      <div className="sv-zoom">
        <button onClick={() => zoomBy(1.6)} aria-label={t('Zoomer')}>
          +
        </button>
        <button onClick={() => zoomBy(1 / 1.6)} aria-label={t('Dézoomer')}>
          −
        </button>
      </div>
    </div>
  )
}

interface SheetProps {
  code: string
  facets: Facet[]
  level: Mastery
  todo: Set<Facet>
  onClose: () => void
}

// Ce que le joueur sait d'un pays, angle par angle.
function Sheet({ code, facets, level, todo, onClose }: SheetProps) {
  return (
    <section className="sv-sheet" role="dialog" aria-labelledby="sv-sheet-name">
      <header>
        <span className="sv-sheet-flag" aria-hidden>
          {flagEmoji(code)}
        </span>
        <h2 id="sv-sheet-name">{countryName(code)}</h2>
        <b>{percent(level.overall)}</b>
        <button className="ui-tool" onClick={onClose} aria-label={t('Fermer')}>
          <Icon d={ICONS.close} />
        </button>
      </header>
      <ul>
        {facets.map((f) => {
          const value = level.by[f]
          return (
            <li key={f}>
              <span>{t(FACET_LABELS[f])}</span>
              <i className="sv-bar">
                <i style={{ width: `${(value ?? 0) * 100}%` }} />
              </i>
              <small>
                {todo.has(f) && <em>{t('À revoir')}</em>}
                {value === null ? t('Pas encore vu') : percent(value)}
              </small>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
