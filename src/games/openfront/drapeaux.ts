// Les drapeaux d'OpenFront (© OpenFront and Contributors, CC BY-SA 4.0, voir drapeaux/LICENSE.md) : ceux des pays,
// et ceux des nations des cartes qui n'en ont pas. Chacun se charge la première fois qu'on l'affiche.
import { flagEmoji } from '../../geo/countries'

const FILES = import.meta.glob<string>('./drapeaux/*.svg', { eager: true, query: '?url', import: 'default' })

// le code d'un pays (« FR ») ou le nom de fichier d'un drapeau de carte (« Kingdom of Sardinia »)
export const isCountry = (code: string) => /^[a-z]{2}$/i.test(code)

export const flagUrl = (code: string): string | undefined => FILES[`./drapeaux/${isCountry(code) ? code.toLowerCase() : code}.svg`]

const images = new Map<string, HTMLImageElement>()

// L'image d'un drapeau, prête à dessiner ; null tant qu'elle se charge ou quand le drapeau n'existe pas.
export function flagImage(code: string): HTMLImageElement | null {
  const url = code && flagUrl(code)
  if (!url) return null
  let image = images.get(url)
  if (!image) {
    image = new Image()
    image.src = url
    images.set(url, image)
  }
  return image.complete && image.naturalWidth ? image : null
}

// à défaut d'image, l'émoji du pays ; rien pour un drapeau de carte
export const flagText = (code: string) => (isCountry(code) ? flagEmoji(code.toUpperCase()) : '')
