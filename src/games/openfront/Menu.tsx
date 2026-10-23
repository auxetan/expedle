// L'accueil de Frontières, sur le modèle de celui d'OpenFront : jouer seul ou en ligne, régler ses touches,
// suivre son niveau et ses statistiques, choisir le motif de son territoire.
import { useEffect, useRef, useState } from 'react'
import { fmt, msg, t } from '../../lib/i18n'
import { plays } from '../../lib/stats'
import { formatTime, load, save } from '../../lib/util'
import { KEY_GROUPS, keyName, loadKeys, rebind, saveKeys, type Action } from './keys'
import { rankOf, SKINS, tallyOf, xpOf, type Skin } from './progress'

type Tab = 'jouer' | 'touches' | 'stats' | 'boutique'

const TABS: [Tab, string][] = [
  ['jouer', msg('Jouer')],
  ['touches', msg('Touches')],
  ['stats', msg('Statistiques')],
  ['boutique', msg('Boutique')],
]

export const loadSkin = () => load<string>('openfront-motif', 'uni')

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

export default function Menu({ name, onSolo, onMulti, multi }: { name: string; onSolo: () => void; onMulti: () => void; multi: boolean }) {
  const [tab, setTab] = useState<Tab>('jouer')
  const [list] = useState(plays)
  const [skin, setSkin] = useState(loadSkin)
  const rank = rankOf(xpOf(list))
  const tally = tallyOf(list)

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
          <button onClick={onMulti} disabled={!multi}>
            <b>{t('Multijoueur')}</b>
            <small>{multi ? t('Avec tes amis, grâce à un code') : t('Indisponible : le site n’est pas relié à son serveur')}</small>
          </button>
        </div>
      )}
      {tab === 'touches' && <KeysPanel />}
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
        <div className="of-skins">
          {SKINS.map((s) => {
            const locked = s.level > rank.level
            return (
              <button
                key={s.id}
                className={skin === s.id ? 'on' : ''}
                disabled={locked}
                aria-pressed={skin === s.id}
                onClick={() => {
                  setSkin(s.id)
                  save('openfront-motif', s.id)
                }}
              >
                <SkinPreview skin={s} />
                <b>{t(s.name)}</b>
                <small>{locked ? t('Niveau {n}', { n: s.level }) : skin === s.id ? t('Porté') : t('Porter')}</small>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
