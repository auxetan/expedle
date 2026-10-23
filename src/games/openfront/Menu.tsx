// L'accueil de Frontières, sur le modèle de celui d'OpenFront : son nom posé sur son motif de territoire, la
// prochaine partie publique en grand, puis le solo et les salons privés ; le son, les touches, les statistiques,
// et la boutique où l'on dépense ses pépites, la monnaie d'Expedle, en motifs de territoire.
import { useEffect, useState } from 'react'
import { feedbackSettings } from '../../lib/feedback'
import { fmt, msg, t } from '../../lib/i18n'
import { plays } from '../../lib/stats'
import { formatTime, save } from '../../lib/util'
import { buy } from '../../lib/wallet'
import { Pepites, useWallet } from '../../ui/Pepites'
import { KEY_GROUPS, keyName, loadKeys, rebind, saveKeys, type Action } from './keys'
import { Directory, joinable, PUBLIC_MAX, type Listing } from './net'
import { loadSkin, rankOf, skinById, SKINS, tallyOf, xpOf, type Skin } from './progress'
import type { SalonKind } from './Salon'
import SkinPreview from './SkinPreview'
import { loadVolumes, play, setVolumes, type Cue, type Volumes } from './sounds'

type Tab = 'jouer' | 'reglages' | 'stats' | 'boutique'

const TABS: [Tab, string][] = [
  ['jouer', msg('Jouer')],
  ['reglages', msg('Réglages')],
  ['stats', msg('Statistiques')],
  ['boutique', msg('Boutique')],
]

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

const GROUPS: [Skin['group'], string][] = [
  ['classique', msg('Classiques')],
  ['drole', msg('Drôles')],
]

export default function Menu({ name, onSolo, onMulti, multi }: { name: string; onSolo: () => void; onMulti: (kind: SalonKind) => void; multi: boolean }) {
  const [tab, setTab] = useState<Tab>('jouer')
  const [list] = useState(plays)
  const [skin, setSkin] = useState(loadSkin)
  const wallet = useWallet()
  // le motif dont on confirme l'achat
  const [buying, setBuying] = useState('')
  const [now, setNow] = useState(Date.now)
  const rank = rankOf(xpOf(list))
  const tally = tallyOf(list)
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

  function purchase(s: Skin) {
    setBuying('')
    if (!buy(`motif:${s.id}`, s.price)) return
    play('ka-ching')
    wear(s.id)
  }

  return (
    <div className="of-home">
      <header>
        <h2>Frontières</h2>
        <small>{t('D’après OpenFront')} · © OpenFront and Contributors</small>
      </header>
      {/* comme sur OpenFront, ton nom se pose sur le motif que portera ton territoire */}
      <section className="of-identity">
        <SkinPreview skin={skinById(skin)} width={600} height={96} />
        <div>
          <span className="of-who">
            <b>{name}</b>
            <small>
              {t('Niveau {n}', { n: rank.level })} · {t('{n} / {max} pts', { n: rank.into, max: rank.need })}
            </small>
          </span>
          <span className="of-xp" role="progressbar" aria-valuemin={0} aria-valuemax={rank.need} aria-valuenow={rank.into}>
            <i style={{ width: `${(rank.into / rank.need) * 100}%` }} />
          </span>
          <button className="of-wallet" onClick={() => setTab('boutique')} aria-label={t('Boutique')}>
            <Pepites n={wallet.balance} size={16} />
          </button>
        </div>
      </section>
      <nav className="of-tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {t(label)}
          </button>
        ))}
      </nav>
      {tab === 'jouer' && (
        <div className="of-play">
          {multi ? (
            // la prochaine partie publique en grand, comme la carte d'OpenFront
            <button className="of-featured" onClick={() => onMulti('public')}>
              <span>
                <b>{t('Partie publique')}</b>
                <small>{t('Carte du monde · jusqu’à {max} joueurs', { max: PUBLIC_MAX })}</small>
              </span>
              <span className="of-featured-time">
                {next ? (
                  <>
                    <b>{formatTime(Math.max(0, next.startsAt - now))}</b>
                    <small>{t('{n} / {max} joueurs', { n: next.players, max: PUBLIC_MAX })}</small>
                  </>
                ) : (
                  <small>{next === null ? t('Lance la prochaine') : t('Recherche…')}</small>
                )}
              </span>
            </button>
          ) : (
            <button className="of-featured" onClick={onSolo}>
              <span>
                <b>{t('Solo')}</b>
                <small>{t('Contre des nations et des bots')}</small>
              </span>
            </button>
          )}
          <div className="of-modes">
            {multi && (
              <button onClick={onSolo}>
                <b>{t('Solo')}</b>
                <small>{t('Contre des nations et des bots')}</small>
              </button>
            )}
            <button onClick={() => onMulti('creer')} disabled={!multi}>
              <b>{t('Créer un salon')}</b>
              <small>{t('Tu choisis les réglages')}</small>
            </button>
            <button onClick={() => onMulti('rejoindre')} disabled={!multi}>
              <b>{t('Rejoindre un salon')}</b>
              <small>{t('Avec le code d’un ami')}</small>
            </button>
          </div>
          {!multi && <p className="of-hint">{t('Multijoueur indisponible : le site n’est pas relié à son serveur.')}</p>}
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
        <div className="of-shop">
          <p className="of-balance">
            <Pepites n={wallet.balance} size={20} />
            <small>
              {t('Les pépites se gagnent dans tous les jeux d’Expedle et se dépensent ici comme dans la boutique du site.')}{' '}
              <a href="#/boutique">{t('Voir la boutique')}</a>
            </small>
          </p>
          {GROUPS.map(([group, title]) => (
            <section key={group}>
              <h4>{t(title)}</h4>
              <div className="of-skins">
                {SKINS.filter((s) => s.group === group).map((s) => {
                  const mine = s.price === 0 || wallet.owned.has(`motif:${s.id}`)
                  const short = !mine && wallet.balance < s.price
                  return (
                    <button
                      key={s.id}
                      className={skin === s.id ? 'on' : buying === s.id ? 'confirm' : ''}
                      disabled={short}
                      title={short ? t('Il te manque {n} pépites', { n: fmt(s.price - wallet.balance) }) : undefined}
                      aria-pressed={skin === s.id}
                      onClick={() => {
                        if (mine) return wear(s.id)
                        // un achat se confirme d'un second clic, comme sur OpenFront
                        if (buying !== s.id) return setBuying(s.id)
                        purchase(s)
                      }}
                    >
                      <SkinPreview skin={s} />
                      <b>{t(s.name)}</b>
                      <small>{skin === s.id ? t('Porté') : mine ? t('Porter') : buying === s.id ? t('Acheter ?') : <Pepites n={s.price} />}</small>
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
