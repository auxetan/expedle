import { normalize } from '../../lib/util'

// Zone de lecture automatique d'un passeport (format ICAO 9303, deux lignes de 44 caractères), pour la page
// d'identité : les chiffres de contrôle sont calculés comme sur un vrai document.

const VALUE = (c: string) => (c === '<' ? 0 : /\d/.test(c) ? Number(c) : c.charCodeAt(0) - 55)

export function checkDigit(text: string): string {
  const weights = [7, 3, 1]
  return String([...text].reduce((sum, c, i) => sum + VALUE(c) * weights[i % 3], 0) % 10)
}

// Lettres sans accents, espaces et signes remplacés par « < », comme l'exige le format.
export function mrzText(text: string): string {
  return normalize(text).toUpperCase().replace(/[^A-Z0-9]+/g, '<').replace(/^<+|<+$/g, '')
}

const fit = (text: string, length: number) => (text + '<'.repeat(length)).slice(0, length)

export const yymmdd = (d: Date) => `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`

export function mrz(o: { surname: string; given: string; number: string; issued: Date; expires: Date; country: string; personal: string }): [string, string] {
  const line1 = fit(`P<${o.country}${mrzText(o.surname)}<<${mrzText(o.given)}`, 44)
  const number = fit(mrzText(o.number), 9)
  const personal = fit(mrzText(o.personal), 14)
  const birth = yymmdd(o.issued)
  const expiry = yymmdd(o.expires)
  const parts = [number, checkDigit(number), o.country, birth, checkDigit(birth), '<', expiry, checkDigit(expiry), personal, checkDigit(personal)]
  const body = parts.join('')
  // contrôle final sur le numéro, la date de « naissance », l'expiration et les données personnelles
  const composite = checkDigit(number + checkDigit(number) + birth + checkDigit(birth) + expiry + checkDigit(expiry) + personal + checkDigit(personal))
  return [line1, body + composite]
}
