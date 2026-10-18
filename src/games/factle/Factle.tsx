import { useMemo, useState } from 'react'
import { worldAtlas } from '../../geo/atlas'
import { flagEmoji } from '../../geo/countries'
import { newSeed, readChallenge } from '../../lib/challenge'
import { ordinal, plural, t } from '../../lib/i18n'
import { go } from '../../lib/router'
import { dailyResult, recordPlay, saveDailyResult, useStopwatch } from '../../lib/stats'
import { copyText, load, save, seededRng, todayKey } from '../../lib/util'
import AppBar, { SubLink } from '../../ui/AppBar'
import ChallengeBox from '../../ui/ChallengeBox'
import CountryInput from '../../ui/CountryInput'
import { mark, MAX_TRIES, question, score, SIZE, type Mark } from './game'
import './factle.css'

interface Saved {
  tries: string[][]
  ms?: number
}

const EMOJI: Record<Mark, string> = { exact: '🟩', top: '🟨', near: '🟧', far: '⬜' }

export default function Factle({ mode }: { mode?: string }) {
  const [challenge] = useState(readChallenge)
  const practice = mode === 'libre' || !!challenge
  const atlas = worldAtlas()
  const day = todayKey()
  const storageKey = practice ? null : `factle:${day}`
  const [seed, setSeed] = useState(() => challenge?.seed ?? (practice ? newSeed() : day))
  const q = useMemo(() => question(seededRng('factle-' + seed)), [seed])
  const [state, setState] = useState<Saved>(() => (storageKey ? load<Saved>(storageKey, { tries: [] }) : { tries: [] }))
  const last = state.tries.at(-1)
  const lockedAt = (i: number) => !!last && mark(q, i, last[i]) === 'exact'
  const [slots, setSlots] = useState<(string | null)[]>(() => Array.from({ length: SIZE }, (_, i) => (lockedAt(i) ? last![i] : null)))
  const [toast, setToast] = useState('')
  const elapsed = useStopwatch(seed)

  const won = !!last && last.every((code, i) => mark(q, i, code) === 'exact')
  const over = won || state.tries.length >= MAX_TRIES
  const exact = last ? last.filter((code, i) => mark(q, i, code) === 'exact').length : 0
  const pts = score(won, state.tries.length, exact)

  function update(next: Saved) {
    setState(next)
    if (storageKey) save(storageKey, next)
  }

  function place(code: string) {
    const i = slots.indexOf(null)
    if (i < 0) return
    setSlots(slots.map((s, j) => (j === i ? code : s)))
  }

  function submit() {
    if (slots.includes(null)) return
    const attempt = slots as string[]
    const tries = [...state.tries, attempt]
    const win = attempt.every((code, i) => mark(q, i, code) === 'exact')
    const done = win || tries.length >= MAX_TRIES
    const ms = elapsed()
    update({ tries, ...(done ? { ms } : {}) })
    // les bonnes places restent, le reste se rejoue
    setSlots(attempt.map((code, i) => (mark(q, i, code) === 'exact' ? code : null)))
    if (!done) return
    const total = score(win, tries.length, attempt.filter((code, i) => mark(q, i, code) === 'exact').length)
    if (!practice && !dailyResult('factle', day)) saveDailyResult('factle', { won: win, tries: tries.length }, day)
    recordPlay('factle', { pts: total, s: tries.length, win, ms, sub: challenge ? 'defi' : practice ? 'libre' : undefined })
  }

  function another() {
    if (challenge) return go('/factle/libre')
    setSeed(newSeed())
    setState({ tries: [] })
    setSlots(Array(SIZE).fill(null))
  }

  async function share() {
    const text = `Factle Méridien ${practice ? t('(partie libre)') : day} ${won ? state.tries.length : 'X'}/${MAX_TRIES}\n${t('Top 5 : {cat}', { cat: t(q.category.label) })}\n${state.tries
      .map((attempt) => attempt.map((code, i) => EMOJI[mark(q, i, code)]).join(''))
      .join('\n')}`
    setToast((await copyText(text)) ? t('Résultat copié !') : t('Copie impossible'))
    setTimeout(() => setToast(''), 1800)
  }

  const rank = (code: string) => {
    const r = q.category.ranks.get(code)
    return r ? ordinal(r) : '—'
  }

  return (
    <div className="fc">
      <AppBar title="Factle">
        <SubLink href="#/factle" active={!practice}>
          {t('Classement du jour')}
        </SubLink>
        <SubLink href="#/factle/libre" active={practice && !challenge}>
          {t('Partie libre')}
        </SubLink>
      </AppBar>
      <main className="fc-main">
        <header className="fc-head">
          <span className="fc-icon">{q.category.icon}</span>
          <h1>{t('Top 5 : {cat}', { cat: t(q.category.label) })}</h1>
          <p className="muted">{t('Les cinq pays les mieux classés, du 1er au 5e. Cinq essais : les bonnes places restent acquises.')}</p>
        </header>

        {state.tries.length > 0 && (
          <ol className="fc-tries">
            {state.tries.map((attempt, n) => (
              <li key={n}>
                {attempt.map((code, i) => {
                  const m = mark(q, i, code)
                  return (
                    <span key={i} className={`fc-chip ${m}`} title={atlas.name(code)}>
                      <span>{flagEmoji(code)}</span>
                      <small>{m === 'exact' || m === 'top' ? atlas.name(code) : rank(code)}</small>
                    </span>
                  )
                })}
              </li>
            ))}
          </ol>
        )}

        {!over && (
          <>
            <ol className="fc-slots">
              {slots.map((code, i) => (
                <li key={i} className={lockedAt(i) && code === last?.[i] ? 'locked' : code ? 'filled' : ''}>
                  <span className="fc-pos">{i + 1}</span>
                  {code ? (
                    <>
                      <span className="fc-flag">{flagEmoji(code)}</span>
                      <b>{atlas.name(code)}</b>
                      {!(lockedAt(i) && code === last?.[i]) && (
                        <button onClick={() => setSlots(slots.map((s, j) => (j === i ? null : s)))} aria-label={t('Retirer {name}', { name: atlas.name(code) })}>
                          ✕
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="muted">{t('à trouver')}</span>
                  )}
                </li>
              ))}
            </ol>
            {slots.includes(null) ? (
              <CountryInput atlas={atlas} used={new Set(slots.filter((s): s is string => !!s))} onPick={place} placeholder={t('Ajoute un pays…')} button={t('Ajouter')} />
            ) : (
              <button className="ui-btn fc-submit" onClick={submit}>
                {t('Valider ({n}/{max})', { n: state.tries.length + 1, max: MAX_TRIES })}
              </button>
            )}
            <p className="fc-legend muted">
              🟩 {t('bonne place')} · 🟨 {t('dans le top 5')} · 🟧 {t('dans le top 10')} · ⬜ {t('plus loin')}
            </p>
          </>
        )}

        {over && (
          <section className="fc-end">
            <b>{won ? plural(state.tries.length, 'Bravo, trouvé en {n} essai !', 'Bravo, trouvé en {n} essais !') : t('Raté de peu ? Voici le classement.')}</b>
            <ol className="fc-answer">
              {q.top.map((code, i) => (
                <li key={code}>
                  <span className="fc-pos">{i + 1}</span>
                  <span className="fc-flag">{flagEmoji(code)}</span>
                  <b>{atlas.name(code)}</b>
                </li>
              ))}
            </ol>
            <div className="fc-actions">
              <button className="ui-btn" onClick={share}>
                {t('Partager')}
              </button>
              {practice ? (
                <button className="ui-btn line" onClick={another}>
                  {t('Un autre classement ↻')}
                </button>
              ) : (
                <a className="ui-btn line" href="#/factle/libre">
                  {t('Partie libre')}
                </a>
              )}
            </div>
            <ChallengeBox game="factle" path="/factle" seed={seed} result={{ pts, s: state.tries.length, win: won, ms: state.ms }} />
          </section>
        )}
      </main>
      {toast && <div className="toast-copy">{toast}</div>}
    </div>
  )
}
