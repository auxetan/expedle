export interface Question {
  cat: string
  q: string
  a: string
  w: [string, string, string]
}

// cat|question|bonne réponse|mauvaise 1|mauvaise 2|mauvaise 3
const RAW = `Histoire|En quelle année a eu lieu la prise de la Bastille ?|1789|1792|1776|1804
Histoire|Qui fut le premier empereur des Français ?|Napoléon Ier|Louis XIV|Charlemagne|Napoléon III
Histoire|En quelle année l’homme a-t-il marché sur la Lune pour la première fois ?|1969|1965|1972|1959
Histoire|Quelle civilisation a bâti le Machu Picchu ?|Les Incas|Les Aztèques|Les Mayas|Les Olmèques
Histoire|En quelle année est tombé le mur de Berlin ?|1989|1991|1987|1985
Histoire|Quel roi de France était surnommé le Roi-Soleil ?|Louis XIV|Louis XVI|François Ier|Henri IV
Histoire|Quelle reine d’Égypte fut l’alliée de Marc Antoine ?|Cléopâtre VII|Néfertiti|Hatchepsout|Bérénice
Histoire|En quelle année a débuté la Première Guerre mondiale ?|1914|1912|1916|1918
Histoire|Qui fut le premier président de la Ve République ?|Charles de Gaulle|Georges Pompidou|René Coty|Vincent Auriol
Histoire|Quelle bataille de 1815 marque la défaite finale de Napoléon ?|Waterloo|Austerlitz|Iéna|Trafalgar
Histoire|Quel navigateur atteint l’Amérique en 1492 ?|Christophe Colomb|Vasco de Gama|Magellan|Amerigo Vespucci
Histoire|Quelle ville était la capitale de l’Empire byzantin ?|Constantinople|Rome|Athènes|Antioche
Histoire|En quelle année les Françaises ont-elles voté pour la première fois ?|1945|1936|1919|1958
Histoire|Qui a coécrit le « Manifeste du Parti communiste » avec Engels ?|Karl Marx|Lénine|Trotski|Proudhon
Histoire|Quel pharaon a vu sa tombe découverte presque intacte en 1922 ?|Toutânkhamon|Ramsès II|Khéops|Akhenaton
Histoire|Quelle guerre opposa la France et l’Angleterre de 1337 à 1453 ?|La guerre de Cent Ans|La guerre de Trente Ans|La guerre de Sept Ans|Les guerres de Religion
Histoire|Quel surnom donne-t-on à Jeanne d’Arc ?|La Pucelle d’Orléans|La Dame de fer|La Reine Margot|La Louve de France
Histoire|En quelle année Jules César a-t-il été assassiné ?|44 av. J.-C.|52 av. J.-C.|27 av. J.-C.|14 apr. J.-C.
Histoire|Quel traité de 1957 fonde la Communauté économique européenne ?|Le traité de Rome|Le traité de Maastricht|Le traité de Lisbonne|Le traité de Paris
Histoire|Quel roi a fait construire le château de Versailles tel qu’on le connaît ?|Louis XIV|Louis XIII|Louis XV|Henri IV
Géographie|Quel est le plus grand océan du monde ?|Le Pacifique|L’Atlantique|L’océan Indien|L’Arctique
Géographie|Quelle est la capitale de l’Australie ?|Canberra|Sydney|Melbourne|Perth
Géographie|Quel est le plus grand désert chaud du monde ?|Le Sahara|Le Gobi|Le Kalahari|L’Atacama
Géographie|Quel pays est le plus peuplé du monde (2024) ?|L’Inde|La Chine|Les États-Unis|L’Indonésie
Géographie|Quel est le plus haut sommet d’Afrique ?|Le Kilimandjaro|Le mont Kenya|Le Ruwenzori|Le mont Cameroun
Géographie|Dans quel pays se trouve Tombouctou ?|Le Mali|Le Niger|La Mauritanie|Le Burkina Faso
Géographie|Quelle est la capitale du Canada ?|Ottawa|Toronto|Montréal|Vancouver
Géographie|Quel détroit sépare l’Europe de l’Afrique ?|Gibraltar|Le Bosphore|Ormuz|Magellan
Géographie|Quel est le plus petit pays du monde ?|Le Vatican|Monaco|Saint-Marin|Nauru
Géographie|Quel fleuve traverse Budapest ?|Le Danube|Le Rhin|La Vistule|L’Elbe
Géographie|Combien de départements compte la France ?|101|95|96|102
Géographie|Quelle est la plus grande île du monde ?|Le Groenland|Madagascar|Bornéo|La Nouvelle-Guinée
Géographie|Quel pays a la forme d’une botte ?|L’Italie|La Grèce|Le Portugal|La Croatie
Géographie|Quelle chaîne de montagnes sépare la France de l’Espagne ?|Les Pyrénées|Les Alpes|Le Jura|Les Vosges
Géographie|Quelle est la capitale du Brésil ?|Brasilia|Rio de Janeiro|São Paulo|Salvador
Géographie|Quel est le plus long fleuve de France ?|La Loire|La Seine|Le Rhône|La Garonne
Géographie|Quel lac est le plus profond du monde ?|Le lac Baïkal|Le lac Tanganyika|Le lac Supérieur|La mer Caspienne
Géographie|Dans quel océan se trouve Madagascar ?|L’océan Indien|L’Atlantique|Le Pacifique|L’océan Austral
Géographie|Quelle ville est surnommée « la Grosse Pomme » ?|New York|Chicago|Los Angeles|Boston
Géographie|Quel pays possède le plus de fuseaux horaires, territoires compris ?|La France|La Russie|Les États-Unis|Le Royaume-Uni
Géographie|Quel est le plus grand pays du monde par la superficie ?|La Russie|Le Canada|La Chine|Les États-Unis
Géographie|Quelle mer borde la ville de Marseille ?|La Méditerranée|La mer Adriatique|La mer Tyrrhénienne|La mer Ligure
Sciences|Quel est le symbole chimique de l’or ?|Au|Or|Ag|Go
Sciences|Quelle planète est la plus proche du Soleil ?|Mercure|Vénus|Mars|La Terre
Sciences|Combien de chromosomes possède une cellule humaine (hors gamètes) ?|46|23|44|48
Sciences|Quel gaz les plantes absorbent-elles pour la photosynthèse ?|Le dioxyde de carbone|L’oxygène|L’azote|L’hydrogène
Sciences|Qui a formulé la théorie de la relativité ?|Albert Einstein|Isaac Newton|Niels Bohr|Max Planck
Sciences|Quelle est la plus grande planète du système solaire ?|Jupiter|Saturne|Neptune|Uranus
Sciences|Quelle est la formule chimique de l’eau ?|H₂O|CO₂|O₂H|HO₂
Sciences|À quelle température l’eau bout-elle au niveau de la mer ?|100 °C|90 °C|110 °C|120 °C
Sciences|Quel organe produit l’insuline ?|Le pancréas|Le foie|Les reins|La rate
Sciences|Qui a découvert la pénicilline ?|Alexander Fleming|Louis Pasteur|Marie Curie|Robert Koch
Sciences|Quelle particule porte une charge électrique négative ?|L’électron|Le proton|Le neutron|Le photon
Sciences|Combien de planètes compte le système solaire ?|8|9|7|10
Sciences|Quel est l’os le plus long du corps humain ?|Le fémur|Le tibia|L’humérus|Le péroné
Sciences|Quelle scientifique a reçu un prix Nobel de physique puis de chimie ?|Marie Curie|Rosalind Franklin|Irène Joliot-Curie|Lise Meitner
Sciences|Quel est l’élément le plus abondant dans l’Univers ?|L’hydrogène|L’hélium|L’oxygène|Le carbone
Sciences|Quelle unité mesure la résistance électrique ?|L’ohm|Le volt|L’ampère|Le watt
Sciences|Combien de côtés possède un hexagone ?|6|5|7|8
Sciences|Que vaut π arrondi au centième ?|3,14|3,16|3,12|3,41
Sciences|Quel est le nombre premier qui suit 7 ?|11|9|13|10
Sciences|Quelle est la vitesse approximative du son dans l’air ?|340 m/s|34 m/s|3 400 m/s|1 200 m/s
Sciences|Quel savant français a mis au point le vaccin contre la rage ?|Louis Pasteur|Claude Bernard|Paul Langevin|Antoine Lavoisier
Arts & Lettres|Qui a écrit « Les Misérables » ?|Victor Hugo|Émile Zola|Honoré de Balzac|Alexandre Dumas
Arts & Lettres|Qui a peint « La Joconde » ?|Léonard de Vinci|Michel-Ange|Raphaël|Titien
Arts & Lettres|Dans quel musée est exposée « La Joconde » ?|Le Louvre|Le musée d’Orsay|Les Offices|Le Prado
Arts & Lettres|Qui a écrit « Le Petit Prince » ?|Antoine de Saint-Exupéry|Jules Verne|Marcel Pagnol|Albert Camus
Arts & Lettres|Quel peintre s’est tranché une partie de l’oreille ?|Vincent van Gogh|Paul Gauguin|Claude Monet|Edvard Munch
Arts & Lettres|À quel mouvement associe-t-on Claude Monet ?|L’impressionnisme|Le cubisme|Le surréalisme|Le fauvisme
Arts & Lettres|Qui a écrit « Roméo et Juliette » ?|William Shakespeare|Molière|Christopher Marlowe|Goethe
Arts & Lettres|Qui est l’auteur de « L’Étranger » ?|Albert Camus|Jean-Paul Sartre|André Gide|Boris Vian
Arts & Lettres|Qui a sculpté « Le Penseur » ?|Auguste Rodin|Camille Claudel|Michel-Ange|Bartholdi
Arts & Lettres|Quelle romancière a créé le détective Hercule Poirot ?|Agatha Christie|Mary Shelley|Jane Austen|Patricia Highsmith
Arts & Lettres|Dans quelle ville se trouve la Sagrada Família ?|Barcelone|Madrid|Séville|Valence
Arts & Lettres|Qui a peint « Guernica » ?|Pablo Picasso|Salvador Dalí|Joan Miró|Francisco Goya
Arts & Lettres|Qui a écrit « Vingt Mille Lieues sous les mers » ?|Jules Verne|H. G. Wells|Alexandre Dumas|Victor Hugo
Arts & Lettres|Molière est le nom de plume de…|Jean-Baptiste Poquelin|François-Marie Arouet|Henri Beyle|Aurore Dupin
Arts & Lettres|Quel héros d’Hergé a un chien nommé Milou ?|Tintin|Spirou|Astérix|Lucky Luke
Arts & Lettres|Qui a écrit « Le Comte de Monte-Cristo » ?|Alexandre Dumas|Victor Hugo|Gustave Flaubert|Stendhal
Sport|Combien de joueurs compte une équipe de football sur le terrain ?|11|10|12|9
Sport|Quel pays a remporté la Coupe du monde de football 2018 ?|La France|La Croatie|L’Allemagne|Le Brésil
Sport|Tous les combien ont lieu les Jeux olympiques d’été ?|4 ans|2 ans|3 ans|5 ans
Sport|Quel tournoi du Grand Chelem se joue sur terre battue ?|Roland-Garros|Wimbledon|L’US Open|L’Open d’Australie
Sport|Quelle ville a accueilli les JO d’été 2024 ?|Paris|Los Angeles|Tokyo|Londres
Sport|Qui détient le record du monde du 100 m ?|Usain Bolt|Carl Lewis|Tyson Gay|Yohan Blake
Sport|De quelle couleur est le maillot du leader du Tour de France ?|Jaune|Vert|À pois|Blanc
Sport|Combien de points vaut un essai au rugby à XV ?|5|3|4|7
Sport|Dans quel pays est né le judo ?|Le Japon|La Chine|La Corée du Sud|Le Brésil
Sport|Combien de trous compte un parcours de golf standard ?|18|9|12|21
Sport|Quel joueur a remporté le plus de fois Roland-Garros ?|Rafael Nadal|Roger Federer|Novak Djokovic|Björn Borg
Sport|Quelle est la distance officielle d’un marathon ?|42,195 km|40 km|42 km|45,5 km
Cinéma & Musique|Qui a réalisé « Titanic » (1997) ?|James Cameron|Steven Spielberg|Ridley Scott|Martin Scorsese
Cinéma & Musique|Quel groupe a chanté « Bohemian Rhapsody » ?|Queen|The Beatles|Led Zeppelin|Pink Floyd
Cinéma & Musique|Dans quelle ville est décernée la Palme d’or ?|Cannes|Venise|Berlin|Deauville
Cinéma & Musique|Qui a créé « La Vie en rose » ?|Édith Piaf|Dalida|Barbara|Juliette Gréco
Cinéma & Musique|Combien de cordes compte une guitare classique ?|6|4|5|7
Cinéma & Musique|Quel compositeur, devenu sourd, a écrit la Neuvième symphonie ?|Beethoven|Mozart|Brahms|Schubert
Cinéma & Musique|Quel film d’animation suit un poisson-clown nommé Nemo ?|Le Monde de Nemo|Gang de requins|La Petite Sirène|Vaiana
Cinéma & Musique|Quel acteur incarne Jack Sparrow ?|Johnny Depp|Orlando Bloom|Brad Pitt|Leonardo DiCaprio
Cinéma & Musique|Quel duo français a sorti l’album « Random Access Memories » ?|Daft Punk|Justice|Air|Cassius
Cinéma & Musique|Qui a réalisé « Le Fabuleux Destin d’Amélie Poulain » ?|Jean-Pierre Jeunet|Luc Besson|Jacques Audiard|Michel Gondry
Cinéma & Musique|Qui a composé « Les Quatre Saisons » ?|Antonio Vivaldi|Jean-Sébastien Bach|Mozart|Haendel
Nature|Quel est le plus grand animal vivant ?|La baleine bleue|L’éléphant d’Afrique|Le requin-baleine|Le cachalot
Nature|Combien de pattes a une araignée ?|8|6|10|12
Nature|Quel est l’animal terrestre le plus rapide ?|Le guépard|Le lion|L’antilope|Le lévrier
Nature|Quel arbre produit les glands ?|Le chêne|Le hêtre|Le châtaignier|Le noyer
Nature|De quoi se nourrit principalement le panda géant ?|Du bambou|D’eucalyptus|De fruits|De poissons
Nature|Comment appelle-t-on le petit de la vache ?|Le veau|Le poulain|L’agneau|Le chevreau
Nature|Combien de cœurs possède une pieuvre ?|3|1|2|8
Nature|Quel est le seul mammifère capable de vol actif ?|La chauve-souris|L’écureuil volant|Le colugo|Le phalanger volant
Nature|Quel oiseau est incapable de voler ?|L’autruche|Le colibri|La cigogne|Le martinet
Divers|Quelle est la monnaie du Japon ?|Le yen|Le won|Le yuan|Le baht
Divers|Combien de cartes compte un jeu classique sans jokers ?|52|54|32|48
Divers|Quelle langue parle-t-on principalement au Brésil ?|Le portugais|L’espagnol|Le brésilien|L’anglais
Divers|Combien de faces possède un dé classique ?|6|4|8|12
Divers|Quelle couleur obtient-on en mélangeant du bleu et du jaune ?|Le vert|Le violet|L’orange|Le marron
Divers|Dans quel pays sont nés les Jeux olympiques antiques ?|La Grèce|L’Italie|L’Égypte|La Turquie
Divers|Que signifie le sigle « ONU » ?|Organisation des Nations unies|Office national unifié|Organisation des nations universelles|Ordre des nations unies
Divers|Combien de couleurs compte traditionnellement l’arc-en-ciel ?|7|5|6|8
Divers|Que célèbre-t-on le 14 juillet en France ?|La fête nationale|La fête du Travail|L’Armistice|La fête de la Musique
Divers|Quelle entreprise a créé l’iPhone ?|Apple|Samsung|Google|Nokia
Divers|Combien de jours compte une année bissextile ?|366|365|364|367`

export const QUESTIONS: Question[] = RAW.split('\n').map((line) => {
  const [cat, q, a, w1, w2, w3] = line.split('|')
  return { cat, q, a, w: [w1, w2, w3] }
})
