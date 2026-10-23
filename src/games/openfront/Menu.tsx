// L'accueil de Frontières, sur le modèle de celui d'OpenFront : jouer seul, en public ou entre amis, régler le son
// et les touches, suivre son niveau et ses statistiques, dépenser ses capsules en motifs de territoire.
import { useEffect, useRef, useState } from 'react'
import { feedbackSettings } from '../../lib/feedback'
import { fmt, msg, t } from '../../lib/i18n'
import { plays } from '../../lib/stats'
import { formatTime, save } from '../../lib/util'
import { ICON } from './icons'
import { KEY_GROUPS, keyName, loadKeys, rebind, saveKeys, type Action } from './keys'
import { Directory, joinable, PUBLIC_MAX, type Listing } from './net'
import { balanceOf, loadOwned, loadSkin, rankOf, SKINS, tallyOf, xpOf, type Skin } from './progress'
import { Glyph } from './RadialMenu'
import type { SalonKind } from './Salon'
import { loadVolumes, play, setVolumes, type Cue, type Volumes } from './sounds'

type Tab = 'jouer' | 'reglages' | 'stats' | 'boutique'

const TABS: [Tab, string][] = [
  ['jouer', msg('Jouer')],
  ['reglages', msg('Réglages')],
  ['stats', msg('Statistiques')],
  ['boutique', msg('Boutique')],
]

// Le solde de capsules, avec l'icône d'OpenFront.
export function Caps({ n }: { n: number }) {
  return (
    <span className="of-caps">
      <Glyph src={ICON.capsule} size={14} />
      {fmt(n)}
    </span>
  )
}

// Un aperçu du motif, peint aux couleurs du thème.
function SkinPreview({ skin }: { skin: Skin }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current!
    const style = getComputedStyle(canvas)
    const ctx = canvas.getContext('2d')!
    const cell = 3
    for (let y = 0; y < canvas.height / cell; y++)
      for (let x = 0; x < canvas.width / cell; x++) {
        ctx.fillStyle = style.getPropertyValue(skin.at(x, y) ? '--muted' : '--fg')
        ctx.fillRect(x * cell, y * cell, cell, cell)
      }
  }, [skin])
  return <canvas ref={ref} width={96} height={54} aria-hidden />
}

// chaque voie, avec le son qui la fait entendre, comme les boutons d'essai d'OpenFront
const CHANNELS: [keyof Volumes, string, Cue | null][] = [
  ['general', msg('Volume général'), 'build-city'],
  ['effets', msg('Effets'), 'build-city'],
  ['alertes', msg('Alertes'), 'nuke-warning'],
  ['interface', msg('Interface'), 'click'],
  ['ambiance', msg('Ambiance des bâtiments'), null],
]

export function SoundPanel() {
  const [volumes, set] = useState(loadVolumes)
  return (
    <section className="of-sound">
      <h4>{t('Son')}</h4>
      {!feedbackSettings().sound && <p className="of-hint">{t('Le son est coupé dans les réglages du site.')}</p>}
      {CHANNELS.map(([channel, label, cue]) => (
        <label key={channel}>
          <span>{t(label)}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(volumes[channel] * 100)}
            onChange={(e) => {
              const next = { ...volumes, [channel]: Number(e.target.value) / 100 }
              set(next)
              setVolumes(next)
              play('slider')
            }}
          />
          {cue ? (
            <button type="button" onClick={() => play(cue)}>
              {t('Tester')}
            </button>
          ) : (
            <span />
          )}
        </label>
      ))}
    </section>
  )
}

// La prochaine partie publique, suivie en direct : joueurs et compte à rebours, comme la carte d'OpenFront.
function usePublicGame(enabled: boolean): Listing | null | undefined {
  const [next, setNext] = useState<Listing | null | undefined>(undefined)
  useEffect(() => {
    if (!enabled) return
    let directory: Directory | null = null
    let unwatch = () => {}
    let gone = false
    const pick = (list: Listing[]) => setNext(joinable(list, Date.now()) ?? null)
    Directory.open()
      .then((d) => {
        if (gone) return d.release()
        directory = d
        unwatch = d.watch(pick)
        void d.ready().then(() => pick(d.listings))
      })
      .catch(() => setNext(null))
    return () => {
      gone = true
      unwatch()
      directory?.release()
    }
  }, [enabled])
  return next
}

function KeysPanel() {
  const [keys, setKeys] = useState(loadKeys)
  const [waiting, setWaiting] = useState<Action | null>(null)

  // la prochaine touche pressée devient celle de l'action choisie ; Échap annule
  useEffect(() => {
    if (!waiting) return
    const pick = (e: KeyboardEvent) => {
      e.preventDefault()
      if (e.code !== 'Escape') {
        const next = rebind(keys, waiting, e.code)
        setKeys(next)
        saveKeys(next)
      }
      setWaiting(null)
    }
    window.addEventListener('keydown', pick)
    return () => window.removeEventListener('keydown', pick)
  }, [waiting, keys])

  return (
    <div className="of-keys-list">
      {KEY_GROUPS.map((group) => (
        <section key={group.title}>
          <h4>{t(group.title)}</h4>
          {group.actions.map(([action, label]) => (
            <button key={action} className={waiting === action ? 'on' : ''} onClick={() => setWaiting(waiting === action ? null : action)}>
              <span>{t(label)}</span>
              <kbd>{waiting === action ? t('Touche…') : keyName(keys[action])}</kbd>
            </button>
          ))}
        </section>
      ))}
      <button
        className="of-reset"
        onClick={() => {
          localStorage.removeItem('cg:openfront-touches')
          setKeys(loadKeys())
        }}
      >
        {t('Touches d’origine')}
      </button>
    </div>
  )
}

export default function Menu({ name, onSolo, onMulti, multi }: { name: string; onSolo: () => void; onMulti: (kind: SalonKind) => void; multi: boolean }) {
  const [tab, setTab] = useState<Tab>('jouer')
  const [list] = useState(plays)
  const [skin, setSkin] = useState(loadSkin)
  const [owned, setOwned] = useState(loadOwned)
  // le motif dont on confirme l'achat
  const [buying, setBuying] = useState('')
  const [now, setNow] = useState(Date.now)
  const rank = rankOf(xpOf(list))
  const tally = tallyOf(list)
  const caps = balanceOf(list, owned)
  const next = usePublicGame(multi && tab === 'jouer')

  useEffect(() => {
    if (!next) return
    const id = window.setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [next])

  function wear(id: string) {
    setSkin(id)
    save('openfront-motif', id)
  }

  return (
    <div className="of-home">
      <header>
        <h2>Frontières</h2>
        <small>{t('D’après OpenFront')} · © OpenFront and Contributors</small>
      </header>
      <div className="of-rankline">
        <b>{name}</b>
        <span>{t('Niveau {n}', { n: rank.level })}</span>
        <span className="of-xp" role="progressbar" aria-valuemin={0} aria-valuemax={rank.need} aria-valuenow={rank.into}>
          <i style={{ width: `${(rank.into / rank.need) * 100}%` }} />
        </span>
        <small>{t('{n} / {max} pts', { n: rank.into, max: rank.need })}</small>
        <Caps n={caps} />
      </div>
      <nav className="of-tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {t(label)}
          </button>
        ))}
      </nav>
      {tab === 'jouer' && (
        <div className="of-play">
          <button className="primary" onClick={onSolo}>
            <b>{t('Solo')}</b>
            <small>{t('Contre des nations et des bots')}</small>
          </button>
          <button onClick={() => onMulti('public')} disabled={!multi}>
            <b>{t('Partie publique')}</b>
            <small>
              {!multi
                ? t('Indisponible : le site n’est pas relié à son serveur')
                : next
                  ? t('{n} / {max} joueurs · départ dans {time}', { n: next.players, max: PUBLIC_MAX, time: formatTime(Math.max(0, next.startsAt - now)) })
                  : next === null
                    ? t('Aucune partie en attente : lance la prochaine')
                    : t('Recherche des parties en attente…')}
            </small>
          </button>
          <button onClick={() => onMulti('prive')} disabled={!multi}>
            <b>{t('Avec des amis')}</b>
            <small>{multi ? t('Un salon privé, rejoint grâce à un code') : t('Indisponible : le site n’est pas relié à son serveur')}</small>
          </button>
        </div>
      )}
      {tab === 'reglages' && (
        <div className="of-settings">
          <SoundPanel />
          <KeysPanel />
        </div>
      )}
      {tab === 'stats' && (
        <dl className="of-stats">
          <dt>{t('Parties')}</dt>
          <dd>{tally.games}</dd>
          <dt>{t('Victoires')}</dt>
          <dd>{tally.wins}</dd>
          <dt>{t('Meilleure part des terres')}</dt>
          <dd>{fmt(tally.best)} %</dd>
          <dt>{t('Part moyenne')}</dt>
          <dd>{fmt(tally.average)} %</dd>
          <dt>{t('Temps de jeu')}</dt>
          <dd>{formatTime(tally.ms)}</dd>
          <dt>{t('Parties en ligne')}</dt>
          <dd>{tally.multi}</dd>
          <dt>{t('Points')}</dt>
          <dd>{rank.xp}</dd>
        </dl>
      )}
      {tab === 'boutique' && (
        <>
          <p className="of-hint">{t('Chaque partie rapporte des capsules, une victoire bien plus, et chaque niveau gagné en offre cent.')}</p>
          <div className="of-skins">
            {SKINS.map((s) => {
              const mine = s.price === 0 || owned.includes(s.id)
              const short = !mine && caps < s.price
              return (
                <button
                  key={s.id}
                  className={skin === s.id ? 'on' : buying === s.id ? 'confirm' : ''}
                  disabled={short}
                  aria-pressed={skin === s.id}
                  onClick={() => {
                    if (mine) return wear(s.id)
                    // un achat se confirme d'un second clic, comme sur OpenFront
                    if (buying !== s.id) return setBuying(s.id)
                    const next = [...owned, s.id]
                    setOwned(next)
                    save('openfront-achats', next)
                    setBuying('')
                    play('ka-ching')
                    wear(s.id)
                  }}
                >
                  <SkinPreview skin={s} />
                  <b>{t(s.name)}</b>
                  <small>{skin === s.id ? t('Porté') : mine ? t('Porter') : buying === s.id ? t('Acheter ?') : <Caps n={s.price} />}</small>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
