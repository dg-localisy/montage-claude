"""Prépare la texture de la carte cadeau à partir de l'image fournie par le client.

python3 preparer_carte.py IMAGE_CARTE.png [carte_texture.png]

L'image d'origine (900x900) contient la carte entre les lignes 159 et 740 ; l'intérieur
de la carte est transparent. On découpe la carte, on remplit l'intérieur en blanc et
les coins extérieurs en vert (pour que les bords arrondis de la 3D restent propres).
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

source = sys.argv[1]
sortie = sys.argv[2] if len(sys.argv) > 2 else "carte_texture.png"
im = np.array(Image.open(source).convert("RGBA")).astype(np.float32)
a = im[..., 3] / 255.0
# bornes de la carte : premières/dernières lignes où le vert du bord apparaît
vert_mask = (np.abs(im[..., 0] - 95) < 12) & (np.abs(im[..., 1] - 150) < 12) & (np.abs(im[..., 2] - 48) < 12) & (a > 0.5)
lignes = np.where(vert_mask.any(1))[0]
y0, y1 = int(lignes.min()), int(lignes.max()) + 1
crop = im[y0:y1]
a = crop[..., 3] / 255.0
lab, n = ndimage.label(a < 0.5)
h, w = a.shape
coins = {lab[y, x] for (y, x) in [(0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1)] if lab[y, x] > 0}
vert = np.array([95, 150, 48], np.float32)
blanc = np.array([255, 255, 255], np.float32)
fond = np.where(np.isin(lab, list(coins))[..., None], vert, blanc)
rgb = crop[..., :3] * a[..., None] + fond * (1 - a[..., None])
Image.fromarray(np.clip(rgb + 0.5, 0, 255).astype(np.uint8)).save(sortie)
print(f"ok {sortie} : {w}x{h} (lignes {y0} à {y1 - 1} de l'image d'origine)")
