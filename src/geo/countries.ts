import { getLang, locale } from '../lib/i18n'
import { normalize } from '../lib/util'

export type Continent = 'EU' | 'AF' | 'AS' | 'NA' | 'SA' | 'OC' | 'AN'

export interface CountryMeta {
  code: string
  name: string
  continent: Continent
  capital: string
  aliases: string[]
  territory: boolean
}

// code|nom|continent|capitale|alias;alias|t (t = territoire non souverain)
const RAW = `AF|Afghanistan|AS|Kaboul
AX|Åland|EU|Mariehamn|Aland|t
AL|Albanie|EU|Tirana
DZ|Algérie|AF|Alger
AS|Samoa américaines|OC|Pago Pago||t
AD|Andorre|EU|Andorre-la-Vieille
AO|Angola|AF|Luanda
AI|Anguilla|NA|The Valley||t
AQ|Antarctique|AN|—|Antarctica|t
AG|Antigua-et-Barbuda|NA|Saint John's|Antigua
AR|Argentine|SA|Buenos Aires
AM|Arménie|AS|Erevan
AW|Aruba|NA|Oranjestad||t
AU|Australie|OC|Canberra
AT|Autriche|EU|Vienne
AZ|Azerbaïdjan|AS|Bakou
BS|Bahamas|NA|Nassau
BH|Bahreïn|AS|Manama
BD|Bangladesh|AS|Dacca
BB|Barbade|NA|Bridgetown
BY|Biélorussie|EU|Minsk|Bélarus
BE|Belgique|EU|Bruxelles
BZ|Belize|NA|Belmopan
BJ|Bénin|AF|Porto-Novo
BM|Bermudes|NA|Hamilton||t
BT|Bhoutan|AS|Thimphou
BO|Bolivie|SA|Sucre
BA|Bosnie-Herzégovine|EU|Sarajevo|Bosnie
BW|Botswana|AF|Gaborone
BR|Brésil|SA|Brasilia
IO|Territoire britannique de l'océan Indien|AS|—|Chagos|t
VG|Îles Vierges britanniques|NA|Road Town||t
BN|Brunei|AS|Bandar Seri Begawan
BG|Bulgarie|EU|Sofia
BF|Burkina Faso|AF|Ouagadougou
BI|Burundi|AF|Gitega
KH|Cambodge|AS|Phnom Penh
CM|Cameroun|AF|Yaoundé
CA|Canada|NA|Ottawa
CV|Cap-Vert|AF|Praia|Cabo Verde
KY|Îles Caïmans|NA|George Town|Caïmans|t
CF|République centrafricaine|AF|Bangui|Centrafrique;RCA
TD|Tchad|AF|N'Djaména
CL|Chili|SA|Santiago
CN|Chine|AS|Pékin
CO|Colombie|SA|Bogota
KM|Comores|AF|Moroni
CG|République du Congo|AF|Brazzaville|Congo;Congo-Brazzaville
CD|République démocratique du Congo|AF|Kinshasa|RDC;Congo-Kinshasa;Zaïre
CK|Îles Cook|OC|Avarua||t
CR|Costa Rica|NA|San José
CI|Côte d'Ivoire|AF|Yamoussoukro
HR|Croatie|EU|Zagreb
CU|Cuba|NA|La Havane
CW|Curaçao|NA|Willemstad||t
CY|Chypre|EU|Nicosie
CZ|Tchéquie|EU|Prague|République tchèque
DK|Danemark|EU|Copenhague
DJ|Djibouti|AF|Djibouti
DM|Dominique|NA|Roseau|Dominica
DO|République dominicaine|NA|Saint-Domingue
EC|Équateur|SA|Quito
EG|Égypte|AF|Le Caire
SV|Salvador|NA|San Salvador|El Salvador
GQ|Guinée équatoriale|AF|Malabo
ER|Érythrée|AF|Asmara
EE|Estonie|EU|Tallinn
SZ|Eswatini|AF|Mbabane|Swaziland
ET|Éthiopie|AF|Addis-Abeba
FK|Îles Malouines|SA|Stanley|Falklands;Malouines|t
FO|Îles Féroé|EU|Tórshavn|Féroé|t
FJ|Fidji|OC|Suva
FI|Finlande|EU|Helsinki
FR|France|EU|Paris
GF|Guyane|SA|Cayenne|Guyane française|t
PF|Polynésie française|OC|Papeete|Tahiti|t
TF|Terres australes françaises|AN|—|Kerguelen|t
GA|Gabon|AF|Libreville
GM|Gambie|AF|Banjul
GE|Géorgie|AS|Tbilissi
DE|Allemagne|EU|Berlin
GH|Ghana|AF|Accra
GR|Grèce|EU|Athènes
GL|Groenland|NA|Nuuk||t
GD|Grenade|NA|Saint-Georges
GP|Guadeloupe|NA|Basse-Terre||t
GU|Guam|OC|Hagåtña||t
GT|Guatemala|NA|Guatemala
GG|Guernesey|EU|Saint-Pierre-Port||t
GN|Guinée|AF|Conakry
GW|Guinée-Bissau|AF|Bissau
GY|Guyana|SA|Georgetown
HT|Haïti|NA|Port-au-Prince
HM|Îles Heard-et-MacDonald|AN|—||t
VA|Vatican|EU|Vatican|Saint-Siège
HN|Honduras|NA|Tegucigalpa
HK|Hong Kong|AS|Hong Kong||t
HU|Hongrie|EU|Budapest
IS|Islande|EU|Reykjavik
IN|Inde|AS|New Delhi
ID|Indonésie|AS|Jakarta
IR|Iran|AS|Téhéran
IQ|Irak|AS|Bagdad|Iraq
IE|Irlande|EU|Dublin
IM|Île de Man|EU|Douglas||t
IL|Israël|AS|Jérusalem
IT|Italie|EU|Rome
JM|Jamaïque|NA|Kingston
JP|Japon|AS|Tokyo
JE|Jersey|EU|Saint-Hélier||t
JO|Jordanie|AS|Amman
KZ|Kazakhstan|AS|Astana
KE|Kenya|AF|Nairobi
KI|Kiribati|OC|Tarawa
KP|Corée du Nord|AS|Pyongyang
KR|Corée du Sud|AS|Séoul|Corée
XK|Kosovo|EU|Pristina
KW|Koweït|AS|Koweït
KG|Kirghizistan|AS|Bichkek
LA|Laos|AS|Vientiane
LV|Lettonie|EU|Riga
LB|Liban|AS|Beyrouth
LS|Lesotho|AF|Maseru
LR|Liberia|AF|Monrovia|Libéria
LY|Libye|AF|Tripoli
LI|Liechtenstein|EU|Vaduz
LT|Lituanie|EU|Vilnius
LU|Luxembourg|EU|Luxembourg
MO|Macao|AS|Macao|Macau|t
MG|Madagascar|AF|Antananarivo
MW|Malawi|AF|Lilongwe
MY|Malaisie|AS|Kuala Lumpur|Malaysia
MV|Maldives|AS|Malé
ML|Mali|AF|Bamako
MT|Malte|EU|La Valette
MH|Îles Marshall|OC|Majuro|Marshall
MQ|Martinique|NA|Fort-de-France||t
MR|Mauritanie|AF|Nouakchott
MU|Maurice|AF|Port-Louis|Île Maurice
YT|Mayotte|AF|Mamoudzou||t
MX|Mexique|NA|Mexico
FM|Micronésie|OC|Palikir
MD|Moldavie|EU|Chisinau
MC|Monaco|EU|Monaco
MN|Mongolie|AS|Oulan-Bator
ME|Monténégro|EU|Podgorica
MS|Montserrat|NA|Brades||t
MA|Maroc|AF|Rabat
MZ|Mozambique|AF|Maputo
MM|Birmanie|AS|Naypyidaw|Myanmar
NA|Namibie|AF|Windhoek
NR|Nauru|OC|Yaren
NP|Népal|AS|Katmandou
NL|Pays-Bas|EU|Amsterdam|Hollande
BQ|Pays-Bas caribéens|NA|Kralendijk|Bonaire|t
NC|Nouvelle-Calédonie|OC|Nouméa||t
NZ|Nouvelle-Zélande|OC|Wellington
NI|Nicaragua|NA|Managua
NE|Niger|AF|Niamey
NG|Nigeria|AF|Abuja|Nigéria
NU|Niue|OC|Alofi||t
NF|Île Norfolk|OC|Kingston|Norfolk|t
MK|Macédoine du Nord|EU|Skopje|Macédoine
MP|Îles Mariannes du Nord|OC|Saipan|Mariannes|t
NO|Norvège|EU|Oslo
OM|Oman|AS|Mascate
PK|Pakistan|AS|Islamabad
PW|Palaos|OC|Ngerulmud|Palau
PS|Palestine|AS|Ramallah
PA|Panama|NA|Panama
PG|Papouasie-Nouvelle-Guinée|OC|Port Moresby|Papouasie
PY|Paraguay|SA|Asuncion
PE|Pérou|SA|Lima
PH|Philippines|AS|Manille
PN|Îles Pitcairn|OC|Adamstown|Pitcairn|t
PL|Pologne|EU|Varsovie
PT|Portugal|EU|Lisbonne
PR|Porto Rico|NA|San Juan||t
QA|Qatar|AS|Doha
RE|La Réunion|AF|Saint-Denis|Réunion|t
RO|Roumanie|EU|Bucarest
RU|Russie|EU|Moscou
RW|Rwanda|AF|Kigali
BL|Saint-Barthélemy|NA|Gustavia||t
SH|Sainte-Hélène|AF|Jamestown||t
KN|Saint-Christophe-et-Niévès|NA|Basseterre|Saint-Kitts-et-Nevis;Saint Kitts
LC|Sainte-Lucie|NA|Castries
MF|Saint-Martin|NA|Marigot||t
PM|Saint-Pierre-et-Miquelon|NA|Saint-Pierre||t
VC|Saint-Vincent-et-les-Grenadines|NA|Kingstown
WS|Samoa|OC|Apia
SM|Saint-Marin|EU|Saint-Marin
ST|Sao Tomé-et-Principe|AF|São Tomé
SA|Arabie saoudite|AS|Riyad
SN|Sénégal|AF|Dakar
RS|Serbie|EU|Belgrade
SC|Seychelles|AF|Victoria
SL|Sierra Leone|AF|Freetown
SG|Singapour|AS|Singapour
SX|Sint Maarten|NA|Philipsburg||t
SK|Slovaquie|EU|Bratislava
SI|Slovénie|EU|Ljubljana
SB|Îles Salomon|OC|Honiara|Salomon
SO|Somalie|AF|Mogadiscio
ZA|Afrique du Sud|AF|Pretoria
GS|Géorgie du Sud-et-les îles Sandwich du Sud|AN|—|Géorgie du Sud|t
SS|Soudan du Sud|AF|Djouba
ES|Espagne|EU|Madrid
LK|Sri Lanka|AS|Sri Jayawardenapura Kotte|Ceylan
SD|Soudan|AF|Khartoum
SR|Suriname|SA|Paramaribo
SE|Suède|EU|Stockholm
CH|Suisse|EU|Berne
SY|Syrie|AS|Damas
TW|Taïwan|AS|Taipei
TJ|Tadjikistan|AS|Douchanbé
TZ|Tanzanie|AF|Dodoma
TH|Thaïlande|AS|Bangkok
TL|Timor oriental|AS|Dili|Timor-Leste
TG|Togo|AF|Lomé
TO|Tonga|OC|Nuku'alofa
TT|Trinité-et-Tobago|NA|Port-d'Espagne|Trinidad
TN|Tunisie|AF|Tunis
TR|Turquie|AS|Ankara
TM|Turkménistan|AS|Achgabat
TC|Îles Turques-et-Caïques|NA|Cockburn Town||t
UG|Ouganda|AF|Kampala
UA|Ukraine|EU|Kiev|Kyiv
AE|Émirats arabes unis|AS|Abou Dabi|EAU;Émirats
GB|Royaume-Uni|EU|Londres|Angleterre;UK;Grande-Bretagne
US|États-Unis|NA|Washington|USA;Amérique;États-Unis d'Amérique
VI|Îles Vierges des États-Unis|NA|Charlotte Amalie||t
UY|Uruguay|SA|Montevideo
UZ|Ouzbékistan|AS|Tachkent
VU|Vanuatu|OC|Port-Vila
VE|Venezuela|SA|Caracas
VN|Viêt Nam|AS|Hanoï|Vietnam
WF|Wallis-et-Futuna|OC|Mata-Utu||t
EH|Sahara occidental|AF|Laâyoune|Sahara|t
YE|Yémen|AS|Sanaa
ZM|Zambie|AF|Lusaka
ZW|Zimbabwe|AF|Harare`

export const COUNTRIES: CountryMeta[] = RAW.split('\n').map((line) => {
  const [code, name, continent, capital, aliases = '', t = ''] = line.split('|')
  return {
    code,
    name,
    continent: continent as Continent,
    capital,
    aliases: aliases ? aliases.split(';') : [],
    territory: t === 't',
  }
})

export const COUNTRY_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]))

// Les pays où le français est langue officielle (2026). Le Mali (2023), le Burkina Faso (2023) et le Niger (2025)
// en ont fait une langue de travail.
export const FRANCOPHONES = new Set('BE BJ BI CM CA CF KM CG CD CI DJ FR GA GN GQ HT LU MG MC RW SN SC CH TD TG VU'.split(' '))

// Le français y reste très parlé sans être langue officielle.
export const FRENCH_SPOKEN = new Set('BF ML NE MA DZ TN MR LB MU'.split(' '))

// Une réponse est acceptée dans n'importe quelle langue : le navigateur connaît le nom de chaque pays
// dans des dizaines de langues (Intl.DisplayNames), sans rien à télécharger.
const LOCALES = 'en es de it pt nl pl sv da nb fi cs sk hu ro tr el ru uk bg sr hr sl lt lv et ca eu ga cy is sq ar he fa ur hi bn ta zh ja ko id ms vi th tl sw am'.split(' ')

// Noms anglais d'usage que la norme ne retient pas (« Türkiye », « Czechia »…).
const COMMON: Record<string, string[]> = {
  TR: ['Turkey'],
  CZ: ['Czech Republic'],
  SZ: ['Swaziland'],
  TL: ['East Timor'],
  CI: ['Ivory Coast'],
  MK: ['Macedonia'],
  CD: ['DRC', 'DR Congo', 'Democratic Republic of the Congo'],
  CG: ['Republic of the Congo'],
  US: ['United States of America', 'America'],
  GB: ['Great Britain', 'Britain', 'England'],
  NL: ['Holland'],
  VA: ['Vatican'],
  PS: ['Palestine'],
  AE: ['UAE'],
  KP: ['DPRK'],
  CV: ['Cabo Verde'],
}

let foreign: Map<string, string[]> | null = null

function buildForeign(): Map<string, string[]> {
  // un nom qui désigne déjà un autre pays (en français ou dans une autre langue) est écarté : il serait ambigu
  const owners = new Map<string, Set<string>>()
  const own = (name: string, code: string) => {
    const key = normalize(name)
    if (key) owners.set(key, (owners.get(key) ?? new Set()).add(code))
  }
  for (const c of COUNTRIES) [c.name, ...c.aliases].forEach((n) => own(n, c.code))
  const found = new Map<string, Set<string>>()
  const add = (code: string, name: string) => {
    // « Myanmar (Burma) » vaut aussi « Myanmar » et « Burma »
    const variants = [name, ...name.split(/[()]/).map((x) => x.trim())].filter(Boolean)
    for (const v of variants) {
      found.set(code, (found.get(code) ?? new Set()).add(v))
      own(v, code)
    }
  }
  for (const locale of LOCALES) {
    let names: Intl.DisplayNames
    try {
      names = new Intl.DisplayNames([locale], { type: 'region', fallback: 'none' })
    } catch {
      continue
    }
    for (const c of COUNTRIES) {
      const name = names.of(c.code)
      if (name) add(c.code, name)
    }
  }
  for (const [code, list] of Object.entries(COMMON)) list.forEach((n) => add(code, n))
  const result = new Map<string, string[]>()
  for (const [code, names] of found) result.set(code, [...names].filter((n) => owners.get(normalize(n))?.size === 1))
  return result
}

export function foreignNames(code: string): string[] {
  foreign ??= buildForeign()
  return foreign.get(code) ?? []
}

const displays = new Map<string, Intl.DisplayNames>()

// Le nom affiché suit la langue du site ; le français vient de la liste ci-dessus, les autres du navigateur.
export function countryName(code: string): string {
  const french = COUNTRY_BY_CODE.get(code)?.name ?? code
  if (getLang() === 'fr') return french
  let names = displays.get(locale())
  if (!names) displays.set(locale(), (names = new Intl.DisplayNames([locale()], { type: 'region', fallback: 'none' })))
  return names.of(code)?.replace(' - ', '-') ?? french
}

export function flagEmoji(code: string): string {
  if (code === 'XK') return '🇽🇰'
  return String.fromCodePoint(...[...code].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65))
}

export const CONTINENT_NAMES: Record<Continent, string> = {
  EU: 'Europe',
  AF: 'Afrique',
  AS: 'Asie',
  NA: 'Amérique du Nord',
  SA: 'Amérique du Sud',
  OC: 'Océanie',
  AN: 'Antarctique',
}
