// Exporte les maquettes HTML en PNG 1080 x 1350.
// Usage : node rendu.js            -> les 4 visuels
//         node rendu.js 2          -> seulement le visuel 2
//         node rendu.js --hd       -> ajoute une version 2160 x 2700 dans HD/
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ici = __dirname;
const sortie = path.join(ici, '..', '01_VISUELS_FINALS');
const sortieHD = path.join(ici, 'HD');
const args = process.argv.slice(2);
const hd = args.includes('--hd');
const choix = args.filter(a => /^\d$/.test(a)).map(Number);
const numeros = choix.length ? choix : [1, 2, 3, 4];

(async () => {
  const navigateur = await chromium.launch();
  for (const n of numeros) {
    const nom = `visuel_0${n}.html`;
    const fichier = path.join(ici, 'visuels', nom);
    if (!fs.existsSync(fichier)) { console.log(`absent : ${nom}`); continue; }
    const echelles = hd ? [1, 2] : [1];
    for (const e of echelles) {
      const page = await navigateur.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: e });
      await page.goto('file://' + fichier);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(300);
      const dossier = e === 1 ? sortie : sortieHD;
      fs.mkdirSync(dossier, { recursive: true });
      const cible = path.join(dossier, `SOCO_VISUEL_0${n}${e === 2 ? '_HD' : ''}.png`);
      await page.screenshot({ path: cible, clip: { x: 0, y: 0, width: 1080, height: 1350 } });
      console.log('exporté :', path.relative(process.cwd(), cible));
      await page.close();
    }
  }
  await navigateur.close();
})();
