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
- **Toujours une musique de fond** douce et tendance, à volume bas (`outils/musique_douce.py`, ou un morceau fourni). L'utilisateur préfère la version avec musique.
- Bruitages brefs, doux et variés. Pas de logo à la fin.
- Livrer seulement le 9:16, sauf demande.

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

- Sous-titres normaux : `{"debut", "fin", "texte"}`, 1 à 4 mots (18 caractères maximum), ponctuation et majuscules gardées, changement instantané.
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

Animations : `accroche` (la 2e prend le style « présentation », pour le nom), `texte_derriere` (mot géant derrière la tête, personne détourée devant ; `riser: true` pour l'accroche), `carte_verre` (carte en verre dépoli devant la personne, liste qui se déroule), `ecran_chat` (fenêtre ChatGPT en 3D, question tapée, curseur qui clique, jamais de réponse), `grand_titre` (plus utilisé : il floute le visage), `icone` (l'utilisateur ne veut plus de pictos : à remplacer par des plans de coupe plein écran), `chiffre`, `carte` (chat_ia, entonnoir, gros_chiffre, checklist, avec temps imposés possibles), `liste` (pastilles sous le visage), `plan_de_coupe` (vidéo libre de droits en plein écran), `zoom`, `transition`, `carte_fin`, `signature` (`y` pour la déplacer ; l'utilisateur ne veut pas de logo à la fin des témoignages, ne pas l'utiliser sans demande). Sous-titres : `premiere_video` (choix actuel : rendu de la vidéo INCENDIE, avec `phrases_fortes` dans effets.json, calées toutes seules sur les mots), `mot_a_mot` ou `aucun`. Pas de doublon : `remplace` / `remplace_temps` sur une animation retire des sous-titres les mots qu'elle affiche. `camera.visage` (yeux) et `camera.coupes` (coupes du vidéaste, à détecter) sont importants. Les titres d'accroche, chiffres et pastilles se placent sous le visage, au-dessus des sous-titres : l'image ne bouge jamais pour leur faire de la place.

Règles :
- RÈGLE ABSOLUE de l'utilisateur : rien ne cache jamais le visage (titre, chiffre, pastille, carte), même flouté. Un texte derrière la tête doit rester parfaitement lisible : au-dessus de la tête, seules des mèches devant le bas des lettres.
- Trame commune des témoignages et règle « pas de doublon » : voir `MON-STYLE.md`.
- Détourage pour le texte derrière la tête : `python3 outils/detourage.py RUSH.mp4 projets/NOM/masques --modele rvm_mobilenetv3_fp32.onnx` (modèle RobustVideoMatting, 15 Mo, à télécharger depuis les « releases » GitHub de PeterL1n/RobustVideoMatting ; `pip3 install onnxruntime`), puis `"camera": {"masques": "masques"}` dans effets.json. Masques non suivis par git.
- Contrôle rapide de quelques images : `node scripts/stills.mjs effets.json --nom NOM --instants 2.3,18.8` (les sous-titres « premiere_video » sont incrustés après coup : les ajouter aux images avec le fichier .ass pour vérifier).
- Regarde TOUTES les images fixes en grand (par groupes de 8, la planche est trop petite) avant de livrer : quelque chose sur le visage ou la tête, compteur qui n'atteint pas sa valeur, animations qui se chevauchent, dernier élément d'une liste trop bref, une couleur autre que noir et blanc.
- Bruitages : discrets et rapides (voir `moteur.sons.preferences` dans la charte). Pas de montée lente ni d'impact fort.
- Banques de vidéos libres de droits (Pexels, Pixabay…) bloquées par le réseau : demander à l'utilisateur de déposer le clip sur GitHub, ou d'autoriser le domaine.
- Un changement limité à quelques secondes se refait sans tout rendre : `--images DEBUT-FIN` sur les seules images touchées, puis recollage à l'image près (vérifier les bords).
- Le son du rendu est ensuite refait par `outils/son_final.py` (voir plus bas), pour garantir -14 LUFS et des effets jamais plus de 6 dB au-dessus de la voix.
- Le navigateur est le Chromium préinstallé (`/opt/pw-browsers`). En cas d'erreur « Target closed » ou « icudtl.dat », le script passe seul en chrome-for-testing. S'il échoue encore, DEMANDE l'autorisation à l'utilisateur avant de rendre en dehors de l'environnement isolé.
- N'invente jamais un chiffre ou un résultat dans une carte : uniquement ce que la personne dit (pas de fausse réponse de ChatGPT, par exemple).
- Licence Remotion : gratuite jusqu'à 3 salariés, licence entreprise payante au-delà.

### Musique de fond : `outils/musique_douce.py`

`python3 outils/musique_douce.py projets/NOM/media/musique_douce.wav --duree DUREE --debut 2.08` compose une musique originale lo-fi douce (libre de droits), qui commence au moment voulu (quand l'accroche tombe). Puis `"musique": {"actif": true, "fichier": "media/musique_douce.wav"}` dans effets.json. Les banques de musique (Pixabay, FreePD…) sont bloquées par le réseau : l'utilisateur peut aussi fournir un morceau. Le niveau (sous la voix, baisse quand la personne parle) est réglé par `son_final.py` (charte → `moteur.musique`). Je ne peux pas écouter : vérifier au moins la répartition des fréquences (pas de grave envahissant, peu d'énergie entre 1 et 4 kHz pour laisser la voix claire).

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
