import { useEffect, useMemo, useRef, useState } from 'react'
import { go } from '../../lib/router'
import { recordPlay } from '../../lib/stats'
import { copyText, formatTime, normalize } from '../../lib/util'
import AppBar, { SubLink } from '../../ui/AppBar'
import CountUp from '../../ui/CountUp'
import { Icon, ICONS, loadProfile } from '../../ui/Panels'
import { builtInQuizzes, featuredQuiz } from './catalog'
import {
  bestResult,
  CATEGORIES,
  decodeQuiz,
  encodeQuiz,
  formatAnswers,
  loadMine,
  matchAnswer,
  parseAnswers,
  saveMine,
  submitResult,
  validateQuiz,
  type TableQuiz,
} from './model'
import './jetpunk.css'
import { msg, plural, t, tx } from '../../lib/i18n'

const minutes = (s: number) => (s < 60 ? `${s} s` : `${Math.round(s / 60)} min`)
const shareLink = (q: TableQuiz) => `${location.origin}${location.pathname}#/jetpunk/partage?d=${encodeQuiz(q)}`

function Bar({ active }: { active: 'liste' | 'mine' | 'creer' | null }) {
  return (
    <AppBar title="JetPunk">
      <SubLink href="#/jetpunk" active={active === 'liste'}>
        {t('Tous les quiz')}
      </SubLink>
      <SubLink href="#/jetpunk?cat=mine" active={active === 'mine'}>
        {t('Mes quiz')}
      </SubLink>
      <SubLink href="#/jetpunk/creer" active={active === 'creer'}>
        {t('Créer un quiz')}
      </SubLink>
    </AppBar>
  )
}

function QuizCard({ q, index, mine, showCategory }: { q: TableQuiz; index: number; mine?: boolean; showCategory?: boolean }) {
  const best = bestResult(q.id)
  return (
    <a href={`#/jetpunk/q/${q.id}`} className="jp-card" style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}>
      {showCategory && <span className="ui-label">{t(q.category)}</span>}
      <b>{q.title}</b>
      <span className="jp-card-meta">
        {plural(q.rows.length, '{n} réponse', '{n} réponses')} · {minutes(q.time)}
        {mine ? ` · ${t('par toi')}` : ''}
      </span>
      {best && (
        <span className={best.found === best.total ? 'jp-badge full' : 'jp-badge'}>
          {best.found === best.total ? '✓ ' : ''}
          {best.found}/{best.total}
        </span>
      )}
    </a>
  )
}

function QuizList({ params }: { params: URLSearchParams }) {
  const cat = params.get('cat')
  const [query, setQuery] = useState('')
  const mine = useMemo(() => loadMine(), [])
  const builtIn = builtInQuizzes()
  const words = normalize(query).split(' ').filter(Boolean)
  const matches = (q: TableQuiz) => {
    const text = normalize(`${q.title} ${q.description} ${q.category} ${t(q.category)} ${q.tags.join(' ')}`)
    return words.every((w) => text.includes(w))
  }
  const pool = cat === 'mine' ? mine : [...mine, ...builtIn].filter((q) => !cat || q.category === cat)
  const found = pool.filter(matches)
  const featured = featuredQuiz()
  const mineIds = new Set(mine.map((q) => q.id))
  const browsing = !query && !cat

  return (
    <div className="jp">
      <Bar active={cat === 'mine' ? 'mine' : 'liste'} />
      <main className="jp-main">
        <header className="jp-head">
          <div>
            <h1>JetPunk</h1>
            <p className="muted">{t('Des quiz à remplir contre la montre : tape, la réponse s’inscrit toute seule.')}</p>
          </div>
          <div className="jp-head-actions">
            <button className="ui-btn line" onClick={() => go(`/jetpunk/q/${builtIn[Math.floor(Math.random() * builtIn.length)].id}`)}>
              {t('Au hasard')}
            </button>
            <a href="#/jetpunk/creer" className="ui-btn">
              + {t('Créer un quiz')}
            </a>
          </div>
        </header>

        <div className="jp-search">
          <Icon d={ICONS.search} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Chercher un quiz : capitales, Harry Potter, football…')} autoFocus />
          {query && (
            <button onClick={() => setQuery('')} aria-label={t('Effacer')}>
              <Icon d={ICONS.close} />
            </button>
          )}
        </div>

        <nav className="jp-cats">
          <a href="#/jetpunk" className={!cat ? 'on' : ''}>
            {t('Tous')}
          </a>
          {CATEGORIES.map((c) => (
            <a key={c} href={`#/jetpunk?cat=${encodeURIComponent(c)}`} className={cat === c ? 'on' : ''}>
              {t(c)}
            </a>
          ))}
          <a href="#/jetpunk?cat=mine" className={cat === 'mine' ? 'on' : ''}>
            {t('Mes quiz')}
            {mine.length ? ` (${mine.length})` : ''}
          </a>
        </nav>

        {browsing && (
          <a href={`#/jetpunk/q/${featured.id}`} className="jp-featured">
            <span className="ui-label">{t('À la une aujourd’hui')}</span>
            <b>{featured.title}</b>
            <span className="muted">{featured.description}</span>
            <span className="jp-card-meta">
              {plural(featured.rows.length, '{n} réponse', '{n} réponses')} · {minutes(featured.time)} · {t('Jouer →')}
            </span>
          </a>
        )}

        {cat === 'mine' && !mine.length ? (
          <div className="jp-empty">
            <p>{t('Tu n’as pas encore créé de quiz.')}</p>
            <a href="#/jetpunk/creer" className="ui-btn">
              {t('Créer mon premier quiz')}
            </a>
          </div>
        ) : !found.length ? (
          <p className="jp-empty muted">{t('Aucun quiz ne correspond à « {query} ».', { query })}</p>
        ) : browsing ? (
          [...(mine.length ? ['mine'] : []), ...CATEGORIES].map((c) => {
            const list = c === 'mine' ? mine : builtIn.filter((q) => q.category === c)
            if (!list.length) return null
            return (
              <section key={c} className="jp-section">
                <h2>{t(c === 'mine' ? 'Mes quiz' : c)}</h2>
                <div className="jp-grid">
                  {list.map((q, i) => (
                    <QuizCard key={q.id} q={q} index={i} mine={c === 'mine'} showCategory={c === 'mine'} />
                  ))}
                </div>
              </section>
            )
          })
        ) : (
          <section className="jp-section">
            <h2>
              {query
                ? plural(found.length, '{n} quiz trouvé pour « {query} »', '{n} quiz trouvés pour « {query} »', { query })
                : plural(found.length, '{n} quiz trouvé', '{n} quiz trouvés')}
            </h2>
            <div className="jp-grid">
              {found.map((q, i) => (
                <QuizCard key={q.id} q={q} index={i} mine={mineIds.has(q.id)} showCategory={!cat} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

type Phase = 'ready' | 'play' | 'done'

function QuizPlay({ quiz, shared }: { quiz: TableQuiz; shared?: boolean }) {
  const total = quiz.rows.length
  const [phase, setPhase] = useState<Phase>('ready')
  const [found, setFound] = useState<Set<number>>(new Set())
  const [fresh, setFresh] = useState<Set<number>>(new Set())
  const [value, setValue] = useState('')
  const [startAt, setStartAt] = useState(0)
  const [now, setNow] = useState(0)
  const [result, setResult] = useState<{ ms: number; record: boolean } | null>(null)
  const [toast, setToast] = useState('')
  const [added, setAdded] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const mine = useMemo(() => loadMine(), [])
  const isMine = mine.some((q) => q.id === quiz.id)
  const best = bestResult(quiz.id)
  const limit = quiz.time * 1000
  const left = phase === 'play' ? Math.max(0, limit - (now - startAt)) : phase === 'done' ? limit - (result?.ms ?? 0) : limit

  const groups = useMemo(() => {
    const map = new Map<string, number[]>()
    quiz.rows.forEach((r, i) => map.set(r.group ?? '', [...(map.get(r.group ?? '') ?? []), i]))
    return [...map]
  }, [quiz])

  function start() {
    const t = Date.now()
    setFound(new Set())
    setFresh(new Set())
    setValue('')
    setResult(null)
    setStartAt(t)
    setNow(t)
    setPhase('play')
    setTimeout(() => input.current?.focus(), 0)
  }

  function finish(all: Set<number>) {
    const ms = Math.min(limit, Date.now() - startAt)
    const record = shared ? false : submitResult(quiz.id, { found: all.size, total, ms })
    recordPlay('jetpunk', { pts: (100 * all.size) / total, s: Math.round((100 * all.size) / total), ms, sub: quiz.id })
    setResult({ ms, record })
    setPhase('done')
  }

  // le chrono tourne ; à zéro, la partie s'arrête avec ce qui a été trouvé
  const foundRef = useRef(found)
  const finishRef = useRef(finish)
  useEffect(() => {
    foundRef.current = found
    finishRef.current = finish
  })
  useEffect(() => {
    if (phase !== 'play') return
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t - startAt >= limit) finishRef.current(foundRef.current)
    }, 250)
    return () => clearInterval(id)
  }, [phase, startAt, limit])

  function type(v: string) {
    const hits = matchAnswer(quiz, v, found)
    if (!hits.length) return setValue(v)
    const next = new Set([...found, ...hits])
    setFound(next)
    setFresh(new Set(hits))
    setValue('')
    if (next.size === total) finish(next)
  }

  async function copy(text: string, ok: string) {
    setToast((await copyText(text)) ? ok : t('Copie impossible'))
    setTimeout(() => setToast(''), 1800)
  }

  function addToMine() {
    const copyId = `u-${Date.now().toString(36)}`
    saveMine([{ ...quiz, id: copyId }, ...mine])
    setAdded(true)
  }

  const pct = Math.round((100 * found.size) / total)

  return (
    <div className="jp">
      <Bar active={null} />
      <main className="jp-main">
        <header className="jp-quiz-head">
          <span className="ui-label">
            {shared ? `${t('Quiz partagé')} · ` : ''}
            {t(quiz.category)}
          </span>
          <h1>{quiz.title}</h1>
          {quiz.description && <p className="muted">{quiz.description}</p>}
          <p className="jp-card-meta">
            {plural(total, '{n} réponse', '{n} réponses')} · {minutes(quiz.time)}
            {quiz.author ? ` · ${t('par {author}', { author: quiz.author })}` : ''}
            {best && !shared ? ` · ${t('ton record : {found}/{total} en {time}', { found: best.found, total: best.total, time: formatTime(best.ms) })}` : ''}
          </p>
          <div className="jp-head-actions">
            {isMine && (
              <a className="ui-btn line" href={`#/jetpunk/creer?id=${quiz.id}`}>
                {t('Modifier')}
              </a>
            )}
            {(isMine || shared) && (
              <button className="ui-btn line" onClick={() => copy(shareLink(quiz), t('Lien du quiz copié !'))}>
                {t('Partager le quiz')}
              </button>
            )}
            {shared && !isMine && (
              <button className="ui-btn line" onClick={addToMine} disabled={added}>
                {added ? t('Ajouté à mes quiz ✓') : t('Ajouter à mes quiz')}
              </button>
            )}
          </div>
        </header>

        <div className={`jp-bar ${phase}`}>
          {phase === 'ready' && (
            <>
              <button className="ui-btn jp-start" onClick={start}>
                {t('Commencer le quiz ▶')}
              </button>
              <span className="muted">{t('Pas besoin de valider : chaque bonne réponse s’inscrit dès qu’elle est tapée.')}</span>
            </>
          )}
          {phase === 'play' && (
            <>
              <input
                ref={input}
                className="jp-input"
                value={value}
                onChange={(e) => type(e.target.value)}
                placeholder={t('Écris une réponse…')}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <span className="jp-score">
                <b>{found.size}</b> / {total}
              </span>
              <span className={left < 10000 ? 'jp-timer low' : 'jp-timer'}>{formatTime(left + 999)}</span>
              <button className="ui-btn line" onClick={() => finish(found)}>
                {t('Abandonner')}
              </button>
            </>
          )}
          {phase === 'done' && result && (
            <div className="jp-result">
              <div>
                <b className="jp-result-score">
                  <CountUp value={found.size} /> / {total}
                </b>
                <span>
                  {pct === 100
                    ? t('Sans-faute en {time} !', { time: formatTime(result.ms) })
                    : t('{pct} % des réponses en {time}', { pct, time: formatTime(result.ms) })}
                  {result.record && <b className="jp-record"> · {t('nouveau record')}</b>}
                </span>
              </div>
              <div className="jp-result-actions">
                <button className="ui-btn" onClick={start}>
                  {t('Rejouer ↻')}
                </button>
                <button
                  className="ui-btn line"
                  onClick={() =>
                    copy(
                      t('{title} — {found}/{total} ({pct} %) en {time} sur Méridien', { title: quiz.title, found: found.size, total, pct, time: formatTime(result.ms) }),
                      t('Résultat copié !'),
                    )
                  }
                >
                  {t('Partager')}
                </button>
                <a className="ui-btn line" href="#/jetpunk">
                  {t('Autres quiz')}
                </a>
              </div>
            </div>
          )}
        </div>

        {groups.map(([name, idx]) => (
          <section key={name} className="jp-table-wrap">
            {name && (
              <h3>
                {name}
                <span className="muted">
                  {idx.filter((i) => found.has(i)).length}/{idx.length}
                </span>
              </h3>
            )}
            <div className={quiz.hint ? 'jp-table' : 'jp-cells'}>
              {quiz.hint && (
                <div className="jp-row jp-row-head">
                  <span>{quiz.hint}</span>
                  <span>{quiz.answer}</span>
                </div>
              )}
              {idx.map((i) => {
                const row = quiz.rows[i]
                const ok = found.has(i)
                const shown = ok || phase === 'done'
                const cls = ok ? (fresh.has(i) ? 'jp-ans ok new' : 'jp-ans ok') : phase === 'done' ? 'jp-ans missed' : 'jp-ans'
                return quiz.hint ? (
                  <div key={i} className="jp-row">
                    <span className="jp-hint">{row.hint}</span>
                    <span className={cls}>{shown ? row.answer : ''}</span>
                  </div>
                ) : (
                  <span key={i} className={cls}>
                    {shown ? row.answer : ''}
                  </span>
                )
              })}
            </div>
          </section>
        ))}
      </main>
      {toast && <div className="toast-copy">{toast}</div>}
    </div>
  )
}

const HELP = [msg('France ; Paris'), msg('Japon ; Tokyo ; Tōkyō'), msg('États-Unis ; Washington ; Washington DC')]

function QuizEditor({ id }: { id: string | null }) {
  const mine = useMemo(() => loadMine(), [])
  const editing = id ? mine.find((q) => q.id === id) ?? null : null
  const [title, setTitle] = useState(editing?.title ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [category, setCategory] = useState(editing?.category ?? 'Divers')
  const [tags, setTags] = useState(editing?.tags.join(', ') ?? '')
  const [mins, setMins] = useState(editing ? Math.max(1, Math.round(editing.time / 60)) : 5)
  const [hintLabel, setHintLabel] = useState(editing?.hint ?? '')
  const [answerLabel, setAnswerLabel] = useState(editing?.answer ?? t('Réponse'))
  const [text, setText] = useState(editing ? formatAnswers(editing.rows) : '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const rows = useMemo(() => parseAnswers(text), [text])
  const withHints = rows.some((r) => r.hint)
  const errors = [!title.trim() && t('Donne un titre à ton quiz.'), rows.length < 2 && t('Il faut au moins deux réponses.')].filter(Boolean) as string[]

  function save() {
    if (errors.length) return
    const quiz = validateQuiz({
      id: editing?.id ?? `u-${Date.now().toString(36)}`,
      title,
      description,
      category,
      tags: tags.split(',').map((tag) => tag.trim()),
      time: mins * 60,
      hint: withHints ? hintLabel || t('Indice') : undefined,
      answer: answerLabel || t('Réponse'),
      rows,
      author: loadProfile().name || undefined,
    })
    if (!quiz) return
    saveMine(editing ? mine.map((q) => (q.id === quiz.id ? quiz : q)) : [quiz, ...mine])
    go(`/jetpunk/q/${quiz.id}`)
  }

  function remove() {
    saveMine(mine.filter((q) => q.id !== editing!.id))
    go('/jetpunk?cat=mine')
  }

  return (
    <div className="jp">
      <Bar active="creer" />
      <main className="jp-main jp-editor">
        <header className="jp-quiz-head">
          <span className="ui-label">{editing ? t('Modifier') : t('Nouveau quiz')}</span>
          <h1>{editing ? editing.title : t('Créer un quiz')}</h1>
          <p className="muted">{t('Un titre, une liste de réponses, une durée : c’est prêt à jouer et à partager.')}</p>
        </header>

        <div className="jp-form">
          <label className="ui-field">
            <span>{t('Titre')}</span>
            <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder={t('Les capitales d’Europe')} />
          </label>
          <label className="ui-field">
            <span>{t('Description')}</span>
            <input value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} placeholder={t('Une phrase pour donner envie')} />
          </label>
          <div className="jp-form-row">
            <label className="ui-field">
              <span>{t('Catégorie')}</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(c)}
                  </option>
                ))}
              </select>
            </label>
            <label className="ui-field">
              <span>{t('Durée (minutes)')}</span>
              <input type="number" min={1} max={60} value={mins} onChange={(e) => setMins(Math.min(60, Math.max(1, Number(e.target.value) || 1)))} />
            </label>
          </div>
          <label className="ui-field">
            <span>{t('Mots-clés (séparés par des virgules)')}</span>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t('Europe, villes, géographie')} />
          </label>
          <div className="jp-form-row">
            <label className="ui-field">
              <span>{t('Colonne des indices')}</span>
              <input value={hintLabel} maxLength={40} onChange={(e) => setHintLabel(e.target.value)} placeholder={t('Pays')} disabled={!withHints} />
            </label>
            <label className="ui-field">
              <span>{t('Colonne des réponses')}</span>
              <input value={answerLabel} maxLength={40} onChange={(e) => setAnswerLabel(e.target.value)} placeholder={t('Capitale')} />
            </label>
          </div>
          <label className="ui-field">
            <span>{t('Réponses, une par ligne')}</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder={HELP.map((line) => t(line)).join('\n')} spellCheck={false} />
          </label>
          <p className="ui-note">
            {tx('Écris {pair} pour afficher un indice, ou juste {single}. Les variantes acceptées se mettent après, séparées par {sep} : {example}. Majuscules, accents et articles ne comptent pas.', {
              pair: <code>{t('indice ; réponse')}</code>,
              single: <code>{t('réponse')}</code>,
              sep: <code>/</code>,
              example: <code>{t(HELP[1])}</code>,
            })}
          </p>
        </div>

        <section className="jp-table-wrap">
          <h3>
            {t('Aperçu')}
            <span className="muted">{plural(rows.length, '{n} réponse', '{n} réponses')}</span>
          </h3>
          {rows.length ? (
            <div className={withHints ? 'jp-table' : 'jp-cells'}>
              {withHints && (
                <div className="jp-row jp-row-head">
                  <span>{hintLabel || t('Indice')}</span>
                  <span>{answerLabel || t('Réponse')}</span>
                </div>
              )}
              {rows.slice(0, 24).map((r, i) =>
                withHints ? (
                  <div key={i} className="jp-row">
                    <span className="jp-hint">{r.hint}</span>
                    <span className="jp-ans ok">
                      {r.answer}
                      {r.alts && <small> · {r.alts.join(', ')}</small>}
                    </span>
                  </div>
                ) : (
                  <span key={i} className="jp-ans ok">
                    {r.answer}
                  </span>
                ),
              )}
            </div>
          ) : (
            <p className="muted">{t('Les réponses apparaîtront ici au fil de ta saisie.')}</p>
          )}
        </section>

        <div className="jp-editor-actions">
          {errors.map((e) => (
            <p key={e} className="jp-error">
              {e}
            </p>
          ))}
          <button className="ui-btn" onClick={save} disabled={errors.length > 0}>
            {editing ? t('Enregistrer') : t('Créer et jouer')}
          </button>
          {editing &&
            (confirmDelete ? (
              <span className="ui-confirm">
                <span>{t('Supprimer ce quiz pour de bon ?')}</span>
                <button className="danger" onClick={remove}>
                  {t('Oui, supprimer')}
                </button>
                <button onClick={() => setConfirmDelete(false)}>{t('Annuler')}</button>
              </span>
            ) : (
              <button className="ui-btn line" onClick={() => setConfirmDelete(true)}>
                {t('Supprimer')}
              </button>
            ))}
        </div>
      </main>
    </div>
  )
}

export default function JetPunk({ segments, params }: { segments: string[]; params: URLSearchParams }) {
  const [, view, id] = segments
  if (view === 'creer') return <QuizEditor id={params.get('id')} />
  if (view === 'partage') {
    const quiz = decodeQuiz(params.get('d') ?? '')
    return quiz ? <QuizPlay quiz={quiz} shared /> : <Missing text={t('Ce lien de quiz est incomplet ou abîmé.')} />
  }
  if (view === 'q') {
    const quiz = [...loadMine(), ...builtInQuizzes()].find((q) => q.id === id)
    return quiz ? <QuizPlay quiz={quiz} /> : <Missing text={t('Ce quiz n’existe pas ou a été supprimé.')} />
  }
  return <QuizList params={params} />
}

function Missing({ text }: { text: string }) {
  return (
    <div className="jp">
      <Bar active={null} />
      <main className="jp-main">
        <div className="jp-empty">
          <p>{text}</p>
          <a className="ui-btn" href="#/jetpunk">
            {t('Voir tous les quiz')}
          </a>
        </div>
      </main>
    </div>
  )
}
