"""Finition : texte animé, reflet sur la carte, petite étoile, zoom lent, vignette, grain.
Exporte la version 9:16 (1080x1920) et la version 4:5 (1080x1350) en H.264 + AAC 48 kHz.

python3 finition.py brut.mkv brut_coins.json SORTIE_9x16.mp4 SORTIE_4x5.mp4 [--images t1,t2 DOSSIER]
"""
import json
import subprocess
import sys
import numpy as np
from PIL import Image, ImageDraw
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import texte

W, H, FPS = 1080, 1920, 30
brut, f_coins, sortie916, sortie45 = sys.argv[1:5]
images_seules = None
if len(sys.argv) > 5 and sys.argv[5] == "--images":
    images_seules = [round(float(x) * FPS) for x in sys.argv[6].split(",")]
    dossier_images = sys.argv[7]

donnees = json.load(open(f_coins))
T_FIN = donnees["infos"]["tFin"]
coins = {int(k): v for k, v in donnees["coins"].items()}
n_images = max(coins) + 1
rng = np.random.default_rng(3)


def lisse(a, b, x):
    u = np.clip((x - a) / (b - a), 0, 1)
    return u * u * (3 - 2 * u)


def sortie_douce(a, b, x):
    u = np.clip((x - a) / (b - a), 0, 1)
    return 1 - (1 - u) ** 3


# --- calques fixes
LIGNES = texte.calques(3)
T_TEXTE = T_FIN + 0.55
T_REFLET = T_FIN + 0.2
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
r = np.sqrt(((xx - W / 2) / (W * 0.75)) ** 2 + ((yy - H * 0.52) / (H * 0.62)) ** 2)
VIGNETTE = (1 - 0.2 * np.clip(r, 0, 1.4) ** 2.6)[..., None].astype(np.float32)
Y_TEXTE = sum(l[2] for l in LIGNES) / len(LIGNES)
HALO = texte.voile_sombre(H, W, Y_TEXTE, 200, 1.0)  # 1 - v ; on dose plus bas
HALO_V = (1 - HALO)[..., None].astype(np.float32)


def etoile(taille=90):
    """Petite étoile à 4 branches (scintillement)."""
    n = taille * 2 + 1
    y, x = np.mgrid[-taille:taille + 1, -taille:taille + 1].astype(np.float32)
    d = np.sqrt(x * x + y * y)
    branches = np.exp(-(np.abs(y) / 1.6)) * np.exp(-np.abs(x) / (taille * 0.42)) + np.exp(-(np.abs(x) / 1.6)) * np.exp(-np.abs(y) / (taille * 0.42))
    coeur = np.exp(-(d / 7) ** 2) + 0.35 * np.exp(-(d / 22) ** 2)
    return np.clip(branches * 0.9 + coeur, 0, 1.5)


ETOILE = etoile()
CENTRE_ZOOM = (W / 2, 1180.0)


def zoom_facteur(t):
    return 1 + 0.04 * lisse(T_FIN - 1.2, T_FIN + 4.6, t)


def appliquer_zoom(im, s):
    if s <= 1.0001:
        return im
    cx, cy = CENTRE_ZOOM
    return im.transform((W, H), Image.AFFINE, (1 / s, 0, cx - cx / s, 0, 1 / s, cy - cy / s), resample=Image.BICUBIC)


def reflet(img, poly, t):
    """Bande de lumière en diagonale qui traverse la carte."""
    u = (t - T_REFLET) / 0.85
    if u <= 0 or u >= 1:
        return
    xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
    x0, x1 = int(min(xs)) - 2, int(max(xs)) + 3
    y0, y1 = int(min(ys)) - 2, int(max(ys)) + 3
    k = 4
    m = Image.new("L", ((x1 - x0) * k, (y1 - y0) * k), 0)
    ImageDraw.Draw(m).polygon([((px - x0) * k, (py - y0) * k) for px, py in poly], fill=255)
    m = np.asarray(m.resize((x1 - x0, y1 - y0), Image.LANCZOS)).astype(np.float32) / 255
    gy, gx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    pente = np.tan(np.radians(28))
    s = (gx - x0) + (gy - y0) * pente
    largeur = (x1 - x0) + (y1 - y0) * pente
    c = -150 + (largeur + 300) * (u * u * (3 - 2 * u))
    bande = 0.42 * np.exp(-((s - c) / 55) ** 2) + 0.22 * np.exp(-((s - c - 95) / 14) ** 2)
    a = (bande * m)[..., None]
    zone = img[y0:y1, x0:x1]
    zone[:] = 1 - (1 - zone) * (1 - a * np.array([1.0, 0.98, 0.92], np.float32))


def scintillement(img, x, y, t, t0, force=1.0):
    u = (t - t0) / 0.6
    if u <= 0 or u >= 1:
        return
    e = np.sin(np.pi * u) ** 1.5 * force
    s = 0.55 + 0.45 * np.sin(np.pi * u)
    taille = int(90 * s)
    st = np.asarray(Image.fromarray((np.clip(ETOILE / 1.5, 0, 1) * 255).astype(np.uint8)).resize((2 * taille + 1, 2 * taille + 1), Image.LANCZOS)).astype(np.float32) / 255 * 1.5
    x, y = int(x), int(y)
    ya, yb = max(y - taille, 0), min(y + taille + 1, H)
    xa, xb = max(x - taille, 0), min(x + taille + 1, W)
    a = (st[ya - (y - taille):yb - (y - taille), xa - (x - taille):xb - (x - taille)] * e)[..., None]
    zone = img[ya:yb, xa:xb]
    zone[:] = 1 - (1 - zone) * (1 - np.clip(a * np.array([1.0, 0.95, 0.85], np.float32), 0, 1))


def finir(rgb, n):
    t = n / FPS
    s = zoom_facteur(t)
    im = appliquer_zoom(Image.fromarray(rgb), s)
    img = np.asarray(im).astype(np.float32) / 255
    img = img.copy()
    # reflet + étoile sur la carte (coins suivis image par image, puis zoomés)
    cx, cy = CENTRE_ZOOM
    poly = [(cx + (p[0] - cx) * s, cy + (p[1] - cy) * s) for p in coins.get(n, coins[n_images - 1])]
    reflet(img, poly, t)
    hx, hy = poly[2]
    scintillement(img, hx - 10, hy + 8, t, T_REFLET + 0.55)
    # halo sombre puis texte
    halo = 0.36 * sortie_douce(T_TEXTE - 0.15, T_TEXTE + 0.8, t)
    if halo > 0:
        img *= 1 - halo * HALO_V
    for i, (rgba, omb, y) in enumerate(LIGNES):
        t0 = T_TEXTE + 0.18 * i
        a = sortie_douce(t0, t0 + 0.75, t)
        if a <= 0:
            continue
        texte.poser(img, rgba, omb, y, opacite=float(a), dy=float(16 * (1 - a)), flou=float(9 * (1 - a)))
    img *= VIGNETTE
    # grain fin
    g = rng.normal(0, 0.011, (H, W, 1)).astype(np.float32)
    img = img + g * (0.35 + 0.65 * np.sqrt(np.clip(img.mean(-1, keepdims=True), 0, 1)))
    return (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)


def lecteur():
    p = subprocess.Popen(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", brut, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         stdout=subprocess.PIPE)
    taille = W * H * 3
    n = 0
    while True:
        b = p.stdout.read(taille)
        if len(b) < taille:
            break
        yield n, np.frombuffer(b, np.uint8).reshape(H, W, 3)
        n += 1


def encodeur(sortie, w, h):
    return subprocess.Popen(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                             "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}", "-r", str(FPS), "-i", "-",
                             "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
                             "-map", "0:v", "-map", "1:a", "-shortest",
                             "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-profile:v", "high", "-pix_fmt", "yuv420p",
                             "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
                             "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-movflags", "+faststart", sortie],
                            stdin=subprocess.PIPE)


if images_seules is not None:
    import os
    os.makedirs(dossier_images, exist_ok=True)
    voulues = set(images_seules)
    for n, rgb in lecteur():
        if n in voulues:
            out = finir(rgb, n)
            Image.fromarray(out).save(f"{dossier_images}/fini_{n:04d}.png")
            print("image", n)
    sys.exit(0)

Y45 = (H - 1350) // 2
e916 = encodeur(sortie916, W, H)
e45 = encodeur(sortie45, W, 1350)
for n, rgb in lecteur():
    out = finir(rgb, n)
    e916.stdin.write(out.tobytes())
    e45.stdin.write(np.ascontiguousarray(out[Y45:Y45 + 1350]).tobytes())
    if n % 60 == 0:
        print("finition", n, flush=True)
for e in (e916, e45):
    e.stdin.close(); e.wait()
print("ok", sortie916, sortie45)
