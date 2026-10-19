"""Fabrique les images d'aperçu de la charte : sous-titre normal, phrase forte,
grand titre et icône animée figée.

Tout est lu dans ma-charte.json : couleurs, polices, tailles, positions.
Les textes sont rendus par ffmpeg + libass, comme dans les vrais montages
(les sous-titres passent par outils/sous_titres.py).

Usage : python3 outils/generer_apercus.py
"""
import json
import math
import random
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

import sous_titres

RACINE = Path(__file__).resolve().parent.parent
CHARTE = json.loads((RACINE / "ma-charte.json").read_text(encoding="utf-8"))
SORTIE = RACINE / "apercus"
W, H = 1080, 1920


def hex_rgb(code):
    code = code.lstrip("#")
    return tuple(int(code[i:i + 2], 16) for i in (0, 2, 4))


BLANC = hex_rgb(CHARTE["couleurs"]["blanc"])
ORANGE = hex_rgb(CHARTE["couleurs"]["orange"])
ASS_BLANC = CHARTE["couleurs"]["ass"]["blanc"]
ASS_ORANGE = CHARTE["couleurs"]["ass"]["orange"]


def image_de_test():
    """Une fausse image d'interview : fond chaud flou, silhouette, lumières, grain."""
    random.seed(4)
    img = Image.new("RGB", (W, H), (20, 18, 16))
    px = img.load()
    for y in range(H):
        t = y / H
        for x in range(0, W):
            # dégradé vertical + lumière chaude en haut à gauche
            d = math.hypot(x - 180, y - 380) / 1100
            chaud = max(0.0, 1 - d) ** 2
            r = int(26 - 12 * t + 70 * chaud)
            g = int(23 - 10 * t + 42 * chaud)
            b = int(21 - 9 * t + 22 * chaud)
            px[x, y] = (r, g, b)

    bokeh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(bokeh)
    for _ in range(16):
        cx, cy = random.randint(0, W), random.randint(120, 1100)
        rr = random.randint(30, 90)
        teinte = random.choice([(255, 190, 120), (255, 160, 90), (240, 220, 200)])
        dr.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=teinte + (random.randint(28, 60),))
    img.paste(bokeh.filter(ImageFilter.GaussianBlur(14)), (0, 0), bokeh.filter(ImageFilter.GaussianBlur(14)))

    perso = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dp = ImageDraw.Draw(perso)
    # liseré de lumière (décalé à gauche), puis la silhouette par-dessus
    for dx, couleur_corps, couleur_tete in ((-9, (110, 80, 58, 255), (140, 102, 76, 255)),
                                            (0, (34, 31, 29, 255), (66, 52, 44, 255))):
        dp.ellipse([540 - 470 + dx, 1110, 540 + 470 + dx, 2400], fill=couleur_corps)
        dp.ellipse([480 + dx, 900, 600 + dx, 1180], fill=couleur_tete)
        dp.ellipse([540 - 145 + dx, 630, 540 + 145 + dx, 1000], fill=couleur_tete)
    perso = perso.filter(ImageFilter.GaussianBlur(12))
    img.paste(perso, (0, 0), perso)

    # vignettage + grain
    vig = Image.new("L", (W, H), 0)
    ImageDraw.Draw(vig).ellipse([-260, -200, W + 260, H + 200], fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(220))
    img = Image.composite(img, Image.new("RGB", (W, H), (0, 0, 0)), vig)
    grain = Image.effect_noise((W, H), 18).convert("RGB")
    img = Image.blend(img, grain, 0.05)

    police = ImageFont.truetype(str(RACINE / CHARTE["polices"]["petits_textes"]["fichier"]), 26)
    ImageDraw.Draw(img).text((90, 250), "IMAGE DE TEST", font=police, fill=(150, 140, 130))
    return img


def degrade_haut(img, hauteur=1100, opacite=0.6):
    """Le léger dégradé noir derrière les grands titres."""
    masque = Image.new("L", (W, H), 0)
    dm = ImageDraw.Draw(masque)
    for y in range(hauteur):
        dm.line([(0, y), (W, y)], fill=int(255 * opacite * (1 - y / hauteur) ** 1.3))
    return Image.composite(Image.new("RGB", (W, H), (0, 0, 0)), img, masque)


ENTETE_TITRES = (
    "[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\n"
    "WrapStyle: 2\nScaledBorderAndShadow: yes\n\n"
    "[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
    "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, "
    "Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
    + CHARTE["titres"]["style_ass"] + "\n\n[Events]\n"
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
)


def rendu(fond, ass_texte, sortie, polices, t=0.9):
    """Incruste un fichier .ass sur une image, figé à l'instant t (en secondes)."""
    with tempfile.TemporaryDirectory() as tmp:
        fond_png = Path(tmp) / "fond.png"
        fond.save(fond_png)
        ass = Path(tmp) / "textes.ass"
        ass.write_text(ass_texte, encoding="utf-8")
        subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-loop", "1", "-framerate", "30",
             "-t", "2", "-i", str(fond_png), "-vf", f"subtitles={ass}:fontsdir={polices}",
             "-ss", str(t), "-frames:v", "1", str(sortie)],
            check=True,
        )


def mot_cle(mot):
    # mot mis en évidence sans couleur : italique + relief noir (ombre nette décalée), puis retour au style
    return f"{{\\fnFigtree Black Italic\\bord0\\blur0\\shad7\\4c&H000000&\\4a&H00&}}{mot}{{\\r\\blur12}}"


def sous_titre(texte):
    return sous_titres.fichier_ass([{"debut": 0, "fin": 2, "texte": texte}])


def icone_courbe(taille, progression=0.72):
    """Icône « ventes en hausse » au trait fin, figée en plein tracé (progression 0 à 1)."""
    ech = 4
    c = taille * ech
    marge = int(c * 0.12)
    toile = Image.new("RGBA", (c + 2 * marge, c + 2 * marge), (0, 0, 0, 0))
    u = c / 100  # unités de 0 à 100
    ep = CHARTE["icones"]
    trait = max(2, round(2.5 * u))

    def P(x, y):
        return (marge + x * u, marge + y * u)

    d = ImageDraw.Draw(toile)

    def ligne(points, couleur):
        d.line(points, fill=couleur, width=trait, joint="curve")
        for x, y in (points[0], points[-1]):
            d.ellipse([x - trait / 2, y - trait / 2, x + trait / 2, y + trait / 2], fill=couleur)

    blanc = BLANC + (255,)
    ligne([P(10, 8), P(10, 90), P(92, 90)], blanc)  # axes

    courbe = [P(22, 74), P(42, 52), P(57, 63), P(86, 24)]
    longueurs = [math.dist(a, b) for a, b in zip(courbe, courbe[1:])]
    reste = sum(longueurs) * progression
    trace = [courbe[0]]
    for (a, b), l in zip(zip(courbe, courbe[1:]), longueurs):
        if reste >= l:
            trace.append(b)
            reste -= l
        else:
            k = reste / l
            trace.append((a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k))
            break
    ligne(trace, blanc)

    # le détail orange : un point en bout de trait, en plein rebond (110 %) avec un halo doux
    bx, by = trace[-1]
    r = 5.5 * u * 1.1
    halo = Image.new("RGBA", toile.size, (0, 0, 0, 0))
    ImageDraw.Draw(halo).ellipse([bx - r * 2.2, by - r * 2.2, bx + r * 2.2, by + r * 2.2], fill=ORANGE + (90,))
    halo = halo.filter(ImageFilter.GaussianBlur(r))
    toile = Image.alpha_composite(halo, toile)
    ImageDraw.Draw(toile).ellipse([bx - r, by - r, bx + r, by + r], fill=ORANGE + (255,))

    finale = taille + 2 * marge // ech
    return toile.resize((finale, finale), Image.LANCZOS)


def main():
    SORTIE.mkdir(exist_ok=True)
    fond = image_de_test()
    ti = CHARTE["titres"]

    with tempfile.TemporaryDirectory() as tmp:
        polices = sous_titres.dossier_polices_statiques(Path(tmp) / "polices")

        # 1. Sous-titre normal (même rendu et même place que la première vidéo)
        rendu(fond, sous_titre("Tout a changé."), SORTIE / "1-sous-titre.png", polices)

        # 1b. Phrase forte : mots de tailles différentes, figée une fois tous les mots apparus
        bloc = {"debut": 0.0, "fin": 2.0, "lignes": [
            [{"mot": "on a", "role": "appui", "debut": 0.0}],
            [{"mot": "doublé", "role": "choc", "debut": 0.25}],
            [{"mot": "nos", "role": "liaison", "debut": 0.5}, {"mot": "clients", "role": "fort", "debut": 0.6}],
        ]}
        rendu(fond, sous_titres.fichier_ass(blocs=[bloc]), SORTIE / "1b-phrase-forte.png", polices)

        # 2. Grand titre (accroche)
        lignes = ["EN 3 MOIS", "ON A " + mot_cle("DOUBLÉ"), "NOS CLIENTS"]
        y0, ecart = ti["position"]["y_premiere_ligne"], ti["position"]["ecart_lignes_px"]
        evts = "".join(
            f"Dialogue: 0,0:00:00.00,0:00:05.00,Titre,,0,0,0,,{{\\pos({ti['position']['x']},{y0 + i * ecart})\\blur12}}{l}\n"
            for i, l in enumerate(lignes))
        rendu(degrade_haut(fond), ENTETE_TITRES + evts, SORTIE / "2-grand-titre.png", polices)

        # (plus d'aperçu d'icône : l'utilisateur ne veut plus de pictos, remplacés par des plans de coupe)

    print("Aperçus enregistrés dans", SORTIE)


if __name__ == "__main__":
    main()
