import { useEffect, useMemo, useRef, useState } from 'react'
import { flagEmoji } from '../../geo/countries'
import { getWorld } from '../../geo/world'
import AppBar from '../../ui/AppBar'
import GuessGame, { type GuessSource } from './GuessGame'
import { checkKey, findPano, KeyError, keyFromEnv, loadStreetView, mapsRequested, onAuthFailure, saveKey, storedKey, type Pano } from './streetview'

const world = getWorld()
type Panorama = typeof google.maps.StreetViewPanorama

function monthYear(date: string): string {
  const [y, m] = date.split('-').map(Number)
  return m ? new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : String(y)
}

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
        className="gg-return"
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
    question: 'Où es-tu ?',
    intro:
      'Tu es lâché quelque part dans Street View. Avance, tourne la tête, cherche les panneaux, les plaques et le sens de circulation, puis place ton repère sur la carte : jusqu’à 5 000 points par manche.',
    note: 'Imagerie Google Street View chargée avec ta clé ; fond de carte OpenStreetMap.',
    find: (mode, seen, signal) => findPano(world, key, mode, Math.random, seen, signal),
    View: ({ spot }) => <StreetViewPane spot={spot} Panorama={Panorama} />,
    Details: ({ spot }) => (
      <p className="wg-credit muted">
        Google Street View{spot.date ? ` · ${monthYear(spot.date)}` : ''} ·{' '}
        <a href={`https://www.google.com/maps/@?api=1&map_action=pano&pano=${spot.id}`} target="_blank" rel="noopener noreferrer">
          Ouvrir dans Google Maps
        </a>
      </p>
    ),
    Thumb: ({ spot }) => <span className="gg-thumb">{spot.country ? flagEmoji(spot.country) : '🌊'}</span>,
    explain: (e) =>
      e instanceof KeyError
        ? `Google refuse la clé : ${e.message}`
        : e instanceof Error && /Failed to fetch|NetworkError/.test(e.message)
          ? 'Impossible de joindre Google. Vérifie ta connexion.'
          : e instanceof Error
            ? e.message
            : 'Aucun panorama trouvé cette fois.',
  }
}

function KeySetup({ problem, onSaved }: { problem: string; onSaved: (key: string) => void }) {
  const [value, setValue] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const key = value.trim()
    setChecking(true)
    setError('')
    try {
      await checkKey(key)
      onSaved(key)
    } catch (err) {
      setError(err instanceof KeyError ? `Google refuse cette clé : ${err.message}` : 'Impossible de joindre Google. Vérifie ta connexion.')
    } finally {
      setChecking(false)
    }
  }

  const link = (href: string, text: string) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {text}
    </a>
  )

  return (
    <div className="wg">
      <AppBar title="GeoGuessr" />
      <main className="wg-menu gg-setup">
        <h1>GeoGuessr a besoin de ta clé Google</h1>
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
        <form className="gg-key" onSubmit={submit}>
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Ta clé API Google (AIza…)" autoComplete="off" spellCheck={false} />
          <button className="ui-btn" disabled={!value.trim() || checking}>
            {checking ? 'Vérification…' : 'Enregistrer la clé'}
          </button>
        </form>
        {error && <p className="gg-problem">{error}</p>}
        <p className="wg-note muted">
          Pas de clé ? <a href="#/worldguessr">WorldGuessr</a> se joue sans, avec des photos.
        </p>
      </main>
    </div>
  )
}

function KeySettings() {
  return (
    <div className="ui-field">
      <span>Clé Google Maps</span>
      <p className="ui-note">{keyFromEnv ? 'Fournie par .env.local.' : `Enregistrée dans ce navigateur (…${storedKey().slice(-4)}).`}</p>
      {!keyFromEnv && (
        <button
          className="ui-btn-line"
          onClick={() => {
            saveKey('')
            location.reload()
          }}
        >
          Changer de clé
        </button>
      )}
    </div>
  )
}

export default function GeoGuessr() {
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
      <KeySetup
        problem={problem}
        onSaved={(k) => {
          saveKey(k)
          // l'API Google ne se recharge pas avec une autre clé dans la même page
          if (mapsRequested()) return location.reload()
          setKey(k)
          setProblem('')
        }}
      />
    )
  if (!source)
    return (
      <div className="wg">
        <AppBar title="GeoGuessr" />
        <main className="wg-wait">
          <div className="wg-spinner" />
          <p className="muted">Chargement de Street View…</p>
        </main>
      </div>
    )
  return <GuessGame source={source} settings={<KeySettings />} />
}
