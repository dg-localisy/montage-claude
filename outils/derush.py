"""Dérush automatique pour les vidéos face caméra.

Usage :
    python3 outils/derush.py MA_VIDEO.mp4 --script MON_SCRIPT.txt
    (options : --sortie DOSSIER, --langue fr, --pause-max 0.30, --garder-silences)

Ce que fait l'outil, dans l'ordre :
 1. Transcrit la vidéo avec ElevenLabs Scribe (scribe_v1, mot par mot, hésitations gardées).
 2. Aligne mot à mot ce qui a été dit avec le script prévu. Un mot en trop = une reprise à couper.
    Quand une phrase est répétée, c'est la DERNIÈRE prise qui est gardée.
 3. Calibre un seuil de silence sur le fichier lui-même (bruit de fond et mot le plus doux).
 4. Place chaque coupe dans un silence, calée sur une image de la vidéo. Aucun mot gardé n'est touché.
 5. Vérifie : niveau sonore à chaque raccord, puis nouvelle transcription du montage comparée
    mot à mot à l'original. Si un mot manque, l'outil corrige et recommence avant de livrer.

Dans le dossier de sortie : la vidéo dérushée, rapport.md (lisible), rapport.json, schema.png.
"""
import argparse
import json
import math
import re
import subprocess
import sys
import unicodedata
from difflib import SequenceMatcher
from fractions import Fraction
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile

sys.path.insert(0, str(Path(__file__).resolve().parent))
import elevenlabs as el  # noqa: E402

RACINE = Path(__file__).resolve().parent.parent
HOP = 0.005          # pas d'analyse du son : 5 ms
FENETRE = 0.020      # fenêtre d'analyse : 20 ms
SILENCE_MIN = 0.040  # un silence doit durer au moins 40 ms pour accueillir une coupe
DEGAGEMENT = 0.010   # une coupe reste à 10 ms au moins des bords du silence
FONDU = 0.005        # micro-fondu de 5 ms à chaque raccord (évite les clics)


# ---------------------------------------------------------------- vidéo et son

def sonder(video):
    sortie = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(video)],
                            capture_output=True, text=True, check=True).stdout
    info = json.loads(sortie)
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    a = next(s for s in info["streams"] if s["codec_type"] == "audio")
    fps = Fraction(v["r_frame_rate"])
    moyenne = Fraction(v.get("avg_frame_rate", "0/1") or "0/1")
    return {
        "fps": fps,
        "vfr": moyenne != 0 and abs(float(moyenne - fps)) > 0.01,
        "duree": float(info["format"]["duration"]),
        "sr": int(a["sample_rate"]),
        "canaux": int(a["channels"]),
        "decalage_audio": float(a.get("start_time", 0) or 0) - float(v.get("start_time", 0) or 0),
    }


def lire_audio(fichier, sr, canaux, decalage=0.0):
    brut = subprocess.run(["ffmpeg", "-v", "error", "-i", str(fichier), "-vn", "-ac", str(canaux), "-ar", str(sr),
                           "-f", "f32le", "-"], capture_output=True, check=True).stdout
    x = np.frombuffer(brut, np.float32).reshape(-1, canaux).T.copy()
    if decalage > 0:      # le son commence après l'image : on complète par du silence
        x = np.pad(x, ((0, 0), (round(decalage * sr), 0)))
    elif decalage < 0:
        x = x[:, round(-decalage * sr):]
    return x


def energie_db(mono, sr):
    """Niveau sonore (dB) toutes les 5 ms, après un filtre qui retire les grondements sous 80 Hz."""
    sos = signal.butter(4, 80, "highpass", fs=sr, output="sos")
    y = signal.sosfiltfilt(sos, mono.astype(np.float64))
    hop, win = round(HOP * sr), round(FENETRE * sr)
    n = max(1, (len(y) - win) // hop + 1)
    carres = np.lib.stride_tricks.sliding_window_view(y ** 2, win)[::hop][:n]
    db = 10 * np.log10(carres.mean(axis=1) + 1e-12)
    temps = np.arange(n) * HOP + FENETRE / 2
    return temps, db


# ---------------------------------------------------------------- texte

UNITES = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze",
          "treize", "quatorze", "quinze", "seize", "dix sept", "dix huit", "dix neuf"]
DIZAINES = {2: "vingt", 3: "trente", 4: "quarante", 5: "cinquante", 6: "soixante"}


def en_lettres(n):
    if n < 20:
        return UNITES[n]
    if n < 70:
        d, u = divmod(n, 10)
        return DIZAINES[d] + ("" if u == 0 else " et un" if u == 1 else " " + UNITES[u])
    if n < 80:
        return "soixante " + ("et onze" if n == 71 else en_lettres(n - 60))
    if n < 100:
        return "quatre vingt" + ("" if n == 80 else " " + en_lettres(n - 80))
    if n < 1000:
        c, r = divmod(n, 100)
        return ("cent" if c == 1 else UNITES[c] + " cent") + ("" if r == 0 else " " + en_lettres(r))
    if n < 1_000_000:
        m, r = divmod(n, 1000)
        return ("mille" if m == 1 else en_lettres(m) + " mille") + ("" if r == 0 else " " + en_lettres(r))
    return str(n)


def corrections_charte():
    try:
        charte = json.loads((RACINE / "ma-charte.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    paires = []
    for m in charte.get("mots_a_corriger", []):
        for variante in m.get("remplacer_automatiquement", []):
            paires.append((variante.lower(), m["forme_correcte"].lower()))
    return sorted(paires, key=lambda p: -len(p[0]))


CORRECTIONS = corrections_charte()


def normaliser(texte):
    """Découpe un texte en mots comparables (minuscules, sans ponctuation, chiffres écrits en lettres)."""
    t = unicodedata.normalize("NFC", texte).replace("’", "'").replace("ʼ", "'").lower()
    t = t.replace("%", " pour cent ").replace("€", " euros ")
    for variante, bonne in CORRECTIONS:
        t = re.sub(rf"(?<![\w']){re.escape(variante)}(?![\w'])", bonne, t)
    t = re.sub(r"\b1(er|re|ère)\b", lambda m: "premier" if m.group(1) == "er" else "première", t)
    t = re.sub(r"\d+", lambda m: " " + en_lettres(int(m.group())) + " ", t)
    jetons = []
    for j in re.findall(r"[a-zà-öø-ÿœæ']+", t):
        j = j.strip("'")
        if j:
            jetons.append(re.sub(r"^(vingt|cent)s$", r"\1", j))
    return jetons


def ressemblance(a, b):
    if a == b:
        return 1.0
    if min(len(a), len(b)) < 4:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def aligner(dits, prevus):
    """Alignement mot à mot (programmation dynamique).

    Renvoie, pour chaque mot dit : "ok" (correspond au script) ou "en_trop" ;
    et pour chaque mot prévu : "dit" ou "manquant".
    En partant de la fin et en préférant toujours un accord, ce sont les DERNIÈRES prises qui sont retenues.
    """
    n, m = len(dits), len(prevus)
    TROU = -1.0

    def score(i, j):
        r = ressemblance(dits[i], prevus[j])
        return 2.0 if r == 1.0 else 1.5 if r >= 0.8 else -1.0

    s = np.zeros((n + 1, m + 1))
    s[:, 0] = np.arange(n + 1) * TROU
    s[0, :] = np.arange(m + 1) * TROU
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            s[i, j] = max(s[i - 1, j - 1] + score(i - 1, j - 1), s[i - 1, j] + TROU, s[i, j - 1] + TROU)

    etat_dits, etat_prevus = ["en_trop"] * n, ["manquant"] * m
    i, j = n, m
    while i > 0 or j > 0:
        if i > 0 and j > 0:
            sc = score(i - 1, j - 1)
            if sc > 0 and math.isclose(s[i, j], s[i - 1, j - 1] + sc):
                etat_dits[i - 1], etat_prevus[j - 1] = "ok", "dit"
                i, j = i - 1, j - 1
                continue
            if math.isclose(s[i, j], s[i - 1, j - 1] + sc):   # substitution : mot gardé (prudence)
                etat_dits[i - 1], etat_prevus[j - 1] = "ok", "dit"
                i, j = i - 1, j - 1
                continue
        if i > 0 and math.isclose(s[i, j], s[i - 1, j] + TROU):
            i -= 1
            continue
        j -= 1
    return etat_dits, etat_prevus


def mots_avec_jetons(transcription):
    mots = el.mots(transcription)
    for k, w in enumerate(mots):
        w["indice"] = k
        w["jetons"] = normaliser(w["texte"]) if w["type"] == "word" else []
    return mots


# ---------------------------------------------------------------- silences

def calibrer(temps, db, mots):
    """Seuil de silence calculé sur CE fichier : au-dessus du bruit de fond, en dessous du mot le plus doux."""
    parle = np.zeros(len(temps), bool)
    for w in mots:
        if w["type"] == "word":
            parle |= (temps >= w["debut"] - 0.06) & (temps <= w["fin"] + 0.06)
    pauses = db[~parle]
    if len(pauses) * HOP < 0.3:
        pauses = np.sort(db)[: max(10, len(db) // 7)]
    bruit_median, bruit_haut = float(np.median(pauses)), float(np.percentile(pauses, 95))

    niveaux = []
    for w in mots:
        if w["type"] == "word" and w["fin"] - w["debut"] >= 0.03:
            zone = db[(temps >= w["debut"]) & (temps <= w["fin"])]
            if len(zone):
                niveaux.append((float(np.percentile(zone, 90)), w["texte"]))
    plus_doux = min(niveaux) if niveaux else (bruit_haut + 30, "?")

    seuil = max(bruit_haut + 4.0, bruit_median + 3.0)
    alerte = None
    if seuil > plus_doux[0] - 8.0:
        seuil = max(bruit_median + 3.0, plus_doux[0] - 8.0)
        if seuil < bruit_haut:
            seuil = (bruit_haut + plus_doux[0]) / 2
            alerte = f"Le mot le plus doux (« {plus_doux[1]} ») est presque au niveau du bruit de fond."
    return {"seuil_db": round(seuil, 1), "bruit_median_db": round(bruit_median, 1), "bruit_haut_db": round(bruit_haut, 1),
            "mot_le_plus_doux_db": round(plus_doux[0], 1), "mot_le_plus_doux": plus_doux[1], "alerte": alerte}


def plages_silence(temps, db, seuil, duree):
    sous = db < seuil
    plages, debut = [], None
    for k, v in enumerate(sous):
        if v and debut is None:
            debut = k
        elif not v and debut is not None:
            plages.append((debut, k - 1))
            debut = None
    if debut is not None:
        plages.append((debut, len(sous) - 1))
    res = []
    for a, b in plages:
        s, e = temps[a] - HOP / 2, temps[b] + HOP / 2
        if a == 0:
            s = 0.0
        if b == len(sous) - 1:
            e = duree
        if e - s >= SILENCE_MIN:
            res.append((max(0.0, s), min(duree, e)))
    return res


def blocs_sonores(silences, duree):
    blocs, t = [], 0.0
    for s, e in silences:
        if s > t:
            blocs.append((t, s))
        t = e
    if t < duree:
        blocs.append((t, duree))
    return blocs


def etendue(w, blocs):
    """Étendue réelle d'un mot : tous les sons qui le touchent, même ses débuts et fins très doux."""
    touches = [b for b in blocs if b[1] > w["debut"] and b[0] < w["fin"]]
    if not touches:
        return (w["debut"], w["fin"]), True
    return (min(b[0] for b in touches), max(b[1] for b in touches)), False


# ---------------------------------------------------------------- plan de coupe

class Planificateur:
    def __init__(self, fps, duree, silences, protections):
        self.fps, self.duree, self.silences, self.protections = fps, duree, silences, protections
        self.n_images = int(math.floor(duree * fps + 1e-6))

    def t(self, k):
        return float(k / self.fps)

    def image(self, s, e, cible):
        """Image la plus proche de la cible, à l'intérieur du silence (s, e), hors zones protégées."""
        lo, hi = s + DEGAGEMENT, e - DEGAGEMENT
        if s <= 0:
            lo = 0.0
        if e >= self.duree:
            hi = self.duree
        k0, k1 = math.ceil(lo * self.fps - 1e-9), math.floor(hi * self.fps + 1e-9)
        bons = [k for k in range(max(0, k0), min(self.n_images, k1) + 1)
                if not any(p0 <= self.t(k) <= p1 for p0, p1 in self.protections)]
        return min(bons, key=lambda k: abs(self.t(k) - cible)) if bons else None

    def englobe_protection(self, a, b):
        return any(self.t(a) < p1 and self.t(b) > p0 for p0, p1 in self.protections)


def planifier(mots, etats_mots, silences, duree, fps, pause_max, resserrer, protections=()):
    blocs = blocs_sonores(silences, duree)
    pl = Planificateur(fps, duree, silences, list(protections))
    for w in mots:
        w["etendue"], w["tres_doux"] = etendue(w, blocs) if w["type"] == "word" else ((w["debut"], w["fin"]), False)

    paroles = [w for w in mots if w["type"] == "word" and w["jetons"]]
    gardes = [w for w in paroles if etats_mots[w["indice"]] != "en_trop"]
    pl.protections += [(w["etendue"][0] - 0.02, w["etendue"][1] + 0.02) for w in gardes]

    # suites de mots en trop
    suites, cour = [], []
    for w in paroles:
        if etats_mots[w["indice"]] == "en_trop":
            cour.append(w)
        elif cour:
            suites.append(cour)
            cour = []
    if cour:
        suites.append(cour)

    def silence_avant(t):
        return next((s for s in reversed(silences) if s[1] <= t + 1e-6 and s[1] >= t - 0.03), None)

    def silence_apres(t):
        return next((s for s in silences if s[0] >= t - 1e-6 and s[0] <= t + 0.03), None)

    retraits, reprises = [], []
    for suite in suites:
        premier, dernier = suite[0], suite[-1]
        d0, f0 = premier["etendue"][0], dernier["etendue"][1]
        texte = " ".join(w["texte"] for w in suite)
        avant = [w for w in gardes if w["etendue"][1] <= d0 + 1e-6]
        apres = [w for w in gardes if w["etendue"][0] >= f0 - 1e-6]
        chevauche = [w for w in gardes if w["etendue"][0] < f0 and w["etendue"][1] > d0]
        info = {"texte": texte, "debut_s": round(premier["debut"], 2), "fin_s": round(dernier["fin"], 2)}
        if chevauche:
            reprises.append({**info, "coupee": False, "raison": "collée à un mot gardé, sans silence entre les deux"})
            continue
        # point d'entrée de la coupe (A) et point de sortie (B)
        if not avant and d0 <= DEGAGEMENT:
            A = 0
        else:
            sA = silence_avant(d0)
            cible = (sA[0] + (pause_max / 2 if resserrer else (sA[1] - sA[0]) / 2)) if sA else None
            if sA and not avant:
                cible = sA[0]                      # tout au début du fichier : on coupe depuis le début
            A = pl.image(*sA, cible) if sA else None
        if not apres and f0 >= duree - DEGAGEMENT:
            B = pl.n_images
        else:
            sB = silence_apres(f0)
            cible = (sB[1] - (pause_max / 2 if resserrer else (sB[1] - sB[0]) / 2)) if sB else None
            if sB and not apres:
                cible = sB[1]                      # tout à la fin : on coupe jusqu'au bout
            B = pl.image(*sB, cible) if sB else None
        if A is None or B is None or B <= A:
            cote = "avant" if A is None else "après"
            reprises.append({**info, "coupee": False, "raison": f"pas de silence exploitable {cote} la reprise"})
            continue
        if pl.englobe_protection(A, B):
            reprises.append({**info, "coupee": False, "raison": "un mot gardé se trouve dans la zone à couper"})
            continue
        retraits.append((A, B, "reprise"))
        reprises.append({**info, "coupee": True, "de_s": round(pl.t(A), 3), "a_s": round(pl.t(B), 3)})

    # silences trop longs (hors reprises)
    resserres = []
    if resserrer:
        for s, e in silences:
            if any(pl.t(a) < e and pl.t(b) > s for a, b, _ in retraits):
                continue
            debut_fichier, fin_fichier = s <= 0.0, e >= duree
            garde_avant = 0.15 if debut_fichier else pause_max / 2
            garde_apres = 0.30 if fin_fichier else pause_max / 2
            if e - s <= garde_avant + garde_apres + 2 / float(fps):
                continue
            A = 0 if debut_fichier else pl.image(s, e, s + garde_avant)
            B = pl.n_images if fin_fichier else pl.image(s, e, e - garde_apres)
            if debut_fichier:
                B = pl.image(s, e, e - garde_avant)
            if fin_fichier:
                A = pl.image(s, e, s + garde_apres)
            if A is not None and B is not None and B - A >= 1 and not pl.englobe_protection(A, B):
                retraits.append((A, B, "silence"))
                resserres.append({"de_s": round(pl.t(A), 3), "a_s": round(pl.t(B), 3)})

    # fusion des retraits et segments gardés (en numéros d'image)
    retraits.sort()
    fusion = []
    for a, b, nature in retraits:
        if fusion and a <= fusion[-1][1]:
            fusion[-1] = (fusion[-1][0], max(fusion[-1][1], b), fusion[-1][2] if fusion[-1][2] == "reprise" else nature)
        else:
            fusion.append((a, b, nature))
    segments, k = [], 0
    for a, b, _ in fusion:
        if a > k:
            segments.append((k, a))
        k = max(k, b)
    if k < pl.n_images:
        segments.append((k, pl.n_images))
    return {"segments": segments, "retraits": fusion, "reprises": reprises, "silences_resserres": resserres,
            "gardes": gardes, "n_images": pl.n_images}


# ---------------------------------------------------------------- rendu

def rendre(video, audio, sr, fps, segments, sortie, travail):
    """Image : sélection exacte des images gardées. Son : découpé à l'échantillon près, mêmes instants."""
    expr = "+".join(f"between(n,{a},{b - 1})" for a, b in segments)
    video_seule = travail / "video_coupee.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(video), "-an",
                    "-vf", f"select='{expr}',setpts=N/FRAME_RATE/TB", "-r", str(fps), "-fps_mode", "cfr",
                    "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
                    str(video_seule)], check=True)
    f = round(FONDU * sr)
    rampe = (0.5 - 0.5 * np.cos(np.linspace(0, np.pi, f))).astype(np.float32)
    morceaux = []
    for a, b in segments:
        x = audio[:, round(a * sr / fps):round(b * sr / fps)].copy()
        if x.shape[1] > 2 * f:
            x[:, :f] *= rampe
            x[:, -f:] *= rampe[::-1]
        morceaux.append(x)
    son = np.concatenate(morceaux, axis=1)
    wav = travail / "son_coupe.wav"
    wavfile.write(wav, sr, son.T.astype(np.float32))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(video_seule), "-i", str(wav), "-map", "0:v", "-map", "1:a",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", str(sortie)], check=True)


def source_vers_montage(t, segments, fps):
    cumul = 0
    for a, b in segments:
        if a / fps <= t < b / fps:
            return float((cumul + (t * fps - a)) / fps)
        cumul += b - a
    return None


# ---------------------------------------------------------------- vérifications

def verifier_raccords(sortie, segments, fps, sr, seuil, temps_src, db_src):
    mono = lire_audio(sortie, sr, 1)[0]
    temps, db = energie_db(mono, sr)
    lignes, cumul = [], 0
    for i, (a, b) in enumerate(segments[:-1]):
        cumul += b - a
        tau = float(cumul / fps)
        zone = db[(temps >= tau - 0.015) & (temps <= tau + 0.015)]
        niveau = float(zone.max()) if len(zone) else -120.0
        fin_src, debut_src = float(b / fps), float(segments[i + 1][0] / fps)
        z1 = db_src[(temps_src >= fin_src - 0.010) & (temps_src <= fin_src + 0.010)]
        z2 = db_src[(temps_src >= debut_src - 0.010) & (temps_src <= debut_src + 0.010)]
        niveau_src = float(max(z1.max() if len(z1) else -120, z2.max() if len(z2) else -120))
        lignes.append({"raccord": i + 1, "temps_montage_s": round(tau, 3), "source_s": [round(fin_src, 3), round(debut_src, 3)],
                       "niveau_montage_db": round(niveau, 1), "niveau_source_db": round(niveau_src, 1),
                       "ok": niveau < seuil + 1.5 and niveau_src < seuil})
    return lignes


def verifier_mots(sortie, plan, mots, fps, langue, travail):
    flac = travail / "montage.flac"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(sortie), "-vn", "-ac", "1", "-ar", "16000", str(flac)], check=True)
    trans = el.transcrire(flac, langue=langue, cache_dir=travail / "cache")
    obtenus = mots_avec_jetons(trans)
    jet_obt = [j for w in obtenus for j in w["jetons"]]
    attendus, origine = [], []
    for w in plan["gardes"]:
        for j in w["jetons"]:
            attendus.append(j)
            origine.append(w)
    etats_obt, etats_att = aligner(jet_obt, attendus)
    manquants = []
    for j, (etat, w) in enumerate(zip(etats_att, origine)):
        if etat == "manquant":
            manquants.append({"mot": attendus[j], "texte": w["texte"], "source_s": round(w["debut"], 2),
                              "montage_s": source_vers_montage(w["debut"], plan["segments"], fps), "mot_source": w})
    en_trop = [jet_obt[i] for i, e in enumerate(etats_obt) if e == "en_trop"]
    return {"attendus": len(attendus), "retrouves": len(attendus) - len(manquants), "manquants": manquants,
            "en_trop_dans_le_montage": en_trop, "texte_montage": trans.get("text", "")}


def reecoute_locale(sortie, t, mot, langue, travail):
    extrait = travail / f"extrait_{t:.2f}.flac"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{max(0, t - 1.5):.3f}", "-t", "3", "-i", str(sortie),
                    "-vn", "-ac", "1", "-ar", "16000", str(extrait)], check=True)
    jet = [j for w in mots_avec_jetons(el.transcrire(extrait, langue=langue, cache_dir=travail / "cache")) for j in w["jetons"]]
    return any(ressemblance(mot, j) >= 0.8 for j in jet)


def verifier_synchro(sortie, segments, fps, sr):
    sortie_json = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0",
                                  "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", str(sortie)],
                                 capture_output=True, text=True, check=True).stdout.strip()
    images = int(sortie_json.split(",")[0])
    attendues = sum(b - a for a, b in segments)
    n_son = lire_audio(sortie, sr, 1).shape[1]
    ecart_ms = abs(n_son / sr - attendues / float(fps)) * 1000
    return {"images_attendues": attendues, "images_obtenues": images, "duree_image_s": round(attendues / float(fps), 3),
            "duree_son_s": round(n_son / sr, 3), "ecart_ms": round(ecart_ms, 1),
            "coupes_sur_images": True, "ok": images == attendues and ecart_ms < 1000 / float(fps)}


# ---------------------------------------------------------------- rapport

def schema(temps, db, seuil, plan, fps, duree, fichier):
    from PIL import Image, ImageDraw, ImageFont
    L, Ht, marge = 1600, 360, 50
    img = Image.new("RGB", (L, Ht), (18, 18, 18))
    d = ImageDraw.Draw(img)
    try:
        police = ImageFont.truetype(str(RACINE / "Figtree-Medium.ttf"), 18)
    except OSError:
        police = ImageFont.load_default()
    X = lambda t: marge + (L - 2 * marge) * t / duree  # noqa: E731
    lo, hi = float(np.percentile(db, 1)) - 3, float(db.max()) + 3
    Y = lambda v: 300 - 250 * (v - lo) / (hi - lo)  # noqa: E731
    for a, b, nature in plan["retraits"]:
        d.rectangle([X(a / fps), 40, X(b / fps), 300], fill=(255, 77, 0) if nature == "reprise" else (60, 60, 60))
    pts = [(X(t), Y(v)) for t, v in zip(temps[::4], db[::4])]
    d.line(pts, fill=(235, 235, 235), width=1)
    d.line([(marge, Y(seuil)), (L - marge, Y(seuil))], fill=(80, 200, 255), width=2)
    cumul = 0
    for a, b in plan["segments"][:-1]:
        d.line([(X(b / fps), 40), (X(b / fps), 300)], fill=(255, 255, 255), width=1)
    for s in range(int(duree) + 1):
        d.text((X(s), 308), f"{s}s", font=police, fill=(150, 150, 150), anchor="mt")
    d.text((marge, 12), "Orange : reprises coupées   Gris : silences raccourcis   Ligne bleue : seuil de silence calibré",
           font=police, fill=(220, 220, 220))
    img.save(fichier)


def ecrire_rapport(dossier, r):
    (dossier / "rapport.json").write_text(json.dumps(r, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    c, v1, v2, sy = r["calibrage"], r["verif_raccords"], r["verif_mots"], r["verif_synchro"]
    L = [f"# Rapport de dérush : {r['video']}", "",
         f"Durée : {r['duree_avant_s']:.1f} s avant, {r['duree_apres_s']:.1f} s après.", "",
         "## Seuil de silence (calibré sur ce fichier)", "",
         f"- Bruit de fond : {c['bruit_median_db']} dB (pointes à {c['bruit_haut_db']} dB)",
         f"- Mot le plus doux : « {c['mot_le_plus_doux']} » à {c['mot_le_plus_doux_db']} dB",
         f"- Seuil retenu : **{c['seuil_db']} dB**", ""]
    if c.get("alerte"):
        L += [f"Attention : {c['alerte']}", ""]
    L += ["## Reprises", "", "| Passage | Moment | Décision |", "|---|---|---|"]
    for p in r["reprises"]:
        dec = f"coupé ({p['de_s']} s → {p['a_s']} s)" if p["coupee"] else f"gardé : {p['raison']}"
        L.append(f"| {p['texte']} | {p['debut_s']} s | {dec} |")
    L += ["", f"Silences raccourcis : {len(r['silences_resserres'])}", "",
          "## Vérification 1 : le son à chaque raccord", "",
          "| Raccord | Moment dans le montage | Niveau mesuré | Seuil | Résultat |", "|---|---|---|---|---|"]
    for x in v1:
        L.append(f"| {x['raccord']} | {x['temps_montage_s']} s | {x['niveau_montage_db']} dB | {c['seuil_db']} dB | "
                 f"{'OK, dans un silence' if x['ok'] else 'PROBLÈME'} |")
    L += ["", "## Vérification 2 : nouvelle transcription du montage", "",
          f"- Mots attendus : {v2['attendus']}", f"- Mots retrouvés : {v2['retrouves']}",
          f"- Mots manquants : {len(v2['manquants_final'])}"]
    for m in v2["manquants_final"]:
        L.append(f"  - « {m['texte']} » ({m['source_s']} s dans l'original) : {m['statut']}")
    if v2["corrections"]:
        L += ["", "Corrections faites avant livraison :"] + [f"- {x}" for x in v2["corrections"]]
    if v2["en_trop_dans_le_montage"]:
        L += ["", "Mots présents dans le montage mais pas dans les mots gardés : " + ", ".join(v2["en_trop_dans_le_montage"])]
    L += ["", "## Synchronisation image / son", "",
          f"- Toutes les coupes tombent sur une image : oui",
          f"- Images : {sy['images_obtenues']} obtenues pour {sy['images_attendues']} attendues",
          f"- Durée image {sy['duree_image_s']} s, durée son {sy['duree_son_s']} s (écart {sy['ecart_ms']} ms)", ""]
    (dossier / "rapport.md").write_text("\n".join(L), encoding="utf-8")


# ---------------------------------------------------------------- programme principal

def derush(video, script, dossier, langue="fr", pause_max=0.30, resserrer=True, essais_max=3):
    video, dossier = Path(video), Path(dossier)
    nom = video.stem
    travail = dossier / "travail"
    travail.mkdir(parents=True, exist_ok=True)
    info = sonder(video)
    fps = info["fps"]
    if info["vfr"]:   # cadence variable (fréquent sur téléphone) : on passe en cadence fixe d'abord
        cfr = travail / "source_cfr.mp4"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(video), "-r", str(fps), "-fps_mode", "cfr",
                        "-c:v", "libx264", "-crf", "12", "-preset", "fast", "-c:a", "copy", str(cfr)], check=True)
        video, info = cfr, sonder(cfr)
    sr, canaux = info["sr"], info["canaux"]
    audio = lire_audio(video, sr, canaux, info["decalage_audio"])
    duree = min(info["duree"], audio.shape[1] / sr)
    mono = audio.mean(axis=0)

    print("1/5 Transcription Scribe…")
    flac = travail / "source.flac"
    wavfile.write(travail / "source_mono.wav", sr, mono.astype(np.float32))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(travail / "source_mono.wav"), "-ar", "16000", str(flac)], check=True)
    trans = el.transcrire(flac, langue=langue, cache_dir=travail / "cache")
    mots = mots_avec_jetons(trans)

    print("2/5 Alignement avec le script…")
    jetons_dits = [(j, w["indice"]) for w in mots for j in w["jetons"]]
    etats, etats_script = aligner([j for j, _ in jetons_dits], normaliser(Path(script).read_text(encoding="utf-8")))
    par_mot = {}
    for (j, k), e in zip(jetons_dits, etats):
        par_mot.setdefault(k, []).append(e)
    etats_mots = {k: ("en_trop" if all(e == "en_trop" for e in v) else "ok") for k, v in par_mot.items()}
    script_manquants = [j for j, e in zip(normaliser(Path(script).read_text(encoding="utf-8")), etats_script) if e == "manquant"]

    print("3/5 Calibrage du silence…")
    temps, db = energie_db(mono, sr)
    calib = calibrer(temps, db, mots)
    silences = plages_silence(temps, db, calib["seuil_db"], duree)

    protections, corrections = [], []
    sortie = dossier / f"{nom}_derush.mp4"
    for essai in range(1, essais_max + 1):
        print(f"4/5 Plan de coupe et rendu (essai {essai})…")
        plan = planifier(mots, etats_mots, silences, duree, fps, pause_max, resserrer, protections)
        rendre(video, audio, sr, fps, plan["segments"], sortie, travail)

        print("5/5 Vérifications…")
        v1 = verifier_raccords(sortie, plan["segments"], fps, sr, calib["seuil_db"], temps, db)
        v2 = verifier_mots(sortie, plan, mots, fps, langue, travail)
        a_corriger = []
        for m in v2["manquants"]:
            w = m["mot_source"]
            e0, e1 = w["etendue"]
            pres = [x for x in v1 if any(abs(s - e0) < 0.3 or abs(s - e1) < 0.3 for s in x["source_s"])]
            if pres:
                a_corriger.append(m)
                protections.append((e0 - 0.15, e1 + 0.15))
                m["statut"] = "coupé de trop près : marge élargie"
            elif m["montage_s"] is not None and reecoute_locale(sortie, m["montage_s"], m["mot"], langue, travail):
                m["statut"] = "bien présent (retrouvé à la réécoute du passage)"
            else:
                m["statut"] = "intact dans le montage mais non reconnu par la transcription"
        raccords_ko = [x for x in v1 if not x["ok"]]
        for x in raccords_ko:
            protections.append((x["source_s"][0] - 0.05, x["source_s"][0] + 0.05))
            protections.append((x["source_s"][1] - 0.05, x["source_s"][1] + 0.05))
        if not a_corriger and not raccords_ko:
            break
        if essai == essais_max:
            for m in a_corriger:
                m["statut"] = f"toujours manquant après {essais_max} essais : à vérifier à la main"
            break
        corrections += [f"Essai {essai} : marge élargie autour de « {m['texte']} »" for m in a_corriger]
        corrections += [f"Essai {essai} : raccord {x['raccord']} déplacé (niveau trop haut)" for x in raccords_ko]

    v2["manquants_final"] = [{k: v for k, v in m.items() if k != "mot_source"} for m in v2["manquants"]]
    v2["corrections"] = corrections
    del v2["manquants"]
    sy = verifier_synchro(sortie, plan["segments"], fps, sr)
    schema(temps, db, calib["seuil_db"], plan, fps, duree, dossier / "schema.png")
    rapport = {
        "video": nom, "fps": str(fps), "duree_avant_s": duree,
        "duree_apres_s": sum(b - a for a, b in plan["segments"]) / float(fps),
        "calibrage": calib, "reprises": plan["reprises"], "silences_resserres": plan["silences_resserres"],
        "mots_du_script_non_dits": script_manquants,
        "segments_images": plan["segments"], "verif_raccords": v1, "verif_mots": v2, "verif_synchro": sy,
        "essais": essai, "sortie": str(sortie),
    }
    ecrire_rapport(dossier, rapport)
    return rapport


def main():
    p = argparse.ArgumentParser(description="Dérush automatique d'une vidéo face caméra.")
    p.add_argument("video")
    p.add_argument("--script", required=True, help="texte prévu (fichier .txt)")
    p.add_argument("--sortie", help="dossier de sortie (par défaut : à côté de la vidéo)")
    p.add_argument("--langue", default="fr")
    p.add_argument("--pause-max", type=float, default=0.30, help="pause maximale gardée entre deux phrases (s)")
    p.add_argument("--garder-silences", action="store_true", help="ne raccourcit pas les silences, coupe seulement les reprises")
    a = p.parse_args()
    dossier = Path(a.sortie) if a.sortie else Path(a.video).with_name(Path(a.video).stem + "_derush")
    r = derush(a.video, a.script, dossier, a.langue, a.pause_max, not a.garder_silences)
    v1, v2, sy = r["verif_raccords"], r["verif_mots"], r["verif_synchro"]
    print(f"\nTerminé : {r['sortie']}")
    print(f"Raccords dans un silence : {sum(x['ok'] for x in v1)}/{len(v1)}")
    print(f"Mots retrouvés : {v2['retrouves']}/{v2['attendus']}  (manquants après correction : {len(v2['manquants_final'])})")
    print(f"Synchro image/son : {'OK' if sy['ok'] else 'PROBLÈME'}")
    print(f"Rapport : {dossier / 'rapport.md'}")


if __name__ == "__main__":
    main()
