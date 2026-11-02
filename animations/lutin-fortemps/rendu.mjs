// Pilote Chromium sans écran pour rendre la scène 3D.
//   node rendu.mjs images 0.5,2,4   -> images fixes (images/t_XXX.png)
//   node rendu.mjs video SORTIE.mkv [debut] [fin] -> toutes les images à 30 i/s, sans perte (FFV1)
//   node rendu.mjs etat ETAT.json [fin]   -> positions des pieds et de la luge (calage des bruitages)
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const DOSSIER = path.dirname(new URL(import.meta.url).pathname);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
const serveur = http.createServer((req, res) => {
  const f = path.join(DOSSIER, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(DOSSIER) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
const port = serveur.address().port;

const navigateur = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await navigateur.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
page.on('pageerror', (e) => console.log('[erreur page]', e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`);
await page.waitForFunction(() => window.pret === true, null, { timeout: 60000 });
const infos = await page.evaluate(() => window.preparer());
console.log('chronologie', JSON.stringify(infos));

async function image(t) {
  const r = await page.evaluate((t) => {
    const coins = window.rendre(t);
    return { png: document.getElementById('c').toDataURL('image/png'), coins };
  }, t);
  return { buf: Buffer.from(r.png.split(',')[1], 'base64'), coins: r.coins };
}

const mode = process.argv[2];
if (mode === 'images') {
  const temps = process.argv[3].split(',').map(Number);
  fs.mkdirSync(path.join(DOSSIER, 'images'), { recursive: true });
  for (const t of temps) {
    const d = Date.now();
    const { buf } = await image(t);
    const f = path.join(DOSSIER, 'images', `t_${t.toFixed(2).padStart(6, '0')}.png`);
    fs.writeFileSync(f, buf);
    console.log(f, `${Date.now() - d} ms`);
  }
} else if (mode === 'etat') {
  // positions des pieds et de la luge, 240 fois par seconde (pour les bruitages)
  const sortie = process.argv[3];
  const fin = Number(process.argv[4] || (infos.tFin + 4.6));
  const lignes = await page.evaluate((fin) => { const r = []; for (let i = 0; i <= fin * 240; i++) r.push(window.etat(i / 240)); return r; }, fin);
  fs.writeFileSync(sortie, JSON.stringify({ infos, colonnes: ['t', 'piedGx', 'piedGy', 'piedDx', 'piedDy', 'bassinX', 'lugeX'], lignes }));
  console.log('état écrit', sortie, lignes.length, 'lignes');
} else if (mode === 'video') {
  const sortie = process.argv[3];
  const FPS = 30;
  const debut = Number(process.argv[4] || 0);
  const fin = Number(process.argv[5] || (infos.tFin + 4.6));
  const n0 = Math.round(debut * FPS), n1 = Math.round(fin * FPS);
  const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'ffv1', '-level', '3', '-pix_fmt', 'rgb24', sortie], { stdio: ['pipe', 'inherit', 'inherit'] });
  const coins = {};
  const d0 = Date.now();
  for (let n = n0; n < n1; n++) {
    const { buf, coins: c } = await image(n / FPS);
    coins[n] = c;
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (n % 30 === 0) console.log(`image ${n}/${n1} — ${((Date.now() - d0) / (n - n0 + 1)).toFixed(0)} ms/image`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  fs.writeFileSync(sortie.replace(/\.mkv$/, '_coins.json'), JSON.stringify({ infos, fps: FPS, debut: n0, coins }));
  console.log('fini', sortie);
}
await navigateur.close();
serveur.close();
