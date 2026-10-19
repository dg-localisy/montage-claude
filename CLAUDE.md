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
| `apercus/` | Images d'aperçu validées par l'utilisateur (sous-titre, phrase forte, grand titre, icône) |
| `marque/` | Logo LOCALISY en SVG et PNG (blanc, gris #333333, noir). Reproduit d'après le logo fourni : LOCALISY en Figtree ExtraBold, interlettrage 5,7 %. Blanc sur la vidéo, jamais déformé ni orange |

Repères de la charte : noir #000000, blanc #FFFFFF, petite touche d'orange #FF4D00 (un seul élément orange à la fois). Formats 9:16 (1080×1920) et 4:5 (1080×1350). Son final à -14 LUFS, crête à -1 dBTP. LOCALISY s'écrit toujours en majuscules.

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
- Ne change ni la taille ni la position sans demande de l'utilisateur. Les temps des mots viennent de Scribe (`outils/elevenlabs.py`).

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

Animations : `accroche` (la 2e prend le style « présentation », pour le nom), `grand_titre`, `icone` (courbe, etoile, epingle, panier, coeur, bulle, cible, etincelle), `chiffre`, `carte` (chat_ia, entonnoir, gros_chiffre, checklist, avec temps imposés possibles), `zoom`, `transition`, `carte_fin`, `signature` (`y` pour la déplacer). Sous-titres : `mot_a_mot` (par défaut), `premiere_video` ou `aucun`. `camera.visage` (position des yeux) et `camera.coupes` (coupes du vidéaste, à détecter) sont importants.

Règles :
- Regarde TOUTES les images fixes en grand (par groupes de 8, la planche est trop petite) avant de livrer : textes sur les yeux ou la tête, compteur qui n'atteint pas sa valeur, animations qui se chevauchent, deux éléments orange à la fois.
- Le son du rendu est ensuite refait par `outils/son_final.py` (voir plus bas), pour garantir -14 LUFS et des effets jamais plus de 6 dB au-dessus de la voix.
- Le navigateur est le Chromium préinstallé (`/opt/pw-browsers`). En cas d'erreur « Target closed » ou « icudtl.dat », le script passe seul en chrome-for-testing. S'il échoue encore, DEMANDE l'autorisation à l'utilisateur avant de rendre en dehors de l'environnement isolé.
- N'invente jamais un chiffre ou un résultat dans une carte : uniquement ce que la personne dit (pas de fausse réponse de ChatGPT, par exemple).
- Licence Remotion : gratuite jusqu'à 3 salariés, licence entreprise payante au-delà.

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

- Phrases fortes : garder tout en blanc, comme la première vidéo, ou mettre le mot `choc` en orange ? (posée, sans réponse pour l'instant)
- Le moteur Remotion demande des sous-titres mot à mot avec le mot actif en orange, alors que l'utilisateur voulait juste avant le même rendu que la première vidéo. Le moteur prévoit les deux modes : faire choisir l'utilisateur.
- La charte disait « pas de carte de fin » et « pas de transitions colorées », mais le moteur doit savoir faire une carte de fin et une transition lumière. Ne les utiliser que si l'utilisateur le demande pour une vidéo.
