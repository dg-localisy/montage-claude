# Montage vidéo LOCALISY

Ce dépôt sert à monter automatiquement les vidéos de l'agence LOCALISY (témoignages clients, face caméra) pour Instagram en priorité, puis TikTok, Facebook et LinkedIn.

## Au début de chaque session

1. Relis `MON-STYLE.md` (le style en langage simple) et `ma-charte.json` (les réglages précis). Suis-les, sauf si l'utilisateur demande autre chose.
2. Vérifie les outils et réinstalle ce qui manque (l'ordinateur cloud est remis à zéro entre les sessions) :
   - `node -v` (18 ou plus), `ffmpeg -filters | grep -E " (ass|subtitles) "` (libass obligatoire pour les sous-titres) ;
   - `python3 -c "import numpy, scipy, requests"`, sinon `pip3 install numpy scipy requests` (scipy est souvent absent) ;
   - pour lire les noms internes des polices : `pip3 install fonttools`.

## Avec l'utilisateur

- Débutant : réponds en français simple, comme à quelqu'un qui n'a jamais ouvert un Terminal. S'il doit faire une action (réglages, mot de passe), explique-la étape par étape.
- Montre toujours les résultats : images, vidéos et rapports envoyés avec SendUserFile.
- Ne jamais afficher la clé ElevenLabs, même partiellement.
- Préviens avant de dépenser des crédits ElevenLabs au-delà d'un petit test. Forfait gratuit : 10 000 caractères de synthèse vocale par mois.
- Les fichiers temporaires vont dans le scratchpad, pas dans le dépôt.

## Fichiers de référence

| Fichier | Rôle |
|---|---|
| `ma-charte.json` | Toutes les règles chiffrées : couleurs, polices, sous-titres, titres, icônes, son, formats, mots à corriger |
| `MON-STYLE.md` | Le même style en langage simple, avec la liste des vérifications avant livraison |
| `Figtree-*.ttf` | Les polices. N'utilise que les fichiers statiques : les deux `*VariableFont*` portent le même nom interne que Figtree Light |
| `apercus/` | Images d'aperçu (sous-titre, phrase forte, grand titre) |
| `marque/` | Logo LOCALISY en SVG et PNG (blanc, gris #333333, noir). Reproduit d'après le logo fourni : LOCALISY en Figtree ExtraBold, interlettrage 5,7 %. Blanc sur la vidéo, jamais déformé ni orange |

Repères de la charte : noir #000000, blanc #FFFFFF, et c'est tout : plus d'orange dans les vidéos (demande de l'utilisateur). Les mots importants ressortent en italique avec un relief noir (`mise_en_evidence` dans la charte). Formats 9:16 (1080×1920) et 4:5 (1080×1350). Son final à -14 LUFS, crête à -1 dBTP. LOCALISY s'écrit toujours en majuscules.

## Préférences de l'utilisateur pour toutes les vidéos

À appliquer par défaut à chaque nouveau témoignage (détails dans `MON-STYLE.md`) :
- Noir et blanc uniquement, police Figtree, rien ne cache jamais le visage.
- Sous-titres de la vidéo INCENDIE (`premiere_video`), à 75 % de la hauteur. Phrases fortes sur les passages importants : lignes en quinconce, quelques mots en gras, **écarts de taille modérés** (rôles `appui` et `fort` surtout, `choc` très rarement ; échelles dans la charte).
- Pas de doublon : un mot affiché en grand n'est pas répété dans les sous-titres.
- Présentation (nom + fonction) **à l'endroit des sous-titres**, qui s'effacent pendant ce temps (`remplace_temps` sur l'accroche de présentation).
- Texte derrière la tête seulement pour un mot fort et intéressant (résultat, idée clé), parfaitement lisible ; jamais pour un mot faible (« rien » refusé).
- Accroche : riser + résultat géant derrière la tête. Plans de coupe choisis par l'utilisateur. Carte en verre bien sous le visage.
- **Toujours une musique de fond** douce et tendance, à volume bas (`outils/musique_douce.py`, ou un morceau fourni). L'utilisateur préfère la version avec musique. **Une musique différente à chaque vidéo** (demande de l'utilisateur) : `--style lofi` a servi pour Gary, `--style acoustique` pour Cheminées Liégeois, `--style electro` pour Black and Bike ; pour la vidéo suivante, créer un nouveau style dans l'outil (autre instrument, tonalité, tempo, rythme) et noter le style utilisé dans `effets.json` (`musique._note`).
- **Epidemic Sound** : l'utilisateur a ouvert l'accès à epidemicsound.com pour que je m'en inspire (genres, ambiances, tempos, instruments à la mode) pour les prochaines musiques. Le 21/10/2026 le site était encore refusé par le réseau de la session (403) : vérifier au début de la session suivante (`curl -sI https://www.epidemicsound.com/`). S'inspirer seulement ; ne pas mettre un de leurs morceaux dans une vidéo sans que l'utilisateur confirme que son abonnement le couvre.
- Bruitages brefs, doux et variés. Pas de logo à la fin.
- Riser de l'accroche : **un riser différent à chaque vidéo** (demande de l'utilisateur). Déjà utilisés : le riser cinématique fourni (Gary, `"riser": true`), le riser « aspiré » (Cheminées Liégeois, `"riser": "riser_aspire", "riser_duree": 1.6`) et le riser à pulsations qui accélèrent (Black and Bike, `"riser": "riser_pulsations", "riser_duree": 1.7`). Pour la vidéo suivante, en créer un nouveau dans `moteur/scripts/sons.mjs` (et son volume dans la charte, réglé au même niveau que les autres).
- Mot géant derrière la tête : sur un fond sombre ou chargé (plafond, magasin), le mettre en blanc avec une ombre (`"couleur": "#FFFFFF", "ombre": true`) pour qu'il reste parfaitement lisible. **Pas toujours la même chose derrière la tête** (demande de l'utilisateur) : Gary, mot qui s'écrit lettre par lettre ; Cheminées, mot qui tombe d'un coup (`impact`) ; Black and Bike, « ×2 » qui traverse au-dessus de la tête de gauche à droite (`traverse`, idée de l'utilisateur). Autres options prêtes : `rebond`, `montee`, et `courbe_derriere` (courbe de croissance qui se dessine derrière la personne, étiquette du résultat au bout).
- Un mot affiché en grand (titre, accroche) n'apparaît que pendant qu'il est dit. Le titre d'accroche « La majorité des clients » se place sur la ligne des sous-titres (`"position": "sous_titres"` sur `titre_bandeau`, lignes calées avec `temps_lignes`).
- Sons fournis par l'utilisateur dans `sons_fournis/` (déclarés dans la charte, `moteur.sons.fournis`) : le riser cinématique pour l'accroche (il remplace le riser fabriqué) et quatre bruits de transition : `transition_oxid` (son préféré), `transition_whoosh_oxid` (souffle très bref), `transition_base` (souffle ample avec du corps) et `swoosh_universfield` (swoosh qui monte et passe). À mettre sur une ou deux transitions par vidéo avec `"son_entree": "NOM"` sur un `plan_de_coupe`, un `ecran_chat` ou une `transition`, en changeant de son d'une transition à l'autre. Leurs volumes sont déjà égalisés dans la charte, et chacun est calé pour que son sommet tombe pile sur la coupe (`avance_s`).
- Livrer seulement le 9:16, sauf demande.
- **Référence pour les prochains montages : la vidéo « Claude Edit »** (voir `MON-STYLE.md`, et la famille d'effets « pages » du moteur : `page` claire ou sombre, `etiquettes_flottantes`, `mot_souligne`). Choix de l'utilisateur : rester en noir et blanc, Figtree uniquement, et c'est lui qui fournit les images des objets des pages (PNG ou JPG, à détourer si besoin).
- **Varier aussi à l'intérieur d'une vidéo** (retours sur Black and Bike) : jamais la même mise en forme à plusieurs endroits (pas trois pages identiques), alterner les effets, les cadrages et des zooms courts sur certains passages pour garder le rythme. L'utilisateur n'aime pas les pages blanches à code-barres, ni le nom du client répété ou mal aligné : le nom une seule fois, en signature (`signature` sur une page), sans « client de LOCALISY » dessous. Pour une progression, une flèche plutôt qu'un « vs ». Les étiquettes sur le buste vont au niveau des sous-titres, assez grandes. Un effet ne garde que les mots qui le méritent (« impossible pour nous »), le reste de la phrase reste en sous-titres. Un résultat affiché en grand disparaît dès que la personne passe à la suite.
- **Des cadres et des effets différents à chaque vidéo** (demande de l'utilisateur) : ne pas reprendre ceux de la vidéo précédente (Gary : verre dépoli, pastilles, accroche tapée, zooms rapides ; Cheminées Liégeois : étiquettes noires, compteur à rouleaux, frise, bilan, avancées lentes). **Mais ne jamais changer le style ni le découpage des sous-titres** : ils restent ceux de la vidéo INCENDIE.

## Les outils

### Dérush automatique : `outils/derush.py`

```
python3 outils/derush.py VIDEO.mp4 --script SCRIPT.txt
```

Options : `--sortie DOSSIER` (par défaut `VIDEO_derush/` à côté de la vidéo), `--langue fr`, `--pause-max 0.30`, `--garder-silences` (coupe seulement les reprises).

Ce qu'il fait : transcription ElevenLabs Scribe (`scribe_v1`, mot par mot, hésitations gardées), alignement mot à mot avec le script (un mot en trop = une reprise, la DERNIÈRE prise est gardée), seuil de silence calibré sur le fichier, coupes uniquement dans des silences et calées sur une image, puis deux vérifications avec correction automatique (jusqu'à 3 essais) : niveau sonore à chaque raccord, et nouvelle transcription du montage comparée mot à mot.

Livrables dans le dossier de sortie : la vidéo `*_derush.mp4`, `rapport.md` (à résumer à l'utilisateur), `rapport.json`, `schema.png` (coupes en orange, silences raccourcis en gris, seuil en bleu).

Règles :
- Ne livre jamais un dérush dont le rapport montre un raccord « PROBLÈME » ou un mot manquant non expliqué.
- Une reprise collée à un mot gardé, sans silence, n'est pas coupée : elle est signalée dans le rapport. Dis-le à l'utilisateur.
- Les transcriptions sont en cache dans `DOSSIER/travail/cache` : relancer l'outil ne coûte rien.
- Test complet (vidéo avec ratés connus, contrôle par vérité terrain et code-barres de synchro) :
  `python3 outils/test_derush/fabriquer_video_test.py DOSSIER` puis `python3 outils/test_derush/lancer_test.py DOSSIER`.

### Sous-titres : `outils/sous_titres.py`

Fabrique le fichier `.ass` (ffmpeg + libass) qui reproduit les sous-titres de la première vidéo, mesurés image par image : même rendu, même place.

```python
import sys; sys.path.insert(0, "outils")
import sous_titres
ass = sous_titres.fichier_ass(groupes, blocs)   # groupes : sous-titres normaux ; blocs : phrases fortes
polices = sous_titres.dossier_polices_statiques("DOSSIER_TEMP/polices")
# puis : ffmpeg -i video.mp4 -vf "subtitles=sous-titres.ass:fontsdir=DOSSIER_TEMP/polices" ...
```

- Sous-titres normaux : `{"debut", "fin", "texte"}`, 1 à 4 mots (18 caractères maximum), ponctuation et majuscules gardées, changement instantané. Un sous-titre s'efface dès qu'une animation affiche les mots suivants (ex. le nom de la présentation). RÈGLE de l'utilisateur : ne jamais changer le style ni le découpage des sous-titres d'une vidéo à l'autre ; seuls les effets et les ajouts (titres, cadres, animations) changent.
- Phrases fortes : `{"debut", "fin", "lignes": [[{"mot", "role", "debut"}, ...], ...]}` avec les rôles `liaison`, `liaison_gras`, `appui`, `fort`, `choc` (un seul `choc` par bloc). Chaque mot passe du flou au net quand il est prononcé.
- Ne change ni la taille ni la position sans demande de l'utilisateur. Position actuelle : ligne de base à 1440 px (75 %, au plus bas de la zone sûre), 143 px plus bas que la première vidéo, à sa demande. Les temps des mots viennent de Scribe (`outils/elevenlabs.py`).

### Aperçus : `outils/generer_apercus.py`

`python3 outils/generer_apercus.py` refait toutes les images de `apercus/` à partir de la charte. À relancer après chaque changement de la charte, puis à montrer à l'utilisateur pour validation.

### ElevenLabs : `outils/elevenlabs.py`

`transcrire(fichier, langue="fr", cache_dir=...)` (Scribe, mis en cache), `mots(transcription)`, `voix()`, `synthese(texte, voice_id, sortie)`. Voix française pour les tests : Sarah, `EXAVITQu4vr4xnSDxMaL`, modèle `eleven_multilingual_v2`.

### Moteur d'animation Remotion : `moteur/`

Compose toute la vidéo à partir de `ma-charte.json` et d'un fichier `effets.json` propre à chaque vidéo (temps en secondes). Mode d'emploi complet et format d'`effets.json` : `moteur/LISEZMOI.md`.

```
cd moteur && npm install                                   # une fois par session (node_modules n'est pas suivi)
node scripts/stills.mjs CHEMIN/effets.json --nom NOM       # images fixes de contrôle (environ 5 min)
node scripts/rendu.mjs  CHEMIN/effets.json --nom NOM       # images fixes + vidéo 9:16 et 4:5 (environ 40 min pour 1 min)
```

Options : `--sans-stills`, `--sans-4x5`, `--images 0-89`, `--sortie DOSSIER`. Sorties dans `moteur/sortie/` : `NOM_planche.png`, `NOM_stills/`, `NOM_9x16.mp4`, `NOM_4x5.mp4`.

Animations : `accroche` (la 2e prend le style « présentation », pour le nom), `texte_derriere` (mot géant derrière la tête, personne détourée devant ; `riser: true` pour l'accroche ; `entree` : lettres, `impact` ou `montee`), famille « étiquettes » créée pour Cheminées Liégeois (`titre_bandeau`, variante `nom` ; `compteur` à rouleaux ; `frise` chronologique ; `bilan` avec coche et rayure), famille « graphiques » (`titre_empile` : phrase empilée sur le buste ; `barre_recherche` : barre de recherche IA qui se tape ; `barres_comparees` : avant / aujourd'hui avec le résultat au bout), famille « pages » inspirée de la vidéo « Claude Edit » (`page` plein écran claire ou sombre dont les textes s'écrivent au rythme de la voix et qui remplace les sous-titres, éléments `petit`, `italique`, `grand`, `cle`, `appel`, `etiquette`, `image`, `vs` ; `etiquettes_flottantes` en zigzag ; `mot_souligne`), `carte_verre` (carte en verre dépoli devant la personne, liste qui se déroule), `ecran_chat` (fenêtre ChatGPT en 3D, question tapée, curseur qui clique, jamais de réponse), `grand_titre` (plus utilisé : il floute le visage), `icone` (l'utilisateur ne veut plus de pictos : à remplacer par des plans de coupe plein écran), `chiffre`, `carte` (chat_ia, entonnoir, gros_chiffre, checklist, avec temps imposés possibles), `liste` (pastilles sous le visage), `plan_de_coupe` (vidéo libre de droits en plein écran), `zoom`, `transition`, `carte_fin`, `signature` (`y` pour la déplacer ; l'utilisateur ne veut pas de logo à la fin des témoignages, ne pas l'utiliser sans demande). Sous-titres : `premiere_video` (choix actuel : rendu de la vidéo INCENDIE, avec `phrases_fortes` dans effets.json, calées toutes seules sur les mots), `mot_a_mot` ou `aucun`. Pas de doublon : `remplace` / `remplace_temps` sur une animation retire des sous-titres les mots qu'elle affiche. `camera.visage` (yeux) et `camera.coupes` (coupes du vidéaste, à détecter) sont importants. Les titres d'accroche, chiffres et pastilles se placent sous le visage, au-dessus des sous-titres : l'image ne bouge jamais pour leur faire de la place.

Règles :
- RÈGLE ABSOLUE de l'utilisateur : rien ne cache jamais le visage (titre, chiffre, pastille, carte), même flouté. Un texte derrière la tête doit rester parfaitement lisible : au-dessus de la tête, seules des mèches devant le bas des lettres.
- Trame commune des témoignages et règle « pas de doublon » : voir `MON-STYLE.md`.
- Détourage pour le texte derrière la tête : `python3 outils/detourage.py RUSH.mp4 projets/NOM/masques --modele rvm_mobilenetv3_fp32.onnx` (modèle RobustVideoMatting, 15 Mo, à télécharger depuis les « releases » GitHub de PeterL1n/RobustVideoMatting ; `pip3 install onnxruntime`), puis `"camera": {"masques": "masques"}` dans effets.json. Masques non suivis par git.
- Contrôle rapide de quelques images : `node scripts/stills.mjs effets.json --nom NOM --instants 2.3,18.8` (les sous-titres « premiere_video » sont incrustés après coup : les ajouter aux images avec le fichier .ass pour vérifier).
- Regarde TOUTES les images fixes en grand (par groupes de 8, la planche est trop petite) avant de livrer : quelque chose sur le visage ou la tête, compteur qui n'atteint pas sa valeur, animations qui se chevauchent, dernier élément d'une liste trop bref, une couleur autre que noir et blanc.
- Avant de livrer, vérifier aussi sur toutes les images qu'aucune bande noire n'apparaît sur les côtés (un plan décalé sans grossissement suffisant), et que les petits mots remontés des phrases fortes ne touchent pas la ligne du dessus.
- Bruitages : discrets et rapides (voir `moteur.sons.preferences` dans la charte). Pas de montée lente ni d'impact fort.
- Banques de vidéos libres de droits (Pexels, Pixabay…) bloquées par le réseau : demander à l'utilisateur de déposer le clip sur GitHub, ou d'autoriser le domaine.
- Un changement limité à quelques secondes se refait sans tout rendre : `--images DEBUT-FIN` sur les seules images touchées, puis recollage à l'image près (vérifier les bords).
- Le son du rendu est ensuite refait par `outils/son_final.py` (voir plus bas), pour garantir -14 LUFS et des effets jamais plus de 6 dB au-dessus de la voix.
- Le navigateur est le Chromium préinstallé (`/opt/pw-browsers`). En cas d'erreur « Target closed » ou « icudtl.dat », le script passe seul en chrome-for-testing. S'il échoue encore, DEMANDE l'autorisation à l'utilisateur avant de rendre en dehors de l'environnement isolé.
- N'invente jamais un chiffre ou un résultat dans une carte : uniquement ce que la personne dit (pas de fausse réponse de ChatGPT, par exemple).
- Licence Remotion : gratuite jusqu'à 3 salariés, licence entreprise payante au-delà.

### Musique de fond : `outils/musique_douce.py`

`python3 outils/musique_douce.py projets/NOM/media/musique_STYLE.wav --duree DUREE --debut 2.08 --style STYLE` compose une musique originale douce (libre de droits), qui commence au moment voulu (quand l'accroche tombe). Styles : `lofi` (piano électrique, Gary), `acoustique` (guitare pincée, Cheminées Liégeois), `electro` (house douce, Black and Bike). Chaque vidéo a sa propre musique : en ajouter un nouveau style à chaque fois (Epidemic Sound pour l'inspiration). Puis `"musique": {"actif": true, "fichier": "media/musique_douce.wav"}` dans effets.json. Les banques de musique (Pixabay, FreePD…) sont bloquées par le réseau : l'utilisateur peut aussi fournir un morceau. Le niveau (sous la voix, baisse quand la personne parle) est réglé par `son_final.py` (charte → `moteur.musique`). Je ne peux pas écouter : vérifier au moins la répartition des fréquences (pas de grave envahissant, peu d'énergie entre 1 et 4 kHz pour laisser la voix claire).

### Son final : `outils/son_final.py`

```
python3 outils/son_final.py --video moteur/sortie/NOM_9x16.mp4 --voix RUSH.mp4 \
    --projet moteur/public/projet.json --sons moteur/public/sons --sortie FINAL_9x16.mp4
```

Refait le mélange voix + effets à partir des pistes séparées, baisse les effets qui dépassent la voix de plus de 6 dB (sonie momentanée EBU R128), règle le tout à -14 LUFS et la crête sous -1 dBTP, puis vérifie avec ffmpeg. Écrit `FINAL_9x16.son.json`. Applique ensuite le même son à la version 4:5 (`-c:v copy`).

## Chaîne de montage conseillée

1. Dérush (`outils/derush.py`) avec le script de la vidéo.
2. Transcription Scribe du montage dérushé pour avoir les temps des mots.
3. Sous-titres, titres et animations selon la charte (`sous_titres.py` ou le moteur Remotion).
4. Son à -14 LUFS (`loudnorm=I=-14:TP=-1` avec ffmpeg), puis export 9:16 et 4:5 en H.264 + AAC 48 kHz.
5. Vérifications de `MON-STYLE.md`, puis livraison avec les fichiers envoyés à l'utilisateur.

## Environnement cloud

- La clé ElevenLabs est un « Network secret » de l'environnement, envoyée par le proxy vers `api.elevenlabs.io` dans l'en-tête `xi-api-key`, sans préfixe. Ne l'envoie pas toi-même. Sur l'ordinateur de l'utilisateur, l'outil lit la variable `ELEVENLABS_API_KEY`.
- Droits de la clé : lecture du compte, des voix et des modèles, synthèse vocale, transcription.
- Si un appel ElevenLabs renvoie 401 ou une connexion refusée, vérifie ces réglages avec l'outil de documentation de l'environnement, puis explique à l'utilisateur quoi changer.

## À ne jamais faire

- Mettre dans le dépôt des images ou extraits des vidéos clients (elles peuvent être privées), `node_modules` ou des médias de test régénérables.
- Afficher la clé ElevenLabs.
- Utiliser une police autre que Figtree, ou les fichiers `*VariableFont*`.
- Livrer une vidéo sans l'avoir vérifiée (images fixes, rapport de dérush, écoute des raccords).

## Questions encore ouvertes avec l'utilisateur

- Plans de coupe : c'est l'utilisateur qui choisit les clips (il n'a pas aimé ceux proposés). `videos.pexels.com` est autorisé, mais pas la recherche (`www.pexels.com`) ; Instagram et Pixabay sont bloqués : demander des enregistrements d'écran ou les fichiers.
- Comptes de référence pour le montage : la vidéo INCENDIE, la vidéo de référence (texte derrière la tête, écrans animés, carte en verre) et le compte Instagram jorb.media (à voir via des enregistrements d'écran).
- La charte disait « pas de carte de fin » et « pas de transitions colorées ». Le moteur sait les faire : ne les utiliser que si l'utilisateur le demande pour une vidéo.
