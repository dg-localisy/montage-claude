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

// logos de la marque (dossier marque/ du dépôt) → public/marque/, comme les polices
function copierMarque(charte) {
  const fichiers = new Set(Object.values(charte.marque?.logo?.fichiers || {}).filter((f) => String(f).endsWith('.png')));
  if (charte.fin?.signature?.fichier) fichiers.add(charte.fin.signature.fichier);
  for (const f of fichiers) {
    const source = path.join(REPO, f);
    if (fs.existsSync(source)) relier(source, path.join(PUBLIC, f));
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

// Phrases fortes (sous-titres « première vidéo ») : chaque élément prend le temps où son premier mot est prononcé.
// Il suffit d'écrire les lignes et les rôles dans effets.json ; « debut » du bloc = un peu avant son premier mot.
function calerPhrasesFortes(blocs, mots) {
  return blocs.map((b) => {
    // premier mot : celui qui correspond au début du bloc, le plus proche du temps indiqué
    const premierMot = normaliser(b.lignes[0][0].mot.trim().split(/\s+/)[0]);
    let k = -1;
    mots.forEach((m, i) => {
      if (normaliser(m.texte) === premierMot && Math.abs(m.debut - b.debut) < 1.5 && (k < 0 || Math.abs(m.debut - b.debut) < Math.abs(mots[k].debut - b.debut))) k = i;
    });
    if (k < 0) k = mots.findIndex((m) => m.debut >= b.debut - 0.15);
    const k0 = k;
    const lignes = b.lignes.map((ligne) => ligne.map((item) => {
      const n = item.mot.trim().split(/\s+/).length;
      const premier = mots[k];
      if (!premier || normaliser(premier.texte) !== normaliser(item.mot.trim().split(/\s+/)[0])) {
        console.warn(`Phrase forte à ${b.debut} s : « ${item.mot} » ne correspond pas au mot prononcé « ${premier ? premier.texte : '?'} ».`);
      }
      const debut = item.debut ?? (premier ? premier.debut : b.debut);
      if (k >= 0) k += n;
      return {...item, debut};
    }));
    const dernier = k > 0 ? mots[k - 1] : null;
    // le bloc reste affiché jusqu'au mot suivant (au plus 0,45 s après son dernier mot), comme dans la vidéo INCENDIE
    const suivant = mots[k];
    const fin = b.fin ?? Math.min(dernier ? dernier.fin + 0.45 : b.debut + 2, suivant ? suivant.debut - 0.02 : Infinity);
    const ids = mots.slice(Math.max(0, k0), Math.max(0, k)).map((m) => m.id);
    return {...b, debut: lignes[0][0].debut, lignes, fin, ids};
  });
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

// Texte écrit au rythme de la voix (pages, mot souligné…) : chaque mot prend le temps où il est prononcé.
// On avance dans les mots dits entre a et b ; un mot écrit qui n'a pas été dit tel quel prend le temps du précédent.
function calerTexte(texte, mots, a, b, depart = {i: -1}, fenetre = 8) {
  const ecrits = texte.trim().split(/\s+/).filter(Boolean);
  // on part du premier mot dit après a (ou de là où le texte précédent s'est arrêté)
  if (depart.i < 0 || mots[depart.i]?.debut < a - 0.01) {
    const k = mots.findIndex((m) => m.debut >= a);
    depart.i = (k < 0 ? mots.length : k) - 1;
  }
  let dernier = a;
  return ecrits.map((mot) => {
    const cible = normaliser(mot);
    for (let j = depart.i + 1; j < mots.length && mots[j].debut <= b && j - depart.i <= fenetre; j++) {
      if (normaliser(mots[j].texte) === cible) {
        depart.i = j;
        dernier = mots[j].debut;
        return {mot, debut: dernier};
      }
    }
    return {mot, debut: dernier};
  });
}

function calculerTemps(e, M, mots = []) {
  const t = {};
  // pages plein écran (claire ou sombre) : les éléments texte s'écrivent au rythme de la voix
  if (e.type === 'page') {
    const depart = {i: -1};
    const elements = (e.elements || []).map((el) => ({...el}));
    for (const el of elements) {
      if (el.texte && el.type !== 'etiquette') {
        el.mots = el.temps !== undefined
          ? el.texte.split(/\s+/).map((mot, k) => ({mot, debut: el.temps + k * 0.08}))
          : calerTexte(el.texte, mots, e.debut - 0.4, e.fin + 0.3, depart);
        el.debut = el.mots[0].debut;
      }
    }
    // éléments sans texte : l'image arrive tout de suite (du flou au net), le « vs » juste avant l'élément suivant
    elements.forEach((el, k) => {
      if (el.debut !== undefined) return;
      const suivant = elements.slice(k + 1).find((x) => x.debut !== undefined);
      if (el.type === 'image' || el.type === 'etiquette') el.debut = el.temps ?? e.debut + 0.05;
      else el.debut = el.temps ?? (suivant ? suivant.debut - 0.35 : e.debut + 0.3);
    });
    t.elements = elements;
  }
  if (e.type === 'titre_empile') {
    // chaque ligne s'écrit mot à mot au rythme de la voix (temps imposé possible par ligne)
    const depart = {i: -1};
    t.lignes = e.lignes.map((l) => ({...l, mots: l.temps !== undefined ? l.texte.split(/\s+/).map((mot, k) => ({mot, debut: l.temps + k * 0.08})) : calerTexte(l.texte, mots, e.debut - 0.4, e.fin + 0.3, depart)}));
  }
  if (e.type === 'barre_recherche') {
    // le texte se tape entre le premier et le dernier mot dit
    const cale = calerTexte(e.texte, mots, e.debut - 0.3, e.fin + 0.3, {i: -1}, Infinity);
    t.frappe = e.frappe ?? cale[0].debut;
    t.finFrappe = e.fin_frappe ?? Math.max(t.frappe + 0.5, cale[cale.length - 1].debut + 0.3);
  }
  if (e.type === 'barres_comparees') {
    t.lignes = e.lignes.map((l, i) => l.temps ?? e.debut + 0.25 + 0.35 * i);
  }
  if (e.type === 'etiquettes_flottantes') {
    // chaque étiquette arrive quand son premier mot est dit (dans l'ordre)
    const depart = {i: -1};
    t.items = e.items.map((it, i) => {
      if (e.temps && e.temps[i] !== undefined) return e.temps[i];
      const texte = typeof it === 'string' ? it : it.texte;
      return calerTexte(texte.split(/\s+/)[0], mots, e.debut - 0.3, e.fin, depart, Infinity)[0].debut;
    });
  }
  if (e.type === 'mot_souligne') {
    t.mot = e.temps ?? calerTexte(e.mot.split(/\s+/)[0], mots, e.debut - 0.3, e.fin, {i: -1}, Infinity)[0].debut;
    if (e.ensuite) t.ensuite = e.ensuite.temps ?? calerTexte(e.ensuite.mot.split(/\s+/)[0], mots, t.mot + 0.1, e.fin, {i: -1}, Infinity)[0].debut;
  }
  if (e.type === 'accroche') {
    const presentation = e.variante === 'presentation';
    t.lignes = decouperTitre(e.titre.toUpperCase(), 3, presentation ? 18 : 13);
    t.titre = e.debut + M.accroche.delai_titre_s;
    t.vitesse = M.accroche.lettres_par_s * (presentation ? 1.25 : 1);
    const n = t.lignes.join(' ').length;
    t.finFrappe = t.titre + n / t.vitesse;
  }
  if (e.type === 'texte_derriere') {
    // les lettres apparaissent une à une (comme « YES » dans la vidéo de référence)
    const T = M.texte_derriere;
    const n = e.texte.replace(/\s/g, '').length;
    t.lettres = Array.from({length: n}, (_, i) => e.debut + i * (e.intervalle ?? T.intervalle_lettres_s));
  }
  if (e.type === 'carte_verre' || e.type === 'frise' || e.type === 'bilan') {
    t.items = e.items.map((_, i) => (e.temps && e.temps[i] !== undefined ? e.temps[i] : e.debut + 0.4 + i * 0.8));
  }
  if (e.type === 'titre_bandeau') {
    t.lignes = e.lignes || decouperTitre(e.titre.toUpperCase(), 3, e.variante === 'nom' ? 22 : 13);
  }
  if (e.type === 'compteur') {
    t.comptage = [e.debut + 0.15, e.debut + 0.15 + (e.duree_comptage ?? M.etiquettes.duree_comptage_s)];
  }
  if (e.type === 'ecran_chat') {
    // la question se tape assez vite pour laisser au moins reflexion_min_s à l'assistant qui « réfléchit »
    const c = M.ecran_chat;
    t.frappe = e.debut + c.delai_frappe_s;
    const dispo = Math.max(0.5, e.fin - e.debut - c.delai_frappe_s - c.pause_avant_envoi_s - c.reflexion_min_s);
    t.vitesse = Math.max(c.lettres_par_s, e.question.length / dispo);
    t.finFrappe = t.frappe + e.question.length / t.vitesse;
    t.envoi = t.finFrappe + c.pause_avant_envoi_s;
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
  // son d'entrée choisi pour cette animation (« son_entree », ex. un son fourni par l'utilisateur), sinon le son par défaut
  const entree = (defaut, avance) => (e.son_entree ? s(e.son_entree, e.debut - ((M.sons.fournis || {})[e.son_entree]?.avance_s ?? 0.15)) : s(defaut, e.debut - avance));
  // Bruitages brefs et doux (demande de l'utilisateur) : woutch pour les entrées, mini-woutch pour les petits
  // éléments, toc feutré pour les coches. Aucun son sur les zooms.
  switch (e.type) {
    case 'accroche': return e.variante === 'presentation' ? [s('woutch_grave', e.debut, 0.8)] : [s('woutch', e.debut)];
    case 'signature': return [s('woutch_court', e.debut, 0.6)];
    case 'grand_titre': return [s('woutch', e.debut - 0.12)];
    case 'icone': return [s('woutch_court', e.debut)];
    case 'chiffre': return [s('woutch_court', t.comptage[0])];
    case 'liste': return e.temps.map((c) => s('pop_doux', c));
    case 'plan_de_coupe': return [entree('swoosh', 0.18)];
    // écran ChatGPT : il arrive (swoosh), quelques frappes de clavier très douces pendant la saisie, clic de souris sur « envoyer »
    case 'ecran_chat': return [entree('swoosh', 0.12),
      ...Array.from({length: Math.floor(e.question.length / 3)}, (_, i) => s('frappe', t.frappe + (3 * i) / t.vitesse, i % 2 ? 0.6 : 0.9)),
      s('clic', t.envoi - 0.04)];
    // l'accroche principale monte avec un riser qui s'arrête net quand le chiffre tombe (« ×3 »), puis un coup sourd
    case 'texte_derriere': return e.riser ? [s(typeof e.riser === 'string' ? e.riser : 'riser', e.debut - (e.riser_duree ?? M.sons.riser_duree_s)), s('chute', e.debut)] : [e.entree === 'montee' ? s('woutch_grave', e.debut) : s('impact_doux', e.debut)];
    case 'carte_verre': return [s('woutch_grave', e.debut - 0.05), ...t.items.map((c) => s('tap', c, 0.8))];
    // courbe derrière la tête : le riser accompagne le tracé et s'arrête net quand le résultat (« ×2 ») surgit, puis coup sourd
    case 'courbe_derriere': return e.riser ? [s(typeof e.riser === 'string' ? e.riser : 'riser', e.cle - (e.riser_duree ?? M.sons.riser_duree_s)), s('chute', e.cle)] : [s('impact_doux', e.cle)];
    // famille « étiquettes » : d'autres sons que les cartes en verre et les pastilles, pour varier
    case 'titre_bandeau': return e.variante === 'nom' ? [s('woutch_grave', e.debut, 0.8)] : [s('woutch', e.debut)];
    case 'compteur': return [s('woutch_court', e.debut), s('tap', t.comptage[1], 0.7)];
    case 'frise': return [s('woutch_grave', e.debut - 0.05), ...t.items.map((c) => s('pop_doux', c, 0.9))];
    case 'bilan': return [...t.items.map((c) => s('tap', c, 0.8)), ...(e.barrer ? [s('woutch_court', e.barrer.temps, 0.8)] : [])];
    // pages plein écran : entrée avec un bruit de transition (son_entree pour un son fourni), petit toc quand le mot clé ou le « vs » arrive
    case 'page': return [entree('swoosh', 0.1), ...t.elements.filter((el) => el.type === 'cle' || el.type === 'vs' || el.type === 'appel').map((el) => s('tap', el.debut, 0.7))];
    case 'etiquettes_flottantes': return t.items.map((c) => s('tap', c, 0.55));
    case 'titre_empile': return t.lignes.filter((l) => l.style === 'grand' || l.style === 'evidence').map((l) => s('woutch_court', l.mots[0].debut, 0.8));
    case 'barre_recherche': return [s('woutch_grave', e.debut, 0.8), ...Array.from({length: Math.floor(e.texte.length / 2)}, (_, i) => s('frappe', t.frappe + (2 * i / e.texte.length) * (t.finFrappe - t.frappe), i % 2 ? 0.6 : 0.9)), s('clic', t.finFrappe + 0.05)];
    case 'barres_comparees': return [...t.lignes.map((c) => s('tap', c, 0.7)), s('woutch_court', e.cle, 0.9)];
    case 'mot_souligne': return [s('woutch_court', t.mot, 0.8), ...(e.ensuite ? [s('woutch_court', t.ensuite, 0.7)] : [])];
    case 'zoom': return []; // pas de bruitage sur les zooms (demande de l'utilisateur)
    case 'transition': return [entree('woutch', 0.13)];
    case 'carte_fin': return [s('woutch', e.debut)];
    case 'carte': {
      const liste = [s('woutch', e.debut), s('woutch', e.fin - (M.carte.duree_reduction_s + 0.05), 0.8)];
      if (e.animation === 'chat_ia') {
        for (let i = 0; i < e.message.length; i += 2) liste.push(s('frappe', t.frappe + i / M.chat.lettres_par_s));
        liste.push(s('tap', t.envoi), s('tap', t.reponse, 0.9));
      }
      if (e.animation === 'checklist') t.coches.forEach((c) => liste.push(s('tap', c)));
      if (e.animation === 'entonnoir') t.etapes.forEach((c) => liste.push(s('tap', c, 0.8)));
      if (e.animation === 'gros_chiffre') liste.push(s('tap', t.comptage[0]));
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
  copierMarque(charte);
  genererSons(path.join(PUBLIC, 'sons'), false, M.sons.fournis, REPO);

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
  mots.forEach((m, i) => { m.id = i; m.cle = cles.has(normaliser(m.texte)); });
  const effets = (effetsJson.effets || []).map((e, i) => ({id: i, ...e}));
  // Mode « première vidéo » : pas de doublon. Les mots d'une phrase forte, ou déjà affichés par une animation
  // (titre, chiffre, texte derrière la tête, carte, pastilles), ne sont pas répétés dans les sous-titres normaux.
  //   remplace : ["mot", …] retirés s'ils sont prononcés pendant l'animation (ou jusqu'à 0,6 s avant) ;
  //   remplace_temps : [[debut, fin], …] tous les mots prononcés dans ces intervalles sont retirés.
  for (const e of effets.filter((x) => x.type === 'page')) e.remplace_temps = [...(e.remplace_temps || []), [e.debut - 0.05, e.fin]];
  const pages = effets.filter((x) => x.type === 'page');
  const phrasesFortes = calerPhrasesFortes(st.phrases_fortes || [], mots).filter((b) => {
    const cachee = pages.some((p) => b.debut < p.fin && b.fin > p.debut);
    if (cachee) console.warn(`Phrase forte à ${b.debut.toFixed(2)} s retirée : elle tombe pendant une page plein écran.`);
    return !cachee;
  });
  const remplaces = effets.filter((e) => e.remplace).flatMap((e) => e.remplace.flatMap((r) => r.split(/\s+/)).map((r) => ({debut: e.debut - 0.6, fin: e.fin + 0.1, mot: normaliser(r)})));
  const intervalles = effets.filter((e) => e.remplace_temps).flatMap((e) => e.remplace_temps);
  const dansUnBloc = new Set(phrasesFortes.flatMap((b) => b.ids));
  const masque = (m) => dansUnBloc.has(m.id)
    || remplaces.some((r) => normaliser(m.texte) === r.mot && m.debut >= r.debut && m.debut <= r.fin)
    || intervalles.some(([a, z]) => m.debut >= a && m.debut < z);
  const premiereVideo = (st.mode || st.mode_par_defaut) === 'premiere_video';
  const groupes = construireGroupes(premiereVideo ? mots.filter((m) => !masque(m)) : mots, st);
  // un sous-titre normal s'efface quand une phrase forte commence (jamais les deux en même temps)
  if (premiereVideo) for (const g of groups()) for (const b of phrasesFortes) if (b.debut > g.debut) g.fin_affichage = Math.min(g.fin_affichage, b.debut);
  // ni quand une animation commence à afficher les mots suivants à sa place (ex. le nom de la présentation, posé sur la ligne des sous-titres)
  if (premiereVideo) {
    const arrets = [...intervalles.map(([a]) => a), ...mots.filter(masque).map((m) => m.debut)];
    for (const g of groupes) for (const a of arrets) if (a > g.debut) g.fin_affichage = Math.min(g.fin_affichage, a);
  }
  function groups() { return groupes; }

  // la première accroche ouvre la vidéo ; les suivantes (ex. le nom) sont plus discrètes
  const accroches = effets.filter((e) => e.type === 'accroche').sort((a, b) => a.debut - b.debut);
  accroches.forEach((e, i) => { e.variante = e.style || (i === 0 ? 'ouverture' : 'presentation'); });
  // signature de fin (charte → fin.signature) : par défaut sur les dernières secondes
  for (const e of effets.filter((x) => x.type === 'signature')) {
    e.debut = e.debut ?? duree - charte.fin.signature.duree_s;
    e.fin = e.fin ?? duree;
  }
  // icône liée à un mot (« mot ») : dessinée juste au-dessus de ce mot dans les sous-titres,
  // (elle reste à sa place si la ligne de sous-titres change avant sa fin)
  for (const e of effets.filter((x) => x.type === 'icone' && x.mot)) {
    const cible = normaliser(e.mot);
    const candidats = mots.filter((m) => normaliser(m.texte) === cible);
    const m = candidats.sort((a, b) => Math.abs(a.debut - e.debut) - Math.abs(b.debut - e.debut))[0];
    if (!m || Math.abs(m.debut - e.debut) > 2) {
      console.warn(`Icône « ${e.icone} » : mot « ${e.mot} » introuvable près de ${e.debut} s, icône posée librement.`);
      continue;
    }
    e.mot_id = m.id;
    e.debut = Math.max(e.debut, m.debut - 0.05);
  }
  // masques de détourage (outils/detourage.py) : pour redessiner la personne devant un texte derrière la tête
  let masques = null;
  if (effetsJson.camera && effetsJson.camera.masques) {
    const dossier = chemin(effetsJson.camera.masques);
    for (const f of fs.readdirSync(dossier)) if (f.endsWith('.png')) relier(path.join(dossier, f), path.join(PUBLIC, 'masques', f));
    masques = 'masques';
  }
  // plan de coupe : la vidéo est copiée dans public/media
  for (const e of effets.filter((x) => x.type === 'plan_de_coupe')) {
    const f = chemin(e.fichier);
    e.src = `media/plan_${e.id}${path.extname(f)}`;
    relier(f, path.join(PUBLIC, e.src));
  }
  for (const e of effets.filter((x) => x.type === 'page')) {
    (e.elements || []).forEach((el, k) => {
      if (el.type !== 'image' || !el.fichier) return;
      const f = chemin(el.fichier);
      el.src = `media/page_${e.id}_${k}${path.extname(f)}`;
      relier(f, path.join(PUBLIC, el.src));
    });
  }
  for (const e of effets) e._t = calculerTemps(e, M, mots);

  const cam = effetsJson.camera || {};
  const camera = {
    visage: cam.visage || M.camera.visage_par_defaut,
    coupes: [...(cam.coupes || [])].sort((a, b) => a - b),
    cadrages: cam.cadrages || M.camera.cadrages,
    decalages_x: cam.decalages_x || M.camera.decalages_x,
    avancee: cam.avancee ?? M.camera.avancee_par_plan,
    masques,
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
    sous_titres: {mode: st.mode || st.mode_par_defaut, masquer_pendant: st.masquer_pendant, phrases_fortes: phrasesFortes},
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
