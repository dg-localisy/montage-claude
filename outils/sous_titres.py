"""Fabrique les sous-titres (fichier .ass pour ffmpeg/libass) à partir de ma-charte.json.

Deux types de sous-titres, comme dans la première vidéo :
- les sous-titres normaux : 1 à 4 mots, Figtree Light blanc, changement instantané ;
- les phrases fortes : 2 ou 3 lignes serrées, mots de tailles différentes,
  chaque mot apparaît en se défloutant au moment où il est prononcé.

Exemple :
    groupes = [{"debut": 0.0, "fin": 0.8, "texte": "Il y a des gens"}]
    blocs = [{"debut": 1.0, "fin": 2.6, "lignes": [
        [{"mot": "donc on", "role": "appui", "debut": 1.0}],
        [{"mot": "touche", "role": "choc", "debut": 1.3}],
        [{"mot": "des", "role": "liaison", "debut": 1.7}, {"mot": "humains", "role": "fort", "debut": 1.9}],
    ]}]
    open("sous-titres.ass", "w").write(fichier_ass(groupes, blocs))
"""
import json
from functools import lru_cache
from pathlib import Path

from PIL import ImageFont

RACINE = Path(__file__).resolve().parent.parent
CHARTE = json.loads((RACINE / "ma-charte.json").read_text(encoding="utf-8"))
ST = CHARTE["sous_titres"]
NORMAL, OMBRE, FORTES = ST["normal"], ST["ombre"], ST["phrases_fortes"]

# Figtree : winAscent 979 + winDescent 222 = 1201 unités. libass règle la taille sur cette hauteur.
EM_PAR_TAILLE = 1000 / 1201
DESCENTE_PAR_TAILLE = 222 / 1201
FICHIERS = {f["nom_interne"]: f["fichier"] for f in CHARTE["polices"]["inventaire"] if not f["variable"]}


def _t(secondes):
    cs = max(0, round(secondes * 100))
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


@lru_cache(maxsize=None)
def _police(nom, taille):
    return ImageFont.truetype(str(RACINE / CHARTE["polices"]["dossier"] / FICHIERS[nom]), max(1, round(taille * EM_PAR_TAILLE)))


def largeur(texte, nom, taille):
    return _police(nom, taille).getlength(texte) * NORMAL["largeur_lettres_pct"] / 100


def entete():
    return (
        "[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\n"
        "WrapStyle: 2\nScaledBorderAndShadow: yes\n\n"
        "[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, "
        "BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, "
        "Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        + ST["style_ass"] + "\n\n[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )


def _paire(debut, fin, pos_tags, texte, anim_texte="", anim_ombre=""):
    """Deux lignes : l'ombre (calque 0, copie noire décalée et floutée) puis le texte blanc (calque 1)."""
    x, y, base = pos_tags
    ombre = (f"{{{base}\\pos({x + OMBRE['decalage_x_px']:.1f},{y + OMBRE['decalage_y_px']:.1f})"
             f"\\1c&H000000&\\3c&H000000&\\bord{OMBRE['epaisseur_px']}\\blur{OMBRE['flou']}{anim_ombre}}}")
    blanc = f"{{{base}\\pos({x:.1f},{y:.1f}){anim_texte}}}"
    return [f"Dialogue: 0,{_t(debut)},{_t(fin)},ST,,0,0,0,,{ombre}{texte}",
            f"Dialogue: 1,{_t(debut)},{_t(fin)},ST,,0,0,0,,{blanc}{texte}"]


def evenements_normaux(groupes):
    p = NORMAL["position"]
    lignes = []
    for g in groupes:
        lignes += _paire(g["debut"], g["fin"], (p["x"], p["y_ass_an2"], "\\an2"), g["texte"])
    return lignes


def _mise_en_page(bloc):
    """Calcule la position (x, ligne de base) de chaque mot d'un bloc de phrase forte."""
    roles = FORTES["roles"]
    t0 = NORMAL["taille_ass"]
    lignes = []
    for ligne in bloc["lignes"]:
        mots = []
        for m in ligne:
            r = roles[m["role"]]
            taille = round(t0 * r["echelle"])
            mots.append({**m, "police": r["police"], "taille": taille, "l": largeur(m["mot"], r["police"], taille)})
        grand = max(mots, key=lambda m: m["taille"])
        x, decalages_y = 0.0, []
        for i, m in enumerate(mots):
            if i:
                x += 0.25 * min(m["taille"], mots[i - 1]["taille"]) * EM_PAR_TAILLE
            m["x_rel"] = x
            x += m["l"]
            avant_le_grand = m["taille"] < grand["taille"] and i < mots.index(grand)
            m["remonte"] = 0.5 * grand["taille"] * EM_PAR_TAILLE if avant_le_grand else 0.0
        lignes.append({"mots": mots, "largeur": x, "taille": grand["taille"]})

    # lignes de base, serrées ; si un petit mot est remonté (exposant) sur la ligne du dessous,
    # on écarte juste assez pour qu'il ne touche pas la ligne du dessus (l'utilisateur les trouvait collés)
    # Même blanc visible entre deux lignes, quelle que soit leur taille : sous un gros mot, une petite ligne
    # remonte (l'utilisateur trouvait « ma mère / sait pas » trop écartés). Entre deux lignes de même taille,
    # ou d'une petite vers une grande, rien ne change : 0,82 × la plus grande taille.
    haut_maj = 0.72 * EM_PAR_TAILLE
    bases = [0.0]
    for a, b in zip(lignes, lignes[1:]):
        grande = max(a["taille"], b["taille"])
        ecart = haut_maj * b["taille"] + (FORTES["interligne_facteur"] - haut_maj) * grande
        for m in b["mots"]:
            if m["remonte"] > 0:
                ecart = max(ecart, m["remonte"] + 0.72 * m["taille"] * EM_PAR_TAILLE + FORTES.get("marge_exposant_em", 0.2) * a["taille"] * EM_PAR_TAILLE)
        bases.append(bases[-1] + ecart)
    haut = bases[0] - 0.72 * lignes[0]["taille"] * EM_PAR_TAILLE  # haut des majuscules de la 1re ligne
    decal_y = FORTES["centre_vertical_y"] - (haut + bases[-1]) / 2
    decal_x = FORTES["decalage_lignes_px"].get(str(len(lignes)), [0] * len(lignes))
    # Centrage sans aucun mouvement (demandes de l'utilisateur : « pas centré, surtout quand il n'y a qu'une ligne »,
    # puis « ne mets pas de texte qui bouge pour le recentrer ») : chaque mot reste là où il apparaît.
    # La 1re ligne, seule au début, est au centre. Chaque ligne suivante garde son décalage en quinconce par rapport
    # à la 1re tant que l'ensemble des lignes visibles reste centré ; une ligne plus large que le bloc se centre.
    if FORTES.get("centrer_bloc", True):
        relatif = [d - decal_x[0] for d in decal_x]
        decal_x = [0.0]
        demi = lignes[0]["largeur"] / 2  # le bloc visible reste symétrique : de -demi à +demi autour du centre
        for k in range(1, len(lignes)):
            marge = max(0.0, demi - lignes[k]["largeur"] / 2)
            decal_x.append(max(-marge, min(marge, relatif[k])))
            demi = max(demi, lignes[k]["largeur"] / 2)

    places = []
    for ligne, base, dx in zip(lignes, bases, decal_x):
        x0 = 540 + dx - ligne["largeur"] / 2
        for m in ligne["mots"]:
            places.append({**m, "x": x0 + m["x_rel"], "base": base + decal_y - m["remonte"]})
    return places


def evenements_bloc(bloc):
    ent, sor = FORTES["animation_entree"], FORTES["animation_sortie"]
    alpha0 = f"&H{round((1 - ent['opacite_depart']) * 255):02X}&"
    lignes = []
    for m in _mise_en_page(bloc):
        debut, fin = m["debut"], bloc["fin"]
        duree = round((fin - debut) * 1000)
        sortie = f"\\t({max(0, duree - sor['duree_ms'])},{duree},\\alpha&HFF&\\blur{ent['flou_depart']})"
        anim_t = f"\\alpha{alpha0}\\blur{ent['flou_depart']}\\t(0,{ent['duree_ms']},\\alpha&H00&\\blur0){sortie}"
        anim_o = (f"\\alpha&HC0&\\t(0,{ent['duree_ms']},\\alpha&H00&\\blur{OMBRE['flou']})"
                  f"\\t({max(0, duree - sor['duree_ms'])},{duree},\\alpha&HFF&)")
        y_ass = m["base"] + DESCENTE_PAR_TAILLE * m["taille"]
        base = f"\\an1\\fn{m['police']}\\fs{m['taille']}"
        lignes += _paire(debut, fin, (m["x"], y_ass, base), m["mot"], anim_t, anim_o)
    return lignes


def fichier_ass(groupes=(), blocs=()):
    ev = evenements_normaux(groupes)
    for b in blocs:
        ev += evenements_bloc(b)
    return entete() + "\n".join(ev) + "\n"


def dossier_polices_statiques(dossier):
    """Crée un dossier avec seulement les polices statiques (à passer à ffmpeg avec fontsdir=)."""
    d = Path(dossier)
    d.mkdir(parents=True, exist_ok=True)
    for nom, fichier in FICHIERS.items():
        lien = d / fichier
        if not lien.exists():
            lien.symlink_to(RACINE / CHARTE["polices"]["dossier"] / fichier)
    return d
