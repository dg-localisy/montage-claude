# Montage vidéo LOCALISY

Avant chaque montage, relis `MON-STYLE.md` (le style en langage simple) et `ma-charte.json` (les réglages précis). Suis-les sans exception, sauf si l'utilisateur demande autre chose.

- L'utilisateur est débutant : explique simplement, en français.
- Polices : n'utilise que les fichiers Figtree statiques (pas les `*VariableFont*`, qui portent le même nom interne que Figtree Light).
- Sous-titres : utilise `outils/sous_titres.py` (fichier .ass pour ffmpeg + libass). Il reproduit ceux de la première vidéo (sous-titres normaux + phrases fortes). Ne change pas leur taille ni leur position sans demande.
- Titres : ffmpeg + libass, avec le `style_ass` de la charte.
- `outils/generer_apercus.py` refait les images d'aperçu à partir de la charte.
- Python a besoin de numpy, scipy et requests (`pip3 install numpy scipy requests` si absents).
- Dérush : `python3 outils/derush.py VIDEO.mp4 --script SCRIPT.txt` (options `--sortie`, `--pause-max 0.30`, `--garder-silences`). Il livre la vidéo dérushée avec `rapport.md` et `schema.png`. Ne livre jamais un dérush dont le rapport montre un raccord en PROBLÈME ou un mot manquant non expliqué. Test complet : `outils/test_derush/fabriquer_video_test.py DOSSIER` puis `outils/test_derush/lancer_test.py DOSSIER`.
- Transcriptions Scribe : mises en cache dans `<dossier>/travail/cache` pour ne pas payer deux fois.
- Ne jamais afficher la clé ElevenLabs. Elle est ajoutée automatiquement aux appels vers api.elevenlabs.io.
