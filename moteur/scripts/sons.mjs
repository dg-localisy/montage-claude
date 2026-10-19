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
  // frappe : clic de clavier très court
  frappe: (d = 0.05) => ['-f', 'lavfi', '-i', `aevalsrc='(random(0)*2-1)*exp(-140*t)':s=${SR}:d=${d}`,
    '-af', 'highpass=f=1800,lowpass=f=7000'],
};

export function genererSons(dossier = path.join(RACINE, 'public', 'sons'), forcer = false) {
  fs.mkdirSync(dossier, {recursive: true});
  for (const [nom, recette] of Object.entries(RECETTES)) {
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
