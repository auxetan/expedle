import { useEffect, useState } from 'react'
import { t } from '../../lib/i18n'

// Icônes au trait, dans un carré de 24.
export const ICON = {
  info: 'M12 11v6 M12 7.5v.5 M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  bateau: 'M3 15h18l-3 4H6z M12 4v11 M12 4l6 8h-6',
  alliance: 'M9 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M15 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
  rompre: 'M7 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M17 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M11 19l2-14',
  prolonger: 'M20 12a8 8 0 1 1-2.3-5.6 M20 4v4h-4',
  attaque: 'M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M12 2v5 M12 17v5 M2 12h5 M17 12h5',
  construire: 'M4 20l9-9 M14 4l6 6-3 3-6-6z',
  supprimer: 'M5 7h14 M10 7V4h4v3 M7 7l1 13h8l1-13',
  or: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  troupes: 'M12 4v12 M7 11l5 5 5-5 M5 20h14',
  depart: 'M6 21V4 M6 4h11l-2 4 2 4H6',
  retour: 'M15 6l-6 6 6 6',
  ville: 'M4 20V10l8-6 8 6v10z M10 20v-5h4v5',
  port: 'M12 3v18 M8 7h8 M5 14a7 7 0 0 0 14 0',
  poste: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  silo: 'M12 3c3 3 4 7 4 11H8c0-4 1-8 4-11z M8 14l-2 5h4 M16 14l2 5h-4',
  dca: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M12 8v8 M8 12h8',
  navire: 'M3 15h18l-3 4H6z M8 15v-4h8v4 M12 11V7',
  bombe: 'M11 21a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M15 8l3-4',
  hbombe: 'M11 21a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M15 8l3-4 M11 11v6 M8 14h6',
  mirv: 'M6 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M18 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
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
                <g transform={`translate(${cx - 10} ${cy - 18}) scale(${20 / 24})`}>
                  <path className="of-ico" d={item.icon} />
                </g>
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
            <g transform={`translate(${SIZE / 2 - 11} ${SIZE / 2 - 11}) scale(${22 / 24})`}>
              <path className="of-ico" d={middle.icon} />
            </g>
          </g>
        </svg>
      </div>
    </>
  )
}
