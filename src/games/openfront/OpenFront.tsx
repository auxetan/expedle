import { useEffect, useMemo, useRef, useState } from 'react'
import { countryName, flagEmoji } from '../../geo/countries'
import { buzz } from '../../lib/feedback'
import { fmt, msg, t } from '../../lib/i18n'
import { cloudEnabled } from '../../lib/cloud'
import { plays, recordPlay } from '../../lib/stats'
import { copyText, formatTime, load, save } from '../../lib/util'
import AppBar from '../../ui/AppBar'
import { loadProfile } from '../../ui/Panels'
import { Sim } from './client'
import {
  allianceOf,
  allied,
  boatsOf,
  buildSpot,
  DEFAULT_OPTIONS,
  distance,
  isLand,
  isTraitor,
  maxTroopsOf,
  passable,
  player,
  priceOf,
  unitsOf,
  winner,
  type BuildResult,
  type Game,
  type Options,
} from './engine'
import { worldMap } from './map'
import { BOTS, LEVEL_NAMES, LEVELS, NATIONS, TRIBES } from './choices'
import { ICON } from './icons'
import { actionFor, keyName, loadKeys, type Action } from './keys'
import { SPAWN_TURNS } from './lockstep'
import Menu, { Caps, SoundPanel } from './Menu'
import type { Lobby, Start } from './net'
import Salon, { type SalonKind } from './Salon'
import { earnedOf, loadSkin, skinById, type Skin } from './progress'
import { ambience, ambienceAt, ambienceGain, play } from './sounds'
import RadialMenu, { Glyph, type MenuItem } from './RadialMenu'
import { compact, draw, FLOAT_MS, Labels, Painter, palette, troopsText, type Float, type Ghost, type Overlay, type View } from './render'
import { BLAST, DEFENSE_RANGE, EXTEND_WINDOW, goldPerTick, MAX_BOATS, RAIL_RANGE, samRange, SPAWN_TICKS, STRUCTURE_MIN_DIST, TICK_MS, troopGrowth, WIN_SHARE, type Buyable, type Level, type NukeType, type UnitType } from './rules'
import './openfront.css'

// le numéro du joueur de cet écran : 1 en solo, sa place dans le salon en ligne (fixé au lancement d'une partie)
let ME = 1
const UNITS: UnitType[] = ['ville', 'port', 'usine', 'poste', 'silo', 'dca', 'navire']
const UNIT_NAMES: Record<UnitType, string> = {
  ville: msg('Ville'),
  port: msg('Port'),
  usine: msg('Usine'),
  poste: msg('Poste de défense'),
  silo: msg('Silo à missiles'),
  dca: msg('Défense antiaérienne'),
  navire: msg('Navire de guerre'),
}
// dans la roue, un mot suffit ; le nom complet s'affiche au survol
const UNIT_SHORT: Record<UnitType, string> = { ville: msg('Ville'), port: msg('Port'), usine: msg('Usine'), poste: msg('Poste'), silo: msg('Silo'), dca: msg('Antimissile'), navire: msg('Navire') }
const NUKES: NukeType[] = ['bombe', 'hbombe', 'mirv']
const NUKE_NAMES: Record<NukeType, string> = { bombe: msg('Bombe A'), hbombe: msg('Bombe H'), mirv: msg('MIRV') }
const BUILD_ERRORS: Record<Exclude<BuildResult, 'ok'>, string> = {
  or: msg('Pas assez d’or.'),
  place: msg('Trop près d’un autre bâtiment, ou hors de ton territoire.'),
  port: msg('Il faut d’abord un port.'),
  mer: msg('Aucune côte à portée.'),
}

const NO_SILO = msg('Il faut un silo prêt à tirer.')
const TOO_SOON = msg('Aucune bombe ne part pendant les cinq premières secondes.')

// ce que l'option « Bombes » retire : les bombes, leurs silos et les défenses contre elles
const NUCLEAR: Buyable[] = ['silo', 'dca', ...NUKES]
const allowed = (g: Game, type: Buyable) => g.options.nukes || !NUCLEAR.includes(type)

// la barre de construction, dans l'ordre et avec les touches d'OpenFront
const BAR: [Action, Buyable][] = [
  ['buildCity', 'ville'],
  ['buildFactory', 'usine'],
  ['buildPort', 'port'],
  ['buildDefensePost', 'poste'],
  ['buildMissileSilo', 'silo'],
  ['buildSamLauncher', 'dca'],
  ['buildWarship', 'navire'],
  ['buildAtomBomb', 'bombe'],
  ['buildHydrogenBomb', 'hbombe'],
  ['buildMIRV', 'mirv'],
]

// en préparant ces constructions, OpenFront montre les zones des défenses antiaériennes
const SAM_VIEW = new Set<Buyable>(['silo', 'dca', 'ville', 'bombe', 'hbombe'])

// Le fantôme du bâtiment sous la souris : sa place réelle, s'il peut s'y poser, son prix et sa portée
// (défense antiaérienne, poste de défense, ou rails pour une gare).
function ghostAt(g: Game, type: UnitType, tile: number, infinite: boolean): Ghost {
  const spot = buildSpot(g, ME, type, tile)
  const placed = typeof spot === 'string' ? null : spot
  const cost = priceOf(g, ME, type)
  const level = placed?.upgrade ? placed.upgrade.level + 1 : 1
  const range = type === 'dca' ? samRange(level) : type === 'poste' ? DEFENSE_RANGE : type === 'ville' || type === 'port' || type === 'usine' ? RAIL_RANGE : 0
  return { tile: placed?.tile ?? tile, type, cost, afford: infinite || player(g, ME).gold >= cost, place: !!placed, range }
}

// le silo qui tirerait sur cette case : le plus proche des prêts, comme au lancement
function siloFor(g: Game, tile: number): number | undefined {
  const ready = unitsOf(g, ME, 'silo').filter((u) => u.ready <= g.tick && u.slots.some((c) => c <= g.tick))
  if (!ready.length) return undefined
  return ready.reduce((a, b) => (distance(g, a.tile, tile) <= distance(g, b.tile, tile) ? a : b)).tile
}

// ce que bâtissent les touches de construction
const BUILDS: Partial<Record<Action, Buyable>> = {
  buildCity: 'ville',
  buildFactory: 'usine',
  buildPort: 'port',
  buildDefensePost: 'poste',
  buildMissileSilo: 'silo',
  buildSamLauncher: 'dca',
  buildWarship: 'navire',
  buildAtomBomb: 'bombe',
  buildHydrogenBomb: 'hbombe',
  buildMIRV: 'mirv',
}

const EMOJIS = ['😀', '😂', '😭', '😡', '🤝', '👍', '💀', '❤️']
// un emoji reste quelques secondes au-dessus du nom de qui l'envoie
const SHOUT_MS = 5000

// Les réglages d'une partie solo : ceux d'OpenFront, plus le nombre d'adversaires.
interface Settings extends Options {
  bots: number
  nations: boolean
}

const DEFAULT_SETTINGS: Settings = { ...DEFAULT_OPTIONS, bots: TRIBES, nations: true }
const SWITCHES: [Exclude<keyof Settings, 'bots'>, string][] = [
  ['nations', msg('Nations')],
  ['instantBuild', msg('Construction instantanée')],
  ['infiniteGold', msg('Or infini')],
  ['infiniteTroops', msg('Troupes infinies')],
  ['nukes', msg('Bombes')],
]

type Phase = 'menu' | 'salon' | 'chargement' | 'depart' | 'jeu' | 'fin'

interface Hud {
  troops: number
  max: number
  growth: number
  gold: number
  income: number
  top: { id: number; name: string; gold: number; troops: number }[]
  // tes attaques et tes débarquements en route, que tu peux rappeler
  attacks: { id: number; name: string; troops: number; boat: boolean }[]
  // ce qui arrive sur toi : attaques par la terre et débarquements en route
  incoming: { id: number; name: string; troops: number; boat: boolean }[]
  boats: number
  // temps restant du malus de trahison, en millisecondes
  traitor: number
}

interface Note {
  key: number
  text: string
  until: number
  actions?: { label: string; act: () => void }[]
  // demande d'alliance de ce joueur : le message part dès qu'elle n'est plus en attente
  request?: number
}

interface Result {
  win: boolean
  share: number
  ms: number
  by: string
  // les capsules gagnées par la partie, récompenses de niveau comprises
  caps: number
}

// quinze secondes entre deux cadres d'alerte, et pour qu'une attaque passe pour une riposte
const ALERT_TICKS = 150

const isNuke = (type: Buyable): type is NukeType => NUKES.includes(type as NukeType)

// Ce qu'on sait d'un joueur en un mot : toi, traître, allié, en guerre avec toi, ou simplement nation ou tribu.
function status(g: Game, id: number): string {
  const p = player(g, id)
  if (id === ME) return t('C’est toi.')
  if (isTraitor(g, p)) return t('Traître encore {time} : sa défense est affaiblie.', { time: formatTime((p.traitorUntil - g.tick) * TICK_MS) })
  const ally = allianceOf(g, ME, id)
  if (ally) return t('Allié encore {time}', { time: formatTime((ally.until - g.tick) * TICK_MS) })
  if (g.attacks.some((a) => a.from === id && a.to === ME)) return t('T’attaque')
  if (g.attacks.some((a) => a.from === ME && a.to === id)) return t('Tu l’attaques')
  return p.kind === 'bot' ? t('Tribu') : t('Nation')
}

const percent = (share: number) => fmt(share * 100, { maximumFractionDigits: share < 0.1 ? 1 : 0 })
const nameOf = (g: Game, id: number) => (id ? player(g, id).name : t('la nature'))

// L'action du clic gauche, et du centre de la roue : attaquer, prendre la mer, ou renforcer un allié.
async function primary(sim: Sim, tile: number, ratio: number): Promise<{ ok: boolean; text: string }> {
  const g = sim.g
  const owner = g.owner[tile]
  if (!passable(g, tile) || owner === ME) return { ok: false, text: '' }
  if (owner && allied(g, ME, owner)) {
    await sim.send({ op: 'troops', to: owner, ratio })
    return { ok: true, text: t('Troupes envoyées à {name}', { name: player(g, owner).name }) }
  }
  const order = await sim.send({ op: 'attack', tile, ratio })
  if (order) return { ok: true, text: order === 'mer' ? t('Bateau en route') : '' }
  return { ok: false, text: boatsOf(g, ME) >= MAX_BOATS ? t('Trois bateaux en mer au plus.') : t('Aucune route ne mène là.') }
}

function menuFor(sim: Sim, tile: number, ratio: number, say: (text: string) => void, showInfo: (id: number) => void): { items: MenuItem[]; center: MenuItem } | null {
  const g = sim.g
  if (!isLand(g, tile)) return null
  const owner = g.owner[tile]
  const me = player(g, ME)
  const ally = owner && owner !== ME ? allianceOf(g, ME, owner) : undefined
  const attack = () => primary(sim, tile, ratio).then((r) => say(r.text))
  const center: MenuItem = ally
    ? { id: 'troupes', label: t('Envoyer des troupes'), icon: ICON.troupes, act: attack }
    : { id: 'attaque', label: t('Attaquer'), icon: ICON.attaque, disabled: owner === ME || !passable(g, tile), act: attack }
  const info: MenuItem = { id: 'info', label: t('Infos'), icon: ICON.info, disabled: !owner, act: () => showInfo(owner) }

  if (owner === ME) {
    const near = g.units.some((u) => u.owner === ME && u.type !== 'navire' && distance(g, u.tile, tile) < STRUCTURE_MIN_DIST)
    const builds = UNITS.filter((type) => allowed(g, type)).map((type): MenuItem => {
      const price = priceOf(g, ME, type)
      return {
        id: type,
        label: t(UNIT_SHORT[type]),
        title: t(UNIT_NAMES[type]),
        icon: ICON[type],
        note: compact(price),
        disabled: me.gold < price || typeof buildSpot(g, ME, type, tile) === 'string',
        act: () => sim.send({ op: 'build', unit: type, tile }).then((r) => say(r === 'ok' ? '' : t(BUILD_ERRORS[r as Exclude<BuildResult, 'ok'>]))),
      }
    })
    return {
      center,
      items: [
        info,
        { id: 'supprimer', label: t('Démolir'), icon: ICON.supprimer, danger: true, disabled: !near, act: () => sim.send({ op: 'demolish', tile }) },
        { id: 'alliance', label: t('Alliance'), icon: ICON.alliance, disabled: true },
        { id: 'construire', label: t('Construire'), icon: ICON.construire, sub: builds },
      ],
    }
  }

  const silo = unitsOf(g, ME, 'silo').some((s) => s.ready <= g.tick && s.slots.some((c) => c <= g.tick))
  const nukes = NUKES.map((type): MenuItem => {
    const price = priceOf(g, ME, type)
    return {
      id: type,
      label: t(NUKE_NAMES[type]),
      icon: ICON[type],
      note: compact(price),
      danger: true,
      disabled: !silo || me.gold < price,
      act: () => sim.send({ op: 'launch', nuke: type, tile }).then((r) => (r === 'ok' ? buzz('tap') : say(t(r === 'tot' ? TOO_SOON : r === 'silo' ? NO_SILO : BUILD_ERRORS.or)))),
    }
  })
  return {
    center,
    items: [
      info,
      ally
        ? { id: 'rompre', label: t('Trahir'), icon: ICON.rompre, danger: true, act: () => sim.send({ op: 'betray', other: owner }) }
        : {
            id: 'bateau',
            label: t('Bateau'),
            icon: ICON.bateau,
            disabled: boatsOf(g, ME) >= MAX_BOATS,
            act: () => sim.send({ op: 'boat', tile, ratio }).then((ok) => say(ok ? t('Bateau en route') : t('Aucune route ne mène là.'))),
          },
      ally && ally.until - g.tick <= EXTEND_WINDOW
        ? { id: 'prolonger', label: t('Prolonger'), icon: ICON.prolonger, disabled: ally.extend.has(ME), act: () => sim.send({ op: 'extend', other: owner }) }
        : {
            id: 'alliance',
            label: t('Alliance'),
            icon: ICON.alliance,
            disabled: !owner || !!ally,
            act: () =>
              sim.send({ op: 'ally', to: owner }).then((r) =>
                say(
                  r === 'envoyée' ? t('Demande envoyée à {name}', { name: nameOf(g, owner) }) : r === 'attendre' ? t('Attends un peu avant de redemander.') : '',
                ),
              ),
          },
      ally
        ? { id: 'or', label: t('Don d’or'), icon: ICON.or, disabled: me.gold < 1, act: () => sim.send({ op: 'gold', to: owner, share: 0.25 }) }
        : { id: 'bombes', label: t('Bombes'), icon: ICON.bombe, danger: true, disabled: !g.options.nukes, sub: nukes },
    ],
  }
}

// La fiche d'un joueur : ses chiffres, et ce qu'on peut faire envers lui, comme sur OpenFront.
function PlayerCard({ g, sim, id, ratio, say, onClose }: { g: Game; sim: Sim; id: number; ratio: number; say: (text: string) => void; onClose: () => void }) {
  const [emojis, setEmojis] = useState(false)
  const p = player(g, id)
  const me = player(g, ME)
  const ally = allied(g, ME, id)
  return (
    <section className="of-info">
      <header>
        <b>{p.name}</b>
        <button onClick={onClose} aria-label={t('Fermer')}>
          ×
        </button>
      </header>
      <dl>
        <dt>{t('Troupes')}</dt>
        <dd>{troopsText(p.troops)}</dd>
        <dt>{t('Or')}</dt>
        <dd className="of-gold">{id === ME && g.options.infiniteGold ? '∞' : compact(p.gold)}</dd>
        <dt>{t('Territoire')}</dt>
        <dd>{percent(p.tiles / g.land)} %</dd>
        <dt>{t('Villes')}</dt>
        <dd>{unitsOf(g, id, 'ville').length}</dd>
      </dl>
      <p>{status(g, id)}</p>
      {id !== ME && (
        <div className="of-acts">
          <button onClick={() => setEmojis(!emojis)} aria-expanded={emojis}>
            {t('Emoji')}
          </button>
          {!ally && (
            <button onClick={() => sim.send({ op: 'target', other: id }).then((ok) => !ok && say(t('Une nouvelle cible dans quelques secondes.')))}>
              {me.target === id ? t('Ne plus cibler') : t('Cibler')}
            </button>
          )}
          <button onClick={() => sim.send({ op: 'embargo', other: id })}>{me.embargo.has(id) ? t('Lever l’embargo') : t('Embargo')}</button>
          {ally && (
            <button onClick={() => sim.send({ op: 'troops', to: id, ratio }).then(() => say(t('Troupes envoyées à {name}', { name: p.name })))}>
              {t('Envoyer des troupes')}
            </button>
          )}
          {ally && <button onClick={() => sim.send({ op: 'gold', to: id, share: 0.25 })}>{t('Don d’or')}</button>}
        </div>
      )}
      {emojis && (
        <div className="of-emojis">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => {
                setEmojis(false)
                sim.send({ op: 'emoji', to: id, emoji: e }).then((ok) => !ok && say(t('Attends un peu avant le prochain emoji.')))
              }}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

export default function OpenFront() {
  const [level, setLevel] = useState<Level>(() => load<Level>('openfront-niveau', 'moyen'))
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...load<Partial<Settings>>('openfront-options', {}) }))
  const [name] = useState(() => loadProfile().name || t('Toi'))
  // en ligne, un joueur sans nom en prend un au hasard, comme les « Anon » d'OpenFront
  const [netName] = useState(() => loadProfile().name || `Anon${Math.floor(100 + Math.random() * 900)}`)
  const [sim, setSim] = useState<Sim | null>(null)
  const [ready, setReady] = useState(false)
  const [phase, setPhase] = useState<Phase>('menu')
  // une partie a été lancée depuis l'accueil
  const [playing, setPlaying] = useState(false)
  const [paused, setPaused] = useState(false)
  // une partie en ligne : son salon, et ce que l'hôte a fixé au lancement
  const [online, setOnline] = useState<{ lobby: Lobby; start: Start } | null>(null)
  const [salon, setSalon] = useState<SalonKind>('public')
  // les réglages du son, ouverts pendant la partie
  const [sound, setSound] = useState(false)
  const [countdown, setCountdown] = useState(0)
  // en ligne, la part écoulée de la phase de placement, comme la barre d'OpenFront
  const [spawnShare, setSpawnShare] = useState(0)
  // le cadre qui clignote quand on est trahi ou vraiment attaqué ; `n` relance l'animation
  const [alert, setAlert] = useState<{ kind: 'trahison' | 'attaque'; n: number } | null>(null)
  const [ratio, setRatio] = useState(() => load('openfront-attaque', 20))
  const [speed, setSpeed] = useState(1)
  const [hud, setHud] = useState<Hud | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; tile: number } | null>(null)
  const [info, setInfo] = useState(0)
  const [placing, setPlacing] = useState<Buyable | null>(null)
  const [hover, setHover] = useState(0)
  // navire de guerre qu'on s'apprête à envoyer ailleurs
  const [steering, setSteering] = useState(false)
  const hoverRef = useRef<HTMLDivElement>(null)
  // le bâtiment survolé dans la barre de construction
  const barHover = useRef<Buyable | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // les gestes et la boucle d'affichage lisent ces valeurs sans se relancer
  const live = useRef({ phase, ratio, placing, paused })
  live.current = { phase, ratio, placing, paused }
  const sayTimer = useRef(0)
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

  function say(text: string) {
    if (!text) return
    setMessage(text)
    clearTimeout(sayTimer.current)
    sayTimer.current = window.setTimeout(() => setMessage(''), 2200)
  }

  // la carte se construit après le premier affichage, pour montrer le chargement ; la partie part dans son Worker
  useEffect(() => {
    if (sim || !playing) return
    const id = window.setTimeout(() => {
      const map = worldMap()
      const names = Object.fromEntries(map.seats.map((s) => [s.code, countryName(s.code)]))
      const next = online
        ? new Sim({
            map,
            names,
            level: online.start.settings.level,
            humans: online.start.members.map((m) => m.name),
            me: online.lobby.playerOf(online.lobby.key),
            seed: online.start.seed,
            nations: online.start.settings.nations ? NATIONS : 0,
            tribes: online.start.settings.bots,
            options: { ...DEFAULT_OPTIONS, nukes: online.start.settings.nukes },
            net: online.lobby,
          })
        : new Sim({ map, names, level, humans: [name], me: 1, seed: Math.floor(Math.random() * 2 ** 31), nations: settings.nations ? NATIONS : 0, tribes: settings.bots, options: settings })
      ME = next.me
      next.onReady = () => {
        setReady(true)
        setPhase('depart')
      }
      setSim(next)
    }, 30)
    return () => clearTimeout(id)
  }, [sim, playing, level, name, settings, online])

  useEffect(() => () => sim?.stop(), [sim])
  // la pause d'OpenFront, en solo
  useEffect(() => {
    if (sim && phase === 'jeu') sim.run(!paused && !document.hidden)
  }, [sim, phase, paused])
  useEffect(() => sim?.setSpeed(speed), [sim, speed])

  function configure(change: Partial<Settings>) {
    const next = { ...settings, ...change }
    setSettings(next)
    save('openfront-options', next)
    restart()
  }

  function home() {
    online?.lobby.leave()
    setOnline(null)
    setPlaying(false)
    restart()
    setPhase('menu')
  }

  function restart(next: Level = level) {
    setLevel(next)
    save('openfront-niveau', next)
    setSim(null)
    setReady(false)
    setPaused(false)
    setPhase(playing ? 'chargement' : 'menu')
    setCountdown(0)
    setResult(null)
    setMenu(null)
    setInfo(0)
    setNotes([])
    setHud(null)
    setSpeed(1)
    setPlacing(null)
    setHover(0)
    setSteering(false)
  }

  useEffect(() => {
    if (!sim || !ready) return
    const g = sim.g
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const me = player(g, ME)
    const painter = new Painter(g)
    // le motif de chacun : le sien en solo, celui de chaque joueur du salon en ligne
    const skins = new Map<number, Skin>(online ? online.start.members.map((m, i) => [i + 1, skinById(m.skin)]) : [[ME, skinById(loadSkin())]])
    painter.setSkins(skins)
    painter.setPalette(palette(canvas, g, ME))
    // les touches choisies à l'accueil
    const keymap = loadKeys()
    // la case sous la souris, que visent les raccourcis d'attaque et de diplomatie
    let aim = -1
    const labels = new Labels()
    const view: View & { fit: number } = { s: 1, x: 0, y: 0, fit: 1 }
    const overlay: Overlay = { preview: null, floats: [], marks: new Map(), ship: 0, fx: sim.fx, ghost: null, sams: false, highlight: null }
    const floats: Float[] = overlay.floats
    // dernier emoji de chaque joueur, affiché au-dessus de son nom
    const shouts = new Map<number, { emoji: string; until: number }>()
    let cw = 0
    let ch = 0
    let spawnAt = 0
    let started = 0
    let best = 0
    let key = 0
    const warned = new Set<number>()
    // la dernière attaque du joueur contre chacun : une riposte ne déclenche pas d'alerte
    const attacked = new Map<number, number>()
    let alertTick = -Infinity

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
      const w = Math.round(cw * devicePixelRatio)
      const h = Math.round(ch * devicePixelRatio)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      view.fit = Math.min(cw / g.w, ch / g.h)
      if (first) {
        // sur un téléphone en hauteur, le monde entier serait minuscule : on part zoomé sur l'Europe et l'Afrique
        view.s = ch > cw ? Math.min(view.fit * 6, (ch * 0.7) / g.h) : view.fit
        view.x = (cw - g.w * view.s) / 2
        view.y = (ch - g.h * view.s) / 2
      }
      clamp()
      // changer la taille vide le canevas, et l'observateur passe après l'image déjà dessinée :
      // sans ce nouveau dessin, l'écran clignote en blanc quand la barre des attaques apparaît ou disparaît
      if (!first) paint(performance.now())
    }
    const zoomAt = (x: number, y: number, f: number) => {
      const s = Math.min(Math.max(view.s * f, view.fit), view.fit * 40)
      view.x = x - ((x - view.x) * s) / view.s
      view.y = y - ((y - view.y) * s) / view.s
      view.s = s
      clamp()
    }

    // la clé est prise avant d'ajouter le message, pour que ses boutons ferment bien celui-là
    const note = (text: string, actions?: (close: () => void) => Note['actions'], seconds = 8, request?: number) => {
      const k = ++key
      const close = () => setNotes((list) => list.filter((n) => n.key !== k))
      const item: Note = { key: k, text, actions: actions?.(close), until: performance.now() + seconds * 1000, request }
      setNotes((list) => [...list.slice(-2), item])
    }

    // ce qui arrive au joueur : demandes d'alliance à trancher, trahisons, bombes
    const readEvents = () => {
      for (const e of g.events) {
        const other = e.from === ME ? e.to : e.from
        const who = nameOf(g, other)
        if (e.type === 'request' && e.to === ME)
          note(
            t('{name} propose une alliance', { name: who }),
            (close) => [
              { label: t('Accepter'), act: () => (sim.send({ op: 'accept', from: e.from }), close()) },
              { label: t('Refuser'), act: () => (sim.send({ op: 'refuse', from: e.from }), close()) },
            ],
            20,
            e.from,
          )
        else if (e.type === 'accepted' && e.to === ME) note(t('{name} accepte l’alliance', { name: who }))
        else if (e.type === 'accepted' && e.from === ME) note(t('Alliance conclue avec {name}', { name: who }))
        else if (e.type === 'refused' && e.to === ME && e.from !== ME) note(t('{name} refuse l’alliance', { name: who }))
        else if (e.type === 'extend' && (e.from === ME || e.to === ME))
          note(t('L’alliance avec {name} touche à sa fin', { name: who }), (close) => [{ label: t('Prolonger'), act: () => (sim.send({ op: 'extend', other }), close()) }], 30)
        else if (e.type === 'expired' && (e.from === ME || e.to === ME)) note(t('Fin de l’alliance avec {name}', { name: who }))
        else if (e.type === 'betrayed' && e.to === ME) {
          note(t('{name} t’a trahi !', { name: who }))
          alertTick = g.tick
          setAlert((a) => ({ kind: 'trahison', n: (a?.n ?? 0) + 1 }))
        }
        else if (e.type === 'nuke' && e.to === ME) {
          buzz('bad')
          note(t('Bombe lancée par {name} !', { name: who }))
        } else if (e.type === 'intercepted' && e.from === ME) note(t('Ta défense a abattu une bombe de {name}', { name: nameOf(g, e.to) }))
        else if (e.type === 'intercepted' && e.to === ME) note(t('Ta bombe a été abattue'))
        else if (e.type === 'eliminated' && e.from === ME)
          note(e.gold ? t('Tu as éliminé {name} : +{gold} or', { name: nameOf(g, e.to), gold: compact(e.gold) }) : t('Tu as éliminé {name}', { name: nameOf(g, e.to) }))
        else if (e.type === 'captured' && e.to === ME) note(t('{name} a pris ton navire marchand', { name: who }))
        else if (e.type === 'captured' && e.from === ME) note(t('Tu as pris un navire marchand de {name}', { name: who }))
        else if (e.type === 'embargo' && e.to === ME) note(t('{name} cesse de commercer avec toi', { name: who }))
        if (e.type === 'emoji' && e.emoji) {
          shouts.set(e.from, { emoji: e.emoji, until: performance.now() + SHOUT_MS })
          if (e.to === ME && e.from !== ME) note(`${who} : ${e.emoji}`, undefined, 5)
        }
        // l'or du commerce s'affiche au port où il arrive
        if (e.type === 'trade' && (e.from === ME || e.to === ME) && e.gold && e.tile !== undefined)
          floats.push({ tile: e.tile, text: `+${compact(e.gold)}`, at: performance.now() })
      }
      g.events = []
    }

    const finish = (win: boolean) => {
      live.current.phase = 'fin'
      sim.run(false)
      const ms = performance.now() - started
      const by = win ? '' : me.killer ? player(g, me.killer).name : (g.players.find((p) => p.id === winner(g))?.name ?? '')
      const before = earnedOf(plays())
      recordPlay('openfront', { pts: win ? 100 : Math.round(Math.min(1, best / WIN_SHARE) * 80), s: Math.round(best * 100), win, ms, ...(online && { sub: 'multi' }) })
      play(win ? 'victory' : 'defeat')
      buzz(win ? 'win' : 'lose')
      setResult({ win, share: best, ms, by, caps: earnedOf(plays()) - before })
      setPhase('fin')
    }

    if (online) {
      online.lobby.onClose = (reason) => note(reason === 'hote' ? t('L’hôte a quitté la partie : elle s’arrête ici.') : t('Connexion perdue avec la partie en ligne.'), undefined, 30)
      online.lobby.onDesync = () => note(t('Ta partie s’est désynchronisée de celle des autres joueurs.'), undefined, 30)
    }

    // chaque tour arrive du Worker : on lit ce qui s'est passé, et on regarde si la partie est finie
    sim.onTick = () => {
      readEvents()
      for (const cue of sim.cues.splice(0)) play(cue)
      // les postes de défense gardent leur zone ; alliés et embargos teintent les bordures
      painter.setPosts(g.units.filter((u) => u.type === 'poste' && u.ready <= g.tick).map((u) => ({ tile: u.tile, owner: u.owner })))
      painter.setRelations(
        g.players.filter((p) => p.id !== ME && allied(g, ME, p.id)).map((p) => p.id),
        [...me.embargo],
      )
      if (live.current.phase !== 'jeu') return
      best = Math.max(best, me.tiles / g.land)
      const w = winner(g)
      if (!me.alive || w) finish(w === ME)
    }

    let raf = 0
    let frames = 0
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      // filet de sécurité si la taille ou la densité de pixels ont changé sans prévenir (zoom du navigateur, rotation)
      if (++frames % 30 === 0 && (canvas.clientWidth !== cw || canvas.clientHeight !== ch || canvas.width !== Math.round(cw * devicePixelRatio))) resize()
      // en ligne, la partie démarre au tour fixé pour tous ; en solo, dix secondes après son placement
      if (live.current.phase === 'depart' && (online ? sim.turn >= SPAWN_TURNS : spawnAt && now - spawnAt >= SPAWN_TICKS * TICK_MS)) {
        live.current.phase = 'jeu'
        setPhase('jeu')
        play('game-start')
        started = now
        sim.run(!document.hidden)
      }
      paint(now)
      // de près, un bâtiment fait entendre son ambiance
      const center = { x: (cw / 2 - view.x) / view.s, y: (ch / 2 - view.y) / view.s }
      const track = view.s >= 8 ? ambienceAt(g.units, g.w, center.x, center.y) : null
      ambience(track, ambienceGain(view.s, view.fit * 40))
    }
    const paint = (now: number) => {
      painter.flush()
      while (floats.length && now - floats[0].at > FLOAT_MS) floats.shift()
      // comme sur OpenFront : les zones antiaériennes en préparant silo, défense, ville ou bombe, ou en survolant la défense
      const buying = live.current.placing
      const hovered = barHover.current
      overlay.sams = (!!buying && SAM_VIEW.has(buying)) || hovered === 'dca'
      overlay.highlight = hovered && !isNuke(hovered) ? hovered : null
      if (!buying) overlay.ghost = null
      overlay.marks.clear()
      if (me.target) overlay.marks.set(me.target, '🎯')
      for (const [id, shout] of shouts)
        if (shout.until < now) shouts.delete(id)
        else overlay.marks.set(id, overlay.marks.has(id) ? `${overlay.marks.get(id)} ${shout.emoji}` : shout.emoji)
      draw(ctx, painter, labels, g, view, cw, ch, sim.labels, ME, live.current.phase === 'jeu' ? sim.progress(now) : 0, now, overlay)
    }
    resize()
    raf = requestAnimationFrame(frame)

    // un onglet en arrière-plan met la partie en pause
    const visibility = () => {
      if (document.hidden) ambience(null, 0)
      if (live.current.phase === 'jeu') sim.run(!document.hidden && !live.current.paused)
    }
    document.addEventListener('visibilitychange', visibility)

    const hudTimer = window.setInterval(() => {
      if (live.current.phase === 'depart' && online) {
        setCountdown(Math.max(1, Math.ceil(((SPAWN_TURNS - Math.max(0, sim.turn)) * TICK_MS) / 1000)))
        setSpawnShare(Math.max(0, sim.turn) / SPAWN_TURNS)
      }
      else if (spawnAt && live.current.phase === 'depart') setCountdown(Math.max(1, Math.ceil((SPAWN_TICKS * TICK_MS - (performance.now() - spawnAt)) / 1000)))
      if (live.current.phase !== 'jeu') return
      const now = performance.now()
      const stale = (n: Note) => n.until < now || (!!n.request && !g.requests.some((r) => r.from === n.request && r.to === ME))
      setNotes((list) => (list.some(stale) ? list.filter((n) => !stale(n)) : list))
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
        top: top.map((p) => ({ id: p.id, name: p.name, gold: p.gold, troops: p.troops })),
        attacks: [
          ...g.attacks.filter((a) => a.from === ME).map((a) => ({ id: a.id, name: nameOf(g, a.to), troops: a.troops, boat: false })),
          ...g.boats.filter((b) => b.owner === ME && !b.trade && !b.back).map((b) => ({ id: b.id, name: nameOf(g, b.to), troops: b.troops, boat: true })),
        ],
        incoming: [
          ...g.attacks.filter((a) => a.to === ME).map((a) => ({ id: a.id, name: nameOf(g, a.from), troops: a.troops, boat: false })),
          ...g.boats.filter((b) => b.to === ME && !b.trade && !b.back).map((b) => ({ id: b.id, name: nameOf(g, b.owner), troops: b.troops, boat: true })),
        ],
        boats: boatsOf(g, ME),
        traitor: Math.max(0, (me.traitorUntil - g.tick) * TICK_MS),
      })
      // une alerte à chaque nouvelle attaque ou débarquement contre toi
      for (const a of g.attacks) if (a.from === ME) attacked.set(a.to, g.tick)
      for (const a of g.attacks)
        if (a.to === ME && !warned.has(a.id)) {
          warned.add(a.id)
          buzz('bad')
          note(t('{name} t’attaque avec {n} troupes', { name: nameOf(g, a.from), n: troopsText(a.troops) }), undefined, 6)
          // le cadre d'OpenFront : une vraie offensive, ni riposte, ni escarmouche, ni bot, pas plus d'une fois en quinze secondes
          const serious = player(g, a.from).kind !== 'bot' && a.troops >= me.troops / 5
          const riposte = g.tick - (attacked.get(a.from) ?? -Infinity) < ALERT_TICKS
          if (serious && !riposte && g.tick - alertTick >= ALERT_TICKS) {
            alertTick = g.tick
            setAlert((x) => ({ kind: 'attaque', n: (x?.n ?? 0) + 1 }))
          }
        }
      for (const b of g.boats)
        if (b.to === ME && !b.trade && !warned.has(b.id)) {
          warned.add(b.id)
          buzz('bad')
          note(t('Débarquement de {name} en approche : {n} troupes', { name: nameOf(g, b.owner), n: troopsText(b.troops) }), undefined, 6)
        }
    }, 250)

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
    const steer = (id: number) => {
      overlay.ship = id
      setSteering(id > 0)
    }
    const tap = (x: number, y: number, touch: boolean) => {
      const tile = cellAt(x, y)
      if (tile < 0) return
      if (live.current.phase === 'depart') {
        if (!passable(g, tile) || (g.owner[tile] && g.owner[tile] !== ME)) return say(t('Choisis une terre libre.'))
        sim.spawn(tile)
        spawnAt ||= performance.now()
        play('spawn')
        buzz('tap')
        return
      }
      if (live.current.phase !== 'jeu') return
      const buying = live.current.placing
      if (buying) {
        setPlacing(null)
        overlay.preview = null
        const order = isNuke(buying) ? sim.send({ op: 'launch', nuke: buying, tile }) : sim.send({ op: 'build', unit: buying, tile })
        order.then((r) => (r === 'ok' ? buzz('tap') : say(t(r === 'silo' ? NO_SILO : r === 'tot' ? TOO_SOON : BUILD_ERRORS[r as Exclude<BuildResult, 'ok'>]))))
        return
      }
      // un navire de guerre sélectionné file vers la mer touchée ; toucher la terre le relâche
      if (overlay.ship) {
        const ship = overlay.ship
        steer(0)
        if (!isLand(g, tile)) {
          sim.send({ op: 'move', unit: ship, tile }).then((ok) => say(ok ? '' : t('Le navire ne peut pas aller là.')))
          return
        }
      }
      const mine = g.units.find((u) => u.type === 'navire' && u.owner === ME && Math.hypot(view.x + ((u.tile % g.w) + 0.5) * view.s - x, view.y + (Math.floor(u.tile / g.w) + 0.5) * view.s - y) < 14)
      if (mine) return steer(mine.id)
      if (touch) return openMenu(x, y)
      primary(sim, tile, live.current.ratio).then((r) => {
        if (r.ok) buzz('tap')
        say(r.text)
      })
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
    let hovered = 0
    const move = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId)
      if (!prev) {
        if (e.pointerType !== 'mouse') return
        const p = pos(e)
        const tile = cellAt(p.x, p.y)
        aim = tile
        // en visant avec une bombe, la zone touchée suit la souris ; un bâtiment montre son fantôme
        const buying = live.current.placing
        overlay.preview = buying && isNuke(buying) && tile >= 0 ? { tile, ...BLAST[buying === 'mirv' ? 'ogive' : buying], from: siloFor(g, tile) } : null
        overlay.ghost = buying && !isNuke(buying) && tile >= 0 ? ghostAt(g, buying, tile, settings.infiniteGold) : null
        const id = tile >= 0 && live.current.phase !== 'chargement' ? g.owner[tile] : 0
        const card = hoverRef.current
        if (card) card.style.transform = `translate(${p.x > cw - 240 ? p.x - 236 : p.x + 16}px, ${p.y > ch - 170 ? p.y - 150 : p.y + 16}px)`
        if (id !== hovered) setHover((hovered = id))
        return
      }
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
      if (overlay.ship) return steer(0)
      if (live.current.placing) {
        overlay.preview = null
        return setPlacing(null)
      }
      const p = pos(e)
      openMenu(p.x, p.y)
    }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const p = pos(e)
      // une molette à crans (deltaMode 1) avance par lignes : on la ramène en pixels
      zoomAt(p.x, p.y, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 33 : 1) * 0.006))
    }
    // les raccourcis d'OpenFront, avec les touches choisies à l'accueil
    const keys = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.code === 'Escape') {
        steer(0)
        overlay.preview = null
        setPlacing(null)
        return
      }
      const action = actionFor(keymap, e.code)
      if (!action) return
      const step = 80
      const target = aim >= 0 ? g.owner[aim] : 0
      const playing = live.current.phase === 'jeu'
      switch (action) {
        case 'moveUp':
          view.y += step
          break
        case 'moveDown':
          view.y -= step
          break
        case 'moveLeft':
          view.x += step
          break
        case 'moveRight':
          view.x -= step
          break
        case 'zoomOut':
          zoomAt(cw / 2, ch / 2, 1 / 1.4)
          break
        case 'zoomIn':
          zoomAt(cw / 2, ch / 2, 1.4)
          break
        // tant que la touche est tenue, chaque territoire prend la couleur de son camp
        case 'toggleView':
          painter.setAlt(ME)
          break
        case 'centerCamera': {
          const home = sim.labels.find((a) => a.id === ME)
          if (!home) return
          view.s = Math.max(view.s, view.fit * 4)
          view.x = cw / 2 - (home.x + 0.5) * view.s
          view.y = ch / 2 - (home.y + 0.5) * view.s
          break
        }
        case 'attackRatioDown':
        case 'attackRatioUp':
          changeRatio(Math.min(100, Math.max(1, live.current.ratio + (action === 'attackRatioDown' ? -10 : 10))))
          break
        case 'groundAttack':
          if (playing && aim >= 0) primary(sim, aim, live.current.ratio).then((r) => say(r.text))
          break
        case 'boatAttack':
          if (playing && aim >= 0) sim.send({ op: 'boat', tile: aim, ratio: live.current.ratio }).then((ok) => say(ok ? t('Bateau en route') : t('Aucune route ne mène là.')))
          break
        case 'requestAlliance':
          if (playing && target && target !== ME) sim.send({ op: 'ally', to: target })
          break
        case 'breakAlliance':
          if (playing && target && allied(g, ME, target)) sim.send({ op: 'betray', other: target })
          break
        case 'targetPlayer':
          if (playing && target && target !== ME) sim.send({ op: 'target', other: target })
          break
        case 'emojiMenu':
          if (target && target !== ME) setInfo(target)
          break
        // en ligne, la partie avance au rythme de l'hôte
        case 'pauseGame':
          if (playing && !online) setPaused((p) => !p)
          break
        case 'gameSpeedDown':
        case 'gameSpeedUp':
          if (!online) setSpeed((v) => Math.min(3, Math.max(1, v + (action === 'gameSpeedDown' ? -1 : 1))))
          break
        default: {
          const build = BUILDS[action]
          if (!build || !playing || !allowed(g, build)) return
          setPlacing(build)
        }
      }
      e.preventDefault()
      clamp()
    }
    const release = (e: KeyboardEvent) => actionFor(keymap, e.code) === 'toggleView' && painter.setAlt(0)
    window.addEventListener('keydown', keys)
    window.addEventListener('keyup', release)
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    const leave = () => {
      overlay.preview = null
      overlay.ghost = null
      setHover((hovered = 0))
    }
    canvas.addEventListener('pointerleave', leave)
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
      ambience(null, 0)
      // l'accueil se pose sur le canevas : il ne doit pas garder la dernière image de la partie
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      clearInterval(hudTimer)
      observer.disconnect()
      themes.disconnect()
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('keydown', keys)
      window.removeEventListener('keyup', release)
      sim.onTick = () => {}
      canvas.removeEventListener('pointerleave', leave)
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('contextmenu', context)
      canvas.removeEventListener('wheel', wheel)
    }
  }, [sim, ready])

  async function share() {
    if (!result) return
    const text = `Frontières Expedle · ${result.win ? '🏆' : '💀'} ${t('{pct} % des terres en {time}', { pct: percent(result.share), time: formatTime(result.ms) })}`
    say((await copyText(text)) ? t('Résultat copié !') : t('Copie impossible'))
  }

  function changeRatio(n: number) {
    play('slider')
    setRatio(n)
    save('openfront-attaque', n)
  }

  // les touches choisies à l'accueil, relues à chaque changement d'écran
  const keymap = useMemo(loadKeys, [phase])
  const g = ready ? sim?.g : undefined
  const radial = g && sim && menu ? menuFor(sim, menu.tile, ratio, say, setInfo) : null
  const shown = g && info ? player(g, info) : null
  const hovered = g && hover ? player(g, hover) : null

  return (
    <div className="of">
      <AppBar
        title="Frontières"
        tools={
          phase !== 'menu' && (
            <>
              {phase === 'jeu' && !online && (
                <button className="ui-tool" onClick={() => restart()} aria-label={t('Recommencer')}>
                  ↺
                </button>
              )}
              <button className="ui-tool" onClick={() => setSound(!sound)} aria-label={t('Son')} aria-expanded={sound}>
                ♪
              </button>
              <button className="ui-tool" onClick={home} aria-label={t('Accueil du jeu')}>
                ⌂
              </button>
            </>
          )
        }
      />
      <main className="of-main">
        <div className="of-map">
          <canvas ref={canvasRef} />
          {phase === 'menu' && (
            <Menu
              name={name}
              multi={cloudEnabled}
              onSolo={() => {
                setPlaying(true)
                setPhase('chargement')
              }}
              onMulti={(kind) => {
                setSalon(kind)
                setPhase('salon')
              }}
            />
          )}
          {phase === 'salon' && (
            <Salon
              kind={salon}
              name={netName}
              skin={loadSkin()}
              onBack={() => setPhase('menu')}
              onStart={(lobby, start) => {
                setOnline({ lobby, start })
                setPlaying(true)
                setPhase('chargement')
              }}
            />
          )}
          {paused && phase === 'jeu' && <div className="of-paused">{t('Pause')}</div>}
          {phase === 'chargement' && (
            <p className="of-loading">
              {t('Chargement de la carte…')}
              <small>{t('D’après OpenFront')} · © OpenFront and Contributors</small>
            </p>
          )}
          {phase === 'depart' && (
            <div className="of-intro">
              <b>{countdown ? t('La partie commence dans {n} s', { n: countdown }) : t('Touche la carte pour choisir ton point de départ.')}</b>
              <span>{coarse ? t('Ensuite, touche la carte pour ouvrir la roue d’action.') : t('Ensuite : clic gauche pour attaquer, clic droit pour la roue d’action.')}</span>
              {online ? (
                <span>{t('Partie en ligne · {n} joueurs', { n: online.start.members.length })}</span>
              ) : (
                <>
                  <div className="of-levels" role="radiogroup" aria-label={t('Difficulté')}>
                    {LEVELS.map((l) => (
                      <button key={l} role="radio" aria-checked={l === level} className={l === level ? 'on' : ''} onClick={() => restart(l)}>
                        {t(LEVEL_NAMES[l])}
                      </button>
                    ))}
                  </div>
                  <div className="of-options">
                    <label>
                      {t('Bots')}
                      <select value={settings.bots} onChange={(e) => configure({ bots: Number(e.target.value) })}>
                        {BOTS.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                    {SWITCHES.map(([key, label]) => (
                      <label key={key}>
                        <input type="checkbox" checked={settings[key]} onChange={(e) => configure({ [key]: e.target.checked })} />
                        {t(label)}
                      </label>
                    ))}
                  </div>
                </>
              )}
              <small className="of-keys">{t('D’après OpenFront')} · © OpenFront and Contributors</small>
              {!coarse && <small className="of-keys">{t('Clavier : WASD ou flèches pour se déplacer, Q et E pour zoomer, C pour te retrouver, T et Y pour la part envoyée, 1 à 0 pour bâtir, Échap pour annuler.')}</small>}
            </div>
          )}
          {(phase === 'jeu' || phase === 'fin') && hud && (
            <ol className="of-rank">
              <li className="head">
                <span />
                <small>{t('Or')}</small>
                <small>{t('Troupes')}</small>
              </li>
              {hud.top.map((p) => (
                <li key={p.id} className={p.id === ME ? 'me' : ''}>
                  <span>{p.name}</span>
                  <b className="of-gold">{p.id === ME && settings.infiniteGold ? '∞' : compact(p.gold)}</b>
                  <b>{troopsText(p.troops)}</b>
                </li>
              ))}
            </ol>
          )}
          {shown && g && sim && <PlayerCard key={shown.id} g={g} sim={sim} id={shown.id} ratio={ratio} say={say} onClose={() => setInfo(0)} />}
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
          {phase === 'jeu' && hud && hud.traitor > 0 && (
            <div className="of-traitor" role="status">
              {t('Traître encore {time} : ta défense est affaiblie', { time: formatTime(hud.traitor) })}
            </div>
          )}
          {steering && phase === 'jeu' && (
            <div className="of-placing">
              <span>{t('Touche la mer où envoyer ton navire de guerre')}</span>
            </div>
          )}
          {placing && phase === 'jeu' && (
            <div className="of-placing">
              <span>
                {NUKES.includes(placing as NukeType)
                  ? t('Touche la cible : {name}', { name: t(NUKE_NAMES[placing as NukeType]) })
                  : t('Touche l’endroit où bâtir : {name}', { name: t(UNIT_NAMES[placing as UnitType]) })}
              </span>
              <button onClick={() => setPlacing(null)}>{t('Annuler')}</button>
            </div>
          )}
          <div ref={hoverRef} className="of-hover" hidden={!hovered || !!menu}>
            {hovered && g && (
              <>
                <b>
                  {hovered.code ? `${flagEmoji(hovered.code)} ` : ''}
                  {hovered.name}
                </b>
                <dl>
                  <dt>{t('Troupes')}</dt>
                  <dd>{troopsText(hovered.troops)}</dd>
                  <dt>{t('Or')}</dt>
                  <dd className="of-gold">{compact(hovered.gold)}</dd>
                  <dt>{t('Territoire')}</dt>
                  <dd>{percent(hovered.tiles / g.land)} %</dd>
                  <dt>{t('Villes')}</dt>
                  <dd>{unitsOf(g, hovered.id, 'ville').length}</dd>
                </dl>
                <p>{status(g, hovered.id)}</p>
              </>
            )}
          </div>
          {alert && <div key={alert.n} className={`of-alert ${alert.kind}`} onAnimationEnd={() => setAlert(null)} />}
          {online && phase === 'depart' && (
            <div className="of-spawnbar" aria-hidden>
              <i style={{ width: `${spawnShare * 100}%` }} />
            </div>
          )}
          {sound && phase !== 'menu' && phase !== 'salon' && (
            <div className="of-sheet">
              <SoundPanel />
              <button className="of-back" onClick={() => setSound(false)}>
                {t('Fermer')}
              </button>
            </div>
          )}
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
              <span className="of-gain">
                {t('Gagné')} <Caps n={result.caps} />
              </span>
              <div className="of-end-actions">
                {online ? (
                  <button className="ui-btn" onClick={() => setResult(null)}>
                    {t('Regarder la suite')}
                  </button>
                ) : (
                  <button className="ui-btn" onClick={() => restart()}>
                    {t('Rejouer')}
                  </button>
                )}
                <button className="ui-btn line" onClick={share}>
                  {t('Partager')}
                </button>
                <button className="ui-btn line" onClick={home}>
                  {t('Accueil du jeu')}
                </button>
              </div>
            </section>
          )}
        </div>
        {phase === 'jeu' && hud && (
          <>
            {(hud.attacks.length > 0 || hud.incoming.length > 0) && (
              <ul className="of-attacks">
                {hud.incoming.map((a) => (
                  <li key={`in${a.id}`} className="in">
                    <span>
                      {a.boat ? '⛵' : '⚔'} {a.name} · {troopsText(a.troops)}
                    </span>
                  </li>
                ))}
                {hud.attacks.map((a) => (
                  <li key={`${a.boat ? 'b' : 'a'}${a.id}`}>
                    <span>
                      {a.boat ? '⛵' : '→'} {a.name} · {troopsText(a.troops)}
                    </span>
                    <button
                      onClick={() => sim?.send(a.boat ? { op: 'recall', boat: a.id } : { op: 'retreat', attack: a.id })}
                      aria-label={a.boat ? t('Faire demi-tour') : t('Rappeler les troupes')}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {g && (
              // la barre de construction d'OpenFront : la touche, l'icône, combien on en a ; grisée faute d'or
              <div className="of-build">
                {BAR.filter(([, type]) => allowed(g, type)).map(([action, type]) => {
                  const nuke = NUKES.includes(type as NukeType)
                  const price = priceOf(g, ME, type)
                  const owned = nuke ? 0 : unitsOf(g, ME, type as UnitType).length
                  const armed = !nuke || unitsOf(g, ME, 'silo').some((u) => u.ready <= g.tick)
                  return (
                    <button
                      key={type}
                      className={placing === type ? 'on' : ''}
                      title={`${t(nuke ? NUKE_NAMES[type as NukeType] : UNIT_NAMES[type as UnitType])} · ${compact(price)} ${t('or')}`}
                      aria-label={t(nuke ? NUKE_NAMES[type as NukeType] : UNIT_NAMES[type as UnitType])}
                      disabled={(!settings.infiniteGold && hud.gold < price) || !armed}
                      onClick={() => {
                        play('click')
                        setPlacing(placing === type ? null : type)
                      }}
                      onMouseEnter={() => (barHover.current = type)}
                      onMouseLeave={() => (barHover.current = null)}
                    >
                      <kbd>{keyName(keymap[action])}</kbd>
                      <Glyph src={ICON[type]} size={20} />
                      {owned > 0 && <small>{owned}</small>}
                      <b className="of-gold">{compact(price)}</b>
                    </button>
                  )
                })}
              </div>
            )}
            <div className="of-hud">
              <div className="of-stat">
                <span>
                  <b>{troopsText(hud.troops)}</b> / {troopsText(hud.max)} <small>+{troopsText(hud.growth)}/s</small>
                </span>
                <span className="of-bar">
                  <i style={{ width: `${Math.min(100, (hud.troops / hud.max) * 100)}%` }} />
                </span>
              </div>
              <div className="of-stat">
                <span>
                  <b className="of-gold">{settings.infiniteGold ? '∞' : compact(hud.gold)}</b> <span className="of-gold">{t('or')}</span> <small>+{compact(hud.income)}/s</small>
                </span>
                <small>{t('{n} / 3 bateaux', { n: hud.boats })}</small>
              </div>
              <label className="of-ratio">
                <span>{t('Attaque {n} %', { n: ratio })}</span>
                <input type="range" min={1} max={100} value={ratio} onChange={(e) => changeRatio(Number(e.target.value))} />
              </label>
              {!online && (
                <button className="of-speed" onClick={() => setSpeed((speed % 3) + 1)} aria-label={t('Vitesse')}>
                  ×{speed}
                </button>
              )}
            </div>
          </>
        )}
      </main>
      {radial && menu && <RadialMenu x={menu.x} y={menu.y} items={radial.items} center={radial.center} onClose={() => setMenu(null)} />}
    </div>
  )
}
