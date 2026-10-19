import React from 'react';
import {AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {miseEnPageAccroche} from '../miseEnPage';
import {clamp, easeIn, easeInOut, easeOut, fondu, lerp, prog} from '../temps';

type Zoom = {debut: number; fin?: number; a: number; duree: number};

// valeur d'un zoom à l'instant x (1 = pas de zoom)
const valeurZoom = (z: Zoom, x: number, coupes: number[], duree: number) => {
  if (x < z.debut) return 1;
  const finMaintien = z.fin ?? coupes.find((c) => c > z.debut + z.duree) ?? duree;
  if (x < z.debut + z.duree) return lerp(1, z.a, easeInOut((x - z.debut) / z.duree));
  if (x < finMaintien) return z.a;
  if (z.fin !== undefined && x < z.fin + z.duree) return lerp(z.a, 1, easeInOut((x - z.fin) / z.duree));
  return 1;
};

// panoramique rapide : la vidéo file vers la gauche, floue, et la nouvelle arrive par la droite
const panoramique = (t: number, transitions: any[], W: number) => {
  for (const tr of transitions) {
    if (tr.style !== 'panoramique') continue;
    const m = tr.duree / 2;
    if (t >= tr.debut - m && t < tr.debut) {
      const p = easeIn((t - (tr.debut - m)) / m);
      return {x: -p * W, flou: p * 90};
    }
    if (t >= tr.debut && t < tr.debut + m) {
      const p = 1 - easeOut((t - tr.debut) / m);
      return {x: p * W, flou: p * 90};
    }
  }
  return {x: 0, flou: 0};
};

export const Camera: React.FC<{projet: any; charte: any}> = ({projet, charte}) => {
  const frame = useCurrentFrame();
  const {fps, width: W, height: H} = useVideoConfig();
  const t = frame / fps;
  const M = charte.moteur;
  const cam = projet.camera;
  const coupes: number[] = cam.coupes;

  // plan en cours : nouveau cadrage à chaque coupe, et lente avancée pendant le plan
  const k = coupes.filter((c) => t >= c).length;
  const debutPlan = k === 0 ? 0 : coupes[k - 1];
  const finPlan = k < coupes.length ? coupes[k] : projet.duree;
  // pas de cadrage serré sur un plan où s'affiche une liste de pastilles (elle reste sous le menton)
  const listeSurLePlan = projet.effets.some((e: any) => e.type === 'liste' && e.debut < finPlan && e.fin > debutPlan);
  const cadrage = Math.min(cam.cadrages[k % cam.cadrages.length], listeSurLePlan ? M.liste.cadrage_max : Infinity);
  const decalage = cam.decalages_x[k % cam.decalages_x.length] * W;
  const avancee = 1 + cam.avancee * prog(t, debutPlan, finPlan);

  const zoom = (x: number) => cam.zooms.reduce((acc: number, z: Zoom) => acc * valeurZoom(z, x, coupes, projet.duree), 1);
  const z = zoom(t);
  const vitesseZoom = (zoom(t + 1 / fps) - z) * fps;

  const titres = projet.effets.filter((e: any) => e.type === 'grand_titre');
  const g = Math.max(0, ...titres.map((e: any) => fondu(t, e.debut - 0.12, e.fin, 0.22)));
  const stats = projet.effets.filter((e: any) => (e.type === 'icone' || e.type === 'chiffre') && e.flou_visage === true);
  const v = Math.max(0, ...stats.map((e: any) => fondu(t, e.debut, e.fin, 0.2)));
  const cartes = projet.effets.filter((e: any) => e.type === 'carte');
  const c = Math.max(0, ...cartes.map((e: any) => fondu(t, e.debut, e.fin, M.carte.duree_reduction_s)));
  const pano = panoramique(t, projet.transitions, W);

  const echelle = cadrage * avancee * z * (1 + 0.07 * g + 0.03 * v);
  const origine = `${cam.visage[0] * W}px ${cam.visage[1] * H}px`;

  // Pendant une accroche, l'image descend juste assez pour que le haut de la tête passe sous le titre.
  // Entre deux accroches rapprochées, le changement se fait sur la coupe (invisible), sinon en douceur.
  const yeux = cam.visage[1] * H;
  const hautTete = yeux - echelle * (yeux - cam.haut_tete * H);
  const accroches = projet.effets.filter((e: any) => e.type === 'accroche').sort((a: any, b: any) => a.debut - b.debut);
  const frontiere = (a: any, b: any) => (b.debut - a.fin < 0.6 ? coupes.find((c) => c >= a.fin - 0.15 && c <= b.debut + 0.15) : undefined);
  let decalY = 0;
  accroches.forEach((e: any, i: number) => {
    const fAvant = i > 0 ? frontiere(accroches[i - 1], e) : undefined;
    const fApres = i < accroches.length - 1 ? frontiere(e, accroches[i + 1]) : undefined;
    const debut = fAvant ?? e.debut;
    const fin = fApres ?? e.fin;
    let w = 0;
    if (t >= debut && t < fin) w = 1;
    else if (fAvant === undefined && e.debut > 0.05 && t >= e.debut - 0.35 && t < e.debut) w = easeInOut(prog(t, e.debut - 0.35, e.debut));
    else if (fApres === undefined && t >= fin && t < fin + 0.35) w = easeInOut(1 - prog(t, fin, fin + 0.35));
    if (w > 0) {
      const besoin = Math.max(0, miseEnPageAccroche(e, charte).bas + M.accroche.marge_tete_px - hautTete);
      decalY = Math.max(decalY, besoin * w);
    }
  });
  const filtres = [
    pano.flou > 0.5 ? 'url(#flou-panoramique)' : '',
    projet.ambiance.etalonnage ? M.ambiance.etalonnage_css : '',
    v > 0.001 && g < 0.001 ? `blur(${(v * 9).toFixed(1)}px) brightness(${(1 - 0.25 * v).toFixed(3)})` : '',
    g > 0.001 ? `blur(${(g * M.grand_titre.flou_visage_px).toFixed(1)}px) brightness(${(1 - M.grand_titre.assombrissement * g).toFixed(3)})` : '',
  ].join(' ');

  const video = (cle: string, decalX: number, s: number, opacite: number, muet: boolean) => (
    <div key={cle} style={{position: 'absolute', inset: 0, transform: `translateX(${decalage + decalX}px) translateY(${decalY.toFixed(1)}px) scale(${s})`, transformOrigin: origine, opacity: opacite}}>
      <OffthreadVideo src={staticFile(projet.rush.video)} muted={muet} style={{width: W, height: H, objectFit: 'cover'}} />
    </div>
  );

  const couches: React.ReactNode[] = [];
  // haut libéré par la descente : rempli par une copie très floue de l'image (le mur continue)
  if (decalY > 0.5) {
    couches.push(
      <div key="fond-flou" style={{position: 'absolute', inset: 0, transform: 'scale(1.6)', transformOrigin: '50% 0%', filter: 'blur(45px) brightness(0.95)'}}>
        <OffthreadVideo src={staticFile(projet.rush.video)} muted style={{width: W, height: H, objectFit: 'cover'}} />
      </div>,
    );
  }
  couches.push(video('principale', pano.x, echelle, 1, Boolean(projet.rush.voix)));
  if (pano.flou > 0.5) couches.push(video('panoramique', pano.x + (pano.x < 0 ? W : -W), echelle, 1, true));
  // flou de mouvement du zoom : copies légèrement décalées en taille, semi-transparentes
  const force = clamp(Math.abs(vitesseZoom) / 1.2);
  if (force > 0.15) {
    for (let i = 1; i <= 3; i++) couches.push(video(`fantome${i}`, pano.x, echelle * (1 - Math.sign(vitesseZoom) * 0.02 * i * force), 0.3, true));
  }

  // réduction en carte arrondie
  const [rx, ry, rw] = M.carte.rect_video;
  const ce = easeInOut(c);
  const largeur = lerp(W, rw, ce);
  const kc = largeur / W;
  const rayon = (lerp(0, M.carte.rayon_px, ce) / kc).toFixed(1);

  return (
    <AbsoluteFill style={{background: '#000'}}>
      {c > 0 && <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 40%, #1a1a1a 0%, #050505 70%)', opacity: ce}} />}
      <div
        style={{
          position: 'absolute', left: lerp(0, rx, ce), top: lerp(0, ry, ce), width: W, height: H,
          transform: `scale(${kc})`, transformOrigin: '0 0', borderRadius: `${rayon}px`, overflow: 'hidden',
          boxShadow: c > 0 ? `0 ${30 / kc}px ${90 / kc}px rgba(0,0,0,${(0.6 * ce).toFixed(2)})` : 'none',
        }}
      >
        <div style={{position: 'absolute', inset: 0, filter: filtres}}>{couches}</div>
        {c > 0 && <div style={{position: 'absolute', inset: 0, borderRadius: `${rayon}px`, border: `${2 / kc}px solid rgba(255,255,255,${(0.16 * ce).toFixed(2)})`}} />}
      </div>
      <svg width="0" height="0" style={{position: 'absolute'}}>
        <defs>
          <filter id="flou-panoramique" x="-20%" y="0%" width="140%" height="100%">
            <feGaussianBlur stdDeviation={`${pano.flou.toFixed(1)} 0`} />
          </filter>
        </defs>
      </svg>
    </AbsoluteFill>
  );
};
