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
  "sous_titres": {"mode": "premiere_video", "phrases_fortes": [
    {"debut": 15.28, "lignes": [[{"mot": "si on voulait", "role": "appui"}], [{"mot": "évoluer,", "role": "choc"}]]}
  ]},
  "camera": {"visage": [0.5, 0.37], "coupes": [2.76, 4.93]},
  "ambiance": {"grain": 0.07, "etalonnage": true, "chapitres": [{"titre": "Avant", "debut": 0}]},
  "effets": [ ... ]
}
```

- `rush.mots` : temps de chaque mot, au format `[{"mot", "debut", "fin"}]` ou au format brut d'ElevenLabs Scribe (`words`). `rush.voix` est facultatif (sinon on garde le son du rush).
- `sous_titres.mode` : `premiere_video` (par défaut : rendu de la vidéo INCENDIE, incrusté après coup par `outils/sous_titres.py`), `mot_a_mot` ou `aucun`.
- `sous_titres.phrases_fortes` : passages importants. Pour chaque bloc, `debut` (le temps du premier mot, à peu près) et les `lignes` de `{mot, role}` (rôles : `liaison`, `liaison_gras`, `appui`, `fort`, `choc`, un seul `choc`). Les mots doivent se suivre comme ils sont dits ; le moteur trouve seul le temps de chaque mot, retire ces mots des sous-titres normaux et fait finir le bloc avant le mot suivant. 2 lignes, et vérifier que le bloc tient dans l'écran.
- `remplace` (liste de mots) ou `remplace_temps` (liste d'intervalles `[debut, fin]`) sur n'importe quelle animation : ces mots ne sont pas répétés dans les sous-titres (pas de doublon avec un titre, un chiffre, une carte…).
- `camera.masques` : dossier des masques de détourage (`outils/detourage.py`), pour `texte_derriere`.
- `camera.visage` : position des yeux dans l'image (0 à 1). Les zooms sont centrés là.
- `camera.coupes` : instants des coupes. Le cadrage change à chaque coupe, et l'image avance lentement pendant chaque plan.
- `musique` : facultative. Elle est jouée 20 dB sous la voix et baisse encore de 6 dB quand on parle (réglages dans `moteur.musique`).

### Les animations (`effets`)

**Charte (22/10/2026)** : toutes les vidéos n'utilisent que les animations de la vidéo de Gary : `accroche`, `texte_derriere`, `chiffre`, `ecran_chat`, `carte_verre`, `liste`, `plan_de_coupe`, `zoom` (doux), avec les phrases fortes et les sous-titres INCENDIE, plus la page sombre à flèche (`page`, `fond: "sombre"`, `code_barres: false`, éléments `etiquette` / `grand` / `petit` / `fleche` / `grand`, `largeur` en px pour choisir où le texte passe à la ligne), que l'utilisateur adore. `chiffre` : `legende` accepte `\n` pour deux lignes. `liste` : `numeros: false` pour des pastilles sans numéro. Les autres lignes du tableau restent disponibles mais sont hors charte : ne pas les utiliser sans demande.

| type | champs | rôle |
|---|---|---|
| `accroche` | `debut`, `fin`, `titre`, `surtitre` (facultatif), `mot_accent` (facultatif), `style` (facultatif), `sur_la_ligne` (titre posé sur la ligne des sous-titres), `lettres_par_s` et `delai_titre` (frappe plus rapide, pour un titre qui s'écrit pendant qu'il est dit) | Titre écrit lettre par lettre, sous le visage, juste au-dessus des sous-titres ; l'image ne bouge pas. Sur un cadrage très serré (menton bas), vérifier sur les images fixes que le titre ne touche pas le menton. La 1re accroche ouvre la vidéo ; les suivantes (ex. le nom) prennent le style `presentation`, plus discret. |
| `grand_titre` | `debut`, `fin`, `lignes`, `mot_accent` | Phrase choc en 3D, visage flouté derrière. Plus utilisé : l'agence préfère `texte_derriere`. |
| `texte_derriere` | `debut`, `fin`, `texte`, `taille`, `y`, `x`, `remplace`, `riser`, `intervalle`, `entree` | Mot géant derrière la tête, la personne détourée passe devant. Toujours parfaitement lisible : au-dessus de la tête. `riser: true` (accroche) : riser qui finit au début du mot, puis coup sourd ; `riser: "riser_aspire"` (avec `riser_duree: 1.6`) ou `riser: "riser_pulsations"` (`riser_duree: 1.7`) ou `riser: "riser_inverse"` (`riser_duree: 0.85`, court : pour un résultat dit dans la première seconde) pour les autres risers. `entree` : `rebond` aussi (le mot surgit petit et rebondit) et `traverse` (le mot passe au-dessus de la tête de gauche à droite : entrée rapide à `debut`, glisse de `x_arrivee` à `x_depart_sortie`, sortie rapide à `fin`, flou de vitesse). `couleur` et `ombre: true` pour un mot blanc lisible sur un fond sombre. `entree` : lettres une à une (par défaut), `impact` (le mot tombe d'un coup, net, avec un léger zoom arrière) ou `montee` (le mot sort de derrière la tête, lettre après lettre). |
| `titre_empile` | `debut`, `fin`, `lignes` (`{texte, style: petit|grand|evidence, temps?, taille?}`), `y` | Phrase empilée sur le buste, sous le visage (comme « COLLEGE STUDENT » dans la référence) : petites et grandes lignes, chaque mot arrive quand il est dit, `evidence` en italique avec relief. Remplace les sous-titres (mettre `remplace_temps`). |
| `barre_recherche` | `debut`, `fin`, `texte`, `frappe`, `fin_frappe`, `invite`, `y`, `largeur` | Barre de recherche « IA » (étincelle, bouton envoyer) sous le visage ; le texte s'y tape au rythme de la voix. |
| `barres_comparees` | `debut`, `fin`, `titre`, `lignes` (`{label, valeur 0–1, temps, duree?}`), `cle`, `label`, `y` | Barres qui se remplissent (ex. avant / aujourd'hui), le résultat (`label`, « ×2 ») surgit au bout de la dernière à `cle`. Ne montrer que des rapports dits par la personne. |
| `courbe_derriere` | `debut`, `cle`, `fin`, `label`, `depart`, `points`, `epaisseur`, `riser`, `riser_duree` | Courbe de croissance blanche qui se dessine derrière la personne (détourée devant) et accélère avec le riser ; au moment `cle`, l'étiquette du résultat (`label`, ex. « ×2 ») surgit au bout, en haut à droite. Autre élément « derrière la tête » que le mot géant. |
| `titre_bandeau` | `debut`, `fin`, `titre` ou `lignes`, `variante` (`nom`), `surtitre`, `position` (`sous_titres`), `temps_lignes`, `sortie_s` | Famille « étiquettes » : une ligne par bandeau noir, dévoilé par un balayage, sous le visage au-dessus des sous-titres (accroche). Variante `nom` : un bandeau sur la ligne des sous-titres pour la présentation (avec `remplace_temps`). |
| `compteur` | `debut`, `fin`, `valeur`, `prefixe`, `suffixe`, `legende`, `y`, `duree_comptage` | Chiffre à rouleaux (compteur mécanique) dans une boîte noire, légende dans une étiquette blanche en dessous. |
| `frise` | `debut`, `fin`, `titre`, `items` (`{texte, etape}`), `temps`, `x`, `y` | Frise chronologique : une ligne descend, un losange par étape, étiquette noire à côté ; l'étape en cours est pleine, les autres s'estompent. Pour une histoire racontée étape par étape. |
| `page` | `debut`, `fin`, `fond` (`clair` ou `sombre`), `elements`, `source`, `cote_gauche`, `cote_droit`, `flash`, `son_entree` | Famille « pages » (vidéo de référence « Claude Edit ») : page plein écran. `elements` dans l'ordre, de haut en bas : `petit`, `italique`, `grand` (textes qui s'écrivent mot à mot quand ils sont dits ; `temps` pour forcer), `cle` (mot dans une boîte, cadre de sélection), `appel`, `etiquette` (petit titre espacé), `image` (`fichier` fourni par l'utilisateur : flou → net, flotte), `vs` (trait qui se dessine ; ce qui est avant s'estompe quand la suite arrive) ou `fleche` (flèche vers le bas : « on y arrive »). `code_barres: false` enlève le code-barres ; `signature: {nom, mention, temps, y}` affiche le nom du client en bas (trait, nom espacé, mention en italique fin). Les sous-titres et les phrases fortes sont retirés pendant la page. Flash blanc à l'entrée et à la sortie. |
| `etiquettes_flottantes` | `debut`, `fin`, `items`, `temps`, `contexte`, `y` | Étiquettes en zigzag de chaque côté du buste, sous le visage, chacune quand son premier mot est dit ; la dernière est pleine, les autres s'estompent. |
| `chapitre` | `debut`, `fin`, `numero`, `texte`, `y`, `x`, `couleur` | Repère de chapitre (« 01 — AVANT ») écrit sur le mur au-dessus de la tête, en noir, deux traits qui s'allongent. Pour un fond sombre : `couleur: "#FFFFFF"`. |
| `tampon` | `debut`, `fin`, `texte`, `temps`, `y`, `taille`, `angle` | Tampon encreur blanc qui claque sous le visage sur le mot dit (`temps` sinon calé sur le premier mot de `texte`), encre irrégulière, puis s'efface. Mettre les mots dans `remplace`. |
| `ticket` | `debut`, `fin`, `entete`, `lignes`, `y`, `largeur`, `son_entree` | Ticket de caisse qui se déroule sous le visage depuis une fente noire. Lignes : `ligne` (`texte`, `montant`, `montant_dit`), `petit` (`texte`, `droite`), `tirets`, `total` (`morceaux` : `[{texte, dit|temps}]`). Chaque ligne s'imprime quand `dit` est prononcé (ou à `temps`). Nom du client en `entete`. Mettre `remplace_temps` sur toute sa durée. |
| `choix` | `debut`, `fin`, `titre`, `options` (`[{texte, sous}]`), `ou_dit`, `y`, `son_entree` | Carte blanche à deux options (façon sondage Instagram, sans pourcentage), écrite mot à mot au rythme de la voix ; l'option dont la personne parle est encadrée de noir. Ne jamais afficher un choix qu'elle n'a pas fait. Mettre `remplace_temps` sur toute sa durée. |
| `mot_souligne` | `debut`, `fin`, `mot`, `contexte`, `ensuite` (`{mot}`), `y`, `taille`, `police`, `contexte_taille`, `remplace` | Grand mot en Figtree Bold (droit) sous le visage, ligne d'introduction en Figtree Light, trait qui se dessine dessous (sous les lettres) ; `ensuite` le remplace par un autre mot quand il est dit. |
| `bilan` | `debut`, `fin`, `items` (`{texte, marque: "coche"}`), `temps`, `barrer` (`{index, temps}`), `y` | Étiquettes empilées : coche dessinée sur ce qui marche, rayure sur un élément au moment voulu (ex. « on réajuste »). |
| `carte_verre` | `debut`, `fin`, `titre`, `items`, `temps`, `y` | Carte en verre dépoli devant la personne, sous le visage : éléments qui apparaissent à leurs `temps`, repère ▶ sur l'élément en cours. Cadrage limité sur ces plans. |
| `ecran_chat` | `debut`, `fin`, `question`, `salutation` | Fenêtre façon ChatGPT qui arrive en 3D sur fond sombre, question tapée, curseur qui clique sur « envoyer », assistant qui réfléchit. Jamais de réponse. |
| `icone` | `debut`, `fin`, `icone`, `mot` (conseillé), ou `x`, `y`, `taille` | `courbe`, `etoile`, `epingle`, `panier`, `coeur`, `bulle`, `cible`, `etincelle`, `ia` (puce « IA »). Rebond + particules. Avec `mot`, l'icône se pose juste au-dessus de ce mot dans les sous-titres et y reste jusqu'à `fin`, même si la ligne change (jamais sur le visage). L'utilisateur ne veut plus de pictos : préférer `plan_de_coupe`. |
| `chiffre` | `debut`, `fin`, `valeur`, `de`, `prefixe`, `suffixe`, `decimales`, `legende` | Le chiffre défile jusqu'à sa valeur. |
| `carte` | `debut`, `fin`, `animation` + champs ci-dessous | La vidéo se réduit en carte arrondie, l'animation joue à côté. |
| `liste` | `debut`, `fin`, `items`, `temps`, `y` | Pastilles sous le visage, une par élément, qui glissent quand elles sont dites et restent affichées. Pas de cadrage serré pendant la liste. |
| `plan_de_coupe` | `debut`, `fin`, `fichier`, `debut_clip` | Vidéo d'illustration (libre de droits) en plein écran, sans son : la voix continue. |
| `zoom` | `debut`, `a`, `duree`, `fin` (facultatif) | Zoom avec flou de mouvement, sans bruitage. Sans `fin`, le zoom tient jusqu'à la coupe suivante (le retour se cache dans la coupe) : c'est le réglage conseillé. Zooms doux (demande de l'utilisateur) : `duree` 1 à 1,5 s et `a` 1,06 à 1,08 ; pas de zoom « coup de poing » (`duree` 0,05) suivi d'un `fin` en pleine phrase, ça fait zoomer puis dézoomer d'un coup. |
| `transition` | `debut` (instant de la coupe), `style`, `duree` | `lumiere` (lumière colorée) ou `panoramique` (panoramique rapide). |
| `carte_fin` | `debut`, `fin`, `nom`, `role` | Carte de fin. Si `nom` vaut « LOCALISY », c'est le logo qui s'affiche. |
| `signature` | `debut`, `fin`, `y` (facultatifs) | Logo LOCALISY discret (charte `fin.signature`), par défaut sur les 2 dernières secondes. L'utilisateur n'en veut pas à la fin des témoignages : seulement sur demande. `y` remplace la hauteur de la charte pour une vidéo (ex. 1450, sous les sous-titres, si le visage est cadré haut). |

Champs des cartes :

- `chat_ia` : `titre`, `message` (se tape tout seul), `reponse` ;
- `entonnoir` : `titre`, `etapes: [{"label", "valeur"}]` (`valeur` facultative), `temps_etapes` (facultatif, secondes absolues) ;
- `gros_chiffre` : `titre`, `valeur`, `prefixe`, `suffixe`, `decimales`, `legende`, ou bien `texte` (texte fixe, sans comptage) ;
- `checklist` : `titre`, `items`, `coches` (facultatif, secondes absolues).

Deux familles de cadres existent : « verre » (carte_verre, liste, accroche tapée, chiffre) et « étiquettes » (titre_bandeau, compteur, frise, bilan ; réglages `moteur.etiquettes`). L'utilisateur veut des cadres et des effets différents d'une vidéo à l'autre : changer de famille, ou en créer une nouvelle. Les sous-titres, eux, ne changent jamais.

Chaque animation (sauf les zooms) déclenche un son bref et doux : `woutch` (titres, cartes, plans de coupe), `woutch_court` (chiffres, pastilles), `tap` (coches), généré par `scripts/sons.mjs` avec ffmpeg. Les anciens sons (whoosh, scintillement, pop, compteur…) restent dans le fichier mais ne sont plus utilisés. Ajoute `"son": false` à une animation pour le couper.

Sons fournis par l'utilisateur : fichiers du dossier `sons_fournis/`, déclarés dans la charte (`moteur.sons.fournis` : `fichier`, `fin_s`, `duree_s`, `fondu_entree_s`, `avance_s`, et un volume dans `moteur.sons.volumes`). Un son fourni qui porte le nom d'un son fabriqué le remplace (ex. `riser`). Les bruits de transition (`transition_oxid`, `transition_whoosh_oxid`, `transition_base`, `swoosh_universfield`) se choisissent avec `"son_entree": "NOM"` sur un `plan_de_coupe`, un `ecran_chat` ou une `transition` : le son démarre `avance_s` secondes avant l'animation, pour que son sommet tombe sur la coupe. Pour en ajouter un : copier le fichier dans `sons_fournis/`, mesurer le moment de son sommet, le déclarer, puis égaliser son volume sur les autres (sonie momentanée maximale identique).

## Organisation

- `scripts/preparer.mjs` : toute la logique (groupes de sous-titres, temps des animations, sons). Écrit `public/projet.json`.
- `src/couches/*.tsx`, `src/cartes/*.tsx` : le dessin de chaque animation (React).
- `public/` : rempli automatiquement (polices, logo, sons, médias). Rien à y mettre à la main, rien de suivi dans git.

Licence Remotion : gratuite pour un particulier ou une entreprise de 3 salariés maximum, licence entreprise payante au-delà (voir `node_modules/remotion/LICENSE.md`).
