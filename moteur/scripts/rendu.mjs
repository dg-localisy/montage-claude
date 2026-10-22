// Rendu complet d'une vidéo à partir de ma-charte.json + effets.json.
//
//   node scripts/rendu.mjs chemin/effets.json [--sortie dossier] [--nom essai]
//                          [--stills-seulement] [--sans-stills] [--sans-4x5] [--images 0-89] [--instants 1.8,18]
//
// Étapes : préparation → images fixes de contrôle (planche) → rendu Remotion →
// sous-titres « premiere_video » si demandés → volume -14 LUFS → version 4:5.
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {openBrowser, renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import {MOTEUR, PUBLIC, REPO, preparer} from './preparer.mjs';

// ---------- arguments ----------
const args = process.argv.slice(2);
const option = (nom, defaut) => {
  const i = args.indexOf(nom);
  return i >= 0 ? args[i + 1] : defaut;
};
const drapeau = (nom) => args.includes(nom);
const cheminEffets = args.find((a) => a.endsWith('.json'));
if (!cheminEffets) {
  console.error('Usage : node scripts/rendu.mjs chemin/effets.json [--sortie dossier] [--nom nom] [--stills-seulement] [--sans-stills]');
  process.exit(1);
}
const nom = option('--nom', path.basename(path.dirname(path.resolve(cheminEffets))) || 'video');
const sortie = path.resolve(option('--sortie', path.join(MOTEUR, 'sortie')));
fs.mkdirSync(sortie, {recursive: true});

// ---------- navigateur ----------
function trouver(motif, fichier) {
  const base = '/opt/pw-browsers';
  if (!fs.existsSync(base)) return undefined;
  const d = fs.readdirSync(base).filter((n) => n.startsWith(motif)).sort().pop();
  const chemin = d && path.join(base, d, 'chrome-linux', fichier);
  return chemin && fs.existsSync(chemin) ? chemin : undefined;
}

async function ouvrirNavigateur() {
  const essais = [];
  if (process.env.MOTEUR_CHROME_MODE !== 'chrome-for-testing') {
    essais.push({chromeMode: 'headless-shell', browserExecutable: process.env.MOTEUR_NAVIGATEUR || trouver('chromium_headless_shell', 'headless_shell') || null});
  }
  // Repli demandé en cas d'erreur « Target closed » ou « icudtl.dat »
  essais.push({chromeMode: 'chrome-for-testing', browserExecutable: process.env.MOTEUR_NAVIGATEUR_CFT || trouver('chromium-', 'chrome') || null});
  let derniere;
  for (const essai of essais) {
    try {
      const navigateur = await openBrowser('chrome', {...essai, chromiumOptions: {gl: 'swangle'}, logLevel: 'error'});
      console.log(`Navigateur : ${essai.chromeMode}${essai.browserExecutable ? ' (' + essai.browserExecutable + ')' : ''}`);
      return {navigateur, ...essai};
    } catch (err) {
      derniere = err;
      const msg = String(err && err.message);
      console.warn(`Échec du navigateur en mode ${essai.chromeMode} : ${msg.split('\n')[0]}`);
      if (!/Target closed|icudtl\.dat/i.test(msg) && essai.chromeMode === 'headless-shell') console.warn('Nouvel essai en mode chrome-for-testing…');
    }
  }
  console.error('\nRemotion ne peut pas lancer le navigateur dans cet environnement isolé.');
  console.error("Il faut l'autorisation de l'utilisateur pour lancer le rendu en dehors de l'environnement isolé.");
  throw derniere;
}

// ---------- images fixes de contrôle ----------
function instantsDeControle(projet) {
  const liste = [];
  const ajouter = (t, etiquette) => {
    if (t >= 0 && t < projet.duree) liste.push({t: Math.round(t * projet.fps) / projet.fps, etiquette});
  };
  for (const e of projet.effets) {
    const T = e._t || {};
    switch (e.type) {
      case 'accroche': ajouter(T.titre + (T.finFrappe - T.titre) * 0.5, 'accroche : frappe'); ajouter(T.finFrappe + 0.25, 'accroche : complète'); break;
      case 'grand_titre': ajouter(e.debut + 0.12, 'grand titre : entrée 3D'); ajouter(e.debut + 0.55, 'grand titre : posé'); break;
      case 'icone': ajouter(e.debut + 0.18, 'icône : rebond + particules'); ajouter(e.debut + 0.6, 'icône : posée'); break;
      case 'chiffre': ajouter((T.comptage[0] + T.comptage[1]) / 2, 'chiffre : défile'); ajouter(T.comptage[1] + 0.1, 'chiffre : arrivé'); break;
      case 'carte_fin': ajouter(e.debut + 0.25, 'carte de fin : entrée'); ajouter(Math.min(e.fin, projet.duree) - 0.05, 'carte de fin'); break;
      case 'signature': ajouter(e.debut + 0.15, 'signature : fondu'); ajouter(Math.min(e.fin, projet.duree) - 0.05, 'signature'); break;
      case 'liste': (e.temps || []).forEach((x, i) => ajouter(x + 0.3, `pastille ${i + 1}`)); ajouter(Math.min(e.fin, projet.duree) - 0.3, 'pastilles : toutes'); break;
      case 'plan_de_coupe': ajouter(e.debut + 0.3, 'plan de coupe : début'); ajouter(e.fin - 0.2, 'plan de coupe : fin'); break;
      case 'titre_bandeau': ajouter(e.debut + 0.15, 'bandeau : balayage'); ajouter(e.debut + 0.8, 'bandeau : posé'); break;
      case 'compteur': ajouter((T.comptage[0] + T.comptage[1]) / 2, 'compteur : défile'); ajouter(T.comptage[1] + 0.4, 'compteur : arrivé'); break;
      case 'frise': case 'bilan': (T.items || []).forEach((x, i) => ajouter(x + 0.35, `${e.type} ${i + 1}`)); ajouter(Math.min(e.fin, projet.duree) - 0.35, `${e.type} : complet`); if (e.barrer) ajouter(e.barrer.temps + 0.4, 'bilan : rayé'); break;
      case 'texte_derriere': ajouter(e.debut + 0.12, 'texte derrière : entrée'); ajouter(e.debut + 0.7, 'texte derrière : posé'); break;
      case 'courbe_derriere': ajouter((e.debut + e.cle) / 2, 'courbe : tracé'); ajouter(e.cle + 0.1, 'courbe : résultat'); ajouter(e.cle + 0.6, 'courbe : posée'); break;
      case 'page': ajouter(e.debut + 0.04, 'page : flash d\'entrée'); (T.elements || []).filter((el) => el.texte || el.type === 'vs').forEach((el) => ajouter(el.debut + 0.4, `page : ${el.type}`)); ajouter(e.fin - 0.1, 'page : complète'); break;
      case 'titre_empile': (T.lignes || []).forEach((l, i) => ajouter(l.mots[l.mots.length - 1].debut + 0.25, `empilé ${i + 1}`)); break;
      case 'barre_recherche': ajouter((T.frappe + T.finFrappe) / 2, 'recherche : frappe'); ajouter(T.finFrappe + 0.15, 'recherche : tapée'); break;
      case 'barres_comparees': ajouter(e.cle - 0.3, 'barres : remplissage'); ajouter(e.cle + 0.3, 'barres : résultat'); break;
      case 'etiquettes_flottantes': (T.items || []).forEach((x, i) => ajouter(x + 0.35, `étiquette ${i + 1}`)); break;
      case 'chapitre': ajouter(e.debut + 0.2, 'chapitre : entrée'); ajouter(e.debut + 0.9, 'chapitre : posé'); break;
      case 'tampon': ajouter(T.coup - 0.06, 'tampon : chute'); ajouter(T.coup + 0.3, 'tampon : posé'); break;
      case 'ticket': (T.lignes || []).filter((l) => l.type !== 'tirets').forEach((l, i) => ajouter(l.debut + 0.35, `ticket ${i + 1}`)); ajouter(e.fin - 0.5, 'ticket : complet'); ajouter(e.fin - 0.2, 'ticket : rentre'); break;
      case 'choix': ajouter(e.debut + 0.3, 'choix : entrée'); (T.options || []).forEach((o, i) => { ajouter(o.mots[o.mots.length - 1].debut + 0.3, `choix : option ${i + 1}`); if (o.sous) ajouter(o.sous[o.sous.length - 1].debut + 0.3, `choix : détail ${i + 1}`); }); break;
      case 'mot_souligne': ajouter(T.mot + 0.6, 'mot souligné'); if (T.ensuite) ajouter(T.ensuite + 0.5, 'mot remplacé'); break;
      case 'carte':
        ajouter(e.debut + 0.22, 'carte : réduction');
        if (e.animation === 'chat_ia') { ajouter((T.frappe + T.finFrappe) / 2, 'chat : frappe'); ajouter((T.points[0] + T.points[1]) / 2, 'chat : « écrit… »'); ajouter(T.finReponse + 0.2, 'chat : réponse'); }
        if (e.animation === 'checklist') { ajouter(T.coches[0] + 0.12, 'checklist : 1re coche'); ajouter(T.coches[T.coches.length - 1] + 0.4, 'checklist : finie'); }
        if (e.animation === 'entonnoir') { ajouter(T.etapes[1] + 0.15, 'entonnoir : en cours'); ajouter(T.etapes[T.etapes.length - 1] + 0.5, 'entonnoir : complet'); }
        if (e.animation === 'gros_chiffre') { ajouter((T.comptage[0] + T.comptage[1]) / 2, 'gros chiffre : défile'); ajouter(T.comptage[1] + 0.2, 'gros chiffre : arrivé'); }
        break;
      default: break;
    }
  }
  for (const tr of projet.transitions) { ajouter(tr.debut - tr.duree / 4, `transition ${tr.style} : avant`); ajouter(tr.debut + tr.duree / 6, `transition ${tr.style} : après`); }
  for (const z of projet.camera.zooms) ajouter(z.debut + z.duree / 2, 'zoom : flou de mouvement');
  projet.camera.coupes.forEach((c, i) => ajouter(c + 0.35, `cadrage plan ${i + 2}`));
  projet.groupes.filter((_, i) => i % 3 === 1).forEach((g) => ajouter((g.mots[g.mots.length - 1].debut + g.mots[g.mots.length - 1].fin) / 2, 'sous-titres mot à mot'));
  return liste.sort((a, b) => a.t - b.t);
}

function planche(images, cible) {
  const dossier = path.join(path.dirname(cible), 'vignettes');
  fs.rmSync(dossier, {recursive: true, force: true});
  fs.mkdirSync(dossier, {recursive: true});
  const police = path.join(REPO, 'Figtree-SemiBold.ttf');
  const parLigne = 6;
  const total = Math.ceil(images.length / parLigne) * parLigne;
  for (let i = 0; i < total; i++) {
    const v = path.join(dossier, String(i).padStart(3, '0') + '.png');
    if (i < images.length) {
      const texte = `${images[i].etiquette}  ${images[i].t.toFixed(2)} s`.replace(/:/g, '\\:').replace(/'/g, '’');
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', images[i].fichier, '-vf',
        `scale=360:640,drawbox=x=0:y=0:w=iw:h=34:color=black@0.7:t=fill,drawtext=fontfile=${police}:text='${texte}':x=8:y=8:fontsize=17:fontcolor=white`, v]);
    } else {
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=black:s=360x640', '-frames:v', '1', v]);
    }
  }
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '1', '-i', path.join(dossier, '%03d.png'), '-vf', `tile=${parLigne}x${total / parLigne}:padding=4:color=white`, '-frames:v', '1', cible]);
  return cible;
}

// ---------- son et formats ----------
function normaliserVolume(entree, cible, lufs, crete) {
  const mesure = spawnSync('ffmpeg', ['-hide_banner', '-i', entree, '-af', `loudnorm=I=${lufs}:TP=${crete}:LRA=11:print_format=json`, '-f', 'null', '-'], {encoding: 'utf8'});
  const json = JSON.parse(mesure.stderr.slice(mesure.stderr.lastIndexOf('{')));
  const filtre = `loudnorm=I=${lufs}:TP=${crete}:LRA=11:measured_I=${json.input_i}:measured_TP=${json.input_tp}:measured_LRA=${json.input_lra}:measured_thresh=${json.input_thresh}:offset=${json.target_offset}:linear=true`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', entree, '-c:v', 'copy', '-af', filtre, '-ar', '48000', '-c:a', 'aac', '-b:a', '256k', '-shortest', cible]);
  return parseFloat(json.input_i);
}

function incrusterPremiereVideo(projet, entree, cible, decalage = 0) {
  // Rendu exact de la première vidéo : on réutilise outils/sous_titres.py (libass).
  // decalage : début du passage rendu (option --images), pour que les sous-titres tombent au bon moment.
  const d = (x) => x - decalage;
  const groupes = projet.groupes.map((g) => ({debut: d(g.debut), fin: d(g.fin_affichage), texte: g.mots.map((m) => m.texte).join(' ')}))
    .filter((g) => g.fin > 0);
  const blocs = projet.sous_titres.phrases_fortes.map((b) => ({...b, debut: d(b.debut), fin: d(b.fin), lignes: b.lignes.map((l) => l.map((m) => ({...m, debut: d(m.debut)})))}))
    .filter((b) => b.fin > 0);
  const donnees = path.join(sortie, 'sous-titres.json');
  const ass = path.join(sortie, 'sous-titres.ass');
  fs.writeFileSync(donnees, JSON.stringify({groupes, blocs}));
  execFileSync('python3', ['-c', 'import sys, json; sys.path.insert(0, sys.argv[1]); import sous_titres as s; d = json.load(open(sys.argv[2])); open(sys.argv[3], "w").write(s.fichier_ass(d["groupes"], d["blocs"]))',
    path.join(REPO, 'outils'), donnees, ass]);
  const polices = path.join(sortie, 'polices');
  fs.mkdirSync(polices, {recursive: true});
  for (const f of fs.readdirSync(path.join(PUBLIC, 'polices'))) fs.copyFileSync(path.join(PUBLIC, 'polices', f), path.join(polices, f));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', entree, '-vf', `subtitles=${ass}:fontsdir=${polices}`, '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'copy', cible]);
}

// ---------- programme ----------
const debut = Date.now();
const {projet, charte} = preparer(cheminEffets);
const inputProps = {projet, charte};
console.log(`Projet : ${projet.duree.toFixed(2)} s à ${projet.fps} i/s, ${projet.effets.length} animations, ${projet.sons.length} sons.`);

console.log('Préparation du rendu (bundle)…');
const serveUrl = await bundle({entryPoint: path.join(MOTEUR, 'src', 'index.ts'), publicDir: PUBLIC});
const {navigateur, browserExecutable, chromeMode} = await ouvrirNavigateur();
const composition = await selectComposition({serveUrl, id: 'Montage', inputProps, puppeteerInstance: navigateur, browserExecutable, chromeMode});

if (!drapeau('--sans-stills')) {
  const dossierStills = path.join(sortie, `${nom}_stills`);
  fs.rmSync(dossierStills, {recursive: true, force: true});
  fs.mkdirSync(dossierStills, {recursive: true});
  // --instants 1.8,18,37.5 : seulement ces moments (contrôle rapide), sinon tous les instants de contrôle
  const choisis = option('--instants');
  const instants = choisis
    ? choisis.split(',').map((x) => ({t: Math.round(parseFloat(x) * projet.fps) / projet.fps, etiquette: 'choisi'}))
    : instantsDeControle(projet);
  console.log(`Images fixes de contrôle : ${instants.length}`);
  for (const [i, ins] of instants.entries()) {
    ins.fichier = path.join(dossierStills, `${String(i).padStart(2, '0')}_${ins.t.toFixed(2)}s.png`);
    await renderStill({composition, serveUrl, output: ins.fichier, frame: Math.round(ins.t * projet.fps), inputProps, puppeteerInstance: navigateur, browserExecutable, chromeMode});
  }
  console.log('Planche :', planche(instants, path.join(sortie, `${nom}_planche.png`)));
  fs.writeFileSync(path.join(dossierStills, 'instants.json'), JSON.stringify(instants, null, 1));
}

if (!drapeau('--stills-seulement')) {
  const brut = path.join(sortie, `${nom}_brut.mp4`);
  const plage = option('--images');
  console.log('Rendu Remotion…');
  let dernierPourcent = -1;
  await renderMedia({
    composition, serveUrl, codec: 'h264', outputLocation: brut, inputProps, puppeteerInstance: navigateur, browserExecutable, chromeMode,
    crf: charte.moteur.rendu.crf, audioBitrate: `${charte.moteur.rendu.audio_kbps}k`, imageFormat: 'jpeg', jpegQuality: 92,
    frameRange: plage ? plage.split('-').map(Number) : null,
    onProgress: ({progress}) => {
      const p = Math.floor(progress * 10) * 10;
      if (p !== dernierPourcent) { dernierPourcent = p; console.log(`  ${p} %`); }
    },
  });
  let avantSon = brut;
  if (projet.sous_titres.mode === 'premiere_video') {
    avantSon = path.join(sortie, `${nom}_soustitres.mp4`);
    incrusterPremiereVideo(projet, brut, avantSon, plage ? Number(plage.split('-')[0]) / projet.fps : 0);
  }
  const final = path.join(sortie, `${nom}_9x16.mp4`);
  const avant = normaliserVolume(avantSon, final, charte.moteur.rendu.loudness_lufs, charte.moteur.rendu.crete_dbtp);
  console.log(`Volume : ${avant.toFixed(1)} LUFS avant, ramené à ${charte.moteur.rendu.loudness_lufs} LUFS.`);
  console.log('Vidéo 9:16 :', final);
  if (!drapeau('--sans-4x5')) {
    const v45 = path.join(sortie, `${nom}_4x5.mp4`);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', final, '-vf', 'crop=1080:1350:0:285', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'copy', v45]);
    console.log('Vidéo 4:5  :', v45);
  }
}
await navigateur.close({silent: true});
console.log(`Terminé en ${((Date.now() - debut) / 1000).toFixed(0)} s.`);
