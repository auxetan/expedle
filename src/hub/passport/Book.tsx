import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { feedback } from '../../lib/feedback'
import { t } from '../../lib/i18n'

export interface Face {
  node: ReactNode
  // couverture en cuir plutôt que page de papier
  cover?: boolean
}

const FLIP_MS = 900
const RATIO = 1.42 // une page de passeport : 88 × 125 mm

// Un livret qui s'ouvre et se feuillette. Chaque feuillet a un recto et un verso et tourne autour du dos.
// En grand écran, deux pages en vis-à-vis ; sur téléphone, une page à la fois.
export default function Book({ faces, onTurn }: { faces: Face[]; onTurn?: (turned: number) => void }) {
  const stage = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)
  const single = width < 720
  const page = Math.round(single ? Math.min(400, width - 24) : Math.min(440, (width - 32) / 2))

  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(stage.current!)
    return () => ro.disconnect()
  }, [])

  // un feuillet = deux faces qui se suivent ; en page simple, le verso reste blanc
  const leaves: [Face, Face | null][] = single ? faces.map((f) => [f, null]) : faces.flatMap((f, i) => (i % 2 ? [] : [[f, faces[i + 1] ?? null] as [Face, Face | null]]))
  const [turned, setTurned] = useState(0)
  const [moving, setMoving] = useState<number | null>(null)
  const timer = useRef(0)

  function go(to: number) {
    const target = Math.max(0, Math.min(leaves.length - (single ? 1 : 0), to))
    if (target === turned) return
    // en sautant plusieurs pages, c'est la dernière tournée qui doit finir sur le dessus
    setMoving(target > turned ? target - 1 : target)
    setTurned(target)
    onTurn?.(target)
    feedback('page')
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMoving(null), FLIP_MS)
  }

  const goRef = useRef(go)
  const turnedRef = useRef(turned)
  useEffect(() => {
    goRef.current = go
    turnedRef.current = turned
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowRight') goRef.current(turnedRef.current + 1)
      else if (e.key === 'ArrowLeft') goRef.current(turnedRef.current - 1)
      else if (e.key === 'Home' || e.key === 'Escape') goRef.current(0)
      else if (e.key === 'End') goRef.current(Infinity)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearTimeout(timer.current)
    }
  }, [])
  // un toucher tourne la page du côté touché ; un glissé, dans le sens du geste
  const press = useRef<{ x: number; y: number } | null>(null)
  function up(e: React.PointerEvent) {
    const start = press.current
    press.current = null
    if (!start) return
    const dx = e.clientX - start.x
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - start.y)) return go(turned + (dx < 0 ? 1 : -1))
    if (Math.abs(dx) > 6) return
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const right = single ? e.clientX > r.left + r.width * 0.35 : e.clientX > r.left + r.width / 2
    go(turned + (right ? 1 : -1))
  }

  const closed = turned === 0 ? 'closed-front' : !single && turned === leaves.length ? 'closed-back' : 'open'
  const lastTurn = leaves.length - (single ? 1 : 0)

  return (
    <div className="pb-stage" ref={stage}>
      <div
        className={`pb-book ${closed} ${single ? 'single' : 'spread'}`}
        style={{ '--pw': `${page}px`, '--ph': `${Math.round(page * RATIO)}px` } as React.CSSProperties}
        onPointerDown={(e) => (press.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={up}
        onPointerCancel={() => (press.current = null)}
      >
        {leaves.map(([front, back], i) => {
          const flipped = i < turned
          // en 3D, le navigateur ignore z-index entre les feuillets : l'ordre de la pile passe par une infime
          // profondeur, la page qui tourne passant au-dessus de toutes les autres
          const depth = moving === i ? leaves.length + 2 : flipped ? i + 1 : leaves.length - i
          // seuls les feuillets autour de la double page ouverte se voient : les autres, enfouis dans la pile,
          // ne sont pas dessinés et ne peuvent pas passer devant par erreur
          const buried = i < turned - 2 || i > turned + 1
          return (
            <div
              key={i}
              className={`pb-leaf ${moving === i ? 'moving' : ''}`}
              style={{
                zIndex: depth,
                visibility: buried && moving !== i ? 'hidden' : undefined,
                transform: `translateZ(${depth * 1.5}px) rotateY(${flipped ? -180 : 0}deg)`,
              }}
              aria-hidden={single ? i !== turned : !(i === turned || i === turned - 1)}
            >
              <div className={front.cover ? 'pb-face front cover' : 'pb-face front'}>{front.node}</div>
              <div className={back?.cover ? 'pb-face back cover' : 'pb-face back'}>{back?.node}</div>
            </div>
          )
        })}
      </div>
      <div className="pb-controls">
        <button onClick={() => go(turned - 1)} disabled={turned === 0} aria-label={t('Page précédente')}>
          ‹
        </button>
        {turned === 0 ? (
          <span>{t('Touche le passeport pour l’ouvrir')}</span>
        ) : (
          <span className="pb-dots">
            {Array.from({ length: lastTurn }, (_, i) => (
              <button key={i} className={i + 1 === turned ? 'on' : ''} onClick={() => go(i + 1)} aria-label={t('Aller à la double page {n}', { n: i + 1 })} />
            ))}
          </span>
        )}
        <button onClick={() => go(turned + 1)} disabled={turned >= lastTurn} aria-label={t('Page suivante')}>
          ›
        </button>
        {turned > 0 && (
          <button className="pb-close" onClick={() => go(0)}>
            {t('Fermer')}
          </button>
        )}
      </div>
    </div>
  )
}
