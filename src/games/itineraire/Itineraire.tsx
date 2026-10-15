import { useEffect, useMemo, useState } from 'react'
import { loadAtlas, worldAtlas, type Atlas, type AtlasId } from '../../geo/atlas'
import { go } from '../../lib/router'
import { seededRng, todayKey, weekKey } from '../../lib/util'
import AppBar, { SubLink } from '../../ui/AppBar'
import { useTheme } from '../../ui/theme'
import { loadSettings, saveSettings, type ItinSettings } from './history'
import ItinGame, { type GameSlot } from './ItinGame'
import { Archive, dailyPuzzle, Maps, playUrl, Practice, Stats } from './ItinPages'
import { makePuzzle, puzzleFor, type Extra, type Puzzle } from './puzzle'
import './itineraire.css'

type View = 'jour' | 'hebdo' | 'usa' | 'libre' | 'archive' | 'stats' | 'cartes'

function frDate(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

function useAtlas(id: AtlasId): Atlas | null {
  const [atlas, setAtlas] = useState<Atlas | null>(id === 'monde' ? worldAtlas() : null)
  useEffect(() => {
    let alive = true
    loadAtlas(id).then((a) => alive && setAtlas(a))
    return () => {
      alive = false
    }
  }, [id])
  return atlas && atlas.id === id ? atlas : null
}

export default function Itineraire({ mode, params }: { mode?: string; params: URLSearchParams }) {
  const view: View = (['hebdo', 'usa', 'libre', 'archive', 'stats', 'cartes'] as View[]).includes(mode as View) ? (mode as View) : 'jour'
  const [settings, setSettings] = useState<ItinSettings>(loadSettings)
  const [help, setHelp] = useState(false)
  const theme = useTheme()
  const playing = view === 'jour' || view === 'hebdo' || view === 'usa' || (view === 'libre' && params.has('de'))
  const atlasId: AtlasId = view === 'usa' || params.get('carte') === 'usa' ? 'usa' : 'monde'
  const atlas = useAtlas(atlasId)

  function update(patch: Partial<ItinSettings>) {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveSettings(next)
  }

  const game = useMemo(() => {
    if (!atlas || !playing) return null
    const date = params.get('date') ?? todayKey()
    const archive = date !== todayKey()
    if (view === 'jour' || view === 'usa') {
      const kind = view === 'usa' ? 'usa' : 'jour'
      const slot: GameSlot = {
        kind,
        storageKey: `itin:${kind}:${date}`,
        dailyId: view === 'usa' ? 'itineraire-usa' : 'itineraire',
        dayKey: date,
        label: `${view === 'usa' ? 'USA ' : ''}${date}`,
        intro: archive ? `Le ${frDate(date)}` : "Aujourd'hui",
      }
      return { puzzle: dailyPuzzle(atlas, date), slot, hard: settings.hard }
    }
    if (view === 'hebdo') {
      const week = weekKey()
      const slot: GameSlot = {
        kind: 'hebdo',
        storageKey: `itin:hebdo:${week}`,
        dailyId: 'itineraire-hebdo',
        dayKey: week,
        label: `hebdo ${week}`,
        intro: 'Cette semaine',
      }
      return { puzzle: makePuzzle(atlas, seededRng('itin-hebdo-' + week), 7, 11)!, slot, hard: settings.hard }
    }
    const rules = {
      region: params.get('region'),
      avoid: params.get('sans'),
      extra: (params.get('bonus') as Extra | null) ?? 'defaut',
    }
    const puzzle: Puzzle | null = puzzleFor(atlas, params.get('de')!, params.get('a')!, rules)
    if (!puzzle) return null
    const slot: GameSlot = { kind: 'libre', storageKey: null, dailyId: null, dayKey: todayKey(), label: 'entraînement', intro: 'En route' }
    return { puzzle, slot, hard: settings.hard || params.get('mode') === 'difficile' }
  }, [atlas, playing, view, params, settings.hard])

  function another() {
    if (!atlas) return
    const rules = game?.slot.kind === 'libre' ? { region: game.puzzle.region, avoid: game.puzzle.avoid, extra: game.puzzle.extra } : {}
    const p = makePuzzle(atlas, Math.random, 3, 8, rules)
    if (p) go(`${playUrl({ ...p, hard: params.get('mode') === 'difficile' })}&n=${Date.now()}`)
  }

  const subnav: [string, string, View][] = [
    ['#/itineraire', 'Quotidien', 'jour'],
    ['#/itineraire/hebdo', 'Défi hebdo', 'hebdo'],
    ['#/itineraire/usa', 'États-Unis', 'usa'],
    ['#/itineraire/libre', 'Entraînement & défi', 'libre'],
    ['#/itineraire/cartes', 'Cartes', 'cartes'],
    ['#/itineraire/archive', 'Archive', 'archive'],
    ['#/itineraire/stats', 'Statistiques', 'stats'],
  ]

  const travleSettings = (
    <>
      <div className="ui-field">
        <span>Travle · modificateurs</span>
        <label className="ui-check">
          <input type="checkbox" checked={settings.hard} onChange={(e) => update({ hard: e.target.checked })} />
          Mode difficile : masquer les noms et les indices
        </label>
        <label className="ui-check">
          <input type="checkbox" checked={settings.hideMap} onChange={(e) => update({ hideMap: e.target.checked })} />
          Masquer la carte
        </label>
      </div>
      <div className="ui-field">
        <span>Travle · projection</span>
        <label className="ui-check">
          <input type="radio" name="proj" checked={settings.projection === 'azimutale'} onChange={() => update({ projection: 'azimutale' })} />
          Azimutale équidistante : déforme le moins les pays visibles
        </label>
        <label className="ui-check">
          <input type="radio" name="proj" checked={settings.projection === 'mercator'} onChange={() => update({ projection: 'mercator' })} />
          Mercator : la carte imprimée classique
        </label>
      </div>
    </>
  )

  return (
    <div className={`itin itin-${theme}`}>
      <AppBar title={atlasId === 'usa' ? 'Travle USA' : 'Travle'} settings={travleSettings}>
        {subnav.map(([href, label, v]) => (
          <SubLink key={href} href={href} active={view === v}>
            {label}
          </SubLink>
        ))}
        <button onClick={() => setHelp(true)}>Comment jouer</button>
      </AppBar>

      <main className="itin-main">
        {view === 'archive' && <Archive />}
        {view === 'stats' && <Stats />}
        {view === 'cartes' && <Maps />}
        {view === 'libre' && !params.has('de') && <Practice />}
        {playing && !atlas && <p className="itin-muted">Chargement de la carte…</p>}
        {playing && atlas && !game && (
          <p className="itin-msg">
            Ce trajet n’existe pas. <a href="#/itineraire/libre">Configurer un entraînement</a>
          </p>
        )}
        {game && atlas && (
          <ItinGame
            key={`${view}-${params.toString()}`}
            atlas={atlas}
            puzzle={game.puzzle}
            slot={game.slot}
            settings={settings}
            hard={game.hard}
            shareUrl={`${location.origin}${location.pathname}#${playUrl({ ...game.puzzle, hard: game.hard })}`}
            onAnother={another}
            onHelp={() => setHelp(true)}
          />
        )}
      </main>

      {help && (
        <div className="itin-modal-bg" onClick={() => setHelp(false)}>
          <article className="itin-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setHelp(false)} aria-label="Fermer">
              ✕
            </button>
              <>
                <h2>travle</h2>
                <p>
                  Nommez les pays à traverser pour aller du <span className="c-start">pays de départ</span> au{' '}
                  <span className="c-end">pays d’arrivée</span>. Essayez d’y arriver en un minimum d’essais !
                </p>
                <h4>Score</h4>
                <ul className="legend">
                  <li>✅ Essai optimal ! Vous vous rapprochez d’un pas.</li>
                  <li>🟩 Bon essai : il réduit le chemin restant, mais n’est pas encore relié au départ.</li>
                  <li>🟧 Plutôt bien : ce pays est proche, mais ne vous rapproche pas.</li>
                  <li>🟥 Pas terrible : ce pays est un gros détour.</li>
                </ul>
                <p>Les essais qui ne sont pas reliés au pays de départ sont affichés en gris.</p>
                <h4>Frontières & connexions</h4>
                <p>
                  On voyage à pied : ponts et tunnels comptent (tunnel sous la Manche, pont de l’Øresund…), pas les exclaves ni les
                  territoires lointains. L’Irlande se relie au Royaume-Uni, l’Indonésie au continent via la Malaisie. La Russie ne
                  touche pas la Pologne via Kaliningrad. Les coins comptent (Four Corners aux États-Unis).
                </p>
                <h4>Carte</h4>
                <p>Faites glisser pour déplacer la carte, molette ou pincement pour zoomer, ⟳ pour recentrer. Survolez un pays pour voir son nom.</p>
                <h4>Essais</h4>
                <p>Longueur du plus court chemin + 4 à 8 essais bonus selon la difficulté.</p>
              </>
          </article>
        </div>
      )}
    </div>
  )
}
