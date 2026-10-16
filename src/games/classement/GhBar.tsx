import AppBar, { SubLink } from '../../ui/AppBar'

const SUBNAV: [string, string][] = [
  ['#/classement', 'Accueil'],
  ['#/classement/classique', 'Classique'],
  ['#/classement/facile', 'Facile'],
  ['#/classement/monde', 'Monde'],
  ['#/classement/special', 'Spécial'],
  ['#/classement/villes', 'Villes'],
  ['#/classement/jour', 'Défi du jour'],
  ['#/classement/hebdo', 'Hebdo'],
]

export default function GhBar() {
  const current = window.location.hash.split('?')[0]
  return (
    <AppBar title="GeoHunter">
      {SUBNAV.map(([href, label]) => (
        <SubLink key={href} href={href} active={current === href}>
          {label}
        </SubLink>
      ))}
    </AppBar>
  )
}
