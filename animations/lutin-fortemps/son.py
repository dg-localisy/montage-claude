"""Bruitages synchronisés + mixage final de l'animation du lutin.

- pas du lutin dans la neige : un « crounch » à chaque fois qu'un pied touche le sol
  (instants lus dans la scène 3D : etat.json), placé à gauche/droite selon sa position ;
- frottement de la luge sur la neige : souffle + craquements + grondement des patins,
  dont le volume suit la vitesse de la luge ; petit tassement quand elle s'arrête ;
- mixage avec la musique, volume final -14 LUFS, crête vraie sous -1 dBTP,
  puis pose du son sur les vidéos (l'image n'est pas réencodée).

python3 son.py etat.json musique.wav VIDEO_9x16.mp4 VIDEO_4x5.mp4 DOSSIER_SORTIE
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile

RACINE = Path(__file__).resolve().parents[2]          # racine du dépôt (outils/son_final.py)
sys.path.insert(0, str(RACINE / "outils"))
from son_final import sonie_integree, crete_vraie, puissances_blocs, lufs  # noqa: E402

SR = 48000
f_etat, f_musique, v916, v45, dossier = sys.argv[1:6]
dossier = Path(dossier)
etat = json.load(open(f_etat))
E = np.array(etat["lignes"])
t_e, gx, gy, dx, dy, bx, lx = E.T
infos = etat["infos"]
T_FIN, T_STOP, T_B = infos["tFin"], infos["tStop"], infos["tB"]
sr, musique = wavfile.read(f_musique)
musique = musique.astype(np.float64).T
N = musique.shape[1]
DUREE = N / SR
rng = np.random.default_rng(2024)
CHEVILLE = 0.07


def passe_bande(x, f1, f2, ordre=2):
    sos = signal.butter(ordre, [f1, f2], btype="bandpass", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def passe_bas(x, f, ordre=2):
    return signal.sosfilt(signal.butter(ordre, f, btype="lowpass", fs=SR, output="sos"), x)


def passe_haut(x, f, ordre=2):
    return signal.sosfilt(signal.butter(ordre, f, btype="highpass", fs=SR, output="sos"), x)


def panoramique(mono, pan):
    """pan de -1 (gauche) à +1 (droite), loi à puissance constante ; pan peut varier dans le temps."""
    a = (np.clip(pan, -1, 1) + 1) * np.pi / 4
    return np.vstack([mono * np.cos(a), mono * np.sin(a)])


def crounch(intensite=1.0, clarte=1.0, longueur=None):
    """Un pas dans la neige : grappe de petits craquements + souffle + léger choc sourd."""
    L = longueur or rng.uniform(0.09, 0.15)
    n = int((L + 0.03) * SR)
    x = np.zeros(n)
    nb = int(rng.uniform(45, 95) * (0.6 + 0.4 * intensite))
    instants = (L * rng.beta(1.3, 3.2, nb) * SR).astype(int)
    for i0 in instants:
        lg = int(rng.uniform(0.0004, 0.0016) * SR)
        g = rng.standard_normal(lg) * np.exp(-np.arange(lg) / (lg / 3)) * rng.lognormal(0, 0.55)
        x[i0:i0 + lg] += g[: n - i0]
    x = passe_bande(x, 900 * clarte, min(6800 * clarte, 16000))
    tt = np.arange(n) / SR
    env = np.minimum(tt / 0.004, 1) * np.exp(-tt / (L * 0.45))
    souffle = passe_bande(rng.standard_normal(n), 380 * clarte, 2600 * clarte) * env
    choc = np.sin(2 * np.pi * (140 - 400 * tt) * tt) * np.exp(-tt / 0.018) * (tt < 0.06)
    y = x / (np.abs(x).max() + 1e-9) + 0.35 * souffle / (np.abs(souffle).max() + 1e-9) + 0.22 * choc
    y = np.tanh(2.4 * y / (np.abs(y).max() + 1e-9)) / np.tanh(2.4)        # crêtes arrondies
    return y * intensite


def toc_bois(intensite=0.3):
    """Petit choc de bois (la carte qui bascule dans ses supports)."""
    n = int(0.08 * SR); tt = np.arange(n) / SR
    y = sum(a * np.sin(2 * np.pi * f * tt) * np.exp(-tt / d) for f, a, d in [(620, 1, 0.025), (1310, 0.6, 0.015), (2270, 0.35, 0.008)])
    y += 0.3 * passe_bande(rng.standard_normal(n), 1500, 6000) * np.exp(-tt / 0.004)
    return y / np.abs(y).max() * intensite


def poser(piste, son, t, pan):
    i = int(round(t * SR))
    if i >= N or i + len(son) <= 0:
        return
    st = panoramique(son, pan)
    a, b = max(i, 0), min(i + len(son), N)
    piste[:, a:b] += st[:, a - i:b - i]


def proximite(x, bord=1.45, fondu=1.3):
    """1 quand c'est à l'écran, puis baisse progressivement hors champ."""
    o = np.maximum(np.abs(x) - bord, 0)
    return np.clip(1 - o / fondu, 0, 1) ** 1.5


# ---------------------------------------------------------------- 1. pas du lutin
pas = np.zeros((2, N))
evenements_pas = []
for px, py in ((gx, gy), (dx, dy)):
    leve = py - CHEVILLE
    i = 1
    while i < len(leve):
        # un pied part du sol puis y revient : le contact = premier instant où il retouche le sol
        if leve[i] > 0.004 and leve[i - 1] <= 0.004:
            j = i
            hauteur = 0
            while j < len(leve) and leve[j] > 0.0015:
                hauteur = max(hauteur, leve[j]); j += 1
            if j < len(leve) and hauteur > 0.012:
                evenements_pas.append((t_e[j], px[j], hauteur))
            i = j
        i += 1
evenements_pas.sort()
for t, x, h in evenements_pas:
    force = np.clip(h / 0.085, 0.25, 1) * proximite(x)
    if force < 0.03:
        continue
    poser(pas, crounch(force * rng.uniform(0.85, 1.0), clarte=rng.uniform(0.92, 1.12)), t - 0.004, np.clip(x / 1.6, -1, 1) * 0.7)
# petits piétinements quand il se tourne vers la caméra, puis repart
xs = float(np.interp(T_STOP, t_e, bx))
for t0, f in [(T_STOP + 0.05, 0.4), (T_STOP + 0.2, 0.32), (T_B - 0.42, 0.35), (T_B - 0.28, 0.3)]:
    poser(pas, crounch(f, clarte=1.05, longueur=0.07), t0, np.clip(xs / 1.6, -1, 1) * 0.7)

# ---------------------------------------------------------------- 2. frottement de la luge
tt = np.arange(N) / SR
lx_s = np.interp(tt, t_e, lx)
v = np.abs(np.gradient(np.interp(tt, t_e, lx), 1 / SR))
v = signal.savgol_filter(v, 2401, 2) if N > 2401 else v
vn = np.clip(v / 0.95, 0, 1.2)
avant_luge = lx_s - 0.95                                   # l'avant de la luge (côté corde)
o = np.maximum(avant_luge - 1.2, 0)                        # distance hors champ, à droite
prox = np.clip(1 - o / 2.4, 0, 1) ** 2
env = (vn ** 1.15) * prox
# craquements : processus de Poisson dont la cadence suit la vitesse
cadence = 950 * vn * (prox > 0.005)
nb = rng.poisson(cadence / SR)
idx = np.nonzero(nb)[0]
crq = np.zeros(N)
for i0 in idx:
    lg = int(rng.uniform(0.0005, 0.0022) * SR)
    g = rng.standard_normal(lg) * np.exp(-np.arange(lg) / (lg / 3)) * rng.lognormal(0, 0.6)
    crq[i0:i0 + lg] += g[: N - i0]
crq = passe_bande(crq, 1300, 7200)
rms_crq = np.sqrt(np.mean(crq[crq != 0] ** 2)) + 1e-12
crq = np.tanh(crq / (3 * rms_crq)) * 3 * rms_crq                 # pas de craquement isolé trop fort
souffle = passe_bande(rng.standard_normal(N), 650, 4200)
brun = passe_haut(np.cumsum(rng.standard_normal(N)), 30)
grondement = passe_bas(brun, 220, 4)
bosses = passe_bas(rng.standard_normal(N), 7, 2); bosses = 0.75 + 0.25 * bosses / (np.abs(bosses).max() + 1e-9)
norme = lambda x: x / (np.sqrt(np.mean(x[env > 0.2] ** 2)) + 1e-12) if (env > 0.2).any() else x
luge_mono = (1.0 * norme(crq) + 0.45 * norme(souffle) + 0.55 * norme(grondement) * bosses) * env
luge = panoramique(luge_mono, np.clip(lx_s / 1.6, -1, 1) * 0.7)
# tassement de la neige et petit « toc » de la carte à l'arrêt
poser(luge, crounch(0.9, clarte=0.8, longueur=0.16), T_FIN - 0.03, 0.0)
poser(luge, toc_bois(0.55), T_FIN + 0.05, 0.05)

# ---------------------------------------------------------------- 3. petite réverbération commune aux bruitages
def reverb(x, rt60=0.55, mouille=0.16):
    n = int(rt60 * SR)
    tt = np.arange(n) / SR
    ir = np.vstack([passe_bas(rng.standard_normal(n), 5200) * np.exp(-6.9 * tt / rt60) for _ in range(2)])
    ir[:, : int(0.012 * SR)] = 0
    ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
    sec = x.copy()
    hum = np.vstack([signal.fftconvolve(x[c], ir[c])[: x.shape[1]] for c in range(2)])
    return sec * (1 - mouille) + hum * mouille * 2.2


pas = reverb(pas)
luge = reverb(luge)

# ---------------------------------------------------------------- 4. niveaux relatifs (sonie momentanée, 400 ms)
def niveau_median(x, zones):
    p, tb = puissances_blocs(x)
    m = np.zeros_like(tb, bool)
    for a, b in zones:
        m |= (tb >= a) & (tb + 0.4 <= b)
    return float(np.median(lufs(p[m])))

ZONES_PAS = [(0.7, T_STOP - 0.4), (T_B + 0.4, T_B + 1.9)]
ZONES_LUGE = [(T_FIN - 3.2, T_FIN - 0.6)]
ECART_PAS, ECART_LUGE = -4.0, -6.0              # dB par rapport à la musique au même moment
g_pas = ECART_PAS - (niveau_median(pas, ZONES_PAS) - niveau_median(musique, ZONES_PAS))
g_luge = ECART_LUGE - (niveau_median(luge, ZONES_LUGE) - niveau_median(musique, ZONES_LUGE))
pas *= 10 ** (g_pas / 20)
luge *= 10 ** (g_luge / 20)
mix = musique + pas + luge
gain = -14.0 - sonie_integree(mix)
mix *= 10 ** (gain / 20)
for nom, x in (("musique", musique), ("pas", pas), ("luge", luge)):
    wavfile.write(dossier / f"piste_{nom}.wav", SR, (x * 10 ** (gain / 20)).T.astype(np.float32))
wavfile.write(dossier / "mix.wav", SR, mix.T.astype(np.float32))
tp = crete_vraie(mix)
filtre = "anull" if tp <= -1.0 else "alimiter=limit=0.8570:attack=5:release=60:level=disabled"
print(f"pas : {len(evenements_pas)} contacts détectés ; gains pas {g_pas:+.1f} dB, luge {g_luge:+.1f} dB, gain final {gain:+.1f} dB, crête avant limiteur {tp:.1f} dBTP")

# ---------------------------------------------------------------- 5. pose du son sur les vidéos + vérification
rapport = {"contacts_pas": [round(e[0], 3) for e in evenements_pas], "fichiers": {}}
for video in (v916, v45):
    sortie = dossier / Path(video).name.replace(".mp4", "_avec_son.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", video, "-i", str(dossier / "mix.wav"), "-map", "0:v", "-map", "1:a",
                    "-c:v", "copy", "-af", filtre, "-c:a", "aac", "-b:a", "256k", "-ar", str(SR), "-shortest",
                    "-movflags", "+faststart", str(sortie)], check=True)
    out = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(sortie), "-af", "ebur128=peak=true", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    resume = out[out.rfind("Summary:"):]
    integre = float(resume.split("I:")[1].split("LUFS")[0]); crete = float(resume.split("Peak:")[1].split("dBFS")[0])
    rapport["fichiers"][sortie.name] = {"lufs": integre, "crete_dbtp": crete}
    print(f"{sortie.name} : {integre} LUFS, crête vraie {crete} dBTP")
json.dump(rapport, open(dossier / "son_rapport.json", "w"), indent=1)
