import React from 'react';
import {random, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {easeOut, prog} from '../temps';

// Icônes au trait fin blanc + un seul détail orange (charte → icones), dessinées sur 100×100.
const ICONES: Record<string, {traits: string[]; detail: (c: string) => React.ReactNode}> = {
  courbe: {traits: ['M10 8 V90 H92', 'M22 74 L42 52 L57 63 L86 24'], detail: (c) => <circle cx={86} cy={24} r={6} fill={c} />},
  etoile: {
    traits: ['M50 10 L61.2 36.3 L89 38.8 L67.9 57.2 L74.4 84.6 L50 70 L25.6 84.6 L32.1 57.2 L11 38.8 L38.8 36.3 Z'],
    detail: (c) => <circle cx={86} cy={14} r={5} fill={c} />,
  },
  epingle: {traits: ['M50 92 C50 92 20 60 20 38 A30 30 0 0 1 80 38 C80 60 50 92 50 92 Z'], detail: (c) => <circle cx={50} cy={38} r={10} fill={c} />},
  panier: {traits: ['M8 16 H22 L32 64 H80 L90 30 H25'], detail: (c) => (<g fill={c}><circle cx={38} cy={80} r={6} /><circle cx={74} cy={80} r={6} /></g>)},
  coeur: {traits: ['M50 86 C22 66 8 50 8 34 A20 20 0 0 1 50 26 A20 20 0 0 1 92 34 C92 50 78 66 50 86 Z'], detail: (c) => <circle cx={74} cy={34} r={5} fill={c} />},
  bulle: {
    traits: ['M16 18 H84 A8 8 0 0 1 92 26 V62 A8 8 0 0 1 84 70 H42 L24 86 V70 H16 A8 8 0 0 1 8 62 V26 A8 8 0 0 1 16 18 Z'],
    detail: (c) => (<g><circle cx={32} cy={44} r={4.5} fill="#fff" /><circle cx={50} cy={44} r={4.5} fill={c} /><circle cx={68} cy={44} r={4.5} fill="#fff" /></g>),
  },
};

export const Icone: React.FC<{e: any; charte: any}> = ({e, charte}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  if (t < e.debut || t > e.fin) return null;
  const I = charte.moteur.icone;
  const accent = charte.couleurs.orange;
  const taille = e.taille ?? I.taille_px;
  const x = e.x ?? I.x;
  const y = e.y ?? I.y;
  const def = ICONES[e.icone] ?? ICONES.courbe;

  const rebond = spring({frame: (t - e.debut) * fps, fps, config: {damping: 8, stiffness: 170, mass: 0.7}});
  const trace = easeOut(prog(t, e.debut + 0.05, e.debut + 0.05 + I.duree_trace_s));
  const detail = spring({frame: (t - e.debut - I.duree_trace_s * 0.8) * fps, fps, config: {damping: 7, stiffness: 220, mass: 0.5}});
  const sortie = prog(t, e.fin - 0.2, e.fin);
  const echelle = rebond * (1 - 0.4 * sortie);

  // particules : éclat autour de l'icône au moment du rebond
  const tp = t - (e.debut + 0.1);
  const particules = [];
  if (tp > 0 && tp < 0.8) {
    const p = tp / 0.8;
    for (let i = 0; i < I.particules; i++) {
      const angle = (i / I.particules) * Math.PI * 2 + random(`a${e.id}-${i}`) * 0.5;
      const distance = taille * (0.45 + 0.45 * random(`d${e.id}-${i}`)) * easeOut(p) + taille * 0.25;
      const r = (3 + 5 * random(`r${e.id}-${i}`)) * (1 - p);
      particules.push(
        <circle key={i} cx={taille + Math.cos(angle) * distance} cy={taille + Math.sin(angle) * distance} r={r} fill={i % 3 === 0 ? accent : '#fff'} opacity={1 - p} />,
      );
    }
  }

  return (
    <div style={{position: 'absolute', left: x - taille, top: y - taille, width: taille * 2, height: taille * 2, opacity: 1 - sortie}}>
      <svg width={taille * 2} height={taille * 2} style={{position: 'absolute', inset: 0}}>{particules}</svg>
      <svg
        viewBox="0 0 100 100" width={taille} height={taille}
        style={{position: 'absolute', left: taille / 2, top: taille / 2, transform: `scale(${echelle})`, overflow: 'visible', filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.45))'}}
      >
        {def.traits.map((d, i) => (
          <path key={i} d={d} pathLength={1} fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 1" strokeDashoffset={1 - trace} />
        ))}
        <g style={{transform: `scale(${detail})`, transformOrigin: 'center', transformBox: 'fill-box'}}>{def.detail(accent)}</g>
      </svg>
    </div>
  );
};
