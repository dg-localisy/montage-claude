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

### Moteur d'animation Remotion : `moteur/` (en construction)

Il doit composer toute la vidéo à partir de `ma-charte.json` et d'un fichier `effets.json` (temps en secondes) : sous-titres mot à mot, accroche, grands titres 3D, icônes, chiffres, cartes, mouvements de caméra, transitions, grain, étalonnage, effets sonores (fabriqués avec ffmpeg dans `moteur/public/sons/`), musique facultative 20 dB sous la voix.

Avant de t'en servir, regarde `moteur/package.json` et le mode d'emploi du moteur une fois terminé. Ne suppose pas qu'une commande marche sans l'avoir vérifiée.

Règles :
- Remotion v4, même version pour tous les paquets `@remotion/*`. Installation : `cd moteur && npm install`.
- Avant chaque rendu complet, fabrique des images fixes de chaque animation et vérifie-les toi-même.
- Si Remotion plante au démarrage (« Target closed » ou « icudtl.dat ») : passe en mode chrome-for-testing, puis DEMANDE l'autorisation à l'utilisateur avant de lancer un rendu en dehors de l'environnement isolé.

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
