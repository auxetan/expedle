import { useEffect, useRef, useState, type ReactNode } from 'react'
import { PROFILE_CHANGED } from '../lib/cloud'
import { t } from '../lib/i18n'
import Logo from './Logo'
import { Drawer, GamesPanel, Icon, ICONS, loadProfile, ProfilePanel, SettingsPanel } from './Panels'
import './ui.css'

type Panel = 'jeux' | 'reglages' | 'profil' | null

interface Props {
  title?: string
  home?: boolean
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
              <span>méridien</span>
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
          <button className="ui-tool" onClick={() => toggle('jeux')} aria-label={t('Tous les jeux')}>
            <Icon d={ICONS.menu} />
          </button>
          <button className="ui-tool" onClick={() => toggle('reglages')} aria-label={t('Réglages')}>
            <Icon d={ICONS.settings} />
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
          {panel === 'jeux' && <GamesPanel onPick={() => setPanel(null)} />}
          {panel === 'reglages' && <SettingsPanel extra={settings} />}
          {panel === 'profil' && <ProfilePanel onChange={(p) => setAvatar(p.avatar)} />}
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
