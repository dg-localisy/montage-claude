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


def calques(variante=1, decalage=0):
    """Renvoie une liste de lignes : (rgba, alpha_ombre, y_centre). decalage : remonte le texte de N px."""
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
        return [(l[0], ombre(l[0][..., 3]), y - decalage) for l, y in zip([l1, l2, l3], [610, 690, 775])]
    return [(l[0], ombre(l[0][..., 3]), y - decalage) for l, y in zip([l1, l2], ys)]


def etiquette(texte, fichier="Figtree-SemiBold.ttf", taille=34, espacement=1.0, fond=(95, 150, 48), hauteur=66):
    """Pastille arrondie verte Fortemps, icône de localisation + texte blanc. Renvoie (rgba, alpha_ombre)."""
    k = 4                                                     # dessin 4x plus grand puis réduit (bords lisses)
    f = ImageFont.truetype(f"{POLICES}/{fichier}", taille * k)
    larg_txt = sum(f.getlength(c) for c in texte) + espacement * k * (len(texte) - 1)
    h = hauteur * k
    icone = int(0.44 * h)
    marge_g, marge_d, ecart = int(0.42 * h), int(0.5 * h), int(0.2 * h)
    w = int(marge_g + icone + ecart + larg_txt + marge_d)
    marge = 40 * k
    a = Image.new("L", (w + 2 * marge, h + 2 * marge), 0)
    blanc = Image.new("L", a.size, 0)
    d, db = ImageDraw.Draw(a), ImageDraw.Draw(blanc)
    d.rounded_rectangle((marge, marge, marge + w, marge + h), radius=h // 2, fill=255)
    # icône : goutte de localisation au trait, avec un point au centre
    cx, cy, r = marge + marge_g + icone / 2, marge + h * 0.43, icone * 0.36
    trait = max(int(0.085 * icone), 2)
    pointe = (cx, marge + h * 0.43 + icone * 0.62)
    import math
    ang = math.asin(r / (pointe[1] - cy))
    p1 = (cx - r * math.cos(ang), cy + r * math.sin(ang)); p2 = (cx + r * math.cos(ang), cy + r * math.sin(ang))
    db.pieslice((cx - r - trait / 2, cy - r - trait / 2, cx + r + trait / 2, cy + r + trait / 2), 0, 360, fill=255)
    db.polygon([(p1[0] - trait / 2, p1[1]), (p2[0] + trait / 2, p2[1]), (pointe[0], pointe[1] + trait / 2)], fill=255)
    db.pieslice((cx - r + trait / 2, cy - r + trait / 2, cx + r - trait / 2, cy + r - trait / 2), 0, 360, fill=0)
    db.polygon([(p1[0] + trait * 0.9, p1[1] - trait * 0.3), (p2[0] - trait * 0.9, p2[1] - trait * 0.3), (pointe[0], pointe[1] - trait * 1.4)], fill=0)
    rp = r * 0.36
    db.ellipse((cx - rp, cy - rp, cx + rp, cy + rp), fill=255)
    asc, desc = f.getmetrics()
    x = marge + marge_g + icone + ecart
    y = marge + (h - (asc + desc)) / 2 + desc * 0.15
    for c in texte:
        db.text((x, y), c, font=f, fill=255)
        x += f.getlength(c) + espacement * k
    taille_finale = (a.width // k, a.height // k)
    a = np.asarray(a.resize(taille_finale, Image.LANCZOS)).astype(np.float32) / 255
    b = np.asarray(blanc.resize(taille_finale, Image.LANCZOS)).astype(np.float32) / 255
    rgba = np.zeros((*a.shape, 4), np.float32)
    couleur = np.array(fond, np.float32) / 255
    rgba[..., :3] = couleur * (1 - b[..., None]) + b[..., None]
    rgba[..., 3] = a
    return rgba, ombre(a, rayon=12, force=0.35, decalage=(0, 6))


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
