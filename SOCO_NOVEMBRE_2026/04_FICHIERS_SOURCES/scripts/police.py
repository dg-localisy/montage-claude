"""Télécharge une police Google Fonts (fichiers TTF) dans assets/fonts/ et écrit assets/css/polices.css.

Usage : python3 scripts/police.py "Nom De La Police" 400 500 700 800
La police est ensuite disponible en CSS sous le nom : var(--police)
"""
import os, re, sys, subprocess
ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
famille = sys.argv[1]
graisses = sys.argv[2:] or ['400', '500', '600', '700', '800']
url = 'https://fonts.googleapis.com/css2?family=' + famille.replace(' ', '+') + ':wght@' + ';'.join(graisses) + '&display=swap'
css = subprocess.run(['curl', '-sS', '-m', '30', url], capture_output=True, text=True, check=True).stdout
blocs = re.findall(r"font-weight: (\d+);.*?src: url\((https://[^)]+\.ttf)\)", css, re.S)
if not blocs:
    sys.exit('Police introuvable sur Google Fonts : ' + famille)
dossier = os.path.join(RACINE, 'assets', 'fonts')
os.makedirs(dossier, exist_ok=True)
sortie = []
slug = famille.replace(' ', '')
for poids, lien in blocs:
    fichier = f'{slug}-{poids}.ttf'
    subprocess.run(['curl', '-sS', '-m', '60', '-o', os.path.join(dossier, fichier), lien], check=True)
    sortie.append(f"@font-face {{ font-family: '{famille}'; font-weight: {poids}; font-style: normal; src: url('../fonts/{fichier}') format('truetype'); }}")
sortie.append(f":root {{ --police: '{famille}', sans-serif; }}")
open(os.path.join(RACINE, 'assets', 'css', 'polices.css'), 'w').write('\n'.join(sortie) + '\n')
print('ok', famille, [p for p, _ in blocs])
