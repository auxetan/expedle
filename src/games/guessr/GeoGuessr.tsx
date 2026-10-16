import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { flagEmoji } from '../../geo/countries'
import { getWorld } from '../../geo/world'
import { load, save } from '../../lib/util'
import AppBar from '../../ui/AppBar'
import GuessGame, { type GuessSource, type Spot } from './GuessGame'
import { MODES } from './guess'
import { checkToken, findMapillary, mapillaryNode, saveToken, storedToken, TokenError, tokenFromEnv } from './mapillary'
import { findPanoramax, panoramaxNode } from './panoramax'
import type { SphereSpot } from './sphere'
import { checkKey, findPano, KeyError, keyFromEnv, loadStreetView, mapsRequested, onAuthFailure, saveKey, storedKey, type Pano } from './streetview'

// la visionneuse 360° (three.js) ne se charge qu'en jouant avec Panoramax ou Mapillary
const SphereView = lazy(() => import('./SphereView'))

const world = getWorld()
type Panorama = typeof google.maps.StreetViewPanorama
type Imagery = 'panoramax' | 'mapillary' | 'google'

const IMAGERY: { id: Imagery; label: string; detail: string }[] = [
  { id: 'panoramax', label: 'Panoramax', detail: 'France · sans clé' },
  { id: 'mapillary', label: 'Mapillary', detail: 'Monde · jeton gratuit' },
  { id: 'google', label: 'Street View', detail: 'Monde · clé Google' },
]

const QUESTION = 'Où es-tu ?'
const INTRO =
  'Tu es lâché quelque part dans une rue, en 360°. Avance, tourne la tête, cherche les panneaux, les plaques et le sens de circulation, puis place ton repère sur la carte : jusqu’à 5 000 points par manche.'

const offline = (e: unknown) => e instanceof Error && /Failed to fetch|NetworkError|Load failed/.test(e.message)

function monthYear(date: string): string {
  const [y, m] = date.split('-').map(Number)
  return m ? new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : String(y)
}

const FlagThumb = ({ spot }: { spot: Spot }) => <span className="gg-thumb">{spot.country ? flagEmoji(spot.country) : '🌊'}</span>

function link(href: string, text: string) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {text}
    </a>
  )
}

function ImageryPicker({ value, onChange }: { value: Imagery; onChange: (i: Imagery) => void }) {
  return (
    <div className="gg-imagery" role="radiogroup" aria-label="Imagerie">
      {IMAGERY.map((i) => (
        <button key={i.id} role="radio" aria-checked={i.id === value} className={i.id === value ? 'on' : ''} onClick={() => onChange(i.id)}>
          <b>{i.label}</b>
          <span>{i.detail}</span>
        </button>
      ))}
    </div>
  )
}

// Écran d'avant-partie : même titre et même choix d'imagerie que le menu du jeu, pour que rien ne saute.
function Shell({ picker, children }: { picker: ReactNode; children: ReactNode }) {
  return (
    <div className="wg">
      <AppBar title="GeoGuessr" />
      <main className="wg-menu">
        <h1>{QUESTION}</h1>
        <p className="muted">{INTRO}</p>
        {picker}
        <div className="gg-setup">{children}</div>
      </main>
    </div>
  )
}

function Waiting({ picker, text }: { picker: ReactNode; text: string }) {
  return (
    <Shell picker={picker}>
      <div className="gg-waiting">
        <div className="wg-spinner" />
        <p className="muted">{text}</p>
      </div>
    </Shell>
  )
}

function SetupForm({ placeholder, check, refusal, onSaved }: { placeholder: string; check: (v: string) => Promise<void>; refusal: (e: unknown) => string; onSaved: (v: string) => void }) {
  const [value, setValue] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const v = value.trim()
    setChecking(true)
    setError('')
    try {
      await check(v)
      onSaved(v)
    } catch (err) {
      setError(refusal(err))
    } finally {
      setChecking(false)
    }
  }

  return (
    <>
      <form className="gg-key" onSubmit={submit}>
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} autoComplete="off" spellCheck={false} />
        <button className="ui-btn" disabled={!value.trim() || checking}>
          {checking ? 'Vérification…' : 'Enregistrer'}
        </button>
      </form>
      {error && <p className="gg-problem">{error}</p>}
    </>
  )
}

function ResetSetting({ label, fromEnv, value, onReset }: { label: string; fromEnv: boolean; value: string; onReset: () => void }) {
  return (
    <div className="ui-field">
      <span>{label}</span>
      <p className="ui-note">{fromEnv ? 'Fourni par .env.local.' : `Enregistré dans ce navigateur (…${value.slice(-4)}).`}</p>
      {!fromEnv && (
        <button className="ui-btn-line" onClick={onReset}>
          Changer
        </button>
      )}
    </div>
  )
}

function sphereDetails(name: string) {
  return function Details({ spot }: { spot: SphereSpot }) {
    return (
      <p className="wg-credit muted">
        {name}
        {spot.credit && ` · ${spot.credit}`}
        {spot.date && ` · ${monthYear(spot.date)}`}
        {spot.license && ` · ${spot.license}`} · {link(spot.page, `Voir sur ${name}`)}
      </p>
    )
  }
}

/* Panoramax : vues 360° libres, France métropolitaine, sans clé */

const panoramax: GuessSource<SphereSpot> = {
  game: 'geoguessr',
  store: 'geoguessr-panoramax',
  modes: MODES.filter((m) => m.id === 'france'),
  title: 'GeoGuessr',
  question: QUESTION,
  intro: INTRO,
  note: 'Vues 360° libres de Panoramax (IGN, OpenStreetMap France et leurs contributeurs) ; fond de carte OpenStreetMap.',
  find: (_mode, seen, signal) => findPanoramax(world, Math.random, seen, signal),
  View: ({ spot }) => (
    <Suspense fallback={null}>
      <SphereView spot={spot} load={panoramaxNode} />
    </Suspense>
  ),
  Details: sphereDetails('Panoramax'),
  Thumb: FlagThumb,
  explain: (e) => (offline(e) || (e instanceof Error && e.message.startsWith('Panoramax')) ? 'Impossible de joindre Panoramax. Vérifie ta connexion.' : 'Aucune vue 360° trouvée cette fois.'),
}

/* Mapillary : photos de rue partagées dans le monde entier, avec un jeton client gratuit */

function mapillary(token: string): GuessSource<SphereSpot> {
  return {
    game: 'geoguessr',
    store: 'geoguessr-mapillary',
    title: 'GeoGuessr',
    question: QUESTION,
    intro: INTRO,
    note: 'Vues 360° partagées par les contributeurs de Mapillary ; fond de carte OpenStreetMap.',
    find: (mode, seen, signal) => findMapillary(world, token, mode, Math.random, seen, signal),
    View: ({ spot }) => (
      <Suspense fallback={null}>
        <SphereView spot={spot} load={mapillaryNode} />
      </Suspense>
    ),
    Details: sphereDetails('Mapillary'),
    Thumb: FlagThumb,
    explain: (e) =>
      e instanceof TokenError
        ? `Mapillary refuse le jeton : ${e.message} Change-le dans les réglages.`
        : offline(e)
          ? 'Impossible de joindre Mapillary. Vérifie ta connexion.'
          : e instanceof Error
            ? e.message
            : 'Aucune vue 360° trouvée cette fois.',
  }
}

function MapillaryGame({ picker }: { picker: ReactNode }) {
  const [token, setToken] = useState(storedToken)
  const [ready, setReady] = useState(false)
  const [problem, setProblem] = useState('')

  useEffect(() => {
    if (!token || ready) return
    let alive = true
    checkToken(token)
      .then(() => alive && setReady(true))
      .catch((e: Error) => alive && setProblem(e instanceof TokenError ? `Mapillary refuse le jeton enregistré : ${e.message}` : 'Impossible de joindre Mapillary. Vérifie ta connexion.'))
    return () => {
      alive = false
    }
  }, [token, ready])

  const source = useMemo(() => mapillary(token), [token])

  if (!token || problem)
    return (
      <Shell picker={picker}>
        <h2>Mapillary a besoin d’un jeton gratuit</h2>
        <p className="muted">
          Mapillary rassemble plus de deux milliards de photos de rue partagées par ses contributeurs, dont beaucoup en 360°, dans presque tous les pays. Son API est
          gratuite : il suffit d’un jeton client, sans carte bancaire.
        </p>
        {problem && <p className="gg-problem">{problem}</p>}
        <ol className="gg-steps">
          <li>Crée un compte sur {link('https://www.mapillary.com/signup', 'mapillary.com')}.</li>
          <li>
            Dans l’espace {link('https://www.mapillary.com/dashboard/developers', 'développeurs')}, enregistre une application (« Register application ») : un nom,
            le site <code>http://localhost:5190</code> et l’accès en lecture (« Read »).
          </li>
          <li>
            Copie son <b>Client Token</b> (il commence par <code>MLY|</code>) et colle-le ci-dessous : il reste dans ce navigateur. Tu peux aussi l’écrire dans{' '}
            <code>.env.local</code> : <code>VITE_MAPILLARY_TOKEN=…</code>
          </li>
        </ol>
        <SetupForm
          placeholder="Ton jeton client Mapillary (MLY|…)"
          check={checkToken}
          refusal={(e) => (e instanceof TokenError ? `Mapillary refuse ce jeton : ${e.message}` : 'Impossible de joindre Mapillary. Vérifie ta connexion.')}
          onSaved={(t) => {
            saveToken(t)
            setToken(t)
            setReady(true)
            setProblem('')
          }}
        />
      </Shell>
    )
  if (!ready) return <Waiting picker={picker} text="Connexion à Mapillary…" />
  return (
    <GuessGame
      source={source}
      menuTop={picker}
      settings={
        <ResetSetting
          label="Jeton Mapillary"
          fromEnv={tokenFromEnv}
          value={token}
          onReset={() => {
            saveToken('')
            setToken('')
            setReady(false)
          }}
        />
      }
    />
  )
}

/* Google Street View : l'imagerie de référence, avec la clé Google de l'utilisateur */

// Un seul panorama pour toute la partie : chaque manche le déplace avec setPano au lieu d'en recréer un.
function StreetViewPane({ spot, Panorama }: { spot: Pano; Panorama: Panorama }) {
  const el = useRef<HTMLDivElement>(null)
  const pano = useRef<google.maps.StreetViewPanorama | null>(null)

  useEffect(() => {
    const pov = { heading: spot.heading, pitch: 0 }
    // la référence survit au double montage du mode strict : pas de second panorama en développement
    if (pano.current) {
      pano.current.setPano(spot.id)
      pano.current.setPov(pov)
      pano.current.setZoom(0)
      return
    }
    pano.current = new Panorama(el.current!, {
      pano: spot.id,
      pov,
      zoom: 0,
      // l'adresse et les noms de rue donneraient la réponse
      addressControl: false,
      showRoadLabels: false,
      fullscreenControl: false,
      motionTracking: false,
      motionTrackingControl: false,
      enableCloseButton: false,
      clickToGo: true,
      linksControl: true,
      panControlOptions: { position: google.maps.ControlPosition.LEFT_TOP },
      zoomControlOptions: { position: google.maps.ControlPosition.LEFT_TOP },
    })
  }, [spot, Panorama])

  return (
    <div className="gg-pano-wrap">
      <div className="gg-pano" ref={el} />
      <button
        className="gg-return google"
        onClick={() => {
          pano.current?.setPano(spot.id)
          pano.current?.setPov({ heading: spot.heading, pitch: 0 })
        }}
      >
        ⟲ Retour au départ
      </button>
    </div>
  )
}

function streetView(key: string, Panorama: Panorama): GuessSource<Pano> {
  return {
    game: 'geoguessr',
    title: 'GeoGuessr',
    question: QUESTION,
    intro: INTRO,
    note: 'Imagerie Google Street View chargée avec ta clé ; fond de carte OpenStreetMap.',
    find: (mode, seen, signal) => findPano(world, key, mode, Math.random, seen, signal),
    View: ({ spot }) => <StreetViewPane spot={spot} Panorama={Panorama} />,
    Details: ({ spot }) => (
      <p className="wg-credit muted">
        Google Street View{spot.date ? ` · ${monthYear(spot.date)}` : ''} ·{' '}
        {link(`https://www.google.com/maps/@?api=1&map_action=pano&pano=${spot.id}`, 'Ouvrir dans Google Maps')}
      </p>
    ),
    Thumb: FlagThumb,
    explain: (e) =>
      e instanceof KeyError
        ? `Google refuse la clé : ${e.message}`
        : offline(e)
          ? 'Impossible de joindre Google. Vérifie ta connexion.'
          : e instanceof Error
            ? e.message
            : 'Aucun panorama trouvé cette fois.',
  }
}

function GoogleGame({ picker }: { picker: ReactNode }) {
  const [key, setKey] = useState(storedKey)
  const [Panorama, setPanorama] = useState<Panorama | null>(null)
  const [problem, setProblem] = useState('')

  useEffect(() => {
    if (!key) return
    let alive = true
    // la clé enregistrée est revérifiée (gratuitement) avant de charger Google : une clé révoquée ramène ici
    checkKey(key)
      .then(() => loadStreetView(key))
      .then((C) => alive && setPanorama(() => C))
      .catch((e: Error) => alive && setProblem(e instanceof KeyError ? `Google refuse la clé enregistrée : ${e.message}` : e.message))
    const off = onAuthFailure(() =>
      setProblem('Google refuse la clé pour l’API Maps JavaScript : vérifie qu’elle est activée et que http://localhost:5190 fait partie des sites autorisés.'),
    )
    return () => {
      alive = false
      off()
    }
  }, [key])

  const source = useMemo(() => (Panorama ? streetView(key, Panorama) : null), [key, Panorama])

  if (!key || problem)
    return (
      <Shell picker={picker}>
        <h2>Street View a besoin de ta clé Google</h2>
        <p className="muted">
          Les vues Street View ne sont accessibles qu’avec une clé Google Maps Platform à ton nom. Google offre 5 000 panoramas par mois, soit environ 1 000 parties ; il
          demande un compte de facturation, mais rien n’est facturé sous ce seuil.
        </p>
        {problem && <p className="gg-problem">{problem}</p>}
        <ol className="gg-steps">
          <li>Crée un projet dans la {link('https://console.cloud.google.com/projectcreate', 'console Google Cloud')}.</li>
          <li>
            Active {link('https://console.cloud.google.com/apis/library/maps-backend.googleapis.com', 'Maps JavaScript API')} (le panorama) et{' '}
            {link('https://console.cloud.google.com/apis/library/street-view-image-backend.googleapis.com', 'Street View Static API')} (la recherche des lieux, gratuite).
          </li>
          <li>
            Dans {link('https://console.cloud.google.com/apis/credentials', 'Identifiants')}, crée une clé API et restreins-la aux sites <code>http://localhost:5190/*</code>{' '}
            (ajoute ton domaine plus tard) et à ces deux API.
          </li>
          <li>
            Pour ne jamais payer, plafonne l’usage quotidien dans les {link('https://console.cloud.google.com/apis/api/maps-backend.googleapis.com/quotas', 'quotas')} et
            pose une {link('https://console.cloud.google.com/billing/budgets', 'alerte de budget')}.
          </li>
          <li>
            Colle la clé ci-dessous : elle reste dans ce navigateur. Tu peux aussi l’écrire dans <code>.env.local</code> à la racine du projet :{' '}
            <code>VITE_GOOGLE_MAPS_KEY=…</code>
          </li>
        </ol>
        <SetupForm
          placeholder="Ta clé API Google (AIza…)"
          check={checkKey}
          refusal={(e) => (e instanceof KeyError ? `Google refuse cette clé : ${e.message}` : 'Impossible de joindre Google. Vérifie ta connexion.')}
          onSaved={(k) => {
            saveKey(k)
            // l'API Google ne se recharge pas avec une autre clé dans la même page
            if (mapsRequested()) return location.reload()
            setKey(k)
            setProblem('')
          }}
        />
      </Shell>
    )
  if (!source) return <Waiting picker={picker} text="Chargement de Street View…" />
  return (
    <GuessGame
      source={source}
      menuTop={picker}
      settings={
        <ResetSetting
          label="Clé Google Maps"
          fromEnv={keyFromEnv}
          value={key}
          onReset={() => {
            saveKey('')
            location.reload()
          }}
        />
      }
    />
  )
}

export default function GeoGuessr() {
  const [imagery, setImagery] = useState<Imagery>(() => load<Imagery>('geoguessr:imagery', 'panoramax'))
  const picker = (
    <ImageryPicker
      value={imagery}
      onChange={(i) => {
        save('geoguessr:imagery', i)
        setImagery(i)
      }}
    />
  )
  if (imagery === 'mapillary') return <MapillaryGame picker={picker} />
  if (imagery === 'google') return <GoogleGame picker={picker} />
  return <GuessGame source={panoramax} menuTop={picker} />
}
