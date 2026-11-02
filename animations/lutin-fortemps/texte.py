"""Fabrique les calques de texte (Figtree) : une image RGBA par ligne, avec ombre douce."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

# polices Figtree statiques, à la racine du dépôt
POLICES = str(Path(__file__).resolve().parents[2])


def ligne(texte, fichier, taille, espacement, couleur=(255, 255, 255), largeur_max=930):
    """Dessine une ligne avec espacement des lettres ; réduit la taille si elle dépasse largeur_max."""
    while True:
        f = ImageFont.truetype(f"{POLICES}/{fichier}", taille)
        larg = sum(f.getlength(c) for c in texte) + espacement * (len(texte) - 1)
        if larg <= largeur_max:
            break
        taille -= 1
    asc, desc = f.getmetrics()
    marge = 40
    im = Image.new("L", (int(larg) + 2 * marge, asc + desc + 2 * marge), 0)
    d = ImageDraw.Draw(im)
    x = marge
    for c in texte:
        d.text((x, marge), c, font=f, fill=255)
        x += f.getlength(c) + espacement
    a = np.asarray(im).astype(np.float32) / 255
    rgba = np.zeros((*a.shape, 4), np.float32)
    rgba[..., :3] = np.array(couleur, np.float32) / 255
    rgba[..., 3] = a
    return rgba, taille, asc


def ombre(alpha, rayon=10, force=0.55, decalage=(0, 4)):
    im = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(rayon))
    o = np.asarray(im).astype(np.float32) / 255 * force
    return np.roll(o, decalage, axis=(1, 0))


def calques(variante=1):
    """Renvoie une liste de lignes : (rgba, alpha_ombre, y_centre)."""
    if variante == 1:
        l1 = ligne("DÉCOUVREZ NOS BONS CADEAUX", "Figtree-SemiBold.ttf", 44, 7)
        l2 = ligne("CHEZ MOBILIER FORTEMPS", "Figtree-Black.ttf", 66, 2)
        ys = [700, 772]
    elif variante == 2:
        l1 = ligne("Découvrez nos bons cadeaux", "Figtree-SemiBold.ttf", 58, 0.5)
        l2 = ligne("chez Mobilier Fortemps", "Figtree-Black.ttf", 72, 0)
        ys = [700, 776]
    else:
        l1 = ligne("DÉCOUVREZ NOS", "Figtree-SemiBold.ttf", 46, 8)
        l2 = ligne("BONS CADEAUX", "Figtree-Black.ttf", 92, 1)
        l3 = ligne("CHEZ MOBILIER FORTEMPS", "Figtree-Bold.ttf", 40, 6)
        return [(l[0], ombre(l[0][..., 3]), y) for l, y in zip([l1, l2, l3], [610, 690, 775])]
    return [(l[0], ombre(l[0][..., 3]), y) for l, y in zip([l1, l2], ys)]


def poser(img, rgba, omb, y_centre, opacite=1.0, dy=0.0, flou=0.0, voile=None):
    """Compose une ligne sur img (float 0..1, HxWx3), centrée horizontalement."""
    h, w = rgba.shape[:2]
    a = rgba[..., 3]
    o = omb
    if flou > 0.3:
        a = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(flou))).astype(np.float32) / 255
        o = np.asarray(Image.fromarray((o * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(flou))).astype(np.float32) / 255
    H, W = img.shape[:2]
    x0 = (W - w) // 2
    y0 = int(round(y_centre - h / 2 + dy))
    ya, yb = max(y0, 0), min(y0 + h, H)
    xa, xb = max(x0, 0), min(x0 + w, W)
    sa = a[ya - y0:yb - y0, xa - x0:xb - x0, None] * opacite
    so = o[ya - y0:yb - y0, xa - x0:xb - x0, None] * opacite
    zone = img[ya:yb, xa:xb]
    zone *= (1 - so)
    zone[:] = zone * (1 - sa) + rgba[ya - y0:yb - y0, xa - x0:xb - x0, :3] * sa
    return img


def voile_sombre(H, W, y_centre, hauteur, force):
    """Halo sombre très doux derrière le texte, pour la lisibilité sur le bokeh."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    v = np.exp(-(((yy - y_centre) / hauteur) ** 2) - ((xx - W / 2) / (W * 0.62)) ** 2)
    return 1 - force * v


if __name__ == "__main__":
    import sys
    base = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(np.float32) / 255
    sorties = []
    for v in (1, 2, 3):
        img = base.copy()
        lignes = calques(v)
        yc = sum(l[2] for l in lignes) / len(lignes)
        img *= voile_sombre(*img.shape[:2], yc, 190, 0.38)[..., None]
        for rgba, omb, y in lignes:
            poser(img, rgba, omb, y)
        sorties.append(Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).crop((0, 380, 1080, 1620)))
    w, h = sorties[0].size
    pl = Image.new("RGB", (w * 3 + 20, h), "black")
    for i, s in enumerate(sorties):
        pl.paste(s, (i * (w + 10), 0))
    pl.resize((pl.width // 2, pl.height // 2), Image.LANCZOS).save(sys.argv[2])
