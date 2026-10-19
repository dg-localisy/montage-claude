import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {easeOut, lerp, nombreFr, prog} from '../temps';

// Chiffre qui défile jusqu'à sa valeur. Le chiffre est blanc, les signes (+, %, €…) en orange.
export const Chiffre: React.FC<{e: any; charte: any}> = ({e, charte}) => {
  const frame = useCurrentFrame();
  const {fps, width: W} = useVideoConfig();
  const t = frame / fps;
  if (t < e.debut || t > e.fin) return null;
  const C = charte.moteur.chiffre;
  const accent = charte.couleurs.orange;
  const taille = e.taille ?? C.taille_px;
  const [a, b] = e._t.comptage;
  const p = easeOut(prog(t, a, b));
  const valeur = lerp(e.de ?? 0, e.valeur, p);
  const entree = spring({frame: (t - e.debut) * fps, fps, config: {damping: 12, stiffness: 140}});
  const impulsion = t > b ? 1 + 0.07 * Math.exp(-(t - b) * 14) : 1;
  const sortie = prog(t, e.fin - 0.25, e.fin);
  const y = e.y ?? C.y;

  return (
    <div
      style={{
        position: 'absolute', left: 0, width: W, top: y - taille * 0.6, textAlign: 'center', opacity: Math.min(1, entree * 1.4) * (1 - sortie),
        transform: `translateY(${(-30 * sortie).toFixed(1)}px) scale(${((0.75 + 0.25 * entree) * impulsion).toFixed(3)})`, transformOrigin: `50% ${taille * 0.6}px`,
      }}
    >
      <div style={{fontFamily: 'Figtree Black', fontSize: taille, lineHeight: 1.2, color: '#fff', letterSpacing: -3, fontVariantNumeric: 'tabular-nums', textShadow: '0 10px 40px rgba(0,0,0,0.5)'}}>
        {e.prefixe && <span style={{color: accent}}>{e.prefixe}</span>}
        {nombreFr(valeur, e.decimales ?? 0)}
        {e.suffixe && <span style={{color: accent}}>{e.suffixe}</span>}
      </div>
      {e.legende && (
        <div style={{fontFamily: 'Figtree Medium', fontSize: 46, color: 'rgba(255,255,255,0.88)', marginTop: -8, textShadow: '0 4px 20px rgba(0,0,0,0.6)'}}>{e.legende}</div>
      )}
    </div>
  );
};
