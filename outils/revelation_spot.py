#!/usr/bin/env python3
"""Révélation par un rond mobile (« trou de serrure ») sur une photo.

Toute l'image est noire, sauf un rond qui se promène lentement sur la photo
et en montre un morceau à la fois. Pas de texte, pas de musique.

    python3 outils/revelation_spot.py PHOTO.jpg
    python3 outils/revelation_spot.py PHOTO.jpg --points "0.69,0.77 0.29,0.74 0.67,0.36"

Options :
  --points  trajet du rond, points "x,y" séparés par des espaces, en fraction
            de la photo (0 à 1) ou en pixels. Sans cette option, les zones les
            plus riches (couleurs, détails, lumières) sont choisies seules.
  --duree   durée en secondes (10 par défaut, 10 au maximum)
  --rayon   rayon du rond, en fraction de la largeur de la photo (0.14)
  --fps     images par seconde (30)
  --sortie  dossier de sortie (par défaut PHOTO_spot/ à côté de la photo)
  --nom     début du nom des fichiers (par défaut le nom de la photo)

Livrables : NOM_9x16.mp4 et NOM_4x5.mp4 (H.264 High, yuv420p, piste son AAC
48 kHz muette), trajet.jpg (le parcours dessiné sur la photo) et
planche.jpg (images fixes de la vidéo, pour vérifier avant de livrer).

Chaque format est fabriqué directement (pas de recadrage du 9:16), pour que le
rond reste toujours entier à l'écran. Hors du rond, les pixels valent 0 : aucune
fuite de lumière.
"""

import argparse
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw

FORMATS = [("9x16", 1080, 1920), ("4x5", 1080, 1350)]


# --- petites courbes d'animation -------------------------------------------

def lisse(a, b, x):
    """0 avant a, 1 après b, transition douce entre les deux."""
    t = np.clip((np.asarray(x, dtype=float) - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def tres_lisse(a, b, x):
    t = np.clip((np.asarray(x, dtype=float) - a) / (b - a), 0.0, 1.0)
    return t * t * t * (t * (6 * t - 15) + 10)


# --- cadrage ----------------------------------------------------------------

def cadrage(lp, hp, l, h):
    """Photo agrandie pour remplir l'écran, centrée : (échelle, décalage x, décalage y)."""
    e = max(l / lp, h / hp)
    return e, (lp * e - l) / 2, (hp * e - h) / 2


def zone_commune(lp, hp, r):
    """Zone de la photo où le rond reste entier dans les deux formats."""
    x0, y0, x1, y1 = 0.0, 0.0, float(lp), float(hp)
    for _, l, h in FORMATS:
        e, ox, oy = cadrage(lp, hp, l, h)
        x0, y0 = max(x0, ox / e), max(y0, oy / e)
        x1, y1 = min(x1, (ox + l) / e), min(y1, (oy + h) / e)
    m = r * 1.08
    return x0 + m, y0 + m, x1 - m, y1 - m


# --- trajet -----------------------------------------------------------------

def borne_douce(v, bas, haut, m):
    """Garde v entre bas et haut ; près des limites, la valeur ralentit au lieu de buter."""
    def cote(u):
        return np.where(u >= 1, u, np.exp(np.minimum(u, 1) - 1))
    v = bas + m * cote((v - bas) / m)
    return haut - m * cote((haut - v) / m)


def catmull_rom(points, pas=400):
    """Courbe centripète passant par tous les points. Renvoie (courbe, indices des points)."""
    p = np.asarray(points, dtype=float)
    if len(p) == 1:
        p = np.vstack([p, p + 1e-3])
    ext = np.vstack([2 * p[0] - p[1], p, 2 * p[-1] - p[-2]])
    morceaux, reperes = [], [0]
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        t0 = 0.0
        t1 = t0 + max(np.linalg.norm(p1 - p0), 1e-6) ** 0.5
        t2 = t1 + max(np.linalg.norm(p2 - p1), 1e-6) ** 0.5
        t3 = t2 + max(np.linalg.norm(p3 - p2), 1e-6) ** 0.5
        t = np.linspace(t1, t2, pas, endpoint=False)[:, None]
        a1 = (t1 - t) / (t1 - t0) * p0 + (t - t0) / (t1 - t0) * p1
        a2 = (t2 - t) / (t2 - t1) * p1 + (t - t1) / (t2 - t1) * p2
        a3 = (t3 - t) / (t3 - t2) * p2 + (t - t2) / (t3 - t2) * p3
        b1 = (t2 - t) / (t2 - t0) * a1 + (t - t0) / (t2 - t0) * a2
        b2 = (t3 - t) / (t3 - t1) * a2 + (t - t1) / (t3 - t1) * a3
        morceaux.append((t2 - t) / (t2 - t1) * b1 + (t - t1) / (t2 - t1) * b2)
        reperes.append(reperes[-1] + pas)
    courbe = np.vstack(morceaux + [p[-1][None, :]])
    return courbe, reperes


def horaire(courbe, reperes, rayon, t_debut, t_fin):
    """Temps de passage de chaque point de la courbe.

    Le rond ralentit (sans s'arrêter) sur chaque point choisi, démarre et
    finit en douceur. Renvoie un tableau de temps de même longueur que la courbe.
    """
    seg = np.linalg.norm(np.diff(courbe, axis=0), axis=1)
    s = np.concatenate([[0.0], np.cumsum(seg)])
    total = max(s[-1], 1e-6)
    vitesse = np.ones_like(s)
    largeur = 0.7 * rayon
    for i in reperes[1:-1]:
        vitesse -= 0.3 * np.exp(-0.5 * ((s - s[i]) / largeur) ** 2)
    rampe = min(1.2 * rayon, total / 3)
    vitesse *= 0.3 + 0.7 * lisse(0, rampe, s) * lisse(0, rampe, total - s)
    vitesse = np.maximum(vitesse, 0.06)
    dt = np.concatenate([[0.0], seg / (0.5 * (vitesse[1:] + vitesse[:-1]))])
    temps = np.cumsum(dt)
    return t_debut + (t_fin - t_debut) * temps / max(temps[-1], 1e-9)


def points_auto(photo, rayon, n=5):
    """Choisit les zones les plus riches de la photo (couleurs, détails, lumières)."""
    from scipy import ndimage

    lp, hp = photo.size
    f = 400.0 / lp
    im = np.asarray(photo.resize((400, max(1, round(hp * f))), Image.LANCZOS), dtype=float) / 255
    lum = im @ np.array([0.2126, 0.7152, 0.0722])
    mx, mn = im.max(axis=2), im.min(axis=2)
    sat = (mx - mn) / np.maximum(mx, 1e-3)
    detail = np.abs(ndimage.gaussian_filter(lum, 1.5) - ndimage.gaussian_filter(lum, 8))
    lumieres = np.clip(lum - 0.8, 0, 1) * (lum > ndimage.gaussian_filter(lum, 4) + 0.08)

    def norm(a):
        return a / max(np.percentile(a, 99.5), 1e-6)

    carte = 0.45 * norm(detail) + 0.35 * sat * (lum > 0.08) + 0.20 * norm(lumieres)
    r = rayon * f
    carte = ndimage.gaussian_filter(carte, 0.55 * r)
    x0, y0, x1, y1 = (v * f for v in zone_commune(lp, hp, rayon))
    masque = np.zeros_like(carte, dtype=bool)
    masque[int(math.ceil(y0)):int(y1) + 1, int(math.ceil(x0)):int(x1) + 1] = True
    carte = np.where(masque, carte, -1)
    yy, xx = np.mgrid[0:carte.shape[0], 0:carte.shape[1]]
    choisis = []
    for _ in range(n):
        i = int(np.argmax(carte))
        if carte.flat[i] <= 0:
            break
        y, x = divmod(i, carte.shape[1])
        choisis.append((x / f, y / f))
        carte[(xx - x) ** 2 + (yy - y) ** 2 < (1.7 * r) ** 2] = -1
    if not choisis:
        return [(lp / 2, hp / 2)]
    # départ en bas, puis toujours vers le point le plus proche
    reste = sorted(choisis, key=lambda p: -p[1])
    ordre = [reste.pop(0)]
    while reste:
        k = min(range(len(reste)), key=lambda j: math.dist(ordre[-1], reste[j]))
        ordre.append(reste.pop(k))
    return ordre


def lire_points(texte, lp, hp):
    pts = []
    for morceau in texte.replace(";", " ").split():
        x, y = (float(v) for v in morceau.split(","))
        if x <= 1 and y <= 1:
            x, y = x * lp, y * hp
        pts.append((x, y))
    if not pts:
        sys.exit("--points : aucun point lu")
    return pts


# --- animation --------------------------------------------------------------

class Animation:
    def __init__(self, points, rayon, duree, zone=None):
        self.rayon = rayon
        self.duree = duree
        self.ouverture = (0.35, 1.55)           # le rond s'allume
        self.fermeture = (duree - 1.35, duree - 0.25)  # puis s'éteint
        self.courbe, self.reperes = catmull_rom(points)
        if zone:
            # la courbe peut déborder un peu entre deux points : on la ramène
            # dans la zone en douceur (pas d'arrêt net contre le bord)
            m = 0.25 * rayon
            for k, (bas, haut) in enumerate(((zone[0], zone[2]), (zone[1], zone[3]))):
                self.courbe[:, k] = borne_douce(self.courbe[:, k], bas, haut, m)
        # le rond arrive sur le dernier point avant de s'éteindre
        self.temps = horaire(self.courbe, self.reperes, rayon, 0.0, duree - 0.9)
        # lissage dans le temps : aucun à-coup au passage des points
        self.grille = np.arange(0.0, duree + 1e-9, 1 / 500)
        noyau = np.exp(-0.5 * (np.arange(-300, 301) / 75.0) ** 2)
        noyau /= noyau.sum()
        self.lisse_xy = []
        for k in range(2):
            v = np.interp(self.grille, self.temps, self.courbe[:, k])
            v = np.convolve(np.pad(v, 300, mode="edge"), noyau, mode="valid")
            self.lisse_xy.append(v)

    def centre(self, t):
        x = np.interp(t, self.grille, self.lisse_xy[0])
        y = np.interp(t, self.grille, self.lisse_xy[1])
        # tout petit flottement, comme une lampe tenue à la main
        a = 0.022 * self.rayon
        x += a * (math.sin(2 * math.pi * 0.19 * t + 1.3) + 0.6 * math.sin(2 * math.pi * 0.41 * t + 0.2))
        y += a * (math.sin(2 * math.pi * 0.16 * t + 2.1) + 0.6 * math.sin(2 * math.pi * 0.37 * t + 4.0))
        return x, y

    def lumiere(self, t):
        return float(tres_lisse(*self.ouverture, t) * (1 - tres_lisse(*self.fermeture, t)))

    def taille(self, t):
        allume = float(lisse(self.ouverture[0], self.ouverture[1], t)
                       * (1 - lisse(self.fermeture[0], self.fermeture[1], t)))
        respiration = 1 + 0.012 * math.sin(2 * math.pi * 0.23 * t + 0.7)
        return self.rayon * (0.95 + 0.05 * allume) * respiration


def image(photo_ecran, l, h, cx, cy, r, lumiere, flou_bord=4.0):
    """Une image de la vidéo : noir partout, la photo visible dans le rond."""
    sortie = np.zeros((h, l, 3), dtype=np.uint8)
    if lumiere <= 0 or r <= 1:
        return sortie
    x0, x1 = max(0, int(cx - r - 2)), min(l, int(cx + r + 3))
    y0, y1 = max(0, int(cy - r - 2)), min(h, int(cy + r + 3))
    if x0 >= x1 or y0 >= y1:
        return sortie
    yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    d = np.sqrt((xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2)
    bord = np.clip((r - d) / flou_bord, 0, 1)
    bord = bord * bord * (3 - 2 * bord)                    # bord net mais sans escalier
    e = np.clip((d - 0.55 * r) / (0.45 * r), 0, 1)
    halo = 1 - 0.3 * e * e                                 # léger assombrissement vers le bord
    k = (bord * halo * lumiere)[..., None]
    morceau = photo_ecran[y0:y1, x0:x1] * k
    sortie[y0:y1, x0:x1] = np.clip(morceau + 0.5, 0, 255).astype(np.uint8)
    return sortie


def rendre(photo, anim, nom_format, l, h, fps, chemin):
    lp, hp = photo.size
    e, ox, oy = cadrage(lp, hp, l, h)
    grand = photo.resize((round(lp * e), round(hp * e)), Image.LANCZOS)
    ix, iy = round(ox), round(oy)
    ecran = np.asarray(grand, dtype=np.float32)[iy:iy + h, ix:ix + l]
    n = int(round(anim.duree * fps))
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{l}x{h}", "-r", str(fps), "-i", "-",
        "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
        "-map", "0:v", "-map", "1:a", "-shortest",
        "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
        "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", "12",
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
        "-c:a", "aac", "-b:a", "256k", "-ar", "48000",
        "-movflags", "+faststart", chemin,
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(n):
        t = i / fps
        x, y = anim.centre(t)
        cx, cy = x * e - ix, y * e - iy
        proc.stdin.write(image(ecran, l, h, cx, cy, anim.taille(t) * e, anim.lumiere(t)).tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        sys.exit(f"ffmpeg a échoué pour le format {nom_format}")


# --- vérifications visuelles ------------------------------------------------

def dessiner_trajet(photo, anim, points, chemin):
    im = photo.copy()
    d = ImageDraw.Draw(im)
    lp, hp = im.size
    x0, y0, x1, y1 = zone_commune(lp, hp, anim.rayon)
    d.rectangle([x0, y0, x1, y1], outline=(0, 160, 255), width=3)
    trace = list(zip(anim.lisse_xy[0][::25], anim.lisse_xy[1][::25]))
    d.line(trace, fill=(255, 77, 0), width=6)
    for k, (x, y) in enumerate(points):
        r = anim.rayon
        d.ellipse([x - r, y - r, x + r, y + r], outline=(255, 255, 255), width=4)
        d.text((x + 8, y + 8), str(k + 1), fill=(255, 255, 255))
    im.thumbnail((900, 900))
    im.save(chemin, quality=88)


def planche(video, duree, chemin, n=10):
    """Images fixes tirées de la vidéo finale (décodée), côte à côte."""
    temps = [duree * (k + 0.5) / n for k in range(n)]
    vignettes = []
    for t in temps:
        brut = subprocess.run(
            ["ffmpeg", "-loglevel", "error", "-ss", f"{t:.3f}", "-i", video, "-frames:v", "1",
             "-vf", "scale=270:-2", "-f", "image2pipe", "-vcodec", "png", "-"],
            capture_output=True, check=True).stdout
        from io import BytesIO
        vignettes.append(Image.open(BytesIO(brut)).convert("RGB"))
    lv, hv = vignettes[0].size
    cols = 5
    rangs = math.ceil(n / cols)
    fond = Image.new("RGB", (cols * (lv + 8) + 8, rangs * (hv + 30) + 8), (40, 40, 40))
    d = ImageDraw.Draw(fond)
    for k, (v, t) in enumerate(zip(vignettes, temps)):
        x = 8 + (k % cols) * (lv + 8)
        y = 8 + (k // cols) * (hv + 30)
        fond.paste(v, (x, y))
        d.text((x + 4, y + hv + 6), f"{t:.1f} s", fill=(230, 230, 230))
    fond.save(chemin, quality=88)


def main():
    ap = argparse.ArgumentParser(description="Révélation d'une photo par un rond mobile sur fond noir.")
    ap.add_argument("photo")
    ap.add_argument("--points")
    ap.add_argument("--duree", type=float, default=10.0)
    ap.add_argument("--rayon", type=float, default=0.14)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--sortie")
    ap.add_argument("--nom")
    a = ap.parse_args()

    if not 3 <= a.duree <= 10:
        sys.exit("--duree : entre 3 et 10 secondes")
    photo = Image.open(a.photo)
    photo = photo.convert("RGB")
    lp, hp = photo.size
    rayon = a.rayon * lp
    base = os.path.splitext(os.path.basename(a.photo))[0]
    sortie = a.sortie or os.path.join(os.path.dirname(os.path.abspath(a.photo)), base + "_spot")
    nom = a.nom or base
    os.makedirs(sortie, exist_ok=True)

    points = lire_points(a.points, lp, hp) if a.points else points_auto(photo, rayon)
    x0, y0, x1, y1 = zone_commune(lp, hp, rayon)
    points = [(min(max(x, x0), x1), min(max(y, y0), y1)) for x, y in points]
    anim = Animation(points, rayon, a.duree, zone=(x0, y0, x1, y1))

    print("Trajet (pixels de la photo) :", ", ".join(f"({x:.0f}, {y:.0f})" for x, y in points))
    dessiner_trajet(photo, anim, points, os.path.join(sortie, "trajet.jpg"))
    for nom_format, l, h in FORMATS:
        chemin = os.path.join(sortie, f"{nom}_{nom_format}.mp4")
        rendre(photo, anim, nom_format, l, h, a.fps, chemin)
        planche(chemin, a.duree, os.path.join(sortie, f"planche_{nom_format}.jpg"))
        print("Vidéo :", chemin)


if __name__ == "__main__":
    main()
