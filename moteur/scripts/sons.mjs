// Génère les effets sonores du moteur avec ffmpeg (aucun fichier externe).
// Usage : node scripts/sons.mjs [dossier]   (par défaut : public/sons)
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SR = 48000;

function ffmpeg(args) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], {stdio: ['ignore', 'ignore', 'pipe']});
}

// montée exponentielle d'une fréquence de filtre (commande toutes les 20 ms), pour le riser
function montee(duree, f0, f1, cible) {
  const cmds = [];
  for (let t = 0; t <= duree; t += 0.02) cmds.push(`${t.toFixed(2)} ${cible} frequency ${Math.round(f0 * Math.pow(f1 / f0, t / duree))}`);
  return cmds.join(';');
}

// balayage d'un filtre passe-bande (commande envoyée toutes les 20 ms)
function balayage(duree, f0, fmax, f1) {
  const cmds = [];
  for (let t = 0; t <= duree; t += 0.02) {
    const p = t / duree;
    const f = p < 0.55 ? f0 + (fmax - f0) * Math.sin((p / 0.55) * Math.PI / 2) : fmax + (f1 - fmax) * ((p - 0.55) / 0.45);
    cmds.push(`${t.toFixed(2)} bandpass@b frequency ${Math.round(f)}`);
  }
  return cmds.join(';');
}

const RECETTES = {
  // riser : souffle qui monte vers l'aigu + ton qui grimpe, de plus en plus fort, puis arrêt net (accroche)
  riser: (d = 2.0) => ['-f', 'lavfi', '-i', `anoisesrc=c=pink:r=${SR}:d=${d}:a=0.7:seed=3`,
    '-f', 'lavfi', '-i', `aevalsrc='(0.5*sin(2*PI*(110*t+(700-110)/(2*${d})*t*t))+0.25*sin(2*PI*(220*t+(1400-220)/(2*${d})*t*t)))*pow(t/${d},2)':s=${SR}:d=${d}`,
    '-filter_complex', `[0:a]asendcmd=c='${montee(d, 250, 7000, 'highpass@h')}',highpass@h=f=250,lowpass=f=11000,afade=t=in:d=${d}:curve=exp[s];` +
      `[1:a]tremolo=f=12:d=0.35,lowpass=f=3000[o];[s][o]amix=inputs=2:duration=longest:normalize=0,afade=t=out:st=${(d - 0.025).toFixed(3)}:d=0.025[r]`,
    '-map', '[r]'],
  // riser_aspire : autre riser (Cheminées Liégeois) : souffle aérien qui gonfle de plus en plus vite (comme une cymbale à l'envers)
  // et accord doux qui monte dessous ; arrêt net au moment où le mot tombe (effet « reverse »), différent du riser cinématique
  riser_aspire: (d = 1.6) => ['-f', 'lavfi', '-i', `anoisesrc=c=white:r=${SR}:d=${d}:a=0.6:seed=23`,
    '-f', 'lavfi', '-i', `aevalsrc='(0.45*sin(2*PI*220*t)+0.35*sin(2*PI*329.6*t)+0.25*sin(2*PI*440*t)+0.12*sin(2*PI*659.3*t))*exp(4.2*(t-${d}))':s=${SR}:d=${d}`,
    '-filter_complex', `[0:a]highpass=f=1800,lowpass=f=8500,volume='exp(5.2*(t-${d}))':eval=frame[n];[1:a]lowpass=f=2500,volume=0.8[o];` +
      `[n][o]amix=inputs=2:normalize=0,aecho=0.8:0.45:35|80:0.25|0.15,afade=t=out:st=${(d - 0.012).toFixed(3)}:d=0.012[r]`,
    '-map', '[r]'],
  // riser_aspire_court : le riser « aspiré » de Cheminées en 0,85 s, pour un résultat dit dans la première seconde (DS Cleaning)
  riser_aspire_court: () => RECETTES.riser_aspire(0.85),
  // riser_pulsations : troisième riser : pulsations graves et feutrées qui accélèrent (4 → 18 par seconde) en montant
  // doucement de hauteur, avec un souffle qui s'ouvre vers l'aigu ; arrêt net quand le mot tombe
  riser_pulsations: (d = 1.7) => ['-f', 'lavfi', '-i',
    `aevalsrc='(sin(2*PI*(110*t+${(130 / (2 * d)).toFixed(3)}*t*t))+0.35*sin(4*PI*(110*t+${(130 / (2 * d)).toFixed(3)}*t*t)))*exp(-14*mod(${(4 * d / Math.log(4.5)).toFixed(4)}*(pow(4.5,t/${d})-1),1))*(0.06+0.94*pow(t/${d},1.6))':s=${SR}:d=${d}`,
    '-f', 'lavfi', '-i', `anoisesrc=c=pink:r=${SR}:d=${d}:a=0.5:seed=29`,
    '-filter_complex', `[0:a]lowpass=f=1400[p];[1:a]asendcmd=c='${montee(d, 300, 6000, 'highpass@h')}',highpass@h=f=300,lowpass=f=9000,afade=t=in:d=${d}:curve=exp,volume=1.3[s];` +
      `[p][s]amix=inputs=2:normalize=0,afade=t=out:st=${(d - 0.012).toFixed(3)}:d=0.012[r]`,
    '-map', '[r]'],
  // riser_inverse : quatrième riser (DS Cleaning), court : un accord de Fa majeur (piano feutré + souffle de cymbale)
  // joué à l'envers, qui gonfle vite et s'arrête net quand le résultat tombe. Tonal, différent des souffles et des pulsations.
  riser_inverse: (d = 0.85) => ['-f', 'lavfi', '-i',
    `aevalsrc='(0.5*sin(2*PI*174.6*t)+0.4*sin(2*PI*220*t)+0.35*sin(2*PI*261.6*t)+0.25*sin(2*PI*349.2*t)+0.1*sin(2*PI*523.3*t)+0.12*sin(2*PI*349.2*t)*exp(-9*t))*exp(-4.2*t)*(1-exp(-300*t))':s=${SR}:d=${d}`,
    '-f', 'lavfi', '-i', `anoisesrc=c=pink:r=${SR}:d=${d}:a=0.5:seed=31`,
    '-filter_complex', `[1:a]highpass=f=2500,lowpass=f=7000,volume='0.6*exp(-5*t)':eval=frame[n];[0:a]lowpass=f=3000[o];` +
      `[o][n]amix=inputs=2:normalize=0,aecho=0.8:0.5:60|130:0.3|0.18,areverse,afade=t=out:st=${(d - 0.012).toFixed(3)}:d=0.012[r]`,
    '-map', '[r]'],
  // chute : coup sourd et rond quand l'accroche tombe (grave qui descend, sans claquement)
  chute: () => ['-f', 'lavfi', '-i', `aevalsrc='0.9*sin(2*PI*(62*t-16*t*t))*exp(-4.2*t)*(1-exp(-260*t))+0.18*(random(0)*2-1)*exp(-70*t)':s=${SR}:d=0.9`,
    '-af', 'lowpass=f=700'],
  // --- sons actuels (demande de l'utilisateur : brefs, doux, sans note aiguë) ---
  // woutch : petit souffle bref et doux (bruit rose filtré qui glisse vers l'aigu puis retombe)
  woutch: (d = 0.26) => ['-f', 'lavfi', '-i', `anoisesrc=c=pink:r=${SR}:d=${d}:a=0.9:seed=7`,
    '-af', `asendcmd=c='${balayage(d, 350, 1700, 600)}',bandpass@b=f=350:width_type=o:w=1.2,lowpass=f=4500,` +
      `afade=t=in:d=${(d * 0.55).toFixed(2)}:curve=qsin,afade=t=out:st=${(d * 0.55).toFixed(2)}:d=${(d * 0.45).toFixed(2)}:curve=qsin`],
  // woutch_court : la même chose en plus court et un peu plus léger (chiffres, pastilles)
  woutch_court: (d = 0.16) => ['-f', 'lavfi', '-i', `anoisesrc=c=pink:r=${SR}:d=${d}:a=0.9:seed=11`,
    '-af', `asendcmd=c='${balayage(d, 500, 2000, 900)}',bandpass@b=f=500:width_type=o:w=1.2,lowpass=f=5000,` +
      `afade=t=in:d=${(d * 0.5).toFixed(2)}:curve=qsin,afade=t=out:st=${(d * 0.5).toFixed(2)}:d=${(d * 0.5).toFixed(2)}:curve=qsin`],
  // tap : petit toc feutré, grave et très court (comme un doigt sur une table), pour les coches
  tap: () => ['-f', 'lavfi', '-i',
    `aevalsrc='(0.8*sin(2*PI*150*t)+0.35*sin(2*PI*310*t))*exp(-45*t)*(1-exp(-1500*t))+0.15*(random(0)*2-1)*exp(-400*t)':s=${SR}:d=0.12`,
    '-af', 'lowpass=f=1800,afade=t=out:st=0.09:d=0.03'],
  // swoosh : passage d'air plus long et plus ample (plans de coupe, écran qui arrive)
  swoosh: (d = 0.45) => ['-f', 'lavfi', '-i', `anoisesrc=c=pink:r=${SR}:d=${d}:a=0.9:seed=19`,
    '-af', `asendcmd=c='${balayage(d, 220, 3200, 500)}',bandpass@b=f=220:width_type=o:w=1.0,lowpass=f=6000,` +
      `afade=t=in:d=${(d * 0.5).toFixed(2)}:curve=qsin,afade=t=out:st=${(d * 0.5).toFixed(2)}:d=${(d * 0.5).toFixed(2)}:curve=qsin`],
  // woutch_grave : souffle court et plus grave (présentation, carte en verre)
  woutch_grave: (d = 0.3) => ['-f', 'lavfi', '-i', `anoisesrc=c=pink:r=${SR}:d=${d}:a=0.9:seed=23`,
    '-af', `asendcmd=c='${balayage(d, 160, 900, 280)}',bandpass@b=f=160:width_type=o:w=1.2,lowpass=f=2500,` +
      `afade=t=in:d=${(d * 0.5).toFixed(2)}:curve=qsin,afade=t=out:st=${(d * 0.5).toFixed(2)}:d=${(d * 0.5).toFixed(2)}:curve=qsin`],
  // pop_doux : petite bulle grave et ronde (pastilles), sans aigu
  pop_doux: (d = 0.14) => ['-f', 'lavfi', '-i', `aevalsrc='0.8*sin(2*PI*(520*t-900*t*t))*exp(-28*t)*(1-exp(-800*t))':s=${SR}:d=${d}`,
    '-af', `lowpass=f=2000,afade=t=out:st=${(d - 0.03).toFixed(2)}:d=0.03`],
  // impact_doux : petit coup sourd et court (mot derrière la tête)
  impact_doux: () => ['-f', 'lavfi', '-i', `aevalsrc='0.9*sin(2*PI*(90*t-40*t*t))*exp(-9*t)*(1-exp(-400*t))+0.2*(random(0)*2-1)*exp(-45*t)':s=${SR}:d=0.5`,
    '-af', 'lowpass=f=1200'],
  // clic : clic de souris (appui puis relâchement)
  clic: () => ['-f', 'lavfi', '-i', `aevalsrc='(random(0)*2-1)*(exp(-900*t)+0.6*gt(t,0.06)*exp(-900*(t-0.06)))':s=${SR}:d=0.1`,
    '-af', 'highpass=f=1500,lowpass=f=6000'],
  // --- anciens sons (gardés au cas où) ---
  // souffle d'air qui passe : bruit rose filtré, la fréquence monte puis redescend
  whoosh: (d = 0.6) => ['-f', 'lavfi', '-i', `anoisesrc=c=pink:r=${SR}:d=${d}:a=0.9`,
    '-af', `asendcmd=c='${balayage(d, 250, 2600, 700)}',bandpass@b=f=250:width_type=o:w=1.4,` +
      `afade=t=in:d=${(d * 0.45).toFixed(2)}:curve=qsin,afade=t=out:st=${(d * 0.5).toFixed(2)}:d=${(d * 0.5).toFixed(2)}:curve=qsin`],
  // montée : sinus qui grimpe + souffle qui grossit
  montee: (d = 1.2) => ['-f', 'lavfi', '-i',
    `aevalsrc='(0.35*sin(2*PI*(160*t+300*t*t))+0.25*sin(2*PI*(320*t+600*t*t))*0.5+0.4*(random(0)*2-1)*pow(t/${d},2))*pow(t/${d},1.6)':s=${SR}:d=${d}`,
    '-af', `highpass=f=120,lowpass=f=6000,tremolo=f=14:d=0.25,afade=t=out:st=${d - 0.06}:d=0.06`],
  // impact : grave qui tombe + petit claquement, avec un peu de pièce
  impact: (d = 0.9) => ['-f', 'lavfi', '-i',
    `aevalsrc='0.9*sin(2*PI*(48*t+25*(1-exp(-18*t))/18*18))*exp(-5*t)+0.45*(random(0)*2-1)*exp(-38*t)':s=${SR}:d=${d}`,
    '-af', 'lowpass=f=2600,aecho=0.8:0.5:40:0.25'],
  // scintillement : petites notes aiguës qui s'enchaînent, avec écho
  scintillement: (d = 0.9) => {
    const notes = [[2637, 0], [3136, 0.06], [3951, 0.13], [4699, 0.2], [3520, 0.27], [5274, 0.35]];
    const expr = notes.map(([f, t0]) => `gt(t,${t0})*sin(2*PI*${f}*(t-${t0}))*exp(-16*(t-${t0}))*(1-exp(-600*(t-${t0})))`).join('+');
    return ['-f', 'lavfi', '-i', `aevalsrc='0.22*(${expr})':s=${SR}:d=${d}`,
      '-af', 'highpass=f=1500,aecho=0.8:0.6:70|130:0.35|0.2'];
  },
  // pop : petite bulle (la hauteur descend vite)
  pop: (d = 0.16) => ['-f', 'lavfi', '-i', `aevalsrc='0.8*sin(2*PI*(950*t-2200*t*t))*exp(-22*t)*(1-exp(-500*t))':s=${SR}:d=${d}`,
    '-af', `afade=t=out:st=${d - 0.03}:d=0.03`],
  // compteur : petits tics rapides et discrets pendant que le chiffre défile, puis un tic final
  compteur: (d = 0.55) => {
    const tics = Array.from({length: 9}, (_, k) => +(0.42 * (1 - Math.pow(1 - k / 8, 1.3))).toFixed(3));
    const expr = tics.map((t0) => `gt(t,${t0})*(0.55*sin(2*PI*3300*(t-${t0}))*exp(-900*(t-${t0})))`).join('+')
      + `+gt(t,0.47)*0.8*sin(2*PI*2100*(t-0.47))*exp(-160*(t-0.47))`;
    return ['-f', 'lavfi', '-i', `aevalsrc='${expr}':s=${SR}:d=${d}`, '-af', 'highpass=f=900,lowpass=f=9000'];
  },
  // titre : un souffle d'air qui gonfle doucement puis un coup sourd et rond (sans claquement)
  titre: () => ['-f', 'lavfi', '-i', `anoisesrc=c=pink:r=${SR}:d=0.5:a=0.6`,
    '-f', 'lavfi', '-i', `aevalsrc='0.9*sin(2*PI*(62*t-10*t*t))*exp(-6*t)*(1-exp(-250*t))':s=${SR}:d=0.9`,
    '-filter_complex', `[0:a]bandpass=f=1000:width_type=o:w=2.2,afade=t=in:d=0.46:curve=exp,afade=t=out:st=0.46:d=0.04[s];` +
      `[1:a]lowpass=f=260,adelay=450|450[b];[s][b]amix=inputs=2:duration=longest:normalize=0,aecho=0.8:0.35:55:0.18[o]`,
    '-map', '[o]'],
  // cible : petite fléchette qui file (souffle très court) puis se plante (« toc » sec et feutré, à 0,14 s)
  cible: () => ['-f', 'lavfi', '-i', `anoisesrc=c=pink:r=${SR}:d=0.16:a=0.7`,
    '-f', 'lavfi', '-i', `aevalsrc='(0.9*sin(2*PI*460*t)*exp(-38*t)+0.5*(random(0)*2-1)*exp(-260*t))*(1-exp(-900*t))':s=${SR}:d=0.3`,
    '-filter_complex', `[0:a]bandpass=f=2400:width_type=o:w=1.6,volume=8,afade=t=in:d=0.12:curve=exp,afade=t=out:st=0.12:d=0.04[s];` +
      `[1:a]lowpass=f=3200,adelay=140:all=1[b];[s][b]amix=inputs=2:duration=longest:normalize=0[o]`,
    '-map', '[o]'],
  // numerique (IA) : trois petits bips électroniques qui montent, puis un bip quand « IA » s'allume (à 0,36 s)
  numerique: () => {
    const bips = [[1318, 0], [1760, 0.06], [2637, 0.12], [3520, 0.36]];
    const expr = bips.map(([f, t0]) => `between(t,${t0},${t0 + 0.05})*sin(PI*(t-${t0})/0.05)*(sin(2*PI*${f}*(t-${t0}))+0.25*sin(2*PI*${3 * f}*(t-${t0})))`).join('+');
    return ['-f', 'lavfi', '-i', `aevalsrc='0.5*(${expr})':s=${SR}:d=0.45`, '-af', 'lowpass=f=9000'];
  },
  // frappe : clic de clavier très court
  frappe: (d = 0.05) => ['-f', 'lavfi', '-i', `aevalsrc='(random(0)*2-1)*exp(-140*t)':s=${SR}:d=${d}`,
    '-af', 'highpass=f=1800,lowpass=f=7000'],
};

// Sons fournis par l'utilisateur (charte → moteur.sons.fournis) : ils remplacent le son fabriqué du même nom.
// Chaque son est coupé pour durer « duree_s » et finir à « fin_s » dans le fichier d'origine (ex. la coupure d'un riser),
// avec une entrée en fondu ; puis ramené à -1 dBFS de crête comme les autres.
function preparerFourni(nom, f, dossier, racineDepot) {
  const source = path.join(racineDepot, f.fichier);
  const brut = path.join(dossier, `${nom}.brut.wav`);
  const sortie = path.join(dossier, `${nom}.wav`);
  const debut = Math.max(0, f.fin_s - f.duree_s);
  const duree = f.fin_s - debut;
  ffmpeg(['-ss', debut.toFixed(3), '-t', duree.toFixed(3), '-i', source, '-af',
    `afade=t=in:d=${f.fondu_entree_s ?? 0.15},afade=t=out:st=${(duree - 0.006).toFixed(3)}:d=0.006`, '-ac', '2', '-ar', String(SR), brut]);
  const mesure = spawnSync('ffmpeg', ['-hide_banner', '-i', brut, '-af', 'volumedetect', '-f', 'null', '-'], {encoding: 'utf8'});
  const m = (mesure.stderr || '').match(/max_volume:\s*(-?[\d.]+) dB/);
  ffmpeg(['-i', brut, '-af', `volume=${(-1 - (m ? parseFloat(m[1]) : 0)).toFixed(2)}dB`, '-ac', '2', '-ar', String(SR), sortie]);
  fs.rmSync(brut);
}

export function genererSons(dossier = path.join(RACINE, 'public', 'sons'), forcer = false, fournis = {}, racineDepot = path.resolve(RACINE, '..')) {
  fs.mkdirSync(dossier, {recursive: true});
  for (const [nom, f] of Object.entries(fournis || {})) if (!nom.startsWith('_')) preparerFourni(nom, f, dossier, racineDepot);
  for (const [nom, recette] of Object.entries(RECETTES)) {
    if (fournis && fournis[nom]) continue;
    const sortie = path.join(dossier, `${nom}.wav`);
    if (fs.existsSync(sortie) && !forcer) continue;
    const brut = path.join(dossier, `${nom}.brut.wav`);
    ffmpeg([...recette(), '-ac', '1', '-ar', String(SR), brut]);
    // crête ramenée à -1 dBFS, puis stéréo
    const mesure = spawnSync('ffmpeg', ['-hide_banner', '-i', brut, '-af', 'volumedetect', '-f', 'null', '-'], {encoding: 'utf8'});
    const m = (mesure.stderr || '').match(/max_volume:\s*(-?[\d.]+) dB/);
    const max = m ? parseFloat(m[1]) : 0;
    ffmpeg(['-i', brut, '-af', `volume=${(-1 - max).toFixed(2)}dB`, '-ac', '2', '-ar', String(SR), sortie]);
    fs.rmSync(brut);
  }
  return dossier;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const d = genererSons(process.argv[2] ? path.resolve(process.argv[2]) : undefined, true);
  console.log('Sons générés dans', d);
}
