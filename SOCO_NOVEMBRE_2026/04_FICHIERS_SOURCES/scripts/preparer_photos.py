"""Prépare les photos des 4 visuels à partir des originaux Pexels.

- télécharge l'original s'il manque (URL Pexels officielle) ;
- efface les caractères des plaques d'immatriculation étrangères (plaque vierge) ;
- recadre (4:5, ou bandeau pour le visuel 4) et exporte en double définition (2x) dans assets/photos/.

Usage : python3 scripts/preparer_photos.py [DOSSIER_ORIGINAUX]
"""
import os, sys, subprocess
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
from scipy import ndimage

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
ORIG = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RACINE, 'assets', 'photos', 'originaux')
SORTIE = os.path.join(RACINE, 'assets', 'photos')
os.makedirs(ORIG, exist_ok=True)

# Pour chaque photo : identifiant Pexels, zone de recadrage 4:5 (gauche, haut, largeur) en pixels
# de l'original, et plaques à effacer (polygones en pixels de l'original).
PHOTOS = {
    'v1_route_automne': {
        'pexels': 29052768,
        'crop': (0, 640, 4672),
        'plaques': [
            {'face': [(1474, 4156), (1742, 4156), (1742, 4268), (1474, 4268)],
             'cadre': [(1450, 4110), (1774, 4110), (1774, 4308), (1450, 4308)]},
        ],
    },
    'v2_station_lavage': {
        'pexels': 30636197,
        'crop': (0, 240, 2868),
        'plaques': [
            {'face': [(1626, 2128), (2056, 2128), (2056, 2259), (1626, 2259)], 'fenetre': 0.62},
        ],
    },
    'v3_berline_coucher_soleil': {
        'pexels': 28886536,
        'crop': (0, 290, 2832),
        'plaques': [
            {'face': [(2292, 2504), (2605, 2427), (2613, 2544), (2311, 2625)]},
        ],
    },
    'v4_proprietaire_cle': {
        'pexels': 4173099,
        'crop': (0, 110, 2600),
        'sortie': (2160, 2020),   # bandeau photo 1080 x 1010 (le bas du visuel est un aplat)
        'plaques': [],
    },
}


def telecharger(pid, chemin):
    if os.path.exists(chemin) and os.path.getsize(chemin) > 10000:
        return
    url = f'https://images.pexels.com/photos/{pid}/pexels-photo-{pid}.jpeg'
    subprocess.run(['curl', '-sS', '-m', '120', '-o', chemin, url], check=True)


def plaque_vierge(img, face, cadre=None, fenetre=0.45):
    """Efface les caractères : fermeture morphologique (le clair recouvre les traits sombres)."""
    xs = [p[0] for p in (cadre or face)]
    ys = [p[1] for p in (cadre or face)]
    x0, y0, x1, y1 = min(xs) - 20, min(ys) - 20, max(xs) + 20, max(ys) + 20
    zone = np.asarray(img.crop((x0, y0, x1, y1))).astype(np.float32)
    h, w = zone.shape[:2]

    def masque(poly, flou):
        m = Image.new('L', (w, h), 0)
        ImageDraw.Draw(m).polygon([(x - x0, y - y0) for x, y in poly], fill=255)
        return np.asarray(m.filter(ImageFilter.GaussianBlur(flou))).astype(np.float32) / 255.0

    fy = [p[1] for p in face]
    taille = max(9, int((max(fy) - min(fy)) * fenetre)) | 1
    resultat = zone.copy()
    if cadre:
        # cadre sombre : on enlève les inscriptions claires (ouverture)
        ouvert = np.stack([ndimage.grey_opening(zone[..., c], size=(taille, taille)) for c in range(3)], -1)
        ouvert = ndimage.gaussian_filter(ouvert, sigma=(6, 6, 0))
        m = masque(cadre, 4)[..., None]
        resultat = resultat * (1 - m) + ouvert * m
    # face claire : on enlève les caractères sombres (fermeture), calculée sur l'image d'origine
    ferme = np.stack([ndimage.grey_closing(zone[..., c], size=(taille, taille)) for c in range(3)], -1)
    ferme = ndimage.gaussian_filter(ferme, sigma=(taille / 3, taille / 3, 0))
    # grain léger pour éviter un aplat artificiel
    rng = np.random.default_rng(7)
    ferme += rng.normal(0, 2.2, ferme.shape)
    m = masque(face, 3)[..., None]
    resultat = resultat * (1 - m) + ferme * m
    img.paste(Image.fromarray(np.clip(resultat, 0, 255).astype(np.uint8)), (x0, y0))


def main():
    for nom, p in PHOTOS.items():
        orig = os.path.join(ORIG, f"pexels-{p['pexels']}.jpg")
        telecharger(p['pexels'], orig)
        img = Image.open(orig).convert('RGB')
        for pl in p['plaques']:
            plaque_vierge(img, pl['face'], pl.get('cadre'), pl.get('fenetre', 0.45))
        gx, hy, larg = p['crop']
        sw, sh = p.get('sortie', (2160, 2700))
        haut = round(larg * sh / sw)
        img = img.crop((gx, hy, gx + larg, hy + haut)).resize((sw, sh), Image.LANCZOS)
        cible = os.path.join(SORTIE, f'{nom}.jpg')
        img.save(cible, quality=92, subsampling=0)
        print('ok', nom, img.size)


if __name__ == '__main__':
    main()
