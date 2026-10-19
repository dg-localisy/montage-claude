"""Fabrique une courte vidéo de test « face caméra » avec des ratés volontaires.

- La voix est générée par ElevenLabs (voix Sarah, environ 350 caractères, mis en cache).
- On connaît la position exacte de chaque prise : c'est la « vérité terrain » pour juger le dérush.
- Chaque image porte un code-barres avec son numéro d'image source : après le montage,
  on peut vérifier que l'image et le son sont restés synchronisés.

Usage : python3 outils/test_derush/fabriquer_video_test.py DOSSIER_DE_SORTIE
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import elevenlabs as el  # noqa: E402

RACINE = Path(__file__).resolve().parents[2]
VOIX = "EXAVITQu4vr4xnSDxMaL"  # Sarah, parle français
SR, FPS, W, H = 48000, 30, 540, 960
BITS, CASE, Y_CODE = 12, 36, 70  # code-barres : 12 cases de 36 px

SCRIPT = ("Bonjour, je suis Marie, gérante de la boulangerie Le Fournil. "
          "Avant LOCALISY, personne ne nous trouvait sur Internet. "
          "En trois mois, on a doublé le nombre de clients le samedi matin. "
          "Aujourd'hui, je recommande LOCALISY à tous les commerçants du quartier.")

# (texte dit, à garder ?, silence AVANT la prise en secondes, gain en dB)
PRISES = [
    ("Bonjour, je suis Marie, gérante de la boulangerie Le Fournil.", True, 0.60, 0),
    ("Avant Localisy, personne ne nous", False, 0.70, 0),             # faux départ
    ("Avant Localisy, personne ne nous trouvait sur Internet.", True, 0.90, 0),
    ("Euh,", False, 0.50, 0),                                          # hésitation
    ("En trois mois, on a doublé le nombre de clients le samedi.", False, 0.60, 0),  # phrase répétée
    ("En trois mois, on a doublé le nombre de clients le samedi matin.", True, 1.00, 0),
    ("Aujourd'hui, je recommande Localisy à tous les commerçants", True, 0.45, 0),
    ("du quartier.", True, 0.08, -18),                                 # fin dite tout doucement
]
FIN = 0.8


def decode(fichier):
    brut = subprocess.run(["ffmpeg", "-v", "error", "-i", str(fichier), "-ac", "1", "-ar", str(SR),
                           "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(brut, np.float32).copy()


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)


def zone_voisee(x):
    """Premier et dernier échantillon où la voix est présente (sur le fichier propre, sans bruit)."""
    hop = SR // 200
    e = np.array([rms_db(x[i:i + hop]) for i in range(0, len(x) - hop, hop)])
    vois = np.nonzero(e > e.max() - 40)[0]
    return int(vois[0] * hop), int((vois[-1] + 1) * hop)


def bruit_de_piece(n, rng):
    blanc = rng.standard_normal(n)
    spectre = np.fft.rfft(blanc)
    f = np.fft.rfftfreq(n, 1 / SR)
    spectre[1:] /= np.sqrt(f[1:])            # bruit rose
    rose = np.fft.irfft(spectre, n)
    rose *= 10 ** (-58 / 20) / np.sqrt(np.mean(rose ** 2))
    t = np.arange(n) / SR
    ronflement = 10 ** (-66 / 20) * np.sqrt(2) * (np.sin(2 * np.pi * 50 * t) + 0.5 * np.sin(2 * np.pi * 150 * t))
    return (rose + ronflement).astype(np.float32)


def main(dossier):
    dossier = Path(dossier)
    cache = dossier / "cache_tts"
    cache.mkdir(parents=True, exist_ok=True)

    morceaux, verite, pos = [], [], 0
    for i, (texte, garder, silence, gain) in enumerate(PRISES):
        mp3 = cache / f"prise_{i}.mp3"
        if not mp3.exists():
            el.synthese(texte, VOIX, mp3)
        voix = decode(mp3)
        voix *= 10 ** ((-20 - rms_db(voix[np.abs(voix) > 1e-4])) / 20)   # parole vers -20 dBFS
        voix *= 10 ** (gain / 20)
        blanc = np.zeros(int(silence * SR), np.float32)
        morceaux += [blanc, voix]
        pos += len(blanc)
        d, f = zone_voisee(voix)
        verite.append({"prise": i, "texte": texte, "garder": garder, "gain_db": gain,
                       "voix_debut_s": (pos + d) / SR, "voix_fin_s": (pos + f) / SR})
        pos += len(voix)
    morceaux.append(np.zeros(int(FIN * SR), np.float32))
    audio = np.concatenate(morceaux)
    n_images = int(np.ceil(len(audio) / SR * FPS))
    audio = np.pad(audio, (0, n_images * SR // FPS - len(audio)))
    audio += bruit_de_piece(len(audio), np.random.default_rng(7))

    wav = dossier / "test_audio.wav"
    from scipy.io import wavfile
    wavfile.write(wav, SR, audio.astype(np.float32))

    # image de fond : la fausse interview des aperçus, réduite
    sys.path.insert(0, str(RACINE / "outils"))
    import generer_apercus as ga
    fond = ga.image_de_test().resize((W, H), Image.LANCZOS)
    d = ImageDraw.Draw(fond)
    titre = ImageFont.truetype(str(RACINE / "Figtree-Bold.ttf"), 30)
    d.text((W // 2, 150), "VIDÉO DE TEST · DÉRUSH", font=titre, fill=(255, 255, 255), anchor="mm")
    base = np.asarray(fond, dtype=np.uint8).copy()
    x0 = (W - BITS * CASE) // 2

    sortie = dossier / "test_face_camera.mp4"
    police = RACINE / "Figtree-Bold.ttf"
    proc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
         "-i", "-", "-i", str(wav),
         "-vf", f"drawtext=fontfile={police}:text='source %{{pts\\:hms}}  image %{{n}}':x=(w-tw)/2:y=820:fontsize=28:fontcolor=white",
         "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "256k", "-shortest", str(sortie)],
        stdin=subprocess.PIPE)
    for n in range(n_images):
        img = base.copy()
        for b in range(BITS):
            v = 255 if (n >> (BITS - 1 - b)) & 1 else 0
            img[Y_CODE:Y_CODE + CASE, x0 + b * CASE + 3:x0 + (b + 1) * CASE - 3] = v
        proc.stdin.write(img.tobytes())
    proc.stdin.close()
    proc.wait()

    (dossier / "script.txt").write_text(SCRIPT + "\n", encoding="utf-8")
    (dossier / "verite_terrain.json").write_text(json.dumps(
        {"fps": FPS, "code_barres": {"bits": BITS, "case": CASE, "y": Y_CODE, "x0": x0}, "prises": verite},
        ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Vidéo de test : {sortie} ({n_images / FPS:.1f} s, {n_images} images)")


if __name__ == "__main__":
    main(sys.argv[1])
