"""Détourage de la personne filmée, image par image (RobustVideoMatting, modèle ONNX, sur processeur).

Sert au « texte derrière la tête » : le moteur redessine la personne par-dessus le texte,
avec ces masques (PNG en niveaux de gris + transparence : blanc là où est la personne).

Usage :
    python3 outils/detourage.py RUSH.mp4 DOSSIER_SORTIE --modele rvm_mobilenetv3_fp32.onnx [--debut 0] [--fin 10]

Le modèle se télécharge ici (une fois par session, 15 Mo) :
    https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_mobilenetv3_fp32.onnx
Les masques sont nommés m_00000.png… d'après le numéro d'image dans la vidéo (25 i/s pour le témoignage Hock).
"""
import argparse
import subprocess
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image


def main():
    p = argparse.ArgumentParser()
    p.add_argument("video")
    p.add_argument("sortie")
    p.add_argument("--modele", required=True)
    p.add_argument("--debut", type=float, default=0.0)
    p.add_argument("--fin", type=float, default=None)
    p.add_argument("--reduction", type=float, default=0.25, help="downsample_ratio de RVM (0,25 pour du 1080p)")
    a = p.parse_args()

    sortie = Path(a.sortie)
    sortie.mkdir(parents=True, exist_ok=True)
    info = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate",
                           "-of", "csv=p=0", a.video], capture_output=True, text=True, check=True).stdout.strip().split(",")
    w, h = int(info[0]), int(info[1])
    num, den = info[2].split("/")
    fps = float(num) / float(den)
    premiere = round(a.debut * fps)

    cmd = ["ffmpeg", "-v", "error", "-ss", f"{a.debut}", "-i", a.video]
    if a.fin is not None:
        cmd += ["-t", f"{a.fin - a.debut}"]
    cmd += ["-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    lecteur = subprocess.Popen(cmd, stdout=subprocess.PIPE)

    session = ort.InferenceSession(a.modele, providers=["CPUExecutionProvider"])
    rec = [np.zeros([1, 1, 1, 1], dtype=np.float32)] * 4
    ratio = np.array([a.reduction], dtype=np.float32)
    taille = w * h * 3
    n = 0
    while True:
        brut = lecteur.stdout.read(taille)
        if len(brut) < taille:
            break
        src = np.frombuffer(brut, np.uint8).reshape(h, w, 3).transpose(2, 0, 1)[None].astype(np.float32) / 255
        fgr, pha, *rec = session.run(None, {"src": src, "r1i": rec[0], "r2i": rec[1], "r3i": rec[2], "r4i": rec[3], "downsample_ratio": ratio})
        alpha = (np.clip(pha[0, 0], 0, 1) * 255).astype(np.uint8)
        masque = np.dstack([np.full_like(alpha, 255), alpha])  # blanc + transparence = la personne
        Image.fromarray(masque, "LA").save(sortie / f"m_{premiere + n:05d}.png", optimize=False, compress_level=3)
        n += 1
        if n % 100 == 0:
            print(f"{n} images", flush=True)
    lecteur.wait()
    print(f"Terminé : {n} masques dans {sortie}")


if __name__ == "__main__":
    main()
