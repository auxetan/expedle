import { countryName } from '../../geo/countries'
import { CITY_STATS, COUNTRY_STATS } from '../classement/data'
import { QUESTIONS, WEIGHTS, type EstimateQuestion } from './estimates'
import { OBJECTS } from './items'

export interface BankEstimate extends EstimateQuestion {
  id: string
}

let bank: BankEstimate[] | null = null

export function estimationBank(): BankEstimate[] {
  if (bank) return bank
  const out: BankEstimate[] = []
  const add = (id: string, cat: string, q: string, unit: string, a: number) => {
    if (a > 0 && Number.isFinite(a)) out.push({ id, cat, q, unit, a })
  }

  QUESTIONS.forEach((x, i) => out.push({ ...x, id: `m${i}` }))

  for (const c of COUNTRY_STATS) {
    const n = countryName(c.code)
    add(`pop-${c.code}`, 'Population', `Combien d’habitants compte ce pays : ${n} ?`, 'habitants', Math.round(c.pop * 1e6))
    add(`area-${c.code}`, 'Superficie', `Quelle est la superficie de ce pays : ${n} ?`, 'km²', Math.round(c.area * 1000))
    add(`gdp-${c.code}`, 'Économie', `Quel est le PIB annuel de ce pays : ${n} ?`, 'milliards de $', c.gdp)
    add(`tour-${c.code}`, 'Tourisme', `Combien de touristes étrangers ce pays accueille-t-il par an : ${n} ?`, 'touristes', Math.round(c.tourists * 1e6))
    add(`peak-${c.code}`, 'Montagnes', `Quelle est l’altitude du point culminant de ce pays : ${n} ?`, 'mètres', c.peak)
    if (c.area > 0) add(`dens-${c.code}`, 'Population', `Combien d’habitants par km² compte ce pays : ${n} ?`, 'hab./km²', Math.round(c.pop * 1000 / c.area))
  }

  for (const c of CITY_STATS) {
    add(`cpop-${c.name}`, 'Villes', `Combien d’habitants compte l’agglomération de ${c.name} ?`, 'habitants', Math.round(c.pop * 1e6))
    add(`elev-${c.name}`, 'Villes', `À quelle altitude se trouve ${c.name} ?`, 'mètres', c.elev)
    add(`rain-${c.name}`, 'Climat', `Combien de millimètres de pluie tombent chaque année à ${c.name} ?`, 'mm', c.rain)
  }

  for (const o of OBJECTS) {
    const what = o.dim === 'h' ? 'la hauteur' : 'la longueur'
    const meters = o.cm >= 200
    add(`obj-${o.name}`, 'Tailles', `Quelle est ${what} de cet élément : ${o.name} (${o.detail}) ?`, meters ? 'mètres' : 'cm', meters ? o.cm / 100 : o.cm)
  }

  for (const w of WEIGHTS) add(`kg-${w.name}`, 'Poids', `Combien pèse cet élément : ${w.name}${w.detail ? ` (${w.detail})` : ''} ?`, 'kg', w.kg)

  bank = out
  return bank
}
