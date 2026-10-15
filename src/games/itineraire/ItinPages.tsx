import { useEffect, useMemo, useState } from 'react'
import { loadAtlas, worldAtlas, type Atlas, type AtlasId } from '../../geo/atlas'
import { go } from '../../lib/router'
import { dailyResult } from '../../lib/stats'
import { copyText, load, seededRng, todayKey } from '../../lib/util'
import { computeStats } from './history'
import { makePuzzle, type Extra } from './puzzle'

export function playUrl(p: {
  atlas: AtlasId
  start: string
  end: string
  region?: string | null
  avoid?: string | null
  extra?: Extra
  hard?: boolean
}): string {
  const q = new URLSearchParams({ carte: p.atlas, de: p.start, a: p.end })
  if (p.region) q.set('region', p.region)
  if (p.avoid) q.set('sans', p.avoid)
  if (p.extra && p.extra !== 'defaut') q.set('bonus', p.extra)
  if (p.hard) q.set('mode', 'difficile')
  return `/itineraire/libre?${q}`
}

export function dailyPuzzle(atlas: Atlas, date: string) {
  return makePuzzle(atlas, seededRng((atlas.id === 'usa' ? 'itin-usa-' : 'itin-') + date), 3, 7)!
}

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select className="itin-select" value={value} onChange={(e) => onChange(e.target.value)}>
      {children}
    </select>
  )
}

export function Practice() {
  const [atlasId, setAtlasId] = useState<AtlasId>('monde')
  const [atlas, setAtlas] = useState<Atlas>(worldAtlas())
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [minLen, setMinLen] = useState(3)
  const [maxLen, setMaxLen] = useState(8)
  const [hard, setHard] = useState(false)
  const [extra, setExtra] = useState<Extra>('defaut')
  const [region, setRegion] = useState('')
  const [avoid, setAvoid] = useState('')
  const [advanced, setAdvanced] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    loadAtlas(atlasId).then(setAtlas)
    setStart('')
    setEnd('')
    setRegion('')
    setAvoid('')
  }, [atlasId])

  const sorted = useMemo(
    () => atlas.codes.filter((c) => atlas.neighbors.has(c)).sort((a, b) => atlas.name(a).localeCompare(atlas.name(b), 'fr')),
    [atlas],
  )

  function resolve() {
    const p = makePuzzle(atlas, Math.random, Math.min(minLen, maxLen), Math.max(minLen, maxLen), {
      start: start || null,
      end: end || null,
      region: region || null,
      avoid: avoid || null,
      extra,
    })
    if (!p) {
      setError('Aucun trajet ne correspond à ces réglages.')
      return null
    }
    setError('')
    return playUrl({ ...p, hard })
  }

  async function challenge() {
    const url = resolve()
    if (!url) return
    const ok = await copyText(`${location.origin}${location.pathname}#${url}`)
    setToast(ok ? 'Lien du défi copié !' : 'Copie impossible')
    setTimeout(() => go(url), 900)
  }

  return (
    <div className="itin-config">
      <h2>⚙ Configuration</h2>
      <div className="cfg-grid">
        <div className="cfg-card">
          <span className="cfg-step">1. Choisir la carte</span>
          <div className="cfg-maps">
            {(['monde', 'usa'] as AtlasId[]).map((id) => (
              <button key={id} className={atlasId === id ? 'on' : ''} onClick={() => setAtlasId(id)}>
                {id === 'monde' ? '🌍 Monde' : '🇺🇸 États-Unis'}
              </button>
            ))}
          </div>
        </div>
        <div className="cfg-card">
          <span className="cfg-step">2. Choisir le trajet</span>
          <label>
            Départ
            <Select value={start} onChange={setStart}>
              <option value="">— Aléatoire —</option>
              {sorted.map((c) => (
                <option key={c} value={c}>
                  {atlas.name(c)}
                </option>
              ))}
            </Select>
          </label>
          <span className="cfg-arrow">↓</span>
          <label>
            Arrivée
            <Select value={end} onChange={setEnd}>
              <option value="">— Aléatoire —</option>
              {sorted.map((c) => (
                <option key={c} value={c}>
                  {atlas.name(c)}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </div>

      <button className="cfg-adv-toggle" onClick={() => setAdvanced(!advanced)}>
        🔧 Réglages avancés <span>{advanced ? '▴' : '▾'}</span>
      </button>
      {advanced && (
        <div className="cfg-adv">
          <label>
            Longueur du trajet : de <b>{minLen}</b> à <b>{maxLen}</b> essais
            <span className="cfg-range">
              <input type="range" min={1} max={12} value={minLen} onChange={(e) => setMinLen(+e.target.value)} />
              <input type="range" min={1} max={14} value={maxLen} onChange={(e) => setMaxLen(+e.target.value)} />
            </span>
          </label>
          <label>
            Mode de jeu
            <Select value={hard ? 'difficile' : 'normal'} onChange={(v) => setHard(v === 'difficile')}>
              <option value="normal">Normal</option>
              <option value="difficile">Difficile (ni indices, ni noms)</option>
            </Select>
          </label>
          <label>
            Essais bonus
            <Select value={extra} onChange={(v) => setExtra(v as Extra)}>
              <option value="defaut">Par défaut</option>
              <option value="aucun">Aucun : trajet le plus court uniquement</option>
              <option value="illimite">Essais illimités</option>
            </Select>
          </label>
          <label>
            {atlas.id === 'usa' ? 'Région' : 'Continent'}
            <Select value={region} onChange={setRegion}>
              <option value="">— Tous —</option>
              {atlas.regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </label>
          <label>
            Sans passer par
            <Select value={avoid} onChange={setAvoid}>
              <option value="">— Aucun —</option>
              {sorted.map((c) => (
                <option key={c} value={c}>
                  {atlas.name(c)}
                </option>
              ))}
            </Select>
          </label>
        </div>
      )}
      {error && <p className="itin-msg">{error}</p>}
      <button className="cfg-challenge" onClick={challenge}>
        <b>🏅 Créer un défi</b>
        <span>Crée un défi à partager et affronte tes amis</span>
      </button>
      <button
        className="cfg-solo"
        onClick={() => {
          const url = resolve()
          if (url) go(url)
        }}
      >
        ▶ Jouer en solo
      </button>
      <a className="cfg-back" href="#/itineraire">
        ← Retour à Travle
      </a>
      {toast && <div className="toast-copy">{toast}</div>}
    </div>
  )
}

export function Archive() {
  const [atlasId, setAtlasId] = useState<AtlasId>('monde')
  const [atlas, setAtlas] = useState<Atlas>(worldAtlas())
  useEffect(() => {
    loadAtlas(atlasId).then(setAtlas)
  }, [atlasId])
  const days = useMemo(() => {
    const out: string[] = []
    const d = new Date()
    for (let i = 0; i < 45; i++) {
      out.push(todayKey(d))
      d.setDate(d.getDate() - 1)
    }
    return out
  }, [])
  const rows = useMemo(
    () =>
      days.map((date) => {
        const p = dailyPuzzle(atlas, date)
        const res = dailyResult<{ won: boolean; guesses: number }>(atlas.id === 'usa' ? 'itineraire-usa' : 'itineraire', date)
        const started = load<{ guesses: string[] }>(`itin:${atlas.id === 'usa' ? 'usa' : 'jour'}:${date}`, { guesses: [] }).guesses.length
        return { date, p, res, started }
      }),
    [days, atlas],
  )
  const base = atlas.id === 'usa' ? '/itineraire/usa' : '/itineraire'
  return (
    <div className="itin-page">
      <h2>Archive</h2>
      <div className="cfg-maps">
        {(['monde', 'usa'] as AtlasId[]).map((id) => (
          <button key={id} className={atlasId === id ? 'on' : ''} onClick={() => setAtlasId(id)}>
            {id === 'monde' ? '🌍 Monde' : '🇺🇸 États-Unis'}
          </button>
        ))}
      </div>
      <ul className="arch-list">
        {rows.map(({ date, p, res, started }) => (
          <li key={date}>
            <a href={`#${base}?date=${date}`}>
              <span className="arch-date">
                {new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
              <span className="arch-route">
                <span className="c-start">{atlas.name(p.start)}</span> → <span className="c-end">{atlas.name(p.end)}</span>
              </span>
              <span className="arch-state">
                {res ? (res.won ? `✅ ${res.guesses} essais` : '❌ perdu') : started ? 'en cours' : `${p.shortest} min.`}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Stats() {
  const s = computeStats()
  const [toast, setToast] = useState('')
  const max = Math.max(1, ...s.distribution.map((d) => d.count))
  const text = `Mes statistiques Travle\n🎮 ${s.played} parties · 🏆 ${s.winRate}% · 🔥 ${s.streak} (max ${s.maxStreak})\nParfaites : ${s.perfectRate}% · Sans indice : ${s.noHintRate}%`
  return (
    <div className="itin-page">
      <h2>Statistiques</h2>
      <div className="st-tiles">
        <div>
          <span>🎮</span>
          <b>{s.played}</b>Parties
        </div>
        <div>
          <span>🏆</span>
          <b>{s.winRate}</b>% victoires
        </div>
        <div>
          <span>🔥</span>
          <b>{s.streak}</b>Série actuelle
        </div>
        <div>
          <span>🚀</span>
          <b>{s.maxStreak}</b>Meilleure série
        </div>
      </div>
      <h3 className="itin-h">Répartition des essais</h3>
      {s.played === 0 ? (
        <p className="itin-muted">Joue et gagne une partie pour voir ta répartition.</p>
      ) : (
        <div className="dist">
          {s.distribution.map((d) => (
            <div key={d.label} className="dist-row">
              <span>{d.label}</span>
              <div>
                <i style={{ width: `${(d.count / max) * 100}%` }}>{d.count || ''}</i>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="st-tiles small">
        <div>
          <b>{s.perfectRate}%</b>Taux parfait
        </div>
        <div>
          <b>{s.noHintRate}%</b>Sans indice
        </div>
        <div>
          <b>{s.hints}</b>Indices utilisés
        </div>
        <div>
          <b>{s.last10}%</b>10 dernières
        </div>
      </div>
      <h3 className="itin-h">Partager tes statistiques</h3>
      <p className="itin-muted">Copie un résumé et compare-toi à tes amis.</p>
      <button
        className="pink wide"
        onClick={async () => {
          setToast((await copyText(text)) ? 'Statistiques copiées !' : 'Copie impossible')
          setTimeout(() => setToast(''), 1600)
        }}
      >
        Copier mes statistiques
      </button>
      {toast && <div className="toast-copy">{toast}</div>}
    </div>
  )
}

export function Maps() {
  const cards = [
    { href: '#/itineraire', icon: '🌍', title: 'Quotidien', text: 'Le trajet du jour à travers le monde' },
    { href: '#/itineraire/hebdo', icon: '🗓', title: 'Défi hebdomadaire', text: 'Un long trajet, chaque lundi' },
    { href: '#/itineraire/usa', icon: '🇺🇸', title: 'États-Unis', text: 'D’un État à l’autre, chaque jour' },
    { href: '#/itineraire/libre', icon: '🎲', title: 'Entraînement', text: 'Trajets aléatoires ou sur mesure' },
    { href: '#/itineraire/archive', icon: '📚', title: 'Archive', text: 'Rejoue les jours précédents' },
  ]
  return (
    <div className="itin-page">
      <h2>Modes de jeu</h2>
      <div className="maps-grid">
        {cards.map((c) => (
          <a key={c.href} href={c.href} className="maps-card">
            <span>{c.icon}</span>
            <b>{c.title}</b>
            <small>{c.text}</small>
          </a>
        ))}
      </div>
    </div>
  )
}
