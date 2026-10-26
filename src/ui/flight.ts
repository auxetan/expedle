// Des pépites qui volent d'un point à un autre de l'écran : elles jaillissent, flottent un instant, puis filent en
// accélérant vers leur cible. Le moment de victoire les envoie vers le solde, la boutique du solde vers l'objet acheté.
import './flight.css'

// Les facettes d'une pépite, éclairées d'en haut à gauche, autour d'un point central, et son contour.
export const FACETS = ['M11 12 7 8l6.5-3.5z', 'M11 12l2.5-7.5L20 9z', 'M11 12l9-3 .5 7z', 'M11 12l9.5 4-6 4.5-8-1.5z', 'M11 12l-4.5 7-2.5-3.5L7 8z']
export const OUTLINE = 'M4 15.5 7 8l6.5-3.5L20 9l.5 7-6 4.5-8-1.5z'

export interface Point {
  x: number
  y: number
}

export const center = (el: Element): Point => {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

// le solde de la barre du haut, s'il est à l'écran
export const barWallet = () => [...document.querySelectorAll<HTMLElement>('.ui-bar .ui-wallet')].find((el) => el.getClientRects().length > 0)

// `total` réparti entre `count` pépites, à une unité près
export const shares = (total: number, count: number) => Array.from({ length: count }, (_, i) => Math.floor(total / count) + (i < total % count ? 1 : 0))

// en millisecondes
const SCATTER = 300
const HOVER = 60
const FLIGHT = 560
const STAGGER = 45
const SIZE = 22

const easeOut = (k: number) => 1 - (1 - k) ** 3

const SVG = 'http://www.w3.org/2000/svg'

function nugget(): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('width', String(SIZE))
  svg.setAttribute('height', String(SIZE))
  svg.setAttribute('class', 'flight-coin pepite-facets')
  FACETS.forEach((d, i) => {
    const path = document.createElementNS(SVG, 'path')
    path.setAttribute('d', d)
    path.setAttribute('class', `f${i}`)
    svg.append(path)
  })
  return svg
}

interface Flight {
  from: Point
  to: Point
  count: number
  // jusqu'où les pépites jaillissent autour du départ, en px
  spread?: number
  // chaque pépite arrivée, dans l'ordre d'arrivée
  onLand?: (i: number, last: boolean) => void
}

// Lance le vol ; la fonction rendue l'arrête et retire les pépites.
export function fly({ from, to, count, spread = 90, onLand }: Flight): () => void {
  const layer = document.createElement('div')
  layer.className = 'flight'
  document.body.append(layer)
  // les pépites abordent leur cible du côté d'où elles viennent
  const back = Math.hypot(from.x - to.x, from.y - to.y) || 1
  const approach = { x: to.x + ((from.x - to.x) / back) * 150, y: to.y + ((from.y - to.y) / back) * 150 }
  const plan = Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (i / count) * 2 * Math.PI + (Math.random() - 0.5) * 0.8
    const dir = { x: Math.cos(angle), y: Math.sin(angle) }
    const reach = spread * (0.62 + Math.random() * 0.7)
    return {
      el: layer.appendChild(nugget()),
      dir,
      out: { x: from.x + dir.x * reach, y: from.y + dir.y * reach },
      spin: (Math.random() - 0.5) * 720,
      leave: SCATTER + HOVER + i * STAGGER,
      landed: false,
    }
  })
  let landed = 0
  let raf = 0
  const t0 = performance.now()
  const frame = (now: number) => {
    const t = now - t0
    for (const c of plan) {
      if (c.landed) continue
      let x: number, y: number, s: number
      if (t < c.leave) {
        const k = easeOut(Math.min(1, t / SCATTER))
        x = from.x + (c.out.x - from.x) * k
        y = from.y + (c.out.y - from.y) * k
        s = 0.35 + 0.65 * k
      } else {
        const k = Math.min(1, (t - c.leave) / FLIGHT)
        const e = k ** 1.7
        // une courbe qui prolonge l'élan du jaillissement avant de rejoindre la cible
        const p1 = { x: c.out.x + c.dir.x * 90, y: c.out.y + c.dir.y * 90 }
        const u = 1 - e
        x = u ** 3 * c.out.x + 3 * u * u * e * p1.x + 3 * u * e * e * approach.x + e ** 3 * to.x
        y = u ** 3 * c.out.y + 3 * u * u * e * p1.y + 3 * u * e * e * approach.y + e ** 3 * to.y
        s = 1 - 0.3 * e
        if (k === 1) {
          c.landed = true
          c.el.remove()
          landed++
          onLand?.(landed - 1, landed === count)
          continue
        }
      }
      c.el.style.visibility = 'visible'
      c.el.style.transform = `translate(${x - SIZE / 2}px, ${y - SIZE / 2}px) rotate(${(c.spin * t) / (c.leave + FLIGHT)}deg) scale(${s})`
    }
    if (landed < count) raf = requestAnimationFrame(frame)
    else layer.remove()
  }
  raf = requestAnimationFrame(frame)
  return () => {
    cancelAnimationFrame(raf)
    layer.remove()
  }
}
