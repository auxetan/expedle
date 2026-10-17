import { useMemo, useState } from 'react'
import { worldAtlas } from '../../geo/atlas'
import { flagEmoji } from '../../geo/countries'
import { dailyResult, recordPlay, saveDailyResult, useStopwatch } from '../../lib/stats'
import { copyText, load, save, todayKey } from '../../lib/util'
import AppBar, { SubLink } from '../../ui/AppBar'
import CountryInput from '../../ui/CountryInput'
import { check, makeGrid, MAX_GUESSES, score } from './game'
import './geogrid.css'

interface Saved {
  cells: (string | null)[]
  guesses: number
}

const EMPTY: Saved = { cells: Array(9).fill(null), guesses: 0 }
const MESSAGES = { wrong: 'Ce pays ne remplit pas les deux critères.', used: 'Ce pays est déjà dans la grille.' }

export default function GeoGrid({ mode }: { mode?: string }) {
  const practice = mode === 'libre'
  const atlas = worldAtlas()
  const day = todayKey()
  const storageKey = practice ? null : `geogrid:${day}`
  const [seed, setSeed] = useState(() => (practice ? String(Math.random()) : day))
  const grid = useMemo(() => makeGrid(atlas, seed), [atlas, seed])
  const [state, setState] = useState<Saved>(() => (storageKey ? load<Saved>(storageKey, EMPTY) : EMPTY))
  const [active, setActive] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [shake, setShake] = useState<number | null>(null)
  const [toast, setToast] = useState('')
  const elapsed = useStopwatch(seed)

  const filled = state.cells.filter(Boolean).length
  const over = filled === 9 || state.guesses >= MAX_GUESSES

  function update(next: Saved) {
    setState(next)
    if (storageKey) save(storageKey, next)
    if (next.cells.filter(Boolean).length < 9 && next.guesses < MAX_GUESSES) return
    if (!practice && !dailyResult('geogrid', day)) saveDailyResult('geogrid', { score: next.cells.filter(Boolean).length }, day)
    recordPlay('geogrid', { pts: score(next.cells), s: next.cells.filter(Boolean).length, ms: elapsed(), sub: practice ? 'libre' : undefined })
  }

  function guess(code: string) {
    if (active === null) return
    const result = check(grid, state.cells, active, code)
    // un pays déjà placé n'use pas d'essai : c'est une étourderie, pas une erreur
    if (result === 'used') return setMessage(MESSAGES.used)
    const cells = [...state.cells]
    if (result === 'ok') {
      cells[active] = code
      setActive(null)
      setMessage('')
    } else {
      setMessage(MESSAGES.wrong)
      setShake(active)
      setTimeout(() => setShake(null), 450)
    }
    update({ cells, guesses: state.guesses + 1 })
  }

  async function share() {
    const lines = [0, 1, 2].map((r) => [0, 1, 2].map((c) => (state.cells[r * 3 + c] ? '🟩' : '⬛')).join(''))
    const text = `GeoGrid Méridien ${practice ? '(partie libre)' : day} ${filled}/9\n${lines.join('\n')}`
    setToast((await copyText(text)) ? 'Résultat copié !' : 'Copie impossible')
    setTimeout(() => setToast(''), 1800)
  }

  const cellLabel = (i: number) => `${grid.rows[Math.floor(i / 3)].label} · ${grid.cols[i % 3].label}`

  return (
    <div className="gr">
      <AppBar title="GeoGrid">
        <SubLink href="#/geogrid" active={!practice}>
          Grille du jour
        </SubLink>
        <SubLink href="#/geogrid/libre" active={practice}>
          Partie libre
        </SubLink>
      </AppBar>
      <main className="gr-main">
        <p className="gr-intro muted">
          Trouve pour chaque case un pays qui remplit le critère de sa ligne <b>et</b> celui de sa colonne. {MAX_GUESSES} essais, chaque pays une seule fois.
        </p>

        <div className="gr-board" role="grid" aria-label="Grille de GeoGrid">
          <span className="gr-corner">
            <b>{Math.max(0, MAX_GUESSES - state.guesses)}</b>
            essai{MAX_GUESSES - state.guesses > 1 ? 's' : ''}
          </span>
          {grid.cols.map((c) => (
            <span key={c.id} className="gr-head col" role="columnheader">
              {c.label}
            </span>
          ))}
          {grid.rows.map((r, ri) => (
            <div key={r.id} className="gr-line" role="row">
              <span className="gr-head row" role="rowheader">
                {r.label}
              </span>
              {grid.cols.map((_, ci) => {
                const i = ri * 3 + ci
                const code = state.cells[i]
                const cls = ['gr-cell', code ? 'done' : '', active === i ? 'active' : '', shake === i ? 'shake' : ''].join(' ')
                return (
                  <button
                    key={i}
                    role="gridcell"
                    className={cls}
                    disabled={!!code || over}
                    aria-label={code ? `${cellLabel(i)} : ${atlas.name(code)}` : cellLabel(i)}
                    onClick={() => {
                      setActive(i)
                      setMessage('')
                    }}
                  >
                    {code ? (
                      <>
                        <span className="gr-flag">{flagEmoji(code)}</span>
                        <small>{atlas.name(code)}</small>
                      </>
                    ) : over ? (
                      <small className="muted">{grid.answers[i].length} possibles</small>
                    ) : (
                      <span className="gr-plus">+</span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {!over && active !== null && (
          <section className="gr-ask" ref={(el) => el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })}>
            <p>
              <b>{grid.rows[Math.floor(active / 3)].label}</b> et <b>{grid.cols[active % 3].label.toLowerCase()}</b>
            </p>
            <CountryInput key={active} atlas={atlas} used={new Set()} onPick={guess} placeholder="Un pays qui convient…" button="Placer" autoFocus />
            {message && <p className="gr-message">{message}</p>}
          </section>
        )}
        {!over && active === null && <p className="gr-hint muted">Choisis une case pour commencer.</p>}

        {over && (
          <section className="gr-end">
            <b>{filled === 9 ? 'Grille complète, bravo !' : `${filled} case${filled > 1 ? 's' : ''} sur 9.`}</b>
            <div className="gr-actions">
              <button className="ui-btn" onClick={share}>
                Partager
              </button>
              {practice ? (
                <button
                  className="ui-btn line"
                  onClick={() => {
                    setSeed(String(Math.random()))
                    setState(EMPTY)
                    setActive(null)
                  }}
                >
                  Une autre grille ↻
                </button>
              ) : (
                <a className="ui-btn line" href="#/geogrid/libre">
                  Partie libre
                </a>
              )}
            </div>
            <details className="gr-solutions">
              <summary>Voir toutes les réponses possibles</summary>
              {grid.answers.map((list, i) => (
                <p key={i}>
                  <b>{cellLabel(i)}</b> ({list.length}) : {list.map((c) => atlas.name(c)).join(', ')}
                </p>
              ))}
            </details>
          </section>
        )}
      </main>
      {toast && <div className="toast-copy">{toast}</div>}
    </div>
  )
}
