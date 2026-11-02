"""Musique de fond : arrangement original de « Jingle Bells » (mélodie de J. L. Pierpont, 1857, domaine public).

Célesta + glockenspiel (mélodie), cordes pincées (basse et accords), grelots, cordes douces.
Le tempo est calé sur l'animation : le dernier « do » de la phrase tombe pile quand la luge
s'arrête (T_FIN), puis la musique se termine en douceur sur le texte.

python3 musique.py T_FIN DUREE SORTIE.wav
"""
import subprocess
import sys
import mido
import numpy as np
from scipy.io import wavfile

T_FIN, DUREE, SORTIE = float(sys.argv[1]), float(sys.argv[2]), sys.argv[3]
SF2 = "/usr/share/sounds/sf2/FluidR3_GM.sf2"
SR = 48000
BPM = 145
TPB = 480
TEMPS = 60 / BPM                    # durée d'un temps (s)
MESURE = 4 * TEMPS
# la mesure 8 (accord de do final de la phrase) commence à T_FIN ; la mesure 0 sert d'anacrouse
DEBUT_M0 = T_FIN - 8 * MESURE       # peut être négatif : on coupe l'audio en conséquence
rng = np.random.default_rng(11)

CEL, GLO, PIZ, CORD, GREL = 0, 1, 2, 3, 9
PROGRAMMES = {CEL: 8, GLO: 9, PIZ: 45, CORD: 49}
evenements = []                     # (temps en temps-musicaux depuis la mesure 0, canal, note, vélocité, durée en temps)


def note(mesure, temps, canal, n, vel, duree, humain=True):
    t = mesure * 4 + temps
    if humain and canal != GREL:
        t += rng.normal(0, 0.012)
        vel += int(rng.normal(0, 5))
    evenements.append((max(t, 0), canal, n, int(np.clip(vel, 1, 127)), duree))


# ---------------------------------------------------------------- mélodie (célesta), do majeur
E5, F5, G5, C5, D5, C6 = 76, 77, 79, 72, 74, 84
melodie = [
    (1, [(0, E5, 1), (1, E5, 1), (2, E5, 2)]),                       # Jin-gle bells
    (2, [(0, E5, 1), (1, E5, 1), (2, E5, 2)]),                       # jin-gle bells
    (3, [(0, E5, 1), (1, G5, 1), (2, C5, 1.5), (3.5, D5, 0.5)]),     # jin-gle all the
    (4, [(0, E5, 4)]),                                               # way
    (5, [(0, F5, 1), (1, F5, 1), (2, F5, 1.5), (3.5, F5, 0.5)]),     # oh what fun it
    (6, [(0, F5, 1), (1, E5, 1), (2, E5, 1), (3, E5, 0.5), (3.5, E5, 0.5)]),  # is to ride in a
    (7, [(0, G5, 1), (1, G5, 1), (2, F5, 1), (3, D5, 1)]),           # one-horse o-pen
    (8, [(0, C5, 4)]),                                               # sleigh  (arrêt de la luge)
    (9, [(0, E5, 1), (1, E5, 1), (2, E5, 2)]),                       # écho : jin-gle bells (doux)
]
for m, notes in melodie:
    for t, n, d in notes:
        v = 92 if m <= 8 else 62
        if m == 8:
            v = 90
        note(m, t, CEL, n, v, d * 0.95)
        if 5 <= m <= 8:                                               # glockenspiel à l'octave pour la montée
            note(m, t, GLO, n + 12, 58 if m < 8 else 60, d * 0.9)
# accord final arpégé
for i, n in enumerate([C5, E5, G5, C6]):
    note(10, i * 0.08, CEL, n, 70 - 4 * i, 3.5, humain=False)
note(10, 0.32, GLO, 96, 60, 3.5, humain=False)
# scintillement au glockenspiel quand le reflet passe sur la carte (début mesure 8)
for i, n in enumerate([84, 88, 91, 96, 100, 103]):
    note(8, 0.5 + i * 0.25, GLO, n, 52 + 6 * i, 1.5, humain=False)

# ---------------------------------------------------------------- cordes pincées : basse + accords (oum-pa)
ACC = {"C": ([48, 43], [64, 67, 72]), "F": ([41, 48], [65, 69, 72]), "G7": ([43, 50], [65, 67, 71])}
grille = {1: "C", 2: "C", 3: "C", 4: "C", 5: "F", 6: "C", 7: "G7"}
for m, a in grille.items():
    basses, accord = ACC[a]
    note(m, 0, PIZ, basses[0], 88, 0.5); note(m, 2, PIZ, basses[1], 80, 0.5)
    for t in (1, 3):
        for n in accord:
            note(m, t, PIZ, n, 58, 0.4)
note(0, 3, PIZ, 43, 70, 0.5)                                          # anacrouse
note(0, 3.5, PIZ, 47, 74, 0.5)
note(8, 0, PIZ, 36, 82, 1); note(8, 0, PIZ, 48, 76, 1)
for n in ACC["C"][1]:
    note(8, 0, PIZ, n, 64, 1)
note(9, 0, PIZ, 41, 60, 1); note(9, 2, PIZ, 48, 56, 1)
note(10, 0, PIZ, 36, 62, 2); note(10, 0, PIZ, 48, 58, 2)

# ---------------------------------------------------------------- cordes tenues (à partir de la mesure 5)
tenues = {5: [53, 57, 60, 65], 6: [52, 55, 60, 64], 7: [50, 53, 55, 59], 8: [48, 52, 55, 60, 64],
          9: [53, 57, 60], 10: [48, 52, 55, 60]}
for m, ns in tenues.items():
    for n in ns:
        note(m, 0, CORD, n, 50 if m < 8 else 58, 4.0 if m < 10 else 4.5, humain=False)

# ---------------------------------------------------------------- grelots
GRELOT = 83
for i in range(8):                                                    # roulement d'entrée
    note(0, 2 + i * 0.25, GREL, GRELOT, 30 + 8 * i, 0.2)
for m in range(1, 8):
    for k in range(8):
        t = k * 0.5
        v = {0: 72, 1: 88, 2: 72, 3: 88}[int(t)] if k % 2 == 0 else 46
        note(m, t, GREL, GRELOT, v + int(rng.normal(0, 4)), 0.2)
note(8, 0, GREL, GRELOT, 88, 0.5)
note(8, 0.02, GREL, 84, 60, 1.0)                                      # « bell tree » pour la magie
for i in range(6):                                                    # dernier petit secouement, qui s'éteint
    note(10, i * 0.25, GREL, GRELOT, 70 - 9 * i, 0.2)

# ---------------------------------------------------------------- fichier MIDI
mid = mido.MidiFile(ticks_per_beat=TPB)
tr = mido.MidiTrack(); mid.tracks.append(tr)
msgs = [(0, mido.MetaMessage("set_tempo", tempo=int(60e6 / BPM)))]
for c, p in PROGRAMMES.items():
    msgs.append((0, mido.Message("program_change", channel=c, program=p)))
for c, (vol, rev, pan) in {CEL: (110, 70, 64), GLO: (78, 80, 76), PIZ: (96, 50, 56), CORD: (62, 85, 64), GREL: (72, 60, 74)}.items():
    msgs += [(0, mido.Message("control_change", channel=c, control=7, value=vol)),
             (0, mido.Message("control_change", channel=c, control=91, value=rev)),
             (0, mido.Message("control_change", channel=c, control=93, value=20)),
             (0, mido.Message("control_change", channel=c, control=10, value=pan))]
for t, c, n, v, d in evenements:
    on = int(round(t * TPB)); off = int(round((t + d) * TPB))
    msgs.append((on, mido.Message("note_on", channel=c, note=n, velocity=v)))
    msgs.append((off, mido.Message("note_off", channel=c, note=n, velocity=0)))
msgs.sort(key=lambda x: (x[0], 0 if x[1].type != "note_on" else 1))
dernier = 0
for tick, m in msgs:
    tr.append(m.copy(time=tick - dernier)); dernier = tick
mid.save("musique.mid")

subprocess.run(["fluidsynth", "-ni", "-q", "-g", "0.5", "-r", str(SR),
                "-o", "synth.reverb.room-size=0.62", "-o", "synth.reverb.damp=0.35", "-o", "synth.reverb.width=0.9",
                "-o", "synth.reverb.level=0.75",
                "-F", "musique_brute.wav", SF2, "musique.mid"], check=True, capture_output=True)
sr, x = wavfile.read("musique_brute.wav")
x = x.astype(np.float32) / 32768.0
# calage : l'échantillon 0 du rendu = début de la mesure 0
decalage = int(round(DEBUT_M0 * SR))
n = int(round(DUREE * SR))
y = np.zeros((n, 2), np.float32)
if decalage >= 0:
    m = min(n - decalage, len(x)); y[decalage:decalage + m] = x[:m]
else:
    m = min(n, len(x) + decalage); y[:m] = x[-decalage:-decalage + m]
# fondu de sortie sur les 0,6 dernières secondes
f = int(0.6 * SR)
y[-f:] *= np.linspace(1, 0, f)[:, None] ** 1.5
wavfile.write(SORTIE, SR, y)
print(f"ok {SORTIE} — tempo {BPM}, mesure 1 à {DEBUT_M0 + MESURE:.3f} s, mesure 8 (arrêt luge) à {DEBUT_M0 + 8 * MESURE:.3f} s, "
      f"fin de l'accord final à {DEBUT_M0 + 10 * MESURE:.3f} s, crête {20*np.log10(np.abs(y).max()+1e-9):.1f} dBFS")
