"""Grave les sous-titres INCENDIE et les phrases fortes (outils/sous_titres.py) sur une vidéo déjà montée par quelqu'un d'autre
(riser, zooms et effets déjà faits), puis remet le son à -14 LUFS / -1 dBTP (simple gain, limiteur seulement si la crête dépasse).
Usage : node moteur/scripts/preparer.mjs projets/NOM/effets.json   (calcule les sous-titres)
        python3 outils/graver_sous_titres.py moteur/public/projet.json projets/NOM/rush/rush.mp4 SORTIE.mp4
"""
import json, subprocess, sys
from pathlib import Path
sys.path.insert(0, '/home/user/montage-claude/outils')
import sous_titres
projet, video, sortie = sys.argv[1], sys.argv[2], sys.argv[3]
p = json.load(open(projet))['projet']
groupes = [{'debut': g['debut'], 'fin': g['fin_affichage'], 'texte': ' '.join(m['texte'] for m in g['mots'])} for g in p['groupes']]
ass = Path(sortie).with_suffix('.ass')
ass.write_text(sous_titres.fichier_ass(groupes, p['sous_titres']['phrases_fortes']))
polices = sous_titres.dossier_polices_statiques(str(Path(sortie).with_suffix('')) + '_polices')
def mesure(f):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    r = r[r.rfind('Summary:'):]
    return float(r.split('I:')[1].split('LUFS')[0]), float(r.split('Peak:')[1].split('dBFS')[0])
i0, c0 = mesure(video)
gain, limite = -14.0 - i0, -1.3
for essai in range(4):
    af = f'volume={gain:.2f}dB,alimiter=limit={10 ** (limite / 20):.4f}:attack=5:release=50:level=disabled'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', video, '-vf', f'subtitles={ass}:fontsdir={polices}', '-c:v', 'libx264', '-crf', '16', '-preset', 'slow',
                    '-pix_fmt', 'yuv420p', '-af', af, '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-movflags', '+faststart', sortie], check=True)
    i, c = mesure(sortie)
    print(f'essai {essai + 1} : gain {gain:+.1f} dB → {i} LUFS, crête {c} dBTP')
    if abs(i + 14) <= 0.3 and c <= -1.0:
        break
    if c > -1.0: limite -= (c + 1.0) + 0.1
    if i < -14.3 or i > -13.7: gain += -14.0 - i
print('avant :', i0, 'LUFS', c0, 'dBTP ; après :', i, 'LUFS', c, 'dBTP')
