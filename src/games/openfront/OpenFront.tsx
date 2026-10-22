import { useEffect, useRef, useState } from 'react'
import { countryName } from '../../geo/countries'
import { feedback } from '../../lib/feedback'
import { fmt, msg, t } from '../../lib/i18n'
import { recordPlay } from '../../lib/stats'
import { copyText, formatTime, load, save } from '../../lib/util'
import AppBar from '../../ui/AppBar'
import { loadProfile } from '../../ui/Panels'
import { populate, runAi, type Brain } from './ai'
import {
  accept,
  addPlayer,
  agreeExtension,
  allianceOf,
  allied,
  attackAt,
  boatsOf,
  breakAlliance,
  build,
  buildSpot,
  createGame,
  demolish,
  distance,
  donateGold,
  donateTroops,
  isLand,
  isTraitor,
  launch,
  maxTroopsOf,
  passable,
  player,
  priceOf,
  refuse,
  requestAlliance,
  retreat,
  sendBoat,
  spawn,
  step,
  unitsOf,
  winner,
  type BuildResult,
  type Game,
} from './engine'
import { anchors, type Anchor } from './labels'
import { worldMap } from './map'
import RadialMenu, { ICON, type MenuItem } from './RadialMenu'
import { compact, draw, Painter, palette, type View } from './render'
import { EXTEND_WINDOW, goldPerTick, MAX_BOATS, SPAWN_TICKS, STRUCTURE_MIN_DIST, TICK_MS, troopGrowth, WIN_SHARE, type Level, type NukeType, type UnitType } from './rules'
import './openfront.css'

const ME = 1
const NATIONS = 50
const TRIBES = 250
const LEVELS: Level[] = ['facile', 'moyen', 'difficile', 'impossible']
const LEVEL_NAMES: Record<Level, string> = { facile: msg('Facile'), moyen: msg('Moyen'), difficile: msg('Difficile'), impossible: msg('Impossible') }
const UNITS: UnitType[] = ['ville', 'port', 'poste', 'silo', 'dca', 'navire']
const UNIT_NAMES: Record<UnitType, string> = {
  ville: msg('Ville'),
  port: msg('Port'),
  poste: msg('Poste de défense'),
  silo: msg('Silo à missiles'),
  dca: msg('Défense antiaérienne'),
  navire: msg('Navire de guerre'),
}
// dans la roue, un mot suffit ; le nom complet s'affiche au survol
const UNIT_SHORT: Record<UnitType, string> = { ville: msg('Ville'), port: msg('Port'), poste: msg('Poste'), silo: msg('Silo'), dca: msg('Antimissile'), navire: msg('Navire') }
const NUKES: NukeType[] = ['bombe', 'hbombe', 'mirv']
const NUKE_NAMES: Record<NukeType, string> = { bombe: msg('Bombe A'), hbombe: msg('Bombe H'), mirv: msg('MIRV') }
const BUILD_ERRORS: Record<Exclude<BuildResult, 'ok'>, string> = {
  or: msg('Pas assez d’or.'),
  place: msg('Trop près d’un autre bâtiment, ou hors de ton territoire.'),
  port: msg('Il faut d’abord un port.'),
  mer: msg('Aucune côte à portée.'),
}

type Phase = 'chargement' | 'depart' | 'jeu' | 'fin'

interface Setup {
  g: Game
  brains: Brain[]
}

interface Hud {
  troops: number
  max: number
  growth: number
  gold: number
  income: number
  top: { id: number; name: string; share: number }[]
  attacks: { id: number; name: string; troops: number }[]
  boats: number
}

interface Note {
  key: number
  text: string
  until: number
  actions?: { label: string; act: () => void }[]
}

interface Result {
  win: boolean
  share: number
  ms: number
  by: string
}

function newSetup(level: Level, name: string): Setup {
  const map = worldMap()
  const g = createGame(map, level)
  addPlayer(g, name, 'human')
  return { g, brains: populate(g, map.seats, NATIONS, TRIBES, countryName) }
}

const percent = (share: number) => fmt(share * 100, { maximumFractionDigits: share < 0.1 ? 1 : 0 })
const nameOf = (g: Game, id: number) => (id ? player(g, id).name : t('la nature'))

// L'action du clic gauche, et du centre de la roue : attaquer, prendre la mer, ou renforcer un allié.
function primary(g: Game, tile: number, ratio: number): { ok: boolean; text: string } {
  const owner = g.owner[tile]
  const me = player(g, ME)
  if (!passable(g, tile) || owner === ME) return { ok: false, text: '' }
  if (owner && allied(g, ME, owner)) {
    donateTroops(g, ME, owner, (me.troops * ratio) / 100)
    return { ok: true, text: t('Troupes envoyées à {name}', { name: player(g, owner).name }) }
  }
  const order = attackAt(g, ME, tile, (me.troops * ratio) / 100)
  if (order) return { ok: true, text: order === 'mer' ? t('Bateau en route') : '' }
  return { ok: false, text: boatsOf(g, ME) >= MAX_BOATS ? t('Trois bateaux en mer au plus.') : t('Aucune route ne mène là.') }
}

function menuFor(g: Game, tile: number, ratio: number, say: (text: string) => void, showInfo: (id: number) => void): { items: MenuItem[]; center: MenuItem } | null {
  if (!isLand(g, tile)) return null
  const owner = g.owner[tile]
  const me = player(g, ME)
  const ally = owner && owner !== ME ? allianceOf(g, ME, owner) : undefined
  const center: MenuItem = ally
    ? { id: 'troupes', label: t('Envoyer des troupes'), icon: ICON.troupes, act: () => say(primary(g, tile, ratio).text) }
    : { id: 'attaque', label: t('Attaquer'), icon: ICON.attaque, disabled: owner === ME || !passable(g, tile), act: () => say(primary(g, tile, ratio).text) }
  const info: MenuItem = { id: 'info', label: t('Infos'), icon: ICON.info, disabled: !owner, act: () => showInfo(owner) }

  if (owner === ME) {
    const near = g.units.some((u) => u.owner === ME && u.type !== 'navire' && distance(g, u.tile, tile) < STRUCTURE_MIN_DIST)
    const builds = UNITS.map((type): MenuItem => {
      const price = priceOf(g, ME, type)
      return {
        id: type,
        label: t(UNIT_SHORT[type]),
        title: t(UNIT_NAMES[type]),
        icon: ICON[type],
        note: compact(price),
        disabled: me.gold < price || typeof buildSpot(g, ME, type, tile) === 'string',
        act: () => {
          const r = build(g, ME, type, tile)
          say(r === 'ok' ? '' : t(BUILD_ERRORS[r]))
        },
      }
    })
    return {
      center,
      items: [
        info,
        { id: 'supprimer', label: t('Démolir'), icon: ICON.supprimer, danger: true, disabled: !near, act: () => demolish(g, ME, tile) },
        { id: 'alliance', label: t('Alliance'), icon: ICON.alliance, disabled: true },
        { id: 'construire', label: t('Construire'), icon: ICON.construire, sub: builds },
      ],
    }
  }

  const silo = unitsOf(g, ME, 'silo').some((s) => s.ready <= g.tick && s.cooldown <= g.tick)
  const nukes = NUKES.map((type): MenuItem => {
    const price = priceOf(g, ME, type)
    return {
      id: type,
      label: t(NUKE_NAMES[type]),
      icon: ICON[type],
      note: compact(price),
      danger: true,
      disabled: !silo || me.gold < price,
      act: () => {
        if (launch(g, ME, type, tile) === 'ok') feedback('tap')
      },
    }
  })
  return {
    center,
    items: [
      info,
      ally
        ? { id: 'rompre', label: t('Trahir'), icon: ICON.rompre, danger: true, act: () => breakAlliance(g, ME, owner) }
        : {
            id: 'bateau',
            label: t('Bateau'),
            icon: ICON.bateau,
            disabled: boatsOf(g, ME) >= MAX_BOATS,
            act: () => say(sendBoat(g, ME, tile, (me.troops * ratio) / 100) ? t('Bateau en route') : t('Aucune route ne mène là.')),
          },
      ally && ally.until - g.tick <= EXTEND_WINDOW
        ? { id: 'prolonger', label: t('Prolonger'), icon: ICON.prolonger, disabled: ally.extend.has(ME), act: () => agreeExtension(g, ME, owner) }
        : {
            id: 'alliance',
            label: t('Alliance'),
            icon: ICON.alliance,
            disabled: !owner || !!ally,
            act: () => {
              const r = requestAlliance(g, ME, owner)
              say(
                r === 'envoyée'
                  ? t('Demande envoyée à {name}', { name: nameOf(g, owner) })
                  : r === 'alliés'
                    ? t('Alliance conclue avec {name}', { name: nameOf(g, owner) })
                    : r === 'attendre'
                      ? t('Attends un peu avant de redemander.')
                      : '',
              )
            },
          },
      ally
        ? { id: 'or', label: t('Don d’or'), icon: ICON.or, disabled: me.gold < 1, act: () => donateGold(g, ME, owner, me.gold / 4) }
        : { id: 'bombes', label: t('Bombes'), icon: ICON.bombe, danger: true, sub: nukes },
    ],
  }
}

export default function OpenFront() {
  const [level, setLevel] = useState<Level>(() => load<Level>('openfront-niveau', 'moyen'))
  const [name] = useState(() => loadProfile().name || t('Toi'))
  const [setup, setSetup] = useState<Setup | null>(null)
  const [phase, setPhase] = useState<Phase>('chargement')
  const [countdown, setCountdown] = useState(0)
  const [ratio, setRatio] = useState(() => load('openfront-attaque', 20))
  const [speed, setSpeed] = useState(1)
  const [hud, setHud] = useState<Hud | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; tile: number } | null>(null)
  const [info, setInfo] = useState(0)
  const [notes, setNotes] = useState<Note[]>([])
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // les gestes et la boucle de jeu lisent ces valeurs sans relancer la boucle
  const live = useRef({ phase, ratio, speed })
  live.current = { phase, ratio, speed }
  const sayTimer = useRef(0)
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

  function say(text: string) {
    if (!text) return
    setMessage(text)
    clearTimeout(sayTimer.current)
    sayTimer.current = window.setTimeout(() => setMessage(''), 2200)
  }

  // la carte se construit après le premier affichage, pour montrer le chargement
  useEffect(() => {
    if (setup) return
    const id = window.setTimeout(() => {
      setSetup(newSetup(level, name))
      setPhase('depart')
    }, 30)
    return () => clearTimeout(id)
  }, [setup, level, name])

  function restart(next: Level = level) {
    setLevel(next)
    save('openfront-niveau', next)
    setSetup(null)
    setPhase('chargement')
    setCountdown(0)
    setResult(null)
    setMenu(null)
    setInfo(0)
    setNotes([])
    setHud(null)
    setSpeed(1)
  }

  useEffect(() => {
    if (!setup) return
    const { g, brains } = setup
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const me = player(g, ME)
    const painter = new Painter(g)
    painter.setPalette(palette(canvas, g, ME))
    const view: View & { fit: number } = { s: 1, x: 0, y: 0, fit: 1 }
    let cw = 0
    let ch = 0
    let labels: Anchor[] = anchors(g)
    let spawnAt = 0
    let started = 0
    let best = 0
    let key = 0

    const clamp = () => {
      view.s = Math.min(Math.max(view.s, view.fit), view.fit * 40)
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
        // sur un téléphone en hauteur, le monde entier serait minuscule : on part zoomé sur l'Europe et l'Afrique
        view.s = ch > cw ? Math.min(view.fit * 6, (ch * 0.7) / g.h) : view.fit
        view.x = (cw - g.w * view.s) / 2
        view.y = (ch - g.h * view.s) / 2
      }
      clamp()
    }
    const zoomAt = (x: number, y: number, f: number) => {
      const s = Math.min(Math.max(view.s * f, view.fit), view.fit * 40)
      view.x = x - ((x - view.x) * s) / view.s
      view.y = y - ((y - view.y) * s) / view.s
      view.s = s
      clamp()
    }

    const note = (text: string, actions?: Note['actions'], seconds = 8) =>
      setNotes((list) => [...list.slice(-2), { key: ++key, text, actions, until: performance.now() + seconds * 1000 }])
    const dismiss = (k: number) => setNotes((list) => list.filter((n) => n.key !== k))

    // ce qui arrive au joueur : demandes d'alliance à trancher, trahisons, bombes
    const readEvents = () => {
      for (const e of g.events) {
        const other = e.from === ME ? e.to : e.from
        const who = nameOf(g, other)
        if (e.type === 'request' && e.to === ME) {
          const k = key + 1
          note(
            t('{name} propose une alliance', { name: who }),
            [
              { label: t('Accepter'), act: () => (accept(g, e.from, ME), dismiss(k)) },
              { label: t('Refuser'), act: () => (refuse(g, e.from, ME), dismiss(k)) },
            ],
            20,
          )
        } else if (e.type === 'accepted' && e.to === ME) note(t('{name} accepte l’alliance', { name: who }))
        else if (e.type === 'refused' && e.to === ME && e.from !== ME) note(t('{name} refuse l’alliance', { name: who }))
        else if (e.type === 'extend' && (e.from === ME || e.to === ME)) {
          const k = key + 1
          note(t('L’alliance avec {name} touche à sa fin', { name: who }), [{ label: t('Prolonger'), act: () => (agreeExtension(g, ME, other), dismiss(k)) }], 30)
        } else if (e.type === 'expired' && (e.from === ME || e.to === ME)) note(t('Fin de l’alliance avec {name}', { name: who }))
        else if (e.type === 'betrayed' && e.to === ME) note(t('{name} t’a trahi !', { name: who }))
        else if (e.type === 'nuke' && e.to === ME) note(t('Bombe lancée par {name} !', { name: who }))
        else if (e.type === 'intercepted' && e.from === ME) note(t('Ta défense a abattu une bombe de {name}', { name: nameOf(g, e.to) }))
        else if (e.type === 'intercepted' && e.to === ME) note(t('Ta bombe a été abattue'))
        else if (e.type === 'eliminated' && e.from === ME) note(t('Tu as éliminé {name}', { name: nameOf(g, e.to) }))
      }
      g.events = []
    }

    const finish = (win: boolean) => {
      live.current.phase = 'fin'
      const ms = performance.now() - started
      const by = win ? '' : me.killer ? player(g, me.killer).name : (g.players.find((p) => p.id === winner(g))?.name ?? '')
      recordPlay('openfront', { pts: win ? 100 : Math.round(Math.min(1, best / WIN_SHARE) * 80), s: Math.round(best * 100), win, ms })
      feedback(win ? 'win' : 'lose')
      setResult({ win, share: best, ms, by })
      setPhase('fin')
    }

    let raf = 0
    let last = performance.now()
    let acc = 0
    let frames = 0
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      // filet de sécurité si la taille ou la densité de pixels ont changé sans prévenir (zoom du navigateur, rotation)
      if (++frames % 30 === 0 && (canvas.clientWidth !== cw || canvas.clientHeight !== ch || canvas.width !== Math.round(cw * devicePixelRatio))) resize()
      if (live.current.phase === 'depart' && spawnAt && now - spawnAt >= SPAWN_TICKS * TICK_MS) {
        live.current.phase = 'jeu'
        setPhase('jeu')
        started = now
      }
      if (live.current.phase === 'jeu') {
        // un onglet en arrière-plan met le jeu en pause plutôt que de rattraper le temps perdu
        acc += Math.min(now - last, 400) * live.current.speed
        while (acc >= TICK_MS && live.current.phase === 'jeu') {
          acc -= TICK_MS
          step(g)
          runAi(g, brains)
          readEvents()
          best = Math.max(best, me.tiles / g.land)
          const w = winner(g)
          if (!me.alive || w) finish(w === ME)
        }
      }
      last = now
      painter.flush()
      draw(ctx, painter, g, view, cw, ch, labels, ME)
    }
    resize()
    raf = requestAnimationFrame(frame)

    const hudTimer = window.setInterval(() => {
      if (spawnAt && live.current.phase === 'depart') setCountdown(Math.max(1, Math.ceil((SPAWN_TICKS * TICK_MS - (performance.now() - spawnAt)) / 1000)))
      if (live.current.phase !== 'jeu') return
      const now = performance.now()
      setNotes((list) => (list.some((n) => n.until < now) ? list.filter((n) => n.until >= now) : list))
      const max = maxTroopsOf(g, me)
      const top = g.players
        .filter((p) => p.alive && p.tiles)
        .sort((a, b) => b.tiles - a.tiles)
        .slice(0, 5)
      if (!top.includes(me) && me.alive) top.push(me)
      setHud({
        troops: me.troops,
        max,
        growth: troopGrowth(me.kind, g.level, me.troops, max) * 10,
        gold: me.gold,
        income: goldPerTick(me.kind) * 10,
        top: top.map((p) => ({ id: p.id, name: p.name, share: p.tiles / g.land })),
        attacks: g.attacks.filter((a) => a.from === ME).map((a) => ({ id: a.id, name: nameOf(g, a.to), troops: a.troops })),
        boats: boatsOf(g, ME),
      })
    }, 250)
    const labelTimer = window.setInterval(() => (labels = anchors(g)), 1000)

    const cellAt = (x: number, y: number) => {
      const cx = Math.floor((x - view.x) / view.s)
      const cy = Math.floor((y - view.y) / view.s)
      return cx < 0 || cy < 0 || cx >= g.w || cy >= g.h ? -1 : cy * g.w + cx
    }
    const openMenu = (x: number, y: number) => {
      const tile = cellAt(x, y)
      const r = canvas.getBoundingClientRect()
      if (tile >= 0 && live.current.phase === 'jeu' && isLand(g, tile)) setMenu({ x: x + r.left, y: y + r.top, tile })
    }
    const tap = (x: number, y: number, touch: boolean) => {
      const tile = cellAt(x, y)
      if (tile < 0) return
      if (live.current.phase === 'depart') {
        if (!passable(g, tile) || (g.owner[tile] && g.owner[tile] !== ME) || !spawn(g, ME, tile)) return say(t('Choisis une terre libre.'))
        spawnAt ||= performance.now()
        feedback('tap')
        return
      }
      if (live.current.phase !== 'jeu') return
      if (touch) return openMenu(x, y)
      const r = primary(g, tile, live.current.ratio)
      if (r.ok) feedback('tap')
      say(r.text)
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
      if (e.button === 2) return
      pointers.set(e.pointerId, pos(e))
      try {
        canvas.setPointerCapture(e.pointerId)
      } catch {
        // pointeur déjà relâché : le geste se poursuit sans capture
      }
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
      if (!moved && !pointers.size) tap(start.x, start.y, e.pointerType === 'touch')
    }
    const context = (e: MouseEvent) => {
      e.preventDefault()
      const p = pos(e)
      openMenu(p.x, p.y)
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
    canvas.addEventListener('contextmenu', context)
    canvas.addEventListener('wheel', wheel, { passive: false })
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    // changer de thème repeint toute la carte
    const themes = new MutationObserver(() => painter.setPalette(palette(canvas, g, ME)))
    themes.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    return () => {
      cancelAnimationFrame(raf)
      clearInterval(hudTimer)
      clearInterval(labelTimer)
      observer.disconnect()
      themes.disconnect()
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('contextmenu', context)
      canvas.removeEventListener('wheel', wheel)
    }
  }, [setup])

  async function share() {
    if (!result) return
    const text = `OpenFront Expedle · ${result.win ? '🏆' : '💀'} ${t('{pct} % des terres en {time}', { pct: percent(result.share), time: formatTime(result.ms) })}`
    say((await copyText(text)) ? t('Résultat copié !') : t('Copie impossible'))
  }

  function changeRatio(n: number) {
    setRatio(n)
    save('openfront-attaque', n)
  }

  const g = setup?.g
  const radial = g && menu ? menuFor(g, menu.tile, ratio, say, setInfo) : null
  const shown = g && info ? player(g, info) : null

  return (
    <div className="of">
      <AppBar
        title="OpenFront"
        tools={
          phase === 'jeu' && (
            <button className="ui-tool" onClick={() => restart()} aria-label={t('Recommencer')}>
              ↺
            </button>
          )
        }
      />
      <main className="of-main">
        <div className="of-map">
          <canvas ref={canvasRef} />
          {phase === 'chargement' && <p className="of-loading">{t('Chargement de la carte…')}</p>}
          {phase === 'depart' && (
            <div className="of-intro">
              <b>{countdown ? t('La partie commence dans {n} s', { n: countdown }) : t('Touche la carte pour choisir ton point de départ.')}</b>
              <span>{coarse ? t('Ensuite, touche la carte pour ouvrir la roue d’action.') : t('Ensuite : clic gauche pour attaquer, clic droit pour la roue d’action.')}</span>
              <div className="of-levels" role="radiogroup" aria-label={t('Difficulté')}>
                {LEVELS.map((l) => (
                  <button key={l} role="radio" aria-checked={l === level} className={l === level ? 'on' : ''} onClick={() => restart(l)}>
                    {t(LEVEL_NAMES[l])}
                  </button>
                ))}
              </div>
            </div>
          )}
          {(phase === 'jeu' || phase === 'fin') && hud && (
            <ol className="of-rank">
              {hud.top.map((p) => (
                <li key={p.id} className={p.id === ME ? 'me' : ''}>
                  <span>{p.name}</span>
                  <b>{percent(p.share)} %</b>
                </li>
              ))}
            </ol>
          )}
          {shown && g && (
            <section className="of-info">
              <header>
                <b>{shown.name}</b>
                <button onClick={() => setInfo(0)} aria-label={t('Fermer')}>
                  ×
                </button>
              </header>
              <dl>
                <dt>{t('Troupes')}</dt>
                <dd>{compact(shown.troops)}</dd>
                <dt>{t('Or')}</dt>
                <dd>{compact(shown.gold)}</dd>
                <dt>{t('Territoire')}</dt>
                <dd>{percent(shown.tiles / g.land)} %</dd>
                <dt>{t('Villes')}</dt>
                <dd>{unitsOf(g, shown.id, 'ville').length}</dd>
              </dl>
              <p>
                {shown.id === ME
                  ? t('C’est toi.')
                  : isTraitor(g, shown)
                    ? t('Traître : sa défense est affaiblie.')
                    : allied(g, ME, shown.id)
                      ? t('Allié encore {time}', { time: formatTime(((allianceOf(g, ME, shown.id)?.until ?? g.tick) - g.tick) * TICK_MS) })
                      : shown.kind === 'bot'
                        ? t('Tribu')
                        : t('Nation')}
              </p>
            </section>
          )}
          {notes.length > 0 && (
            <ul className="of-notes">
              {notes.map((n) => (
                <li key={n.key}>
                  <span>{n.text}</span>
                  {n.actions?.map((a) => (
                    <button key={a.label} onClick={a.act}>
                      {a.label}
                    </button>
                  ))}
                </li>
              ))}
            </ul>
          )}
          {message && <div className="of-msg">{message}</div>}
          {phase === 'fin' && result && (
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
        {phase === 'jeu' && hud && (
          <>
            {hud.attacks.length > 0 && (
              <ul className="of-attacks">
                {hud.attacks.map((a) => (
                  <li key={a.id}>
                    <span>
                      → {a.name} · {compact(a.troops)}
                    </span>
                    <button onClick={() => g && retreat(g, a.id)} aria-label={t('Rappeler les troupes')}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="of-hud">
              <div className="of-stat">
                <span>
                  <b>{compact(hud.troops)}</b> / {compact(hud.max)} <small>+{compact(hud.growth)}/s</small>
                </span>
                <span className="of-bar">
                  <i style={{ width: `${Math.min(100, (hud.troops / hud.max) * 100)}%` }} />
                </span>
              </div>
              <div className="of-stat">
                <span>
                  <b>{compact(hud.gold)}</b> {t('or')} <small>+{compact(hud.income)}/s</small>
                </span>
                <small>{t('{n} / 3 bateaux', { n: hud.boats })}</small>
              </div>
              <label className="of-ratio">
                <span>{t('Attaque {n} %', { n: ratio })}</span>
                <input type="range" min={1} max={100} value={ratio} onChange={(e) => changeRatio(Number(e.target.value))} />
              </label>
              <button className="of-speed" onClick={() => setSpeed((speed % 3) + 1)} aria-label={t('Vitesse')}>
                ×{speed}
              </button>
            </div>
          </>
        )}
      </main>
      {radial && menu && <RadialMenu x={menu.x} y={menu.y} items={radial.items} center={radial.center} onClose={() => setMenu(null)} />}
    </div>
  )
}
