import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {clamp, easeIn, easeInOut, easeOut, fondu, lerp, prog} from '../temps';

type Zoom = {debut: number; fin?: number; a: number; duree: number};

// valeur d'un zoom à l'instant x (1 = pas de zoom)
const valeurZoom = (z: Zoom, x: number, coupes: number[], duree: number) => {
  if (x < z.debut) return 1;
  const finMaintien = z.fin ?? coupes.find((c) => c > z.debut + z.duree) ?? duree;
  if (x < z.debut + z.duree) return lerp(1, z.a, easeInOut((x - z.debut) / z.duree));
  if (x < finMaintien || (z.fin === undefined && finMaintien >= duree)) return z.a;
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

// avantPlan : redessine seulement la personne (vidéo découpée par le masque de détourage, même cadrage),
// par-dessus un texte placé derrière la tête. Rien n'est dessiné hors des moments de texte derrière la tête.
export const Camera: React.FC<{projet: any; charte: any; avantPlan?: boolean}> = ({projet, charte, avantPlan = false}) => {
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
  // pas de cadrage serré sur un plan où s'affiche une liste de pastilles ou une carte en verre (elle reste sous le menton)
  const listeSurLePlan = projet.effets.some((e: any) => e.type === 'liste' && e.debut < finPlan && e.fin > debutPlan);
  const verreSurLePlan = projet.effets.some((e: any) => e.type === 'carte_verre' && e.debut < finPlan && e.fin > debutPlan);
  const etiquettesSurLePlan = projet.effets.some((e: any) => (e.type === 'frise' || e.type === 'bilan') && e.debut < finPlan && e.fin > debutPlan);
  const cadrage = Math.min(cam.cadrages[k % cam.cadrages.length], listeSurLePlan ? M.liste.cadrage_max : Infinity, verreSurLePlan ? M.carte_verre.cadrage_max : Infinity, etiquettesSurLePlan ? M.etiquettes.cadrage_max : Infinity);
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

  // l'image doit toujours couvrir tout le cadre malgré son décalage horizontal (sinon une bande noire apparaît sur un côté)
  const ox = cam.visage[0] * W;
  const couvre = decalage > 0 ? 1 + decalage / ox : decalage < 0 ? 1 - decalage / (W - ox) : 1;
  const echelle = Math.max(cadrage * avancee * z * (1 + 0.07 * g + 0.03 * v), couvre + 0.002);
  const origine = `${cam.visage[0] * W}px ${cam.visage[1] * H}px`;

  const filtres = [
    pano.flou > 0.5 ? 'url(#flou-panoramique)' : '',
    projet.ambiance.etalonnage ? M.ambiance.etalonnage_css : '',
    v > 0.001 && g < 0.001 ? `blur(${(v * 9).toFixed(1)}px) brightness(${(1 - 0.25 * v).toFixed(3)})` : '',
    g > 0.001 ? `blur(${(g * M.grand_titre.flou_visage_px).toFixed(1)}px) brightness(${(1 - M.grand_titre.assombrissement * g).toFixed(3)})` : '',
  ].join(' ');

  const video = (cle: string, decalX: number, s: number, opacite: number, muet: boolean) => (
    <div key={cle} style={{position: 'absolute', inset: 0, transform: `translateX(${decalage + decalX}px) scale(${s})`, transformOrigin: origine, opacity: opacite}}>
      <OffthreadVideo src={staticFile(projet.rush.video)} muted={muet} style={{width: W, height: H, objectFit: 'cover'}} />
    </div>
  );

  if (avantPlan) {
    const derriere = projet.effets.some((e: any) => e.type === 'texte_derriere' && t >= e.debut - 0.02 && t <= e.fin + 0.02);
    if (!derriere || !cam.masques) return null;
    const masque = staticFile(`${cam.masques}/m_${String(frame).padStart(5, '0')}.png`);
    return (
      <AbsoluteFill>
        {/* image cachée : Remotion attend son chargement avant de prendre la photo de l'image */}
        <Img src={masque} style={{position: 'absolute', width: 1, height: 1, opacity: 0}} />
        <div style={{position: 'absolute', inset: 0, filter: filtres}}>
          <div style={{position: 'absolute', inset: 0, transform: `translateX(${decalage + pano.x}px) scale(${echelle})`, transformOrigin: origine}}>
            <div style={{position: 'absolute', inset: 0, WebkitMaskImage: `url(${masque})`, maskImage: `url(${masque})`, WebkitMaskSize: '100% 100%', maskSize: '100% 100%'}}>
              <OffthreadVideo src={staticFile(projet.rush.video)} muted style={{width: W, height: H, objectFit: 'cover'}} />
            </div>
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  const couches: React.ReactNode[] = [];
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
