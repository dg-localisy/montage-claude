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


def _paire(debut, fin, pos_tags, texte, anim_texte="", anim_ombre="", depuis=None):
    """Deux lignes : l'ombre (calque 0, copie noire décalée et floutée) puis le texte blanc (calque 1).
    depuis = (x_depart, duree_ms) : le texte glisse horizontalement de x_depart à x au début de l'événement."""
    x, y, base = pos_tags
    dx, dy = OMBRE['decalage_x_px'], OMBRE['decalage_y_px']

    def place(ox, oy):
        if depuis:
            return f"\\move({depuis[0] + ox:.1f},{y + oy:.1f},{x + ox:.1f},{y + oy:.1f},0,{depuis[1]})"
        return f"\\pos({x + ox:.1f},{y + oy:.1f})"

    ombre = (f"{{{base}{place(dx, dy)}"
             f"\\1c&H000000&\\3c&H000000&\\bord{OMBRE['epaisseur_px']}\\blur{OMBRE['flou']}{anim_ombre}}}")
    blanc = f"{{{base}{place(0, 0)}{anim_texte}}}"
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
    bases = [0.0]
    for a, b in zip(lignes, lignes[1:]):
        ecart = FORTES["interligne_facteur"] * max(a["taille"], b["taille"])
        for m in b["mots"]:
            if m["remonte"] > 0:
                ecart = max(ecart, m["remonte"] + 0.72 * m["taille"] * EM_PAR_TAILLE + FORTES.get("marge_exposant_em", 0.2) * a["taille"] * EM_PAR_TAILLE)
        bases.append(bases[-1] + ecart)
    haut = bases[0] - 0.72 * lignes[0]["taille"] * EM_PAR_TAILLE  # haut des majuscules de la 1re ligne
    decal_y = FORTES["centre_vertical_y"] - (haut + bases[-1]) / 2
    decal_x = FORTES["decalage_lignes_px"].get(str(len(lignes)), [0] * len(lignes))

    # Centrage (remarque de l'utilisateur : « pas centré, surtout quand il n'y a qu'une ligne ») :
    # les lignes apparaissent l'une après l'autre. À chaque étape, les lignes déjà visibles gardent leur décalage
    # en quinconce les unes par rapport aux autres, mais leur ensemble est remis au milieu de l'image.
    # Une 1re ligne seule est donc au centre ; quand la ligne suivante arrive, elle glisse doucement vers sa place.
    def recentre(n):
        if not FORTES.get("centrer_bloc", True):
            return decal_x[:n]
        vues = list(zip(lignes[:n], decal_x[:n]))
        gauche = min(540 + dx - l["largeur"] / 2 for l, dx in vues)
        droite = max(540 + dx + l["largeur"] / 2 for l, dx in vues)
        return [dx + 540 - (gauche + droite) / 2 for dx in decal_x[:n]]

    etapes = [min(m["debut"] for m in l["mots"]) for l in lignes]  # moment où chaque ligne commence
    decal_par_etape = [recentre(n + 1) for n in range(len(lignes))]

    places = []
    for li, (ligne, base) in enumerate(zip(lignes, bases)):
        for m in ligne["mots"]:
            # positions x successives du mot : une par étape où il est visible (temps de début, x)
            xs = []
            for e in range(li, len(lignes)):
                x = 540 + decal_par_etape[e][li] - ligne["largeur"] / 2 + m["x_rel"]
                t = max(m["debut"], etapes[e]) if e > li else m["debut"]
                if xs and t <= m["debut"]:
                    xs[-1] = (m["debut"], x)  # la ligne suivante a commencé avant ce mot : il apparaît déjà à la bonne place
                else:
                    xs.append((t, x))
            places.append({**m, "x": xs[-1][1], "positions": xs, "base": base + decal_y - m["remonte"]})
    return places


def evenements_bloc(bloc):
    ent, sor = FORTES["animation_entree"], FORTES["animation_sortie"]
    glisse = FORTES.get("glisse_recentrage_ms", 220)
    lignes = []
    for m in _mise_en_page(bloc):
        y_ass = m["base"] + DESCENTE_PAR_TAILLE * m["taille"]
        base = f"\\an1\\fn{m['police']}\\fs{m['taille']}"
        pos = m["positions"]
        # un événement par étape : le mot glisse de sa place précédente à la nouvelle quand une ligne arrive
        for j, (debut, x) in enumerate(pos):
            fin = pos[j + 1][0] if j + 1 < len(pos) else bloc["fin"]
            if fin <= debut:
                continue
            duree = round((fin - debut) * 1000)
            ecoule = round((debut - m["debut"]) * 1000)  # temps déjà passé depuis l'apparition du mot
            reste = ent["duree_ms"] - ecoule
            if reste > 0:  # apparition (flou -> net) encore en cours
                p = ecoule / ent["duree_ms"]
                a_t = round((1 - ent["opacite_depart"]) * 255 * (1 - p))
                a_o = round(0xC0 * (1 - p))
                anim_t = f"\\alpha&H{a_t:02X}&\\blur{ent['flou_depart'] * (1 - p):.1f}\\t(0,{reste},\\alpha&H00&\\blur0)"
                anim_o = f"\\alpha&H{a_o:02X}&\\t(0,{reste},\\alpha&H00&\\blur{OMBRE['flou']})"
            else:
                anim_t = anim_o = ""
            if j == len(pos) - 1:  # disparition à la fin du bloc
                anim_t += f"\\t({max(0, duree - sor['duree_ms'])},{duree},\\alpha&HFF&\\blur{ent['flou_depart']})"
                anim_o += f"\\t({max(0, duree - sor['duree_ms'])},{duree},\\alpha&HFF&)"
            depuis = (pos[j - 1][1], min(glisse, duree)) if j else None
            lignes += _paire(debut, fin, (x, y_ass, base), m["mot"], anim_t, anim_o, depuis)
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
