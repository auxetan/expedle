# Jeux à ajouter plus tard

Liste tirée de la recherche sur les jeux de géographie et de culture générale les plus joués (octobre 2026). Déjà dans Méridien : Travle, Seterra, GeoHunter, Magnitudle, JetPunk, Worldle, Globle, GeoGuessr (Street View, avec une clé Google) et WorldGuessr (photos, sans clé).

Effort : **petit** = quelques heures avec les données du projet, **moyen** = une nouvelle source de données, **gros** = un serveur ou un service payant.

## Géographie

| Jeu | Principe | Ce qu'on a déjà | Effort |
|---|---|---|---|
| **Statele** | Worldle avec les États américains | Contours des États (atlas de Travle USA), moteur de Worldle | petit |
| **Countryle** | Deviner un pays avec des indices : continent, hémisphère, population, superficie, PIB | `COUNTRY_STATS` de GeoHunter, continents, voisins | petit |
| **DailyGeo** | Une capitale et un pays mystères par jour, avec indices (monnaie, langue, distance, direction) | Capitales, monnaies, langues (`facts.ts`), distances et caps (`geo/measure.ts`) | petit |
| **GeoGrid** | Grille 3×3 : un pays qui remplit deux critères à la fois (enclavé ET hémisphère Sud…) | Catégories de GeoHunter, voisins, continents | moyen (bien choisir les critères pour que chaque case ait des réponses) |
| **Flagle** | Le drapeau se dévoile tuile par tuile | Rien d'exploitable : les emojis ne se découpent pas | moyen (ajouter un jeu de drapeaux SVG libre, par exemple `flag-icons`, licence MIT) |
| **Tradle** | Deviner un pays d'après le graphique de ses exportations | Rien | moyen (jeu de données des exportations par pays, par exemple l'OEC ou l'ONU Comtrade) |

## Culture générale

| Jeu | Principe | Ce qu'on a déjà | Effort |
|---|---|---|---|
| **Wikitrivia** | Placer des événements dans l'ordre sur une frise | Table `EVENTS` de `facts.ts` (événements datés) | petit |
| **Factle** | Ranger cinq réponses dans le bon ordre (« les 5 pays les plus peuplés ») | Tous les classements de GeoHunter et de JetPunk | petit |
| **Britannica Tightrope** | Neuf questions par jour, trois erreurs et on tombe | Banque de questions du Quiz culture G | petit |
| **TimeGuessr / Chronophoto** | Dater une photo (et la situer pour TimeGuessr) | Le moteur de WorldGuessr : Wikimedia Commons fournit souvent la date de prise de vue | moyen (filtrer les photos bien datées) |
| **HistoryGuesser** | GeoGuessr appliqué à des photos historiques | Même base que TimeGuessr | moyen |
| **Artle** | Reconnaître un peintre d'après ses tableaux | Table `PAINTINGS` (œuvre → artiste) | moyen (images des œuvres via Wikimedia Commons ou Wikidata) |
| **Wikipedia Speedrun** | Aller d'une page Wikipédia à une autre par les liens | Rien | moyen (API Wikipédia, accessible sans clé et avec CORS) |

## Plus lourds

| Jeu | Pourquoi c'est gros |
|---|---|
| **Kahoot, Trivia Crack (Quiz Crack), QuizDuel** | Ce sont des jeux à plusieurs en direct ou en duel : il faut un serveur (salons, synchronisation, comptes). |

## Petites suites possibles pour les jeux déjà faits

- GeoGuessr et WorldGuessr : défi du jour identique pour tous, chrono par manche, modes « sans bouger » et « sans zoom » (NMPZ).
- GeoGuessr en mode France 360° sans clé, avec Panoramax (photos 360° ouvertes) et une visionneuse 360°.
- Worldle : manches bonus supplémentaires (monnaie, langue, pays voisins), comme le jeu d'origine.
- Globle : afficher les noms des pays au survol du globe.
