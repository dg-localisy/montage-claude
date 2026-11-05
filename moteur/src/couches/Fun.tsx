import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {easeInOut, easeOut, prog} from '../temps';

// Famille « fun » (vidéo de recrutement de l'équipe, 05/11/2026 : « laisse place à ton imagination, mets des effets sur nous »).
// Noir et blanc, Figtree. Coordonnées en px de l'image finale (1080×1920), après le cadrage du plan.

const ombre = '0 8px 30px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.35)';
const useT = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return {t: frame / fps, fps};
};
// apparition « pop » (ressort) et sortie rapide
const pop = (t: number, debut: number, fin: number, fps: number) => {
  const s = spring({frame: (t - debut) * fps, fps, config: {damping: 10, stiffness: 220, mass: 0.6}});
  const sortie = easeInOut(prog(t, fin - 0.18, fin));
  return {s, sortie, opacite: Math.min(1, (t - debut) * 10) * (1 - sortie)};
};

// Place libre : silhouette en pointillés (tête + épaules) et étiquette « TOI ? », là où une personne va apparaître.
// Champs : debut, fin, x, y (centre de la tête), r (rayon de la tête), largeur (des épaules), bas (bas des épaules), texte.
export const PlaceLibre: React.FC<{e: any}> = ({e}) => {
  const {t, fps} = useT();
  if (t < e.debut || t > e.fin) return null;
  const {s, sortie, opacite} = pop(t, e.debut, e.fin, fps);
  const pulse = 1 + 0.035 * Math.sin((t - e.debut) * 7);
  const {x, y, r} = e;
  const l = e.largeur / 2;
  const bas = e.bas;
  const cou = y + r * 1.05;
  const d = `M ${x - l} ${bas} C ${x - l} ${cou + r * 0.4}, ${x - r * 1.2} ${cou}, ${x} ${cou} C ${x + r * 1.2} ${cou}, ${x + l} ${cou + r * 0.4}, ${x + l} ${bas}`;
  return (
    <div style={{position: 'absolute', inset: 0, opacity: opacite}}>
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, overflow: 'visible', filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.5))',
        transform: `scale(${(s * pulse * (1 + 0.15 * sortie)).toFixed(4)})`, transformOrigin: `${x}px ${y}px`}}>
        <circle cx={x} cy={y} r={r} fill="rgba(255,255,255,0.16)" stroke="#fff" strokeWidth={6} strokeDasharray="14 10" strokeLinecap="round" />
        <path d={d} fill="rgba(255,255,255,0.16)" stroke="#fff" strokeWidth={6} strokeDasharray="14 10" strokeLinecap="round" />
      </svg>
      <div style={{position: 'absolute', left: x - 200, width: 400, top: y - r - 120, display: 'flex', justifyContent: 'center',
        transform: `translateY(${((1 - s) * 30).toFixed(1)}px) scale(${(0.6 + 0.4 * s).toFixed(4)})`}}>
        <div style={{background: '#fff', color: '#000', fontFamily: 'Figtree Black', fontSize: 54, padding: '10px 30px 8px', borderRadius: 999, boxShadow: ombre, letterSpacing: '0.02em'}}>
          {e.texte ?? 'TOI ?'}
        </div>
      </div>
    </div>
  );
};

// Étincelles : étoiles à 4 branches qui scintillent autour d'une personne (jamais sur le visage).
// Champs : debut, fin, points [[x, y, taille, depart], …] (depart en s après debut).
const Etoile: React.FC<{taille: number}> = ({taille}) => (
  <svg width={taille} height={taille} viewBox="-50 -50 100 100" style={{overflow: 'visible', filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.9)) drop-shadow(0 2px 6px rgba(0,0,0,0.35))'}}>
    <path d="M 0 -50 C 5 -12, 12 -5, 50 0 C 12 5, 5 12, 0 50 C -5 12, -12 5, -50 0 C -12 -5, -5 -12, 0 -50 Z" fill="#fff" />
  </svg>
);
export const Etincelles: React.FC<{e: any}> = ({e}) => {
  const {t} = useT();
  if (t < e.debut || t > e.fin) return null;
  const sortie = easeInOut(prog(t, e.fin - 0.2, e.fin));
  return (
    <div style={{position: 'absolute', inset: 0, opacity: 1 - sortie}}>
      {e.points.map(([x, y, taille, depart]: number[], i: number) => {
        const u = t - e.debut - depart;
        if (u < 0) return null;
        // éclat rapide puis scintillement doux
        const eclat = easeOut(prog(u, 0, 0.18)) * (1 - 0.35 * easeInOut(prog(u, 0.18, 0.45)));
        const vit = 0.65 + 0.12 * Math.sin(u * 11 + i);
        const sc = u < 0.45 ? eclat : vit;
        return (
          <div key={i} style={{position: 'absolute', left: x - taille / 2, top: y - taille / 2, width: taille, height: taille,
            transform: `scale(${sc.toFixed(3)}) rotate(${(u * 40 + i * 20).toFixed(1)}deg)`}}>
            <Etoile taille={taille} />
          </div>
        );
      })}
    </div>
  );
};

// Viseur de caméra : coins aux bords de l'image, « ● REC » qui clignote, compteur de temps, et un cadre de mise au point
// qui se resserre autour du visage (sans le cacher) au moment « verrou ». Champs : debut, fin, verrou, cible [x0, y0, x1, y1].
export const Viseur: React.FC<{e: any}> = ({e}) => {
  const {t, fps} = useT();
  if (t < e.debut || t > e.fin) return null;
  const entree = easeOut(prog(t, e.debut, e.debut + 0.25));
  const sortie = easeInOut(prog(t, e.fin - 0.2, e.fin));
  const op = entree * (1 - sortie);
  const marge = 70, haut = 250, basY = 1700;
  const coin = (x: number, y: number, sx: number, sy: number, l = 90, ep = 7) => (
    <path d={`M ${x} ${y + sy * l} L ${x} ${y} L ${x + sx * l} ${y}`} fill="none" stroke="#fff" strokeWidth={ep} strokeLinecap="round" strokeLinejoin="round" />
  );
  const [x0, y0, x1, y1] = e.cible;
  const v = e.verrou ?? e.debut + 0.5;
  const serre = easeOut(prog(t, v - 0.3, v));
  const k = 1 + 0.45 * (1 - serre);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const w = ((x1 - x0) / 2) * k, h = ((y1 - y0) / 2) * k;
  const clignote = t > v && t < v + 0.36 ? (Math.floor((t - v) * 12) % 2 === 0 ? 1 : 0.35) : 1;
  const rec = Math.floor((t - e.debut) * 2) % 2 === 0 ? 1 : 0.15;
  const ecoule = t - e.debut;
  const tc = `00:00:${String(Math.floor(ecoule)).padStart(2, '0')}:${String(Math.floor((ecoule % 1) * fps)).padStart(2, '0')}`;
  return (
    <div style={{position: 'absolute', inset: 0, opacity: op}}>
      <svg width={1080} height={1920} style={{position: 'absolute', inset: 0, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))',
        transform: `scale(${(1.04 - 0.04 * entree).toFixed(4)})`, transformOrigin: '540px 960px'}}>
        {coin(marge, haut, 1, 1)}{coin(1080 - marge, haut, -1, 1)}{coin(marge, basY, 1, -1)}{coin(1080 - marge, basY, -1, -1)}
        <g opacity={clignote}>
          {coin(cx - w, cy - h, 1, 1, 46, 6)}{coin(cx + w, cy - h, -1, 1, 46, 6)}{coin(cx - w, cy + h, 1, -1, 46, 6)}{coin(cx + w, cy + h, -1, -1, 46, 6)}
        </g>
      </svg>
      <div style={{position: 'absolute', left: marge + 30, top: haut + 26, display: 'flex', alignItems: 'center', gap: 14, fontFamily: 'Figtree Bold', fontSize: 40,
        color: '#fff', letterSpacing: '0.08em', textShadow: ombre}}>
        <div style={{width: 26, height: 26, borderRadius: 13, background: '#fff', opacity: rec, boxShadow: '0 0 12px rgba(255,255,255,0.8)'}} />REC
      </div>
      <div style={{position: 'absolute', right: marge + 30, top: haut + 28, fontFamily: 'Figtree SemiBold', fontSize: 36, color: '#fff', letterSpacing: '0.06em',
        textShadow: ombre, fontVariantNumeric: 'tabular-nums'}}>{tc}</div>
    </div>
  );
};

// Bouton « Envoie-nous un DM » (façon Instagram) : il arrive, un doigt l'appuie au moment « tap » (onde), il passe en noir.
// Champs : debut, fin, tap, y (centre), texte, echelle.
export const BoutonDM: React.FC<{e: any}> = ({e}) => {
  const {t, fps} = useT();
  if (t < e.debut || t > e.fin) return null;
  const {s, opacite} = pop(t, e.debut, e.fin, fps);
  const tap = e.tap;
  const appui = t >= tap - 0.06 && t < tap + 0.12 ? 0.92 : 1;
  const presse = t >= tap;
  const onde = prog(t, tap, tap + 0.45);
  const y = e.y;
  // le doigt (rond blanc) arrive de la droite vers le bouton, appuie, repart
  const arrivee = easeOut(prog(t, tap - 0.35, tap - 0.04));
  const depart = easeInOut(prog(t, tap + 0.15, tap + 0.45));
  const dx = 470 + 60 * (1 - arrivee) + 120 * depart;
  const dy = y + 30 + 220 * (1 - arrivee) + 160 * depart;
  const doigt = Math.min(arrivee * 2, 1) * (1 - depart);
  return (
    <div style={{position: 'absolute', inset: 0, opacity: opacite}}>
      <div style={{position: 'absolute', left: 0, width: 1080, top: y - 64, display: 'flex', justifyContent: 'center',
        transform: `scale(${((0.55 + 0.45 * s) * appui * (e.echelle ?? 1)).toFixed(4)})`, transformOrigin: `540px 64px`}}>
        <div style={{height: 128, padding: '0 54px 0 40px', borderRadius: 64, display: 'flex', alignItems: 'center', gap: 22,
          background: presse ? '#000' : '#fff', color: presse ? '#fff' : '#000', boxShadow: ombre, border: presse ? '3px solid rgba(255,255,255,0.85)' : '3px solid transparent'}}>
          <svg width={58} height={58} viewBox="0 0 24 24" style={{transform: 'rotate(-20deg)'}}>
            <path d="M22 2 L11 13 M22 2 L15 22 L11 13 L2 9 Z" fill="none" stroke={presse ? '#fff' : '#000'} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <div style={{fontFamily: 'Figtree ExtraBold', fontSize: 50, letterSpacing: '-0.01em', whiteSpace: 'nowrap'}}>{e.texte ?? 'Envoie-nous un DM'}</div>
        </div>
      </div>
      {onde > 0 && onde < 1 && (
        <div style={{position: 'absolute', left: dx - 90 * onde - 20, top: y + 30 - 90 * onde - 20, width: 40 + 180 * onde, height: 40 + 180 * onde, borderRadius: '50%',
          border: `${(6 * (1 - onde)).toFixed(1)}px solid rgba(255,255,255,${(0.9 * (1 - onde)).toFixed(2)})`}} />
      )}
      {doigt > 0.01 && (
        <div style={{position: 'absolute', left: dx - 30, top: dy - 30, width: 60, height: 60, borderRadius: 30, background: 'rgba(255,255,255,0.92)',
          border: '4px solid rgba(0,0,0,0.25)', boxShadow: ombre, opacity: doigt, transform: `scale(${t >= tap - 0.06 && t < tap + 0.12 ? 0.82 : 1})`}} />
      )}
    </div>
  );
};

// Épingle de carte qui tombe et rebondit, avec le nom du lieu dans une pastille blanche.
// Champs : debut, fin, x, y (pointe de l'épingle), texte, echelle.
export const Epingle: React.FC<{e: any}> = ({e}) => {
  const {t, fps} = useT();
  if (t < e.debut || t > e.fin) return null;
  const chute = spring({frame: (t - e.debut) * fps, fps, config: {damping: 9, stiffness: 180, mass: 0.7}});
  const sortie = easeInOut(prog(t, e.fin - 0.2, e.fin));
  const pastille = spring({frame: (t - e.debut - 0.22) * fps, fps, config: {damping: 12, stiffness: 200}});
  const {x, y} = e;
  const h = 150;
  const ecrase = 1 + 0.12 * Math.max(0, chute - 1);
  return (
    <div style={{position: 'absolute', inset: 0, opacity: Math.min(1, (t - e.debut) * 8) * (1 - sortie), transform: `scale(${e.echelle ?? 1})`, transformOrigin: `${x}px ${y}px`}}>
      <div style={{position: 'absolute', left: x - 70, top: y + 4, width: 140, height: 26, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 70%)',
        transform: `scaleX(${(0.4 + 0.6 * Math.min(1, chute)).toFixed(3)})`}} />
      <svg width={120} height={h} viewBox="0 0 120 150" style={{position: 'absolute', left: x - 60, top: y - h, overflow: 'visible',
        transform: `translateY(${((1 - chute) * -420).toFixed(1)}px) scaleY(${(1 / ecrase).toFixed(3)}) scaleX(${ecrase.toFixed(3)})`, transformOrigin: '60px 150px',
        filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.45))'}}>
        <path d="M60 148 C 40 112, 8 88, 8 56 A 52 52 0 1 1 112 56 C 112 88, 80 112, 60 148 Z" fill="#fff" />
        <circle cx={60} cy={56} r={20} fill="#000" />
      </svg>
      <div style={{position: 'absolute', left: x - 300, width: 600, top: y + 26, display: 'flex', justifyContent: 'center',
        transform: `scale(${Math.max(0, pastille).toFixed(4)})`, transformOrigin: '300px 0px'}}>
        <div style={{background: '#fff', color: '#000', fontFamily: 'Figtree Black', fontSize: 58, letterSpacing: '0.14em', padding: '10px 26px 8px 36px', borderRadius: 999,
          boxShadow: ombre}}>{e.texte}</div>
      </div>
    </div>
  );
};
