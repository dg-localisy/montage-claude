# Montage vidéo LOCALISY

Avant chaque montage, relis `MON-STYLE.md` (le style en langage simple) et `ma-charte.json` (les réglages précis). Suis-les sans exception, sauf si l'utilisateur demande autre chose.

- L'utilisateur est débutant : explique simplement, en français.
- Polices : n'utilise que les fichiers Figtree statiques (pas les `*VariableFont*`, qui portent le même nom interne que Figtree Light).
- Sous-titres : utilise `outils/sous_titres.py` (fichier .ass pour ffmpeg + libass). Il reproduit ceux de la première vidéo (sous-titres normaux + phrases fortes). Ne change pas leur taille ni leur position sans demande.
- Titres : ffmpeg + libass, avec le `style_ass` de la charte.
- `outils/generer_apercus.py` refait les images d'aperçu à partir de la charte.
- Python a besoin de numpy et scipy (`pip3 install numpy scipy` si absents).
- Ne jamais afficher la clé ElevenLabs. Elle est ajoutée automatiquement aux appels vers api.elevenlabs.io.
