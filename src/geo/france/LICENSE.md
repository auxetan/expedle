# Départements de France

`departements.json` vient d'ADMIN EXPRESS COG CARTO PE (petite échelle), édition 2026 (1er janvier 2026), de l'IGN : couche `departement`, téléchargée le 29 octobre 2026 depuis le service WFS de la Géoplateforme (https://data.geopf.fr/wfs, couche `ADMINEXPRESS-COG-CARTO-PE.2026:departement`, en WGS 84).

Source : IGN, ADMIN EXPRESS COG CARTO PE 2026 — Licence Ouverte / Open Licence version 2.0 d'Etalab (https://www.etalab.gouv.fr/wp-content/uploads/2018/11/open-licence.pdf).

Modifications :

- les cinq départements d'outre-mer sont rapprochés de la métropole, au sud-ouest, chacun à sa propre échelle dans un cadre de 120 km de côté (objet `cadres`). Le placement est fait dans la projection du jeu (conique conforme, parallèles 44° et 49°, méridien central 3° E, comme Lambert-93), puis ramené en longitude et latitude : leurs coordonnées ne sont donc plus géographiques ;
- conversion en TopoJSON (topojson-server 3.0.1), simplification de Visvalingam en gardant 15 % des points, retrait des petites îles isolées (topojson-simplify 3.0.3) et quantification sur 10 000 pas (topojson-client 3.1.0) ;
- chaque département ne garde que son code INSEE ; les noms viennent du jeu.

Les régions sont recomposées dans le jeu à partir de leurs départements. Ces données modifiées restent sous la Licence Ouverte 2.0.
