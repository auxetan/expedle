import type { Part } from './drawings'

export interface Silhouette {
  href: string
  aspect: number
}

const cache = new Map<string, Silhouette>()
const SIZE = 360

// L'emoji est rendu par la police système puis réduit à sa boîte englobante exacte,
// pour que la hauteur dessinée corresponde à la dimension réelle de l'objet.
export function emojiSilhouette(emoji: string, color: string): Silhouette {
  const key = emoji + color
  const cached = cache.get(key)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE * 1.4
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.font = `${SIZE}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, canvas.width / 2, canvas.height / 2)
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)

  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] > 40) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
  if (maxX < 0) {
    const empty = { href: '', aspect: 1 }
    cache.set(key, empty)
    return empty
  }

  const w = maxX - minX + 1
  const h = maxY - minY + 1
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const octx = out.getContext('2d')!
  const img = octx.createImageData(w, h)
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const a = data[((y + minY) * width + x + minX) * 4 + 3]
      const o = (y * w + x) * 4
      img.data[o] = r
      img.data[o + 1] = g
      img.data[o + 2] = b
      img.data[o + 3] = a > 40 ? 255 : a * 4
    }
  octx.putImageData(img, 0, 0)
  const s = { href: out.toDataURL(), aspect: w / h }
  cache.set(key, s)
  return s
}

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

const boxes = new WeakMap<Part[], Box>()
let probe: SVGSVGElement | null = null

// Boîte englobante exacte d'un dessin (traits compris), mesurée par le navigateur.
export function drawingBox(parts: Part[]): Box {
  const cached = boxes.get(parts)
  if (cached) return cached
  const NS = 'http://www.w3.org/2000/svg'
  if (!probe) {
    probe = document.createElementNS(NS, 'svg')
    probe.setAttribute('style', 'position:absolute;width:0;height:0;visibility:hidden')
    document.body.appendChild(probe)
  }
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const p of parts) {
    const el = document.createElementNS(NS, 'path')
    el.setAttribute('d', typeof p === 'string' ? p : p.d)
    probe.appendChild(el)
    const b = el.getBBox()
    el.remove()
    const m = typeof p === 'string' ? 0 : p.w / 2
    x0 = Math.min(x0, b.x - m)
    y0 = Math.min(y0, b.y - m)
    x1 = Math.max(x1, b.x + b.width + m)
    y1 = Math.max(y1, b.y + b.height + m)
  }
  const box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
  boxes.set(parts, box)
  return box
}
