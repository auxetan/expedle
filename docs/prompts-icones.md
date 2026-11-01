# Prompts ChatGPT : icônes d'Expedle

## Mode d'emploi

1. Ouvre une seule conversation ChatGPT et colle d'abord le **style commun**.
2. Colle ensuite le prompt du premier sujet.
3. Pour chaque sujet suivant, commence par « Même style exact que l'icône précédente, mêmes couleurs, même épaisseur de formes : », puis colle le prompt.
4. Si une image dérive (dégradés, ombres, couleurs en trop), redemande-la avec « Respecte strictement la palette et le style plat du début ».

Chaque image se télécharge en PNG transparent sous le nom indiqué. Dépose-les dans `docs/icones/` : je les passe ensuite en WebP 256 × 256 et je crée la version sombre (le noir y devient crème).

Ordre conseillé :

1. les jeux dont l'icône est encore provisoire (dessinée par moi) ;
2. la monnaie ;
3. la boutique ;
4. le reste quand tu veux.

## Style commun (à coller en premier)

```
Tu vas créer une série d'icônes pour Expedle, un site de jeux de géographie et de culture générale. Le style doit être strictement identique pour toutes les icônes :

- Illustration vectorielle plate et minimaliste : formes géométriques simples aux angles légèrement arrondis, aplats pleins, aucune texture, aucun dégradé, aucune ombre, aucune 3D, aucun contour.
- Palette fixe, uniquement ces trois couleurs : taupe #8A8274 (la couleur principale, pour les grandes formes), crème #D3CBBB (les surfaces claires et les détails posés sur le taupe), presque noir #2A2522 (un ou deux accents forts seulement : une aiguille, une punaise, un drapeau). Jamais de blanc pur, jamais d'autre couleur, sauf quand le prompt parle d'or.
- Quand le prompt parle d'or : or #C9A045, or clair #E7C873 pour les facettes et reflets plats, brun #5A4320 pour les détails. Toujours en aplats.
- Fond transparent (PNG), carré 1024 × 1024, sujet centré avec environ 12 % de marge de chaque côté.
- Lisible même affiché à 40 px : un sujet principal, deux ou trois éléments au maximum, une silhouette forte.
- Ton malin, comme un pictogramme de jeu de société moderne : un petit détail drôle ou inattendu, jamais chargé.
- Aucun texte, sauf quand le prompt le demande ; dans ce cas, des chiffres ronds et épais.
- L'icône sera posée sur une carte anthracite #262523 en thème sombre et blanc cassé #FDFBF8 en thème clair : elle doit rester lisible sur les deux.

Réponds « prêt » et attends le premier sujet.
```

## 1. Jeux à l'icône provisoire (priorité)

### `statele.png` : Statele

```
Icône de Statele, où l'on reconnaît un État américain à sa silhouette. La silhouette pleine et bien reconnaissable du Texas en taupe, posée légèrement de biais, avec une petite étoile crème à cinq branches en son centre. Dans le coin inférieur droit, une petite boussole ronde crème dont l'aiguille presque noire pointe vers le haut à droite.
```

### `dailygeo.png` : DailyGeo

```
Icône de DailyGeo, où l'on trouve d'abord un pays puis sa capitale, indice après indice. Une page de calendrier taupe à deux anneaux presque noirs, sans texte ; sur la page, une petite silhouette de pays crème, et plantée dedans une punaise presque noire dont la tête porte une étoile crème, symbole de capitale.
```

### `factle.png` : Factle

```
Icône de Factle, où l'on retrouve dans l'ordre les cinq premiers d'un classement. Cinq barres horizontales empilées de longueurs décroissantes, comme un classement : la première presque noire, les quatre autres taupe ; à gauche de chaque barre, un petit rond crème. La deuxième barre est légèrement décalée vers la droite, comme une carte qu'on est en train de remettre à sa place.
```

### `wikitrivia.png` : Wikitrivia

```
Icône de Wikitrivia, où l'on place chaque événement à sa place sur une frise chronologique. Une frise horizontale taupe avec quatre petites encoches ; au-dessus, une carte crème aux angles arrondis qui descend vers l'espace libre entre deux encoches, guidée par une petite flèche presque noire. Sur la carte, un minuscule sablier taupe.
```

### `tightrope.png` : Tightrope

```
Icône de Tightrope : neuf questions, trois faux pas autorisés. Un funambule stylisé presque noir en équilibre sur un fil taupe tendu entre deux poteaux, une longue perche crème dans les mains. Sous le fil, trois petits ronds alignés : deux crème (faux pas encore permis) et un taupe barré (faux pas déjà fait).
```

### `countryle.png` : Countryle

```
Icône de Countryle, où l'on devine un pays grâce à des indices (continent, population, superficie). Un globe taupe quadrillé de méridiens crème, examiné par une grosse loupe presque noire posée en bas à droite ; dans la lentille crème, deux petites flèches empilées, une vers le haut presque noire et une vers le bas taupe.
```

### `flagle.png` : Flagle

```
Icône de Flagle, où un drapeau se dévoile tuile par tuile. Un drapeau rectangulaire découpé en six tuiles (trois colonnes, deux rangées) accroché à une hampe presque noire : trois tuiles déjà retournées montrent des bandes taupe et presque noires, les trois autres sont encore des caches crème.
```

### `geogrid.png` : GeoGrid

```
Icône de GeoGrid, une grille de trois cases sur trois où chaque case attend un pays qui remplit deux critères. Neuf carrés aux angles arrondis bien espacés : cinq taupe (déjà remplis), trois crème (encore vides) et la case du milieu en haut presque noire, marquée d'une petite cible crème.
```

### `openfront.png` : Frontières

```
Icône de Frontières, où l'on conquiert le monde case après case contre des armées rivales. Une terre en gros pixels carrés, partagée entre un territoire taupe et un territoire crème, avec une rangée de pixels plus sombres sur la frontière ; un petit drapeau presque noir planté sur le territoire taupe et, sur le vide à côté, un petit voilier presque noir qui part à l'assaut.
```

### `jetpunk.png` : JetPunk

```
Icône de JetPunk, des quiz où l'on remplit un tableau de réponses contre la montre. Une feuille de quiz crème aux angles arrondis avec quatre lignes : trois réponses déjà remplies (barres taupe) et une dernière case vide où clignote un curseur presque noir. Un petit chronomètre rond taupe posé sur le coin supérieur droit de la feuille, l'aiguille presque noire près de la fin.
```

### `revision.png` : Révision du jour

```
Icône de la Révision du jour, où l'on revoit ses points faibles au bon moment, comme avec des fiches. Une boîte à fiches taupe vue de face, ouverte en haut ; trois fiches crème en dépassent en éventail, celle du milieu un peu plus haute. Sur la face de la boîte, une flèche circulaire presque noire qui tourne dans le sens des aiguilles d'une montre.
```

## 2. La monnaie : les pépites

### `pepite.png` : une pépite

```
Icône de la monnaie d'Expedle, la pépite : une pépite d'or brute et irrégulière, taillée en grandes facettes plates, en or avec deux ou trois facettes en or clair et un petit éclat brun. Elle doit se lire comme une pièce de monnaie de jeu même à 16 px : silhouette compacte et ronde, aucun détail fin.
```

### `pepites-tas.png` : un petit tas

```
Même pépite, mais un petit tas de cinq pépites d'or empilées en pyramide, facettes or clair et éclats bruns, qui annonce un gain modeste.
```

### `pepites-sac.png` : un sac de pépites

```
Un sac en toile taupe noué par une ficelle presque noire, rebondi et un peu de travers, d'où dépassent trois pépites d'or. Pour un gros gain.
```

### `pepites-coffre.png` : le coffre

```
Un coffre au trésor taupe à ferrures presque noires, couvercle entrouvert, débordant de pépites d'or aux facettes or clair. C'est l'image de la boutique et des grosses récompenses.
```

### `pepites-gain.png` : une récompense

```
Une pépite d'or au centre, entourée de quatre petites étincelles en losange or clair, et un petit « + » épais crème en haut à droite. Pour annoncer des pépites gagnées.
```

## 3. Boutique et menus

### `boutique.png` : la boutique

```
Icône de la boutique d'Expedle : un petit étal de marché taupe avec un auvent rayé taupe et crème. Sur le comptoir, une pépite d'or et un globe crème miniature. Ton chaleureux de petite échoppe.
```

### `classements.png` : les classements

```
Un podium à trois marches taupe ; sur la plus haute, une petite coupe presque noire ; les deux autres marches portent un rond crème. Sans chiffres.
```

### `passeport.png` : le passeport

```
Un passeport taupe fermé, avec un globe crème sur la couverture, d'où dépasse un coin de page portant un tampon rond presque noir.
```

### `defis.png` : les défis entre amis

```
Deux bulles de dialogue qui se croisent : une taupe et une crème. Dans chacune, un petit éclair presque noir, comme deux amis qui se lancent un défi.
```

### `succes.png` : les succès

```
Une médaille ronde taupe suspendue à un ruban crème en V, avec une étoile presque noire en son centre et une petite étincelle crème sur le bord.
```

### `statistiques.png` : les statistiques

```
Trois barres verticales taupe de hauteurs croissantes posées sur une ligne presque noire, avec une courbe crème qui monte au-dessus et se termine par une petite flèche.
```

## 4. Éditions dorées des jeux

Dans la boutique, chaque jeu a son « icône dorée ». Pour l'instant, c'est une teinte or appliquée par le site ; une vraie version dessinée sera plus belle.

Pour chaque jeu, téléverse dans ChatGPT son icône actuelle (`public/icons/<jeu>-clair.webp`) avec ce prompt, et enregistre le résultat sous `<jeu>-or.png` (par exemple `worldle-or.png`).

```
Refais exactement cette icône, même composition et mêmes formes, mais en édition dorée de collection : le taupe devient or #C9A045, le crème devient or clair #E7C873, le presque noir devient brun #5A4320. Ajoute seulement deux petites étincelles en losange or clair autour du sujet. Toujours en aplats, sans dégradé ni ombre, fond transparent.
```

Les jeux, avec le nom de leur fichier :

- `travle` · `travle-hebdo` · `travle-usa`
- `worldle` · `statele` · `dailygeo` · `globle` · `countryle` · `flagle` · `geogrid`
- `geoguessr` · `photoguessr` · `geohunter` · `seterra` · `openfront`
- `size-it-up` · `size-it-up-pop` · `size-it-up-geo` · `weekly-1k` · `weigh-it-up` · `daily-question` · `survival`
- `quiz-jour` · `factle` · `wikitrivia` · `tightrope` · `jetpunk` · `quiz-culture-g` · `drapeaux` · `capitales`

## 5. Avatars de la boutique

Aujourd'hui, les avatars sont des émojis. Ces dessins pourraient les remplacer pour donner à Expedle une vraie collection.

Commence par ce prompt de cadrage, puis colle un sujet à la fois. Enregistre chaque image sous `avatar-<sujet>.png`.

```
Même style exact que les icônes précédentes, mais pour un avatar de profil : le personnage tient dans un disque crème #D3CBBB, vu de face ou de trois quarts, tête et épaules seulement, expression sympathique et un peu espiègle. Taupe et presque noir pour le personnage, un seul petit détail or quand le sujet le demande.
```

Sujets, dans l'ordre des prix :

| Fichier | Sujet |
| --- | --- |
| `avatar-panda` | un panda explorateur avec un petit chapeau de brousse |
| `avatar-lion` | un lion à la crinière en éventail |
| `avatar-poulpe` | un poulpe qui tient une carte routière |
| `avatar-baleine` | une baleine qui souffle un jet en forme de point d'interrogation |
| `avatar-aigle` | un aigle avec des lunettes d'aviateur |
| `avatar-loup` | un loup qui hurle face à une lune crème |
| `avatar-cowboy` | un cow-boy au chapeau large |
| `avatar-gentleman` | un gentleman au haut-de-forme et monocle or |
| `avatar-ninja` | un ninja masqué aux yeux rieurs |
| `avatar-sorcier` | un sorcier au chapeau pointu étoilé |
| `avatar-sirene` | une sirène aux cheveux en vagues |
| `avatar-alien` | un extraterrestre aux grands yeux, antennes en ressort |
| `avatar-ovni` | une soucoupe volante qui aspire une vache |
| `avatar-moai` | une statue moaï qui fait un clin d'œil |
| `avatar-volcan` | un volcan souriant qui fume un peu |
| `avatar-chateau` | un petit château fort à une tour |
| `avatar-dino` | un tyrannosaure aux bras trop courts qui fait coucou |
| `avatar-licorne` | une licorne dont la corne est or |
| `avatar-dragon` | un dragon qui crache une petite flamme or |
| `avatar-couronne` | une couronne or posée sur un coussin taupe : l'avatar le plus cher |

## 6. Objets des jeux (pour des jokers à venir)

Ces icônes servent à de futurs objets à acheter en pépites dans les jeux. Enregistre chaque image sous le nom indiqué.

### `objet-indice.png` : un indice

```
Une ampoule crème qui s'allume, culot taupe, avec trois petits traits de lumière presque noirs. Une petite pépite d'or est posée à son pied.
```

### `objet-essai.png` : un essai en plus

```
Un gros « +1 » épais et arrondi taupe, avec une petite flèche circulaire crème qui tourne autour, comme une nouvelle chance.
```

### `objet-vie.png` : une vie en plus

```
Un cœur taupe avec un petit pansement crème en croix, et une étincelle or au coin.
```

### `objet-passer.png` : passer la question

```
Deux chevrons doubles taupe qui avancent vers la droite, devant une carte crème légèrement penchée qu'ils poussent hors du cadre.
```

### `objet-moitie.png` : 50/50

```
Un disque coupé en deux par une ligne presque noire : la moitié gauche crème, la moitié droite taupe et barrée, comme deux réponses fausses qu'on retire.
```

### `objet-chrono.png` : le chrono gelé

```
Un chronomètre taupe dont le cadran crème est recouvert d'un petit cristal de glace en flocon presque noir : le temps s'arrête.
```

### `objet-revele.png` : révéler une tuile

```
Une grille de quatre tuiles carrées : trois crème, une retournée en taupe qui laisse voir un petit bout de drapeau presque noir.
```

## 7. Les autres jeux

Tous ces jeux ont déjà une icône. Ces prompts servent à les refaire en série si tu veux harmoniser l'ensemble.

### `travle.png` : Travle

```
Icône de Travle, où l'on relie deux pays en traversant leurs voisins. Trois pays stylisés en formes arrondies irrégulières qui se touchent, alignés en diagonale du bas à gauche vers le haut à droite : deux taupe, celui du milieu crème. Un trajet en pointillés presque noirs saute d'un pays à l'autre, avec un petit fanion au départ et un drapeau d'arrivée à damier simplifié.
```

### `travle-hebdo.png` : Travle, défi hebdo

```
Icône du défi hebdomadaire de Travle : un très long trajet, une fois par semaine. Un chemin en pointillés presque noirs qui serpente sur cinq petits pays arrondis taupe et crème. Dans le coin supérieur droit, une petite page de calendrier crème à anneaux, sans texte, avec une case cochée.
```

### `travle-usa.png` : Travle USA

```
Icône de Travle USA, où l'on relie deux États américains. Quatre États stylisés en blocs aux angles arrondis qui s'emboîtent comme un puzzle, à la manière des États rectangulaires de l'Ouest (taupe et crème). Un pointillé presque noir les traverse et se termine sur une petite étoile crème à cinq branches.
```

### `worldle.png` : Worldle

```
Icône de Worldle, où l'on reconnaît un pays à sa silhouette. La silhouette pleine de l'Italie en taupe, et dans le coin inférieur droit une petite boussole ronde crème dont l'aiguille presque noire pointe vers le haut à droite.
```

### `globle.png` : Globle

```
Icône de Globle, où l'on cherche un pays mystère sur un globe qui « chauffe ». Un globe vu de l'espace, océans taupe et continents crème ; un pays au centre est presque noir (le plus chaud) et ses voisins d'un taupe plus clair, comme une tache de chaleur.
```

### `geoguessr.png` : GeoGuessr

```
Icône de GeoGuessr, où l'on est lâché dans une vue de rue et où l'on doit deviner l'endroit. Un médaillon rond : en haut un ciel crème, en bas des collines taupe, et une route crème bordée de pointillés qui file droit vers l'horizon. Une grosse punaise presque noire flotte au-dessus de l'horizon.
```

### `photoguessr.png` : PhotoGuessr

```
Icône de PhotoGuessr, où l'on devine où une photo a été prise. Un cadre photo taupe aux angles arrondis contenant un paysage simple : montagnes et soleil taupe sur fond crème, une petite route. Une grosse punaise presque noire est plantée au milieu de la photo.
```

### `geohunter.png` : GeoHunter

```
Icône de GeoHunter, où l'on place chaque pays dans la catégorie où il est le mieux classé. Un petit globe taupe aux continents crème, debout fièrement sur la plus haute marche d'un podium taupe, avec une médaille presque noire autour du « cou » comme s'il venait de gagner.
```

### `seterra.png` : Seterra

```
Icône de Seterra, où l'on situe des pays sur une carte. Une carte stylisée taupe dont il manque une pièce en forme de pays ; la pièce manquante, crème, flotte juste au-dessus, prête à reprendre sa place, avec une grosse punaise presque noire plantée dedans.
```

### `size-it-up.png` : Size It Up

```
Icône de Size It Up, où l'on redimensionne une silhouette à sa taille réelle. La silhouette pleine d'une girafe de profil en taupe, dans un cadre de sélection en pointillés presque noirs avec des poignées carrées aux quatre coins et une flèche diagonale qui l'agrandit. À ses pieds, une minuscule souris crème donne l'échelle.
```

### `size-it-up-pop.png` : Size It Up, Pop Culture

```
Icône de Size It Up : Pop Culture, la taille officielle des héros de fiction. La silhouette pleine taupe d'un monstre géant générique façon kaiju (dos à piques, queue épaisse), à côté d'un minuscule personnage humain presque noir qui lève la tête vers lui. Derrière, une règle verticale graduée crème. Aucun personnage existant reconnaissable.
```

### `size-it-up-geo.png` : Size It Up, Géographie

```
Icône de Size It Up : Géographie, la vraie taille des territoires. Deux silhouettes de pays imaginaires superposées et décalées : une grande crème dessous, une plus petite taupe posée dessus, avec une petite flèche d'agrandissement diagonale presque noire à son coin.
```

### `weekly-1k.png` : The Weekly 1K

```
Icône de The Weekly 1K, dix manches sur un thème chaque semaine. Un gros badge rond taupe portant « 1K » en chiffres épais et arrondis crème, entouré d'un arc de dix petits points : six presque noirs (manches jouées) et quatre crème (manches à venir).
```

### `weigh-it-up.png` : Weigh It Up

```
Icône de Weigh It Up, où l'on équilibre une balance. Une balance à deux plateaux taupe, parfaitement à l'horizontale. Sur un plateau, un petit éléphant presque noir assis ; sur l'autre, une grosse pile de pommes crème qui le contrebalance exactement.
```

### `daily-question.png` : Daily Question

```
Icône de Daily Question, une question par jour à laquelle on répond par une estimation. Une bulle de dialogue taupe avec un gros point d'interrogation crème, et juste en dessous un curseur horizontal : une barre crème et une poignée ronde presque noire aux deux tiers.
```

### `survival.png` : Survival Mode

```
Icône de Survival Mode, où l'on estime vite pour rester en vie. Trois cœurs alignés : les deux premiers pleins en taupe, le troisième vide, simple contour taupe avec une petite fissure. Au-dessus, un petit chronomètre presque noir légèrement penché, comme pressé.
```

### `quiz-jour.png` : Quiz du jour

```
Icône du Quiz du jour, dix questions identiques pour tout le monde chaque jour. Une carte de quiz posée légèrement de biais, taupe, portant un gros « 10 » crème aux chiffres épais et arrondis, avec deux anneaux de calendrier presque noirs en haut.
```

### `quiz-culture-g.png` : Quiz culture G

```
Icône du Quiz culture G, des milliers de questions. Une pile de trois cartes à questions en léger éventail (taupe, crème, taupe) ; celle du dessus porte un point d'interrogation crème. Au-dessus, une petite ampoule presque noire qui s'allume, avec trois petits traits de lumière.
```

### `drapeaux.png` : Drapeaux

```
Icône du quiz Drapeaux : reconnaître le drapeau de chaque pays. Un drapeau imaginaire qui flotte au vent sur un mât presque noir, avec trois bandes diagonales taupe, crème et taupe foncé. Un drapeau qui n'existe pas, pour n'en favoriser aucun.
```

### `capitales.png` : Capitales

```
Icône du quiz Capitales : retrouver la capitale de chaque pays. Une grande épingle de carte taupe dont la tête ronde contient une étoile crème, plantée au-dessus d'une petite silhouette de ville presque noire : quelques tours et un dôme.
```
