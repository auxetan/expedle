import { useEffect, useRef, useState } from 'react'
import { countryName } from '../../geo/countries'
import { feedback } from '../../lib/feedback'
import { fmt, msg, t } from '../../lib/i18n'
import { recordPlay } from '../../lib/stats'
import { copyText, formatTime, load, save } from '../../lib/util'
import AppBar from '../../ui/AppBar'
import { loadProfile } from '../../ui/Panels'
import { LEVELS, runBots, type Level } from './bots'
import { addPlayer, attackAt, buildCity, cityCost, createGame, MAX_BOATS, maxTroops, NEUTRAL, player, spawn, step, WATER, WIN_SHARE, winner, type Game } from './engine'
import { anchors, type Anchor } from './labels'
import { worldMap } from './map'
import './openfront.css'

const TICK = 100
const ME = 1
const BOTS: Record<Level, number> = { facile: 12, normal: 16, difficile: 20 }
const LEVEL_NAMES: Record<Level, string> = { facile: msg('Facile'), normal: msg('Normal'), difficile: msg('Difficile') }
// une teinte par bot, espacées par l'angle d'or, dans les tons sourds du site (clarté réglée par le thème)
const hue = (id: number) => Math.round((id * 137.508) % 360)

type Phase = 'spawn' | 'play' | 'end'

interface Hud {
  troops: number
  max: number
  gold: number
  cost: number
  boats: number
  top: { id: number; name: string; share: number }[]
}

interface Result {
  win: boolean
  share: number
  ms: number
  by: string
}

function newGame(level: Level, name: string): Game {
  const map = worldMap()
  const g = createGame(map)
  addPlayer(g, name, true)
  // les bots prennent la place de vrais pays, assez loin les uns des autres
  const seats: number[] = []
  // tirage pondéré par la taille : les grands pays sortent plus souvent, et les bots couvrent tout le globe
  const order = map.seats.map((s) => ({ s, k: Math.random() ** (1 / Math.sqrt(s.size)) })).sort((a, b) => b.k - a.k)
  for (const { s } of order) {
    if (seats.length >= BOTS[level]) break
    const x = s.cell % g.w
    const y = Math.floor(s.cell / g.w)
    if (seats.some((c) => Math.hypot((c % g.w) - x, Math.floor(c / g.w) - y) < 14)) continue
    seats.push(s.cell)
    spawn(g, addPlayer(g, countryName(s.code)).id, s.cell)
  }
  return g
}

const percent = (share: number) => fmt(share * 100, { maximumFractionDigits: share < 0.1 ? 1 : 0 })
const compact = (n: number) => fmt(Math.floor(n), { notation: 'compact', maximumFractionDigits: 1 })

function hsl(h: number, s: number, l: number): number[] {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
  }
  return [f(0), f(8), f(4)]
}

function rgb(hex: string): [number, number, number] {
  const m = hex.trim().match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i)
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [128, 128, 128]
}

const mix = (a: number[], b: number[], k: number) => a.map((v, i) => Math.round(v * (1 - k) + b[i] * k))
const pack = ([r, g, b]: number[]) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
const css = ([r, g, b]: number[]) => `rgb(${r},${g},${b})`

// Couleurs lues dans le thème du site : la mer, la terre libre, toi en couleur du texte, puis une teinte par bot.
function palette(el: Element, players: number) {
  const style = getComputedStyle(el)
  const get = (v: string) => rgb(style.getPropertyValue(v))
  const bg = get('--bg')
  const fg = get('--fg')
  const light = parseFloat(style.getPropertyValue('--of-l')) / 100
  // deux clartés en alternance pour que deux teintes voisines restent distinctes
  const colors = [fg, ...Array.from({ length: players - 1 }, (_, i) => hsl(hue(i + 2), 0.38, light + (i % 2 ? 0.06 : -0.06)))]
  return {
    bg,
    fg,
    water: get('--bg2'),
    neutral: get('--line'),
    player: colors,
    fill: colors.map(pack),
    edge: colors.map((c) => pack(mix(c, bg, 0.45))),
  }
}

export default function OpenFront() {
  const [level, setLevel] = useState<Level>(() => load<Level>('openfront-level', 'normal'))
  const [name] = useState(() => loadProfile().name || t('Toi'))
  const [game, setGame] = useState(() => newGame(level, name))
  const [phase, setPhase] = useState<Phase>('spawn')
  const [ratio, setRatio] = useState(() => load('openfront-ratio', 40))
  const [speed, setSpeed] = useState(1)
  const [building, setBuilding] = useState(false)
  const [hud, setHud] = useState<Hud | null>(null)
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // les gestes sur la carte lisent ces valeurs sans relancer la boucle de jeu
  const live = useRef({ phase, ratio, building, speed })
  live.current = { phase, ratio, building, speed }
  const sayTimer = useRef(0)

  function say(text: string) {
    setMessage(text)
    clearTimeout(sayTimer.current)
    sayTimer.current = window.setTimeout(() => setMessage(''), 2200)
  }

  function restart(next = level) {
    setGame(newGame(next, name))
    setPhase('spawn')
    setResult(null)
    setBuilding(false)
    setHud(null)
    setSpeed(1)
  }

  function chooseLevel(next: Level) {
    setLevel(next)
    save('openfront-level', next)
    restart(next)
  }

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const g = game
    const me = player(g, ME)
    const image = document.createElement('canvas')
    image.width = g.w
    image.height = g.h
    const ictx = image.getContext('2d')!
    const data = ictx.createImageData(g.w, g.h)
    const px = new Uint32Array(data.data.buffer)
    let colors = palette(canvas, g.players.length)
    let cw = 0
    let ch = 0
    const view = { s: 1, x: 0, y: 0, fit: 1 }
    let started = 0
    let best = 0
    let labels: Anchor[] = []

    const paint = (c: number) => {
      const o = g.owner[c]
      if (o === WATER) px[c] = pack(colors.water)
      else if (o === NEUTRAL) px[c] = pack(colors.neutral)
      else px[c] = player(g, o).border.has(c) ? colors.edge[o - 1] : colors.fill[o - 1]
    }
    const paintAll = () => {
      colors = palette(canvas, g.players.length)
      for (let c = 0; c < g.owner.length; c++) paint(c)
      g.changed.clear()
    }
    paintAll()

    const clamp = () => {
      view.s = Math.min(Math.max(view.s, view.fit), view.fit * 16)
      const mw = g.w * view.s
      const mh = g.h * view.s
      view.x = mw <= cw ? (cw - mw) / 2 : Math.min(0, Math.max(cw - mw, view.x))
      view.y = mh <= ch ? (ch - mh) / 2 : Math.min(0, Math.max(ch - mh, view.y))
    }
    const resize = () => {
      const r = canvas.getBoundingClientRect()
      const first = !cw
      cw = r.width
      ch = r.height
      canvas.width = Math.round(cw * devicePixelRatio)
      canvas.height = Math.round(ch * devicePixelRatio)
      view.fit = Math.min(cw / g.w, ch / g.h)
      if (first) {
        // sur un téléphone en hauteur, le monde entier serait minuscule : on part zoomé, centré, et on fait glisser
        view.s = ch > cw ? Math.min(view.fit * 4, (ch * 0.7) / g.h) : view.fit
        view.x = (cw - g.w * view.s) / 2
        view.y = (ch - g.h * view.s) / 2
      }
      clamp()
    }
    const zoomAt = (x: number, y: number, f: number) => {
      const s = Math.min(Math.max(view.s * f, view.fit), view.fit * 16)
      view.x = x - ((x - view.x) * s) / view.s
      view.y = y - ((y - view.y) * s) / view.s
      view.s = s
      clamp()
    }

    const draw = () => {
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
      ctx.fillStyle = css(colors.water)
      ctx.fillRect(0, 0, cw, ch)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(image, view.x, view.y, g.w * view.s, g.h * view.s)
      const sx = (c: number) => view.x + ((c % g.w) + 0.5) * view.s
      const sy = (c: number) => view.y + (Math.floor(c / g.w) + 0.5) * view.s
      ctx.lineWidth = 1.5
      ctx.strokeStyle = css(colors.bg)
      for (const c of g.cities) {
        if (g.owner[c] <= 0) continue
        const r = Math.max(2.5, view.s * 0.9)
        ctx.fillStyle = css(colors.fg)
        ctx.fillRect(sx(c) - r, sy(c) - r, 2 * r, 2 * r)
        ctx.strokeRect(sx(c) - r, sy(c) - r, 2 * r, 2 * r)
      }
      for (const b of g.boats) {
        const c = b.path[Math.min(b.at, b.path.length - 1)]
        ctx.beginPath()
        ctx.arc(sx(c), sy(c), Math.max(3, view.s * 0.8), 0, 2 * Math.PI)
        ctx.fillStyle = css(colors.player[b.owner - 1])
        ctx.fill()
        ctx.stroke()
      }
      ctx.textAlign = 'center'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 3
      for (const a of labels) {
        const p = player(g, a.id)
        if (!p.alive) continue
        // le nom tient dans la largeur approximative du territoire, sinon il rapetisse puis disparaît
        const room = Math.sqrt(a.cells) * view.s * 1.2
        let size = Math.min(20, room * 0.35)
        ctx.font = `500 ${size}px Ubuntu, system-ui, sans-serif`
        const width = ctx.measureText(p.name).width
        if (width > room) size *= room / width
        if (size < 10) continue
        const x = view.x + (a.x + 0.5) * view.s
        const y = view.y + (a.y + 0.5) * view.s
        ctx.font = `500 ${size}px Ubuntu, system-ui, sans-serif`
        ctx.strokeText(p.name, x, y)
        ctx.fillStyle = css(colors.fg)
        ctx.fillText(p.name, x, y)
        ctx.font = `${size * 0.8}px Ubuntu, system-ui, sans-serif`
        ctx.strokeText(compact(p.troops), x, y + size)
        ctx.fillText(compact(p.troops), x, y + size)
      }
    }

    const finish = (win: boolean) => {
      live.current.phase = 'end'
      const ms = performance.now() - started
      const by = win ? '' : me.killer ? player(g, me.killer).name : g.players.find((p) => p.id === winner(g))?.name ?? ''
      recordPlay('openfront', { pts: win ? 100 : Math.round(Math.min(1, best / WIN_SHARE) * 80), s: Math.round(best * 100), win, ms })
      feedback(win ? 'win' : 'lose')
      setResult({ win, share: best, ms, by })
      setPhase('end')
    }

    let raf = 0
    let last = performance.now()
    let acc = 0
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (live.current.phase === 'play') {
        // un onglet en arrière-plan met le jeu en pause plutôt que de rattraper le temps perdu
        acc += Math.min(now - last, 400) * live.current.speed
        while (acc >= TICK && live.current.phase === 'play') {
          acc -= TICK
          step(g)
          runBots(g, LEVELS[level])
          best = Math.max(best, me.cells / g.land)
          const w = winner(g)
          if (!me.alive || w) finish(w === ME)
        }
      }
      last = now
      if (g.changed.size) {
        for (const c of g.changed) paint(c)
        g.changed.clear()
        ictx.putImageData(data, 0, 0)
      }
      draw()
    }
    ictx.putImageData(data, 0, 0)
    resize()
    raf = requestAnimationFrame(frame)

    const hudTimer = window.setInterval(() => {
      labels = anchors(g)
      if (live.current.phase === 'spawn') return
      const top = g.players
        .filter((p) => p.alive)
        .sort((a, b) => b.cells - a.cells)
        .slice(0, 5)
        .map((p) => ({ id: p.id, name: p.name, share: p.cells / g.land }))
      setHud({ troops: me.troops, max: maxTroops(g, me), gold: me.gold, cost: cityCost(g, ME), boats: g.boats.filter((b) => b.owner === ME).length, top })
    }, 250)

    const cellAt = (x: number, y: number) => {
      const cx = Math.floor((x - view.x) / view.s)
      const cy = Math.floor((y - view.y) / view.s)
      return cx < 0 || cy < 0 || cx >= g.w || cy >= g.h ? -1 : cy * g.w + cx
    }
    const tap = (x: number, y: number) => {
      const c = cellAt(x, y)
      if (c < 0 || g.owner[c] === WATER) return
      const { phase, ratio, building } = live.current
      if (phase === 'spawn') {
        if (!spawn(g, ME, c)) return say(t('Choisis une terre libre.'))
        live.current.phase = 'play'
        started = performance.now()
        last = started
        feedback('tap')
        setPhase('play')
        return
      }
      if (phase !== 'play') return
      if (building) {
        setBuilding(false)
        if (buildCity(g, ME, c)) feedback('good')
        else say(t('Une ville se bâtit sur ton territoire.'))
        return
      }
      const order = attackAt(g, ME, c, (me.troops * ratio) / 100)
      if (order === 'mer') say(t('Bateau en route'))
      if (order) return feedback('tap')
      if (g.owner[c] === ME) return
      say(g.boats.filter((b) => b.owner === ME).length >= MAX_BOATS ? t('Trois bateaux en mer au plus.') : t('Aucune route ne mène là.'))
    }

    // glisser déplace la carte, pincer ou la molette zoome, toucher sans bouger joue
    const pointers = new Map<number, { x: number; y: number }>()
    let moved = false
    let start = { x: 0, y: 0 }
    const pos = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const down = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId)
      pointers.set(e.pointerId, pos(e))
      if (pointers.size === 1) {
        moved = false
        start = pos(e)
      } else moved = true
    }
    const move = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId)
      if (!prev) return
      const p = pos(e)
      if (pointers.size === 2) {
        const other = [...pointers].find(([id]) => id !== e.pointerId)![1]
        const before = Math.hypot(prev.x - other.x, prev.y - other.y)
        const after = Math.hypot(p.x - other.x, p.y - other.y)
        view.x += (p.x - prev.x) / 2
        view.y += (p.y - prev.y) / 2
        if (before > 0) zoomAt((p.x + other.x) / 2, (p.y + other.y) / 2, after / before)
      } else {
        if (Math.hypot(p.x - start.x, p.y - start.y) > 6) moved = true
        if (moved) {
          view.x += p.x - prev.x
          view.y += p.y - prev.y
          clamp()
        }
      }
      pointers.set(e.pointerId, p)
    }
    const up = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId)) return
      if (!moved && !pointers.size) tap(start.x, start.y)
    }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const p = pos(e)
      zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.002))
    }
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    canvas.addEventListener('wheel', wheel, { passive: false })
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    // changer de thème repeint toute la carte
    const themes = new MutationObserver(() => {
      paintAll()
      ictx.putImageData(data, 0, 0)
    })
    themes.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    return () => {
      cancelAnimationFrame(raf)
      clearInterval(hudTimer)
      observer.disconnect()
      themes.disconnect()
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('wheel', wheel)
    }
  }, [game, level])

  async function share() {
    if (!result) return
    const text = `OpenFront Expedle · ${result.win ? '🏆' : '💀'} ${t('{pct} % des terres en {time}', { pct: percent(result.share), time: formatTime(result.ms) })}`
    say((await copyText(text)) ? t('Résultat copié !') : t('Copie impossible'))
  }

  function changeRatio(n: number) {
    setRatio(n)
    save('openfront-ratio', n)
  }

  const colorOf = (id: number) => (id === ME ? 'var(--fg)' : `hsl(${hue(id)} 38% var(--of-l))`)

  return (
    <div className="of">
      <AppBar
        title="OpenFront"
        tools={
          phase === 'play' && (
            <button className="ui-tool" onClick={() => restart()} aria-label={t('Recommencer')}>
              ↺
            </button>
          )
        }
      />
      <main className="of-main">
        <div className="of-map">
          <canvas ref={canvasRef} className={building ? 'building' : ''} />
          {phase === 'spawn' && (
            <div className="of-intro">
              <b>{t('Touche la carte pour choisir ton point de départ.')}</b>
              <span>{t('Prends 80 % des terres. Touche un territoire pour l’attaquer ; au-delà des mers, un bateau part.')}</span>
              <div className="of-levels" role="radiogroup" aria-label={t('Difficulté')}>
                {(Object.keys(LEVELS) as Level[]).map((l) => (
                  <button key={l} role="radio" aria-checked={l === level} className={l === level ? 'on' : ''} onClick={() => chooseLevel(l)}>
                    {t(LEVEL_NAMES[l])}
                  </button>
                ))}
              </div>
            </div>
          )}
          {phase !== 'spawn' && hud && (
            <ol className="of-rank">
              {hud.top.map((p) => (
                <li key={p.id} className={p.id === ME ? 'me' : ''}>
                  <i style={{ background: colorOf(p.id) }} />
                  <span>{p.name}</span>
                  <b>{percent(p.share)} %</b>
                </li>
              ))}
            </ol>
          )}
          {message && <div className="of-msg">{message}</div>}
          {phase === 'end' && result && (
            <section className="of-end">
              <b>{result.win ? t('Le monde est à toi.') : t('Éliminé')}</b>
              <span>
                {result.win
                  ? t('{pct} % des terres en {time}', { pct: percent(result.share), time: formatTime(result.ms) })
                  : result.by
                    ? t('Par {name}, après avoir tenu {pct} % des terres.', { name: result.by, pct: percent(result.share) })
                    : t('Après avoir tenu {pct} % des terres.', { pct: percent(result.share) })}
              </span>
              <div className="of-end-actions">
                <button className="ui-btn" onClick={() => restart()}>
                  {t('Rejouer')}
                </button>
                <button className="ui-btn line" onClick={share}>
                  {t('Partager')}
                </button>
              </div>
            </section>
          )}
        </div>
        {phase === 'play' && hud && (
          <div className="of-hud">
            <div className="of-troops">
              <span>
                <b>{compact(hud.troops)}</b> / {compact(hud.max)} {t('troupes')}
              </span>
              <span className="of-bar">
                <i style={{ width: `${Math.min(100, (hud.troops / hud.max) * 100)}%` }} />
              </span>
            </div>
            <label className="of-ratio">
              <span>{t('Envoyer {n} %', { n: ratio })}</span>
              <input type="range" min={10} max={100} step={5} value={ratio} onChange={(e) => changeRatio(Number(e.target.value))} />
            </label>
            <button className="of-speed" onClick={() => setSpeed((speed % 3) + 1)} aria-label={t('Vitesse')}>
              ×{speed}
            </button>
            <button className={building ? 'of-city on' : 'of-city'} disabled={!building && hud.gold < hud.cost} onClick={() => setBuilding(!building)}>
              {building ? t('Touche ton territoire') : t('Ville · {cost}', { cost: compact(hud.cost) })}
              <small>{t('{gold} or', { gold: compact(hud.gold) })}</small>
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
