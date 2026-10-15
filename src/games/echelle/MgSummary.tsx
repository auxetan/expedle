import { useState, type ReactNode } from 'react'
import { copyText, load, save } from '../../lib/util'

export interface RoundRecap {
  title: ReactNode
  detail: ReactNode
  score: number
}

export function recordTotal(key: string, total: number): number[] {
  const list = [...load<number[]>(`mg-hist:${key}`, []), total].slice(-200)
  save(`mg-hist:${key}`, list)
  return list
}

function message(ratio: number): string {
  if (ratio >= 0.9) return 'Un œil parfait pour l’échelle !'
  if (ratio >= 0.7) return 'Très bonne vision des proportions.'
  if (ratio >= 0.5) return 'Pas mal du tout, continue d’entraîner ton œil.'
  if (ratio >= 0.3) return 'Une série délicate. Continue d’entraîner ton œil.'
  return 'Une série corsée : l’échelle t’a joué des tours.'
}

interface Props {
  title: string
  rounds: RoundRecap[]
  max: number
  historyKey: string
  shareText: string
  archiveHref: string
  onReplay: () => void
}

export default function MgSummary({ title, rounds, max, historyKey, shareText, archiveHref, onReplay }: Props) {
  const total = rounds.reduce((s, r) => s + r.score, 0)
  const [selected, setSelected] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [history] = useState(() => load<number[]>(`mg-hist:${historyKey}`, []))
  const buckets = 5
  const size = max / buckets
  const counts = Array.from({ length: buckets }, (_, i) =>
    history.filter((t) => Math.min(buckets - 1, Math.floor(t / size)) === i).length,
  )
  const peak = Math.max(1, ...counts)
  const avg = history.length ? history.reduce((a, b) => a + b, 0) / history.length : total
  const beat = history.length ? Math.round((history.filter((t) => t < total).length / history.length) * 100) : 0
  const mine = Math.min(buckets - 1, Math.floor(total / size))

  return (
    <section className="mg-summary">
      <h3 className="mg-sum-h">Tes manches</h3>
      <div className="mg-sum-rounds">
        {rounds.map((r, i) => (
          <button key={i} className={selected === i ? 'on' : ''} onClick={() => setSelected(selected === i ? null : i)}>
            <small>MANCHE {i + 1}</small>
            <b>{r.score}</b>
          </button>
        ))}
      </div>
      {selected === null ? (
        <p className="mg-sum-hint">Sélectionne une manche pour revoir ta réponse.</p>
      ) : (
        <div className="mg-sum-detail">
          <div>{rounds[selected].title}</div>
          <div className="dim">{rounds[selected].detail}</div>
        </div>
      )}
      <div className="mg-sum-total">
        <b>{total}</b>
        <small>(SUR {max})</small>
      </div>
      <p className="mg-sum-msg">{message(total / max)}</p>
      <button className="mg-cta mg-sum-share" onClick={async () => setCopied(await copyText(shareText))}>
        {copied ? 'Copié !' : 'Partager le résultat'}
      </button>

      <h3 className="mg-sum-h">Comment tu te situes</h3>
      <div className="mg-hist">
        {counts.map((c, i) => (
          <div key={i} className={i === mine ? 'mine' : ''}>
            <span className="mg-hist-n">{c}</span>
            <i style={{ height: `${(c / peak) * 100}%` }} />
            <small>
              {Math.round(i * size)}-{i === buckets - 1 ? max : Math.round((i + 1) * size) - 1}
            </small>
          </div>
        ))}
      </div>
      <div className="mg-sum-figs">
        <div>
          <small>TA MOYENNE</small>
          <b>{avg.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}</b>
        </div>
        <div>
          <small>MIEUX QUE</small>
          <b>{beat} %</b>
          <span className="dim">de tes parties</span>
        </div>
      </div>
      <div className="mg-modal-actions mg-sum-actions">
        <a className="mg-ghost-btn" href={archiveHref}>
          Jouer l’archive
        </a>
        <button className="mg-cta" onClick={onReplay}>
          Rejouer {title} ↻
        </button>
      </div>
    </section>
  )
}
