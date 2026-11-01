// Le dessin d'un tampon de passeport : cercle, cadre ou ovale selon le pays, à l'encre de son continent, avec le grain
// d'un vrai coup de tampon. La couleur vient du parent (currentColor), pour qu'un tampon puisse être doré ou rouge.
import { useId } from 'react'
import { COUNTRY_BY_CODE, countryName, type Continent } from '../geo/countries'
import { locale, t } from '../lib/i18n'
import { hashString } from '../lib/util'

// encre par continent, comme les couleurs des postes-frontières
const INK: Record<Continent, string> = {
  EU: '#2c4a9a',
  AF: '#2f7a46',
  AS: '#b1302b',
  NA: '#5d3b91',
  SA: '#bd5f22',
  OC: '#1e7a78',
  AN: '#475569',
}

export const inkOf = (code: string) => INK[COUNTRY_BY_CODE.get(code)?.continent ?? 'AN']
export const shapeOf = (code: string) => hashString(code) % 3

export const shortDate = (time: number) =>
  new Date(time).toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: '2-digit' }).replace(/\./g, '').toUpperCase()

// l'encre des tampons : un trait irrégulier, un peu passé par endroits ; une fois par page qui affiche des tampons
export function InkFilter() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <filter id="pp-ink" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="3" result="grain" />
        <feDisplacementMap in="SourceGraphic" in2="grain" scale="2.2" result="rough" />
        <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="11" result="blot" />
        <feColorMatrix in="blot" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.6 0 0 0 -0.3" result="mask" />
        <feComposite in="rough" in2="mask" operator="in" />
      </filter>
    </svg>
  )
}

// `line` : la petite ligne du tampon (le jeu qui l'a délivré, l'expédition…)
export default function StampArt({ code, time, line }: { code: string; time: number; line: string }) {
  const id = `pp-arc-${useId().replace(/:/g, '')}`
  const name = countryName(code).toUpperCase()
  const size = (max: number, width: number) => Math.min(max, width / Math.max(4, name.length * 0.62))
  const shape = shapeOf(code)
  if (shape === 0)
    return (
      <svg viewBox="0 0 120 120">
        <g filter="url(#pp-ink)" fill="none" stroke="currentColor">
          <circle cx="60" cy="60" r="56" strokeWidth="3.2" />
          <circle cx="60" cy="60" r="41" strokeWidth="1.3" />
          <path id={id} d="M16 60a44 44 0 0 1 88 0" />
          <path id={`${id}-b`} d="M8 60a52 52 0 0 0 104 0" />
          <g fill="currentColor" stroke="none" textAnchor="middle" fontFamily="var(--font)" fontWeight="700">
            <text fontSize={size(10.5, 110)} letterSpacing="1">
              <textPath href={`#${id}`} startOffset="50%">
                {name}
              </textPath>
            </text>
            <text fontSize="7.5" letterSpacing="1">
              <textPath href={`#${id}-b`} startOffset="50%">
                {line}
              </textPath>
            </text>
            <text x="60" y="56" fontSize="7" letterSpacing="1.2">
              ✈ {t('ENTRÉE')}
            </text>
            <text x="60" y="72" fontSize="12.5">
              {shortDate(time)}
            </text>
          </g>
        </g>
      </svg>
    )
  if (shape === 1)
    return (
      <svg viewBox="0 0 160 100">
        <g filter="url(#pp-ink)" fill="none" stroke="currentColor">
          <rect x="3" y="3" width="154" height="94" rx="9" strokeWidth="3.2" />
          <rect x="10" y="10" width="140" height="80" rx="4" strokeWidth="1.2" />
          <g fill="currentColor" stroke="none" textAnchor="middle" fontFamily="var(--font)" fontWeight="700">
            <text x="80" y="34" fontSize={size(15, 150)} letterSpacing="0.8">
              {name}
            </text>
            <text x="80" y="58" fontSize="17" letterSpacing="1">
              {shortDate(time)}
            </text>
            <text x="80" y="79" fontSize="8" letterSpacing="1.4">
              {t('ARRIVÉE')} · {line}
            </text>
          </g>
        </g>
      </svg>
    )
  return (
    <svg viewBox="0 0 160 104">
      <g filter="url(#pp-ink)" fill="none" stroke="currentColor">
        <ellipse cx="80" cy="52" rx="76" ry="48" strokeWidth="3" />
        <ellipse cx="80" cy="52" rx="66" ry="38" strokeWidth="1" strokeDasharray="3 2.5" />
        <g fill="currentColor" stroke="none" textAnchor="middle" fontFamily="var(--font)" fontWeight="700">
          <text x="80" y="40" fontSize="8" letterSpacing="2">
            ✈ {t('ADMIS')} ✈
          </text>
          <text x="80" y="58" fontSize={size(14, 120)} letterSpacing="0.6">
            {name}
          </text>
          <text x="80" y="75" fontSize="11">
            {shortDate(time)}
          </text>
        </g>
      </g>
    </svg>
  )
}
