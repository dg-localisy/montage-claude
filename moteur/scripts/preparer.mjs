// Prépare un projet pour Remotion à partir de ma-charte.json et d'un fichier d'effets.
// Toute la logique (groupes de sous-titres, temps des animations, sons) est calculée ici,
// une seule fois : les composants React ne font que dessiner.
// Usage : node scripts/preparer.mjs chemin/vers/effets.json
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {genererSons} from './sons.mjs';

export const MOTEUR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = path.resolve(MOTEUR, '..');
export const PUBLIC = path.join(MOTEUR, 'public');

export function lireCharte() {
  return JSON.parse(fs.readFileSync(path.join(REPO, 'ma-charte.json'), 'utf8'));
}

// ---------- médias ----------
function relier(source, cible) {
  fs.mkdirSync(path.dirname(cible), {recursive: true});
  if (fs.existsSync(cible)) {
    const a = fs.statSync(source), b = fs.statSync(cible);
    if (a.size === b.size && a.mtimeMs <= b.mtimeMs) return;
    fs.rmSync(cible);
  }
  try {
    fs.linkSync(source, cible);
  } catch {
    fs.copyFileSync(source, cible);
  }
}

function dureeMedia(fichier) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', fichier], {encoding: 'utf8'});
  return parseFloat(r.stdout);
}

function fpsVideo(fichier) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', fichier], {encoding: 'utf8'});
  const [n, d] = r.stdout.trim().split('/').map(Number);
  return d ? n / d : n;
}

function normaliserMusique(source, cible, lufs) {
  const tampon = cible + '.source';
  if (fs.existsSync(cible) && fs.existsSync(tampon) && fs.readFileSync(tampon, 'utf8') === `${source}|${fs.statSync(source).mtimeMs}|${lufs}`) return;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', source, '-af', `loudnorm=I=${lufs}:TP=-2:LRA=11`, '-ar', '48000', '-ac', '2', cible]);
  fs.writeFileSync(tampon, `${source}|${fs.statSync(source).mtimeMs}|${lufs}`);
}

function copierPolices(charte) {
  const dossier = path.join(PUBLIC, 'polices');
  fs.mkdirSync(dossier, {recursive: true});
  for (const f of charte.polices.inventaire) {
    if (!f.variable) relier(path.join(REPO, charte.polices.dossier, f.fichier), path.join(dossier, f.fichier));
  }
}

// ---------- mots et sous-titres ----------
const PONCTUATION_SEULE = /^[!?;:.,…»«"“”]+$/;

function lireMots(fichier) {
  const brut = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  // accepte notre format [{mot, debut, fin}] ou celui d'ElevenLabs Scribe {words: [{text, start, end, type}]}
  const liste = Array.isArray(brut) ? brut : (brut.words || []).filter((w) => w.type === 'word').map((w) => ({mot: w.text, debut: w.start, fin: w.end}));
  const mots = [];
  for (const m of liste) {
    const texte = String(m.mot).trim();
    if (!texte) continue;
    if (PONCTUATION_SEULE.test(texte) && mots.length) {
      const p = mots[mots.length - 1];
      p.texte += ' ' + texte; // « recommande ! » : espace avant la ponctuation haute, à la française
      p.fin = Math.max(p.fin, m.fin);
      continue;
    }
    mots.push({texte, debut: m.debut, fin: m.fin});
  }
  return mots;
}

function normaliser(mot) {
  return mot.normalize('NFC').toLowerCase().replace(/[’]/g, "'").replace(/[!?;:.,…»«"“”]/g, '').trim();
}

function corriger(mots, charte) {
  for (const regle of charte.mots_a_corriger || []) {
    const variantes = new Set([regle.forme_correcte, ...regle.remplacer_automatiquement].map(normaliser));
    for (const m of mots) {
      const coeur = m.texte.replace(/[!?;:.,…»«"“”\s]+$/g, '');
      if (variantes.has(normaliser(coeur))) m.texte = regle.forme_correcte + m.texte.slice(coeur.length);
    }
  }
  return mots;
}

export function construireGroupes(mots, regles) {
  const groupes = [];
  let courant = [];
  const texte = (liste) => liste.map((m) => m.texte).join(' ');
  const pousser = () => {
    if (courant.length) groupes.push({mots: courant, debut: courant[0].debut, fin: courant[courant.length - 1].fin});
    courant = [];
  };
  for (const m of mots) {
    if (courant.length) {
      const dernier = courant[courant.length - 1];
      if (courant.length >= regles.max_mots || texte([...courant, m]).length > regles.max_caracteres || m.debut - dernier.fin > regles.pause_coupure_s) pousser();
    }
    courant.push(m);
    if (/[.,!?;:…]$/.test(m.texte)) pousser();
  }
  pousser();
  groupes.forEach((g, i) => {
    const suivant = groupes[i + 1];
    g.fin_affichage = Math.min(suivant ? suivant.debut : Infinity, g.fin + regles.maintien_apres_s);
  });
  return groupes;
}

// ---------- temps des animations (partagés avec les composants via e._t) ----------
function decouperTitre(titre, maxMots = 3, maxCar = 13) {
  const lignes = [];
  let ligne = [];
  for (const mot of titre.split(/\s+/).filter(Boolean)) {
    const essai = [...ligne, mot].join(' ');
    if (ligne.length && (ligne.length >= maxMots || essai.length > maxCar)) {
      lignes.push(ligne.join(' '));
      ligne = [];
    }
    ligne.push(mot);
  }
  if (ligne.length) lignes.push(ligne.join(' '));
  return lignes.slice(0, 3);
}

function calculerTemps(e, M) {
  const t = {};
  if (e.type === 'accroche') {
    const presentation = e.variante === 'presentation';
    t.lignes = decouperTitre(e.titre.toUpperCase(), 3, presentation ? 18 : 13);
    t.titre = e.debut + M.accroche.delai_titre_s;
    t.vitesse = M.accroche.lettres_par_s * (presentation ? 1.25 : 1);
    const n = t.lignes.join(' ').length;
    t.finFrappe = t.titre + n / t.vitesse;
  }
  if (e.type === 'chiffre') {
    t.comptage = [e.debut + 0.1, e.debut + 0.1 + (e.duree_comptage ?? M.chiffre.duree_comptage_s)];
  }
  if (e.type === 'carte') {
    const p = e.debut + M.carte.debut_panneau_s;
    t.panneau = p;
    if (e.animation === 'chat_ia') {
      const c = M.chat;
      t.frappe = p + c.delai_frappe_s;
      t.finFrappe = t.frappe + e.message.length / c.lettres_par_s;
      t.envoi = t.finFrappe + c.pause_avant_envoi_s;
      t.points = [t.envoi + 0.2, t.envoi + 0.2 + c.attente_reponse_s];
      t.reponse = t.points[1];
      t.finReponse = t.reponse + e.reponse.split(/\s+/).length / c.mots_par_s;
    }
    if (e.animation === 'checklist') {
      t.coches = e.items.map((_, i) => (e.coches && e.coches[i] !== undefined ? e.coches[i] : p + M.checklist.premier_coche_s + i * M.checklist.intervalle_s));
    }
    if (e.animation === 'entonnoir') {
      t.etapes = e.etapes.map((_, i) => (e.temps_etapes && e.temps_etapes[i] !== undefined ? e.temps_etapes[i] : p + 0.2 + i * M.entonnoir.intervalle_s));
    }
    if (e.animation === 'gros_chiffre') {
      t.comptage = [p + 0.25, p + 0.25 + (e.duree_comptage ?? 1.2)];
    }
  }
  return t;
}

// ---------- sons ----------
function sonsPour(e, M) {
  const v = M.sons.volumes;
  const s = (nom, debut, facteur = 1) => ({fichier: `sons/${nom}.wav`, debut: Math.max(0, debut), volume: +(v[nom] * facteur).toFixed(3), effet: e.type});
  const t = e._t || {};
  switch (e.type) {
    case 'accroche': return e.variante === 'presentation' ? [s('whoosh', e.debut, 0.6), s('pop', t.finFrappe, 0.6)] : [s('whoosh', e.debut), s('scintillement', t.finFrappe)];
    case 'signature': return [s('scintillement', e.debut, 0.6)];
    case 'grand_titre': return [s('montee', e.debut - 0.7), s('impact', e.debut + 0.12)];
    case 'icone': return [s('pop', e.debut), s('scintillement', e.debut + 0.1)];
    case 'chiffre': return [s('montee', t.comptage[0] - 0.2, 0.8), s('impact', t.comptage[1], 0.6)];
    case 'zoom': return [s('whoosh', e.debut - 0.05, 0.7)];
    case 'transition': return e.style === 'lumiere' ? [s('whoosh', e.debut - 0.3), s('scintillement', e.debut - 0.05, 0.8)] : [s('whoosh', e.debut - 0.25, 1.2)];
    case 'carte_fin': return [s('impact', e.debut, 0.7), s('scintillement', e.debut + 0.25)];
    case 'carte': {
      const liste = [s('whoosh', e.debut), s('whoosh', e.fin - (M.carte.duree_reduction_s + 0.05), 0.8)];
      if (e.animation === 'chat_ia') {
        for (let i = 0; i < e.message.length; i += 2) liste.push(s('frappe', t.frappe + i / M.chat.lettres_par_s));
        liste.push(s('pop', t.envoi), s('pop', t.reponse, 0.9));
      }
      if (e.animation === 'checklist') t.coches.forEach((c) => liste.push(s('pop', c, 0.9)));
      if (e.animation === 'entonnoir') t.etapes.forEach((c) => liste.push(s('pop', c, 0.6)));
      if (e.animation === 'gros_chiffre') liste.push(...(e.texte ? [s('pop', t.comptage[0], 0.9)] : [s('montee', t.comptage[0] - 0.2, 0.7), s('impact', t.comptage[1], 0.7)]));
      return liste;
    }
    default: return [];
  }
}

// ---------- projet complet ----------
export function preparer(cheminEffets) {
  const charte = lireCharte();
  const M = charte.moteur;
  const effetsJson = JSON.parse(fs.readFileSync(cheminEffets, 'utf8'));
  const base = path.dirname(path.resolve(cheminEffets));
  const chemin = (p) => path.resolve(base, p);

  copierPolices(charte);
  genererSons(path.join(PUBLIC, 'sons'));

  const rush = effetsJson.rush;
  const videoSource = chemin(rush.video);
  relier(videoSource, path.join(PUBLIC, 'media', 'rush' + path.extname(videoSource)));
  let voix = null;
  if (rush.voix) {
    const v = chemin(rush.voix);
    voix = 'media/voix' + path.extname(v);
    relier(v, path.join(PUBLIC, voix));
  }
  let musique = null;
  if (effetsJson.musique && effetsJson.musique.actif !== false && effetsJson.musique.fichier) {
    normaliserMusique(chemin(effetsJson.musique.fichier), path.join(PUBLIC, 'media', 'musique.wav'), M.musique.normalisation_lufs);
    musique = {fichier: 'media/musique.wav', ...M.musique, ...(effetsJson.musique.reglages || {})};
  }

  const fps = effetsJson.fps || Math.round(fpsVideo(videoSource)) || 30;
  const duree = effetsJson.duree || dureeMedia(videoSource);
  const st = {...M.sous_titres, ...(effetsJson.sous_titres || {})};
  const mots = corriger(lireMots(chemin(rush.mots)), charte);
  const cles = new Set((st.mots_cles || []).map(normaliser));
  for (const m of mots) m.cle = cles.has(normaliser(m.texte));
  const groupes = construireGroupes(mots, st);

  const effets = (effetsJson.effets || []).map((e, i) => ({id: i, ...e}));
  // la première accroche ouvre la vidéo ; les suivantes (ex. le nom) sont plus discrètes
  const accroches = effets.filter((e) => e.type === 'accroche').sort((a, b) => a.debut - b.debut);
  accroches.forEach((e, i) => { e.variante = e.style || (i === 0 ? 'ouverture' : 'presentation'); });
  // signature de fin (charte → fin.signature) : par défaut sur les dernières secondes
  for (const e of effets.filter((x) => x.type === 'signature')) {
    e.debut = e.debut ?? duree - charte.fin.signature.duree_s;
    e.fin = e.fin ?? duree;
  }
  for (const e of effets) e._t = calculerTemps(e, M);

  const cam = effetsJson.camera || {};
  const camera = {
    visage: cam.visage || M.camera.visage_par_defaut,
    coupes: [...(cam.coupes || [])].sort((a, b) => a - b),
    cadrages: cam.cadrages || M.camera.cadrages,
    decalages_x: cam.decalages_x || M.camera.decalages_x,
    avancee: cam.avancee ?? M.camera.avancee_par_plan,
    zooms: effets.filter((e) => e.type === 'zoom').map((e) => ({debut: e.debut, fin: e.fin, a: e.a ?? 1.25, duree: e.duree ?? M.camera.zoom_duree_s})),
  };
  const transitions = effets.filter((e) => e.type === 'transition').map((e) => ({...e, duree: e.duree ?? M.transitions.duree_s}));

  const sons = [];
  for (const e of effets) if (e.son !== false) sons.push(...sonsPour(e, M));

  const amb = effetsJson.ambiance || {};
  const projet = {
    fps, duree, largeur: 1080, hauteur: 1920,
    rush: {video: 'media/rush' + path.extname(videoSource), voix},
    musique, mots, groupes,
    sous_titres: {mode: st.mode || st.mode_par_defaut, masquer_pendant: st.masquer_pendant, phrases_fortes: st.phrases_fortes || []},
    camera, transitions,
    effets: effets.filter((e) => !['zoom', 'transition'].includes(e.type)),
    chapitres: (amb.chapitres || []).map((c, i, l) => ({...c, fin: l[i + 1] ? l[i + 1].debut : duree})),
    ambiance: {grain: amb.grain ?? M.ambiance.grain_opacite, vignette: amb.vignette ?? M.ambiance.vignette, etalonnage: amb.etalonnage !== false},
    sons: sons.filter((s) => s.debut < duree),
  };
  fs.mkdirSync(PUBLIC, {recursive: true});
  fs.writeFileSync(path.join(PUBLIC, 'projet.json'), JSON.stringify({projet, charte}, null, 1));
  return {projet, charte};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) {
    console.error('Usage : node scripts/preparer.mjs chemin/vers/effets.json');
    process.exit(1);
  }
  const {projet} = preparer(process.argv[2]);
  console.log(`Projet prêt : ${projet.duree.toFixed(2)} s, ${projet.groupes.length} groupes de sous-titres, ${projet.effets.length} animations, ${projet.sons.length} sons.`);
}
