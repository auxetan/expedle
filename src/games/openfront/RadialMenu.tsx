import { useEffect, useState } from 'react'
import { t } from '../../lib/i18n'
import { ICON } from './icons'

// Une icône d'OpenFront peinte d'une seule teinte (la couleur du texte autour) : sa forme sert de masque.
// Les guillemets comptent : Vite intègre les petits SVG en adresse data:, qui en contient.
export function Glyph({ src, size = 20 }: { src: string; size?: number }) {
  return <span className="of-glyph" aria-hidden style={{ width: size, height: size, maskImage: `url("${src}")`, WebkitMaskImage: `url("${src}")` }} />
}

export interface MenuItem {
  id: string
  label: string
  // nom complet au survol, quand le libellé est abrégé
  title?: string
  icon: string
  disabled?: boolean
  danger?: boolean
  note?: string
  sub?: MenuItem[]
  act?: () => void
}

const R1 = 40
const R2 = 104
const SIZE = 2 * R2 + 8

function sector(a0: number, a1: number) {
  const p = (r: number, a: number) => `${SIZE / 2 + r * Math.cos(a)} ${SIZE / 2 + r * Math.sin(a)}`
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M${p(R1, a0)} L${p(R2, a0)} A${R2} ${R2} 0 ${large} 1 ${p(R2, a1)} L${p(R1, a1)} A${R1} ${R1} 0 ${large} 0 ${p(R1, a0)}Z`
}

// La roue d'action : quatre secteurs autour d'une action centrale ; un secteur à sous-menu remplace la roue.
export default function RadialMenu({ x, y, items, center, onClose }: { x: number; y: number; items: MenuItem[]; center: MenuItem; onClose: () => void }) {
  const [open, setOpen] = useState<MenuItem | null>(null)
  const list = open?.sub ?? items
  const step = (2 * Math.PI) / list.length
  const left = Math.min(Math.max(x, SIZE / 2 + 8), window.innerWidth - SIZE / 2 - 8)
  const top = Math.min(Math.max(y, SIZE / 2 + 8), window.innerHeight - SIZE / 2 - 8)

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onClose])

  function pick(item: MenuItem) {
    if (item.disabled) return
    if (item.sub) return setOpen(item)
    item.act?.()
    onClose()
  }

  const middle = open ? { id: 'retour', label: t('Retour'), icon: ICON.retour } : center

  return (
    <>
      <div className="of-veil" onPointerDown={onClose} onContextMenu={(e) => e.preventDefault()} />
      <div className="of-radial" style={{ left, top, width: SIZE, height: SIZE }} onContextMenu={(e) => e.preventDefault()}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {list.map((item, i) => {
            const a0 = -Math.PI / 2 - step / 2 + i * step
            const mid = a0 + step / 2
            const cx = SIZE / 2 + ((R1 + R2) / 2) * Math.cos(mid)
            const cy = SIZE / 2 + ((R1 + R2) / 2) * Math.sin(mid)
            return (
              <g key={item.id} className={`of-slice${item.disabled ? ' off' : ''}${item.danger ? ' danger' : ''}`} onClick={() => pick(item)}>
                <title>{item.note ? `${item.title ?? item.label} · ${item.note}` : (item.title ?? item.label)}</title>
                <path d={sector(a0 + 0.02, a0 + step - 0.02)} />
                <foreignObject x={cx - 10} y={cy - 18} width={20} height={20}>
                  <Glyph src={item.icon} />
                </foreignObject>
                <text x={cx} y={cy + 14}>
                  {item.label}
                </text>
                {item.note && (
                  <text className="of-note" x={cx} y={cy + 25}>
                    {item.note}
                  </text>
                )}
              </g>
            )
          })}
          <g className={`of-center${middle.disabled ? ' off' : ''}`} onClick={() => (open ? setOpen(null) : pick(middle))}>
            <title>{middle.label}</title>
            <circle cx={SIZE / 2} cy={SIZE / 2} r={R1 - 5} />
            <foreignObject x={SIZE / 2 - 11} y={SIZE / 2 - 11} width={22} height={22}>
              <Glyph src={middle.icon} size={22} />
            </foreignObject>
          </g>
        </svg>
      </div>
    </>
  )
}
