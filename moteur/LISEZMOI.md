# Moteur d'animation (Remotion)

Le moteur compose toute la vidéo à partir de deux fichiers :

- `ma-charte.json` (à la racine du dépôt) : couleurs, polices, sous-titres, réglages des animations (section `moteur`), logo (`marque`, `fin.signature`) ;
- un fichier `effets.json` propre à chaque vidéo : le rush, les temps des mots et la liste des animations, avec des temps en secondes.

## Lancer

```bash
cd moteur
npm install                                    # une seule fois
node scripts/stills.mjs  CHEMIN/effets.json    # images fixes de contrôle seulement (planche)
node scripts/rendu.mjs   CHEMIN/effets.json    # images fixes + vidéo complète
```

Options de `rendu.mjs` : `--nom NOM` (nom des fichiers), `--sortie DOSSIER` (par défaut `moteur/sortie/`), `--sans-stills`, `--sans-4x5`, `--images 0-89` (une partie seulement).

Ce que produit un rendu, dans `sortie/` :

- `NOM_planche.png` et `NOM_stills/` : une image fixe par animation, à regarder **avant** de valider ;
- `NOM_9x16.mp4` (1080×1920) et `NOM_4x5.mp4` (1080×1350, recadrage centré) ;
- son ramené à -14 LUFS, crête à -1 dBTP.

Essai fourni : `python3 essai/fabriquer_essai.py` (faux face-cam + voix ElevenLabs, une seule fois) puis `node scripts/rendu.mjs essai/effets.json --nom essai`.

Navigateur : le moteur utilise le Chromium préinstallé (`/opt/pw-browsers`). Si Remotion plante au démarrage (« Target closed », « icudtl.dat »), il réessaie seul en mode `chrome-for-testing`. Variables utiles : `MOTEUR_NAVIGATEUR`, `MOTEUR_NAVIGATEUR_CFT`, `MOTEUR_CHROME_MODE=chrome-for-testing`.

## Format d'effets.json

Les chemins sont relatifs au fichier. Exemple complet : `essai/effets.json`.

```json
{
  "duree": 10, "fps": 30,
  "rush": {"video": "media/rush.mp4", "mots": "media/mots.json", "voix": "media/voix.wav"},
  "musique": {"fichier": "media/musique.mp3", "actif": true},
  "sous_titres": {"mode": "mot_a_mot", "mots_cles": ["LOCALISY", "doublé"], "phrases_fortes": []},
  "camera": {"visage": [0.5, 0.37], "coupes": [2.76, 4.93]},
  "ambiance": {"grain": 0.07, "etalonnage": true, "chapitres": [{"titre": "Avant", "debut": 0}]},
  "effets": [ ... ]
}
```

- `rush.mots` : temps de chaque mot, au format `[{"mot", "debut", "fin"}]` ou au format brut d'ElevenLabs Scribe (`words`). `rush.voix` est facultatif (sinon on garde le son du rush).
- `sous_titres.mode` : `mot_a_mot` (par défaut), `premiere_video` (rendu exact de la première vidéo, incrusté après coup par `outils/sous_titres.py`, avec ses `phrases_fortes`) ou `aucun`.
- `camera.visage` : position des yeux dans l'image (0 à 1). Les zooms sont centrés là.
- `camera.coupes` : instants des coupes. Le cadrage change à chaque coupe, et l'image avance lentement pendant chaque plan.
- `musique` : facultative. Elle est jouée 20 dB sous la voix et baisse encore de 6 dB quand on parle (réglages dans `moteur.musique`).

### Les animations (`effets`)

| type | champs | rôle |
|---|---|---|
| `accroche` | `debut`, `fin`, `titre`, `surtitre` (facultatif), `mot_accent` (facultatif), `style` (facultatif) | Titre écrit lettre par lettre, sous le visage, juste au-dessus des sous-titres ; l'image ne bouge pas. Sur un cadrage très serré (menton bas), vérifier sur les images fixes que le titre ne touche pas le menton. La 1re accroche ouvre la vidéo ; les suivantes (ex. le nom) prennent le style `presentation`, plus discret. |
| `grand_titre` | `debut`, `fin`, `lignes`, `mot_accent` | Phrase choc en 3D, visage flouté derrière. |
| `icone` | `debut`, `fin`, `icone`, `mot` (conseillé), ou `x`, `y`, `taille` | `courbe`, `etoile`, `epingle`, `panier`, `coeur`, `bulle`, `cible`, `etincelle`, `ia` (puce « IA »). Rebond + particules. Avec `mot`, l'icône se pose juste au-dessus de ce mot dans les sous-titres et y reste jusqu'à `fin`, même si la ligne change (jamais sur le visage). |
| `chiffre` | `debut`, `fin`, `valeur`, `de`, `prefixe`, `suffixe`, `decimales`, `legende` | Le chiffre défile jusqu'à sa valeur. |
| `carte` | `debut`, `fin`, `animation` + champs ci-dessous | La vidéo se réduit en carte arrondie, l'animation joue à côté. |
| `liste` | `debut`, `fin`, `items`, `temps`, `y` | Pastilles sous le visage, une par élément, qui glissent quand elles sont dites et restent affichées. Pas de cadrage serré pendant la liste. |
| `plan_de_coupe` | `debut`, `fin`, `fichier`, `debut_clip` | Vidéo d'illustration (libre de droits) en plein écran, sans son : la voix continue. |
| `zoom` | `debut`, `a`, `duree`, `fin` (facultatif) | Zoom avec flou de mouvement. |
| `transition` | `debut` (instant de la coupe), `style`, `duree` | `lumiere` (lumière colorée) ou `panoramique` (panoramique rapide). |
| `carte_fin` | `debut`, `fin`, `nom`, `role` | Carte de fin. Si `nom` vaut « LOCALISY », c'est le logo qui s'affiche. |
| `signature` | `debut`, `fin`, `y` (facultatifs) | Logo LOCALISY discret (charte `fin.signature`), par défaut sur les 2 dernières secondes. `y` remplace la hauteur de la charte pour une vidéo (ex. 1450, sous les sous-titres, si le visage est cadré haut). |

Champs des cartes :

- `chat_ia` : `titre`, `message` (se tape tout seul), `reponse` ;
- `entonnoir` : `titre`, `etapes: [{"label", "valeur"}]` (`valeur` facultative), `temps_etapes` (facultatif, secondes absolues) ;
- `gros_chiffre` : `titre`, `valeur`, `prefixe`, `suffixe`, `decimales`, `legende`, ou bien `texte` (texte fixe, sans comptage) ;
- `checklist` : `titre`, `items`, `coches` (facultatif, secondes absolues).

Chaque animation déclenche un son discret (whoosh, montée, impact, scintillement, pop, frappe), généré par `scripts/sons.mjs` avec ffmpeg. Ajoute `"son": false` à une animation pour le couper.

## Organisation

- `scripts/preparer.mjs` : toute la logique (groupes de sous-titres, temps des animations, sons). Écrit `public/projet.json`.
- `src/couches/*.tsx`, `src/cartes/*.tsx` : le dessin de chaque animation (React).
- `public/` : rempli automatiquement (polices, logo, sons, médias). Rien à y mettre à la main, rien de suivi dans git.

Licence Remotion : gratuite pour un particulier ou une entreprise de 3 salariés maximum, licence entreprise payante au-delà (voir `node_modules/remotion/LICENSE.md`).
