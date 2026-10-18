import AppBar, { SubLink } from '../../ui/AppBar'
import { msg, t } from '../../lib/i18n'

const SUBNAV: [string, string][] = [
  ['#/classement', msg('Accueil')],
  ['#/classement/classique', msg('Classique')],
  ['#/classement/facile', msg('Facile')],
  ['#/classement/monde', msg('Monde')],
  ['#/classement/special', msg('Spécial')],
  ['#/classement/villes', msg('Villes')],
  ['#/classement/jour', msg('Défi du jour')],
  ['#/classement/hebdo', msg('Hebdo')],
]

export default function GhBar() {
  const current = window.location.hash.split('?')[0]
  return (
    <AppBar title="GeoHunter">
      {SUBNAV.map(([href, label]) => (
        <SubLink key={href} href={href} active={current === href}>
          {t(label)}
        </SubLink>
      ))}
    </AppBar>
  )
}
