import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {easeIn, easeOut, prog} from '../temps';

// Courbe de croissance derrière la personne (Black and Bike) : un autre élément « derrière la tête » que le mot géant.
// Une courbe blanche se dessine de bas à gauche vers le haut à droite pendant le riser (elle accélère avec lui),
// la personne détourée passe devant (Camera avec avantPlan) ; au moment clé (« doublé »), un point s'allume au bout
// et l'étiquette du résultat (« ×2 ») surgit dans une boîte, en haut à droite, jamais sur le visage.
// Champs : debut, cle (instant du résultat), fin, label, depart (petit texte au départ, ex. « AVANT »),
// points [[x, y], …] du tracé en px (sinon tracé par défaut), riser, riser_duree.
// tracé par défaut : monte à gauche de l'épaule, passe derrière la tête, ressort à droite (visage vers 430–760 px de large, 340–900 px de haut)
const traceParDefaut: [number, number][] = [[40, 860], [170, 815], [300, 745], [420, 660], [540, 570], [660, 480], [780, 395], [880, 330], [985, 300]];

// courbe lissée (Catmull-Rom → Bézier) passant par les points
const chemin = (p: [number, number][]) => {
  let d = `M ${p[0][0]} ${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0]} ${p2[1]}`;
  }
  return d;
};

export const CourbeDerriere: React.FC<{e: any; charte: any}> = ({e}) => {
  const frame = useCurrentFrame();
  const {fps, width: W, height: H} = useVideoConfig();
  const t = frame / fps;
  if (t < e.debut - 0.02 || t > e.fin) return null;
  const pts: [number, number][] = e.points ?? traceParDefaut;
  const d = chemin(pts);
  // longueur approximative du tracé (somme des segments, un peu plus pour les courbes)
  const L = pts.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]), 0) * 1.04;
  // la courbe accélère comme le riser et arrive au bout pile au moment clé
  const avance = easeIn(prog(t, e.debut, e.cle)) * 0.92 + 0.08 * prog(t, e.debut, e.cle);
  const sortie = prog(t, e.fin - 0.3, e.fin);
  const bout = pts[pts.length - 1];
  const pop = t >= e.cle ? spring({frame: (t - e.cle) * fps, fps, config: {damping: 10, stiffness: 200, mass: 0.7}}) : 0;
  const halo = t >= e.cle ? Math.exp(-(t - e.cle) * 5) : 0;
  const dep = easeOut(prog(t, e.debut, e.debut + 0.3));

  return (
    <div style={{position: 'absolute', inset: 0, opacity: 1 - sortie, filter: sortie > 0 ? `blur(${(sortie * 8).toFixed(1)}px)` : 'none'}}>
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
        <defs>
          <filter id={`ombre-courbe-${e.id}`} x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#000" floodOpacity="0.55" />
          </filter>
        </defs>
        {/* repères discrets : ligne de départ en pointillés */}
        <line x1={pts[0][0]} y1={pts[0][1]} x2={W - 40} y2={pts[0][1]} stroke="rgba(255,255,255,0.45)" strokeWidth={3} strokeDasharray="10 12" opacity={dep} />
        <path d={d} fill="none" stroke="#FFFFFF" strokeWidth={e.epaisseur ?? 16} strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={L} strokeDashoffset={(L * (1 - avance)).toFixed(1)} filter={`url(#ombre-courbe-${e.id})`} />
        {t >= e.cle && <circle cx={bout[0]} cy={bout[1]} r={26 + 60 * halo} fill="none" stroke="#FFFFFF" strokeWidth={4} opacity={halo} />}
        {t >= e.cle && <circle cx={bout[0]} cy={bout[1]} r={18 * Math.min(1, pop * 1.2)} fill="#FFFFFF" filter={`url(#ombre-courbe-${e.id})`} />}
      </svg>
      {e.depart && (
        <div style={{position: 'absolute', left: pts[0][0] + 6, top: pts[0][1] - 54, fontFamily: 'Figtree Bold', fontSize: 26, letterSpacing: '0.2em', color: '#fff',
          textShadow: '0 2px 12px rgba(0,0,0,0.8)', opacity: dep}}>{e.depart}</div>
      )}
      {t >= e.cle && (
        <div style={{position: 'absolute', right: W - bout[0] + 10, top: bout[1] - 30 - (e.label_hauteur ?? 170), transform: `scale(${(0.3 + 0.7 * pop).toFixed(3)})`, transformOrigin: '100% 100%',
          background: '#fff', color: '#000', fontFamily: 'Figtree Black', fontSize: e.label_taille ?? 150, lineHeight: 1, padding: '10px 26px 6px', letterSpacing: '-0.02em',
          boxShadow: '0 16px 40px rgba(0,0,0,0.45)', opacity: Math.min(1, pop * 2)}}>
          {e.label}
        </div>
      )}
    </div>
  );
};
