"""Fabrique la voix de l'essai avec ElevenLabs (TTS + temps de chaque mot).

Utilise l'endpoint /with-timestamps : il renvoie le temps de chaque caractère,
donc on obtient les temps des mots sans payer de transcription.
Ne refait rien si la voix existe déjà (pour ne pas consommer de crédits).
La clé n'est jamais affichée : elle vient de ELEVENLABS_API_KEY si présente,
sinon le proxy de l'environnement l'ajoute tout seul.
"""
import base64
import json
import os
import ssl
import sys
import urllib.request
from pathlib import Path

ICI = Path(__file__).resolve().parent
MEDIA = ICI / "media"
TEXTE = "Avant Localisy, personne ne nous trouvait. En trois mois, on a doublé nos clients. Aujourd'hui, même l'IA nous recommande !"
VOIX = "EXAVITQu4vr4xnSDxMaL"  # Sarah (voix prédéfinie, parle français avec eleven_multilingual_v2)


def contexte_ssl():
    for ca in (os.environ.get("SSL_CERT_FILE"), "/root/.ccr/ca-bundle.crt"):
        if ca and os.path.exists(ca):
            return ssl.create_default_context(cafile=ca)
    return ssl.create_default_context()


def main():
    MEDIA.mkdir(parents=True, exist_ok=True)
    mp3, mots_json = MEDIA / "voix.mp3", MEDIA / "mots.json"
    if mp3.exists() and mots_json.exists():
        print("Voix déjà présente, rien à faire.")
        return
    if len(TEXTE) > 400:
        sys.exit("Texte trop long pour le budget de l'essai.")
    corps = json.dumps({"text": TEXTE, "model_id": "eleven_multilingual_v2",
                        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75, "style": 0.2}}).encode()
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOIX}/with-timestamps?output_format=mp3_44100_128",
        data=corps, headers={"Content-Type": "application/json"}, method="POST")
    cle = os.environ.get("ELEVENLABS_API_KEY")
    if cle:
        req.add_header("xi-api-key", cle)
    with urllib.request.urlopen(req, context=contexte_ssl(), timeout=120) as r:
        d = json.loads(r.read())
    mp3.write_bytes(base64.b64decode(d["audio_base64"]))
    al = d["alignment"]
    mots, courant = [], None
    for ch, t0, t1 in zip(al["characters"], al["character_start_times_seconds"], al["character_end_times_seconds"]):
        if ch.isspace():
            if courant:
                mots.append(courant)
            courant = None
            continue
        if courant is None:
            courant = {"mot": ch, "debut": round(t0, 3), "fin": round(t1, 3)}
        else:
            courant["mot"] += ch
            courant["fin"] = round(t1, 3)
    if courant:
        mots.append(courant)
    mots_json.write_text(json.dumps(mots, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(TEXTE)} caractères utilisés, {len(mots)} mots, durée {mots[-1]['fin']:.2f} s")


if __name__ == "__main__":
    main()
