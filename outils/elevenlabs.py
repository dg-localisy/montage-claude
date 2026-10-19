"""Petits appels à l'API ElevenLabs (transcription Scribe et synthèse vocale).

La clé n'est jamais affichée. Elle est lue dans la variable ELEVENLABS_API_KEY si elle existe ;
sinon, dans l'environnement cloud, le proxy l'ajoute tout seul aux appels vers api.elevenlabs.io.
"""
import hashlib
import json
import os
from pathlib import Path

import requests

API = "https://api.elevenlabs.io"


class ErreurElevenLabs(RuntimeError):
    pass


def _entetes(extra=None):
    h = {"Accept": "application/json"}
    cle = os.environ.get("ELEVENLABS_API_KEY")
    if cle:
        h["xi-api-key"] = cle
    if extra:
        h.update(extra)
    return h


def _verifie(rep):
    if rep.status_code >= 400:
        try:
            detail = rep.json().get("detail", rep.text[:300])
        except ValueError:
            detail = rep.text[:300]
        if isinstance(detail, dict):
            detail = f"{detail.get('status', '')} : {detail.get('message', '')}"
        raise ErreurElevenLabs(f"ElevenLabs a répondu {rep.status_code} : {detail}")
    return rep


def transcrire(fichier_audio, langue="fr", cache_dir=None, modele="scribe_v1"):
    """Transcription Scribe mot par mot, en gardant les hésitations (euh, reprises, faux départs).

    Le résultat est mis en cache (empreinte du fichier) pour ne pas payer deux fois la même transcription.
    """
    fichier_audio = Path(fichier_audio)
    empreinte = hashlib.sha256(fichier_audio.read_bytes()).hexdigest()[:16]
    cache = Path(cache_dir) / f"scribe_{modele}_{langue}_{empreinte}.json" if cache_dir else None
    if cache and cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))

    donnees = {
        "model_id": modele,
        "language_code": langue,
        "timestamps_granularity": "word",
        "tag_audio_events": "true",   # garde aussi les bruits (rires, souffles) comme événements
        "diarize": "false",
    }
    with fichier_audio.open("rb") as f:
        rep = requests.post(f"{API}/v1/speech-to-text", headers=_entetes(), data=donnees,
                            files={"file": (fichier_audio.name, f)}, timeout=600)
    resultat = _verifie(rep).json()
    if cache:
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(json.dumps(resultat, ensure_ascii=False, indent=1), encoding="utf-8")
    return resultat


def mots(transcription):
    """Liste des mots prononcés (sans les espaces), avec début et fin en secondes."""
    return [
        {"texte": w["text"], "debut": float(w["start"]), "fin": float(w["end"]), "type": w.get("type", "word")}
        for w in transcription.get("words", [])
        if w.get("type", "word") in ("word", "audio_event") and w.get("start") is not None
    ]


def voix():
    return _verifie(requests.get(f"{API}/v1/voices", headers=_entetes(), timeout=60)).json()["voices"]


def synthese(texte, voice_id, sortie, modele="eleven_multilingual_v2", reglages=None):
    """Synthèse vocale (consomme des caractères du forfait)."""
    corps = {"text": texte, "model_id": modele}
    if reglages:
        corps["voice_settings"] = reglages
    rep = requests.post(f"{API}/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128",
                        headers=_entetes({"Accept": "audio/mpeg", "Content-Type": "application/json"}),
                        json=corps, timeout=120)
    Path(sortie).write_bytes(_verifie(rep).content)
    return sortie
