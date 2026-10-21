"""Musique de fond originale (donc libre de droits), douce, sous la voix. Un style différent à chaque vidéo.

Styles :
  lofi       (Gary, ~84 BPM) : piano électrique façon Rhodes (Fa maj9 – Mi m7 – Ré m9 – Do maj9), basse ronde,
             rythmique feutrée swinguée, léger « pompage », réverbération et grain de vinyle.
  acoustique (Cheminées Liégeois, ~96 BPM) : guitare pincée en arpèges droits en Ré majeur (Ré – La – Si m – Sol),
             nappe douce, basse sur 1 et 3, grosse caisse feutrée, claquements de doigts, shaker. Chaleureux et lumineux.
  electro    (Black and Bike, ~112 BPM) : house douce en La mineur (La m – Fa – Do – Sol), nappe de synthé qui pompe,
             synthé pincé syncopé, basse sur les contretemps, grosse caisse sur chaque temps. Dynamique et moderne.

Usage :
    python3 outils/musique_douce.py SORTIE.wav --duree 48.16 --debut 4.62 --style acoustique [--bpm 96] [--graine 7]
--debut : la musique commence à ce moment (silence avant), par exemple quand l'accroche tombe.
"""
import argparse

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def note_piano(f, duree, vel, rng):
    t = np.arange(int(duree * SR)) / SR
    tau = 1.6 * (220 / f) ** 0.35  # les notes aiguës s'éteignent plus vite
    env = np.exp(-t / tau) * (1 - np.exp(-t / 0.004))
    x = (np.sin(2 * np.pi * f * t) + 0.38 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.6)
         + 0.12 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t / 0.3)
         + 0.025 * np.sin(2 * np.pi * 7.1 * f * t) * np.exp(-t / 0.04))  # petit « tine » d'attaque
    x = x + 0.05 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t / 0.2)
    x = np.tanh(1.6 * x) / np.tanh(1.6)  # légère saturation : timbre plus chaud et plus présent, comme un vrai piano électrique
    return vel * env * x * (0.92 + 0.08 * rng.random())


def grosse_caisse():
    t = np.arange(int(0.45 * SR)) / SR
    f = 46 + 75 * np.exp(-t / 0.028)
    phase = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(phase) * np.exp(-t / 0.26) * (1 - np.exp(-t / 0.002))


def claquement(rng):
    t = np.arange(int(0.3 * SR)) / SR
    bruit = rng.standard_normal(len(t))
    b, a = signal.butter(2, [1200 / (SR / 2), 5500 / (SR / 2)], btype="band")
    bruit = signal.lfilter(b, a, bruit) * np.exp(-t / 0.11)
    corps = 0.35 * np.sin(2 * np.pi * 185 * t) * np.exp(-t / 0.05)
    return 0.5 * bruit + corps


def charleston(rng):
    t = np.arange(int(0.08 * SR)) / SR
    bruit = rng.standard_normal(len(t))
    b, a = signal.butter(2, 7500 / (SR / 2), btype="high")
    return signal.lfilter(b, a, bruit) * np.exp(-t / 0.022)


def placer(piste, son, debut, gain=1.0, pan=0.0):
    a = int(round(debut * SR))
    if a >= piste.shape[1]:
        return
    b = min(piste.shape[1], a + len(son))
    g = gain * np.array([np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)]) * np.sqrt(2)
    piste[:, a:b] += g[:, None] * son[: b - a]


def reverb(x, rng, duree=1.4, tau=0.55, mouille=0.22):
    n = int(duree * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((2, n)) * np.exp(-t / tau)
    ir[:, : int(0.012 * SR)] = 0  # petit délai avant la réverbération
    ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True))
    humide = np.stack([signal.fftconvolve(x[c], ir[c])[: x.shape[1]] for c in range(2)])
    return x + mouille * humide


def style_lofi(a, rng):
    """Lo-fi (Gary) : piano électrique, basse ronde, rythmique feutrée swinguée, grain de vinyle."""
    n = int(a.duree * SR)
    temps = 60 / a.bpm
    mesure = 4 * temps
    swing = 0.58  # croche swinguée
    accords = [  # (basse, notes du piano) en numéros MIDI
        (41, [64, 69, 72, 76]),  # Fa maj9 (sans fondamentale au piano)
        (40, [62, 67, 71, 74]),  # Mi m7
        (38, [60, 65, 69, 72]),  # Ré m9
        (36, [59, 64, 67, 71]),  # Do maj9
    ]
    piano = np.zeros((2, n))
    basse = np.zeros((2, n))
    batterie = np.zeros((2, n))
    kicks = []
    nb_mesures = int(np.ceil((a.duree - a.debut) / mesure)) + 1
    gc, cl = grosse_caisse(), None
    for m in range(nb_mesures):
        t0 = a.debut + m * mesure
        racine, notes = accords[m % 4]
        # piano : accord sur le temps 1 (légèrement égrené), petite reprise sur le « et » du 2
        for i, nn in enumerate(notes):
            placer(piano, note_piano(midi(nn), 2.6, 0.24, rng), t0 + 0.012 * i, pan=-0.25 + 0.17 * i)
        # note du haut doublée à l'octave, très douce : un peu de brillance
        placer(piano, note_piano(midi(notes[-1] + 12), 1.8, 0.07, rng), t0 + 0.05, pan=0.2)
        for i, nn in enumerate(notes[1:]):
            placer(piano, note_piano(midi(nn), 1.4, 0.12, rng), t0 + (1 + swing) * temps + 0.01 * i, pan=0.3 - 0.2 * i)
        # basse : fondamentale sur le 1, quinte douce sur le 3
        for k, (decal, nn, v) in enumerate([(0, racine, 0.5), (2 * temps, racine + 7, 0.32), (3.5 * temps, racine, 0.22)]):
            d = 1.6 if k == 0 else 0.9
            t = np.arange(int(d * SR)) / SR
            f = midi(nn)
            son = (np.sin(2 * np.pi * f * t) + 0.18 * np.sin(2 * np.pi * 2 * f * t)) * np.exp(-t / 0.9) * (1 - np.exp(-t / 0.01))
            placer(basse, v * son, t0 + decal)
        # batterie (à partir de la 2e mesure) : grosse caisse 1 et « et » du 2, claquement 2 et 4, charleston en croches
        if m >= 1:
            for decal in (0, (1 + swing) * temps, 2.5 * temps if m % 2 else None):
                if decal is None:
                    continue
                placer(batterie, 0.38 * gc, t0 + decal)
                kicks.append(t0 + decal)
            for decal in (temps, 3 * temps):
                placer(batterie, 0.3 * claquement(rng), t0 + decal + 0.008)
            for k in range(8):
                decal = (k // 2) * temps + (swing * temps if k % 2 else 0)
                placer(batterie, (0.11 if k % 2 else 0.075) * (0.8 + 0.4 * rng.random()) * charleston(rng), t0 + decal, pan=0.35)

    # léger « pompage » du piano et de la basse sur la grosse caisse (son actuel), réverbération sur le piano
    gain = np.ones(n)
    tt = np.arange(int(0.32 * SR)) / SR
    creux = 1 - 0.35 * np.exp(-tt / 0.12)
    for k in kicks:
        a0 = int(k * SR)
        b0 = min(n, a0 + len(creux))
        if a0 < n:
            gain[a0:b0] = np.minimum(gain[a0:b0], creux[: b0 - a0])
    piano = reverb(piano * gain, rng)
    basse *= gain
    b, a_ = signal.butter(2, 600 / (SR / 2), btype="low")
    basse = signal.lfilter(b, a_, basse, axis=1)

    mix = 0.85 * piano + 0.42 * basse + 0.8 * batterie
    # pas d'infra-basses (elles brouillent la voix et ne passent pas sur téléphone)
    b, a_ = signal.butter(2, 70 / (SR / 2), btype="high")
    mix = signal.lfilter(b, a_, mix, axis=1)
    # grain lo-fi : aigus adoucis, souffle et craquements de vinyle très discrets
    b, a_ = signal.butter(1, 9000 / (SR / 2), btype="low")
    mix = signal.lfilter(b, a_, mix, axis=1)
    souffle = rng.standard_normal((2, n)) * 0.0025
    b, a_ = signal.butter(1, [300 / (SR / 2), 4000 / (SR / 2)], btype="band")
    souffle = signal.lfilter(b, a_, souffle, axis=1)
    craq = np.zeros((2, n))
    for _ in range(int(a.duree * 6)):
        i = rng.integers(0, n - 200)
        craq[:, i:i + 60] += rng.standard_normal(60) * 0.02 * np.exp(-np.arange(60) / 12)
    mix = mix + souffle + craq
    return mix


_cordes = {}


def corde(f, rng, duree=2.4, brillance=0.35):
    """Corde de guitare pincée (Karplus-Strong) : un petit bruit qui résonne à la fréquence f et s'éteint naturellement.
    Mise en cache par hauteur (même note = même son, le calcul est long)."""
    cle = (round(f, 2), duree, brillance)
    if cle not in _cordes:
        n = int(duree * SR)
        N = int(round(SR / f))
        x = np.zeros(n)
        g = np.random.default_rng(int(f * 10)).standard_normal(N)
        b, a_ = signal.butter(1, min(0.95, (1500 + 5000 * brillance) / (SR / 2)))
        x[:N] = signal.lfilter(b, a_, g)
        coef = np.zeros(N + 2)
        coef[0], coef[N], coef[N + 1] = 1.0, -0.4985, -0.4985
        y = signal.lfilter([1.0], coef, x)
        y *= np.clip((duree - np.arange(n) / SR) / 0.3, 0, 1)
        _cordes[cle] = y / (np.abs(y).max() + 1e-9)
    return _cordes[cle] * (0.94 + 0.06 * rng.random())


def style_acoustique(a, rng):
    """Acoustique chaleureux (Cheminées Liégeois) : guitare pincée en arpèges droits (pas de swing), Ré majeur
    (Ré – La – Si m – Sol), nappe douce, basse sur les temps 1 et 3, grosse caisse feutrée sur 1 et 3, petit claquement
    de doigts sur 2 et 4, shaker en doubles croches. Plus vif et plus lumineux que le lo-fi, sans grain de vinyle."""
    n = int(a.duree * SR)
    temps = 60 / a.bpm
    mesure = 4 * temps
    accords = [  # (basse, cordes de la guitare, du grave à l'aigu) en numéros MIDI
        (38, [50, 57, 62, 66]),       # Ré
        (33, [45, 52, 57, 61, 64]),   # La
        (35, [47, 54, 59, 62, 66]),   # Si mineur
        (31, [43, 50, 55, 59, 62]),   # Sol
    ]
    motif = [0, 2, 1, 3, 2, 3, 1, 4]  # ordre des cordes pincées sur les 8 croches de la mesure
    guitare = np.zeros((2, n))
    nappe = np.zeros((2, n))
    basse = np.zeros((2, n))
    batterie = np.zeros((2, n))
    nb_mesures = int(np.ceil((a.duree - a.debut) / mesure)) + 1
    gc = grosse_caisse()
    for m in range(nb_mesures):
        t0 = a.debut + m * mesure
        racine, cordes = accords[m % 4]
        # guitare : arpège en croches (légèrement humanisé) ; toutes les 2 mesures, un accord gratté doucement sur le 1
        for k, i in enumerate(motif):
            nn = cordes[i % len(cordes)]
            v = 0.3 if k % 2 == 0 else 0.22
            placer(guitare, v * corde(midi(nn), rng), t0 + k * temps / 2 + 0.006 * rng.standard_normal(), pan=-0.35 + 0.14 * (i % 5))
        if m % 2 == 0:
            for j, nn in enumerate(cordes):
                placer(guitare, 0.13 * corde(midi(nn), rng, duree=3.0, brillance=0.25), t0 + 0.014 * j, pan=0.25)
        # nappe : l'accord tenu très doucement, attaque lente
        t = np.arange(int(mesure * SR + 0.6 * SR)) / SR
        env = np.clip(t / 0.7, 0, 1) * np.clip((t[-1] - t) / 0.6, 0, 1)
        son = sum(np.sin(2 * np.pi * midi(nn + 12) * t) for nn in cordes[1:4]) / 3
        placer(nappe, 0.07 * env * son, t0)
        # basse : fondamentale sur le 1 et le 3, petite note de passage sur le « et » du 4
        for decal, nn, v in [(0, racine, 0.22), (2 * temps, racine, 0.15), (3.5 * temps, racine + 7, 0.1)]:
            t = np.arange(int(0.8 * SR)) / SR
            f = midi(nn + 12)
            son = (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t)) * np.exp(-t / 0.5) * (1 - np.exp(-t / 0.006))
            placer(basse, v * son, t0 + decal)
        # batterie (à partir de la 2e mesure) : grosse caisse feutrée sur 1 et 3, claquement de doigts sur 2 et 4, shaker
        if m >= 1:
            for decal in (0, 2 * temps):
                placer(batterie, 0.18 * gc, t0 + decal)
            for decal in (temps, 3 * temps):
                tt = np.arange(int(0.12 * SR)) / SR
                bruit = rng.standard_normal(len(tt))
                b, a_ = signal.butter(2, [1500 / (SR / 2), 3800 / (SR / 2)], btype="band")
                placer(batterie, 0.1 * signal.lfilter(b, a_, bruit) * np.exp(-tt / 0.03), t0 + decal, pan=-0.2)
            for k in range(16):
                tt = np.arange(int(0.05 * SR)) / SR
                bruit = rng.standard_normal(len(tt))
                b, a_ = signal.butter(2, 6500 / (SR / 2), btype="high")
                v = 0.05 if k % 2 else 0.028
                placer(batterie, v * signal.lfilter(b, a_, bruit) * np.exp(-tt / 0.018), t0 + k * temps / 4, pan=0.4)
    guitare = reverb(guitare, rng, duree=1.0, tau=0.35, mouille=0.18)
    # guitare chaude : aigus adoucis (filtre sans décalage dans le temps)
    guitare = signal.sosfiltfilt(signal.butter(2, [160 / (SR / 2), 2600 / (SR / 2)], btype="band", output="sos"), guitare, axis=1)
    b, a_ = signal.butter(2, 500 / (SR / 2), btype="low")
    basse = signal.lfilter(b, a_, basse, axis=1)
    b, a_ = signal.butter(2, 1800 / (SR / 2), btype="low")
    nappe = signal.lfilter(b, a_, nappe, axis=1)
    mix = 0.9 * guitare + 0.5 * nappe + 0.45 * basse + 0.7 * batterie
    # place pour la voix : on creuse la bande 1–4 kHz (filtre sans décalage, sinon la soustraction ne creuse pas)
    mix = mix - 0.8 * signal.sosfiltfilt(signal.butter(2, [1000 / (SR / 2), 4000 / (SR / 2)], btype="band", output="sos"), mix, axis=1)
    b, a_ = signal.butter(2, 70 / (SR / 2), btype="high")
    mix = signal.lfilter(b, a_, mix, axis=1)
    b, a_ = signal.butter(1, 10000 / (SR / 2), btype="low")
    return signal.lfilter(b, a_, mix, axis=1)


def scie(f, duree, harmoniques=10, desaccord=0.0):
    """Onde en dents de scie douce (somme de quelques harmoniques), éventuellement doublée et désaccordée (son de synthé large)."""
    t = np.arange(int(duree * SR)) / SR
    x = np.zeros_like(t)
    for k in range(1, harmoniques + 1):
        x += np.sin(2 * np.pi * k * f * t) / k
        if desaccord:
            x += np.sin(2 * np.pi * k * f * (1 + desaccord) * t + k) / k
    return x / (2 if desaccord else 1)


def style_electro(a, rng):
    """Électro chill (Black and Bike) : house douce à ~112 BPM en La mineur (La m – Fa – Do – Sol). Nappe de synthé large
    qui « pompe » sur la grosse caisse, petit synthé pincé en arpège syncopé, basse sur les contretemps, grosse caisse
    feutrée sur chaque temps, charleston ouvert sur les contretemps, claquement doux sur 2 et 4. Dynamique et moderne."""
    n = int(a.duree * SR)
    temps = 60 / a.bpm
    mesure = 4 * temps
    accords = [  # (basse, nappe, notes du synthé pincé) en numéros MIDI
        (45, [57, 60, 64], [69, 72, 76, 72]),   # La mineur
        (41, [57, 60, 65], [69, 72, 77, 72]),   # Fa
        (48, [55, 60, 64], [67, 72, 76, 72]),   # Do
        (43, [55, 59, 62], [67, 71, 74, 71]),   # Sol
    ]
    nappe = np.zeros((2, n))
    pince = np.zeros((2, n))
    basse = np.zeros((2, n))
    batterie = np.zeros((2, n))
    kicks = []
    nb_mesures = int(np.ceil((a.duree - a.debut) / mesure)) + 1
    gc = grosse_caisse()
    for m in range(nb_mesures):
        t0 = a.debut + m * mesure
        racine, accord, arpege = accords[m % 4]
        # nappe : l'accord tenu toute la mesure, attaque et relâche lentes
        d = mesure + 0.4
        tt = np.arange(int(d * SR)) / SR
        env = np.clip(tt / 0.35, 0, 1) * np.clip((d - tt) / 0.5, 0, 1)
        for j, nn in enumerate(accord):
            placer(nappe, 0.09 * env * scie(midi(nn), d, harmoniques=8, desaccord=0.004), t0, pan=-0.4 + 0.4 * j)
        # synthé pincé : 16 doubles croches, on joue un motif syncopé (pas toutes les notes)
        motif = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0]
        for k in range(16):
            if not motif[k] or m == 0:
                continue
            nn = arpege[k % len(arpege)]
            dd = 0.32
            tt = np.arange(int(dd * SR)) / SR
            son = scie(midi(nn), dd, harmoniques=6) * np.exp(-tt / 0.09) * (1 - np.exp(-tt / 0.003))
            placer(pince, 0.14 * son, t0 + k * temps / 4, pan=0.3 if k % 2 else -0.3)
        # basse : sur les contretemps (le « et » de chaque temps), ronde et courte
        for k in range(4):
            dd = temps * 0.45
            tt = np.arange(int(dd * SR)) / SR
            f = midi(racine)
            son = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2 * f * tt)) * np.clip((dd - tt) / 0.03, 0, 1) * (1 - np.exp(-tt / 0.005))
            placer(basse, 0.3 * son, t0 + (k + 0.5) * temps)
        # batterie (à partir de la 2e mesure) : grosse caisse sur chaque temps, charleston ouvert sur les contretemps, claquement sur 2 et 4
        if m >= 1:
            for k in range(4):
                placer(batterie, 0.22 * gc, t0 + k * temps)
                kicks.append(t0 + k * temps)
                tt = np.arange(int(0.11 * SR)) / SR
                bruit = rng.standard_normal(len(tt))
                b, a_ = signal.butter(2, 7000 / (SR / 2), btype="high")
                placer(batterie, 0.06 * signal.lfilter(b, a_, bruit) * np.exp(-tt / 0.045), t0 + (k + 0.5) * temps, pan=0.35)
            for k in (1, 3):
                placer(batterie, 0.18 * claquement(rng), t0 + k * temps + 0.006, pan=-0.1)
    # pompage de la nappe et de la basse sur chaque grosse caisse (effet « house »)
    gain = np.ones(n)
    tt = np.arange(int(0.3 * SR)) / SR
    creux = 1 - 0.55 * np.exp(-tt / 0.1)
    for k in kicks:
        a0 = int(k * SR)
        b0 = min(n, a0 + len(creux))
        if a0 < n:
            gain[a0:b0] = np.minimum(gain[a0:b0], creux[: b0 - a0])
    nappe = signal.sosfiltfilt(signal.butter(2, 1400 / (SR / 2), btype="low", output="sos"), nappe * gain, axis=1)
    pince = reverb(signal.sosfiltfilt(signal.butter(2, 2200 / (SR / 2), btype="low", output="sos"), pince, axis=1), rng, duree=1.2, tau=0.4, mouille=0.25)
    basse = signal.sosfiltfilt(signal.butter(2, 400 / (SR / 2), btype="low", output="sos"), basse * gain, axis=1)
    mix = 0.9 * nappe + 0.9 * pince + 0.3 * basse + 0.65 * batterie
    # place pour la voix : bande 1–4 kHz creusée ; pas d'infra-basses
    mix = mix - 0.8 * signal.sosfiltfilt(signal.butter(2, [1000 / (SR / 2), 4000 / (SR / 2)], btype="band", output="sos"), mix, axis=1)
    mix = signal.sosfiltfilt(signal.butter(2, 70 / (SR / 2), btype="high", output="sos"), mix, axis=1)
    return signal.sosfiltfilt(signal.butter(1, 11000 / (SR / 2), btype="low", output="sos"), mix, axis=1)


STYLES = {"lofi": (style_lofi, 84), "acoustique": (style_acoustique, 96), "electro": (style_electro, 112)}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("sortie")
    p.add_argument("--duree", type=float, required=True)
    p.add_argument("--debut", type=float, default=0.0)
    p.add_argument("--style", choices=sorted(STYLES), default="lofi",
                   help="lofi (Gary), acoustique (Cheminées Liégeois), electro (Black and Bike) : changer de style à chaque vidéo")
    p.add_argument("--bpm", type=float, default=None)
    p.add_argument("--graine", type=int, default=7)
    a = p.parse_args()
    fabrique, bpm = STYLES[a.style]
    a.bpm = a.bpm or bpm
    rng = np.random.default_rng(a.graine)
    n = int(a.duree * SR)
    mix = fabrique(a, rng)
    # silence avant le début, entrée douce (0,4 s) et fondu final (2,5 s)
    t = np.arange(n) / SR
    env = np.clip((t - a.debut) / 0.4, 0, 1) * np.clip((a.duree - t) / 2.5, 0, 1)
    mix *= env
    mix /= np.abs(mix).max() + 1e-9
    wavfile.write(a.sortie, SR, (mix.T * 0.89).astype(np.float32))
    print(f"Musique écrite : {a.sortie} (style {a.style}, {a.duree:.1f} s, début à {a.debut:.2f} s, {a.bpm:.0f} BPM)")


if __name__ == "__main__":
    main()
