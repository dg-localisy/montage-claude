# Fichiers de travail · SOCO novembre 2026

Chaque visuel est une page HTML de 1080 × 1350 px. Un petit script la photographie en PNG.
Tout se modifie avec un simple éditeur de texte.

## Contenu du dossier

| Élément | Rôle |
|---|---|
| `visuels/visuel_01.html` … `visuel_04.html` | Les 4 maquettes : textes, placement, dégradés |
| `assets/css/soco.css` | Réglages communs : couleurs SOCO, marges, tailles, bouton |
| `assets/css/polices.css` | Police utilisée (générée par `scripts/police.py`) |
| `assets/fonts/` | Fichiers de police |
| `assets/logo/` | Logo SOCO |
| `assets/photos/` | Photos retouchées, prêtes à l'emploi (double définition) |
| `scripts/preparer_photos.py` | Refait les photos depuis Pexels : recadrage, plaques vierges |
| `scripts/police.py` | Télécharge une police Google Fonts et met à jour `polices.css` |
| `rendu.js` | Exporte les PNG dans `../01_VISUELS_FINALS/` |

## Modifier puis réexporter

1. **Un texte** : ouvrir `visuels/visuel_0X.html`, changer la phrase entre les balises, enregistrer.
2. **Une couleur** : dans `assets/css/soco.css`, changer `--soco-accent` (couleur principale) ou `--soco-fonce` (fonds sombres).
3. **La police** : `python3 scripts/police.py "Nom de la police" 400 500 600 700 800`
4. **Une photo** : remplacer le fichier dans `assets/photos/` (même nom, format 2160 × 2700 px), ou modifier le recadrage dans `scripts/preparer_photos.py` puis lancer `python3 scripts/preparer_photos.py` (nécessite `pip install pillow numpy scipy`).
5. **Exporter** :
   ```
   npm install playwright
   npx playwright install chromium
   node rendu.js          # les 4 visuels
   node rendu.js 3        # seulement le visuel 3
   node rendu.js --hd     # ajoute une version 2160 x 2700 dans HD/
   ```

Pour voir une maquette sans rien installer, il suffit d'ouvrir le fichier HTML dans Chrome et de régler la fenêtre sur 1080 × 1350 px (outils de développement, mode appareil).
