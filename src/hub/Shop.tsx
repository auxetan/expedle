// La boutique d'Expedle : on y dépense les pépites gagnées dans tous les jeux, comme des robux, pour des avatars,
// l'édition dorée de l'icône de chaque jeu et les motifs de territoire de Frontières.
import { useState } from 'react'
import { PROFILE_CHANGED, pushProfile } from '../lib/cloud'
import { feedback } from '../lib/feedback'
import { fmt, msg, t } from '../lib/i18n'
import { load, save } from '../lib/util'
import { buy, LEVEL_PEPITES, TIER_PEPITES } from '../lib/wallet'
import SkinPreview from '../games/openfront/SkinPreview'
import { skinById } from '../games/openfront/progress'
import AppBar from '../ui/AppBar'
import GameIcon from '../ui/GameIcon'
import { loadProfile } from '../ui/Panels'
import { Pepites, useWallet } from '../ui/Pepites'
import { ITEMS, type ShopItem } from '../ui/shop'
import './shop.css'

const SECTIONS: { kind: ShopItem['kind']; title: string; note: string }[] = [
  { kind: 'avatar', title: msg('Avatars'), note: msg('Pour ton profil, dans tout Expedle') },
  { kind: 'icone', title: msg('Icônes dorées'), note: msg('L’édition or de chaque jeu, sur l’accueil et dans les menus') },
  { kind: 'motif', title: 'Frontières', note: msg('Les motifs de ton territoire') },
]

export default function Shop() {
  const wallet = useWallet()
  // l'objet dont on confirme l'achat d'un second clic
  const [buying, setBuying] = useState('')
  const [avatar, setAvatar] = useState(() => loadProfile().avatar)
  const [skin, setSkin] = useState(() => load('openfront-motif', 'uni'))

  // un objet acheté se porte aussitôt : l'avatar sur le profil, le motif sur le territoire
  function use(item: ShopItem) {
    if (item.kind === 'avatar') {
      const next = { ...loadProfile(), avatar: item.value }
      save('profile', next)
      pushProfile(next)
      window.dispatchEvent(new Event(PROFILE_CHANGED))
      setAvatar(item.value)
    } else if (item.kind === 'motif') {
      save('openfront-motif', item.value)
      setSkin(item.value)
    }
  }

  function pick(item: ShopItem) {
    if (wallet.owned.has(item.id)) return use(item)
    if (buying !== item.id) return setBuying(item.id)
    setBuying('')
    if (!buy(item.id, item.price)) return
    feedback('good')
    use(item)
  }

  const worn = (item: ShopItem) => (item.kind === 'avatar' ? avatar === item.value : item.kind === 'motif' ? skin === item.value : wallet.owned.has(item.id))

  return (
    <div className="home">
      <AppBar title={t('Boutique')} />
      <main className="home-main shop-main">
        <section className="shop-hero">
          <Pepites n={wallet.balance} size={30} />
          <p className="muted">
            {t('Les pépites sont la monnaie d’Expedle. Chaque partie en rapporte de 2 à 17 selon ton score, chaque succès de {bronze} à {or}, chaque niveau {level}. Elles se dépensent ici, pour tous les jeux.', {
              bronze: TIER_PEPITES.bronze,
              or: TIER_PEPITES.or,
              level: LEVEL_PEPITES,
            })}
          </p>
        </section>
        {SECTIONS.map((section) => (
          <section key={section.kind} className="shop-group">
            <h2>
              {t(section.title)} <small>{t(section.note)}</small>
            </h2>
            <div className={`shop-grid ${section.kind}`}>
              {ITEMS.filter((i) => i.kind === section.kind).map((item) => {
                const mine = wallet.owned.has(item.id)
                const short = !mine && wallet.balance < item.price
                return (
                  <button
                    key={item.id}
                    className={worn(item) ? 'on' : buying === item.id ? 'confirm' : ''}
                    disabled={short}
                    title={short ? t('Il te manque {n} pépites', { n: fmt(item.price - wallet.balance) }) : undefined}
                    onClick={() => pick(item)}
                  >
                    {item.kind === 'avatar' && <span className="shop-emoji">{item.value}</span>}
                    {item.kind === 'icone' && <GameIcon icon={item.value} size={56} golden />}
                    {item.kind === 'motif' && <SkinPreview skin={skinById(item.value)} />}
                    {item.kind !== 'avatar' && <b>{item.kind === 'motif' ? t(item.name) : item.name}</b>}
                    <small>
                      {worn(item)
                        ? item.kind === 'icone'
                          ? t('Dorée')
                          : t('Porté')
                        : mine
                          ? t('Porter')
                          : buying === item.id
                            ? t('Acheter ?')
                            : <Pepites n={item.price} />}
                    </small>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}
