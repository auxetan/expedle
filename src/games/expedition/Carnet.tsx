// Ma carte : toutes ses expéditions tracées sur un même planisphère, les pays traversés en couleur. Elle se remplit au
// fil des jours, comme un carnet de route.
import { geoEqualEarth, geoPath } from 'd3-geo'
import type { Atlas } from '../../geo/atlas'
import { flagEmoji } from '../../geo/countries'
import { countryCenter } from '../../geo/measure'
import { locale, plural, t } from '../../lib/i18n'
import { bestScore } from '../../lib/stats'
import AppBar, { SubLink } from '../../ui/AppBar'
import { loadTrips } from './trips'

const W = 960
const H = 470

export default function Carnet({ atlas }: { atlas: Atlas }) {
  const trips = loadTrips()
  const seen = new Set(trips.flatMap((x) => x.path))
  const projection = geoEqualEarth().fitExtent(
    [
      [8, 8],
      [W - 8, H - 8],
    ],
    { type: 'Sphere' },
  )
  const path = geoPath(projection)
  const line = (codes: string[]) =>
    codes
      .map((c) => projection(countryCenter(atlas, c)))
      .filter((p): p is [number, number] => !!p)
      .map((p) => p.join(','))
      .join(' ')
  const arrived = trips.filter((x) => !x.tour && x.arrived).length
  const best = bestScore('expedition-tour')

  return (
    <div className="ex">
      <AppBar title={t('L’Expédition')}>
        <SubLink href="#/expedition">{t('Du jour')}</SubLink>
        <SubLink href="#/expedition/tour">{t('Tour du monde')}</SubLink>
        <SubLink href="#/expedition/carte" active>
          {t('Ma carte')}
        </SubLink>
      </AppBar>
      <main className="ex-main">
        <header className="ex-head">
          <h1>{t('Ma carte du monde')}</h1>
          <p>
            {plural(seen.size, '{n} pays traversé', '{n} pays traversés')} · {plural(arrived, '{n} expédition réussie', '{n} expéditions réussies')}
            {best !== null && ` · ${t('Tour du monde : record de {n} pays', { n: best })}`}
          </p>
        </header>
        <div className="ex-world">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('Carte de tes expéditions')}>
            <path className="sphere" d={path({ type: 'Sphere' }) ?? ''} />
            {[...atlas.features].map(([code, f]) => (
              <path key={code} d={path(f) ?? ''} className={seen.has(code) ? 'seen' : ''} />
            ))}
            {trips.map((x) => (
              <polyline key={x.at} className={x.tour ? 'tour' : x.arrived ? 'done' : 'stuck'} points={line(x.path)} />
            ))}
          </svg>
        </div>
        {trips.length === 0 ? (
          <p className="ex-empty">
            {t('Ta carte est vierge : chaque expédition y laissera sa trace.')} <a href="#/expedition">{t('Partir en expédition')}</a>
          </p>
        ) : (
          <ol className="ex-trips">
            {trips
              .slice(-12)
              .reverse()
              .map((x) => (
                <li key={x.at}>
                  <span>
                    <b>{x.tour ? t('Tour du monde') : `${atlas.name(x.start)} → ${atlas.name(x.end)}`}</b>
                    <small>
                      {new Date(x.at).toLocaleDateString(locale(), { day: 'numeric', month: 'long' })} ·{' '}
                      {x.tour ? plural(new Set(x.path).size, '{n} pays', '{n} pays') : x.arrived ? t('arrivé') : t('bloqué')}
                    </small>
                  </span>
                  <span className="ex-trip-flags">{x.path.map(flagEmoji).join('')}</span>
                </li>
              ))}
          </ol>
        )}
      </main>
    </div>
  )
}
