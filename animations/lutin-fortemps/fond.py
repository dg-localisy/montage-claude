"""Décor fixe : sapin de Noël flou (vrai bokeh) + neige au premier plan.

Peint une scène nette en lumière linéaire (avec des lumières très fortes),
puis applique un flou d'objectif (disque) selon la profondeur.
Sortie : fond.png (1080x1920, sRGB).
"""
import sys
import numpy as np
from scipy.signal import fftconvolve
from PIL import Image

W, H = 1080, 1920
rng = np.random.default_rng(7)
SORTIE = sys.argv[1] if len(sys.argv) > 1 else "fond.png"

# Caméra 3D (doit correspondre à scene.js) : hauteur 1.2, distance 11, fov vertical 22°
CAM_H, CAM_D, TAN = 1.2, 11.0, np.tan(np.radians(11.0))
HORIZON = H / 2


def lin(c):
    c = np.asarray(c, np.float32)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def srgb(x):
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * x ** (1 / 2.4) - 0.055)


def disque(r):
    """Noyau de flou d'objectif : disque à bord doux, bord un peu plus lumineux."""
    if r < 0.5:
        k = np.zeros((1, 1), np.float32); k[0, 0] = 1; return k
    n = int(np.ceil(r)) + 2
    y, x = np.mgrid[-n:n + 1, -n:n + 1].astype(np.float32)
    d = np.sqrt(x * x + y * y)
    k = np.clip(r + 0.5 - d, 0, 1)
    k *= 0.88 + 0.12 * np.clip((d / max(r, 1)) ** 4, 0, 1)  # léger anneau
    return (k / k.sum()).astype(np.float32)


def flou(img, r):
    k = disque(r)
    p = k.shape[0] // 2 + 1
    def un(c):
        cp = np.pad(c, p, mode="reflect")
        return fftconvolve(cp, k, mode="same")[p:-p, p:-p]
    if img.ndim == 2:
        return un(img)
    return np.stack([un(img[..., c]) for c in range(img.shape[2])], -1)


def gauss(img, s):
    from scipy.ndimage import gaussian_filter
    if img.ndim == 2:
        return gaussian_filter(img, s)
    return np.stack([gaussian_filter(img[..., c], s) for c in range(img.shape[2])], -1)


yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)


def tache(img, cx, cy, r, couleur, dur=1.5):
    """Disque plein anti-aliasé (ajouté)."""
    x0, x1 = int(max(cx - r - 3, 0)), int(min(cx + r + 4, W))
    y0, y1 = int(max(cy - r - 3, 0)), int(min(cy + r + 4, H))
    if x0 >= x1 or y0 >= y1:
        return
    d = np.sqrt((xx[y0:y1, x0:x1] - cx) ** 2 + (yy[y0:y1, x0:x1] - cy) ** 2)
    a = np.clip((r - d) * dur + 0.5, 0, 1)[..., None]
    img[y0:y1, x0:x1] = img[y0:y1, x0:x1] * (1 - a) + a * np.asarray(couleur, np.float32)


def point(img, cx, cy, energie, couleur, taille=2.0):
    """Petite source très lumineuse (devient une bulle de bokeh après flou)."""
    x0, x1 = int(max(cx - 4, 0)), int(min(cx + 5, W))
    y0, y1 = int(max(cy - 4, 0)), int(min(cy + 5, H))
    if x0 >= x1 or y0 >= y1:
        return
    d2 = (xx[y0:y1, x0:x1] - cx) ** 2 + (yy[y0:y1, x0:x1] - cy) ** 2
    g = np.exp(-d2 / (2 * (taille / 2) ** 2))
    g = g / max(g.sum(), 1e-6) * energie
    img[y0:y1, x0:x1] += g[..., None] * np.asarray(couleur, np.float32)


# ---------------------------------------------------------------- 1. le mur (très loin)
mur = np.zeros((H, W, 3), np.float32)
haut = lin([0.12, 0.08, 0.06])
milieu = lin([0.50, 0.39, 0.29])
t = np.clip(yy / 1250, 0, 1)[..., None]
mur[:] = haut * (1 - t) + milieu * t
# halo chaud derrière le sapin
halo = np.exp(-(((xx - 560) / 520) ** 2 + ((yy - 700) / 700) ** 2))[..., None]
mur += halo * lin([0.55, 0.36, 0.18]) * 0.9
# fenêtre du soir à droite (bleu nuit + quelques lumières)
fen = ((xx > 860) & (xx < 1180) & (yy > 180) & (yy < 820)).astype(np.float32)
fen = gauss(fen, 6)[..., None]
mur = mur * (1 - fen * 0.85) + fen * 0.85 * lin([0.10, 0.16, 0.30])
for _ in range(10):
    point(mur, rng.uniform(880, 1080), rng.uniform(220, 780), rng.uniform(250, 700), lin([1.0, 0.75, 0.45]))
# lampe chaude en haut à gauche
for cx, cy, e in [(70, 260, 9000), (110, 300, 3000)]:
    point(mur, cx, cy, e, lin([1.0, 0.68, 0.32]), 3)

# ---------------------------------------------------------------- 2. le sapin
CX, Y_SOMMET, Y_BASE, DEMI_BASE = 520, 70, 1320, 760
sapin = np.zeros((H, W, 3), np.float32)
alpha = np.zeros((H, W), np.float32)


def demi_largeur(y):
    u = np.clip((y - Y_SOMMET) / (Y_BASE - Y_SOMMET), 0, 1)
    # étages : festons qui s'élargissent vers le bas de chaque étage
    etages = 7
    f = (u * etages) % 1.0
    base = DEMI_BASE * u ** 0.92
    return base * (0.80 + 0.20 * f ** 1.5)


dl = demi_largeur(yy)
dans = (np.abs(xx - CX) < dl) & (yy > Y_SOMMET) & (yy < Y_BASE)
alpha = gauss(dans.astype(np.float32), 2)
vert_fonce = lin([0.03, 0.12, 0.06])
vert = lin([0.15, 0.38, 0.18])
# volume : plus clair au centre et à gauche (lumière), sombre sur les bords
centre = 1 - np.clip(np.abs(xx - CX + 140) / np.maximum(dl, 1), 0, 1) ** 1.6
sapin[:] = vert_fonce + (vert - vert_fonce) * centre[..., None] * 0.9
# texture d'aiguilles : petites taches claires/sombres
for _ in range(2600):
    y = rng.uniform(Y_SOMMET, Y_BASE)
    d = demi_largeur(y)
    x = CX + rng.uniform(-d, d)
    c = vert * rng.uniform(0.5, 1.7) if rng.random() < 0.6 else vert_fonce * rng.uniform(0.2, 0.7)
    tache(sapin, x, y, rng.uniform(5, 16), c)
# ombre sous chaque étage
u = np.clip((yy - Y_SOMMET) / (Y_BASE - Y_SOMMET), 0, 1)
f = (u * 7) % 1.0
sapin *= (0.55 + 0.45 * np.clip(f * 3, 0, 1))[..., None]

# guirlandes de lumières (arcs qui tombent en travers du sapin)
CHAUD = [lin([1.0, 0.78, 0.42]), lin([1.0, 0.86, 0.6]), lin([1.0, 0.66, 0.30])]
for k in range(10):
    y_g = Y_SOMMET + 90 + k * 125
    d = demi_largeur(y_g + 60)
    for x in np.arange(CX - d + rng.uniform(0, 30), CX + d, rng.uniform(44, 60)):
        s = (x - (CX - d)) / max(2 * d, 1)
        y = y_g + 90 * s + 55 * np.sin(np.pi * s) + rng.normal(0, 4)
        if abs(x - CX) < demi_largeur(y) * 0.96:
            point(sapin, x, y, rng.uniform(500, 1500), CHAUD[rng.integers(0, 3)], 2)
# lumières dispersées
for _ in range(36):
    y = rng.uniform(Y_SOMMET + 60, Y_BASE)
    d = demi_largeur(y) * 0.95
    point(sapin, CX + rng.uniform(-d, d), y, rng.uniform(300, 1100), CHAUD[rng.integers(0, 3)], 2)
# boules rouges et dorées
ROUGE, OR, BORDEAUX = lin([0.92, 0.08, 0.08]), lin([0.95, 0.62, 0.18]), lin([0.70, 0.03, 0.08])
boules = []
for _ in range(30):
    y = rng.uniform(Y_SOMMET + 120, Y_BASE - 40)
    d = demi_largeur(y) * 0.85
    x = CX + rng.uniform(-d, d)
    r = rng.uniform(24, 42) * (0.7 + 0.5 * (y / H))
    c = [ROUGE, OR, BORDEAUX, ROUGE][rng.integers(0, 4)]
    tache(sapin, x, y, r, c)
    point(sapin, x - r * 0.35, y - r * 0.4, 70 * r, lin([1.0, 0.92, 0.8]), 2)
    boules.append((x, y, r))

# étoile au sommet
for e, s in [(6000, 4), (2500, 10)]:
    point(sapin, CX, Y_SOMMET - 20, e, lin([1.0, 0.82, 0.45]), s)

# paquets cadeaux au pied du sapin
for (x0, x1, y0, c, ruban) in [(40, 250, 1050, lin([0.70, 0.04, 0.06]), lin([0.95, 0.75, 0.30])),
                                (230, 360, 1110, lin([0.92, 0.88, 0.80]), lin([0.75, 0.05, 0.06])),
                                (760, 960, 1070, lin([0.85, 0.60, 0.20]), lin([0.70, 0.04, 0.06])),
                                (930, 1080, 1120, lin([0.08, 0.30, 0.14]), lin([0.95, 0.75, 0.30]))]:
    y1 = 1215
    m = ((xx >= x0) & (xx <= x1) & (yy >= y0) & (yy <= y1)).astype(np.float32)
    teinte = c * (0.75 + 0.25 * ((xx - x0) / (x1 - x0)))[..., None]
    sapin[:] = sapin * (1 - m[..., None]) + m[..., None] * teinte
    alpha = np.maximum(alpha, m)
    xm = (x0 + x1) / 2
    mr = (m * ((np.abs(xx - xm) < 9) | (np.abs(yy - (y0 + 40)) < 8))).astype(np.float32)
    sapin[:] = sapin * (1 - mr[..., None]) + mr[..., None] * ruban
    point(sapin, xm - 30, y0 + 12, 900, lin([1.0, 0.9, 0.75]), 2)

# --------------------------------------------------------- 3. flou d'objectif des fonds
R_MUR, R_SAPIN = 70, 34
mur_f = flou(mur, R_MUR)
sapin_f = flou(sapin * alpha[..., None], R_SAPIN)
alpha_f = flou(alpha, R_SAPIN)
fond = mur_f * (1 - alpha_f[..., None]) + sapin_f

# --------------------------------------------------------- 4. la neige (sol), flou selon la distance
Y_BORD = 1185
sol = np.zeros((H, W, 3), np.float32)
dy = np.maximum(yy - HORIZON, 1)
Z = CAM_H / (dy / HORIZON * TAN)                       # distance au sol
X = (xx - W / 2) / HORIZON * TAN * Z
blanc = lin([0.90, 0.88, 0.85])
sol[:] = blanc
# éclairage : plus lumineux au centre, un peu plus sombre sur les côtés et au loin
lum = 0.86 + 0.14 * np.exp(-((xx - 470) / 700) ** 2) - 0.42 * np.clip((Z - 13) / 13, 0, 1) ** 0.8
sol *= lum[..., None]
# reflet chaud du sapin sur la neige, au fond
reflet = np.exp(-((yy - Y_BORD) / 160) ** 2) * np.exp(-((xx - CX) / 520) ** 2)
sol += reflet[..., None] * lin([0.55, 0.32, 0.12]) * 0.35
# relief de la neige : bruit projeté en perspective
from scipy.ndimage import map_coordinates
N = 1024
bruit = gauss(rng.standard_normal((N, N)).astype(np.float32), 2.0) * 3.0
bruit += gauss(rng.standard_normal((N, N)).astype(np.float32), 7.0) * 6.0
bruit = np.pad(bruit, 0, mode="wrap")
cu = ((X * 70) % N)
cv = ((Z * 70) % N)
relief = map_coordinates(bruit, [cv.ravel(), cu.ravel()], order=1, mode="wrap").reshape(H, W)
sol *= (1 + 0.05 * np.tanh(relief))[..., None]
# paillettes de neige (petites étincelles)
for _ in range(1600):
    y = rng.uniform(Y_BORD + 10, H)
    x = rng.uniform(0, W)
    zz = CAM_H / ((y - HORIZON) / HORIZON * TAN)
    e = rng.uniform(4, 22) * (11 / zz) ** 1.0
    point(sol, x, y, e, lin([1.0, 0.96, 0.9]), 1.2)
alpha_sol = gauss((yy > Y_BORD).astype(np.float32), 18)

# flou variable par ligne (cercle de confusion selon la distance)
K = 40 / abs(1 / 30.0 - 1 / CAM_D)
r_ligne = K * np.abs(1 / np.maximum(Z[:, 0], 0.1) - 1 / CAM_D)
r_ligne = np.minimum(r_ligne, 44)
rayons = [0, 1.5, 3, 5, 7.5, 10, 14, 19, 25, 30, 36, 44]
pile, pile_a = [], []
pre = sol * alpha_sol[..., None]
for r in rayons:
    pile.append(flou(pre, r))
    pile_a.append(flou(alpha_sol, r))
sol_f = np.zeros_like(sol)
a_f = np.zeros((H, W), np.float32)
for y in range(H):
    r = r_ligne[y]
    i = int(np.searchsorted(rayons, r) - 1)
    i = max(0, min(i, len(rayons) - 2))
    w = np.clip((r - rayons[i]) / (rayons[i + 1] - rayons[i]), 0, 1)
    sol_f[y] = pile[i][y] * (1 - w) + pile[i + 1][y] * w
    a_f[y] = pile_a[i][y] * (1 - w) + pile_a[i + 1][y] * w
image = fond * (1 - a_f[..., None]) + sol_f

# --------------------------------------------------------- 5. développement
expo = 1.0
x = image * expo
# épaule douce pour les hautes lumières
seuil = 0.75
x = np.where(x < seuil, x, seuil + (1 - seuil) * (1 - np.exp(-(x - seuil) / (1 - seuil))))
out = srgb(x)
out = out + rng.uniform(-0.5, 0.5, out.shape) / 255.0      # anti-bandes
Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8)).save(SORTIE)
print("ok", SORTIE, "rayon flou par ligne : bas", round(float(r_ligne[-1]), 1), "focus", round(float(r_ligne[1499]), 1), "bord", round(float(r_ligne[Y_BORD]), 1))
