# Lutin de Noël — bon cadeau Mobilier Fortemps

Animation 3D de 16,5 secondes, inspirée de la vidéo « casse-noisette + COMING SOON » :
un lutin en bois peint entre par la droite en tirant une corde, s'arrête au milieu pour
faire coucou à la caméra, repart et sort à gauche. Au bout de la corde arrive une luge
qui porte le bon cadeau Fortemps. Elle s'arrête au centre, un reflet passe sur la carte,
puis le texte apparaît : « DÉCOUVREZ NOS / BONS CADEAUX / CHEZ MOBILIER FORTEMPS ».

Tout est fabriqué par du code : décor peint puis flouté comme par un objectif (bokeh),
scène 3D avec three.js rendue dans Chromium sans écran, finitions avec Python.

## Fabriquer la vidéo

L'image de la carte (fournie par le client) n'est pas dans le dépôt. Copie-la d'abord
dans ce dossier sous le nom `carte_source.png`.

```
cd animations/lutin-fortemps
npm install
pip3 install numpy scipy pillow
python3 preparer_carte.py carte_source.png      # -> carte_texture.png
python3 fond.py fond.png                        # décor : sapin flou + neige (15 s)
node rendu.mjs images 1.6,4.3,6.5,10.5,13       # images fixes de contrôle -> images/
node rendu.mjs video brut.mkv                   # rendu complet sans perte (~12 min)
python3 finition.py brut.mkv brut_coins.json lutin_9x16.mp4 lutin_4x5.mp4
```

Pour vérifier des images finies (avec texte) sans tout exporter :
`python3 finition.py brut.mkv brut_coins.json x x --images 12.5,13.5,16 images`

## Les fichiers

| Fichier | Rôle |
|---|---|
| `fond.py` | Décor fixe 1080×1920 : mur, sapin, guirlandes, boules, cadeaux, neige. Flou d'objectif calculé selon la distance. |
| `scene.js` | Scène 3D : lutin articulé (marche à reculons, coucou, clignements, bonnet qui ballotte), corde rayée, luge, carte. La chronologie est en haut du fichier (objet `T`). |
| `index.html` | Page chargée par Chromium. |
| `rendu.mjs` | Pilote Chromium : images fixes ou vidéo complète à 30 images/s (FFV1 sans perte) + position de la carte à l'écran. |
| `texte.py` | Calques de texte en Figtree (SemiBold, Black, Bold) avec ombre douce. |
| `finition.py` | Zoom lent final, reflet et étoile sur la carte, halo sombre + texte animé, vignette, grain, exports 9:16 et 4:5. |
| `preparer_carte.py` | Découpe la carte dans l'image du client et nettoie les coins. |

## Réglages faciles

- Vitesses, durée de la pause, longueur de la corde : objet `T` au début de `scene.js`.
- Couleurs du lutin : objet `M` dans `scene.js` (tunique `vert`, bonnet `feutre`, etc.).
- Texte : variante 3 dans `texte.py` (`calques(3)`), utilisée par `finition.py`.
- Le son n'est pas inclus (piste muette) : ajouter une musique dans Instagram ou TikTok.
