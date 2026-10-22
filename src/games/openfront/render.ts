// Dessin de la partie dans les couleurs du site : la carte case par case dans une image, puis par-dessus
// les rails, les bâtiments, les trains, les bateaux, les bombes et les noms, à la taille de l'écran.
// Les noms, coûteux à écrire, vivent sur leur propre calque, redessiné seulement quand c'est utile.
import { flagEmoji } from '../../geo/countries'
import { allied, isBorder, isLand, isTraitor, player, SHORE, type Game, type Nuke, type Unit } from './engine'
import type { Anchor } from './labels'
import { ICON } from './RadialMenu'
import { BLAST, BUILD_TICKS, samRange, SAM_COOLDOWN, SILO_COOLDOWN } from './rules'

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
  info: RGB
  warn: RGB
  gold: RGB
  water: RGB
  shallow: RGB
  land: RGB
  coast: RGB
  fallout: RGB
  rail: RGB
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
    info: get('--info'),
    warn: get('--warn'),
    gold: get('--or'),
    water: get('--bg2'),
    shallow: mix(get('--bg2'), land, 0.35),
    land,
    coast: mix(land, fg, 0.12),
    fallout: mix(land, get('--good'), 0.4),
    rail: mix(fg, bg, 0.45),
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
    if (o) this.px[t] = isBorder(g, t) ? this.edge[o - 1] : this.fill[o - 1]
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

// Le calque des noms. Le réécrire coûte cher : pendant un geste, on déplace et on agrandit l'image déjà faite,
// et on ne la réécrit qu'une fois la vue posée, au plus toutes les 250 ms (chaque seconde si l'on fait glisser longtemps).
export class Labels {
  readonly canvas = document.createElement('canvas')
  private ctx = this.canvas.getContext('2d')!
  private stamps = new Stamps()
  private drawn: View = { s: 1, x: 0, y: 0 }
  private size = ''
  private at = 0
  private last = ''
  private moved = 0

  draw(target: CanvasRenderingContext2D, g: Game, pal: Palette, view: View, cw: number, ch: number, anchors: Anchor[], me: number, now: number) {
    const dpr = devicePixelRatio
    const size = `${cw}|${ch}|${dpr}`
    const key = `${view.s}|${view.x}|${view.y}`
    if (key !== this.last) {
      this.last = key
      this.moved = now
    }
    const shifted = view.s !== this.drawn.s || view.x !== this.drawn.x || view.y !== this.drawn.y
    const still = now - this.moved > 150
    const panning = view.s === this.drawn.s
    if (size !== this.size || (panning && now - this.at > 1000) || (still && (shifted || now - this.at > 250))) {
      if (size !== this.size) {
        this.canvas.width = Math.round(cw * dpr)
        this.canvas.height = Math.round(ch * dpr)
        this.size = size
      }
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      this.ctx.clearRect(0, 0, cw, ch)
      this.stamps.budget = 40
      const done = names(this.ctx, this.stamps, g, pal, view, cw, ch, anchors, me, dpr)
      this.drawn = { s: view.s, x: view.x, y: view.y }
      // s'il reste des noms à préparer, on y revient dès l'image suivante
      this.at = done ? now : now - 250
    }
    const k = view.s / this.drawn.s
    target.drawImage(this.canvas, view.x - this.drawn.x * k, view.y - this.drawn.y * k, cw * k, ch * k)
  }
}

const FONT = 'Ubuntu, system-ui, sans-serif'

// Des textes déjà tracés, contour compris, prêts à recopier : écrire un drapeau en emoji est lent, le recopier ne l'est pas.
class Stamps {
  private cache = new Map<string, HTMLCanvasElement>()
  // largeur de chaque texte à 100 px, d'où l'on déduit toutes les autres tailles
  private widths = new Map<string, number>()
  private probe = document.createElement('canvas').getContext('2d')!
  // nombre de vignettes qu'on peut encore créer pour cette image : après un zoom, on les prépare en plusieurs fois
  budget = 0

  width(text: string, weight: number, size: number) {
    const key = `${weight}|${text}`
    let w = this.widths.get(key)
    if (w === undefined) {
      this.probe.font = `${weight} 100px ${FONT}`
      this.widths.set(key, (w = this.probe.measureText(text).width))
    }
    return (w * size) / 100
  }

  // pose le texte centré sur (x, y) ; faux s'il a fallu le remettre à plus tard
  put(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, fill: string, outline: string, dpr: number, x: number, y: number) {
    const w = this.width(text, weight, size) + 6
    const h = size * 1.6
    const key = `${weight}|${size}|${fill}|${outline}|${dpr}|${text}`
    let stamp = this.cache.get(key)
    if (!stamp) {
      if (this.budget <= 0) return false
      this.budget--
      if (this.cache.size > 1500) this.cache.clear()
      stamp = document.createElement('canvas')
      stamp.width = Math.ceil(w * dpr)
      stamp.height = Math.ceil(h * dpr)
      const c = stamp.getContext('2d')!
      c.scale(dpr, dpr)
      c.font = `${weight} ${size}px ${FONT}`
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.lineJoin = 'round'
      c.lineWidth = 3
      c.strokeStyle = outline
      c.fillStyle = fill
      c.strokeText(text, w / 2, h / 2)
      c.fillText(text, w / 2, h / 2)
      this.cache.set(key, stamp)
    }
    ctx.drawImage(stamp, x - w / 2, y - h / 2, w, h)
    return true
  }
}

const GLYPHS = new Map<string, Path2D>()
const glyphOf = (type: string) => {
  let path = GLYPHS.get(type)
  if (!path) GLYPHS.set(type, (path = new Path2D(ICON[type as keyof typeof ICON])))
  return path
}

// Une pastille de bâtiment : disque aux couleurs du pays, pictogramme au trait, anneau de chantier ou de recharge,
// et le niveau dans un petit rond quand il dépasse 1.
function badge(ctx: CanvasRenderingContext2D, u: Unit, x: number, y: number, r: number, pal: Palette, tick: number) {
  const fill = pal.players[u.owner - 1]
  const building = u.ready > tick
  ctx.globalAlpha = building ? 0.55 : 1
  ctx.beginPath()
  ctx.arc(x, y, r, 0, 2 * Math.PI)
  ctx.fillStyle = css(fill)
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = css(pal.bg)
  ctx.stroke()
  ctx.save()
  ctx.translate(x - r * 0.62, y - r * 0.62)
  ctx.scale((r * 1.24) / 24, (r * 1.24) / 24)
  ctx.lineWidth = 2.4
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = css(pal.bg)
  ctx.stroke(glyphOf(u.type))
  ctx.restore()
  ctx.globalAlpha = 1
  // chantier : un arc qui se remplit ; silo et défense : la recharge du prochain tir
  let share = 0
  let color = pal.fg
  if (building) share = 1 - (u.ready - tick) / Math.max(1, BUILD_TICKS[u.type])
  else if (u.type === 'silo' || u.type === 'dca') {
    const next = Math.min(...u.slots)
    if (next > tick) {
      share = 1 - (next - tick) / (u.type === 'silo' ? SILO_COOLDOWN : SAM_COOLDOWN)
      color = pal.warn
    }
  }
  if (share > 0) {
    ctx.beginPath()
    ctx.arc(x, y, r + 2.5, -Math.PI / 2, -Math.PI / 2 + share * 2 * Math.PI)
    ctx.lineWidth = 2
    ctx.strokeStyle = css(color)
    ctx.stroke()
  }
  if (u.level > 1) {
    const bx = x + r * 0.8
    const by = y - r * 0.8
    ctx.beginPath()
    ctx.arc(bx, by, r * 0.5, 0, 2 * Math.PI)
    ctx.fillStyle = css(pal.fg)
    ctx.fill()
    ctx.fillStyle = css(pal.bg)
    ctx.font = `600 ${Math.round(r * 0.75)}px Ubuntu, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(u.level), bx, by + 0.5)
    ctx.textBaseline = 'alphabetic'
  }
}

type BoatKind = 'transport' | 'commerce' | 'guerre'

// Un bateau vu du dessus, la proue vers `angle`, avec un sillage en V quand il avance.
function boat(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, length: number, fill: RGB, pal: Palette, kind: BoatKind) {
  const w = length * (kind === 'commerce' ? 0.36 : 0.42)
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  // sillage
  ctx.beginPath()
  ctx.moveTo(-length * 0.45, -w * 0.3)
  ctx.lineTo(-length * 1.05, -w * 0.9)
  ctx.moveTo(-length * 0.45, w * 0.3)
  ctx.lineTo(-length * 1.05, w * 0.9)
  ctx.strokeStyle = css(pal.fg, 0.35)
  ctx.lineWidth = 1
  ctx.stroke()
  // coque
  const hull = kind === 'guerre' ? mix(fill, pal.bg, 0.25) : fill
  ctx.beginPath()
  ctx.moveTo(length * 0.55, 0)
  ctx.quadraticCurveTo(length * 0.32, -w / 2, 0, -w / 2)
  ctx.lineTo(-length * 0.4, -w / 2)
  ctx.quadraticCurveTo(-length * 0.5, 0, -length * 0.4, w / 2)
  ctx.lineTo(0, w / 2)
  ctx.quadraticCurveTo(length * 0.32, w / 2, length * 0.55, 0)
  ctx.closePath()
  ctx.fillStyle = css(hull)
  ctx.fill()
  ctx.lineWidth = 1.2
  ctx.strokeStyle = css(pal.bg)
  ctx.stroke()
  if (kind === 'transport') {
    // le pont des troupes
    ctx.fillStyle = css(mix(fill, pal.fg, 0.45))
    ctx.fillRect(-length * 0.28, -w * 0.24, length * 0.45, w * 0.48)
    ctx.strokeRect(-length * 0.28, -w * 0.24, length * 0.45, w * 0.48)
  } else if (kind === 'commerce') {
    // trois conteneurs de couleurs différentes
    const colors = [pal.gold, pal.info, pal.bad]
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = css(colors[i])
      ctx.fillRect(-length * 0.32 + i * length * 0.2, -w * 0.28, length * 0.17, w * 0.56)
    }
  } else {
    // tourelle et canon
    ctx.fillStyle = css(pal.bg)
    ctx.beginPath()
    ctx.arc(-length * 0.05, 0, w * 0.3, 0, 2 * Math.PI)
    ctx.fill()
    ctx.fillRect(-length * 0.05, -w * 0.07, length * 0.45, w * 0.14)
  }
  ctx.restore()
}

// Une bombe en vol : ogive, corps et ailerons.
function missile(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, length: number, fill: RGB, outline: RGB) {
  const w = length * 0.3
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.beginPath()
  ctx.moveTo(length / 2, 0)
  ctx.lineTo(length * 0.2, -w / 2)
  ctx.lineTo(-length * 0.4, -w / 2)
  ctx.lineTo(-length * 0.55, -w)
  ctx.lineTo(-length * 0.55, w)
  ctx.lineTo(-length * 0.4, w / 2)
  ctx.lineTo(length * 0.2, w / 2)
  ctx.closePath()
  ctx.fillStyle = css(fill)
  ctx.fill()
  ctx.lineWidth = 1.2
  ctx.strokeStyle = css(outline)
  ctx.stroke()
  ctx.restore()
}

// Où est une bombe à l'écran : en ligne droite du silo à la cible, relevée en arc.
function nukePos(n: Nuke, tick: number, alpha: number, sx: (t: number) => number, sy: (t: number) => number) {
  return arcAt(n, Math.min(1, Math.max(0, (tick - n.start + alpha) / n.ticks)), sx, sy)
}

// le point de l'arc à la part k du trajet
function arcAt(n: Nuke, k: number, sx: (t: number) => number, sy: (t: number) => number) {
  const x0 = sx(n.from)
  const y0 = sy(n.from)
  const x1 = sx(n.dst)
  const y1 = sy(n.dst)
  const arc = Math.hypot(x1 - x0, y1 - y0) * 0.25
  return { x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k - Math.sin(Math.PI * k) * arc, k }
}

// Un gain d'or affiché sur la carte : il monte au-dessus de sa case et s'efface.
export interface Float {
  tile: number
  text: string
  at: number
}

export const FLOAT_MS = 2000

// Ce que l'interface pose par-dessus la partie : la zone d'une bombe qu'on vise, l'or gagné,
// les marques au-dessus des noms (cible, emojis) et le navire de guerre qu'on dirige.
export interface Overlay {
  preview: Preview | null
  floats: Float[]
  marks: Map<number, string>
  ship: number
}

export interface Preview {
  tile: number
  inner: number
  outer: number
}

// `alpha` : la part du tour suivant déjà écoulée, pour faire glisser bateaux, trains et bombes entre deux tours.
export function draw(
  ctx: CanvasRenderingContext2D,
  painter: Painter,
  labelsLayer: Labels,
  g: Game,
  view: View,
  cw: number,
  ch: number,
  anchors: Anchor[],
  me: number,
  alpha: number,
  now: number,
  overlay: Overlay,
) {
  const { preview, floats, marks, ship } = overlay
  const pal = painter.pal
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
  ctx.fillStyle = css(pal.water)
  ctx.fillRect(0, 0, cw, ch)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(painter.image, view.x, view.y, g.w * view.s, g.h * view.s)
  const sx = (t: number) => view.x + ((t % g.w) + 0.5) * view.s
  const sy = (t: number) => view.y + (Math.floor(t / g.w) + 0.5) * view.s
  const visible = (x: number, y: number) => x > -40 && y > -40 && x < cw + 40 && y < ch + 40
  const at = (path: Int32Array, i: number) => {
    const a = path[Math.min(Math.floor(i), path.length - 1)]
    const b = path[Math.min(Math.floor(i) + 1, path.length - 1)]
    const f = i - Math.floor(i)
    return { x: sx(a) + (sx(b) - sx(a)) * f, y: sy(a) + (sy(b) - sy(a)) * f, angle: Math.atan2(sy(b) - sy(a), sx(b) - sx(a)) }
  }

  // les fronts : en bleu les cases que tu attaques, en rouge celles qu'on t'attaque, avec les troupes engagées
  const dot = Math.max(1, view.s)
  const fronts: { x: number; y: number; troops: number; mine: boolean }[] = []
  for (const a of g.attacks) {
    const mine = a.from === me
    if ((!mine && a.to !== me) || !a.front.size) continue
    ctx.fillStyle = css(mine ? pal.info : pal.bad, 0.85)
    const seen: number[] = []
    let mx = 0
    let my = 0
    for (const t of a.front) {
      const x = sx(t)
      const y = sy(t)
      if (!visible(x, y)) continue
      ctx.fillRect(x - dot / 2, y - dot / 2, dot, dot)
      seen.push(x, y)
      mx += x
      my += y
    }
    if (!seen.length) continue
    // le chiffre se pose sur la ligne de front, à la case la plus proche du milieu de sa partie visible :
    // un front qui t'encercle a son milieu chez toi, loin des combats
    mx /= seen.length / 2
    my /= seen.length / 2
    let best = 0
    for (let i = 2; i < seen.length; i += 2)
      if ((seen[i] - mx) ** 2 + (seen[i + 1] - my) ** 2 < (seen[best] - mx) ** 2 + (seen[best + 1] - my) ** 2) best = i
    fronts.push({ x: seen[best], y: seen[best + 1], troops: a.troops, mine })
  }

  // rails : une voie avec ses traverses quand on est assez près
  if (g.rails.length) {
    ctx.strokeStyle = css(pal.rail, 0.8)
    for (const r of g.rails) {
      ctx.beginPath()
      ctx.moveTo(sx(r.path[0]), sy(r.path[0]))
      ctx.lineTo(sx(r.path[r.path.length - 1]), sy(r.path[r.path.length - 1]))
      ctx.lineWidth = Math.max(1, view.s * 0.5)
      ctx.setLineDash([])
      ctx.stroke()
      if (view.s >= 1.5) {
        ctx.lineWidth = view.s * 1.6
        ctx.setLineDash([view.s * 0.35, view.s * 1.2])
        ctx.stroke()
      }
    }
    ctx.setLineDash([])
  }

  // portée des défenses antiaériennes du joueur, en pointillés discrets
  ctx.setLineDash([4, 6])
  ctx.lineWidth = 1
  ctx.strokeStyle = css(pal.info, 0.35)
  for (const u of g.units)
    if (u.type === 'dca' && u.owner === me && u.ready <= g.tick) {
      ctx.beginPath()
      ctx.arc(sx(u.tile), sy(u.tile), samRange(u.level) * view.s, 0, 2 * Math.PI)
      ctx.stroke()
    }
  ctx.setLineDash([])

  // bâtiments
  const r = Math.min(11, Math.max(6, view.s * 3))
  for (const u of g.units) {
    if (u.type === 'navire') continue
    const x = sx(u.tile)
    const y = sy(u.tile)
    if (visible(x, y)) badge(ctx, u, x, y, r, pal, g.tick)
  }

  // trains : trois voitures qui suivent la voie
  const car = Math.max(3, view.s * 2)
  for (const tr of g.trains) {
    for (let i = 0; i < 3; i++) {
      const p = at(tr.path, Math.max(0, tr.at + alpha * 2 - i * 2.2))
      if (!visible(p.x, p.y)) continue
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.angle)
      ctx.fillStyle = css(i === 0 ? mix(pal.players[tr.owner - 1], pal.bg, 0.3) : pal.players[tr.owner - 1])
      ctx.fillRect(-car, -car * 0.45, car * 1.8, car * 0.9)
      ctx.lineWidth = 1
      ctx.strokeStyle = css(pal.bg)
      ctx.strokeRect(-car, -car * 0.45, car * 1.8, car * 0.9)
      ctx.restore()
    }
  }

  // le sillage des bateaux de débarquement, case par case ; rouge s'ils viennent sur toi
  const wake = Math.max(1.5, view.s * 0.6)
  for (const b of g.boats) {
    if (b.trade || b.at < 1) continue
    const end = Math.min(b.at, b.path.length - 1)
    const stride = Math.max(1, Math.floor(end / 200))
    ctx.fillStyle = css(b.to === me ? pal.bad : pal.players[b.owner - 1], 0.55)
    for (let i = 0; i < end; i += stride) {
      const x = sx(b.path[i])
      const y = sy(b.path[i])
      if (visible(x, y)) ctx.fillRect(x - wake / 2, y - wake / 2, wake, wake)
    }
  }

  // les bateaux, aux couleurs de leur pays et tournés dans leur sens de marche
  const hull = Math.min(30, Math.max(14, view.s * 5.5))
  for (const b of g.boats) {
    const p = at(b.path, Math.min(b.at + alpha, b.path.length - 1))
    if (!visible(p.x, p.y)) continue
    boat(ctx, p.x, p.y, p.angle, b.trade ? hull * 0.85 : hull, pal.players[b.owner - 1], pal, b.trade ? 'commerce' : 'transport')
    if (b.trade || view.s < 1) continue
    const owner = player(g, b.owner)
    ctx.font = `600 ${Math.round(hull * 0.65)}px Ubuntu, system-ui, sans-serif`
    ctx.textAlign = 'center'
    const text = `${owner.code ? flagEmoji(owner.code) + ' ' : ''}${troopsText(b.troops)}`
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.strokeStyle = css(pal.bg)
    ctx.strokeText(text, p.x, p.y - hull * 0.75)
    ctx.fillStyle = css(b.to === me ? pal.bad : b.owner === me ? pal.info : pal.fg)
    ctx.fillText(text, p.x, p.y - hull * 0.75)
  }
  for (const u of g.units) {
    if (u.type !== 'navire') continue
    const x = sx(u.tile)
    const y = sy(u.tile)
    if (!visible(x, y)) continue
    const ahead = u.route ? u.route[Math.min((u.step ?? 0) + 1, u.route.length - 1)] : u.goal
    const angle = ahead >= 0 && ahead !== u.tile ? Math.atan2(sy(ahead) - y, sx(ahead) - x) : 0
    boat(ctx, x, y, angle, hull * 1.25, pal.players[u.owner - 1], pal, 'guerre')
    if (u.id === ship) {
      ctx.beginPath()
      ctx.arc(x, y, hull, 0, 2 * Math.PI)
      ctx.lineWidth = 2
      ctx.strokeStyle = css(pal.info)
      ctx.stroke()
    }
  }

  // obus
  ctx.fillStyle = css(pal.fg)
  for (const s of g.shells) {
    const k = Math.min(1, 1 - (s.hit - g.tick - alpha) / 4)
    ctx.fillRect(sx(s.from) + (sx(s.tile) - sx(s.from)) * k - 1, sy(s.from) + (sy(s.tile) - sy(s.from)) * k - 1, 2, 2)
  }

  // bombes : la trajectoire, la zone visée cerclée, l'engin sur sa courbe ; les tiennes en bleu
  for (const n of g.nukes) {
    if (g.tick < n.start) continue
    const color = n.owner === me ? pal.info : pal.bad
    const p = nukePos(n, g.tick, alpha, sx, sy)
    if (n.type !== 'ogive') {
      const blast = BLAST[n.type === 'mirv' ? 'ogive' : n.type]
      ctx.setLineDash([4, 4])
      ctx.lineWidth = 1.2
      ctx.strokeStyle = css(color, 0.7)
      ctx.beginPath()
      ctx.arc(sx(n.dst), sy(n.dst), blast.outer * view.s, 0, 2 * Math.PI)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.arc(sx(n.dst), sy(n.dst), blast.inner * view.s, 0, 2 * Math.PI)
      ctx.fillStyle = css(color, 0.12)
      ctx.fill()
    }
    // la traînée du trajet déjà fait, puis l'engin pointé dans le sens de sa course
    ctx.beginPath()
    for (let i = 0; i <= 16; i++) {
      const q = arcAt(n, (p.k * i) / 16, sx, sy)
      if (i) ctx.lineTo(q.x, q.y)
      else ctx.moveTo(q.x, q.y)
    }
    ctx.setLineDash([2, 3])
    ctx.lineWidth = 1.2
    ctx.strokeStyle = css(color, 0.5)
    ctx.stroke()
    ctx.setLineDash([])
    const ahead = arcAt(n, Math.min(1, p.k + 0.01), sx, sy)
    const behind = arcAt(n, Math.max(0, p.k - 0.01), sx, sy)
    missile(ctx, p.x, p.y, Math.atan2(ahead.y - behind.y, ahead.x - behind.x), n.type === 'ogive' ? 8 : n.type === 'hbombe' ? 15 : 12, color, pal.bg)
  }

  // missiles antiaériens : du lanceur vers la bombe qu'ils vont abattre
  for (const m of g.missiles) {
    const n = g.nukes.find((x) => x.id === m.nuke)
    if (!n) continue
    const target = nukePos(n, g.tick, alpha, sx, sy)
    const k = Math.min(1, (g.tick - m.start + alpha) / m.ticks)
    const x = sx(m.from) + (target.x - sx(m.from)) * k
    const y = sy(m.from) + (target.y - sy(m.from)) * k
    ctx.beginPath()
    ctx.moveTo(sx(m.from), sy(m.from))
    ctx.lineTo(x, y)
    ctx.strokeStyle = css(pal.info, 0.5)
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x, y, 2.5, 0, 2 * Math.PI)
    ctx.fillStyle = css(pal.fg)
    ctx.fill()
  }

  // explosions : un anneau qui s'efface en une seconde et demie
  for (const b of g.blasts) {
    const k = (g.tick - b.tick + alpha) / 15
    ctx.beginPath()
    ctx.arc(sx(b.tile), sy(b.tile), b.radius * view.s * (0.6 + 0.4 * k), 0, 2 * Math.PI)
    ctx.fillStyle = css(pal.fg, Math.max(0, 0.35 * (1 - k)))
    ctx.fill()
  }

  // la zone que toucherait la bombe qu'on s'apprête à lancer
  if (preview) {
    const x = sx(preview.tile)
    const y = sy(preview.tile)
    ctx.beginPath()
    ctx.arc(x, y, preview.outer * view.s, 0, 2 * Math.PI)
    ctx.setLineDash([5, 4])
    ctx.lineWidth = 1.5
    ctx.strokeStyle = css(pal.bad)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.arc(x, y, preview.inner * view.s, 0, 2 * Math.PI)
    ctx.fillStyle = css(pal.bad, 0.2)
    ctx.fill()
  }

  labelsLayer.draw(ctx, g, pal, view, cw, ch, anchors, me, now)

  // troupes engagées sur les fronts : bleu pour les tiennes, rouge pour celles qui t'arrivent dessus
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '700 14px Ubuntu, system-ui, sans-serif'
  ctx.lineWidth = 1.5
  ctx.strokeStyle = css(pal.bg)
  for (const f of fronts) {
    const text = `⚔ ${troopsText(f.troops)}`
    const w = ctx.measureText(text).width + 16
    ctx.beginPath()
    ctx.roundRect(f.x - w / 2, f.y - 11, w, 22, 11)
    ctx.fillStyle = css(f.mine ? pal.info : pal.bad)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = css(pal.bg)
    ctx.fillText(text, f.x, f.y + 1)
  }
  ctx.textBaseline = 'alphabetic'

  // cible et emojis, au-dessus du nom
  ctx.font = '20px Ubuntu, system-ui, sans-serif'
  for (const a of anchors) {
    const mark = marks.get(a.id)
    if (!mark) continue
    const x = view.x + (a.x + 0.5) * view.s
    const y = view.y + (a.y + 0.5) * view.s - 28
    if (visible(x, y)) ctx.fillText(mark, x, y)
  }

  ctx.font = '700 14px Ubuntu, system-ui, sans-serif'
  ctx.lineWidth = 3
  ctx.lineJoin = 'round'
  for (const f of floats) {
    const age = (now - f.at) / FLOAT_MS
    const x = sx(f.tile)
    const y = sy(f.tile) - 10 - age * 26
    if (age >= 1 || !visible(x, y)) continue
    ctx.globalAlpha = 1 - age * age
    ctx.strokeText(f.text, x, y)
    ctx.fillStyle = css(pal.gold)
    ctx.fillText(f.text, x, y)
  }
  ctx.globalAlpha = 1
}

// Noms et troupes : couronne pour le premier, alliés en vert, traîtres en rouge.
function names(ctx: CanvasRenderingContext2D, stamps: Stamps, g: Game, pal: Palette, view: View, cw: number, ch: number, anchors: Anchor[], me: number, dpr: number) {
  let done = true
  const outline = css(pal.bg)
  const leader = g.players.reduce((best, p) => (p.alive && p.tiles > best.tiles ? p : best), g.players[0])
  for (const a of anchors) {
    const p = player(g, a.id)
    if (!p.alive) continue
    const x = view.x + (a.x + 0.5) * view.s
    const y = view.y + (a.y + 0.5) * view.s
    if (x < -100 || y < -40 || x > cw + 100 || y > ch + 40) continue
    const room = Math.sqrt(a.cells) * view.s * 1.1
    const badge = (p === leader ? '👑 ' : '') + (isTraitor(g, p) ? '⚠️ ' : '') + (p.id !== me && allied(g, p.id, me) ? '🤝 ' : '')
    const name = `${badge}${p.code ? flagEmoji(p.code) + ' ' : ''}${p.name}`
    let size = Math.min(22, room * 0.3)
    const width = stamps.width(name, 500, size)
    if (width > room) size *= room / width
    // des tailles par paliers, pour retrouver les mêmes vignettes d'un zoom à l'autre
    size = size < 14 ? Math.round(size) : Math.round(size / 2) * 2
    if (size < 9) continue
    const color = isTraitor(g, p) ? pal.bad : p.id !== me && allied(g, p.id, me) ? pal.good : pal.fg
    if (!stamps.put(ctx, name, 500, size, css(color), outline, dpr, x, y - size * 0.35)) done = false
    if (!stamps.put(ctx, troopsText(p.troops), 400, Math.round(size * 0.8), css(color), outline, dpr, x, y + size * 0.6)) done = false
  }
  return done
}

// OpenFront compte ses troupes par dizaines et n'en affiche que le dixième : 25 000 au départ s'affichent 2,5k.
export const troopsText = (n: number) => compact(n / 10)

export const compact = (n: number) => {
  const v = Math.floor(n)
  return v >= 1e6 ? `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)}k` : String(v)
}
