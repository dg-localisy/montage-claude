"""Incruste un mot ou un chiffre géant DERRIÈRE la personne dans une vidéo déjà montée (sans passer par le moteur Remotion) :
le texte est posé sur le décor et la personne détourée (masques de outils/detourage.py) reste devant.
Entrée « compte » : le chiffre défile de 0 à sa valeur en se posant (léger rebond), puis s'efface en fondu flou.

Usage :
    python3 outils/incruster_texte_derriere.py VIDEO.mp4 DOSSIER_MASQUES SORTIE.mp4 --texte 50 --debut 4.72 --fin 5.75 \
        --taille 300 --x 620 --base 330 [--couleur 0A0A0A] [--opacite 0.9] [--entree compte]
--x : centre du texte (px) ; --base : ligne de base des chiffres (px), à placer un peu sous le haut de la tête.
--deplacement D0,D1 --x2 --base2 --taille2 : le texte glisse vers une autre place pendant un changement de plan (Vectura : zoom arrière).
--duree_compte, --battements T1,T2 (« boum » : grossit d'un coup puis revient), --force_battement, --sortie_s (sortie rapide).
La sortie est presque sans perte (crf 10) : les sous-titres se gravent ensuite dessus (outils/graver_sous_titres.py).
"""
import argparse
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

RACINE = Path(__file__).resolve().parent.parent


def ease_out(x):
    x = min(1.0, max(0.0, x))
    return 1 - (1 - x) ** 3


def main():
    p = argparse.ArgumentParser()
    p.add_argument('video'); p.add_argument('masques'); p.add_argument('sortie')
    p.add_argument('--texte', required=True)
    p.add_argument('--debut', type=float, required=True)
    p.add_argument('--fin', type=float, required=True)
    p.add_argument('--taille', type=int, default=300)
    p.add_argument('--x', type=float, default=540)
    p.add_argument('--base', type=float, default=330)
    p.add_argument('--couleur', default='0A0A0A')
    p.add_argument('--opacite', type=float, default=0.9)
    p.add_argument('--entree', default='compte', choices=['compte', 'fondu'])
    p.add_argument('--police', default=str(RACINE / 'Figtree-Black.ttf'))
    # déplacement facultatif pendant un changement de plan du monteur (ex. zoom arrière) : de (x, base, taille) à (x2, base2, taille2)
    p.add_argument('--deplacement', default=None, help='DEBUT,FIN du déplacement, en s')
    # rythme : durée du défilement des chiffres, battements (« boum » : le texte grossit d'un coup puis revient), sortie rapide
    p.add_argument('--duree_compte', type=float, default=0.45)
    p.add_argument('--battements', default=None, help='instants des battements, en s, séparés par des virgules')
    p.add_argument('--force_battement', type=float, default=0.16)
    p.add_argument('--sortie_s', type=float, default=0.25)
    p.add_argument('--x2', type=float); p.add_argument('--base2', type=float); p.add_argument('--taille2', type=int)
    a = p.parse_args()

    info = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=width,height,r_frame_rate',
                           '-of', 'csv=p=0', a.video], capture_output=True, text=True).stdout.strip().split(',')
    W, H = int(info[0]), int(info[1])
    num, den = info[2].split('/')
    fps = float(num) / float(den)
    couleur = np.array([int(a.couleur[i:i + 2], 16) for i in (0, 2, 4)], np.float32)
    valeur = int(a.texte) if a.texte.isdigit() else None

    lecteur = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', a.video, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    ecrivain = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', f'{num}/{den}', '-i', '-',
                                 '-i', a.video, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-crf', '10', '-preset', 'medium',
                                 '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', a.sortie], stdin=subprocess.PIPE)
    n = 0
    taille_image = W * H * 3
    while True:
        brut = lecteur.stdout.read(taille_image)
        if len(brut) < taille_image:
            break
        t = n / fps
        if a.debut <= t <= a.fin:
            img = np.frombuffer(brut, np.uint8).reshape(H, W, 3).astype(np.float32)
            entree = ease_out((t - a.debut) / 0.25)
            sortie = min(1.0, max(0.0, (t - (a.fin - a.sortie_s)) / a.sortie_s))
            if a.entree == 'compte' and valeur is not None:
                texte = str(round(valeur * ease_out((t - a.debut) / a.duree_compte)))
            else:
                texte = a.texte
            # léger rebond à l'arrivée (1,12 → 1), flou qui se dissipe, puis fondu flou à la sortie
            echelle = 1.12 - 0.12 * entree
            if a.battements:
                for k, tb in enumerate(float(v) for v in a.battements.split(',')):
                    echelle *= 1 + a.force_battement * (0.7 ** k) * np.exp(-((t - tb) / 0.045) ** 2)
            echelle *= 1 + 0.25 * sortie  # sortie : il grossit en s'effaçant
            x, base, taille, flou_bouge = a.x, a.base, a.taille, 0.0
            if a.deplacement:
                d0, d1 = (float(v) for v in a.deplacement.split(','))
                u = min(1.0, max(0.0, (t - d0) / (d1 - d0)))
                u = u * u * (3 - 2 * u)
                x, base = a.x + (a.x2 - a.x) * u, a.base + (a.base2 - a.base) * u
                taille = a.taille + ((a.taille2 or a.taille) - a.taille) * u
                flou_bouge = 6 * (1 - abs(2 * u - 1)) if d0 < t < d1 else 0.0
            police = ImageFont.truetype(a.police, max(1, round(taille * echelle)))
            calque = Image.new('L', (W, H), 0)
            ImageDraw.Draw(calque).text((x, base), texte, font=police, fill=255, anchor='ms')
            flou = (1 - entree) * 8 + sortie * 10 + flou_bouge
            if flou > 0.3:
                calque = calque.filter(ImageFilter.GaussianBlur(flou))
            alpha = np.asarray(calque, np.float32) / 255 * a.opacite * min(1.0, entree * 1.5) * (1 - sortie)
            m = Image.open(Path(a.masques) / f'm_{n:05d}.png')
            personne = np.asarray(m, np.float32)[..., -1] / 255
            if personne.shape != (H, W):
                personne = np.asarray(m.resize((W, H)), np.float32)[..., -1] / 255
            k = (alpha * (1 - personne))[..., None]
            img = img * (1 - k) + couleur * k
            brut = np.clip(img, 0, 255).astype(np.uint8).tobytes()
        ecrivain.stdin.write(brut)
        n += 1
    ecrivain.stdin.close()
    ecrivain.wait()
    lecteur.wait()
    print(f'{n} images, texte « {a.texte} » de {a.debut} à {a.fin} s → {a.sortie}')


if __name__ == '__main__':
    main()
