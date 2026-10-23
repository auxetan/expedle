// Les sprites et effets d'OpenFront (© OpenFront and Contributors, CC BY-SA 4.0, voir sprites/LICENSE.md).
// Les unités sont de minuscules dessins en niveaux de gris, à un pixel par case, dont chaque gris prend une
// couleur du joueur ; les effets sont des planches d'images jouées à leur cadence d'origine.
import atombomb from './sprites/atombomb.png'
import fxAtlas from './sprites/fx-atlas.png'
import hydrogenbomb from './sprites/hydrogenbomb.png'
import mirv from './sprites/mirv.png'
import samMissile from './sprites/samMissile.png'
import tradeship from './sprites/tradeship.png'
import trainCarriage from './sprites/trainCarriage.png'
import trainEngine from './sprites/trainEngine.png'
import transportship from './sprites/transportship.png'
import warship from './sprites/warship.png'

type RGB = number[]

const SPRITES = { transport: transportship, commerce: tradeship, guerre: warship, bombe: atombomb, hbombe: hydrogenbomb, mirv, sam: samMissile, loco: trainEngine, wagon: trainCarriage }
export type SpriteKey = keyof typeof SPRITES

// les teintes qui font clignoter une bombe en vol
export const FLICKER: RGB[] = [
  [255, 0, 0],
  [255, 128, 0],
  [255, 255, 0],
  [255, 255, 255],
]

const PIXELS = new Map<string, ImageData | null>()
const RECOLORED = new Map<string, HTMLCanvasElement>()

function pixelsOf(src: string): ImageData | null {
  if (PIXELS.has(src)) return PIXELS.get(src)!
  PIXELS.set(src, null)
  const img = new Image()
  img.onload = () => {
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const ctx = c.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    PIXELS.set(src, ctx.getImageData(0, 0, img.width, img.height))
  }
  img.src = src
  return null
}

// Un sprite aux couleurs d'un joueur : le gris clair (180) prend sa teinte, le moyen (130) un mélange,
// le centre (100) sa teinte aussi, le foncé (70) sa bordure — la règle des quatre bandes d'OpenFront.
export function sprite(key: SpriteKey, light: RGB, dark: RGB): HTMLCanvasElement | null {
  const data = pixelsOf(SPRITES[key])
  if (!data) return null
  const id = `${key}|${light}|${dark}`
  let canvas = RECOLORED.get(id)
  if (!canvas) {
    if (RECOLORED.size > 800) RECOLORED.clear()
    canvas = document.createElement('canvas')
    canvas.width = data.width
    canvas.height = data.height
    const out = new ImageData(data.width, data.height)
    const mid = light.map((v, i) => Math.round((v + dark[i]) / 2))
    for (let i = 0; i < data.data.length; i += 4) {
      if (!data.data[i + 3]) continue
      const gray = data.data[i] / 255
      const color = gray > 0.6 ? light : gray > 0.45 ? mid : gray > 0.34 ? light : dark
      out.data[i] = color[0]
      out.data[i + 1] = color[1]
      out.data[i + 2] = color[2]
      out.data[i + 3] = data.data[i + 3]
    }
    canvas.getContext('2d')!.putImageData(out, 0, 0)
    RECOLORED.set(id, canvas)
  }
  return canvas
}

// pose un sprite centré, à raison de `scale` pixels d'écran par pixel du dessin
export function stamp(ctx: CanvasRenderingContext2D, image: HTMLCanvasElement, x: number, y: number, scale: number) {
  const w = image.width * scale
  const h = image.height * scale
  ctx.drawImage(image, Math.round(x - w / 2), Math.round(y - h / 2), w, h)
}

// --- effets ---

export type FxKind = 'nuke' | 'sam' | 'building' | 'unit' | 'mini' | 'sinking' | 'fire' | 'smoke' | 'bigsmoke' | 'smokefire' | 'dust' | 'conquest' | 'shock' | 'samshock'

export interface Fx {
  kind: FxKind
  tile: number
  at: number
  life: number
  // parts de la vie passées à apparaître et à s'effacer
  fadeIn: number
  fadeOut: number
  // rayon des ondes de choc, en cases
  radius?: number
}

// Les rangées de la planche d'effets d'OpenFront : position, taille d'une image en cases, nombre d'images,
// durée de chacune, et si l'animation boucle.
const ROWS: Partial<Record<FxKind, { y: number; w: number; h: number; frames: number; ms: number; loop: boolean }>> = {
  nuke: { y: 0, w: 60, h: 60, frames: 9, ms: 70, loop: false },
  sam: { y: 60, w: 48, h: 38, frames: 9, ms: 70, loop: false },
  building: { y: 98, w: 17, h: 15, frames: 10, ms: 70, loop: false },
  unit: { y: 113, w: 19, h: 19, frames: 4, ms: 70, loop: false },
  mini: { y: 132, w: 13, h: 12, frames: 4, ms: 70, loop: false },
  sinking: { y: 144, w: 16, h: 14, frames: 14, ms: 90, loop: false },
  fire: { y: 158, w: 7, h: 13, frames: 6, ms: 100, loop: true },
  smoke: { y: 171, w: 11, h: 12, frames: 4, ms: 120, loop: true },
  bigsmoke: { y: 183, w: 24, h: 16, frames: 5, ms: 120, loop: true },
  smokefire: { y: 199, w: 24, h: 16, frames: 5, ms: 120, loop: true },
  dust: { y: 215, w: 9, h: 7, frames: 3, ms: 100, loop: false },
  conquest: { y: 222, w: 21, h: 20, frames: 10, ms: 90, loop: false },
}

// un effet joué une fois, qui s'efface pendant toute sa durée
export function oneShot(kind: FxKind, tile: number, at: number): Fx {
  const row = ROWS[kind]!
  return { kind, tile, at, life: row.frames * row.ms, fadeIn: 0, fadeOut: 1 }
}

// les débris d'une bombe : feux et fumées éparpillés dans la moitié de son rayon, pendant six secondes
const DEBRIS: [FxKind, number, number][] = [
  ['fire', 1, 1 / 25],
  ['smoke', 1, 1 / 28],
  ['bigsmoke', 0.9, 1 / 70],
  ['smokefire', 0.9, 1 / 70],
]

// tirage reproductible, pour que deux écrans voient les mêmes débris
function seeded(seed: number) {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// Une bombe qui touche : l'explosion, son onde de choc, puis les débris. `radius` : rayon d'effet d'OpenFront.
export function nukeFx(tile: number, radius: number, w: number, at: number): Fx[] {
  const out: Fx[] = [oneShot('nuke', tile, at), { kind: 'shock', tile, at, life: 1500, fadeIn: 0, fadeOut: 1, radius: radius * 1.5 }]
  let i = 0
  for (const [kind, reach, density] of DEBRIS)
    for (let n = 0; n < Math.floor(radius * density); n++) {
      const seed = tile * 997 + i++
      const angle = seeded(seed) * Math.PI * 2
      const dist = seeded(seed + 0x10000) * ((radius * reach) / 2)
      const t = tile + Math.floor(Math.sin(angle) * dist) * w + Math.floor(Math.cos(angle) * dist)
      out.push({ kind, tile: t, at, life: 6000, fadeIn: 0.1, fadeOut: 0.8 })
    }
  return out
}

let atlas: HTMLImageElement | null = null

// Dessine un effet ; faux quand il est fini.
export function drawFx(ctx: CanvasRenderingContext2D, fx: Fx, now: number, x: number, y: number, scale: number): boolean {
  const age = now - fx.at
  if (age >= fx.life) return false
  if (age < 0) return true
  const k = age / fx.life
  let alpha = 1
  if (fx.fadeIn) alpha = Math.min(alpha, k / fx.fadeIn)
  if (fx.fadeOut) alpha = Math.min(alpha, (1 - k) / fx.fadeOut)
  if (fx.kind === 'shock' || fx.kind === 'samshock') {
    ctx.beginPath()
    ctx.arc(x, y, (fx.radius ?? 40) * scale * k, 0, 2 * Math.PI)
    ctx.lineWidth = Math.max(1, (fx.radius ?? 40) * scale * 0.04)
    ctx.strokeStyle = `rgba(255,255,255,${0.6 * alpha})`
    ctx.stroke()
    return true
  }
  const row = ROWS[fx.kind]!
  if (!atlas) {
    atlas = new Image()
    atlas.src = fxAtlas
  }
  if (!atlas.complete) return true
  const frame = row.loop ? Math.floor(age / row.ms) % row.frames : Math.min(row.frames - 1, Math.floor(age / row.ms))
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha))
  ctx.drawImage(atlas, frame * row.w, row.y, row.w, row.h, Math.round(x - (row.w * scale) / 2), Math.round(y - (row.h * scale) / 2), row.w * scale, row.h * scale)
  ctx.globalAlpha = 1
  return true
}
