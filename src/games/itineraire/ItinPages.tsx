import { useEffect, useMemo, useState } from 'react'
import { loadAtlas, worldAtlas, type Atlas, type AtlasId } from '../../geo/atlas'
import { go } from '../../lib/router'
import { dailyResult } from '../../lib/stats'
import { copyText, load, seededRng, todayKey } from '../../lib/util'
import { computeStats } from './history'
import { makePuzzle, type Extra, type Puzzle } from './puzzle'
import { locale, plural, t, tx } from '../../lib/i18n'

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

// Graine d'un défi Travle : le trajet lui-même, la région désignée par son rang dans la liste de l'atlas.
export function travleSeed(atlas: Atlas, p: Puzzle): string {
  return [p.atlas, p.start, p.end, p.region ? atlas.regions.indexOf(p.region) : '', p.avoid ?? '', p.extra ?? 'defaut'].join('.')
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
    () => atlas.codes.filter((c) => atlas.neighbors.has(c)).sort((a, b) => atlas.name(a).localeCompare(atlas.name(b), locale())),
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
      setError(t('Aucun trajet ne correspond à ces réglages.'))
      return null
    }
    setError('')
    return playUrl({ ...p, hard })
  }

  async function challenge() {
    const url = resolve()
    if (!url) return
    const ok = await copyText(`${location.origin}${location.pathname}#${url}`)
    setToast(ok ? t('Lien du défi copié !') : t('Copie impossible'))
    setTimeout(() => go(url), 900)
  }

  return (
    <div className="itin-config">
      <h2>⚙ {t('Configuration')}</h2>
      <div className="cfg-grid">
        <div className="cfg-card">
          <span className="cfg-step">{t('1. Choisir la carte')}</span>
          <div className="cfg-maps">
            {(['monde', 'usa'] as AtlasId[]).map((id) => (
              <button key={id} className={atlasId === id ? 'on' : ''} onClick={() => setAtlasId(id)}>
                {id === 'monde' ? `🌍 ${t('Monde')}` : `🇺🇸 ${t('États-Unis')}`}
              </button>
            ))}
          </div>
        </div>
        <div className="cfg-card">
          <span className="cfg-step">{t('2. Choisir le trajet')}</span>
          <label>
            {t('Départ')}
            <Select value={start} onChange={setStart}>
              <option value="">— {t('Aléatoire')} —</option>
              {sorted.map((c) => (
                <option key={c} value={c}>
                  {atlas.name(c)}
                </option>
              ))}
            </Select>
          </label>
          <span className="cfg-arrow">↓</span>
          <label>
            {t('Arrivée')}
            <Select value={end} onChange={setEnd}>
              <option value="">— {t('Aléatoire')} —</option>
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
        🔧 {t('Réglages avancés')} <span>{advanced ? '▴' : '▾'}</span>
      </button>
      {advanced && (
        <div className="cfg-adv">
          <label>
            {tx('Longueur du trajet : de {min} à {max} essais', { min: <b>{minLen}</b>, max: <b>{maxLen}</b> })}
            <span className="cfg-range">
              <input type="range" min={1} max={12} value={minLen} onChange={(e) => setMinLen(+e.target.value)} />
              <input type="range" min={1} max={14} value={maxLen} onChange={(e) => setMaxLen(+e.target.value)} />
            </span>
          </label>
          <label>
            {t('Mode de jeu')}
            <Select value={hard ? 'difficile' : 'normal'} onChange={(v) => setHard(v === 'difficile')}>
              <option value="normal">{t('Normal')}</option>
              <option value="difficile">{t('Difficile (ni indices, ni noms)')}</option>
            </Select>
          </label>
          <label>
            {t('Essais bonus')}
            <Select value={extra} onChange={(v) => setExtra(v as Extra)}>
              <option value="defaut">{t('Par défaut')}</option>
              <option value="aucun">{t('Aucun : trajet le plus court uniquement')}</option>
              <option value="illimite">{t('Essais illimités')}</option>
            </Select>
          </label>
          <label>
            {atlas.id === 'usa' ? t('Région') : t('Continent')}
            <Select value={region} onChange={setRegion}>
              <option value="">— {t('Tous')} —</option>
              {atlas.regions.map((r) => (
                <option key={r} value={r}>
                  {t(r)}
                </option>
              ))}
            </Select>
          </label>
          <label>
            {t('Sans passer par')}
            <Select value={avoid} onChange={setAvoid}>
              <option value="">— {t('Aucun')} —</option>
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
        <b>🏅 {t('Créer un défi')}</b>
        <span>{t('Crée un défi à partager et affronte tes amis')}</span>
      </button>
      <button
        className="cfg-solo"
        onClick={() => {
          const url = resolve()
          if (url) go(url)
        }}
      >
        ▶ {t('Jouer en solo')}
      </button>
      <a className="cfg-back" href="#/itineraire">
        ← {t('Retour à Travle')}
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
      <h2>{t('Archive')}</h2>
      <div className="cfg-maps">
        {(['monde', 'usa'] as AtlasId[]).map((id) => (
          <button key={id} className={atlasId === id ? 'on' : ''} onClick={() => setAtlasId(id)}>
            {id === 'monde' ? `🌍 ${t('Monde')}` : `🇺🇸 ${t('États-Unis')}`}
          </button>
        ))}
      </div>
      <ul className="arch-list">
        {rows.map(({ date, p, res, started }) => (
          <li key={date}>
            <a href={`#${base}?date=${date}`}>
              <span className="arch-date">
                {new Date(date + 'T12:00:00').toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
              <span className="arch-route">
                <span className="c-start">{atlas.name(p.start)}</span> → <span className="c-end">{atlas.name(p.end)}</span>
              </span>
              <span className="arch-state">
                {res ? (res.won ? `✅ ${plural(res.guesses, '{n} essai', '{n} essais')}` : `❌ ${t('perdu')}`) : started ? t('en cours') : t('{n} min.', { n: p.shortest })}
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
  const text = `${t('Mes statistiques Travle')}\n🎮 ${plural(s.played, '{n} partie', '{n} parties')} · 🏆 ${s.winRate}% · 🔥 ${s.streak} (max ${s.maxStreak})\n${t('Parfaites : {perfect}% · Sans indice : {nohint}%', { perfect: s.perfectRate, nohint: s.noHintRate })}`
  return (
    <div className="itin-page">
      <h2>{t('Statistiques')}</h2>
      <div className="st-tiles">
        <div>
          <span>🎮</span>
          <b>{s.played}</b>
          {t('Parties')}
        </div>
        <div>
          <span>🏆</span>
          <b>{s.winRate}</b>
          {t('% victoires')}
        </div>
        <div>
          <span>🔥</span>
          <b>{s.streak}</b>
          {t('Série actuelle')}
        </div>
        <div>
          <span>🚀</span>
          <b>{s.maxStreak}</b>
          {t('Meilleure série')}
        </div>
      </div>
      <h3 className="itin-h">{t('Répartition des essais')}</h3>
      {s.played === 0 ? (
        <p className="itin-muted">{t('Joue et gagne une partie pour voir ta répartition.')}</p>
      ) : (
        <div className="dist">
          {s.distribution.map((d) => (
            <div key={d.label} className="dist-row">
              <span>{t(d.label)}</span>
              <div>
                <i style={{ width: `${(d.count / max) * 100}%` }}>{d.count || ''}</i>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="st-tiles small">
        <div>
          <b>{s.perfectRate}%</b>
          {t('Taux parfait')}
        </div>
        <div>
          <b>{s.noHintRate}%</b>
          {t('Sans indice')}
        </div>
        <div>
          <b>{s.hints}</b>
          {t('Indices utilisés')}
        </div>
        <div>
          <b>{s.last10}%</b>
          {t('10 dernières')}
        </div>
      </div>
      <h3 className="itin-h">{t('Partager tes statistiques')}</h3>
      <p className="itin-muted">{t('Copie un résumé et compare-toi à tes amis.')}</p>
      <button
        className="pink wide"
        onClick={async () => {
          setToast((await copyText(text)) ? t('Statistiques copiées !') : t('Copie impossible'))
          setTimeout(() => setToast(''), 1600)
        }}
      >
        {t('Copier mes statistiques')}
      </button>
      {toast && <div className="toast-copy">{toast}</div>}
    </div>
  )
}

export function Maps() {
  const cards = [
    { href: '#/itineraire', icon: '🌍', title: t('Quotidien'), text: t('Le trajet du jour à travers le monde') },
    { href: '#/itineraire/hebdo', icon: '🗓', title: t('Défi hebdomadaire'), text: t('Un long trajet, chaque lundi') },
    { href: '#/itineraire/usa', icon: '🇺🇸', title: t('États-Unis'), text: t('D’un État à l’autre, chaque jour') },
    { href: '#/itineraire/libre', icon: '🎲', title: t('Entraînement'), text: t('Trajets aléatoires ou sur mesure') },
    { href: '#/itineraire/archive', icon: '📚', title: t('Archive'), text: t('Rejoue les jours précédents') },
  ]
  return (
    <div className="itin-page">
      <h2>{t('Modes de jeu')}</h2>
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
