import { useEffect, useRef, useState, type ReactNode } from 'react'
import { PROFILE_CHANGED } from '../lib/cloud'
import { t } from '../lib/i18n'
import Logo from './Logo'
import { Drawer, GamesPanel, Icon, ICONS, loadProfile, ProfilePanel } from './Panels'
import { WalletChip } from './Pepites'
import './ui.css'

// « reglages » : le menu Profil, ouvert directement sur les réglages
type Panel = 'jeux' | 'profil' | 'reglages' | null

interface Props {
  title?: string
  home?: boolean
  // les réglages propres au jeu : un ⚙ dans la barre y mène, et ils passent en tête des réglages du menu Profil
  settings?: ReactNode
  tools?: ReactNode
  children?: ReactNode
}

export default function AppBar({ title, home = false, settings, tools, children }: Props) {
  const [panel, setPanel] = useState<Panel>(null)
  const [avatar, setAvatar] = useState(() => loadProfile().avatar)
  const toggle = (p: Panel) => setPanel(panel === p ? null : p)
  const nav = useRef<HTMLElement>(null)

  const hash = window.location.hash

  useEffect(() => {
    const refresh = () => setAvatar(loadProfile().avatar)
    window.addEventListener(PROFILE_CHANGED, refresh)
    return () => window.removeEventListener(PROFILE_CHANGED, refresh)
  }, [])

  // l'onglet actif reste visible quand la sous-navigation défile sur mobile
  useEffect(() => {
    const el = nav.current
    const on = el?.querySelector<HTMLElement>('.on')
    if (el && on) el.scrollLeft = on.offsetLeft - (el.clientWidth - on.offsetWidth) / 2
  }, [hash])

  return (
    <>
      <header className="ui-bar">
        <div className="ui-bar-left">
          {home ? (
            <a href="#/" className="ui-brand">
              <Logo />
              <span>expedle</span>
            </a>
          ) : (
            <a href="#/" className="ui-back" aria-label={t('Accueil')}>
              <Icon d={ICONS.back} />
              <span>{t('Accueil')}</span>
            </a>
          )}
        </div>
        {title && <div className="ui-bar-title">{title}</div>}
        <div className="ui-bar-right">
          {tools}
          {settings && (
            <button className="ui-tool" onClick={() => toggle('reglages')} aria-label={t('Réglages de ce jeu')}>
              <Icon d={ICONS.settings} />
            </button>
          )}
          <WalletChip crowded={!!tools && !home} />
          <button className="ui-tool ui-menu" onClick={() => toggle('jeux')} aria-label={t('Tous les jeux')}>
            <Icon d={ICONS.menu} />
            <span>{t('Jeux')}</span>
          </button>
          <button className="ui-tool ui-avatar" onClick={() => toggle('profil')} aria-label={t('Profil')}>
            {avatar}
          </button>
        </div>
      </header>
      {children && (
        <nav className="ui-subnav" ref={nav}>
          {children}
        </nav>
      )}
      {panel && (
        <Drawer onClose={() => setPanel(null)}>
          {panel === 'jeux' ? (
            <GamesPanel onPick={() => setPanel(null)} />
          ) : (
            <ProfilePanel onChange={(p) => setAvatar(p.avatar)} onPick={() => setPanel(null)} extra={settings} focus={panel === 'reglages' ? 'reglages' : undefined} />
          )}
        </Drawer>
      )}
    </>
  )
}

export function SubLink({ href, active, children }: { href: string; active?: boolean; children: ReactNode }) {
  return (
    <a href={href} className={active ? 'on' : ''}>
      {children}
    </a>
  )
}
