"""Efface des sous-titres déjà incrustés dans une vidéo (texte blanc avec ombre portée douce), pour y mettre les nôtres.

Principe (vidéo « Ma mère ne sait pas ce que je fais - V1 », 24/11/2026) :
1. Lettres : pixels presque blancs (les trois couleurs >= --seuil) dans la bande des sous-titres.
2. Ombre : noir semi-transparent = lettres décalées puis floutées (modèle mesuré sur une image sans sous-titre
   à côté d'une image avec). Là où l'ombre est légère, on la retire par calcul (pixel / (1 - opacité)).
3. Lettres et ombre épaisse : remplies avec les images voisines du même plan, en suivant le mouvement
   (flux optique OpenCV, image par image) jusqu'à la première image où cet endroit n'est pas caché.
4. Ce qui reste caché dans tout le plan : rebouché à partir des bords (inpainting OpenCV).

Usage :
    python3 outils/effacer_sous_titres.py VIDEO.mp4 SORTIE.mp4 [--haut 1090 --bas 1270] [--coupes 79,116,...]
Les coupes (changements de plan) sont trouvées seules si --coupes est omis. Sortie presque sans perte (crf 10),
le son est copié : les nouveaux sous-titres se gravent ensuite dessus (outils/graver_sous_titres.py).
"""
import argparse
import subprocess

import cv2
import numpy as np


def lire(video, filtre, w, h, gris=False):
    fmt, c = ('gray', 1) if gris else ('rgb24', 3)
    brut = subprocess.run(['ffmpeg', '-v', 'error', '-i', video, '-vf', filtre, '-f', 'rawvideo', '-pix_fmt', fmt, '-'],
                          capture_output=True, check=True).stdout
    a = np.frombuffer(brut, np.uint8)
    return a.reshape(-1, h, w) if gris else a.reshape(-1, h, w, c)


def trouver_coupes(video, W, H, haut, bas, seuil=18.0):
    w, h = W // 4, H // 4
    fr = lire(video, f'scale={w}:{h}', w, h, gris=True).astype(np.float32)
    m = np.ones((h, w), bool)
    m[haut // 4 - 4:bas // 4 + 4] = False  # la bande des sous-titres ne compte pas
    d = np.array([np.abs(fr[i] - fr[i - 1])[m].mean() for i in range(1, len(fr))])
    return [i for i in range(1, len(fr)) if d[i - 1] > seuil]


def echantillon(img, x, y):
    """Lecture bilinéaire de img (h, w[, c]) aux points (x, y)."""
    h, w = img.shape[:2]
    x = np.clip(x, 0, w - 1.001); y = np.clip(y, 0, h - 1.001)
    x0 = x.astype(np.int32); y0 = y.astype(np.int32)
    fx = x - x0; fy = y - y0
    if img.ndim == 3:
        fx = fx[:, None]; fy = fy[:, None]
    a = img[y0, x0]; b = img[y0, x0 + 1]; c = img[y0 + 1, x0]; d = img[y0 + 1, x0 + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def main():
    p = argparse.ArgumentParser()
    p.add_argument('video'); p.add_argument('sortie')
    p.add_argument('--haut', type=int, default=1090, help='haut de la bande des sous-titres (px)')
    p.add_argument('--bas', type=int, default=1270, help='bas de la bande (px)')
    p.add_argument('--seuil', type=int, default=238, help='blanc des lettres (les trois couleurs au moins à ce niveau)')
    p.add_argument('--coupes', default=None, help='images où le plan change, séparées par des virgules')
    # ombre portée mesurée sur la V1 de « Maman » : décalage 6,6 px, flou 4,5 px, opacité max 0,95
    p.add_argument('--ombre', default='6,6,4.5,0.95,5.33', help='dx,dy,flou,opacite_max,gain')
    p.add_argument('--portee', type=int, default=100, help='nombre maximal d\'images parcourues de chaque côté')
    p.add_argument('--puissance', type=float, default=4, help='plus elle est forte, plus on préfère les images où le point est peu ombré')
    p.add_argument('--tau', type=float, default=10, help='en images : les images proches comptent plus')
    a = p.parse_args()

    info = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=width,height,r_frame_rate',
                           '-of', 'csv=p=0', a.video], capture_output=True, text=True).stdout.strip().split(',')
    W, H = int(info[0]), int(info[1])
    num, den = info[2].split('/')
    h = a.bas - a.haut
    dx, dy, flou, amax, gain = (float(v) for v in a.ombre.split(','))
    dx, dy = int(dx), int(dy)

    bande = lire(a.video, f'crop={W}:{h}:0:{a.haut}', W, h).astype(np.float32)
    n = len(bande)
    coupes = [int(v) for v in a.coupes.split(',')] if a.coupes else trouver_coupes(a.video, W, H, a.haut, a.bas)
    bornes = [0] + sorted(coupes) + [n]
    plans = [(bornes[i], bornes[i + 1]) for i in range(len(bornes) - 1) if bornes[i + 1] > bornes[i]]
    print('plans :', plans)

    # 1-2. lettres (coeur, avec leurs bords adoucis), ombre (opacité), image sans ombre
    k7 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    lettres = bande.min(3) >= a.seuil
    opac = np.zeros((n, h, W), np.float32)
    coeur = np.zeros((n, h, W), np.float32)
    propre = np.empty_like(bande)
    for f in range(n):
        g = lettres[f].astype(np.float32)
        if g.sum() < 30:  # pas de sous-titre sur cette image
            propre[f] = bande[f]
            continue
        k = cv2.GaussianBlur(np.roll(np.roll(g, dy, 0), dx, 1), (0, 0), flou)
        op = amax * (1 - np.exp(-gain * k))
        op[op < 0.01] = 0
        opac[f] = op
        coeur[f] = cv2.dilate(g, k7)
        propre[f] = bande[f] / np.maximum(1 - op, 0.05)[..., None]
    print('lettres et ombre repérées')

    # image de travail pour le flux : sans ombre, lettres et ombre épaisse rebouchées
    gris = np.empty((n, h, W), np.uint8)
    for f in range(n):
        img = np.clip(propre[f], 0, 255).astype(np.uint8)
        dur = (coeur[f] > 0) | (opac[f] > 0.45)
        if dur.any():
            img = cv2.inpaint(img, dur.astype(np.uint8) * 255, 5, cv2.INPAINT_TELEA)
        gris[f] = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    avant = [None] * n   # flux f -> f+1
    arriere = [None] * n  # flux f -> f-1
    for a0, z0 in plans:
        for f in range(a0, z0 - 1):
            avant[f] = dis.calc(gris[f], gris[f + 1], None)
            arriere[f + 1] = dis.calc(gris[f + 1], gris[f], None)
    print('flux optique calculé')

    # 3. chaque point touché = moyenne des images du plan qui suivent le mouvement, pondérée :
    #    beaucoup de poids aux images où ce point est peu ombré et proche dans le temps, aucun s'il est sous une lettre
    def remap(img, mx, my):
        return cv2.remap(img, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    gx, gy = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(h, dtype=np.float32))
    resultat = bande.copy()
    rebouche = 0
    for a0, z0 in plans:
        for f in range(a0, z0):
            zone = (opac[f] > 0) | (coeur[f] > 0)
            if not zone.any():
                continue
            w0 = (1 - opac[f]) ** a.puissance * (coeur[f] == 0)
            somme = propre[f] * w0[..., None]
            poids = w0.copy()
            for sens, flux, fin in ((1, avant, z0), (-1, arriere, a0 - 1)):
                mx, my = gx.copy(), gy.copy()
                g = f
                for k in range(1, a.portee + 1):
                    if g + sens == fin:
                        break
                    fl = remap(flux[g], mx, my)
                    mx += fl[..., 0]; my += fl[..., 1]
                    g += sens
                    dedans = (mx >= 0) & (mx <= W - 1) & (my >= 0) & (my <= h - 1)
                    w = (1 - remap(opac[g], mx, my)) ** a.puissance * (remap(coeur[g], mx, my) < 0.02) * dedans
                    w = w.astype(np.float32) * np.float32(np.exp(-k / a.tau))
                    somme += remap(propre[g], mx, my) * w[..., None]
                    poids += w
                    if k >= 6 and (poids[zone] > 0.3).all():
                        break
            est = somme / np.maximum(poids, 1e-6)[..., None]
            res = bande[f].copy()
            res[zone] = est[zone]
            trou = zone & (poids < 1e-4)
            if trou.any():
                rebouche += int(trou.sum())
                img = np.clip(res, 0, 255).astype(np.uint8)
                res = cv2.inpaint(img, trou.astype(np.uint8) * 255, 7, cv2.INPAINT_TELEA).astype(np.float32)
            resultat[f] = res
        print(f'plan {a0}-{z0} fait')
    print(f'{rebouche} pixels rebouchés par les bords (cachés dans tout le plan)')

    # 4. écriture : seule la bande change
    lecteur = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', a.video, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    ecrivain = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', f'{num}/{den}',
                                 '-i', '-', '-i', a.video, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-crf', '10', '-preset', 'medium',
                                 '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', a.sortie], stdin=subprocess.PIPE)
    taille = W * H * 3
    for f in range(n):
        brut = lecteur.stdout.read(taille)
        if len(brut) < taille:
            break
        img = np.frombuffer(brut, np.uint8).reshape(H, W, 3).copy()
        img[a.haut:a.bas] = np.clip(np.round(resultat[f]), 0, 255).astype(np.uint8)
        ecrivain.stdin.write(img.tobytes())
    ecrivain.stdin.close(); ecrivain.wait(); lecteur.wait()
    print(f'{n} images → {a.sortie}')


if __name__ == '__main__':
    main()
