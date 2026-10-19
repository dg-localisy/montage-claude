"""Teste le dérush sur la vidéo fabriquée par fabriquer_video_test.py.

En plus des vérifications de l'outil, deux contrôles indépendants :
- vérité terrain : chaque bonne prise est entièrement gardée, chaque raté entièrement coupé ;
- synchro image/son : le code-barres de chaque image du montage doit donner le bon numéro d'image source.

Usage : python3 outils/test_derush/lancer_test.py DOSSIER_DU_TEST
"""
import json
import subprocess
import sys
from fractions import Fraction
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import derush  # noqa: E402


def lire_codes(video, w, h, code):
    brut = subprocess.run(["ffmpeg", "-v", "error", "-i", str(video), "-f", "rawvideo", "-pix_fmt", "gray", "-"],
                          capture_output=True, check=True).stdout
    images = np.frombuffer(brut, np.uint8).reshape(-1, h, w)
    y = code["y"] + code["case"] // 2
    xs = [code["x0"] + b * code["case"] + code["case"] // 2 for b in range(code["bits"])]
    return [int("".join("1" if img[y, x] > 128 else "0" for x in xs), 2) for img in images]


def main(dossier):
    dossier = Path(dossier)
    verite = json.loads((dossier / "verite_terrain.json").read_text(encoding="utf-8"))
    r = derush.derush(dossier / "test_face_camera.mp4", dossier / "script.txt", dossier / "resultat")
    fps = Fraction(r["fps"])
    segments = r["segments_images"]

    def part_gardee(t0, t1):
        total = 0.0
        for a, b in segments:
            total += max(0.0, min(t1, b / fps) - max(t0, a / fps))
        return total / (t1 - t0)

    controle = []
    for p in verite["prises"]:
        g = part_gardee(p["voix_debut_s"], p["voix_fin_s"])
        ok = g > 0.999 if p["garder"] else g < 0.001
        controle.append({"prise": p["texte"], "attendu": "garder" if p["garder"] else "couper",
                         "part_gardee_pct": round(100 * g, 1), "ok": ok})

    codes = lire_codes(Path(r["sortie"]), 540, 960, verite["code_barres"])
    attendus = [k for a, b in segments for k in range(a, b)]
    erreurs = sum(1 for x, y in zip(codes, attendus) if x != y) + abs(len(codes) - len(attendus))

    resultat = {"verite_terrain": controle, "synchro_code_barres": {
        "images_verifiees": len(codes), "images_attendues": len(attendus), "images_fausses": erreurs, "ok": erreurs == 0}}
    (dossier / "resultat" / "controle_test.json").write_text(json.dumps(resultat, ensure_ascii=False, indent=1), encoding="utf-8")

    print("\n=== Contrôles indépendants du test ===")
    for c in controle:
        print(f"{'OK ' if c['ok'] else 'KO '} {c['attendu']:6} {c['part_gardee_pct']:5.1f} % gardé  {c['prise']}")
    print(f"Synchro (code-barres) : {len(codes)} images vérifiées, {erreurs} fausse(s)")


if __name__ == "__main__":
    main(sys.argv[1])
