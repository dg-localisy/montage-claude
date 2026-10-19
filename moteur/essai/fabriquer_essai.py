"""Fabrique les médias de l'essai (10 s) : faux face-cam avec la voix, et une musique de fond.

- la voix vient de voix_tts.py (ElevenLabs, une seule fois) ;
- le face-cam est dessiné image par image : fond chaud flou, personnage qui respire,
  cligne des yeux et ouvre la bouche selon le volume de la voix ;
- la musique est une nappe douce générée avec ffmpeg.

Usage : python3 essai/fabriquer_essai.py
"""
import json
import math
import random
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ICI = Path(__file__).resolve().parent
MEDIA = ICI / "media"
W, H, FPS, DUREE = 1080, 1920, 30, 10.5
DECALAGE_VOIX = 0.30  # la voix commence 0,3 s après le début du rush


def lancer(cmd):
    subprocess.run(cmd, check=True)


def enveloppe_voix():
    """Volume de la voix par image (0 à 1), pour faire bouger la bouche."""
    brut = subprocess.run(["ffmpeg", "-v", "error", "-i", str(MEDIA / "voix.mp3"), "-ac", "1", "-ar", "16000",
                           "-f", "f32le", "-"], capture_output=True, check=True).stdout
    a = np.frombuffer(brut, np.float32)
    pas = 16000 // FPS
    n = int(DUREE * FPS)
    env = np.zeros(n)
    dec = int(DECALAGE_VOIX * FPS)
    for i in range(n - dec):
        bloc = a[i * pas:(i + 1) * pas]
        if len(bloc):
            env[i + dec] = math.sqrt(float(np.mean(bloc ** 2)))
    env = env / (env.max() or 1)
    return np.clip(env * 1.4, 0, 1)


def fond():
    random.seed(7)
    g = np.linspace(0, 1, H + 200)[:, None]
    x = np.linspace(0, 1, W + 200)[None, :]
    chaud = np.clip(1 - np.hypot(x - 0.25, g - 0.2) * 1.3, 0, 1) ** 2
    r = 30 - 14 * g + 95 * chaud
    v = 24 - 11 * g + 52 * chaud
    b = 22 - 10 * g + 26 * chaud
    img = Image.fromarray(np.dstack([r, v, b]).clip(0, 255).astype(np.uint8))
    bokeh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(bokeh)
    for _ in range(22):
        cx, cy, rr = random.randint(0, W + 200), random.randint(80, 1300), random.randint(30, 100)
        teinte = random.choice([(255, 190, 120), (255, 150, 80), (240, 220, 200)])
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=teinte + (random.randint(25, 60),))
    bokeh = bokeh.filter(ImageFilter.GaussianBlur(16))
    img.paste(bokeh, (0, 0), bokeh)
    return img.convert("RGB")


def personnage():
    """Corps, cou, tête et cheveux (sans les yeux ni la bouche, dessinés à chaque image)."""
    p = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(p)
    peau, peau_ombre = (214, 160, 128, 255), (176, 124, 96, 255)
    d.ellipse([60, 1130, 1020, 2500], fill=(26, 24, 25, 255))           # pull noir
    d.polygon([(470, 1120), (610, 1120), (540, 1230)], fill=peau_ombre)   # col en V
    d.rounded_rectangle([478, 930, 602, 1150], 40, fill=peau_ombre)       # cou
    d.ellipse([380, 640, 420, 760], fill=peau_ombre)                      # oreilles
    d.ellipse([660, 640, 700, 760], fill=peau_ombre)
    d.ellipse([395, 470, 685, 990], fill=peau)                            # visage
    d.chord([380, 430, 700, 760], 180, 360, fill=(58, 40, 30, 255))       # cheveux
    d.ellipse([390, 455, 560, 620], fill=(58, 40, 30, 255))
    d.ellipse([520, 445, 690, 600], fill=(58, 40, 30, 255))
    d.ellipse([505, 745, 575, 845], fill=(200, 146, 116, 255))            # nez (lumière)
    return p.filter(ImageFilter.GaussianBlur(2.2))


def main():
    MEDIA.mkdir(parents=True, exist_ok=True)
    lancer(["python3", "-I", str(ICI / "voix_tts.py")])

    # voix décalée dans le temps, et mots décalés pareil
    mots = json.loads((MEDIA / "mots.json").read_text(encoding="utf-8"))
    decales = [{**m, "debut": round(m["debut"] + DECALAGE_VOIX, 3), "fin": round(m["fin"] + DECALAGE_VOIX, 3)} for m in mots]
    (MEDIA / "mots-rush.json").write_text(json.dumps(decales, ensure_ascii=False, indent=1), encoding="utf-8")

    # musique douce : accord lent, filtré, avec un léger écho
    lancer(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i",
            f"aevalsrc='0.20*sin(2*PI*110*t)+0.12*sin(2*PI*164.8*t)*(0.6+0.4*sin(2*PI*0.25*t))"
            f"+0.10*sin(2*PI*220*t)+0.08*sin(2*PI*261.6*t)*(0.5+0.5*sin(2*PI*0.17*t))"
            f"+0.06*sin(2*PI*329.6*t)*(0.5+0.5*sin(2*PI*0.31*t))':s=48000:d={DUREE + 1}",
            "-af", "lowpass=f=1800,aecho=0.8:0.6:120|240:0.25|0.15,afade=t=in:d=1.5,"
                   f"afade=t=out:st={DUREE - 1}:d=2,pan=stereo|c0=c0|c1=c0,loudnorm=I=-14:TP=-2",
            "-ar", "48000", str(MEDIA / "musique.wav")])

    env = enveloppe_voix()
    base, perso = fond(), personnage()
    random.seed(3)
    clignements = {int(t * FPS) for t in (1.7, 4.4, 7.9, 9.6)}
    ff = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
         "-i", "-", "-itsoffset", str(DECALAGE_VOIX), "-i", str(MEDIA / "voix.mp3"),
         "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-crf", "18", "-preset", "fast", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", str(DUREE), str(MEDIA / "faux-facecam.mp4")],
        stdin=subprocess.PIPE)
    for i in range(int(DUREE * FPS)):
        t = i / FPS
        dx, dy = 40 + 30 * math.sin(t * 0.35), 60 + 20 * math.sin(t * 0.22)
        img = base.crop((int(dx), int(dy), int(dx) + W, int(dy) + H))
        ox, oy = 5 * math.sin(t * 0.7), 7 * math.sin(t * 1.3)
        img.paste(perso, (int(ox), int(oy)), perso)
        d = ImageDraw.Draw(img)
        cx, cy = 540 + ox, oy
        cligne = any(abs(i - c) <= 1 for c in clignements)
        for ex in (cx - 62, cx + 62):  # centre de chaque œil
            if cligne:
                d.line([ex - 24, cy + 706, ex + 24, cy + 706], fill=(60, 40, 32), width=5)
            else:
                d.ellipse([ex - 22, cy + 690, ex + 22, cy + 722], fill=(245, 240, 235))
                d.ellipse([ex - 11, cy + 694, ex + 11, cy + 718], fill=(45, 32, 26))
            d.line([ex - 30, cy + 662, ex + 28, cy + 656], fill=(58, 40, 30), width=7)  # sourcils
        h = 6 + 46 * env[i]
        d.ellipse([cx - 44, cy + 885 - h / 2, cx + 44, cy + 885 + h / 2], fill=(120, 50, 50))
        ff.stdin.write(img.tobytes())
    ff.stdin.close()
    ff.wait()
    print("Médias de l'essai prêts dans", MEDIA)


if __name__ == "__main__":
    main()
