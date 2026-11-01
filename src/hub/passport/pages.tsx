import { geoEqualEarth, geoPath } from 'd3-geo'
import { useMemo } from 'react'
import { CONTINENT_NAMES, countryName } from '../../geo/countries'
import { getWorld } from '../../geo/world'
import { fmt, locale, t } from '../../lib/i18n'
import type { Coverage, Passport, Stamp as StampData } from '../../lib/passport'
import { hashString } from '../../lib/util'
import { gameInfo } from '../../ui/gameInfo'
import StampArt, { inkOf, shapeOf, shortDate } from '../../ui/StampArt'

/* Couverture et dos : cuir bordeaux, lettres et armoiries dorées à chaud */

export function Emblem({ size = 46 }: { size?: number }) {
  // un globe à méridiens dans une couronne de lauriers, comme des armoiries
  const leaves = Array.from({ length: 8 }, (_, i) => i)
  return (
    <svg className="pp-emblem" viewBox="0 0 120 120" style={{ width: `${size}cqw` }} aria-hidden>
      <defs>
        <linearGradient id="pp-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3dfa0" />
          <stop offset="0.45" stopColor="#c99a3e" />
          <stop offset="0.7" stopColor="#f0d58c" />
          <stop offset="1" stopColor="#a87a2b" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#pp-gold)" strokeWidth="2.6">
        <circle cx="60" cy="58" r="30" />
        <ellipse cx="60" cy="58" rx="15" ry="30" />
        <path d="M60 28v60M31 48h58M31 68h58" />
      </g>
      <g fill="url(#pp-gold)">
        {leaves.map((i) => {
          // deux branches qui remontent de part et d'autre du globe, chaque feuille dans le sens de la tige
          const a = 100 + i * 13
          const r = (a * Math.PI) / 180
          const x = 60 + 41 * Math.cos(r)
          const y = 60 + 41 * Math.sin(r)
          return (
            <g key={i}>
              <ellipse cx={x} cy={y} rx="6.5" ry="2.6" transform={`rotate(${a + 90 + 25} ${x} ${y})`} />
              <ellipse cx={120 - x} cy={y} rx="6.5" ry="2.6" transform={`rotate(${-(a + 90 + 25)} ${120 - x} ${y})`} />
            </g>
          )
        })}
        <path d="M60 104l-5-6h10z" />
      </g>
    </svg>
  )
}

function Chip() {
  // le logo des passeports biométriques
  return (
    <svg className="pp-chip" viewBox="0 0 40 26" aria-hidden>
      <g fill="none" stroke="url(#pp-gold)" strokeWidth="1.8">
        <rect x="1" y="1" width="38" height="24" rx="3" />
        <path d="M1 9h13M1 17h13M26 9h13M26 17h13" />
        <circle cx="20" cy="13" r="5" />
      </g>
    </svg>
  )
}

export function Cover() {
  return (
    <div className="pp-leather">
      <span className="pp-gold pp-cover-country">{t('République d’Expedle')}</span>
      <Emblem />
      <span className="pp-gold pp-cover-title">{t('Passeport')}</span>
      <span className="pp-gold pp-cover-sub">Passport · Pasaporte · Reisepass</span>
      <Chip />
    </div>
  )
}

export function BackCover() {
  return (
    <div className="pp-leather back">
      <Emblem size={24} />
    </div>
  )
}

/* Pages de papier */

function Paper({ number, children, className = '' }: { number?: number; children: React.ReactNode; className?: string }) {
  return (
    <div className={`pp-paper ${className}`}>
      <div className="pp-watermark" aria-hidden />
      {children}
      {number !== undefined && <span className="pp-page-number">{number}</span>}
    </div>
  )
}

export function InsideCover({ pages }: { pages: number }) {
  return (
    <Paper className="pp-notice">
      <Emblem size={22} />
      <p className="pp-notice-title">{t('République d’Expedle')}</p>
      <p>
        {t(
          'Expedle prie les autorités ludiques de toutes les cartes de laisser jouer librement le titulaire du présent passeport et de lui prêter aide et protection en cas de besoin.',
        )}
      </p>
      <p className="pp-notice-small">{t('Ce passeport contient {n} pages.', { n: pages })}</p>
    </Paper>
  )
}

export interface Holder {
  name: string
  avatar: string
  title: string
  level: number
  number: string
  issued: Date
  expires: Date
  mrz: [string, string]
  stamped: number
  total: number
}

function Field({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'pp-field wide' : 'pp-field'}>
      <small>{label}</small>
      <b>{value}</b>
    </div>
  )
}

const date = (d: Date) => d.toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()

export function DataPage({ holder, number }: { holder: Holder; number: number }) {
  return (
    <Paper number={number} className="pp-data">
      <div className="pp-data-head">
        <span>{t('Passeport')} / Passport</span>
        <span>
          <small>Type</small> P
        </span>
        <span>
          <small>{t('Code')}</small> EXP
        </span>
        <span>
          <small>{t('N° du passeport')}</small> {holder.number}
        </span>
      </div>
      <div className="pp-data-body">
        <div className="pp-photo">
          <span>{holder.avatar}</span>
          <i className="pp-holo" aria-hidden />
        </div>
        <div className="pp-fields">
          <Field label={`${t('Nom')} / Surname`} value={holder.name.toUpperCase()} wide />
          <Field label={`${t('Titre')} / Title`} value={t(holder.title).toUpperCase()} wide />
          <Field label={`${t('Nationalité')} / Nationality`} value={t('CITOYEN DU MONDE')} wide />
          <Field label={`${t('Niveau')} / Level`} value={String(holder.level)} />
          <Field label={`${t('Pays')} / Countries`} value={`${holder.stamped} / ${holder.total}`} />
          <Field label={`${t('Délivré le')} / Date of issue`} value={date(holder.issued)} />
          <Field label={`${t('Expire le')} / Date of expiry`} value={date(holder.expires)} />
          <Field label={`${t('Autorité')} / Authority`} value="EXPEDLE" wide />
        </div>
      </div>
      <div className="pp-signature">
        <small>{t('Signature du titulaire')}</small>
        <span>{holder.name}</span>
      </div>
      <div className="pp-mrz" aria-label={t('Zone de lecture automatique')}>
        <span>{holder.mrz[0]}</span>
        <span>{holder.mrz[1]}</span>
      </div>
    </Paper>
  )
}

const W = 400
const H = 210

function InkMap({ book }: { book: Passport }) {
  const world = getWorld()
  const paths = useMemo(() => {
    const path = geoPath(
      geoEqualEarth().fitExtent(
        [
          [4, 4],
          [W - 4, H - 4],
        ],
        { type: 'Sphere' },
      ),
    )
    return {
      sphere: path({ type: 'Sphere' }) ?? '',
      countries: [...world.features].filter(([code]) => code !== 'AQ').map(([code, f]) => ({ code, d: path(f) ?? '' })),
    }
  }, [world])
  return (
    <svg className="pp-inkmap" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('Carte des pays tamponnés')}>
      <path d={paths.sphere} className="sea" />
      {paths.countries.map(({ code, d }) => (
        <path key={code} d={d} className={book[code] ? 'on' : ''}>
          <title>{countryName(code)}</title>
        </path>
      ))}
    </svg>
  )
}

export function NotesPage({ book, coverage, number }: { book: Passport; coverage: Coverage; number: number }) {
  return (
    <Paper number={number} className="pp-notes">
      <h3>{t('Observations')} / Endorsements</h3>
      <InkMap book={book} />
      <p className="pp-notes-total">
        {t('{n} pays tamponnés sur {total}', { n: coverage.stamped, total: coverage.total })} ·{' '}
        {fmt(coverage.stamped / coverage.total, { style: 'percent', maximumFractionDigits: 0 })}
      </p>
      <ul className="pp-notes-list">
        {coverage.byContinent.map((c) => (
          <li key={c.continent}>
            <span>{t(CONTINENT_NAMES[c.continent])}</span>
            <i>
              <b style={{ width: `${(100 * c.stamped) / c.total}%` }} />
            </i>
            <span>
              {c.stamped}/{c.total}
            </span>
          </li>
        ))}
      </ul>
    </Paper>
  )
}

/* Tampons */

export interface Visa {
  code: string
  data: StampData
}

function Stamp({ visa, slot }: { visa: Visa; slot: number }) {
  const { code, data } = visa
  const h = hashString(code)
  // place dans la grille de la page, décalée et penchée comme un coup de tampon à la main
  const col = slot % 2
  const row = Math.floor(slot / 2)
  const style = {
    left: `${6 + col * 47 + ((h >> 3) % 9)}%`,
    top: `${12 + row * 28 + ((h >> 5) % 7)}%`,
    transform: `rotate(${((h >> 7) % 25) - 12}deg)`,
    color: inkOf(code),
  }
  return (
    <div className={`pp-stamp shape-${shapeOf(code)}`} style={style} title={`${countryName(code)} · ${shortDate(data.first)}`}>
      <StampArt code={code} time={data.first} line={(gameInfo(data.games[0] ?? '').title ?? '').toUpperCase()} />
      {data.n > 1 && <span className="pp-stamp-count">×{data.n}</span>}
    </div>
  )
}

export const PER_PAGE = 6

export function VisaPage({ visas, number }: { visas: Visa[]; number: number }) {
  return (
    <Paper number={number} className="pp-visas">
      <h3>Visas</h3>
      {visas.map((v, i) => (
        <Stamp key={v.code} visa={v} slot={i} />
      ))}
    </Paper>
  )
}

export function InsideBack({ games }: { games: string[] }) {
  return (
    <Paper className="pp-notice">
      <p className="pp-notice-title">{t('Renseignements')} / Information</p>
      <p>{t('Chaque pays trouvé dans un jeu reçoit un tampon à son premier passage. Les jeux qui en délivrent :')}</p>
      <ul className="pp-notice-games">
        {games.map((g) => (
          <li key={g}>{t(gameInfo(g).title)}</li>
        ))}
      </ul>
      <p className="pp-notice-small">{t('Les tampons suivent ton compte sur tous tes appareils.')}</p>
    </Paper>
  )
}
