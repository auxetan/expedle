import { geoEqualEarth, geoPath } from 'd3-geo'
import { useMemo, useState } from 'react'
import { CONTINENT_NAMES, COUNTRY_BY_CODE, countryName, flagEmoji } from '../geo/countries'
import { getWorld } from '../geo/world'
import { fmt, locale, plural, t } from '../lib/i18n'
import { coverage, passport } from '../lib/passport'
import { hashString } from '../lib/util'
import AppBar from '../ui/AppBar'
import CountUp from '../ui/CountUp'
import GameIcon from '../ui/GameIcon'
import { gameIcon, gameInfo } from '../ui/gameInfo'
import { loadProfile } from '../ui/Panels'
import './passport.css'

const W = 960
const H = 470

// Les jeux qui remplissent le passeport, pour l'aider à démarrer.
const FILLERS = ['worldle', 'globle', 'countryle', 'flagle', 'dailygeo', 'cartographe', 'geoguessr']

function Ring({ value }: { value: number }) {
  const r = 52
  const c = 2 * Math.PI * r
  return (
    <svg className="pp-ring" viewBox="0 0 120 120" aria-hidden>
      <circle cx="60" cy="60" r={r} />
      <circle cx="60" cy="60" r={r} className="pp-ring-fill" style={{ strokeDasharray: `${c * value} ${c}` }} />
    </svg>
  )
}

function WorldMap({ stamped }: { stamped: Map<string, number> }) {
  const world = getWorld()
  const paths = useMemo(() => {
    const projection = geoEqualEarth().fitExtent(
      [
        [6, 6],
        [W - 6, H - 6],
      ],
      { type: 'Sphere' },
    )
    const path = geoPath(projection)
    return {
      sphere: path({ type: 'Sphere' }) ?? '',
      countries: [...world.features].filter(([code]) => code !== 'AQ').map(([code, f]) => ({ code, d: path(f) ?? '' })),
    }
  }, [world])
  const [hover, setHover] = useState<string | null>(null)

  return (
    <div className="pp-map">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('Carte des pays tamponnés')} onPointerLeave={() => setHover(null)}>
        <path d={paths.sphere} className="pp-ocean" />
        {paths.countries.map(({ code, d }) => {
          const n = stamped.get(code)
          return (
            <path
              key={code}
              d={d}
              className={n ? 'pp-land on' : 'pp-land'}
              style={n ? { fillOpacity: Math.min(1, 0.55 + 0.15 * n) } : undefined}
              onPointerEnter={() => setHover(code)}
            />
          )
        })}
      </svg>
      <p className="pp-map-label">
        {hover ? (
          <>
            {flagEmoji(hover)} {countryName(hover)} ·{' '}
            {stamped.get(hover) ? t('trouvé ×{n}', { n: stamped.get(hover)! }) : t('pas encore de tampon')}
          </>
        ) : (
          t('Survole un pays pour voir son tampon.')
        )}
      </p>
    </div>
  )
}

export default function Passport() {
  const [book] = useState(passport)
  const cover = coverage(book)
  const profile = loadProfile()
  const stamped = useMemo(() => new Map(Object.entries(book).map(([code, s]) => [code, s.n])), [book])
  const stamps = Object.entries(book)
    .filter(([code]) => COUNTRY_BY_CODE.has(code))
    .sort((a, b) => b[1].first - a[1].first)
  const weekAgo = Date.now() - 7 * 86400000
  const recent = stamps.filter(([, s]) => s.first >= weekAgo).length

  return (
    <div className="home">
      <AppBar title={t('Passeport')} />
      <main className="home-main pp-main">
        <section className="pp-cover">
          <div className="pp-cover-text">
            <span className="pp-kicker">{t('Passeport de {name}', { name: profile.name || t('voyageur') })}</span>
            <h1>
              <CountUp value={cover.stamped} /> <small>/ {cover.total}</small>
            </h1>
            <p>{t('pays tamponnés, en jouant à tous les jeux de Méridien')}</p>
            {recent > 0 && <p className="pp-recent">{plural(recent, '+{n} nouveau pays cette semaine', '+{n} nouveaux pays cette semaine')}</p>}
          </div>
          <div className="pp-ring-wrap">
            <Ring value={cover.stamped / cover.total} />
            <b>{fmt(cover.stamped / cover.total, { style: 'percent', maximumFractionDigits: 0 })}</b>
            <small>{t('du monde')}</small>
          </div>
        </section>

        <WorldMap stamped={stamped} />

        <section className="pp-continents stagger">
          {cover.byContinent.map((c) => (
            <div key={c.continent} className={c.stamped === c.total ? 'pp-continent done' : 'pp-continent'}>
              <span>{t(CONTINENT_NAMES[c.continent])}</span>
              <b>
                {c.stamped} <small>/ {c.total}</small>
              </b>
              <i style={{ width: `${(100 * c.stamped) / c.total}%` }} />
            </div>
          ))}
        </section>

        {stamps.length === 0 ? (
          <section className="pp-empty">
            <h2>{t('Ton passeport est encore vierge')}</h2>
            <p className="muted">{t('Chaque pays trouvé dans un jeu y laisse un tampon : une silhouette devinée, un drapeau reconnu, une rue bien située…')}</p>
            <div className="pp-fillers">
              {FILLERS.map((g) => (
                <a key={g} href={gameInfo(g).href}>
                  {gameIcon(g) && <GameIcon icon={gameIcon(g)!} size={30} />}
                  <span>{t(gameInfo(g).title)}</span>
                </a>
              ))}
            </div>
          </section>
        ) : (
          <section className="pp-stamps-wrap">
            <h2>{plural(stamps.length, '{n} tampon', '{n} tampons')}</h2>
            <ol className="pp-stamps stagger">
              {stamps.map(([code, s]) => (
                <li key={code} className="pp-stamp" style={{ '--tilt': `${(hashString(code) % 15) - 7}deg` } as React.CSSProperties}>
                  <span className="pp-stamp-flag">{flagEmoji(code)}</span>
                  <b>{countryName(code)}</b>
                  <small>{new Date(s.first).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: '2-digit' })}</small>
                  {s.n > 1 && <span className="pp-stamp-n">×{s.n}</span>}
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>
    </div>
  )
}
