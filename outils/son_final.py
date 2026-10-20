"""Son final d'un montage : voix + effets sonores (+ musique de fond), mesurés et réglés selon la charte.

Règles :
- volume final à -14 LUFS (intégré), crête vraie sous -1 dBTP ;
- un effet sonore n'est jamais plus de 6 dB au-dessus de la voix qui l'entoure
  (mesure en sonie « momentanée » sur 400 ms, pondération K de la norme EBU R128) ;
- la musique (si projet.json en a une) reste « sous_la_voix_db » sous la voix, et baisse encore
  de « baisse_quand_je_parle_db » quand la personne parle (attaque et relâche douces).

Le mélange est refait à partir des pistes séparées (voix du rush + effets listés dans
moteur/public/projet.json), ce qui permet de mesurer chaque effet seul et de le baisser au besoin.

Usage :
    python3 outils/son_final.py --video RENDU.mp4 --voix RUSH.mp4 --projet moteur/public/projet.json \
        --sons moteur/public/sons --sortie FINAL.mp4
"""
import argparse
import json
import subprocess
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
CIBLE_LUFS, CRETE_MAX, ECART_MAX = -14.0, -1.0, 6.0


def lire(fichier, canaux=2):
    brut = subprocess.run(["ffmpeg", "-v", "error", "-i", str(fichier), "-vn", "-ac", str(canaux), "-ar", str(SR),
                           "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(brut, np.float32).reshape(-1, canaux).T.astype(np.float64)


def ponderation_k(x):
    """Filtre de pondération K (ITU-R BS.1770) à 48 kHz."""
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=-1), axis=-1)


def puissances_blocs(x, duree=0.4, pas=0.1):
    """Puissance (somme des canaux) par blocs de 400 ms, tous les 100 ms."""
    k = ponderation_k(np.atleast_2d(x))
    carre = (k ** 2).sum(axis=0)
    n, h = int(duree * SR), int(pas * SR)
    if len(carre) < n:
        return np.array([carre.mean()]), np.array([0.0])
    cumul = np.concatenate([[0], np.cumsum(carre)])
    debuts = np.arange(0, len(carre) - n + 1, h)
    return (cumul[debuts + n] - cumul[debuts]) / n, debuts / SR


def lufs(p):
    return -0.691 + 10 * np.log10(np.maximum(p, 1e-15))


def sonie_integree(x):
    p, _ = puissances_blocs(x)
    p = p[lufs(p) > -70]
    if not len(p):
        return -70.0
    relatif = lufs(p.mean()) - 10
    p = p[lufs(p) > relatif]
    return float(lufs(p.mean()))


def crete_vraie(x):
    """Crête vraie approchée par suréchantillonnage x4 (dBTP)."""
    sur = signal.resample_poly(np.atleast_2d(x), 4, 1, axis=-1)
    return float(20 * np.log10(np.abs(sur).max() + 1e-12))


def piste_effets(projet, dossier_sons, n, gains_db=None):
    effets = np.zeros((2, n))
    for i, s in enumerate(projet["sons"]):
        sr, brut = wavfile.read(Path(dossier_sons) / Path(s["fichier"]).name)
        y = brut.astype(np.float64)
        if brut.dtype.kind in "iu":
            y /= float(2 ** (8 * brut.dtype.itemsize - 1))
        if sr != SR:
            y = signal.resample_poly(y, SR, sr, axis=0)
        y = np.vstack([y, y]) if y.ndim == 1 else y.T
        y = y[:2] if y.shape[0] >= 2 else np.vstack([y[0], y[0]])
        gain = s["volume"] * (10 ** ((gains_db[i] if gains_db else 0) / 20))
        a = int(round(s["debut"] * SR))
        b = min(n, a + y.shape[1])
        if a < n:
            effets[:, a:b] += gain * y[:, : b - a]
    return effets


def piste_musique(projet, dossier_public, voix, n):
    """Musique de fond réglée sous la voix, qui baisse quand la personne parle."""
    m = projet.get("musique")
    if not m:
        return None, None
    x = lire(Path(dossier_public) / m["fichier"])
    x = x[:, :n] if x.shape[1] >= n else np.pad(x, ((0, 0), (0, n - x.shape[1])))
    gain_db = sonie_integree(voix) + m["sous_la_voix_db"] - sonie_integree(x)
    # voix active : énergie par tranches de 20 ms, au-dessus de (niveau fort de la voix - 30 dB)
    pas = int(0.02 * SR)
    mono = voix.mean(axis=0)
    nb = len(mono) // pas
    db = 10 * np.log10(np.maximum((mono[: nb * pas].reshape(nb, pas) ** 2).mean(axis=1), 1e-12))
    actif = (db > np.percentile(db, 95) - 30).astype(float)
    lisse = np.zeros(nb)
    a_att, a_rel = 1 - np.exp(-0.02 / m["attaque_s"]), 1 - np.exp(-0.02 / m["relache_s"])
    for i in range(nb):
        prec = lisse[i - 1] if i else 0.0
        lisse[i] = prec + (a_att if actif[i] > prec else a_rel) * (actif[i] - prec)
    baisse = np.interp(np.arange(n), (np.arange(nb) + 0.5) * pas, lisse) * m["baisse_quand_je_parle_db"]
    x = x * 10 ** ((gain_db + baisse) / 20)
    return x, {"gain_db": round(gain_db, 1), "sous_la_voix_db": m["sous_la_voix_db"], "baisse_quand_je_parle_db": m["baisse_quand_je_parle_db"]}


def mesurer_effets(voix, effets, projet):
    """Pour chaque effet : sa sonie maximale seule, et celle de la voix autour (±2 s, hors silences)."""
    pv, tv = puissances_blocs(voix)
    pe, te = puissances_blocs(effets)
    lv, le = lufs(pv), lufs(pe)
    ref_globale = sonie_integree(voix)
    lignes = []
    for i, s in enumerate(projet["sons"]):
        t0 = s["debut"]
        zone = (te >= t0 - 0.2) & (te <= t0 + 0.8)
        effet = float(le[zone].max()) if zone.any() else -70.0
        autour = (tv >= t0 - 2) & (tv <= t0 + 2) & (lv > ref_globale - 15)
        voix_ref = float(np.median(lv[autour])) if autour.sum() >= 3 else ref_globale
        lignes.append({"n": i, "son": Path(s["fichier"]).stem, "effet": s.get("effet", ""), "temps_s": round(t0, 2),
                       "effet_lufs": round(effet, 1), "voix_lufs": round(voix_ref, 1), "ecart_db": round(effet - voix_ref, 1)})
    return lignes


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--video", required=True)
    p.add_argument("--voix", required=True)
    p.add_argument("--projet", required=True)
    p.add_argument("--sons", required=True)
    p.add_argument("--sortie", required=True)
    a = p.parse_args()

    projet_brut = json.loads(Path(a.projet).read_text(encoding="utf-8"))
    projet = projet_brut.get("projet", projet_brut)
    voix = lire(a.voix)
    n = voix.shape[1]

    # 1. mesure des effets tels que le moteur les a réglés, puis baisse de ceux qui dépassent +6 dB
    effets = piste_effets(projet, a.sons, n)
    avant = mesurer_effets(voix, effets, projet)
    gains = [min(0.0, ECART_MAX - 0.5 - x["ecart_db"]) if x["ecart_db"] > ECART_MAX - 0.5 else 0.0 for x in avant]
    effets = piste_effets(projet, a.sons, n, gains)
    apres = mesurer_effets(voix, effets, projet)

    # 2. musique de fond (facultative), puis mélange, gain unique pour atteindre -14 LUFS et limiteur doux si besoin
    musique, info_musique = piste_musique(projet, Path(a.sons).parent, voix, n)
    mix = voix + effets + (musique if musique is not None else 0)
    gain = CIBLE_LUFS - sonie_integree(mix)
    mix *= 10 ** (gain / 20)
    tmp = Path(a.sortie).with_suffix(".mix.wav")
    wavfile.write(tmp, SR, mix.T.astype(np.float32))
    filtre = "anull"
    if crete_vraie(mix) > CRETE_MAX:
        filtre = f"alimiter=limit={10 ** ((CRETE_MAX - 0.3) / 20):.4f}:attack=5:release=50:level=disabled"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(a.video), "-i", str(tmp), "-map", "0:v", "-map", "1:a",
                    "-c:v", "copy", "-af", filtre, "-c:a", "aac", "-b:a", "256k", "-ar", str(SR),
                    "-movflags", "+faststart", str(a.sortie)], check=True)
    tmp.unlink()

    # 3. vérification sur le fichier livré (mesure ffmpeg ebur128, indépendante)
    sortie = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(a.sortie), "-af", "ebur128=peak=true", "-f", "null", "-"],
                            capture_output=True, text=True).stderr
    resume = sortie[sortie.rfind("Summary:"):]
    integre = float(resume.split("I:")[1].split("LUFS")[0])
    crete = float(resume.split("Peak:")[1].split("dBFS")[0])
    rapport = {"lufs_integre": integre, "crete_vraie_dbtp": crete, "gain_applique_db": round(gain, 1),
               "effets_avant": avant, "effets_apres": apres, "baisses_db": [round(g, 1) for g in gains], "musique": info_musique,
               "ok": abs(integre - CIBLE_LUFS) <= 0.5 and crete <= CRETE_MAX + 0.1 and all(x["ecart_db"] <= ECART_MAX for x in apres)}
    Path(a.sortie).with_suffix(".son.json").write_text(json.dumps(rapport, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Sonie intégrée : {integre} LUFS (cible {CIBLE_LUFS}), crête vraie : {crete} dBTP")
    pire = max(apres, key=lambda x: x["ecart_db"]) if apres else None
    if pire:
        print(f"Effet le plus fort : {pire['son']} à {pire['temps_s']} s, {pire['ecart_db']:+} dB par rapport à la voix")
    print(f"Effets baissés : {sum(1 for g in gains if g < 0)} sur {len(gains)}")
    print("OK" if rapport["ok"] else "À VÉRIFIER")


if __name__ == "__main__":
    main()
