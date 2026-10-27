// Pépite, la mascotte d'Expedle : la pépite d'or à facettes, avec un visage. Elle cligne des yeux au repos,
// saute de joie, vacille quand c'est raté ; changer d'humeur rejoue son geste.
import { useId, type ReactNode } from 'react'
import { FACETS, OUTLINE } from './flight'
import './mascot.css'

export type Mood = 'calme' | 'joie' | 'rate' | 'surprise'

// les visages, dans le repère 24 × 24 des facettes
const FACES: Record<Mood, ReactNode> = {
  calme: (
    <>
      <g className="mascot-eyes">
        <circle cx="9.8" cy="11.2" r="1.05" />
        <circle cx="14.4" cy="11.4" r="1.05" />
      </g>
      <path className="mascot-line" d="M10.8 14.3q1.3 1 2.6 0" />
    </>
  ),
  joie: (
    <>
      <path className="mascot-line" d="M8.8 11.6q1-1.4 2 0M13.4 11.8q1-1.4 2 0" />
      <path className="mascot-mouth" d="M10.6 13.9q1.6 2.4 3.2 0z" />
    </>
  ),
  rate: (
    <>
      <path className="mascot-line thin" d="M8.9 10.3l1.8.7M15.4 10.5l-1.8.7" />
      <g className="mascot-eyes">
        <circle cx="9.9" cy="11.9" r=".8" />
        <circle cx="14.5" cy="12.1" r=".8" />
      </g>
      <path className="mascot-line" d="M10.9 15.1q1.3-.9 2.6 0" />
    </>
  ),
  surprise: (
    <>
      <g className="mascot-eyes">
        <circle cx="9.8" cy="11" r="1.25" />
        <circle cx="14.4" cy="11.2" r="1.25" />
      </g>
      <ellipse className="mascot-mouth" cx="12.1" cy="14.7" rx=".9" ry="1.1" />
    </>
  ),
}

interface Props {
  mood?: Mood
  size?: number
  className?: string
  // un reflet qui traverse la pépite (le moment de victoire l'anime)
  shine?: boolean
}

export default function Mascot({ mood = 'calme', size, className, shine }: Props) {
  const clip = useId()
  return (
    <span className={className ? `mascot ${className}` : 'mascot'} style={size ? { width: size, height: size } : undefined} aria-hidden>
      <svg key={mood} className={`pepite-facets ${mood}`} viewBox="0 0 24 24">
        {FACETS.map((d, i) => (
          <path key={i} d={d} className={`f${i}`} />
        ))}
        {shine && (
          <>
            <clipPath id={clip}>
              <path d={OUTLINE} />
            </clipPath>
            <g clipPath={`url(#${clip})`}>
              <g transform="rotate(25 12 12)">
                <rect className="mascot-shine" x="-10" y="-6" width="5" height="36" />
              </g>
            </g>
          </>
        )}
        {FACES[mood]}
      </svg>
    </span>
  )
}

// la flamme de la série et du combo
export function Flame({ size = 22 }: { size?: number }) {
  return (
    <svg className="flame" viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d="M12 2.5c.8 3 4.5 5.3 4.5 10a4.5 4.5 0 0 1-9 0c0-2.2 1-3.8 2.3-4.8.1 1.5.8 2.5 1.8 2.9-.3-3.2.1-5.8.4-8.1z" fill="var(--orange)" />
      <path d="M12 13.2c1 .9 1.8 2 1.8 3.3a1.8 1.8 0 0 1-3.6 0c0-1.2.8-2.3 1.8-3.3z" fill="var(--or)" />
    </svg>
  )
}

