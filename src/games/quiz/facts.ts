// Tables de faits servant à générer les questions. Une ligne = un fait, champs séparés par « | ».
const rows = (raw: string) => raw.trim().split('\n').map((l) => l.split('|'))

// numéro|symbole|nom
export const ELEMENTS = rows(`1|H|Hydrogène
2|He|Hélium
3|Li|Lithium
4|Be|Béryllium
5|B|Bore
6|C|Carbone
7|N|Azote
8|O|Oxygène
9|F|Fluor
10|Ne|Néon
11|Na|Sodium
12|Mg|Magnésium
13|Al|Aluminium
14|Si|Silicium
15|P|Phosphore
16|S|Soufre
17|Cl|Chlore
18|Ar|Argon
19|K|Potassium
20|Ca|Calcium
21|Sc|Scandium
22|Ti|Titane
23|V|Vanadium
24|Cr|Chrome
25|Mn|Manganèse
26|Fe|Fer
27|Co|Cobalt
28|Ni|Nickel
29|Cu|Cuivre
30|Zn|Zinc
31|Ga|Gallium
32|Ge|Germanium
33|As|Arsenic
34|Se|Sélénium
35|Br|Brome
36|Kr|Krypton
37|Rb|Rubidium
38|Sr|Strontium
39|Y|Yttrium
40|Zr|Zirconium
41|Nb|Niobium
42|Mo|Molybdène
43|Tc|Technétium
44|Ru|Ruthénium
45|Rh|Rhodium
46|Pd|Palladium
47|Ag|Argent
48|Cd|Cadmium
49|In|Indium
50|Sn|Étain
51|Sb|Antimoine
52|Te|Tellure
53|I|Iode
54|Xe|Xénon
55|Cs|Césium
56|Ba|Baryum
57|La|Lanthane
58|Ce|Cérium
59|Pr|Praséodyme
60|Nd|Néodyme
61|Pm|Prométhium
62|Sm|Samarium
63|Eu|Europium
64|Gd|Gadolinium
65|Tb|Terbium
66|Dy|Dysprosium
67|Ho|Holmium
68|Er|Erbium
69|Tm|Thulium
70|Yb|Ytterbium
71|Lu|Lutécium
72|Hf|Hafnium
73|Ta|Tantale
74|W|Tungstène
75|Re|Rhénium
76|Os|Osmium
77|Ir|Iridium
78|Pt|Platine
79|Au|Or
80|Hg|Mercure
81|Tl|Thallium
82|Pb|Plomb
83|Bi|Bismuth
84|Po|Polonium
85|At|Astate
86|Rn|Radon
87|Fr|Francium
88|Ra|Radium
89|Ac|Actinium
90|Th|Thorium
91|Pa|Protactinium
92|U|Uranium
93|Np|Neptunium
94|Pu|Plutonium
95|Am|Américium
96|Cm|Curium
97|Bk|Berkélium
98|Cf|Californium
99|Es|Einsteinium
100|Fm|Fermium
101|Md|Mendélévium
102|No|Nobélium
103|Lr|Lawrencium
104|Rf|Rutherfordium
105|Db|Dubnium
106|Sg|Seaborgium
107|Bh|Bohrium
108|Hs|Hassium
109|Mt|Meitnérium
110|Ds|Darmstadtium
111|Rg|Roentgenium
112|Cn|Copernicium
113|Nh|Nihonium
114|Fl|Flérovium
115|Mc|Moscovium
116|Lv|Livermorium
117|Ts|Tennesse
118|Og|Oganesson`)

// numéro|département|préfecture
export const DEPARTEMENTS = rows(`01|Ain|Bourg-en-Bresse
02|Aisne|Laon
03|Allier|Moulins
04|Alpes-de-Haute-Provence|Digne-les-Bains
05|Hautes-Alpes|Gap
06|Alpes-Maritimes|Nice
07|Ardèche|Privas
08|Ardennes|Charleville-Mézières
09|Ariège|Foix
10|Aube|Troyes
11|Aude|Carcassonne
12|Aveyron|Rodez
13|Bouches-du-Rhône|Marseille
14|Calvados|Caen
15|Cantal|Aurillac
16|Charente|Angoulême
17|Charente-Maritime|La Rochelle
18|Cher|Bourges
19|Corrèze|Tulle
2A|Corse-du-Sud|Ajaccio
2B|Haute-Corse|Bastia
21|Côte-d’Or|Dijon
22|Côtes-d’Armor|Saint-Brieuc
23|Creuse|Guéret
24|Dordogne|Périgueux
25|Doubs|Besançon
26|Drôme|Valence
27|Eure|Évreux
28|Eure-et-Loir|Chartres
29|Finistère|Quimper
30|Gard|Nîmes
31|Haute-Garonne|Toulouse
32|Gers|Auch
33|Gironde|Bordeaux
34|Hérault|Montpellier
35|Ille-et-Vilaine|Rennes
36|Indre|Châteauroux
37|Indre-et-Loire|Tours
38|Isère|Grenoble
39|Jura|Lons-le-Saunier
40|Landes|Mont-de-Marsan
41|Loir-et-Cher|Blois
42|Loire|Saint-Étienne
43|Haute-Loire|Le Puy-en-Velay
44|Loire-Atlantique|Nantes
45|Loiret|Orléans
46|Lot|Cahors
47|Lot-et-Garonne|Agen
48|Lozère|Mende
49|Maine-et-Loire|Angers
50|Manche|Saint-Lô
51|Marne|Châlons-en-Champagne
52|Haute-Marne|Chaumont
53|Mayenne|Laval
54|Meurthe-et-Moselle|Nancy
55|Meuse|Bar-le-Duc
56|Morbihan|Vannes
57|Moselle|Metz
58|Nièvre|Nevers
59|Nord|Lille
60|Oise|Beauvais
61|Orne|Alençon
62|Pas-de-Calais|Arras
63|Puy-de-Dôme|Clermont-Ferrand
64|Pyrénées-Atlantiques|Pau
65|Hautes-Pyrénées|Tarbes
66|Pyrénées-Orientales|Perpignan
67|Bas-Rhin|Strasbourg
68|Haut-Rhin|Colmar
69|Rhône|Lyon
70|Haute-Saône|Vesoul
71|Saône-et-Loire|Mâcon
72|Sarthe|Le Mans
73|Savoie|Chambéry
74|Haute-Savoie|Annecy
75|Paris|Paris
76|Seine-Maritime|Rouen
77|Seine-et-Marne|Melun
78|Yvelines|Versailles
79|Deux-Sèvres|Niort
80|Somme|Amiens
81|Tarn|Albi
82|Tarn-et-Garonne|Montauban
83|Var|Toulon
84|Vaucluse|Avignon
85|Vendée|La Roche-sur-Yon
86|Vienne|Poitiers
87|Haute-Vienne|Limoges
88|Vosges|Épinal
89|Yonne|Auxerre
90|Territoire de Belfort|Belfort
91|Essonne|Évry-Courcouronnes
92|Hauts-de-Seine|Nanterre
93|Seine-Saint-Denis|Bobigny
94|Val-de-Marne|Créteil
95|Val-d’Oise|Cergy
971|Guadeloupe|Basse-Terre
972|Martinique|Fort-de-France
973|Guyane|Cayenne
974|La Réunion|Saint-Denis
976|Mayotte|Mamoudzou`)

// État|capitale
export const US_CAPITALS = rows(`Alabama|Montgomery
Alaska|Juneau
Arizona|Phoenix
Arkansas|Little Rock
Californie|Sacramento
Colorado|Denver
Connecticut|Hartford
Delaware|Dover
Floride|Tallahassee
Géorgie|Atlanta
Hawaï|Honolulu
Idaho|Boise
Illinois|Springfield
Indiana|Indianapolis
Iowa|Des Moines
Kansas|Topeka
Kentucky|Frankfort
Louisiane|Baton Rouge
Maine|Augusta
Maryland|Annapolis
Massachusetts|Boston
Michigan|Lansing
Minnesota|Saint Paul
Mississippi|Jackson
Missouri|Jefferson City
Montana|Helena
Nebraska|Lincoln
Nevada|Carson City
New Hampshire|Concord
New Jersey|Trenton
Nouveau-Mexique|Santa Fe
New York|Albany
Caroline du Nord|Raleigh
Dakota du Nord|Bismarck
Ohio|Columbus
Oklahoma|Oklahoma City
Oregon|Salem
Pennsylvanie|Harrisburg
Rhode Island|Providence
Caroline du Sud|Columbia
Dakota du Sud|Pierre
Tennessee|Nashville
Texas|Austin
Utah|Salt Lake City
Vermont|Montpelier
Virginie|Richmond
Washington|Olympia
Virginie-Occidentale|Charleston
Wisconsin|Madison
Wyoming|Cheyenne`)

// année|vainqueur|pays hôte
export const WORLD_CUPS = rows(`1930|Uruguay|Uruguay
1934|Italie|Italie
1938|Italie|France
1950|Uruguay|Brésil
1954|Allemagne de l’Ouest|Suisse
1958|Brésil|Suède
1962|Brésil|Chili
1966|Angleterre|Angleterre
1970|Brésil|Mexique
1974|Allemagne de l’Ouest|Allemagne de l’Ouest
1978|Argentine|Argentine
1982|Italie|Espagne
1986|Argentine|Mexique
1990|Allemagne de l’Ouest|Italie
1994|Brésil|États-Unis
1998|France|France
2002|Brésil|Corée du Sud et Japon
2006|Italie|Allemagne
2010|Espagne|Afrique du Sud
2014|Allemagne|Brésil
2018|France|Russie
2022|Argentine|Qatar`)

// année|ville|saison
export const OLYMPICS = rows(`1896|Athènes|été
1900|Paris|été
1904|Saint-Louis|été
1908|Londres|été
1912|Stockholm|été
1920|Anvers|été
1924|Paris|été
1928|Amsterdam|été
1932|Los Angeles|été
1936|Berlin|été
1948|Londres|été
1952|Helsinki|été
1956|Melbourne|été
1960|Rome|été
1964|Tokyo|été
1968|Mexico|été
1972|Munich|été
1976|Montréal|été
1980|Moscou|été
1984|Los Angeles|été
1988|Séoul|été
1992|Barcelone|été
1996|Atlanta|été
2000|Sydney|été
2004|Athènes|été
2008|Pékin|été
2012|Londres|été
2016|Rio de Janeiro|été
2021|Tokyo|été
2024|Paris|été
1924|Chamonix|hiver
1928|Saint-Moritz|hiver
1932|Lake Placid|hiver
1936|Garmisch-Partenkirchen|hiver
1948|Saint-Moritz|hiver
1952|Oslo|hiver
1956|Cortina d’Ampezzo|hiver
1960|Squaw Valley|hiver
1964|Innsbruck|hiver
1968|Grenoble|hiver
1972|Sapporo|hiver
1976|Innsbruck|hiver
1980|Lake Placid|hiver
1984|Sarajevo|hiver
1988|Calgary|hiver
1992|Albertville|hiver
1994|Lillehammer|hiver
1998|Nagano|hiver
2002|Salt Lake City|hiver
2006|Turin|hiver
2010|Vancouver|hiver
2014|Sotchi|hiver
2018|Pyeongchang|hiver
2022|Pékin|hiver`)

// œuvre|auteur
export const BOOKS = rows(`Les Misérables|Victor Hugo
Notre-Dame de Paris|Victor Hugo
Les Contemplations|Victor Hugo
Germinal|Émile Zola
L’Assommoir|Émile Zola
Nana|Émile Zola
Le Père Goriot|Honoré de Balzac
Eugénie Grandet|Honoré de Balzac
Madame Bovary|Gustave Flaubert
L’Éducation sentimentale|Gustave Flaubert
Le Rouge et le Noir|Stendhal
La Chartreuse de Parme|Stendhal
Les Trois Mousquetaires|Alexandre Dumas
Le Comte de Monte-Cristo|Alexandre Dumas
Bel-Ami|Guy de Maupassant
Une vie|Guy de Maupassant
À la recherche du temps perdu|Marcel Proust
L’Étranger|Albert Camus
La Peste|Albert Camus
La Nausée|Jean-Paul Sartre
Huis clos|Jean-Paul Sartre
Le Petit Prince|Antoine de Saint-Exupéry
Vol de nuit|Antoine de Saint-Exupéry
Le Tour du monde en quatre-vingts jours|Jules Verne
Vingt Mille Lieues sous les mers|Jules Verne
Voyage au centre de la Terre|Jules Verne
Le Misanthrope|Molière
Tartuffe|Molière
L’Avare|Molière
Le Malade imaginaire|Molière
Phèdre|Jean Racine
Andromaque|Jean Racine
Le Cid|Pierre Corneille
Candide|Voltaire
Zadig|Voltaire
Du contrat social|Jean-Jacques Rousseau
Les Confessions|Jean-Jacques Rousseau
Lettres persanes|Montesquieu
De l’esprit des lois|Montesquieu
Les Fleurs du mal|Charles Baudelaire
Une saison en enfer|Arthur Rimbaud
Alcools|Guillaume Apollinaire
Voyage au bout de la nuit|Louis-Ferdinand Céline
L’Écume des jours|Boris Vian
L’Amant|Marguerite Duras
Le Deuxième Sexe|Simone de Beauvoir
La Gloire de mon père|Marcel Pagnol
Le Grand Meaulnes|Alain-Fournier
Les Liaisons dangereuses|Choderlos de Laclos
Le Mariage de Figaro|Beaumarchais
Cyrano de Bergerac|Edmond Rostand
Manon Lescaut|Abbé Prévost
Gargantua|François Rabelais
Les Essais|Michel de Montaigne
Fables|Jean de La Fontaine
La Cantatrice chauve|Eugène Ionesco
En attendant Godot|Samuel Beckett
Lorenzaccio|Alfred de Musset
Les Faux-monnayeurs|André Gide
Mémoires d’Hadrien|Marguerite Yourcenar
Rue des Boutiques obscures|Patrick Modiano
Les Années|Annie Ernaux
Le Fantôme de l’Opéra|Gaston Leroux
Carmen|Prosper Mérimée
Lettres de mon moulin|Alphonse Daudet
Arsène Lupin, gentleman cambrioleur|Maurice Leblanc
Hamlet|William Shakespeare
Macbeth|William Shakespeare
Othello|William Shakespeare
Don Quichotte|Miguel de Cervantes
La Divine Comédie|Dante
L’Odyssée|Homère
L’Iliade|Homère
Guerre et Paix|Léon Tolstoï
Anna Karénine|Léon Tolstoï
Crime et Châtiment|Fiodor Dostoïevski
Les Frères Karamazov|Fiodor Dostoïevski
1984|George Orwell
La Ferme des animaux|George Orwell
Le Meilleur des mondes|Aldous Huxley
La Métamorphose|Franz Kafka
Le Procès|Franz Kafka
Faust|Goethe
Le Vieil Homme et la Mer|Ernest Hemingway
Les Raisins de la colère|John Steinbeck
Gatsby le Magnifique|F. Scott Fitzgerald
Moby Dick|Herman Melville
Les Aventures de Tom Sawyer|Mark Twain
Oliver Twist|Charles Dickens
Orgueil et Préjugés|Jane Austen
Frankenstein|Mary Shelley
Dracula|Bram Stoker
Le Seigneur des anneaux|J. R. R. Tolkien
Harry Potter à l’école des sorciers|J. K. Rowling
Le Crime de l’Orient-Express|Agatha Christie
Le Chien des Baskerville|Arthur Conan Doyle
Cent ans de solitude|Gabriel García Márquez
Le Nom de la rose|Umberto Eco
L’Attrape-cœurs|J. D. Salinger
Ne tirez pas sur l’oiseau moqueur|Harper Lee
Lolita|Vladimir Nabokov
Le Maître et Marguerite|Mikhaïl Boulgakov
Alice au pays des merveilles|Lewis Carroll
L’Île au trésor|Robert Louis Stevenson
Les Voyages de Gulliver|Jonathan Swift
Robinson Crusoé|Daniel Defoe
Le Livre de la jungle|Rudyard Kipling
Le Portrait de Dorian Gray|Oscar Wilde
Les Hauts de Hurlevent|Emily Brontë
Jane Eyre|Charlotte Brontë
L’Alchimiste|Paulo Coelho
Le Joueur d’échecs|Stefan Zweig
Le Prince|Nicolas Machiavel
L’Art de la guerre|Sun Tzu
La République|Platon
Le Capital|Karl Marx
L’Origine des espèces|Charles Darwin
Fahrenheit 451|Ray Bradbury
Dune|Frank Herbert
Fondation|Isaac Asimov
Croc-Blanc|Jack London
Le Parfum|Patrick Süskind
Le Petit Nicolas|René Goscinny
Bonjour tristesse|Françoise Sagan
Les Fourmis|Bernard Werber
Le Horla|Guy de Maupassant
La Princesse de Clèves|Madame de La Fayette
Les Châtiments|Victor Hugo
Thérèse Raquin|Émile Zola
Les Mémoires d’outre-tombe|François-René de Chateaubriand
Le Lys dans la vallée|Honoré de Balzac
Mrs Dalloway|Virginia Woolf
Ulysse|James Joyce
Le Docteur Jivago|Boris Pasternak
Le Hobbit|J. R. R. Tolkien
Shining|Stephen King
Ça|Stephen King`)

// œuvre|artiste
export const PAINTINGS = rows(`La Joconde|Léonard de Vinci
La Cène|Léonard de Vinci
La Création d’Adam|Michel-Ange
La Naissance de Vénus|Sandro Botticelli
L’École d’Athènes|Raphaël
La Jeune Fille à la perle|Johannes Vermeer
La Ronde de nuit|Rembrandt
La Nuit étoilée|Vincent van Gogh
Les Tournesols|Vincent van Gogh
Impression, soleil levant|Claude Monet
Les Nymphéas|Claude Monet
Le Déjeuner sur l’herbe|Édouard Manet
Olympia|Édouard Manet
Bal du moulin de la Galette|Auguste Renoir
La Classe de danse|Edgar Degas
Un dimanche après-midi à l’île de la Grande Jatte|Georges Seurat
Les Joueurs de cartes|Paul Cézanne
D’où venons-nous ? Que sommes-nous ? Où allons-nous ?|Paul Gauguin
Le Cri|Edvard Munch
Le Baiser|Gustav Klimt
Guernica|Pablo Picasso
Les Demoiselles d’Avignon|Pablo Picasso
La Persistance de la mémoire|Salvador Dalí
La Trahison des images|René Magritte
La Danse|Henri Matisse
La Grande Vague de Kanagawa|Hokusai
La Liberté guidant le peuple|Eugène Delacroix
Le Radeau de La Méduse|Théodore Géricault
Le Sacre de Napoléon|Jacques-Louis David
Un enterrement à Ornans|Gustave Courbet
L’Angélus|Jean-François Millet
La Grande Odalisque|Jean-Auguste-Dominique Ingres
Tres de Mayo|Francisco de Goya
Les Ménines|Diego Velázquez
Le Jardin des délices|Jérôme Bosch
La Tour de Babel|Pieter Bruegel l’Ancien
Les Époux Arnolfini|Jan van Eyck
La Vocation de saint Matthieu|Le Caravage
American Gothic|Grant Wood
Nighthawks|Edward Hopper
Campbell’s Soup Cans|Andy Warhol
Composition VIII|Vassily Kandinsky
Composition avec rouge, jaune et bleu|Piet Mondrian
Les Deux Frida|Frida Kahlo
Pluie, vapeur et vitesse|William Turner
Le Voyageur contemplant une mer de nuages|Caspar David Friedrich
Au Moulin-Rouge|Henri de Toulouse-Lautrec
Pèlerinage à l’île de Cythère|Antoine Watteau
Les Hasards heureux de l’escarpolette|Jean-Honoré Fragonard
Moi et le village|Marc Chagall
Le Penseur|Auguste Rodin
La Liberté éclairant le monde|Auguste Bartholdi
Le Fils de l’homme|René Magritte
Les Glaneuses|Jean-François Millet
La Laitière|Johannes Vermeer`)

// œuvre|compositeur
export const MUSIC = rows(`Symphonie n° 9 « Ode à la joie »|Ludwig van Beethoven
La Lettre à Élise|Ludwig van Beethoven
La Flûte enchantée|Wolfgang Amadeus Mozart
Requiem en ré mineur|Wolfgang Amadeus Mozart
Toccata et fugue en ré mineur|Jean-Sébastien Bach
Les Variations Goldberg|Jean-Sébastien Bach
Les Quatre Saisons|Antonio Vivaldi
Le Lac des cygnes|Piotr Ilitch Tchaïkovski
Casse-Noisette|Piotr Ilitch Tchaïkovski
Carmen (opéra)|Georges Bizet
La Traviata|Giuseppe Verdi
Aïda|Giuseppe Verdi
La Bohème|Giacomo Puccini
Madame Butterfly|Giacomo Puccini
La Chevauchée des Walkyries|Richard Wagner
Boléro|Maurice Ravel
Clair de lune|Claude Debussy
La Mer|Claude Debussy
Gymnopédies|Erik Satie
Rhapsody in Blue|George Gershwin
Les Planètes|Gustav Holst
Carmina Burana|Carl Orff
Symphonie du Nouveau Monde|Antonín Dvořák
Peer Gynt|Edvard Grieg
Le Carnaval des animaux|Camille Saint-Saëns
Tableaux d’une exposition|Modeste Moussorgski
Le Barbier de Séville|Gioachino Rossini
Orphée aux Enfers|Jacques Offenbach
Le Messie|Georg Friedrich Haendel
Le Beau Danube bleu|Johann Strauss II
La Moldau|Bedřich Smetana
Pierre et le Loup|Sergueï Prokofiev
Le Sacre du printemps|Igor Stravinsky
Le Vol du bourdon|Nikolaï Rimski-Korsakov
Canon en ré majeur|Johann Pachelbel
La Truite|Franz Schubert
Marche nuptiale|Felix Mendelssohn
Pomp and Circumstance|Edward Elgar
Les Noces de Figaro|Wolfgang Amadeus Mozart
Thriller (album)|Michael Jackson
Imagine|John Lennon
Ne me quitte pas|Jacques Brel
La Mer (chanson)|Charles Trenet
Les Champs-Élysées|Joe Dassin
Je ne regrette rien|Édith Piaf
Comme d’habitude|Claude François
La Bohème (chanson)|Charles Aznavour
L’Aigle noir|Barbara
Le Poinçonneur des Lilas|Serge Gainsbourg
Alors on danse|Stromae`)

// film|réalisateur
export const FILMS = rows(`Titanic|James Cameron
Avatar|James Cameron
Terminator|James Cameron
Jurassic Park|Steven Spielberg
E.T. l’extra-terrestre|Steven Spielberg
Les Dents de la mer|Steven Spielberg
La Liste de Schindler|Steven Spielberg
Le Parrain|Francis Ford Coppola
Apocalypse Now|Francis Ford Coppola
Pulp Fiction|Quentin Tarantino
Kill Bill|Quentin Tarantino
Inception|Christopher Nolan
Interstellar|Christopher Nolan
Oppenheimer|Christopher Nolan
Le Seigneur des anneaux : La Communauté de l’anneau|Peter Jackson
Star Wars (1977)|George Lucas
Psychose|Alfred Hitchcock
Vertigo|Alfred Hitchcock
Les Oiseaux|Alfred Hitchcock
2001 : l’Odyssée de l’espace|Stanley Kubrick
Shining (film)|Stanley Kubrick
Orange mécanique|Stanley Kubrick
Taxi Driver|Martin Scorsese
Les Affranchis|Martin Scorsese
Forrest Gump|Robert Zemeckis
Retour vers le futur|Robert Zemeckis
Alien|Ridley Scott
Gladiator|Ridley Scott
Blade Runner|Ridley Scott
Fight Club|David Fincher
Seven|David Fincher
Le Fabuleux Destin d’Amélie Poulain|Jean-Pierre Jeunet
Le Dîner de cons|Francis Veber
La Grande Vadrouille|Gérard Oury
Les Visiteurs|Jean-Marie Poiré
Le Grand Bleu|Luc Besson
Léon|Luc Besson
Le Cinquième Élément|Luc Besson
Les Quatre Cents Coups|François Truffaut
Jules et Jim|François Truffaut
À bout de souffle|Jean-Luc Godard
Le Mépris|Jean-Luc Godard
La Haine|Mathieu Kassovitz
Bienvenue chez les Ch’tis|Dany Boon
Les Parapluies de Cherbourg|Jacques Demy
Amour|Michael Haneke
Parasite|Bong Joon-ho
Le Voyage de Chihiro|Hayao Miyazaki
Mon voisin Totoro|Hayao Miyazaki
Les Sept Samouraïs|Akira Kurosawa
La vie est belle (1997)|Roberto Benigni
La dolce vita|Federico Fellini
Le Bon, la Brute et le Truand|Sergio Leone
Il était une fois dans l’Ouest|Sergio Leone
Citizen Kane|Orson Welles
Les Temps modernes|Charlie Chaplin
Le Dictateur|Charlie Chaplin
Casablanca|Michael Curtiz
Barbie|Greta Gerwig
La La Land|Damien Chazelle
Whiplash|Damien Chazelle
Joker|Todd Phillips
Le Silence des agneaux|Jonathan Demme
Les Évadés|Frank Darabont
Mad Max: Fury Road|George Miller
Dune (2021)|Denis Villeneuve
Black Swan|Darren Aronofsky
The Truman Show|Peter Weir
Le Pianiste|Roman Polanski
The Revenant|Alejandro González Iñárritu
Gravity|Alfonso Cuarón
Le Labyrinthe de Pan|Guillermo del Toro
Slumdog Millionaire|Danny Boyle
Trainspotting|Danny Boyle
Jeux interdits|René Clément
La Grande Illusion|Jean Renoir
Le Salaire de la peur|Henri-Georges Clouzot
Les Tontons flingueurs|Georges Lautner
The Artist|Michel Hazanavicius
OSS 117 : Le Caire, nid d’espions|Michel Hazanavicius
Astérix et Obélix : Mission Cléopâtre|Alain Chabat
Intouchables|Olivier Nakache et Éric Toledano
Anatomie d’une chute|Justine Triet
Portrait de la jeune fille en feu|Céline Sciamma
Les Misérables (2019)|Ladj Ly
Drive|Nicolas Winding Refn
Avengers: Endgame|Anthony et Joe Russo
Toy Story|John Lasseter
Le Château dans le ciel|Hayao Miyazaki
Lawrence d’Arabie|David Lean`)

// invention ou découverte|personne
export const INVENTIONS = rows(`Le téléphone|Alexander Graham Bell
L’imprimerie à caractères mobiles|Johannes Gutenberg
La radio|Guglielmo Marconi
Le code télégraphique à points et traits|Samuel Morse
La dynamite|Alfred Nobel
Le vaccin contre la rage|Louis Pasteur
Le cinématographe|Auguste et Louis Lumière
La photographie|Nicéphore Niépce
Le premier vol motorisé (1903)|Orville et Wilbur Wright
Le moteur Diesel|Rudolf Diesel
La pile électrique|Alessandro Volta
Le paratonnerre|Benjamin Franklin
Le perfectionnement de la machine à vapeur|James Watt
L’écriture pour aveugles|Louis Braille
Le stéthoscope|René Laennec
La montgolfière|Joseph et Étienne de Montgolfier
La machine à coudre|Barthélemy Thimonnier
La Pascaline|Blaise Pascal
Le World Wide Web|Tim Berners-Lee
Les rayons X|Wilhelm Röntgen
La radioactivité|Henri Becquerel
La pénicilline|Alexander Fleming
La théorie de l’évolution par sélection naturelle|Charles Darwin
La loi de la gravitation universelle|Isaac Newton
La théorie de la relativité|Albert Einstein
Le tableau périodique des éléments|Dmitri Mendeleïev
Le moteur à courant alternatif|Nikola Tesla
Le phonographe|Thomas Edison
La télévision mécanique|John Logie Baird
La machine analytique|Charles Babbage
Le premier programme informatique|Ada Lovelace
Le vaccin contre la variole|Edward Jenner
La structure en double hélice de l’ADN|James Watson et Francis Crick
Le pendule démontrant la rotation de la Terre|Léon Foucault
Le stylo à bille moderne|László Bíró
La carte à puce|Roland Moreno
Le scaphandre autonome|Jacques-Yves Cousteau et Émile Gagnan
L’héliocentrisme moderne|Nicolas Copernic
Les lois du mouvement des planètes|Johannes Kepler
Le polonium et le radium|Marie et Pierre Curie
Le vaccin contre la poliomyélite (injectable)|Jonas Salk
La pasteurisation|Louis Pasteur
Le paratonnerre et les lunettes à double foyer|Benjamin Franklin
L’ampoule électrique à incandescence durable|Thomas Edison`)

// événement|année (négatif = av. J.-C.)
export const EVENTS = rows(`Fondation légendaire de Rome|-753
Bataille d’Alésia|-52
Assassinat de Jules César|-44
Chute de l’Empire romain d’Occident|476
Bataille de Poitiers contre les Omeyyades|732
Couronnement de Charlemagne comme empereur|800
Traité de Verdun|843
Hugues Capet devient roi des Francs|987
Bataille de Hastings|1066
Prise de Jérusalem lors de la première croisade|1099
Signature de la Magna Carta|1215
Arrivée de la peste noire en Europe|1347
Jeanne d’Arc brûlée à Rouen|1431
Prise de Constantinople par les Ottomans|1453
Christophe Colomb atteint l’Amérique|1492
Vasco de Gama atteint l’Inde par la mer|1498
Bataille de Marignan|1515
Luther affiche ses 95 thèses|1517
Fin du premier tour du monde (expédition Magellan)|1522
Massacre de la Saint-Barthélemy|1572
Édit de Nantes|1598
Fondation de Québec|1608
Assassinat d’Henri IV|1610
Condamnation de Galilée|1633
Révocation de l’édit de Nantes|1685
Mort de Louis XIV|1715
Déclaration d’indépendance des États-Unis|1776
Prise de la Bastille|1789
Exécution de Louis XVI|1793
Sacre de Napoléon Ier|1804
Bataille d’Austerlitz|1805
Bataille de Waterloo|1815
Indépendance du Brésil|1822
Révolution de Juillet|1830
Abolition de l’esclavage en France|1848
Début de la guerre de Sécession|1861
Proclamation du royaume d’Italie|1861
Abolition de l’esclavage aux États-Unis (13e amendement)|1865
Inauguration du canal de Suez|1869
Proclamation de la IIIe République|1870
Commune de Paris|1871
Proclamation de l’Empire allemand|1871
Inauguration de la tour Eiffel|1889
Condamnation du capitaine Dreyfus|1894
Première projection publique des frères Lumière|1895
Premiers Jeux olympiques modernes|1896
Loi de séparation des Églises et de l’État|1905
Naufrage du Titanic|1912
Début de la Première Guerre mondiale|1914
Ouverture du canal de Panama|1914
Révolution d’Octobre en Russie|1917
Armistice de la Première Guerre mondiale|1918
Traité de Versailles|1919
Marche sur Rome de Mussolini|1922
Krach de Wall Street|1929
Hitler devient chancelier|1933
Front populaire en France|1936
Début de la Seconde Guerre mondiale|1939
Appel du 18 Juin du général de Gaulle|1940
Attaque de Pearl Harbor|1941
Débarquement en Normandie|1944
Bombardement atomique d’Hiroshima|1945
Création de l’ONU|1945
Indépendance de l’Inde|1947
Création de l’État d’Israël|1948
Proclamation de la République populaire de Chine|1949
Création de l’OTAN|1949
Début de la guerre de Corée|1950
Lancement de Spoutnik 1|1957
Signature du traité de Rome|1957
Naissance de la Ve République|1958
Premier vol spatial habité (Youri Gagarine)|1961
Construction du mur de Berlin|1961
Indépendance de l’Algérie|1962
Crise des missiles de Cuba|1962
Assassinat de John F. Kennedy|1963
Mai 68|1968
Premiers pas sur la Lune|1969
Chute de Saïgon|1975
Premier vol commercial du Concorde|1976
Abolition de la peine de mort en France|1981
Catastrophe de Tchernobyl|1986
Chute du mur de Berlin|1989
Réunification allemande|1990
Dissolution de l’URSS|1991
Traité de Maastricht|1992
Élection de Nelson Mandela|1994
Inauguration du tunnel sous la Manche|1994
Création de Google|1998
Attentats du 11 septembre|2001
Mise en circulation des pièces et billets en euros|2002
Lancement de Facebook|2004
Présentation du premier iPhone|2007
Élection de Barack Obama|2008
Catastrophe nucléaire de Fukushima|2011
Référendum sur le Brexit|2016
Incendie de Notre-Dame de Paris|2019
L’OMS déclare la pandémie de Covid-19|2020`)

// pays|monnaie
export const CURRENCIES = rows(`Japon|le yen
Chine|le yuan
Royaume-Uni|la livre sterling
États-Unis|le dollar américain
Suisse|le franc suisse
Russie|le rouble
Inde|la roupie indienne
Brésil|le réal
Mexique|le peso mexicain
Canada|le dollar canadien
Australie|le dollar australien
Corée du Sud|le won
Afrique du Sud|le rand
Turquie|la livre turque
Suède|la couronne suédoise
Norvège|la couronne norvégienne
Danemark|la couronne danoise
Pologne|le złoty
Tchéquie|la couronne tchèque
Hongrie|le forint
Roumanie|le leu
Israël|le shekel
Arabie saoudite|le riyal saoudien
Maroc|le dirham marocain
Égypte|la livre égyptienne
Thaïlande|le baht
Viêt Nam|le dông
Indonésie|la roupie indonésienne
Malaisie|le ringgit
Philippines|le peso philippin
Argentine|le peso argentin
Pérou|le sol
Nigeria|le naira
Kenya|le shilling kényan
Ukraine|la hryvnia
Islande|la couronne islandaise
Albanie|le lek
Serbie|le dinar serbe
Croatie|l’euro
Ghana|le cedi
Éthiopie|le birr
Tunisie|le dinar tunisien
Algérie|le dinar algérien
Nouvelle-Zélande|le dollar néo-zélandais
Venezuela|le bolivar
Mongolie|le tugrik
Géorgie|le lari
Arménie|le dram
Azerbaïdjan|le manat azerbaïdjanais
Kazakhstan|le tenge
Cambodge|le riel
Laos|le kip
Birmanie|le kyat
Guatemala|le quetzal
Costa Rica|le colón
Paraguay|le guarani
Bolivie|le boliviano
Haïti|la gourde
Botswana|le pula
Angola|le kwanza
Mozambique|le metical
Sénégal|le franc CFA
Madagascar|l’ariary
Bangladesh|le taka
Iran|le rial iranien
Panama|le balboa`)

// pays|langue officielle
export const LANGUAGES = rows(`Brésil|le portugais
Mexique|l’espagnol
Égypte|l’arabe
Iran|le persan
Israël|l’hébreu
Pakistan|l’ourdou
Bangladesh|le bengali
Chine|le mandarin
Japon|le japonais
Viêt Nam|le vietnamien
Thaïlande|le thaï
Indonésie|l’indonésien
Turquie|le turc
Grèce|le grec
Hongrie|le hongrois
Estonie|l’estonien
Lettonie|le letton
Lituanie|le lituanien
Pologne|le polonais
Roumanie|le roumain
Albanie|l’albanais
Islande|l’islandais
Malte|le maltais
Éthiopie|l’amharique
Tanzanie|le swahili
Kazakhstan|le kazakh
Ouzbékistan|l’ouzbek
Mongolie|le mongol
Géorgie|le géorgien
Arménie|l’arménien
Suriname|le néerlandais
Angola|le portugais
Mozambique|le portugais
Andorre|le catalan
Pays-Bas|le néerlandais
Autriche|l’allemand
Danemark|le danois
Norvège|le norvégien
Suède|le suédois
Ukraine|l’ukrainien
Bulgarie|le bulgare
Serbie|le serbe
Croatie|le croate
Slovénie|le slovène
Slovaquie|le slovaque
Tchéquie|le tchèque
Laos|le lao
Cambodge|le khmer
Birmanie|le birman
Népal|le népalais
Somalie|le somali
Malaisie|le malais
Cap-Vert|le portugais
Argentine|l’espagnol
Colombie|l’espagnol
Corée du Sud|le coréen
Finlande|le finnois
Philippines|le filipino`)

// animal|petit|cri (verbe)
export const ANIMALS = rows(`la vache|le veau|meugle
le cheval|le poulain|hennit
le mouton|l’agneau|bêle
la chèvre|le chevreau|chevrote
le cochon|le porcelet|grogne
le lapin|le lapereau|clapit
la poule|le poussin|caquette
le canard|le caneton|cancane
l’oie|l’oison|cacarde
le chien|le chiot|aboie
le chat|le chaton|miaule
le loup|le louveteau|hurle
le renard|le renardeau|glapit
l’ours|l’ourson|grogne
le lion|le lionceau|rugit
l’éléphant|l’éléphanteau|barrit
le cerf|le faon|brame
le sanglier|le marcassin|grommelle
le lièvre|le levraut|vagit
la grenouille|le têtard|coasse
l’aigle|l’aiglon|glatit
la baleine|le baleineau|
l’âne|l’ânon|brait
la souris|le souriceau|couine
le chameau|le chamelon|blatère
la girafe|le girafon|
la perdrix|le perdreau|cacabe
le cygne|le cygneau|
le pigeon|le pigeonneau|roucoule
le corbeau|le corbillat|croasse`)
