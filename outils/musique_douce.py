"""Musique de fond originale (donc libre de droits) : lo-fi douce et tendance, ~84 BPM.

Piano électrique (façon Rhodes) sur une boucle de 4 accords (Fa maj9 – Mi m7 – Ré m9 – Do maj9),
basse ronde, rythmique feutrée (grosse caisse, claquement doux, charleston swingué), léger « pompage »
sur la grosse caisse, réverbération et grain de vinyle. Le tout reste doux : la voix passe avant tout.

Usage :
    python3 outils/musique_douce.py SORTIE.wav --duree 53.93 --debut 2.08 [--bpm 84] [--graine 7]
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


def main():
    p = argparse.ArgumentParser()
    p.add_argument("sortie")
    p.add_argument("--duree", type=float, required=True)
    p.add_argument("--debut", type=float, default=0.0)
    p.add_argument("--bpm", type=float, default=84)
    p.add_argument("--graine", type=int, default=7)
    a = p.parse_args()
    rng = np.random.default_rng(a.graine)

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
    # silence avant le début, entrée douce (0,4 s) et fondu final (2,5 s)
    t = np.arange(n) / SR
    env = np.clip((t - a.debut) / 0.4, 0, 1) * np.clip((a.duree - t) / 2.5, 0, 1)
    mix *= env
    mix /= np.abs(mix).max() + 1e-9
    wavfile.write(a.sortie, SR, (mix.T * 0.89).astype(np.float32))
    print(f"Musique écrite : {a.sortie} ({a.duree:.1f} s, début à {a.debut:.2f} s, {a.bpm:.0f} BPM)")


if __name__ == "__main__":
    main()
