// Dessin de la partie dans les couleurs du site : la carte case par case dans une image, puis par-dessus
// les bâtiments, les bateaux, les bombes et les noms, à la taille de l'écran.
import { allied, isLand, isTraitor, player, SHORE, type Game, type Unit } from './engine'
import type { Anchor } from './labels'
import { flagEmoji } from '../../geo/countries'
import { BLAST, type UnitType } from './rules'

export interface View {
  s: number
  x: number
  y: number
}

type RGB = number[]

const hue = (id: number) => Math.round((id * 137.508) % 360)

function hsl(h: number, s: number, l: number): RGB {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
  }
  return [f(0), f(8), f(4)]
}

function rgb(hex: string): RGB {
  const m = hex.trim().match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i)
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [128, 128, 128]
}

const mix = (a: RGB, b: RGB, k: number) => a.map((v, i) => Math.round(v * (1 - k) + b[i] * k))
const pack = ([r, g, b]: RGB) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
export const css = ([r, g, b]: RGB, alpha = 1) => `rgba(${r},${g},${b},${alpha})`

export interface Palette {
  bg: RGB
  fg: RGB
  good: RGB
  bad: RGB
  water: RGB
  shallow: RGB
  land: RGB
  coast: RGB
  fallout: RGB
  players: RGB[]
}

// Toi dans la couleur du texte, les nations en teintes sourdes bien espacées, les tribus en gris.
export function palette(el: Element, g: Game, me: number): Palette {
  const style = getComputedStyle(el)
  const get = (v: string) => rgb(style.getPropertyValue(v))
  const light = parseFloat(style.getPropertyValue('--of-l')) / 100
  const bg = get('--bg')
  const fg = get('--fg')
  const land = get('--line')
  return {
    bg,
    fg,
    good: get('--good'),
    bad: get('--bad'),
    water: get('--bg2'),
    shallow: mix(get('--bg2'), land, 0.35),
    land,
    coast: mix(land, fg, 0.12),
    fallout: mix(land, get('--warn'), 0.35),
    players: g.players.map((p) =>
      p.id === me ? fg : p.kind === 'bot' ? hsl(hue(p.id), 0.08, light + (p.id % 3) * 0.05 - 0.08) : hsl(hue(p.id), 0.4, light + (p.id % 2 ? 0.05 : -0.05)),
    ),
  }
}

export class Painter {
  readonly image: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private data: ImageData
  private px: Uint32Array
  private fill: number[] = []
  private edge: number[] = []
  private base: number[] = []
  pal!: Palette
  private g: Game

  constructor(g: Game) {
    this.g = g
    this.image = document.createElement('canvas')
    this.image.width = g.w
    this.image.height = g.h
    this.ctx = this.image.getContext('2d')!
    this.data = this.ctx.createImageData(g.w, g.h)
    this.px = new Uint32Array(this.data.data.buffer)
  }

  setPalette(pal: Palette) {
    this.pal = pal
    this.fill = pal.players.map((c) => pack(mix(pal.land, c, 0.78)))
    this.edge = pal.players.map((c) => pack(mix(c, pal.bg, 0.3)))
    this.base = [pack(pal.water), pack(pal.shallow), pack(pal.land), pack(pal.coast), pack(pal.fallout)]
    const g = this.g
    for (let t = 0; t < g.w * g.h; t++) this.tile(t)
    g.dirtyCount = 0
    g.dirtyMark.fill(0)
    this.ctx.putImageData(this.data, 0, 0)
  }

  private tile(t: number) {
    const g = this.g
    const o = g.owner[t]
    if (o) this.px[t] = player(g, o).border.has(t) ? this.edge[o - 1] : this.fill[o - 1]
    else if (!isLand(g, t)) this.px[t] = this.base[g.terrain[t] & SHORE ? 1 : 0]
    else this.px[t] = this.base[g.fallout[t] ? 4 : g.terrain[t] & SHORE ? 3 : 2]
  }

  // Ne recopie que le rectangle des cases changées depuis la dernière image.
  flush() {
    const g = this.g
    if (!g.dirtyCount) return
    let x0 = g.w
    let y0 = g.h
    let x1 = 0
    let y1 = 0
    for (let i = 0; i < g.dirtyCount; i++) {
      const t = g.dirty[i]
      g.dirtyMark[t] = 0
      this.tile(t)
      const x = t % g.w
      const y = (t - x) / g.w
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
    g.dirtyCount = 0
    this.ctx.putImageData(this.data, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1)
  }
}

// Petites silhouettes des bâtiments, tracées dans un carré de côté 2r centré sur (x, y).
function shape(ctx: CanvasRenderingContext2D, type: UnitType, x: number, y: number, r: number) {
  ctx.beginPath()
  switch (type) {
    case 'ville':
      ctx.moveTo(x - r, y + r)
      ctx.lineTo(x - r, y - r * 0.2)
      ctx.lineTo(x, y - r)
      ctx.lineTo(x + r, y - r * 0.2)
      ctx.lineTo(x + r, y + r)
      break
    case 'port':
      ctx.arc(x, y, r, 0, 2 * Math.PI)
      break
    case 'poste':
      ctx.moveTo(x - r, y - r)
      ctx.lineTo(x + r, y - r)
      ctx.lineTo(x + r, y)
      ctx.lineTo(x, y + r)
      ctx.lineTo(x - r, y)
      break
    case 'silo':
      ctx.moveTo(x, y - r * 1.2)
      ctx.lineTo(x + r * 0.8, y + r)
      ctx.lineTo(x - r * 0.8, y + r)
      break
    case 'dca':
      ctx.rect(x - r, y - r, 2 * r, 2 * r)
      break
    case 'navire':
      ctx.moveTo(x, y - r)
      ctx.lineTo(x + r, y)
      ctx.lineTo(x, y + r)
      ctx.lineTo(x - r, y)
      break
  }
  ctx.closePath()
}

function glyph(ctx: CanvasRenderingContext2D, u: Unit, x: number, y: number, r: number) {
  // un trait distinctif au centre : ancre du port, viseur de la défense antiaérienne
  if (u.type === 'port') {
    ctx.moveTo(x, y - r * 0.55)
    ctx.lineTo(x, y + r * 0.55)
    ctx.moveTo(x - r * 0.5, y + r * 0.2)
    ctx.lineTo(x + r * 0.5, y + r * 0.2)
  } else if (u.type === 'dca') {
    ctx.moveTo(x - r * 0.6, y)
    ctx.lineTo(x + r * 0.6, y)
    ctx.moveTo(x, y - r * 0.6)
    ctx.lineTo(x, y + r * 0.6)
  }
}

export function draw(ctx: CanvasRenderingContext2D, painter: Painter, g: Game, view: View, cw: number, ch: number, labels: Anchor[], me: number) {
  const pal = painter.pal
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
  ctx.fillStyle = css(pal.water)
  ctx.fillRect(0, 0, cw, ch)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(painter.image, view.x, view.y, g.w * view.s, g.h * view.s)
  const sx = (t: number) => view.x + ((t % g.w) + 0.5) * view.s
  const sy = (t: number) => view.y + (Math.floor(t / g.w) + 0.5) * view.s
  const visible = (x: number, y: number) => x > -40 && y > -40 && x < cw + 40 && y < ch + 40

  // bâtiments et navires de guerre
  const r = Math.min(9, Math.max(4, view.s * 2.5))
  ctx.lineWidth = 1.5
  ctx.strokeStyle = css(pal.bg)
  for (const u of g.units) {
    const x = sx(u.tile)
    const y = sy(u.tile)
    if (!visible(x, y)) continue
    ctx.globalAlpha = u.ready > g.tick ? 0.45 : 1
    shape(ctx, u.type, x, y, r)
    ctx.fillStyle = css(pal.players[u.owner - 1])
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    glyph(ctx, u, x, y, r)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // bateaux : les transports en rond, les marchands en petit carré
  for (const b of g.boats) {
    const t = b.path[Math.min(b.at, b.path.length - 1)]
    const x = sx(t)
    const y = sy(t)
    if (!visible(x, y)) continue
    ctx.beginPath()
    if (b.trade) ctx.rect(x - 2, y - 2, 4, 4)
    else ctx.arc(x, y, Math.max(3, view.s * 1.6), 0, 2 * Math.PI)
    ctx.fillStyle = css(pal.players[b.owner - 1])
    ctx.fill()
    ctx.stroke()
  }

  // obus
  ctx.fillStyle = css(pal.fg)
  for (const s of g.shells) {
    const k = 1 - (s.hit - g.tick) / 4
    ctx.fillRect(sx(s.from) + (sx(s.tile) - sx(s.from)) * k - 1, sy(s.from) + (sy(s.tile) - sy(s.from)) * k - 1, 2, 2)
  }

  // bombes en vol : la cible cerclée, l'engin sur sa courbe
  for (const n of g.nukes) {
    if (g.tick < n.start) continue
    const k = Math.min(1, (g.tick - n.start) / n.ticks)
    const x0 = sx(n.from)
    const y0 = sy(n.from)
    const x1 = sx(n.dst)
    const y1 = sy(n.dst)
    const arc = Math.hypot(x1 - x0, y1 - y0) * 0.25
    const x = x0 + (x1 - x0) * k
    const y = y0 + (y1 - y0) * k - Math.sin(Math.PI * k) * arc
    if (n.type !== 'ogive') {
      ctx.beginPath()
      ctx.arc(x1, y1, BLAST[n.type === 'mirv' ? 'ogive' : n.type].outer * view.s, 0, 2 * Math.PI)
      ctx.strokeStyle = css(pal.bad, 0.7)
      ctx.setLineDash([4, 4])
      ctx.stroke()
      ctx.setLineDash([])
    }
    ctx.beginPath()
    ctx.arc(x, y, n.type === 'ogive' ? 2 : 3.5, 0, 2 * Math.PI)
    ctx.fillStyle = css(pal.bad)
    ctx.fill()
  }
  ctx.strokeStyle = css(pal.bg)

  // explosions : un anneau qui s'efface en une seconde et demie
  for (const b of g.blasts) {
    const k = (g.tick - b.tick) / 15
    ctx.beginPath()
    ctx.arc(sx(b.tile), sy(b.tile), b.radius * view.s * (0.6 + 0.4 * k), 0, 2 * Math.PI)
    ctx.fillStyle = css(pal.fg, 0.35 * (1 - k))
    ctx.fill()
  }

  // noms et troupes ; alliés en vert, traîtres en rouge
  ctx.textAlign = 'center'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 3
  for (const a of labels) {
    const p = player(g, a.id)
    if (!p.alive) continue
    const room = Math.sqrt(a.cells) * view.s * 1.1
    const name = p.code ? `${flagEmoji(p.code)} ${p.name}` : p.name
    let size = Math.min(22, room * 0.3)
    ctx.font = `500 ${size}px Ubuntu, system-ui, sans-serif`
    const width = ctx.measureText(name).width
    if (width > room) size *= room / width
    if (size < 9) continue
    const x = view.x + (a.x + 0.5) * view.s
    const y = view.y + (a.y + 0.5) * view.s
    if (!visible(x, y)) continue
    const color = isTraitor(g, p) ? pal.bad : p.id !== me && allied(g, p.id, me) ? pal.good : pal.fg
    ctx.font = `500 ${size}px Ubuntu, system-ui, sans-serif`
    ctx.strokeText(name, x, y)
    ctx.fillStyle = css(color)
    ctx.fillText(name, x, y)
    ctx.font = `${size * 0.8}px Ubuntu, system-ui, sans-serif`
    const troops = compact(p.troops)
    ctx.strokeText(troops, x, y + size)
    ctx.fillText(troops, x, y + size)
  }
}

export const compact = (n: number) => {
  const v = Math.floor(n)
  return v >= 1e6 ? `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)}k` : String(v)
}
